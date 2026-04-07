// apps/backend/src/sitebuilder/sitebuilder.processor.ts
// Architettura v4 — API-first, zero filesystem, output JSON in wpData

import * as crypto from 'crypto';

import { Inject, Logger }                       from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { InjectRepository }                     from '@nestjs/typeorm';
import { Job }                                  from 'bullmq';
import { Repository }                           from 'typeorm';
import Anthropic                                from '@anthropic-ai/sdk';
import { ConfigService }                        from '@nestjs/config';

import { SitebuilderJob, SitebuilderJobStatus } from './sitebuilder.entity';
import { SITEBUILDER_QUEUE }                    from './sitebuilder.constants';
import { SitebuilderJobPayload }                from './sitebuilder.producer.service';
import { ANTHROPIC_CLIENT }                     from './sitebuilder.anthropic.provider';
import { PROMPTS, BRICK_SCHEMAS }               from './sitebuilder.prompts';

// ─── Interfacce di dominio ────────────────────────────────────────────────────
// Migrate qui da sitebuilder.gutenberg.ts (ora eliminato)

export interface BrickContent {
  type: string;
  headline?: string;
  subheadline?: string;
  body?: string;
  cta_text?: string;
  cta_url?: string;
  items?: Array<{ title: string; description: string }>;
  /** Query testuale per Unsplash — viene risolta in imageUrl durante la build */
  image_query?: string;
  /** URL immagine risolta da Unsplash (popolata dal processor) */
  imageUrl?: string;
}

export interface SitePage {
  slug: string;
  title: string;
  bricks: BrickContent[];
}

/** Struttura salvata in wpData — consumata direttamente dal plugin WP */
interface WpData {
  meta: {
    siteDomain:   string;
    siteTitle:    string;
    adminEmail:   string;
    businessType: string;
    locale:       string;
    starterSite:  string;
    generatedAt:  string;
  };
  design: {
    primaryColor:   string;
    secondaryColor: string;
    headingFont:    string;
    bodyFont:       string;
    [key: string]:  unknown;
  };
  pages: SitePage[];
}

// ─────────────────────────────────────────────────────────────────────────────
//  Processor
// ─────────────────────────────────────────────────────────────────────────────

@Processor(SITEBUILDER_QUEUE)
export class SitebuilderProcessor extends WorkerHost {
  private readonly logger: Logger = new Logger(SitebuilderProcessor.name);

  /** Numero massimo di immagini Unsplash risolte per job */
  private static readonly MAX_UNSPLASH_IMAGES = 5;
  /** Delay tra chiamate Unsplash (ms) — rispetta il rate limit 50 req/ora */
  private static readonly UNSPLASH_DELAY_MS   = 1_300;

  constructor(
    @InjectRepository(SitebuilderJob)
    private readonly jobRepo: Repository<SitebuilderJob>,
    @Inject(ANTHROPIC_CLIENT)
    private readonly anthropic: Anthropic,
    private readonly config: ConfigService,
  ) {
    super();
  }

  // ════════════════════════════════════════════════════════════════════
  //  ENTRY POINT
  // ════════════════════════════════════════════════════════════════════

  async process(job: Job<SitebuilderJobPayload>): Promise<void> {
    const { jobId, siteDomain } = job.data;

    this.logger.log(`[${jobId}] Avvio elaborazione v4 — attempt #${job.attemptsMade + 1}`);

    // Segna il job come in esecuzione prima di qualsiasi operazione
    await this.patchStatus(jobId, SitebuilderJobStatus.RUNNING, [
      `[attempt #${job.attemptsMade + 1}] Avvio generazione per: ${siteDomain}`,
    ]);

    // ── Step 1: struttura pagine (LLM o XML pre-parsato) ──────────────
    let pages: SitePage[];

    if (job.data.xmlBlocks?.pages?.length) {
      // Modalità XML: il frontend ha già parsato il master doc → skip LLM struttura
      await this.appendLog(jobId,
        `Modalità XML: utilizzo ${job.data.xmlBlocks.pages.length} pagine pre-parsate.`);
      pages = job.data.xmlBlocks.pages as SitePage[];
    } else {
      // Modalità standard: generazione struttura con Claude
      await this.appendLog(jobId, 'Generazione struttura sito con AI...');
      const structure = await this.generateSiteStructure(job.data);
      await this.appendLog(jobId, `Struttura generata: ${structure.length} pagine.`);

      // ── Step 2: contenuti brick con Claude ────────────────────────
      await this.appendLog(jobId, 'Generazione contenuti con AI...');
      pages = await this.generatePageContents(job.data, structure, jobId);
    }

    // ── Step 3: risoluzione URL Unsplash (niente download su disco) ──
    await this.appendLog(jobId, 'Risoluzione URL immagini Unsplash...');
    await this.resolveUnsplashUrls(pages, jobId);

    // ── Step 4: assemblaggio wpData ───────────────────────────────────
    const wpData = this.assembleWpData(job.data, pages);

    // ── Step 5: generazione token di importazione univoco e sicuro ────
    // crypto.randomBytes è CSPRNG — safe per token monouso esposti via API
    const importToken = crypto.randomBytes(24).toString('hex');

    // ── Step 6: persistenza e status DONE ────────────────────────────
    // JSON round-trip: JSON.parse restituisce `any`, che TypeORM accetta
    // per le colonne JSONB senza errori TS2322. Semanticamente corretto:
    // Postgres serializza comunque a JSON, quindi nessun dato viene perso.
    await this.jobRepo.update(jobId, {
      status:      SitebuilderJobStatus.DONE,
      wpData:      JSON.parse(JSON.stringify(wpData)),
      importToken,
      siteUrl:     `https://${siteDomain}`,
    });

    this.logger.log(`[${jobId}] Generazione completata ✓ — token: ${importToken.slice(0, 8)}...`);
    await this.appendLog(jobId, `✓ Sito pronto. Importa tramite plugin con il token ricevuto.`);
  }

