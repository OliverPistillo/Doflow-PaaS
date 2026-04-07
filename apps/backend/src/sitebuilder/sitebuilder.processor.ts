// apps/backend/src/sitebuilder/sitebuilder.processor.ts
// Architettura v4 — API-first, zero filesystem, output JSON in wpData
import * as crypto from 'crypto';
import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Job } from 'bullmq';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';

import { SitebuilderJob, SitebuilderJobStatus } from './sitebuilder.entity';
import { SITEBUILDER_QUEUE } from './sitebuilder.constants';
import { SitebuilderJobPayload } from './sitebuilder.producer.service';
import { ANTHROPIC_CLIENT } from './sitebuilder.anthropic.provider';
import { PROMPTS, BRICK_SCHEMAS } from './sitebuilder.prompts';

// ─── Interfacce di dominio ────────────────────────────────────────────────────
export interface BrickContent {
  type: string;
  headline?: string;
  subheadline?: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  items?: Array<{ title: string; description: string }>;
  image_query?: string;
  imageUrl?: string;
}

export interface SitePage {
  slug: string;
  title: string;
  bricks: BrickContent[];
}

interface WpData {
  meta: {
    siteDomain: string; siteTitle: string; adminEmail: string;
    businessType: string; locale: string; starterSite: string; generatedAt: string;
  };
  design: {
    primaryColor: string; secondaryColor: string; headingFont: string; bodyFont: string;
    [key: string]: unknown;
  };
  pages: SitePage[];
}

@Processor(SITEBUILDER_QUEUE)
export class SitebuilderProcessor extends WorkerHost {
  private readonly logger: Logger = new Logger(SitebuilderProcessor.name);
  private static readonly MAX_UNSPLASH_IMAGES = 5;
  private static readonly UNSPLASH_DELAY_MS = 1_300;

  constructor(
    @InjectRepository(SitebuilderJob)
    private readonly jobRepo: Repository<SitebuilderJob>,
    @Inject(ANTHROPIC_CLIENT)
    private readonly anthropic: Anthropic,
    private readonly config: ConfigService,
  ) {
    super();
  }

  async process(job: Job): Promise<void> {
    const { jobId, siteDomain } = job.data;
    this.logger.log(`[${jobId}] Avvio elaborazione v4 — attempt #${job.attemptsMade + 1}`);

    await this.patchStatus(jobId, SitebuilderJobStatus.RUNNING, [
      `[attempt #${job.attemptsMade + 1}] Avvio generazione per: ${siteDomain}`,
    ]);

    // Step 1: struttura pagine (LLM o XML pre-parsato)
    let pages: SitePage[];
    if (job.data.xmlBlocks?.pages?.length) {
      await this.appendLog(jobId, `Modalità XML: utilizzo ${job.data.xmlBlocks.pages.length} pagine pre-parsate.`);
      pages = job.data.xmlBlocks.pages as SitePage[];
    } else {
      await this.appendLog(jobId, 'Generazione struttura sito con AI...');
      pages = await this.generateSiteStructure(job.data);
    }

    // Step 2: Design Tokens & CSS Variables (v4 style)
    const designTokens = {
      primaryColor: (job.data.designScheme as any)?.primaryColor ?? '#1e40af',
      secondaryColor: (job.data.designScheme as any)?.secondaryColor ?? '#f59e0b',
      headingFont: (job.data.designScheme as any)?.headingFont ?? 'Inter',
      bodyFont: (job.data.designScheme as any)?.bodyFont ?? 'Inter',
    };
    const cssVariables = this.tokensToCSSVariables(designTokens);

    // Step 3: Contenuti brick
    await this.appendLog(jobId, 'Generazione contenuti con AI...');
    pages = await this.generatePageContents(job.data, pages, jobId);

    // Step 4: Immagini Unsplash
    await this.appendLog(jobId, 'Risoluzione URL Unsplash...');
    await this.resolveUnsplashUrls(pages, jobId);

    // Step 5: Assemblaggio wpData v2
    const wpData: WpData = {
      meta: {
        siteDomain: job.data.siteDomain,
        siteTitle: job.data.siteTitle,
        adminEmail: job.data.adminEmail,
        businessType: job.data.businessType,
        locale: job.data.locale,
        starterSite: job.data.starterSite,
        generatedAt: new Date().toISOString(),
      },
      design: {
        ...designTokens,
        ...cssVariables,
      },
      pages,
    };

    // Step 6: Persistenza
    const importToken = crypto.randomBytes(24).toString('hex');
    await this.jobRepo.update(jobId, {
      status: SitebuilderJobStatus.DONE,
      wpData: JSON.parse(JSON.stringify(wpData)),
      importToken,
      siteUrl: `https://${siteDomain}`,
    });

    this.logger.log(`[${jobId}] Generazione completata ✓ — token: ${importToken.slice(0, 8)}...`);
  }

