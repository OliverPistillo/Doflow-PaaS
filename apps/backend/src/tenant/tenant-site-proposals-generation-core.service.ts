import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FileStorageService } from '../file-storage.service';
import { safeSchema } from '../common/schema.utils';
import { ACTIVITY, GENERATED_STORAGE_PREFIX, SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';
import { TenantSiteProposalsArtifactService } from './tenant-site-proposals-artifact.service';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';
import { JsonObject, PreparationProgressStage, ProposalPreparationActor } from './tenant-site-proposals.types';
import { cleanString, sha256, UUID_RE, validateSiteConfig } from './tenant-site-proposals-validation';
import { getProposalContentProfileAdapter } from './tenant-site-proposals-content-profile-adapters';
import { assertProposalPersonalizationDelta } from './tenant-site-proposals-personalization-delta';
import { evaluateProposalReadiness } from './tenant-site-proposals-readiness';

type GenerationOptions = {
  preparationRunId?: string;
  onProgress?: (percent: number, stage: PreparationProgressStage, message: string) => Promise<unknown>;
};

@Injectable()
export class TenantSiteProposalsGenerationCoreService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly templates: TenantSiteProposalsTemplateService,
    private readonly artifacts: TenantSiteProposalsArtifactService,
    private readonly storage: FileStorageService,
  ) {}

  async generate(schemaInput: string, actor: ProposalPreparationActor, proposalId: string, options: GenerationOptions = {}) {
    const schema = this.schema(schemaInput); this.uuid(proposalId);
    const runner = this.dataSource.createQueryRunner();
    let proposal: any; let generation: any; let original: unknown;
    try {
      await runner.connect(); await runner.startTransaction();
      await runner.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [schema, `generation:${proposalId}`]);
      proposal = (await runner.query(`SELECT * FROM "${schema}".site_proposals WHERE id=$1 AND deleted_at IS NULL AND status<>'archived' FOR UPDATE`, [proposalId]))[0];
      if (!proposal) throw new NotFoundException('Proposta non trovata');
      const internalPreparation = Boolean(options.preparationRunId && options.preparationRunId === proposal.latest_preparation_job_id);
      if (['queued','running'].includes(String(proposal.preparation_status)) && !internalPreparation) throw this.preparationConflict();
      await this.assertGenerable(schema, proposal);
      const running = (await runner.query(`SELECT id FROM "${schema}".site_proposal_generations WHERE proposal_id=$1 AND status='running' LIMIT 1`, [proposalId]))[0];
      if (running) throw new ConflictException('La proposta ha una generazione in corso.');
      generation = (await runner.query(`INSERT INTO "${schema}".site_proposal_generations (proposal_id,proposal_version,template_slug,template_version,status,created_by,started_at) VALUES ($1,$2,$3,$4,'running',$5,now()) RETURNING *`, [proposalId, proposal.current_version, proposal.template_slug, proposal.template_version, this.userId(actor.id)]))[0];
      await runner.commitTransaction();
    } catch (error) {
      original = error;
      if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined);
      if ((error as { code?: string })?.code === '23505') throw new ConflictException('La proposta ha una generazione in corso.');
      throw error;
    } finally { await runner.release().catch((error) => { if (!original) throw error; }); }
    await this.activity(schema, proposalId, ACTIVITY.generationStarted, actor, { generationId: generation.id });
    try {
      const context = { schema, dataSource: this.dataSource };
      await options.onProgress?.(86, 'html', 'Generazione HTML');
      const rendered = await this.templates.renderHtml(proposal.site_config, context);
      const redirects = await this.templates.buildRedirectFiles(proposal.site_config);
      const configSha256 = sha256(JSON.stringify(proposal.site_config));
      const generatedLogos = this.generatedLogos(proposal.site_config);
      await options.onProgress?.(93, 'zip', 'Creazione ZIP');
      const zip = await this.artifacts.createZip(rendered.html, redirects, generatedLogos);
      const prefix = `${GENERATED_STORAGE_PREFIX}/${proposalId}/${generation.id}/`;
      const htmlKey = `${prefix}index.html`; const zipKey = `${prefix}demo.zip`;
      await options.onProgress?.(97, 'artifacts', 'Salvataggio artefatti');
      await this.storage.uploadGeneratedBuffer(htmlKey, Buffer.from(rendered.html, 'utf8'), 'text/html; charset=utf-8');
      await this.storage.uploadGeneratedBuffer(zipKey, zip.buffer, 'application/zip');
      const completed = (await this.dataSource.query(`UPDATE "${schema}".site_proposal_generations SET status='completed',html_key=$1,zip_key=$2,html_sha256=$3,zip_sha256=$4,html_size=$5,zip_size=$6,completed_at=now() WHERE id=$7 RETURNING *`, [htmlKey, zipKey, rendered.sha256, zip.sha256, rendered.size, zip.size, generation.id]))[0];
      await this.dataSource.query(`UPDATE "${schema}".site_proposals SET status='generated',last_generated_at=now(),updated_at=now() WHERE id=$1`, [proposalId]);
      await this.activity(schema, proposalId, ACTIVITY.generated, actor, { generationId: generation.id, proposalVersion: proposal.current_version, configSha256: configSha256.slice(0, 16), htmlSha256: rendered.sha256.slice(0, 16), logoSourceMethod: generatedLogos.length ? 'generated' : this.logoSource(proposal.site_config) });
      return completed;
    } catch (error) {
      const rawMessage = cleanString(error instanceof Error ? error.message : String(error), 500) || 'Generazione non riuscita.';
      const message = /stack|sql|postgres|s3|redis|token|secret|password|api.?key|cookie|authorization/i.test(rawMessage) ? 'Generazione non riuscita.' : rawMessage;
      await this.dataSource.query(`UPDATE "${schema}".site_proposal_generations SET status='failed',error_message=$1,completed_at=now() WHERE id=$2`, [message, generation.id]);
      await this.activity(schema, proposalId, ACTIVITY.generationFailed, actor, { generationId: generation.id, message });
      return { ...generation, status: 'failed', error_message: message };
    }
  }

  private schema(value: string) { const schema = safeSchema(value, 'site proposal generation core'); if (schema !== SITE_PROPOSALS_TENANT) throw new BadRequestException('Schema tenant non consentito'); return schema; }
  private uuid(value: string) { if (!UUID_RE.test(value)) throw new BadRequestException('UUID proposta non valido'); }
  private userId(value?: string | null) { return value && UUID_RE.test(value) ? value : null; }
  private generatedLogos(config: any) {
    const images = config?.images || {}; const brand = config?.brand || {};
    const generated = (slot: 'logoDefault'|'logoLight') => images?.[slot]?.sourceMethod === 'generated' || brand.logoSourceMethod === 'generated';
    const source = (slot: 'logoDefault'|'logoLight') => images?.[slot]?.src || brand?.[slot] || '';
    const names = { logoDefault: 'assets/generated/logo-default.svg', logoLight: 'assets/generated/logo-light.svg' } as const;
    const values: { path: string; bytes: Buffer }[] = [];
    for (const slot of ['logoDefault','logoLight'] as const) {
      if (!generated(slot)) continue;
      const match = /^data:image\/svg\+xml;base64,([a-z0-9+/=]+)$/i.exec(String(source(slot)));
      if (!match) continue;
      const bytes = Buffer.from(match[1], 'base64');
      if (!/^<svg\b/i.test(bytes.toString('utf8'))) continue;
      values.push({ path: names[slot], bytes });
    }
    return values;
  }
  private logoSource(config: any) { return String(config?.images?.logoDefault?.sourceMethod || config?.brand?.logoSourceMethod || 'text-fallback'); }
  private async assertGenerable(schema: string, proposal: any) {
    if (typeof (this.templates as unknown as { getRegistration?: unknown }).getRegistration !== 'function') return;
    try {
      const registration = await this.templates.getRegistration(String(proposal.template_slug), String(proposal.template_version), { schema, dataSource: this.dataSource }, false, false);
      if (!registration.isActive || registration.runtimeAdapterStatus !== 'ready') throw this.preparationConflict();
      const config = proposal.site_config as JsonObject;
      validateSiteConfig(config, registration);
      const base = await this.templates.getDefaultConfig(registration.slug, registration.version, { schema, dataSource: this.dataSource });
      assertProposalPersonalizationDelta(base, config, getProposalContentProfileAdapter(registration.contentProfile));
      const readiness = evaluateProposalReadiness({ emailSubject: proposal.email_subject, emailBody: proposal.email_body, commercialAnalysis: proposal.commercial_analysis, siteConfigValid: true, adapterReady: true, themeActive: true });
      if (!readiness.complete) throw this.preparationConflict();
      const brand = object(config.brand) ? config.brand : {};
      const images = object(config.images) ? config.images : {};
      const logo = object(images.logoDefault) ? images.logoDefault as JsonObject : {};
      const businessName = cleanString(brand.name || (object(config.business) ? config.business.name : ''), 160);
      const sourceMethod = String(logo.sourceMethod || brand.logoSourceMethod || brand.logoMethod || '');
      const src = String(logo.src || brand.logoDefault || '');
      const useThemeLogo = brand.useThemeLogo === true;
      if (businessName && (!this.validLogo(src) || (!useThemeLogo && ['theme-package','stock_local','text-fallback',''].includes(sourceMethod)))) throw this.preparationConflict();
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw this.preparationConflict();
    }
  }
  private validLogo(value: string) { return /^(?:https:\/\/[^\s]+|data:image\/(?:svg\+xml|png|jpe?g|webp);base64,[a-z0-9+/=]+)$/i.test(value); }
  private preparationConflict() { return new ConflictException('La proposta deve completare la preparazione prima della generazione.'); }
  private activity(schema: string, proposalId: string, action: string, actor: ProposalPreparationActor, metadata: object) {
    return this.dataSource.query(`INSERT INTO "${schema}".site_proposal_activity (proposal_id,action,metadata,actor_user_id,actor_email) VALUES ($1,$2,$3::jsonb,$4,$5)`, [proposalId, action, JSON.stringify(metadata), this.userId(actor.id), cleanString(actor.email, 320) || null]);
  }
}

function object(value: unknown): value is JsonObject { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
