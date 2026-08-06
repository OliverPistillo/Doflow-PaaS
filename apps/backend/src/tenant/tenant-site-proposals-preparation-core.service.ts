import { BadRequestException, Injectable, NotFoundException, Optional } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ACTIVITY, SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';
import { TenantSiteProposalsAiService, ProposalAiUnavailableError } from './tenant-site-proposals-ai.service';
import { mapBrandPaletteForContentProfile, TenantSiteProposalsBrandService } from './tenant-site-proposals-brand.service';
import { applyAiOutputForProfile, buildDeterministicProposalForTemplate, DeterministicPackage } from './tenant-site-proposals-deterministic';
import { TenantSiteProposalsGenerationCoreService } from './tenant-site-proposals-generation-core.service';
import { evaluateProposalReadiness } from './tenant-site-proposals-readiness';
import { TenantSiteProposalsImageService } from './tenant-site-proposals-image.service';
import { ensureDoflowSiteProposalTables } from './tenant-site-proposals-schema';
import { SiteProposalTemplateRegistration } from './tenant-site-proposals-template-registry';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';
import { TenantSiteProposalsWebsiteExtractorService } from './tenant-site-proposals-website-extractor.service';
import { TenantSiteProposalsWebsiteFetcherService } from './tenant-site-proposals-website-fetcher.service';
import { CanonicalProposalInput, JsonObject, ProposalPreparationActor, ProposalPreparationJobData, ThemeImageMode, WebsiteSnapshot } from './tenant-site-proposals.types';
import { assertNoPrototypePollution, buildFingerprint, cleanString, deepClone, sha256, UUID_RE, validateSiteConfig } from './tenant-site-proposals-validation';
import { getProposalContentProfileAdapter } from './tenant-site-proposals-content-profile-adapters';
import { assertProposalPersonalizationDelta, evaluateProposalPersonalizationDelta } from './tenant-site-proposals-personalization-delta';
import { TenantSiteProposalsLogoGeneratorService } from './tenant-site-proposals-logo-generator.service';
import { TenantSiteProposalsPreparationProgressService } from './tenant-site-proposals-preparation-progress.service';

const JOB_KEYS = ['preparationRunId','tenantSchema','proposalId','actorUserId','actorEmail','force','generate','reason','targetTemplateSlug','targetTemplateVersion'];

