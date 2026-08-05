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
export class TenantSiteProposalsPreparationWorker extends WorkerHost {
  constructor(private readonly core: TenantSiteProposalsPreparationCoreService, private readonly dispatch: TenantSiteProposalsPreparationQueueService) { super(); }
  async process(job: Job<ProposalPreparationJobData>) {
    if (job.name !== SITE_PROPOSAL_PREPARATION_JOB) throw new Error('Unsupported site proposal preparation job');
    await this.dispatch.markRunning(job.data);
    try {
      const result = await this.core.prepare(job.data);
      await this.dispatch.markCompleted(job.data);
      return result;
    } catch (error) {
      const status = Number((error as { status?: number })?.status || (error as { getStatus?: () => number })?.getStatus?.() || 0);
      const permanent = [400, 401, 403, 404, 422].includes(status);
      if (permanent && typeof job.discard === 'function') job.discard();
      if (permanent || job.attemptsMade + 1 >= Number(job.opts.attempts || 1)) await this.dispatch.markFailed(job.data, error);
      throw error;
    }
  }
}
