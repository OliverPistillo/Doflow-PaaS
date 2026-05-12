// apps/backend/src/sales-intelligence/sales-intelligence.controller.ts
import {
  Controller, Post, Get, Body, Param, Query,
  NotFoundException,
} from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SalesIntelProducer, SALES_INTEL_QUEUE } from './queue/sales-intel.producer';
import { AnalyzeProspectDto } from './dto/analyze-prospect.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OutreachCampaign } from './entities/outreach-campaign.entity';
import { EnrichmentService } from './workers/enrichment.service';
import { RequireFeature } from '../feature-access/feature-access.decorator';

@RequireFeature('crm.sales-intel')
@Controller('sales-intel')
export class SalesIntelligenceController {
  constructor(
    private readonly producer: SalesIntelProducer,
    private readonly enrichmentService: EnrichmentService,
    @InjectQueue(SALES_INTEL_QUEUE) private readonly queue: Queue,
    @InjectRepository(OutreachCampaign)
    private readonly campaignRepo: Repository<OutreachCampaign>,
  ) {}

  /**
   * STEP 1 — Lookup azienda per dominio.
   * Restituisce dati aziendali + lista persone da Apollo.
   * Il frontend mostra la lista e l'utente sceglie il prospect.
   *
   * GET /sales-intel/lookup?domain=acme.it
   */
  @Get('lookup')
  async lookupCompany(@Query('domain') domain: string) {
    if (!domain) throw new NotFoundException('Parametro "domain" obbligatorio');
    // Normalizza il dominio (rimuove https://, www., trailing slash)
    const clean = domain
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/^www\./, '')
      .replace(/\/.*$/, '')
      .trim();
    return this.enrichmentService.lookupCompany(clean);
  }

  /**
   * STEP 2 — Avvia la pipeline di analisi in background.
   * Riceve il prospect già selezionato dall'utente.
   * Risponde immediatamente con { jobId }.
   *
   * POST /sales-intel/analyze
   */
  @Post('analyze')
  async analyze(@Body() dto: AnalyzeProspectDto) {
    return this.producer.queueAnalysis(dto);
  }

  /**
   * Polling: il frontend chiede lo stato del job ogni 2.5s.
   *
   * GET /sales-intel/status/:jobId
   */
  @Get('status/:jobId')
  async getJobStatus(@Param('jobId') jobId: string) {
    const job = await this.queue.getJob(jobId);
    if (!job) return { status: 'not_found' };

    const state    = await job.getState();
    const progress = job.progress;
    const result   = job.returnvalue;

    return {
      status:     state,
      progress:   progress ?? 0,
      campaignId: state === 'completed' ? result?.campaignId : null,
      error:      state === 'failed' ? job.failedReason : null,
    };
  }

  /**
   * Recupera una campaign completa con dati prospect e analisi.
   *
   * GET /sales-intel/campaigns/:campaignId
   */
  @Get('campaigns/:campaignId')
  async getCampaign(@Param('campaignId') campaignId: string) {
    const campaign = await this.campaignRepo.findOne({
      where: { id: campaignId },
      relations: ['prospect', 'prospect.company'],
    });
    if (!campaign) throw new NotFoundException('Campaign non trovata');
    return campaign;
  }

  /**
   * Lista ultime 50 campagne — per storico nel frontend.
   *
   * GET /sales-intel/campaigns
   */
  @Get('campaigns')
  async listCampaigns() {
    return this.campaignRepo.find({
      relations: ['prospect', 'prospect.company'],
      order: { generatedAt: 'DESC' },
      take: 50,
    });
  }
}