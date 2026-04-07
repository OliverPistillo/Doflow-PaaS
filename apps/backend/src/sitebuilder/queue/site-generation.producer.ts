// apps/backend/src/sitebuilder/queue/site-generation.producer.ts
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { GenerateSiteDto } from '../dto/generate-site.dto';

@Injectable()
export class SiteGenerationProducer {
  constructor(@InjectQueue('site-generation') private readonly siteQueue: Queue) {}

  async queueSiteGeneration(data: GenerateSiteDto) {
    // Aggiungiamo un job alla coda. Restituiamo il Job ID al frontend.
    const job = await this.siteQueue.add('generate-neuro-site', data);
    return { jobId: job.id, status: 'processing' };
  }
}