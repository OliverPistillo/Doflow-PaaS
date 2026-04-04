// apps/backend/src/sitebuilder/sitebuilder.producer.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { SitebuilderJob, SitebuilderJobStatus } from './sitebuilder.entity';
import { CreateSitebuilderJobDto } from './dto/create-sitebuilder-job.dto';
import { SITEBUILDER_QUEUE } from './sitebuilder.constants';

export interface SitebuilderJobPayload {
  jobId: string;
  tenantId: string;
  siteDomain: string;
  siteTitle: string;
  adminEmail: string;
  businessType: string;
  businessDescription: string;
  starterSite: string;
  designScheme: Record<string, unknown>;
  contentTopics: string[];
  locale: string;
}

@Injectable()
export class SitebuilderProducerService {
  private readonly logger = new Logger(SitebuilderProducerService.name);

  constructor(
    @InjectRepository(SitebuilderJob)
    private readonly jobRepo: Repository<SitebuilderJob>,
    @InjectQueue(SITEBUILDER_QUEUE)
    private readonly queue: Queue<SitebuilderJobPayload>,
  ) {}

  async enqueue(dto: CreateSitebuilderJobDto): Promise<SitebuilderJob> {
    const entity = this.jobRepo.create({
      tenantId:            dto.tenantId,
      siteDomain:          dto.siteDomain,
      siteTitle:           dto.siteTitle,
      adminEmail:          dto.adminEmail,
      businessType:        dto.businessType,
      businessDescription: dto.businessDescription ?? null,
      starterSite:         dto.starterSite,
      designScheme:        (dto.designScheme as Record<string, unknown>) ?? {},
      contentTopics:       dto.contentTopics,
      locale:              dto.locale ?? 'it',
      status:              SitebuilderJobStatus.PENDING,
      logs:                [],
    });
    const saved = await this.jobRepo.save(entity);

    await this.queue.add('build-wp-site', {
      jobId:               saved.id,
      tenantId:            saved.tenantId,
      siteDomain:          saved.siteDomain,
      siteTitle:           saved.siteTitle,
      adminEmail:          saved.adminEmail,
      businessType:        saved.businessType,
      businessDescription: saved.businessDescription ?? '',
      starterSite:         saved.starterSite,
      designScheme:        saved.designScheme,
      contentTopics:       saved.contentTopics,
      locale:              saved.locale,
    } satisfies SitebuilderJobPayload, {
      jobId:    saved.id,
      priority: 1,
    });

    this.logger.log(`Job accodato → id=${saved.id} domain=${saved.siteDomain}`);
    return saved;
  }

  async findOne(jobId: string): Promise<SitebuilderJob> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Job ${jobId} non trovato`);
    return job;
  }

  async findAll(tenantId?: string): Promise<SitebuilderJob[]> {
    const where = tenantId ? { tenantId } : {};
    return this.jobRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: 50,
    });
  }
}