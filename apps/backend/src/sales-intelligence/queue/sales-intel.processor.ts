// apps/backend/src/sales-intelligence/queue/sales-intel.processor.ts
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EnrichmentService } from '../workers/enrichment.service';
import { ResearchService } from '../workers/research.service';
import { StrategicAnalysisService } from '../workers/strategic-analysis.service';
import { OutreachGeneratorService } from '../workers/outreach-generator.service';
import { OutreachCampaign } from '../entities/outreach-campaign.entity';
import { SALES_INTEL_QUEUE } from './sales-intel.producer';
import { NotificationsService } from '../../realtime/notifications.service';

@Processor(SALES_INTEL_QUEUE)
export class SalesIntelProcessor extends WorkerHost {
  private readonly logger = new Logger(SalesIntelProcessor.name);

  constructor(
    private readonly enrichmentService: EnrichmentService,
    private readonly researchService: ResearchService,
    private readonly strategicAnalysisService: StrategicAnalysisService,
    private readonly outreachGeneratorService: OutreachGeneratorService,
    private readonly notificationsService: NotificationsService,
    @InjectRepository(OutreachCampaign)
    private readonly campaignRepo: Repository<OutreachCampaign>,
  ) {
    super();
  }

  async process(job: Job): Promise<{ campaignId: string }> {
    this.logger.log(`[Job ${job.id}] Avvio analisi per: ${job.data.fullName} @ ${job.data.companyName}`);

    // ── STEP 1 — Data Enrichment ──────────────────────────────────────────
    await job.updateProgress(10);
    this.logger.log(`[Job ${job.id}] Step 1: Enrichment`);
    const enriched = await this.enrichmentService.enrich(job.data);

    // ── STEP 2 — Deep Research ────────────────────────────────────────────
    await job.updateProgress(30);
    this.logger.log(`[Job ${job.id}] Step 2: Research`);
    const research = await this.researchService.research(enriched, enriched.prospectId);

    // ── STEP 3 — Gemini Analisi Strategica ───────────────────────────────
    await job.updateProgress(55);
    this.logger.log(`[Job ${job.id}] Step 3: Analisi strategica Gemini`);
    const analysis = await this.strategicAnalysisService.analyze(
      enriched,
      research,
      job.data.ourSolutionsCatalog,
    );

    // ── STEP 4 — Gemini Generazione Outreach ─────────────────────────────
    await job.updateProgress(78);
    this.logger.log(`[Job ${job.id}] Step 4: Generazione email`);
    const emails = await this.outreachGeneratorService.generate(enriched, analysis);

    // ── STEP 5 — Salva Campaign in DB ─────────────────────────────────────
    await job.updateProgress(92);
    const campaign = await this.campaignRepo.save({
      prospectId:       enriched.prospectId,
      strategicAnalysis: analysis,
      emailVariants:    emails,
      status:           'generated',
      jobId:            String(job.id),
    });

    // ── WS Notify ─────────────────────────────────────────────────────────
    if (job.data.userId) {
      await this.notificationsService.notifyUser(
        job.data.userId,
        { event: 'si:complete', jobId: job.id, campaignId: campaign.id },
      );
    }

    await job.updateProgress(100);
    this.logger.log(`[Job ${job.id}] Completato. Campaign: ${campaign.id}`);
    return { campaignId: campaign.id };
  }
}