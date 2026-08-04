import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { hasRoleAtLeast } from '../roles';
import { safeSchema } from '../common/schema.utils';
import { ACTIVITY, SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';
import { TenantSiteProposalsAiService, ProposalAiUnavailableError } from './tenant-site-proposals-ai.service';
import { TenantSiteProposalsBrandService } from './tenant-site-proposals-brand.service';
import { TenantSiteProposalsImageService } from './tenant-site-proposals-image.service';
import { buildDeterministicProposal } from './tenant-site-proposals-deterministic';
import { ensureDoflowSiteProposalTables } from './tenant-site-proposals-schema';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';
import { TenantSiteProposalsWebsiteExtractorService } from './tenant-site-proposals-website-extractor.service';
import { TenantSiteProposalsWebsiteFetcherService } from './tenant-site-proposals-website-fetcher.service';
import { AuthUserRef, CanonicalProposalInput, JsonObject, WebsiteSnapshot } from './tenant-site-proposals.types';
import { assertNoPrototypePollution, buildFingerprint, deepClone, sha256, UUID_RE, validateSiteConfig } from './tenant-site-proposals-validation';

const PROMPT_VERSION = 'personalization-v2.0.0';

@Injectable()
export class TenantSiteProposalsPersonalizationService {
  private readonly locks = new Set<string>();
  constructor(
    private readonly dataSource: DataSource,
    private readonly fetcher: TenantSiteProposalsWebsiteFetcherService,
    private readonly extractor: TenantSiteProposalsWebsiteExtractorService,
    private readonly brand: TenantSiteProposalsBrandService,
    private readonly images: TenantSiteProposalsImageService,
    private readonly ai: TenantSiteProposalsAiService,
    private readonly templates: TenantSiteProposalsTemplateService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  async personalize(id: string, rawBody: unknown) {
    const user = this.assertAccess();
    this.assertUuid(id); assertNoPrototypePollution(rawBody || {});
    const body = rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody) ? rawBody as JsonObject : {};
    for (const key of Object.keys(body)) if (!['force','upgradeTemplate'].includes(key)) throw new BadRequestException(`Campo non consentito: ${key}`);
    if (this.locks.has(id)) throw new ConflictException('Personalizzazione già in corso.');
    this.locks.add(id);
    let runId: string | undefined;
    try {
      await ensureDoflowSiteProposalTables(this.dataSource, this.schema());
      const proposal = await this.one(`SELECT * FROM "${this.schema()}".site_proposals WHERE id=$1 AND deleted_at IS NULL AND status <> 'archived'`, [id]);
      if (!proposal) throw new NotFoundException('Proposta non trovata');
      if (proposal.template_version !== '2.0.0' && body.upgradeTemplate !== true) throw new ConflictException('Aggiorna prima la proposta al Tema Colsova 2.0.');
      const runningGeneration = await this.one(`SELECT id FROM "${this.schema()}".site_proposal_generations WHERE proposal_id=$1 AND status='running' LIMIT 1`, [id]);
      if (runningGeneration) throw new ConflictException('La proposta ha una generazione in corso.');
      const running = await this.one(`SELECT id FROM "${this.schema()}".site_proposal_personalizations WHERE proposal_id=$1 AND status='running' LIMIT 1`, [id]);
      if (running) throw new ConflictException('Personalizzazione già in corso.');

      const canonical = deepClone(proposal.source_data || {}) as CanonicalProposalInput;
      canonical.businessName = canonical.businessName || proposal.display_name;
      canonical.services = Array.isArray(canonical.services) ? canonical.services : [];
      canonical.brands = Array.isArray(canonical.brands) ? canonical.brands : [];
      canonical.extra = canonical.extra && typeof canonical.extra === 'object' ? canonical.extra : {};
      const currentConfig = (proposal.site_config || {}) as JsonObject;
      const currentBrand = (currentConfig.brand || {}) as JsonObject;
      const currentBusiness = (currentConfig.business || {}) as JsonObject;
      const currentSource = (currentConfig.sourceWebsite || {}) as JsonObject;
      canonical.businessName = String(currentBrand.name || canonical.businessName);
      canonical.professionalTitle = String(currentBrand.professionalTitle || canonical.professionalTitle || '') || undefined;
      canonical.descriptor = String(currentBrand.descriptor || canonical.descriptor || '') || undefined;
      canonical.city = String(currentBusiness.city || canonical.city || '') || undefined;
      canonical.address = String(currentBusiness.address || canonical.address || '') || undefined;
      canonical.phone = String(currentBusiness.phoneDisplay || canonical.phone || '') || undefined;
      canonical.email = String(currentBusiness.email || canonical.email || '') || undefined;
      canonical.websiteUrl = String(currentSource.url || canonical.websiteUrl || '') || undefined;
      let snapshot: WebsiteSnapshot | undefined;
      const warnings: string[] = [];
      if (canonical.websiteUrl) {
        try { const fetched = await this.fetcher.fetchHomepage(canonical.websiteUrl); snapshot = this.extractor.extract(fetched.body.toString('utf8'), fetched.sourceUrl, fetched.finalUrl); }
        catch { warnings.push('Sito pubblico non disponibile: personalizzazione basata sui dati esistenti.'); }
      }
      let brandAssets: JsonObject = { warnings: [], logoDefault: '', logoLight: '' };
      if (snapshot) { try { brandAssets = await this.brand.extract(snapshot); } catch { warnings.push('Logo non elaborabile: usato il fallback testuale.'); } }
      const model = this.ai.configuration().model;
      const snapshotHash = sha256(JSON.stringify({ finalUrl: snapshot?.finalUrl || canonical.websiteUrl || '', text: snapshot?.text || '', logo: sha256(String(brandAssets.logoDefault || '')), model, template: 'colsova@2.0.0', prompt: PROMPT_VERSION }));
      if (body.force !== true) {
        const cached = await this.one(`SELECT id,status,provider,model,source_url,final_url,snapshot_hash,warnings,completed_at,created_at FROM "${this.schema()}".site_proposal_personalizations WHERE proposal_id=$1 AND snapshot_hash=$2 AND status=ANY($3::text[]) ORDER BY created_at DESC LIMIT 1`, [id,snapshotHash,['completed','fallback']]);
        if (cached) return { cached: true, status: cached.status, personalization: cached };
      }
      const run = await this.one(`INSERT INTO "${this.schema()}".site_proposal_personalizations (proposal_id,status,provider,model,source_url,final_url,snapshot_hash,extracted_data,brand_assets,warnings,created_by,started_at) VALUES ($1,'running','local',$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,now()) RETURNING *`, [id,model,canonical.websiteUrl||null,snapshot?.finalUrl||null,snapshotHash,JSON.stringify(this.publicSnapshot(snapshot)),JSON.stringify(brandAssets),JSON.stringify(warnings),this.userId(user)]);
      runId = run.id;
      await this.dataSource.query(`UPDATE "${this.schema()}".site_proposals SET personalization_status='running',updated_at=now() WHERE id=$1`,[id]);
      const base = await this.templates.getDefaultConfig('colsova','2.0.0');
      const initial = buildDeterministicProposal(base, canonical, snapshot, brandAssets);
      const resolvedImages = await this.images.resolveImages(snapshot, ((currentConfig.images || initial.config.images) as JsonObject), buildFingerprint(canonical), canonical.category || canonical.descriptor, body.force === true);
      brandAssets.images = resolvedImages.images;
      warnings.push(...resolvedImages.warnings);
      const built = buildDeterministicProposal(base, canonical, snapshot, brandAssets);
      const nextBusiness = built.config.business as JsonObject;
      if (body.force !== true) for (const key of ['socialLinkedIn','socialInstagram','socialFacebook']) {
        const manual = String(currentBusiness[key] || '');
        if (/^https:\/\//i.test(manual)) nextBusiness[key] = manual;
      }
      const currentImages = (currentConfig.images || {}) as JsonObject;
      const nextImages = built.config.images as JsonObject;
      if (!brandAssets.logoDefault) {
        const defaultLogo = (currentImages.logoDefault || currentImages.logo || {}) as JsonObject;
        const lightLogo = (currentImages.logoLight || {}) as JsonObject;
        if (defaultLogo.src) nextImages.logoDefault = { src: defaultLogo.src, alt: defaultLogo.alt || canonical.businessName };
        if (lightLogo.src) nextImages.logoLight = { src: lightLogo.src, alt: lightLogo.alt || canonical.businessName };
      }
      const palette = brandAssets.palette;
      if (palette && typeof palette === 'object' && !Array.isArray(palette)) built.config.palette = palette;
      let status: 'completed'|'fallback' = 'fallback'; let provider='local'; let usedModel='';
      try {
        const generated = await this.ai.generate(this.aiPayload(canonical,snapshot,built.config.palette as JsonObject),built.config.textLimits as JsonObject);
        const output=generated.output; built.analysis=output.analysis as JsonObject; built.config.content=output.content; built.config.seo=output.seo; built.email={subject:String((output.email as JsonObject).subject||''),body:String((output.email as JsonObject).body||'')};
        status='completed';provider='gemini';usedModel=generated.model;
      } catch (error) {
        if (!(error instanceof ProposalAiUnavailableError)) throw error;
        warnings.push('Gemini non disponibile: applicato il motore locale deterministico.');
      }
      const methods = [...new Set(Object.values(resolvedImages.images).map((image) => image.sourceMethod))];
      built.config.personalization={status,provider,model:usedModel,sourceUrl:snapshot?.finalUrl||canonical.websiteUrl||'',snapshotHash,completedAt:new Date().toISOString(),warnings,assetMethod:methods.join('+'),copyMethod:provider==='gemini'?'ai':'deterministic'};
      validateSiteConfig(built.config);
      const nextVersion=Number(proposal.current_version)+1;
      const runner=this.dataSource.createQueryRunner();let original:unknown;
      try {
        await runner.connect();await runner.startTransaction();
        const locked=(await runner.query(`SELECT id,template_version FROM "${this.schema()}".site_proposals WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,[id]))[0];
        if(!locked)throw new NotFoundException('Proposta non trovata');
        await runner.query(`UPDATE "${this.schema()}".site_proposals SET template_version='2.0.0',site_config=$1::jsonb,commercial_analysis=$2::jsonb,email_subject=$3,email_body=$4,personalization_status=$5,latest_personalization_id=$6,last_personalized_at=now(),current_version=$7,status='ready',updated_by=$8,updated_at=now() WHERE id=$9`,[JSON.stringify(built.config),JSON.stringify(built.analysis),built.email.subject,built.email.body,status,runId,nextVersion,this.userId(user),id]);
        await runner.query(`INSERT INTO "${this.schema()}".site_proposal_versions (proposal_id,version,site_config,commercial_analysis,email_subject,email_body,reason,created_by) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,'personalization',$7)`,[id,nextVersion,JSON.stringify(built.config),JSON.stringify(built.analysis),built.email.subject,built.email.body,this.userId(user)]);
        await runner.query(`UPDATE "${this.schema()}".site_proposal_personalizations SET status=$1,provider=$2,model=$3,website_analysis=$4::jsonb,generated_content=$5::jsonb,brand_assets=$6::jsonb,warnings=$7::jsonb,completed_at=now() WHERE id=$8`,[status,provider,usedModel||null,JSON.stringify(built.analysis),JSON.stringify({content:built.config.content,seo:built.config.seo,email:built.email}),JSON.stringify(brandAssets),JSON.stringify(warnings),runId]);
        if(proposal.template_version!=='2.0.0')await this.insertActivity(runner,id,ACTIVITY.proposalTemplateUpgraded,user,{from:proposal.template_version,to:'2.0.0'});
        await this.insertActivity(runner,id,status==='completed'?ACTIVITY.proposalPersonalizationCompleted:ACTIVITY.proposalPersonalizationFallback,user,{personalizationId:runId,provider});
        await runner.commitTransaction();
      }catch(error){original=error;if(runner.isTransactionActive)await Promise.resolve(runner.rollbackTransaction()).catch(()=>undefined);throw error;}finally{await Promise.resolve(runner.release()).catch((error)=>{if(!original)throw error;});}
      return { cached:false,status,provider,personalizationId:runId,proposalVersion:nextVersion,warnings };
    } catch (error) {
      if (runId) await this.failRun(id,runId,error).catch(()=>undefined);
      throw error;
    } finally { this.locks.delete(id); }
  }

  async list(id:string){this.assertAccess();this.assertUuid(id);await ensureDoflowSiteProposalTables(this.dataSource,this.schema());const proposal=await this.one(`SELECT id FROM "${this.schema()}".site_proposals WHERE id=$1 AND deleted_at IS NULL`,[id]);if(!proposal)throw new NotFoundException('Proposta non trovata');return this.dataSource.query(`SELECT id,status,provider,model,source_url,final_url,snapshot_hash,website_analysis,brand_assets,warnings,error_message,started_at,completed_at,created_at FROM "${this.schema()}".site_proposal_personalizations WHERE proposal_id=$1 ORDER BY created_at DESC`,[id]);}
  private publicSnapshot(snapshot?:WebsiteSnapshot){if(!snapshot)return {};return {sourceUrl:snapshot.sourceUrl,finalUrl:snapshot.finalUrl,title:snapshot.title,description:snapshot.description,headings:snapshot.headings,ctas:snapshot.ctas,social:snapshot.social,logoCandidates:snapshot.logoCandidates.length,imageCandidates:snapshot.imageCandidates.length,textChars:snapshot.text.length};}
  private aiPayload(input:CanonicalProposalInput,snapshot:WebsiteSnapshot|undefined,palette:JsonObject):JsonObject{return {businessName:input.businessName,category:input.category||input.descriptor||'',city:input.city||'',publicUrl:input.websiteUrl||'',title:snapshot?.title||'',metaDescription:snapshot?.description||'',headings:snapshot?.headings||[],publicText:(snapshot?.text||'').slice(0,12000),services:input.services.slice(0,12),social:snapshot?.social||{},observable:{ctas:snapshot?.ctas||[],contactsPresent:Boolean(snapshot?.emails.length||snapshot?.phones.length),navigation:snapshot?.navigation||[]},palette};}
  private async failRun(id:string,runId:string,error:unknown){const message=error instanceof BadRequestException||error instanceof ConflictException||error instanceof NotFoundException?String(error.message).slice(0,300):'Personalizzazione non riuscita.';await this.dataSource.query(`UPDATE "${this.schema()}".site_proposal_personalizations SET status='failed',error_message=$1,completed_at=now() WHERE id=$2`,[message,runId]);await this.dataSource.query(`UPDATE "${this.schema()}".site_proposals SET personalization_status='failed',updated_at=now() WHERE id=$1`,[id]);}
  private insertActivity(runner:any,id:string,action:string,user:AuthUserRef,metadata:JsonObject){return runner.query(`INSERT INTO "${this.schema()}".site_proposal_activity (proposal_id,action,metadata,actor_user_id,actor_email) VALUES ($1,$2,$3::jsonb,$4,$5)`,[id,action,JSON.stringify(metadata),this.userId(user),user.email||null]);}
  private assertAccess():AuthUserRef{const user=this.request?.user||this.request?.authUser;const role=String(user?.role||'').toLowerCase().trim();if(!user||!hasRoleAtLeast(role,'manager'))throw new ForbiddenException('Accesso non autorizzato');return {id:String(user.sub||user.id||user.userId||''),email:user.email||null,role};}
  private userId(user:AuthUserRef){return UUID_RE.test(user.id)?user.id:null;}
  private assertUuid(id:string){if(!UUID_RE.test(id))throw new BadRequestException('ID proposta non valido');}
  private schema(){const user=this.request?.user||this.request?.authUser;const tenantRef=[user?.tenantId,user?.tenant_id,user?.tenantSlug,this.request?.tenantId,this.request?.tenant?.schemaName,this.request?.tenant?.schema].find(value=>typeof value==='string'&&value.trim());if(!tenantRef)throw new NotFoundException('Tenant non trovato');const schema=safeSchema(tenantRef,'site proposals personalization');if(schema==='public')throw new NotFoundException('Tenant non trovato');if(schema!==SITE_PROPOSALS_TENANT)throw new ForbiddenException('Funzione disponibile solo per doflow');return schema;}
  private async one(sql:string,params:unknown[]){return (await this.dataSource.query(sql,params))[0];}
}