  // ════════════════════════════════════════════════════════════════════
  //  STEP: GENERAZIONE STRUTTURA PAGINE
  // ════════════════════════════════════════════════════════════════════

  private async generateSiteStructure(payload: SitebuilderJobPayload): Promise<SitePage[]> {
    const { system, user } = PROMPTS.SITE_STRUCTURE({
      locale:              payload.locale,
      siteTitle:           payload.siteTitle,
      businessDescription: payload.businessDescription,
      businessType:        payload.businessType,
      starterSite:         payload.starterSite,
      contentTopics:       payload.contentTopics,
    });

    const message = await this.anthropic.messages.create({
      model:     'claude-sonnet-4-6',
      max_tokens: 1024,
      system,
      messages:  [{ role: 'user', content: user }],
    });

    const raw = this.extractText(message)
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    return (JSON.parse(raw) as { pages: SitePage[] }).pages;
  }

  // ════════════════════════════════════════════════════════════════════
  //  STEP: GENERAZIONE CONTENUTI BRICK
  // ════════════════════════════════════════════════════════════════════

  private async generatePageContents(
    payload: SitebuilderJobPayload,
    pages:   SitePage[],
    jobId:   string,
  ): Promise<SitePage[]> {
    const businessInfo = payload.businessDescription
      || `${payload.businessType} - ${payload.siteTitle}`;

    const result: SitePage[] = [];

    for (const page of pages) {
      await this.appendLog(jobId, `Contenuto pagina "${page.title}"...`);
      const bricksWithContent: BrickContent[] = [];

      for (const brick of page.bricks) {
        const brickSchema = BRICK_SCHEMAS[brick.type]
          ?? `{"type":"${brick.type}","headline":"...","body":"..."}`;

        const { system, user } = PROMPTS.BRICK_CONTENT({
          brickType:   brick.type,
          pageTitle:   page.title,
          businessInfo,
          siteTitle:   payload.siteTitle,
          locale:      payload.locale,
          brickSchema,
        });

        const message = await this.anthropic.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: 1024,
          system,
          messages:   [{ role: 'user', content: user }],
        });

        const raw = this.extractText(message)
          .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        try {
          // Merge: mantiene i campi originali (type, image_query) + aggiunge il contenuto AI
          bricksWithContent.push({ ...brick, ...(JSON.parse(raw) as BrickContent) });
        } catch {
          this.logger.warn(`[${jobId}] Parse fallito brick "${brick.type}", uso fallback testo`);
          bricksWithContent.push({
            ...brick,
            headline: page.title,
            body:     payload.businessType,
          });
        }
      }

