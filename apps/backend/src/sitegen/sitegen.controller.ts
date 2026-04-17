import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SiteGenerationProducer } from './queue/site-generation.producer';
import { GenerateSiteBriefDto } from './dto/generate-site-brief.dto';

@Controller(['sitebuilder', 'sitegen'])
export class SiteGenController {
  constructor(
    private readonly siteGenerationProducer: SiteGenerationProducer,
    @InjectQueue('site-generation') private readonly siteQueue: Queue,
  ) {}

  @Post('generate')
  async generateSite(@Body() briefData: GenerateSiteBriefDto) {
    return this.siteGenerationProducer.queueSiteGeneration(briefData);
  }

  @Get('status/:jobId')
  async checkStatus(@Param('jobId') jobId: string) {
    return this.getJobStatus(jobId);
  }

  @Get('jobs/:jobId')
  async checkJobStatus(@Param('jobId') jobId: string) {
    return this.getJobStatus(jobId);
  }

  private async getJobStatus(jobId: string) {
    const job = await this.siteQueue.getJob(jobId);

    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const result = job.returnvalue as undefined | { token?: string; exportId?: string; manifest?: unknown };

    return {
      status: state,
      token: state === 'completed' ? result?.token ?? null : null,
      exportId: state === 'completed' ? result?.exportId ?? null : null,
      manifest: state === 'completed' ? result?.manifest ?? null : null,
    };
  }
}
