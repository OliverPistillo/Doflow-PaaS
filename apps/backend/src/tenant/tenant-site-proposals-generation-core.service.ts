import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { FileStorageService } from '../file-storage.service';
import { safeSchema } from '../common/schema.utils';
import { ACTIVITY, GENERATED_STORAGE_PREFIX, SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';
import { TenantSiteProposalsArtifactService } from './tenant-site-proposals-artifact.service';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';
import { ProposalPreparationActor } from './tenant-site-proposals.types';
import { cleanString, UUID_RE } from './tenant-site-proposals-validation';

@Injectable()
export class TenantSiteProposalsGenerationCoreService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly templates: TenantSiteProposalsTemplateService,
    private readonly artifacts: TenantSiteProposalsArtifactService,
    private readonly storage: FileStorageService,
  ) {}

  async generate(schemaInput: string, actor: ProposalPreparationActor, proposalId: string) {
    const schema = this.schema(schemaInput); this.uuid(proposalId);
    const runner = this.dataSource.createQueryRunner();
    let proposal: any; let generation: any; let original: unknown;
    try {
      await runner.connect(); await runner.startTransaction();
      await runner.query('SELECT pg_advisory_xact_lock(hashtext($1),hashtext($2))', [schema, `generation:${proposalId}`]);
      proposal = (await runner.query(`SELECT * FROM "${schema}".site_proposals WHERE id=$1 AND deleted_at IS NULL AND status<>'archived' FOR UPDATE`, [proposalId]))[0];
      if (!proposal) throw new NotFoundException('Proposta non trovata');
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
      const rendered = await this.templates.renderHtml(proposal.site_config, context);
      const redirects = await this.templates.buildRedirectFiles(proposal.site_config);
      const zip = await this.artifacts.createZip(rendered.html, redirects);
      const prefix = `${GENERATED_STORAGE_PREFIX}/${proposalId}/${generation.id}/`;
      const htmlKey = `${prefix}index.html`; const zipKey = `${prefix}demo.zip`;
      await this.storage.uploadGeneratedBuffer(htmlKey, Buffer.from(rendered.html, 'utf8'), 'text/html; charset=utf-8');
      await this.storage.uploadGeneratedBuffer(zipKey, zip.buffer, 'application/zip');
      const completed = (await this.dataSource.query(`UPDATE "${schema}".site_proposal_generations SET status='completed',html_key=$1,zip_key=$2,html_sha256=$3,zip_sha256=$4,html_size=$5,zip_size=$6,completed_at=now() WHERE id=$7 RETURNING *`, [htmlKey, zipKey, rendered.sha256, zip.sha256, rendered.size, zip.size, generation.id]))[0];
      await this.dataSource.query(`UPDATE "${schema}".site_proposals SET status='generated',last_generated_at=now(),updated_at=now() WHERE id=$1`, [proposalId]);
      await this.activity(schema, proposalId, ACTIVITY.generated, actor, { generationId: generation.id });
      return completed;
    } catch (error) {
      const message = cleanString(error instanceof Error ? error.message : String(error), 500) || 'Generazione non riuscita.';
      await this.dataSource.query(`UPDATE "${schema}".site_proposal_generations SET status='failed',error_message=$1,completed_at=now() WHERE id=$2`, [message, generation.id]);
      await this.activity(schema, proposalId, ACTIVITY.generationFailed, actor, { generationId: generation.id, message });
      return { ...generation, status: 'failed', error_message: message };
    }
  }

  private schema(value: string) { const schema = safeSchema(value, 'site proposal generation core'); if (schema !== SITE_PROPOSALS_TENANT) throw new BadRequestException('Schema tenant non consentito'); return schema; }
  private uuid(value: string) { if (!UUID_RE.test(value)) throw new BadRequestException('UUID proposta non valido'); }
  private userId(value?: string | null) { return value && UUID_RE.test(value) ? value : null; }
  private activity(schema: string, proposalId: string, action: string, actor: ProposalPreparationActor, metadata: object) {
    return this.dataSource.query(`INSERT INTO "${schema}".site_proposal_activity (proposal_id,action,metadata,actor_user_id,actor_email) VALUES ($1,$2,$3::jsonb,$4,$5)`, [proposalId, action, JSON.stringify(metadata), this.userId(actor.id), cleanString(actor.email, 320) || null]);
  }
}
