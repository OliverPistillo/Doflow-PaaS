import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { GenerateSiteBriefDto } from '../dto/generate-site-brief.dto';

@Injectable()
export class SiteGenerationProducer {
  constructor(@InjectQueue('site-generation') private readonly siteQueue: Queue) {}

  async queueSiteGeneration(data: GenerateSiteBriefDto) {
    const job = await this.siteQueue.add('generate-site-manifest', data, {
      removeOnComplete: false,
      removeOnFail: false,
    });

    return { jobId: job.id, status: 'processing' };
  }
}
