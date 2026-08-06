import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleInit, Optional } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Interval } from '@nestjs/schedule';
import { Queue } from 'bullmq';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ACTIVITY, SITE_PROPOSAL_PREPARATION_JOB, SITE_PROPOSAL_PREPARATION_QUEUE, SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';
import { ensureDoflowSiteProposalTables } from './tenant-site-proposals-schema';
import { ProposalPreparationActor, ProposalPreparationJobData, ProposalPreparationOptions } from './tenant-site-proposals.types';
import { cleanString, UUID_RE } from './tenant-site-proposals-validation';
import { TenantSiteProposalsPreparationProgressService } from './tenant-site-proposals-preparation-progress.service';

@Injectable()
export class TenantSiteProposalsPreparationQueueService implements OnModuleInit {
  private readonly logger = new Logger(TenantSiteProposalsPreparationQueueService.name);
  private recovering = false;

  constructor(
    @InjectQueue(SITE_PROPOSAL_PREPARATION_QUEUE) private readonly queue: Queue<ProposalPreparationJobData>,
    private readonly dataSource: DataSource,
    @Optional() private readonly progress?: TenantSiteProposalsPreparationProgressService,
  ) {}

  onModuleInit() { void this.recoverPendingDispatches().catch((error) => this.logger.warn(`Preparation dispatch recovery deferred: ${this.error(error)}`)); }

  @Interval(30_000)
  scheduledRecovery() { void this.recoverPendingDispatches().catch((error) => this.logger.warn(`Preparation dispatch recovery deferred: ${this.error(error)}`)); }