      result.push({ ...page, bricks: bricksWithContent });
    }

    return result;
  }

  // ════════════════════════════════════════════════════════════════════
  //  STEP: RISOLUZIONE URL UNSPLASH
  //  Non scarichiamo più i file su disco: recuperiamo solo l'URL CDN
  //  e lo salviamo nel brick. Il plugin WP importerà le immagini.
  // ════════════════════════════════════════════════════════════════════

  private async resolveUnsplashUrls(pages: SitePage[], jobId: string): Promise<void> {
    const unsplashKey = this.config.get<string>('UNSPLASH_ACCESS_KEY') ?? '';

    if (!unsplashKey) {
      this.logger.warn(`[${jobId}] UNSPLASH_ACCESS_KEY non configurata, immagini skippate.`);
      return;
    }

    let resolved = 0;

    for (const page of pages) {
      for (const brick of page.bricks) {
        if (!brick.image_query) continue;

        if (resolved >= SitebuilderProcessor.MAX_UNSPLASH_IMAGES) {
          this.logger.debug(`[${jobId}] Limite Unsplash raggiunto (${SitebuilderProcessor.MAX_UNSPLASH_IMAGES}), stop.`);
          return;
        }

        // Delay tra richieste consecutive per rispettare il rate limit
        if (resolved > 0) {
          await new Promise((r) => setTimeout(r, SitebuilderProcessor.UNSPLASH_DELAY_MS));
        }

        try {
          const query  = encodeURIComponent(brick.image_query);
          const apiUrl =
            `https://api.unsplash.com/photos/random` +
            `?query=${query}&orientation=landscape&content_filter=high` +
            `&client_id=${unsplashKey}`;

          const res = await fetch(apiUrl);

          if (res.status === 429) {
            this.logger.warn(`[${jobId}] Unsplash rate limit (429), stop immagini.`);
            return;
          }
          if (!res.ok) {
            this.logger.warn(`[${jobId}] Unsplash error ${res.status} per "${brick.image_query}"`);
            continue;
          }

          const data = await res.json() as {
            urls: { regular: string; small: string };
            alt_description: string | null;
            user: { name: string; links: { html: string } };
          };

          // Salviamo l'URL CDN direttamente nel brick — il plugin scaricherà
          brick.imageUrl = data.urls.regular;
          resolved++;

          await this.appendLog(jobId,
            `✓ Immagine risolta per brick "${brick.type}" (${page.slug})`);

        } catch (err) {
          this.logger.warn(`[${jobId}] Errore Unsplash: ${String(err)}`);
        }
      }
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  STEP: ASSEMBLAGGIO wpData
  //  Struttura pulita, pronta per essere consumata dal plugin WP
  // ════════════════════════════════════════════════════════════════════

  private assembleWpData(payload: SitebuilderJobPayload, pages: SitePage[]): WpData {
    const scheme = payload.designScheme as Record<string, string>;

    return {
      meta: {
        siteDomain:   payload.siteDomain,
        siteTitle:    payload.siteTitle,
        adminEmail:   payload.adminEmail,
        businessType: payload.businessType,
        locale:       payload.locale,
        starterSite:  payload.starterSite,
        generatedAt:  new Date().toISOString(),
      },
      design: {
        primaryColor:   scheme.primaryColor   ?? '#1e40af',
        secondaryColor: scheme.secondaryColor ?? '#f59e0b',
        headingFont:    scheme.headingFont     ?? 'Inter',
        bodyFont:       scheme.bodyFont        ?? 'Inter',
        // Propaga tutti i campi aggiuntivi del designScheme (es. borderRadius, spacing)
        ...scheme,
      },
      pages,
    };
  }

  // ════════════════════════════════════════════════════════════════════
  //  ROLLBACK — evento fired da BullMQ dopo tutti i tentativi esauriti
  // ════════════════════════════════════════════════════════════════════

  @OnWorkerEvent('failed')
  async onFailed(job: Job<SitebuilderJobPayload>, error: Error): Promise<void> {
    const { jobId }  = job.data;
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);

    this.logger.error(`[${jobId}] Fallito (attempt ${job.attemptsMade}): ${error.message}`);
    await this.appendLog(jobId, `ERRORE (attempt ${job.attemptsMade}): ${error.message}`);

    // Solo all'ultimo tentativo segniamo definitivamente il job come fallito
    if (isLastAttempt) {
      await this.jobRepo.update(jobId, { status: SitebuilderJobStatus.ROLLED_BACK });
      this.logger.warn(`[${jobId}] Job marcato ROLLED_BACK dopo ${job.attemptsMade} tentativi.`);
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  UTILITY
  // ════════════════════════════════════════════════════════════════════

  /** Estrae il testo plain da un response Anthropic (type-safe, senza cast fragili) */
  private extractText(message: Anthropic.Message): string {
    return (message.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
  }

  /** Aggiorna status e log iniziali in un'unica write */
  private async patchStatus(
    jobId:          string,
    status:         SitebuilderJobStatus,
    additionalLogs: string[] = [],
  ): Promise<void> {
    const entity  = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
    entity.status = status;
    entity.logs   = [...entity.logs, ...additionalLogs];
    await this.jobRepo.save(entity);
  }

  /**
   * Appende un log al JSONB array con una singola query UPDATE atomica.
   * Più efficiente di un SELECT + UPDATE separati sotto carico concorrente.
   */
  private async appendLog(jobId: string, message: string): Promise<void> {
    const entry = `[${new Date().toISOString()}] ${message}`;
    this.logger.debug(`[${jobId}] ${message}`);

    await this.jobRepo
      .createQueryBuilder()
      .update(SitebuilderJob)
      .set({ logs: () => 'logs || :entry::jsonb' })
      .setParameter('entry', JSON.stringify([entry]))
      .where('id = :id', { id: jobId })
      .execute();
  }
}