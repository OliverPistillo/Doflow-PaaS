import { BadRequestException, Injectable, Logger, NotFoundException, OnApplicationBootstrap, Optional } from '@nestjs/common';
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

const QUEUE_READY_TIMEOUT_MS = 10_000;
const RUNNING_STALE_MS = 5 * 60_000;
const FAILED_PROGRESS_RECOVERY_REASON = 'recovery_failed_progress_finalization';
export const PREPARATION_STALLED_MS = 2 * 60_000;

type RecoverableRun = {
  id: string;
  proposal_id: string;
  job_id: string;
  status: 'pending' | 'dispatched' | 'running' | 'completed' | 'failed';
  attempts: number;
  heartbeat_at?: string | Date | null;
  job_data: ProposalPreparationJobData;
};

export type PreparationQueueDiagnostics = {
  queueState: string | null;
  workerReady: boolean;
  stalled: boolean;
  stalledReason: string | null;
  canRetryDispatch: boolean;
  lastHeartbeatAt: string | Date | null;
};

@Injectable()
export class TenantSiteProposalsPreparationQueueService implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenantSiteProposalsPreparationQueueService.name);
  private recovering = false;
  private queueReady = false;
  private queuePaused = false;
  private workerReady = false;

  constructor(
    @InjectQueue(SITE_PROPOSAL_PREPARATION_QUEUE) private readonly queue: Queue<ProposalPreparationJobData>,
    private readonly dataSource: DataSource,
    @Optional() private readonly progress?: TenantSiteProposalsPreparationProgressService,
  ) {}

  async onApplicationBootstrap() {
    try {
      await this.bootstrapQueue();
      await this.recoverPreparationRuns();
    } catch (error) {
      this.queueReady = false;
      this.logger.error(`Preparation queue bootstrap unavailable: ${this.error(error)}`);
    }
  }

  async bootstrapQueue() {
    await this.readyWithTimeout();
    const pausedBefore = await this.queue.isPaused();
    if (pausedBefore) await this.queue.resume();
    const pausedAfter = await this.queue.isPaused();
    const counts = await this.queue.getJobCounts('waiting', 'active', 'delayed', 'failed');
    this.queueReady = true;
    this.queuePaused = pausedAfter;
    this.logger.log(`Preparation queue ready pausedBefore=${pausedBefore} pausedAfter=${pausedAfter} waiting=${counts.waiting || 0} active=${counts.active || 0} delayed=${counts.delayed || 0} failed=${counts.failed || 0}`);
    return { pausedBefore, pausedAfter, counts };
  }

  setWorkerReady(ready: boolean) { this.workerReady = ready; }

  @Interval(30_000)
  scheduledRecovery() { void this.recoverPreparationRuns().catch((error) => this.logger.warn(`Preparation dispatch recovery deferred: ${this.error(error)}`)); }

  async enqueue(schemaInput: string, proposalId: string, actor: ProposalPreparationActor, raw: Partial<ProposalPreparationOptions> = {}) {
    const schema = this.schema(schemaInput); this.proposalId(proposalId);
    const options = this.options(raw);
    await ensureDoflowSiteProposalTables(this.dataSource, schema);
    const runner = this.dataSource.createQueryRunner();
    let original: unknown;
    let data: ProposalPreparationJobData | undefined;
    let activeRunId: string | undefined;
    let activeStatus: string | undefined;
    try {
      await runner.connect(); await runner.startTransaction();
      const proposal = (await runner.query(`SELECT id,preparation_status,deleted_at,status FROM "${schema}".site_proposals WHERE id=$1::uuid FOR UPDATE`, [proposalId]))[0];
      if (!proposal || proposal.deleted_at || proposal.status === 'archived') throw new NotFoundException('Proposta non trovata');
      const active = (await runner.query(`SELECT id,job_id,status FROM "${schema}".site_proposal_preparation_runs WHERE proposal_id=$1::uuid AND status IN ('pending','dispatched','running') ORDER BY created_at DESC LIMIT 1`, [proposalId]))[0];
      if (active) {
        activeRunId = String(active.id || active.job_id);
        activeStatus = String(active.status);
        await runner.commitTransaction();
      } else {
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
          VALUES ($1::uuid,$2::uuid,$3::text,'pending'::text,$4::boolean,$5::text,$6::uuid,$7::text,$8::jsonb,0,'waiting'::text,'In attesa'::text)
        `, [runId, proposalId, runId, options.force, options.reason, data.actorUserId, data.actorEmail, JSON.stringify(data)]);
        await runner.query(`UPDATE "${schema}".site_proposals SET preparation_status='queued',preparation_error=NULL,preparation_queued_at=now(),latest_preparation_job_id=$1::text,progress_percent=0,progress_stage='waiting',progress_message='In attesa',progress_updated_at=now(),preparation_heartbeat_at=now(),updated_at=now() WHERE id=$2::uuid`, [runId, proposalId]);
        await runner.query(`INSERT INTO "${schema}".site_proposal_activity (proposal_id,action,metadata,actor_user_id,actor_email) VALUES ($1::uuid,$2::text,$3::jsonb,$4::uuid,$5::text)`, [proposalId, ACTIVITY.proposalPreparationQueued, JSON.stringify({ jobId: runId, reason: options.reason, dispatch: 'pending' }), data.actorUserId, data.actorEmail]);
        await runner.commitTransaction();
      }
    } catch (error) {
      original = error;
      if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally { await runner.release().catch((error) => { if (!original) throw error; }); }

    if (activeRunId) {
      const recovered = await this.reconcileRun(activeRunId);
      return { queued: true, idempotent: true, recovered: recovered.recovered, status: activeStatus, jobId: activeRunId, pendingDispatch: recovered.queueState === 'missing' || recovered.queueState === 'unavailable' };
    }
    const dispatched = await this.dispatch(data!);
    return { queued: true, idempotent: false, status: 'queued', jobId: data!.preparationRunId, pendingDispatch: !dispatched };
  }

  async recoverPendingDispatches() { return this.recoverPreparationRuns(); }

  async recoverPreparationRuns(): Promise<number> {
    if (this.recovering) return 0;
    this.recovering = true;
    try {
      await ensureDoflowSiteProposalTables(this.dataSource, SITE_PROPOSALS_TENANT);
      await this.ensureQueueOperational();
      let recovered = await this.recoverOrphanedFailedProposals();
      const rows = await this.dataSource.query(`
        SELECT id FROM "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs
        WHERE (
          status='pending'
          OR (status='dispatched' AND updated_at < now() - interval '30 seconds')
          OR (status='running' AND heartbeat_at < now() - interval '5 minutes')
        )
        ORDER BY created_at ASC LIMIT 50
      `);
      for (const row of rows) {
        const result = await this.reconcileRun(String(row.id));
        if (result.recovered) recovered += 1;
      }
      return recovered;
    } finally { this.recovering = false; }
  }

  async recoverOrphanedFailedProposals(): Promise<number> {
    const rows = await this.dataSource.query(`
      SELECT p.id AS proposal_id,p.latest_preparation_job_id AS run_id
      FROM "${SITE_PROPOSALS_TENANT}".site_proposals p
      JOIN "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs r
        ON r.id::text=p.latest_preparation_job_id
      WHERE p.preparation_status IN ('queued','running') AND r.status='failed'
      ORDER BY r.updated_at ASC
      LIMIT 50
    `);
    let recovered = 0;
    for (const row of rows) {
      if (await this.recoverOrphanedFailedProposal(String(row.proposal_id), String(row.run_id))) recovered += 1;
    }
    return recovered;
  }

  private async recoverOrphanedFailedProposal(proposalId: string, runId: string): Promise<boolean> {
    if (!UUID_RE.test(proposalId) || !UUID_RE.test(runId)) return false;
    const runner = this.dataSource.createQueryRunner();
    let recovery: { actor: ProposalPreparationActor; options: Partial<ProposalPreparationOptions> } | undefined;
    let original: unknown;
    try {
      await runner.connect();
      await runner.startTransaction();
      const orphan = (await runner.query(`
        SELECT p.id AS proposal_id,p.preparation_status,p.progress_percent AS proposal_progress_percent,
          p.progress_stage AS proposal_progress_stage,r.id AS run_id,r.job_id,r.reason,r.job_data,
          r.attempts,r.last_error,r.progress_percent AS run_progress_percent
        FROM "${SITE_PROPOSALS_TENANT}".site_proposals p
        JOIN "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs r
          ON r.id=$2::uuid AND r.proposal_id=p.id
        WHERE p.id=$1::uuid AND p.latest_preparation_job_id=r.id::text
          AND p.preparation_status IN ('queued','running') AND r.status='failed'
        FOR UPDATE OF p,r
      `, [proposalId, runId]))[0];
      if (!orphan) {
        await runner.commitTransaction();
        return false;
      }
      const oldJob = await this.queue.getJob(String(orphan.job_id));
      const jobState = oldJob ? await oldJob.getState().catch(() => 'unknown') : 'missing';
      const jobData = this.recoveryJobData(orphan.job_data, oldJob?.data);
      const attempts = Math.max(Number(orphan.attempts || 0), Number(oldJob?.attemptsMade || 0));
      this.logger.warn(`Orphaned failed proposal detected oldRun=${runId} proposal=${proposalId} jobState=${jobState} attempts=${attempts}`);

      const failure = this.error(orphan.last_error || oldJob?.failedReason || 'Preparazione non riuscita');
      const percent = Math.max(0, Math.min(100, Number(orphan.run_progress_percent || 0)));
      await runner.query(`
        UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs
        SET status='failed',completed_at=COALESCE(completed_at,now()),last_error=$3::text,
          progress_percent=COALESCE(progress_percent,0::smallint),progress_stage='failed',
          progress_message=$3::text,progress_updated_at=now(),heartbeat_at=now(),updated_at=now()
        WHERE id=$1::uuid AND proposal_id=$2::uuid
      `, [runId, proposalId, failure]);
      await runner.query(`
        UPDATE "${SITE_PROPOSALS_TENANT}".site_proposals
        SET preparation_status='failed',preparation_error=$3::text,preparation_completed_at=now(),
          progress_percent=COALESCE($4::smallint,0::smallint),progress_stage='failed',progress_message=$3::text,
          progress_updated_at=now(),preparation_heartbeat_at=now(),updated_at=now()
        WHERE id=$2::uuid AND latest_preparation_job_id=$1::text
      `, [runId, proposalId, failure, percent]);

      const alreadyAttempted = orphan.reason === FAILED_PROGRESS_RECOVERY_REASON || jobData?.reason === FAILED_PROGRESS_RECOVERY_REASON;
      const progressFinalizationFailure = orphan.proposal_progress_percent == null
        || Number(orphan.proposal_progress_percent) === 0
        || orphan.proposal_progress_stage === 'waiting';
      if (alreadyAttempted) {
        this.logger.warn(`Recovery skipped because already attempted oldRun=${runId} proposal=${proposalId}`);
      } else if (progressFinalizationFailure) {
        recovery = {
          actor: { id: jobData?.actorUserId || null, email: jobData?.actorEmail || null },
          options: {
            force: false,
            generate: true,
            reason: FAILED_PROGRESS_RECOVERY_REASON,
            targetTemplateSlug: jobData?.targetTemplateSlug,
            targetTemplateVersion: jobData?.targetTemplateVersion,
          },
        };
      }
      await runner.commitTransaction();
      this.logger.log(`Failure state reconciled oldRun=${runId} proposal=${proposalId}`);
    } catch (error) {
      original = error;
      if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally {
      await runner.release().catch((error) => { if (!original) throw error; });
    }

    if (!recovery) return false;
    const queued = await this.enqueue(SITE_PROPOSALS_TENANT, proposalId, recovery.actor, recovery.options);
    this.logger.log(`Automatic recovery queued oldRun=${runId} proposal=${proposalId} newRun=${queued.jobId}`);
    return true;
  }

  async reconcileRun(runId: string): Promise<{ recovered: boolean; queueState: string }> {
    if (!UUID_RE.test(runId)) throw new BadRequestException('Run preparazione non valido');
    let resumedBefore = false;
    try { resumedBefore = await this.ensureQueueOperational(); }
    catch (error) {
      this.logger.warn(`Preparation queue unavailable run=${runId}: ${this.error(error)}`);
      return { recovered: false, queueState: 'unavailable' };
    }

    const runner = this.dataSource.createQueryRunner();
    let data: ProposalPreparationJobData | undefined;
    let dispatchAfterCommit = false;
    let failedAfterCommit: unknown;
    let state = 'missing';
    let recovered = resumedBefore;
    try {
      await runner.connect(); await runner.startTransaction();
      const run = (await runner.query(`SELECT id,proposal_id,job_id,status,attempts,heartbeat_at,job_data FROM "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs WHERE id=$1::uuid AND status IN ('pending','dispatched','running') FOR UPDATE SKIP LOCKED`, [runId]))[0] as RecoverableRun | undefined;
      if (!run) { await runner.commitTransaction(); return { recovered: false, queueState: 'terminal' }; }
      data = run.job_data;
      this.jobData(data);
      const job = await this.queue.getJob(run.job_id);
      state = job ? await job.getState().catch(() => 'unknown') : 'missing';

      if (run.status === 'running' && this.recent(run.heartbeat_at, RUNNING_STALE_MS)) {
        await runner.commitTransaction();
        return { recovered: false, queueState: state };
      }

      if (state === 'active') {
        await runner.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='running',started_at=COALESCE(started_at,now()),last_error=NULL,updated_at=now() WHERE id=$1::uuid`, [run.id]);
        await runner.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposals SET preparation_status='running',preparation_started_at=COALESCE(preparation_started_at,now()),updated_at=now() WHERE id=$1::uuid AND latest_preparation_job_id=$2::text`, [run.proposal_id, run.job_id]);
      } else if (state === 'waiting' || state === 'delayed' || state === 'waiting-children') {
        const resumed = await this.resumeIfPaused();
        await runner.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='dispatched',heartbeat_at=now(),last_error=$2::text,updated_at=now() WHERE id=$1::uuid`, [run.id, resumed ? 'Coda riattivata; job in attesa del worker' : 'Job in attesa del worker']);
        recovered = recovered || resumed;
      } else if (state === 'failed' && job) {
        const attemptsAllowed = Number(job.opts.attempts || 1);
        if (job.attemptsMade < attemptsAllowed) {
          await job.retry('failed');
          await runner.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='dispatched',last_error=NULL,heartbeat_at=now(),updated_at=now() WHERE id=$1::uuid`, [run.id]);
          state = 'waiting'; recovered = true;
        } else {
          const message = this.error(job.failedReason || 'Preparazione non riuscita dopo i tentativi previsti.');
          failedAfterCommit = new Error(message); recovered = true;
        }
      } else if (state === 'completed' && job) {
        const proposal = (await runner.query(`SELECT preparation_status,current_version FROM "${SITE_PROPOSALS_TENANT}".site_proposals WHERE id=$1::uuid`, [run.proposal_id]))[0];
        const generation = (await runner.query(`SELECT id FROM "${SITE_PROPOSALS_TENANT}".site_proposal_generations WHERE proposal_id=$1::uuid AND proposal_version=$2 AND status='completed' LIMIT 1`, [run.proposal_id, proposal?.current_version]))[0];
        if (proposal && ['ready','fallback'].includes(String(proposal.preparation_status)) && generation) {
          await runner.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='completed',completed_at=COALESCE(completed_at,now()),last_error=NULL,updated_at=now() WHERE id=$1::uuid`, [run.id]);
          recovered = true;
        } else {
          await job.remove();
          await runner.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='pending',last_error='Risultato job non riconciliato: ridispatch sicuro',heartbeat_at=now(),updated_at=now() WHERE id=$1::uuid`, [run.id]);
          dispatchAfterCommit = true; recovered = true;
        }
      } else {
        if (job && typeof job.remove === 'function') await job.remove().catch(() => undefined);
        await runner.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='pending',last_error='Job assente: ridispatch sicuro',heartbeat_at=now(),updated_at=now() WHERE id=$1::uuid`, [run.id]);
        dispatchAfterCommit = true; recovered = true;
      }
      await runner.commitTransaction();
    } catch (error) {
      if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined);
      throw error;
    } finally { await runner.release(); }

    if (failedAfterCommit && data) await this.markFailed(data, failedAfterCommit);
    if (dispatchAfterCommit && data) {
      const dispatched = await this.dispatch(data);
      return { recovered: dispatched, queueState: dispatched ? 'waiting' : 'unavailable' };
    }
    return { recovered, queueState: state };
  }

  async getDiagnostics(runId: unknown, status: unknown, heartbeat: unknown, progressUpdatedAt?: unknown): Promise<PreparationQueueDiagnostics> {
    const lastHeartbeatAt = (heartbeat as string | Date | null) || null;
    const terminal = !['queued','running'].includes(String(status));
    if (!runId || !UUID_RE.test(String(runId)) || terminal) return { queueState: null, workerReady: this.workerReady, stalled: false, stalledReason: null, canRetryDispatch: false, lastHeartbeatAt };
    let queueState = 'unavailable';
    let paused = this.queuePaused;
    try {
      const job = await this.queue.getJob(String(runId));
      queueState = job ? await job.getState().catch(() => 'unknown') : 'missing';
      paused = await this.queue.isPaused();
    } catch { /* diagnostics stay sanitized */ }
    const timestamp = progressUpdatedAt || heartbeat;
    const stale = !timestamp || !this.recent(timestamp, PREPARATION_STALLED_MS);
    const stalled = stale && queueState !== 'active';
    let stalledReason: string | null = null;
    if (stalled) {
      if (paused) stalledReason = 'La coda di preparazione è in pausa.';
      else if (queueState === 'missing') stalledReason = 'Il job di accodamento non è presente.';
      else if (queueState === 'failed') stalledReason = 'Il job di accodamento non è stato completato.';
      else if (!this.workerReady) stalledReason = 'Il worker di preparazione non è pronto.';
      else if (['waiting','delayed','waiting-children'].includes(queueState)) stalledReason = 'Il job è in attesa di acquisizione.';
      else stalledReason = 'Il sottosistema di accodamento non è disponibile.';
    }
    return { queueState, workerReady: this.workerReady, stalled, stalledReason, canRetryDispatch: stalled || queueState === 'missing' || queueState === 'failed', lastHeartbeatAt };
  }

  async markRunning(data: ProposalPreparationJobData) {
    this.jobData(data);
    await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='running',started_at=COALESCE(started_at,now()),heartbeat_at=now(),updated_at=now() WHERE id=$1::uuid AND status IN ('dispatched','running')`, [data.preparationRunId]);
    await this.progress?.update(SITE_PROPOSALS_TENANT, data.preparationRunId, data.proposalId, { percent: 10, stage: 'loading-data', message: 'Caricamento dati attività' });
  }

  async markCompleted(data: ProposalPreparationJobData) {
    this.jobData(data);
    await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='completed',completed_at=now(),last_error=NULL,updated_at=now() WHERE id=$1::uuid`, [data.preparationRunId]);
  }

  async markFailed(data: ProposalPreparationJobData, error: unknown) {
    this.jobData(data);
    if (!this.progress) throw new Error('Servizio progresso preparazione non disponibile');
    await this.progress.failRun(SITE_PROPOSALS_TENANT, data.preparationRunId, data.proposalId, this.error(error));
  }

  private async dispatch(data: ProposalPreparationJobData): Promise<boolean> {
    this.jobData(data);
    try {
      await this.ensureQueueOperational();
      const existing = await this.queue.getJob(data.preparationRunId);
      if (!existing) await this.queue.add(SITE_PROPOSAL_PREPARATION_JOB, data, {
        jobId: data.preparationRunId,
        attempts: 3,
        backoff: { type: 'exponential', delay: 5_000 },
        removeOnComplete: { age: 300, count: 1000 }, removeOnFail: { age: 24 * 3600, count: 1000 },
      });
      await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET status='dispatched',attempts=attempts+1,dispatched_at=COALESCE(dispatched_at,now()),last_error=NULL,updated_at=now() WHERE id=$1::uuid AND status='pending'`, [data.preparationRunId]);
      await this.updateInitialProgress(data);
      return true;
    } catch (error) {
      await this.dataSource.query(`UPDATE "${SITE_PROPOSALS_TENANT}".site_proposal_preparation_runs SET attempts=attempts+1,last_error=$2::text,updated_at=now() WHERE id=$1::uuid AND status='pending'`, [data.preparationRunId, this.error(error)]).catch(() => undefined);
      this.logger.warn(`Preparation dispatch pending run=${data.preparationRunId} proposal=${data.proposalId}: ${this.error(error)}`);
      return false;
    }
  }

  private async updateInitialProgress(data: ProposalPreparationJobData) {
    if (!this.progress) return;
    const update = { percent: 5, stage: 'queueing' as const, message: 'Accodamento completato' };
    try { await this.progress.update(SITE_PROPOSALS_TENANT, data.preparationRunId, data.proposalId, update); }
    catch (firstError) {
      this.logger.warn(`Preparation progress reconciliation run=${data.preparationRunId}: ${this.error(firstError)}`);
      try { await this.progress.update(SITE_PROPOSALS_TENANT, data.preparationRunId, data.proposalId, update); }
      catch (secondError) { this.logger.error(`Preparation progress unavailable run=${data.preparationRunId}: ${this.error(secondError)}`); }
    }
  }

  private async ensureQueueOperational() {
    if (!this.queueReady) await this.readyWithTimeout();
    const resumed = await this.resumeIfPaused();
    this.queueReady = true;
    return resumed;
  }

  private async readyWithTimeout() {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.queue.waitUntilReady(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Queue readiness timeout')), QUEUE_READY_TIMEOUT_MS); }),
      ]);
    } finally { if (timeout) clearTimeout(timeout); }
  }

  private async resumeIfPaused() {
    const paused = await this.queue.isPaused();
    this.queuePaused = paused;
    if (!paused) return false;
    await this.queue.resume();
    this.queuePaused = await this.queue.isPaused();
    this.logger.warn(`Preparation queue resumed automatically pausedAfter=${this.queuePaused}`);
    return true;
  }

  private recent(value: unknown, thresholdMs: number) { const timestamp = new Date(String(value || '')).getTime(); return Number.isFinite(timestamp) && Date.now() - timestamp < thresholdMs; }
  private recoveryJobData(primary: unknown, fallback: unknown): Partial<ProposalPreparationJobData> | undefined {
    const value = primary && typeof primary === 'object' && !Array.isArray(primary) ? primary : fallback;
    if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
    return value as Partial<ProposalPreparationJobData>;
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
  private error(error: unknown) { const message = cleanString(error instanceof Error ? error.message : String(error), 500) || 'Errore temporaneo di dispatch'; return /stack|sql|postgres|redis|token|secret|password|api.?key|cookie|authorization|null value in column|violates .*constraint|relation ["']/i.test(message) ? 'Errore temporaneo di dispatch' : message; }
}