  async enqueue(schemaInput: string, proposalId: string, actor: ProposalPreparationActor, raw: Partial<ProposalPreparationOptions> = {}) {
    const schema = this.schema(schemaInput); this.proposalId(proposalId);
    const options = this.options(raw);
    await ensureDoflowSiteProposalTables(this.dataSource, schema);
    const runner = this.dataSource.createQueryRunner();
    let original: unknown;
    let data: ProposalPreparationJobData | undefined;
    try {
      await runner.connect(); await runner.startTransaction();
      const proposal = (await runner.query(`SELECT id,preparation_status,deleted_at,status FROM "${schema}".site_proposals WHERE id=$1 FOR UPDATE`, [proposalId]))[0];
      if (!proposal || proposal.deleted_at || proposal.status === 'archived') throw new NotFoundException('Proposta non trovata');
      const active = (await runner.query(`SELECT job_id,status FROM "${schema}".site_proposal_preparation_runs WHERE proposal_id=$1 AND status IN ('pending','dispatched','running') ORDER BY created_at DESC LIMIT 1`, [proposalId]))[0];
      if (active) {
        await runner.commitTransaction();
        return { queued: true, idempotent: true, status: proposal.preparation_status, jobId: active.job_id, pendingDispatch: active.status === 'pending' };
      }
      const runId = randomUUID();
      data = {
        preparationRunId: runId, tenantSchema: schema, proposalId,
        actorUserId: actor.id && UUID_RE.test(actor.id) ? actor.id : null,
        actorEmail: cleanString(actor.email, 320) || null,
        ...options,
      };
      await runner.query(`
        INSERT INTO "${schema}".site_proposal_preparation_runs
          (id,proposal_id,job_id,status,force,reason,created_by,actor_email,job_data,progress_percent,progress_stage,progress_message)
        VALUES ($1,$2,$1,'pending',$3,$4,$5,$6,$7::jsonb,0,'waiting','In attesa')
      `, [runId, proposalId, options.force, options.reason, data.actorUserId, data.actorEmail, JSON.stringify(data)]);
      await runner.query(`UPDATE "${schema}".site_proposals SET preparation_status='queued',preparation_error=NULL,preparation_queued_at=now(),latest_preparation_job_id=$1,progress_percent=0,progress_stage='waiting',progress_message='In attesa',progress_updated_at=now(),preparation_heartbeat_at=now(),updated_at=now() WHERE id=$2`, [runId, proposalId]);
      await runner.query(`INSERT INTO "${schema}".site_proposal_activity (proposal_id,action,metadata,actor_user_id,actor_email) VALUES ($1,$2,$3::jsonb,$4,$5)`, [proposalId, ACTIVITY.proposalPreparationQueued, JSON.stringify({ jobId: runId, reason: options.reason, dispatch: 'pending' }), data.actorUserId, data.actorEmail]);
      await runner.commitTransaction();
    } catch (error) {
      original = error;
      if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally { await runner.release().catch((error) => { if (!original) throw error; }); }
    const dispatched = await this.dispatch(data!);
    await this.progress?.update(schema, data!.preparationRunId, proposalId, { percent: 5, stage: 'queueing', message: dispatched ? 'Accodamento completato' : 'Accodamento in recupero' }).catch(() => undefined);
    return { queued: true, idempotent: false, status: 'queued', jobId: data!.preparationRunId, pendingDispatch: !dispatched };
  }

  async recoverPendingDispatches(): Promise<number> {
    if (this.recovering) return 0;
    this.recovering = true;
    try {
      await ensureDoflowSiteProposalTables(this.dataSource, SITE_PROPOSALS_TENANT);
      const rows = await this.dataSource.query(`
        SELECT job_data FROM "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs
        WHERE status='pending' AND attempts < 8
          AND updated_at <= now() - make_interval(secs => LEAST(300, 5 * power(2, attempts)::int))
        ORDER BY created_at ASC LIMIT 25
      `);
      for (const row of rows) await this.dispatch(row.job_data as ProposalPreparationJobData);
      const stale = await this.dataSource.query(`
        SELECT id FROM "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs
        WHERE status='running' AND heartbeat_at < now() - interval '5 minutes'
        ORDER BY heartbeat_at ASC LIMIT 25
      `);
      for (const row of stale) {
        const job = typeof this.queue.getJob === 'function' ? await this.queue.getJob(row.id) : undefined;
        const state = job && typeof job.getState === 'function' ? await job.getState().catch(() => 'unknown') : 'missing';
        if (['active','waiting','delayed'].includes(state)) continue;
        if (job && typeof job.remove === 'function') await job.remove().catch(() => undefined);
        await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='pending',last_error='Run interrotto: ridispatch sicuro',heartbeat_at=now(),updated_at=now() WHERE id=$1 AND status='running'`, [row.id]);
      }
      return rows.length;
    } finally { this.recovering = false; }
  }

  async markRunning(data: ProposalPreparationJobData) {
    this.jobData(data);
    await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='running',started_at=COALESCE(started_at,now()),heartbeat_at=now(),updated_at=now() WHERE id=$1 AND status IN ('dispatched','running')`, [data.preparationRunId]);
    await this.progress?.update(SITE_PROPOSALS_TENANT, data.preparationRunId, data.proposalId, { percent: 10, stage: 'loading-data', message: 'Caricamento dati attività' });
  }

  async markCompleted(data: ProposalPreparationJobData) {
    this.jobData(data);
    await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='completed',completed_at=now(),last_error=NULL,updated_at=now() WHERE id=$1`, [data.preparationRunId]);
  }

  async markFailed(data: ProposalPreparationJobData, error: unknown) {
    this.jobData(data);
    await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='failed',completed_at=now(),last_error=$2,updated_at=now() WHERE id=$1`, [data.preparationRunId, this.error(error)]);
    await this.progress?.update(SITE_PROPOSALS_TENANT, data.preparationRunId, data.proposalId, { percent: 0, stage: 'failed', message: this.error(error), failed: true }).catch(() => undefined);
  }

  private async dispatch(data: ProposalPreparationJobData): Promise<boolean> {
    this.jobData(data);
    try {
      const existing = typeof this.queue.getJob === 'function' ? await this.queue.getJob(data.preparationRunId) : undefined;
      if (!existing) await this.queue.add(SITE_PROPOSAL_PREPARATION_JOB, data, {
        jobId: data.preparationRunId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 300, count: 1000 }, removeOnFail: { age: 24 * 3600, count: 1000 },
      });
      await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='dispatched',attempts=attempts+1,dispatched_at=COALESCE(dispatched_at,now()),last_error=NULL,updated_at=now() WHERE id=$1 AND status='pending'`, [data.preparationRunId]);
      return true;
    } catch (error) {
      await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET attempts=attempts+1,last_error=$2,updated_at=now() WHERE id=$1 AND status='pending'`, [data.preparationRunId, this.error(error)]).catch(() => undefined);
      return false;
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
  private schema(value: string) { const schema = safeSchema(value, 'site proposal preparation enqueue'); if (schema !== SITE_PROPOSALS_TENANT) throw new BadRequestException('Richiesta di preparazione non valida'); return schema; }
  private proposalId(value: string) { if (!UUID_RE.test(value)) throw new BadRequestException('Richiesta di preparazione non valida'); }
  private jobData(data: ProposalPreparationJobData) { if (!data || data.tenantSchema !== SITE_PROPOSALS_TENANT || !UUID_RE.test(data.proposalId) || !UUID_RE.test(data.preparationRunId)) throw new BadRequestException('Job preparazione non valido'); }
  private error(error: unknown) { const message = cleanString(error instanceof Error ? error.message : String(error), 500) || 'Errore temporaneo di dispatch'; return /stack|sql|postgres|redis|token|secret|password|api.?key|cookie|authorization/i.test(message) ? 'Errore temporaneo di dispatch' : message; }
}