  // ════════════════════════════════════════════════════════════════════
  //  GENERAZIONE STRUTTURA
  // ════════════════════════════════════════════════════════════════════
  private async generateSiteStructure(payload: SitebuilderJobPayload): Promise<SitePage[]> {
    // FIX: uso corretto di PROMPTS.SITE_STRUCTURE
    const { system, user } = PROMPTS.SITE_STRUCTURE({
      locale: payload.locale,
      siteTitle: payload.siteTitle,
      businessDescription: payload.businessDescription,
      businessType: payload.businessType,
      starterSite: payload.starterSite,
      contentTopics: payload.contentTopics,
    });

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const raw = this.extractText(message)
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    return (JSON.parse(raw) as { pages: SitePage[] }).pages;
  }

  // ════════════════════════════════════════════════════════════════════
  //  GENERAZIONE CONTENUTI
  // ════════════════════════════════════════════════════════════════════
  private async generatePageContents(
    payload: SitebuilderJobPayload,
    pages: SitePage[],
    jobId: string,
  ): Promise<SitePage[]> {
    const businessInfo = payload.businessDescription || `${payload.businessType} - ${payload.siteTitle}`;
    const result: SitePage[] = [];

    for (const page of pages) {
      await this.appendLog(jobId, `Contenuto pagina "${page.title}"...`);
      const bricksWithContent: BrickContent[] = [];

      for (const brick of page.bricks) {
        const brickSchema = BRICK_SCHEMAS[brick.type] || `{ "type": "${brick.type}", "headline": "...", "body": "..." }`;

        // FIX: uso corretto di PROMPTS.BRICK_CONTENT
        const { system, user } = PROMPTS.BRICK_CONTENT({
          brickType: brick.type,
          pageTitle: page.title,
          businessInfo,
          siteTitle: payload.siteTitle,
          locale: payload.locale,
          brickSchema,
        });

        const message = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-6',
          max_tokens: 1024,
          system, // FIX: variabile corretta
          messages: [{ role: 'user', content: user }], // FIX: variabile corretta
        });

        const raw = this.extractText(message)
          .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        try {
          bricksWithContent.push({ ...brick, ...(JSON.parse(raw) as BrickContent) });
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`[${jobId}] Parse fallito brick "${brick.type}": ${errorMsg}`);
          bricksWithContent.push({ ...brick, headline: page.title, body: payload.businessType });
        }
      }
      result.push({ ...page, bricks: bricksWithContent });
    }
    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  //  UTILS & EVENTS
  // ════════════════════════════════════════════════════════════════════
  private tokensToCSSVariables(tokens: any): Record<string, string> {
    return {
      '--color-primary': tokens.primaryColor,
      '--color-secondary': tokens.secondaryColor,
      '--font-heading': tokens.headingFont,
      '--font-body': tokens.bodyFont,
    };
  }

  private extractText(message: Anthropic.Message): string {
    return (message.content as Array<{ type: string; text?: string }>)
      .filter(b => b.type === 'text')
      .map(b => b.text ?? '')
      .join('');
  }

  private async patchStatus(jobId: string, status: SitebuilderJobStatus, additionalLogs: string[] = []): Promise<void> {
    const entity = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
    entity.status = status;
    entity.logs = [...entity.logs, ...additionalLogs];
    await this.jobRepo.save(entity);
  }

  private async appendLog(jobId: string, message: string): Promise<void> {
    const entry = `[${new Date().toISOString()}] ${message}`;
    await this.jobRepo
      .createQueryBuilder()
      .update(SitebuilderJob)
      .set({ logs: () => 'logs || :entry::jsonb' })
      .setParameter('entry', JSON.stringify([entry]))
      .where('id = :id', { id: jobId })
      .execute();
  }

  @OnWorkerEvent('failed')
  async onFailed(job: Job, error: Error): Promise<void> {
    const { jobId } = job.data;
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);
    this.logger.error(`[${jobId}] Fallito (attempt ${job.attemptsMade}): ${error.message}`);
    await this.appendLog(jobId, `ERRORE (attempt ${job.attemptsMade}): ${error.message}`);
    if (isLastAttempt) {
      await this.jobRepo.update(jobId, { status: SitebuilderJobStatus.ROLLED_BACK });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  RISOLUZIONE UNSPLASH
  // ════════════════════════════════════════════════════════════════════
  private async resolveUnsplashUrls(pages: SitePage[], jobId: string): Promise<void> {
    const unsplashKey = this.config.get('UNSPLASH_ACCESS_KEY') ?? '';
    if (!unsplashKey) return;
    
    let resolved = 0;
    for (const page of pages) {
      for (const brick of page.bricks) {
        if (!brick.image_query) continue;
        if (resolved >= SitebuilderProcessor.MAX_UNSPLASH_IMAGES) return;
        if (resolved > 0) await new Promise(r => setTimeout(r, SitebuilderProcessor.UNSPLASH_DELAY_MS));

        try {
          const query = encodeURIComponent(brick.image_query);
          const apiUrl = `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&content_filter=high&client_id=${unsplashKey}`;
          const res = await fetch(apiUrl);
          if (res.status === 429) return;
          if (!res.ok) continue;
          const data = await res.json() as { urls: { regular: string } };
          brick.imageUrl = data.urls.regular;
          resolved++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`[${jobId}] Errore Unsplash: ${errorMsg}`);
        }
      }
    }
  }
}