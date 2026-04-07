// apps/backend/src/sitebuilder/sitebuilder.controller.ts
import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SiteGenerationProducer } from './queue/site-generation.producer';
import { GenerateSiteDto } from './dto/generate-site.dto';

@Controller('sitebuilder')
export class SiteBuilderController {
  constructor(
    private readonly siteGenerationProducer: SiteGenerationProducer,
    @InjectQueue('site-generation') private readonly siteQueue: Queue
  ) {}

  // Questo avvia il processo in background
  @Post('generate')
  async generateSite(@Body() briefData: GenerateSiteDto) {
    const result = await this.siteGenerationProducer.queueSiteGeneration(briefData);
    return result; // Ritorna { jobId: "..." }
  }

  // Questo endpoint serve al frontend per chiedere "A che punto è il mio sito?"
  @Get('status/:jobId')
  async checkStatus(@Param('jobId') jobId: string) {
    const job = await this.siteQueue.getJob(jobId);
    
    if (!job) {
      return { status: 'not_found' };
    }

    const state = await job.getState();
    const result = job.returnvalue;

    return {
      status: state, // 'waiting', 'active', 'completed', 'failed'
      token: state === 'completed' ? result.token : null,
    };
  }
}