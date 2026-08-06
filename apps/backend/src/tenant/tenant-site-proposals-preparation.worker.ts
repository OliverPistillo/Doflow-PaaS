import { Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { SITE_PROPOSAL_PREPARATION_JOB, SITE_PROPOSAL_PREPARATION_QUEUE } from './tenant-site-proposals.constants';
import { TenantSiteProposalsPreparationCoreService } from './tenant-site-proposals-preparation-core.service';
import { TenantSiteProposalsPreparationQueueService } from './tenant-site-proposals-preparation-queue.service';
import { ProposalPreparationJobData } from './tenant-site-proposals.types';

function integerEnv(name: string, fallback: number, min: number, max: number) {
  const value = Number(process.env[name]);
  return Number.isInteger(value) && value >= min && value <= max ? value : fallback;
}
export function preparationWorkerConfiguration() {
  return {
    concurrency: integerEnv('SITE_PROPOSALS_PREPARATION_CONCURRENCY', 2, 1, 4),
    limiter: {
      max: integerEnv('SITE_PROPOSALS_PREPARATION_RATE_MAX', 4, 1, 60),
      duration: integerEnv('SITE_PROPOSALS_PREPARATION_RATE_DURATION_MS', 60_000, 1_000, 3_600_000),
    },
  };
}

@Processor(SITE_PROPOSAL_PREPARATION_QUEUE, preparationWorkerConfiguration())
export class TenantSiteProposalsPreparationWorker extends WorkerHost implements OnApplicationBootstrap {
  private readonly logger = new Logger(TenantSiteProposalsPreparationWorker.name);
  private listenersRegistered = false;
  constructor(private readonly core: TenantSiteProposalsPreparationCoreService, private readonly dispatch: TenantSiteProposalsPreparationQueueService) { super(); }

  async onApplicationBootstrap() {
    this.registerWorkerEvents();
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        this.worker.waitUntilReady(),
        new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Worker readiness timeout')), 10_000); }),
      ]);
      this.dispatch.setWorkerReady(true);
      this.logger.log('Preparation worker ready');
    } catch (error) {
      this.dispatch.setWorkerReady(false);
      this.logger.error(`Preparation worker unavailable: ${this.error(error)}`);
    } finally { if (timeout) clearTimeout(timeout); }
  }

  async process(job: Job<ProposalPreparationJobData>) {
    if (job.name !== SITE_PROPOSAL_PREPARATION_JOB) throw new Error('Unsupported site proposal preparation job');
    await this.dispatch.markRunning(job.data);
    try {
      const result = await this.core.prepare(job.data);
      await this.dispatch.markCompleted(job.data);
      return result;
    } catch (error) {
      const originalError = error;
      const status = Number((originalError as { status?: number })?.status || (originalError as { getStatus?: () => number })?.getStatus?.() || 0);
      const permanent = [400, 401, 403, 404, 422].includes(status);
      if (permanent && typeof job.discard === 'function') job.discard();
      if (permanent || job.attemptsMade + 1 >= Number(job.opts.attempts || 1)) {
        try {
          await this.dispatch.markFailed(job.data, originalError);
        } catch (bookkeepingError) {
          this.logger.error(`Preparation failure bookkeeping failed run=${job.data.preparationRunId} proposal=${job.data.proposalId}: ${this.error(bookkeepingError)}`);
        }
      }
      throw originalError;
    }
  }

  private registerWorkerEvents() {
    if (this.listenersRegistered) return;
    this.listenersRegistered = true;
    this.worker.on('ready', () => { this.dispatch.setWorkerReady(true); this.logger.log('Preparation worker ready'); });
    this.worker.on('active', (job) => this.logger.log(`Preparation worker active run=${job.data?.preparationRunId || 'unknown'} proposal=${job.data?.proposalId || 'unknown'} attempt=${job.attemptsMade + 1}`));
    this.worker.on('completed', (job) => this.logger.log(`Preparation worker completed run=${job.data?.preparationRunId || 'unknown'} proposal=${job.data?.proposalId || 'unknown'}`));
    this.worker.on('failed', (job, error) => this.logger.warn(`Preparation worker failed run=${job?.data?.preparationRunId || 'unknown'} proposal=${job?.data?.proposalId || 'unknown'}: ${this.error(error)}`));
    this.worker.on('stalled', (jobId) => this.logger.warn(`Preparation worker stalled job=${jobId}`));
    this.worker.on('error', (error) => {
      this.dispatch.setWorkerReady(false);
      this.logger.error(`Preparation worker error: ${this.error(error)}`);
    });
    this.worker.on('closed', () => this.dispatch.setWorkerReady(false));
  }

  private error(error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    return /redis|password|token|secret|authorization|cookie|stack/i.test(message) ? 'Errore del sottosistema di accodamento' : message.slice(0, 240);
  }
}
