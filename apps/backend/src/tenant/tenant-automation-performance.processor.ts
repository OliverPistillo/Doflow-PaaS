import { Logger } from '@nestjs/common';
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import {
  AUTOMATION_RUN_JOB,
  DOFLOW_AUTOMATION_PERFORMANCE_QUEUE,
  PERFORMANCE_EVENT_JOB,
  type AutomationRunJobData,
  type PerformanceEventJobData,
} from './tenant-automation-performance.constants';
import { TenantAutomationEngineService } from './tenant-automation-engine.service';
import { TenantDoflowPerformanceRuntimeService } from './tenant-doflow-performance-runtime.service';

@Processor(DOFLOW_AUTOMATION_PERFORMANCE_QUEUE, { concurrency: 4, lockDuration: 30_000 })
export class TenantAutomationPerformanceProcessor extends WorkerHost {
  private readonly logger = new Logger(TenantAutomationPerformanceProcessor.name);

  constructor(
    private readonly engine: TenantAutomationEngineService,
    private readonly performance: TenantDoflowPerformanceRuntimeService,
  ) { super(); }

  async process(job: Job<AutomationRunJobData | PerformanceEventJobData>) {
    if (job.name === AUTOMATION_RUN_JOB) {
      const maxAttempts = Number(job.opts.attempts || 1);
      return this.engine.processRun(job.data as AutomationRunJobData, job.attemptsMade, maxAttempts, String(job.id || 'worker'));
    }
    if (job.name === PERFORMANCE_EVENT_JOB) {
      return this.performance.processBusinessEvent(job.data as PerformanceEventJobData);
    }
    this.logger.error(`Job Phase 4B non supportato: ${job.name}`);
    throw new Error('Job Phase 4B non supportato');
  }
}
