import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ACTIVITY, SITE_PROPOSAL_PREPARATION_JOB, SITE_PROPOSAL_PREPARATION_QUEUE, SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';
import { ensureDoflowSiteProposalTables } from './tenant-site-proposals-schema';
import { ProposalPreparationActor, ProposalPreparationJobData, ProposalPreparationOptions } from './tenant-site-proposals.types';
import { cleanString, UUID_RE } from './tenant-site-proposals-validation';

@Injectable()
export class TenantSiteProposalsPreparationQueueService {
  constructor(@InjectQueue(SITE_PROPOSAL_PREPARATION_QUEUE) private readonly queue: Queue<ProposalPreparationJobData>, private readonly dataSource: DataSource) {}

  async enqueue(schemaInput: string, proposalId: string, actor: ProposalPreparationActor, raw: Partial<ProposalPreparationOptions> = {}) {
    const schema = safeSchema(schemaInput, 'site proposal preparation enqueue');
    if (schema !== SITE_PROPOSALS_TENANT || !UUID_RE.test(proposalId)) throw new BadRequestException('Richiesta di preparazione non valida');
    const options = this.options(raw);
    await ensureDoflowSiteProposalTables(this.dataSource, schema);
    const proposal = (await this.dataSource.query(`SELECT id,preparation_status,deleted_at,status FROM "${schema}".site_proposals WHERE id=$1`, [proposalId]))[0];
    if (!proposal || proposal.deleted_at || proposal.status === 'archived') throw new NotFoundException('Proposta non trovata');
    if (proposal.preparation_status === 'running' || (proposal.preparation_status === 'queued' && !options.force)) return { queued: true, idempotent: true, status: proposal.preparation_status };
    const minute = Math.floor(Date.now() / 60_000);
    const jobId = `prepare-${proposalId}-${minute}`;
    const data: ProposalPreparationJobData = {
      tenantSchema: schema, proposalId,
      actorUserId: actor.id && UUID_RE.test(actor.id) ? actor.id : null,
      actorEmail: cleanString(actor.email, 320) || null,
      ...options,
    };
    await this.dataSource.query(`UPDATE "${schema}".site_proposals SET preparation_status='queued',preparation_error=NULL,preparation_queued_at=now(),latest_preparation_job_id=$1,updated_at=now() WHERE id=$2`, [jobId, proposalId]);
    try {
      const job = await this.queue.add(SITE_PROPOSAL_PREPARATION_JOB, data, { jobId, attempts: 1, removeOnComplete: { age: 300, count: 1000 }, removeOnFail: { age: 24 * 3600, count: 1000 } });
      await this.dataSource.query(`INSERT INTO "${schema}".site_proposal_activity (proposal_id,action,metadata,actor_user_id,actor_email) VALUES ($1,$2,$3::jsonb,$4,$5)`, [proposalId, ACTIVITY.proposalPreparationQueued, JSON.stringify({ jobId: job.id, reason: options.reason }), data.actorUserId, data.actorEmail]);
      return { queued: true, idempotent: false, status: 'queued', jobId: job.id };
    } catch (error) {
      await this.dataSource.query(`UPDATE "${schema}".site_proposals SET preparation_status='failed',preparation_error='Accodamento non riuscito.',preparation_completed_at=now() WHERE id=$1`, [proposalId]);
      throw new ConflictException('Accodamento preparazione non riuscito');
    }
  }

  private options(raw: Partial<ProposalPreparationOptions>): ProposalPreparationOptions {
    const allowed = new Set(['force','generate','reason','targetTemplateSlug','targetTemplateVersion']);
    if (!raw || typeof raw !== 'object' || Array.isArray(raw) || Object.keys(raw).some((key) => !allowed.has(key))) throw new BadRequestException('Opzioni preparazione non valide');
    const targetTemplateSlug = raw.targetTemplateSlug ? String(raw.targetTemplateSlug) : undefined;
    const targetTemplateVersion = raw.targetTemplateVersion ? String(raw.targetTemplateVersion) : undefined;
    if (targetTemplateSlug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(targetTemplateSlug)) throw new BadRequestException('Tema target non valido');
    if (targetTemplateVersion && !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(targetTemplateVersion)) throw new BadRequestException('Versione target non valida');
    return { force: raw.force === true, generate: raw.generate !== false, reason: cleanString(raw.reason, 80) || 'automatic_preparation', targetTemplateSlug, targetTemplateVersion };
  }
}
