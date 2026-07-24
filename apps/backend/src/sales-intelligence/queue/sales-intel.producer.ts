// apps/backend/src/sales-intelligence/queue/sales-intel.producer.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { AnalyzeProspectDto } from '../dto/analyze-prospect.dto';

export const SALES_INTEL_QUEUE = 'sales-intelligence';
export const SALES_INTEL_JOB  = 'analyze-prospect';

@Injectable()
export class SalesIntelProducer {
  constructor(
    @InjectQueue(SALES_INTEL_QUEUE) private readonly queue: Queue,
  ) {}

  async queueAnalysis(dto: AnalyzeProspectDto) {
    const job = await this.queue.add(SALES_INTEL_JOB, dto, {
      attempts: 2,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: false, // mantieni il risultato per il polling
      removeOnFail: false,
    });
    return { jobId: job.id, status: 'queued' };
  }
}