@Injectable()
export class TenantSiteProposalsPreparationCoreService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly fetcher: TenantSiteProposalsWebsiteFetcherService,
    private readonly extractor: TenantSiteProposalsWebsiteExtractorService,
    private readonly brand: TenantSiteProposalsBrandService,
    private readonly images: TenantSiteProposalsImageService,
    private readonly ai: TenantSiteProposalsAiService,
    private readonly templates: TenantSiteProposalsTemplateService,
    private readonly generation: TenantSiteProposalsGenerationCoreService,
    private readonly logoGenerator: TenantSiteProposalsLogoGeneratorService = new TenantSiteProposalsLogoGeneratorService(),
    @Optional() private readonly progress?: TenantSiteProposalsPreparationProgressService,
  ) {}

  async prepare(raw: ProposalPreparationJobData) {
    const data = this.job(raw); const schema = data.tenantSchema;
    await ensureDoflowSiteProposalTables(this.dataSource, schema);
    const actor: ProposalPreparationActor = { id: data.actorUserId, email: data.actorEmail };
    const runner = this.dataSource.createQueryRunner(); let locked = false; let runId: string | undefined; let personalizationCommitted = false;
    try {
      await runner.connect();
      locked = Boolean((await runner.query(`SELECT pg_try_advisory_lock(hashtext($1),hashtext($2)) locked`, [schema, data.proposalId]))[0]?.locked);
      if (!locked) return { status: 'duplicate', proposalId: data.proposalId };
      const proposal = (await runner.query(`SELECT * FROM "${schema}".site_proposals WHERE id=$1 AND deleted_at IS NULL AND status<>'archived'`, [data.proposalId]))[0];
      if (!proposal) throw new NotFoundException('Proposta non trovata');
      await runner.query(`UPDATE "${schema}".site_proposals SET preparation_status='running',preparation_error=NULL,preparation_started_at=now(),updated_at=now() WHERE id=$1`, [data.proposalId]);
      const persistedPersonalization = object(proposal.site_config) && object((proposal.site_config as JsonObject).personalization)
        ? (proposal.site_config as JsonObject).personalization as JsonObject
        : {};
      if (persistedPersonalization.preparationRunId === data.preparationRunId) {
        personalizationCommitted = true;
        runId = typeof proposal.latest_personalization_id === 'string' ? proposal.latest_personalization_id : undefined;
        return await this.finalizePreparedProposal(data, proposal, actor, runner, true);
      }
      await this.activity(schema, data.proposalId, ACTIVITY.proposalPreparationStarted, actor, { reason: data.reason });

      const targetSlug = data.targetTemplateSlug || proposal.template_slug;
      const targetVersion = data.targetTemplateVersion || proposal.template_version;
      const registration = await this.templates.getRegistration(targetSlug, targetVersion, { schema, dataSource: this.dataSource });
      if (!registration.isActive) throw new BadRequestException('La versione tema target non è attiva');
      const adapter = getProposalContentProfileAdapter(registration.contentProfile);
      const context = { schema, dataSource: this.dataSource };
      const base = await this.templates.getDefaultConfig(targetSlug, targetVersion, context);
      await this.report(data, 18, 'loading-theme', 'Caricamento tema');
      const canonical = this.canonical(proposal);
      const currentConfig = (proposal.site_config || {}) as JsonObject;
      this.overlayManualCanonical(canonical, currentConfig);
      const warnings: string[] = [];
      let snapshot: WebsiteSnapshot | undefined;
      if (canonical.websiteUrl) {
        try {
          const fetched = await this.fetcher.fetchHomepage(canonical.websiteUrl);
          snapshot = this.extractor.extract(fetched.body.toString('utf8'), fetched.sourceUrl, fetched.finalUrl);
        } catch { warnings.push('Sito pubblico non disponibile: usato il motore locale sui dati verificabili.'); }
      }
      let brandAssets: JsonObject = { warnings: [], logoDefault: '', logoLight: '' };
      if (snapshot) try { brandAssets = await this.brand.extract(snapshot); } catch { warnings.push('Logo non elaborabile: preservato il fallback del tema.'); }
      await this.report(data, 25, 'identity', 'Analisi identità e contatti');
      let built = buildDeterministicProposalForTemplate(base, registration, canonical, snapshot, brandAssets);
      this.preserveManualValues(built.config, currentConfig, brandAssets, data.force);
      if (object(brandAssets.palette)) built.config.palette = mapBrandPaletteForContentProfile(brandAssets.palette as JsonObject, registration.contentProfile, built.config.palette as JsonObject);
      assertProposalPersonalizationDelta(base, built.config, adapter);
      await this.report(data, 35, 'base-content', 'Creazione contenuti base');

      const snapshotHash = sha256(JSON.stringify({ finalUrl: snapshot?.finalUrl || canonical.websiteUrl || '', text: snapshot?.text || '', template: `${registration.slug}@${registration.version}`, profile: registration.contentProfile }));
      const run = (await runner.query(`INSERT INTO "${schema}".site_proposal_personalizations (proposal_id,status,provider,model,source_url,final_url,snapshot_hash,extracted_data,brand_assets,warnings,created_by,started_at) VALUES ($1,'running','local',$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9,now()) RETURNING id`, [data.proposalId, this.ai.configuration().model, canonical.websiteUrl || null, snapshot?.finalUrl || null, snapshotHash, JSON.stringify(this.publicSnapshot(snapshot)), JSON.stringify(brandAssets), JSON.stringify(warnings), this.userId(actor.id)]))[0];
      runId = run.id;
      let provider: 'gemini'|'local' = 'local'; let personalizationStatus: 'completed'|'fallback' = 'fallback'; let model = '';
      let aiOutput: JsonObject | undefined;
      const aiAvailable = this.ai.configuration().available;
      await this.report(data, 48, aiAvailable ? 'ai' : 'local', aiAvailable ? 'Personalizzazione AI' : 'Personalizzazione locale', aiAvailable ? undefined : 'local');
      try {
        const generated = await this.ai.generate(this.aiPayload(canonical, snapshot, built.config.palette as JsonObject), built.config.textLimits as JsonObject, registration.contentProfile);
        const candidate = applyAiOutputForProfile(built, generated.output, registration);
        this.assertPostconditions(candidate, registration);
        const aiDelta = evaluateProposalPersonalizationDelta(built.config, candidate.config, adapter);
        if (!aiDelta.sufficient) throw new ProposalAiUnavailableError('visible_delta_insufficient');
        aiOutput = generated.output; provider = 'gemini'; personalizationStatus = 'completed'; model = generated.model;
      } catch (error) {
        if (!(error instanceof ProposalAiUnavailableError)) warnings.push('Output AI rifiutato: applicato il motore locale.');
        else warnings.push(`Gemini non disponibile (${error.reason}): applicato il motore locale.`);
      }
      const themeChanged = proposal.template_slug !== registration.slug || proposal.template_version !== registration.version;
      const imageMode = themeChanged ? (registration.isBuiltin ? 'hybrid' : 'theme') : this.imageMode(proposal.image_mode, registration.isBuiltin);
      const currentImages = (currentConfig.images || built.config.images) as JsonObject;
      const themeImages = (base.images || {}) as JsonObject;
      const registrationManifest = (registration as SiteProposalTemplateRegistration & { manifest?: JsonObject }).manifest;
      const assetMap = object(registrationManifest?.assetMap) ? registrationManifest.assetMap as JsonObject : {};
      const resolved = await this.images.resolveImages(snapshot, currentImages, buildFingerprint(canonical), canonical.category || canonical.descriptor, data.force, imageMode, themeImages, assetMap);
      brandAssets.images = resolved.images; warnings.push(...resolved.warnings);
      await this.report(data, 60, 'images', 'Selezione immagini', provider);
      brandAssets = this.resolveLogoAssets(canonical, currentConfig, brandAssets, base, registration.contentProfile, warnings);
      await this.report(data, 70, 'logo', 'Creazione o applicazione logo', provider);
      built = buildDeterministicProposalForTemplate(base, registration, canonical, snapshot, brandAssets);
      this.preserveManualValues(built.config, currentConfig, brandAssets, data.force);
      if (object(brandAssets.palette)) built.config.palette = mapBrandPaletteForContentProfile(brandAssets.palette as JsonObject, registration.contentProfile, built.config.palette as JsonObject);
      if (aiOutput) built = applyAiOutputForProfile(built, aiOutput, registration);
      this.applyThemeAssetMetadata(imageMode, base, built.config, currentConfig, assetMap);
      const finalDelta = assertProposalPersonalizationDelta(base, built.config, adapter);
      const configSha256 = sha256(JSON.stringify(built.config));
      (built.config.personalization as JsonObject) = { ...((built.config.personalization || {}) as JsonObject), preparationRunId: data.preparationRunId, status: personalizationStatus, provider, model, imageMode, sourceUrl: snapshot?.finalUrl || canonical.websiteUrl || '', snapshotHash, completedAt: new Date().toISOString(), warnings, copyMethod: provider === 'gemini' ? 'ai' : 'deterministic', changedVisiblePaths: finalDelta.changedVisiblePaths, unchangedVisiblePaths: finalDelta.unchangedVisiblePaths, changedVisibleCount: finalDelta.changedVisibleCount, personalizationFingerprint: finalDelta.personalizationFingerprint, configSha256 };
      this.assertPostconditions(built, registration);
      this.assertThemeImages(imageMode, base, built.config, currentConfig, assetMap);
      await this.report(data, 78, 'validation', 'Validazione proposta', provider);

      const nextVersion = Number(proposal.current_version || 0) + 1;
      await runner.startTransaction();
      const current = (await runner.query(`SELECT id FROM "${schema}".site_proposals WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`, [data.proposalId]))[0];
      if (!current) throw new NotFoundException('Proposta non trovata');
      await runner.query(`UPDATE "${schema}".site_proposals SET template_slug=$1,template_version=$2,site_config=$3::jsonb,commercial_analysis=$4::jsonb,email_subject=$5,email_body=$6,current_version=$7,personalization_status=$8,latest_personalization_id=$9,last_personalized_at=now(),image_mode=$10,updated_by=$11,updated_at=now() WHERE id=$12`, [registration.slug, registration.version, JSON.stringify(built.config), JSON.stringify(built.analysis), built.email.subject, built.email.body, nextVersion, personalizationStatus, runId, imageMode, this.userId(actor.id), data.proposalId]);
      await runner.query(`INSERT INTO "${schema}".site_proposal_versions (proposal_id,version,site_config,commercial_analysis,email_subject,email_body,reason,created_by) VALUES ($1,$2,$3::jsonb,$4::jsonb,$5,$6,$7,$8)`, [data.proposalId, nextVersion, JSON.stringify(built.config), JSON.stringify(built.analysis), built.email.subject, built.email.body, data.reason, this.userId(actor.id)]);
      await runner.query(`UPDATE "${schema}".site_proposal_personalizations SET status=$1,provider=$2,model=$3,website_analysis=$4::jsonb,generated_content=$5::jsonb,brand_assets=$6::jsonb,warnings=$7::jsonb,completed_at=now() WHERE id=$8`, [personalizationStatus, provider, model || null, JSON.stringify(built.analysis), JSON.stringify({ content: built.config.content, seo: built.config.seo, email: built.email, delta: finalDelta, configSha256 }), JSON.stringify(brandAssets), JSON.stringify(warnings), runId]);
      if (proposal.template_slug !== registration.slug || proposal.template_version !== registration.version) await this.activityWith(runner, schema, data.proposalId, ACTIVITY.proposalTemplateUpgraded, actor, { from: `${proposal.template_slug}@${proposal.template_version}`, to: `${registration.slug}@${registration.version}` });
      await runner.commitTransaction();
      personalizationCommitted = true;
      return await this.finalizePreparedProposal(data, {
        ...proposal,
        template_slug: registration.slug,
        template_version: registration.version,
        site_config: built.config,
        commercial_analysis: built.analysis,
        email_subject: built.email.subject,
        email_body: built.email.body,
        current_version: nextVersion,
        latest_personalization_id: runId,
      }, actor, runner, false);
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined);
      const message = this.error(error);
      await this.report(data, 0, 'failed', message, undefined, true).catch(() => undefined);
      await this.dataSource.query(`UPDATE "${data.tenantSchema}".site_proposals SET preparation_status='failed',preparation_error=$1,preparation_completed_at=now(),updated_at=now() WHERE id=$2`, [message, data.proposalId]).catch(() => undefined);
      if (runId && !personalizationCommitted) await this.dataSource.query(`UPDATE "${data.tenantSchema}".site_proposal_personalizations SET status='failed',error_message=$1,completed_at=now() WHERE id=$2`, [message, runId]).catch(() => undefined);
      await this.activity(data.tenantSchema, data.proposalId, ACTIVITY.proposalPreparationFailed, { id: data.actorUserId, email: data.actorEmail }, { message }).catch(() => undefined);
      throw error;
    } finally {
      if (locked) await runner.query(`SELECT pg_advisory_unlock(hashtext($1),hashtext($2))`, [data.tenantSchema, data.proposalId]).catch(() => undefined);
      await runner.release().catch(() => undefined);
    }
  }

  private async finalizePreparedProposal(data: ProposalPreparationJobData, proposal: any, actor: ProposalPreparationActor, runner: { query: (...args: any[]) => Promise<any> }, resume: boolean) {
    const schema = data.tenantSchema;
    const config = proposal.site_config as JsonObject;
    const registration = await this.templates.getRegistration(String(proposal.template_slug), String(proposal.template_version), { schema, dataSource: this.dataSource });
    validateSiteConfig(config, registration);
    let generationComplete = !data.generate;
    if (data.generate) {
      const existing = resume ? (await runner.query(`SELECT id FROM "${schema}".site_proposal_generations WHERE proposal_id=$1 AND proposal_version=$2 AND status='completed' ORDER BY completed_at DESC LIMIT 1`, [data.proposalId, proposal.current_version]))[0] : undefined;
      if (existing) generationComplete = true;
      else {
        const generated = await this.generation.generate(schema, actor, data.proposalId, {
          preparationRunId: data.preparationRunId,
          onProgress: async (percent, stage, message) => this.report(data, percent, stage, message),
        });
        if (generated.status !== 'completed') throw new Error(generated.error_message || 'Generazione automatica non riuscita');
        generationComplete = true;
      }
    }
    const readiness = evaluateProposalReadiness({ emailSubject: proposal.email_subject, emailBody: proposal.email_body, commercialAnalysis: proposal.commercial_analysis, siteConfigValid: true, generationComplete, requireGeneration: data.generate, adapterReady: registration.runtimeAdapterStatus === 'ready', themeActive: registration.isActive });
    if (!readiness.complete) throw new ProposalAiUnavailableError(`readiness_incomplete:${readiness.reasons.join(',')}`);
    const personalization = object(config.personalization) ? config.personalization as JsonObject : {};
    const provider: 'gemini'|'local' = personalization.provider === 'gemini' ? 'gemini' : 'local';
    const preparationStatus = provider === 'gemini' ? 'ready' : 'fallback';
    const warnings = Array.isArray(personalization.warnings) ? personalization.warnings.filter((value): value is string => typeof value === 'string') : [];
    await this.report(data, 100, 'ready', provider === 'gemini' ? 'Pronta con AI' : 'Pronta localmente', provider);
    await runner.query(`UPDATE "${schema}".site_proposals SET preparation_status=$1,preparation_error=NULL,preparation_completed_at=now(),updated_at=now() WHERE id=$2`, [preparationStatus, data.proposalId]);
    await this.activity(schema, data.proposalId, provider === 'gemini' ? ACTIVITY.proposalPreparationReady : ACTIVITY.proposalPreparationFallback, actor, { provider, personalizationId: proposal.latest_personalization_id || null, resumed: resume });
    return { status: preparationStatus, provider, proposalId: data.proposalId, warnings };
  }

  private job(raw: ProposalPreparationJobData): ProposalPreparationJobData {
    assertNoPrototypePollution(raw, 'preparationJob');
    if (!object(raw) || Object.keys(raw).some((key) => !JOB_KEYS.includes(key))) throw new BadRequestException('Dati job non validi');
    const schema = safeSchema(raw.tenantSchema, 'site proposal preparation job');
    if (schema !== SITE_PROPOSALS_TENANT || !UUID_RE.test(raw.proposalId) || !UUID_RE.test(raw.preparationRunId)) throw new BadRequestException('Job preparation non autorizzato');
    if (typeof raw.force !== 'boolean' || typeof raw.generate !== 'boolean' || typeof raw.reason !== 'string' || !raw.reason.trim()) throw new BadRequestException('Opzioni job non valide');
    if (raw.targetTemplateSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(raw.targetTemplateSlug)) throw new BadRequestException('Tema target non valido');
    if (raw.targetTemplateVersion && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(raw.targetTemplateVersion)) throw new BadRequestException('Versione target non valida');
    return { ...raw, tenantSchema: schema, actorUserId: raw.actorUserId && UUID_RE.test(raw.actorUserId) ? raw.actorUserId : null, actorEmail: cleanString(raw.actorEmail, 320) || null };
  }

  private canonical(proposal: any): CanonicalProposalInput {
    const value = deepClone(proposal.source_data || {}) as CanonicalProposalInput;
    value.businessName = value.businessName || proposal.display_name; value.services = Array.isArray(value.services) ? value.services : []; value.brands = Array.isArray(value.brands) ? value.brands : []; value.extra = object(value.extra) ? value.extra : {};
    return value;
  }
  private overlayManualCanonical(value: CanonicalProposalInput, config: JsonObject) {
    const brand = object(config.brand) ? config.brand : {}; const business = object(config.business) ? config.business : {}; const source = object(config.sourceWebsite) ? config.sourceWebsite : {};
    value.businessName = String(brand.name || value.businessName); value.descriptor = String(brand.descriptor || value.descriptor || '') || undefined;
    value.city = String(business.city || value.city || '') || undefined; value.address = String(business.address || value.address || '') || undefined; value.phone = String(business.phoneDisplay || value.phone || '') || undefined; value.email = String(business.email || value.email || '') || undefined; value.websiteUrl = String(source.url || value.websiteUrl || '') || undefined;
  }
  private preserveManualValues(next: JsonObject, current: JsonObject, assets: JsonObject, force: boolean) {
    const nextBusiness = next.business as JsonObject; const currentBusiness = object(current.business) ? current.business : {};
    for (const key of ['address','phoneDisplay','phoneHref','email','socialLinkedIn','socialInstagram','socialFacebook','hours']) if (currentBusiness[key]) nextBusiness[key] = currentBusiness[key];
    const currentImages = object(current.images) ? current.images : {}; const nextImages = next.images as JsonObject;
    if (!assets.logoDefault) for (const slot of ['logoDefault','logoLight']) if (object(currentImages[slot]) && (currentImages[slot] as JsonObject).src) nextImages[slot] = deepClone(currentImages[slot]);
    const currentBrand = object(current.brand) ? current.brand : {}; const nextBrand = object(next.brand) ? next.brand : {};
    if (!assets.logoDefault) for (const slot of ['logoDefault','logoLight']) if (typeof currentBrand[slot] === 'string' && currentBrand[slot]) nextBrand[slot] = currentBrand[slot];
    for (const slot of ['hero','consultation','feature']) if (object(currentImages[slot]) && (currentImages[slot] as JsonObject).sourceMethod === 'manual') nextImages[slot] = deepClone(currentImages[slot]);
    if (!force && object(current.palette) && object(next.palette) && Object.keys(current.palette).sort().join('|') === Object.keys(next.palette).sort().join('|')) next.palette = deepClone(current.palette);
  }
  private resolveLogoAssets(input: CanonicalProposalInput, current: JsonObject, extracted: JsonObject, base: JsonObject, contentProfile: string, warnings: string[]): JsonObject {
    const currentImages = object(current.images) ? current.images : {};
    const currentBrand = object(current.brand) ? current.brand : {};
    const manualDefault = this.manualLogo(currentImages.logoDefault) || (currentBrand.logoSourceMethod === 'manual' ? this.logoSrc(currentBrand.logoDefault) : '') || this.validLogo(input.logoUrl);
    const manualLight = this.manualLogo(currentImages.logoLight) || (currentBrand.logoSourceMethod === 'manual' ? this.logoSrc(currentBrand.logoLight) : '');
    if (manualDefault) return { ...extracted, logoDefault: manualDefault, logoLight: manualLight || manualDefault, logoSource: 'manual', sourceMethod: 'manual' };
    const currentExtracted = ['extracted','website'].includes(String((object(currentImages.logoDefault) ? currentImages.logoDefault.sourceMethod : '') || currentBrand.logoSourceMethod || currentBrand.logoMethod || ''));
    const extractedDefault = this.validLogo(extracted.logoDefault) || (currentExtracted ? this.logoSrc(currentImages.logoDefault) || this.logoSrc(currentBrand.logoDefault) : '');
    const extractedLight = this.validLogo(extracted.logoLight) || (currentExtracted ? this.logoSrc(currentImages.logoLight) || this.logoSrc(currentBrand.logoLight) : '');
    if (extractedDefault) return { ...extracted, logoDefault: extractedDefault, logoLight: extractedLight || extractedDefault, logoSource: 'extracted', sourceMethod: 'extracted' };
    try {
      const generated = this.logoGenerator.generate({ businessName: input.businessName, descriptor: input.descriptor || input.category, palette: object(extracted.palette) ? extracted.palette : object(base.palette) ? base.palette : {}, contentProfile: contentProfile as any, fingerprint: buildFingerprint(input) });
      const { bytes: _defaultBytes, ...defaultAsset } = generated.defaultLogo;
      const { bytes: _lightBytes, ...lightAsset } = generated.lightLogo;
      return { ...extracted, logoDefault: generated.defaultLogo.dataUri, logoLight: generated.lightLogo.dataUri, logoDefaultAsset: defaultAsset, logoLightAsset: lightAsset, logoMetadata: generated.metadata, logoSource: 'generated', sourceMethod: 'generated' };
    } catch {
      warnings.push('Logo automatico non disponibile: applicato il fallback testuale.');
      return { ...extracted, logoDefault: '', logoLight: '', logoSource: 'text-fallback', sourceMethod: 'text-fallback' };
    }
  }
  private manualLogo(value: unknown) { return object(value) && value.sourceMethod === 'manual' ? this.validLogo(value.src) : ''; }
  private logoSrc(value: unknown) { return typeof value === 'string' ? this.validLogo(value) : object(value) ? this.validLogo(value.src) : ''; }
  private validLogo(value: unknown) { const logo = typeof value === 'string' ? value.trim() : ''; return /^(?:data:image\/(?:svg\+xml|png|jpe?g|webp);base64,[a-z0-9+/=]+|https:\/\/[^\s]+)$/i.test(logo) ? logo : ''; }
  private imageMode(value: unknown, builtIn: boolean): ThemeImageMode {
    return ['theme','website','hybrid','manual'].includes(String(value)) ? value as ThemeImageMode : builtIn ? 'hybrid' : 'theme';
  }
  private assertThemeImages(mode: ThemeImageMode, base: JsonObject, finalConfig: JsonObject, current: JsonObject, assetMap: JsonObject) {
    if (mode !== 'theme') return;
    for (const role of Object.keys(assetMap).filter((key) => key.startsWith('images.') && key.endsWith('.src'))) {
      const ownerPath = role.slice(0, -4); const baseAsset = this.pathValue(base, ownerPath); const finalAsset = this.pathValue(finalConfig, ownerPath); const currentAsset = this.pathValue(current, ownerPath);
      const manual = object(currentAsset) && currentAsset.sourceMethod === 'manual';
      if (!manual && (!object(baseAsset) || !object(finalAsset) || finalAsset.src !== baseAsset.src || finalAsset.sourceMethod !== 'theme-package')) throw new Error(`theme_package_image_postcondition:${ownerPath}`);
    }
  }
  private applyThemeAssetMetadata(mode: ThemeImageMode, base: JsonObject, finalConfig: JsonObject, current: JsonObject, assetMap: JsonObject) {
    if (mode !== 'theme') return;
    for (const [role, rawDeclaration] of Object.entries(assetMap)) {
      if (!role.startsWith('images.') || !role.endsWith('.src') || !object(rawDeclaration)) continue;
      const ownerPath = role.slice(0, -4); const baseAsset = this.pathValue(base, ownerPath); const finalAsset = this.pathValue(finalConfig, ownerPath); const currentAsset = this.pathValue(current, ownerPath);
      if (!object(baseAsset) || !object(finalAsset) || (object(currentAsset) && currentAsset.sourceMethod === 'manual')) continue;
      finalAsset.src = baseAsset.src; finalAsset.sourceMethod = 'theme-package'; finalAsset.assetSha256 = rawDeclaration.sha256; finalAsset.assetMime = rawDeclaration.mime; finalAsset.assetPath = rawDeclaration.path;
    }
  }
  private pathValue(root: unknown, path: string): unknown {
    return path.split('.').reduce<unknown>((value, part) => value && typeof value === 'object' ? (value as Record<string, unknown>)[part] : undefined, root);
  }
  private assertPostconditions(built: DeterministicPackage, registration: SiteProposalTemplateRegistration) {
    validateSiteConfig(built.config, registration);
    const analysis = built.analysis; const email = built.email; const seo = built.config.seo as JsonObject;
    if (typeof analysis.summary !== 'string' || analysis.summary.trim().length < 40 || !Array.isArray(analysis.strengths) || !analysis.strengths.length || !Array.isArray(analysis.improvementAreas) || !analysis.improvementAreas.length || !Array.isArray(analysis.opportunities) || !analysis.opportunities.length || !Array.isArray(analysis.whyDoflow) || !analysis.whyDoflow.length || !Array.isArray(analysis.evidence) || !analysis.evidence.length || typeof analysis.requiresManualReview !== 'boolean') throw new ProposalAiUnavailableError('analysis_incomplete');
    if (!email.subject?.trim() || email.subject.trim().length < 8 || !email.body?.trim() || email.body.trim().length < 250 || !email.body.includes('[LINK_DEMO]')) throw new ProposalAiUnavailableError('email_incomplete');
    if (!String(seo?.title || '').trim() || !String(seo?.description || '').trim()) throw new ProposalAiUnavailableError('seo_incomplete');
    if (/<[^>]+>/.test(JSON.stringify({ analysis, email, seo }))) throw new ProposalAiUnavailableError('html_not_allowed');
  }
  private aiPayload(input: CanonicalProposalInput, snapshot: WebsiteSnapshot | undefined, palette: JsonObject): JsonObject { return { businessName: input.businessName, category: input.category || input.descriptor || '', city: input.city || '', publicUrl: input.websiteUrl || '', title: snapshot?.title || '', metaDescription: snapshot?.description || '', headings: snapshot?.headings || [], publicText: (snapshot?.text || '').slice(0, 12000), publicServices: input.services.slice(0, 12), social: snapshot?.social || {}, observable: { ctas: snapshot?.ctas || [], contactsPresent: Boolean(snapshot?.emails.length || snapshot?.phones.length), navigation: snapshot?.navigation || [] }, palette }; }
  private publicSnapshot(snapshot?: WebsiteSnapshot) { return snapshot ? { sourceUrl: snapshot.sourceUrl, finalUrl: snapshot.finalUrl, title: snapshot.title, description: snapshot.description, headings: snapshot.headings, ctas: snapshot.ctas, social: snapshot.social, logoCandidates: snapshot.logoCandidates.length, imageCandidates: snapshot.imageCandidates.length, textChars: snapshot.text.length } : {}; }
  private userId(value?: string | null) { return value && UUID_RE.test(value) ? value : null; }
  private activity(schema: string, id: string, action: string, actor: ProposalPreparationActor, metadata: JsonObject) { return this.activityWith(this.dataSource, schema, id, action, actor, metadata); }
  private activityWith(db: Pick<DataSource, 'query'> | { query: (...args: any[]) => Promise<any> }, schema: string, id: string, action: string, actor: ProposalPreparationActor, metadata: JsonObject) { return db.query(`INSERT INTO "${schema}".site_proposal_activity (proposal_id,action,metadata,actor_user_id,actor_email) VALUES ($1,$2,$3::jsonb,$4,$5)`, [id, action, JSON.stringify(metadata), this.userId(actor.id), cleanString(actor.email, 320) || null]); }
  private error(value: unknown) { const message = cleanString(value instanceof Error ? value.message : String(value), 300) || 'Preparazione non riuscita.'; return /stack|sql|postgres|s3|redis|token|api.?key/i.test(message) ? 'Preparazione non riuscita.' : message; }
  private report(data: ProposalPreparationJobData, percent: number, stage: any, message: string, provider?: 'gemini'|'local', failed = false) {
    return this.progress?.update(data.tenantSchema, data.preparationRunId, data.proposalId, { percent, stage, message, provider, failed }) || Promise.resolve();
  }
}

function object(value: unknown): value is JsonObject { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
