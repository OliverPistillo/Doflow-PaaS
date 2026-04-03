// apps/backend/src/sitebuilder/sitebuilder.producer.service.ts

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';

import { SitebuilderJob, SitebuilderJobStatus } from './sitebuilder.entity';
import { CreateSitebuilderJobDto } from './dto/create-sitebuilder-job.dto';
import { SITEBUILDER_QUEUE } from './sitebuilder.constants'; // ← da constants, non da module

// ─────────────────────────────────────────────
//  Tipo del payload che viaggia dentro BullMQ.
//  Non usa `any`; include anche la password
//  (cifrata in transit tramite Redis — assicurarsi di usare Redis con AUTH).
// ─────────────────────────────────────────────
export interface SitebuilderJobPayload {
  jobId: string;
  tenantId: string;
  siteDomain: string;
  siteTitle: string;
  adminEmail: string;
  adminPassword: string;
  contentTopics: string[];
  plugins: string[];        // slug WP.org dei plugin aggiuntivi
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

  // ── Crea record DB + job in coda, ritorna subito ──────────────────
  async enqueue(dto: CreateSitebuilderJobDto): Promise<SitebuilderJob> {
    // 1) Persistiamo il record in stato PENDING
    const entity = this.jobRepo.create({
      tenantId:      dto.tenantId,
      siteDomain:    dto.siteDomain,
      siteTitle:     dto.siteTitle,
      adminEmail:    dto.adminEmail,
      contentTopics: dto.contentTopics,
      plugins:       dto.plugins ?? [],
      locale:        dto.locale ?? 'it',
      status:        SitebuilderJobStatus.PENDING,
      logs:          [],
    });
    const saved = await this.jobRepo.save(entity);

    // 2) Accodiamo il job BullMQ usando l'UUID come jobId (idempotenza)
    await this.queue.add(
      'create-wp-site',  // nome del job — il Processor filtra su questo
      {
        jobId:         saved.id,
        tenantId:      saved.tenantId,
        siteDomain:    saved.siteDomain,
        siteTitle:     saved.siteTitle,
        adminEmail:    saved.adminEmail,
        adminPassword: dto.adminPassword,
        contentTopics: saved.contentTopics,
        plugins:       saved.plugins,
        locale:        saved.locale,
      } satisfies SitebuilderJobPayload,
      {
        jobId: saved.id, // BullMQ userà l'UUID come ID — previene duplicati
        priority: 1,
      },
    );

    this.logger.log(`Job accodato → id=${saved.id} domain=${saved.siteDomain}`);
    return saved;
  }

  // ── Polling ───────────────────────────────────────────────────────
  async findOne(jobId: string): Promise<SitebuilderJob> {
    const job = await this.jobRepo.findOne({ where: { id: jobId } });
    if (!job) throw new NotFoundException(`Job ${jobId} non trovato`);
    return job;
  }
}