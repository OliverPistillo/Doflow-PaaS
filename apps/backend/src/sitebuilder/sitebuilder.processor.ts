// apps/backend/src/sitebuilder/sitebuilder.processor.ts
// Architettura v3 — niente binari OS, archiver/adm-zip, DI Anthropic, prompts separati

import { Inject, Logger } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as fsSync from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as http from 'http';
import { createWriteStream } from 'fs';
import * as archiver from 'archiver';
// adm-zip: installare con `pnpm --filter backend add adm-zip @types/adm-zip`
import AdmZip = require('adm-zip');

import { SitebuilderJob, SitebuilderJobStatus } from './sitebuilder.entity';
import { SITEBUILDER_QUEUE } from './sitebuilder.constants';
import { SitebuilderJobPayload } from './sitebuilder.producer.service';
import { ANTHROPIC_CLIENT } from './sitebuilder.anthropic.provider';
import { PROMPTS, BRICK_SCHEMAS } from './sitebuilder.prompts';
import { bricksToGutenberg, escapeXml, BrickContent, SitePage } from './sitebuilder.gutenberg';

// ─── Download helper ─────────────────────────────────────────────────────────
// Segue redirect HTTP 301/302 e gestisce errori di rete
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file     = createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fsSync.unlinkSync(destPath);
        return downloadFile(response.headers.location!, destPath).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        reject(new Error(`Download fallito: HTTP ${response.statusCode} per ${url}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => { file.close(); resolve(); });
    });

    request.on('error', (err) => { file.close(); reject(err); });
    file.on('error',   (err) => { file.close(); reject(err); });
  });
}

// ─── AdmZip extract ──────────────────────────────────────────────────────────
// Sostituisce spawn('unzip',...) — funziona su qualsiasi OS/container
function extractZip(zipPath: string, destDir: string): void {
  const zip = new AdmZip(zipPath);
  zip.extractAllTo(destDir, /* overwrite= */ true);
}

// ─── Archiver ZIP ────────────────────────────────────────────────────────────
// Sostituisce spawn('zip',...) — streaming, bassa memoria
function createZipArchive(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const output  = fsSync.createWriteStream(outputPath);
    const archive = archiver.create('zip', { zlib: { level: 6 } });

    output.on('close', resolve);
    archive.on('error', reject);
    archive.pipe(output);
    archive.directory(sourceDir, false);
    archive.finalize();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
//  Processor
// ─────────────────────────────────────────────────────────────────────────────
@Processor(SITEBUILDER_QUEUE)
export class SitebuilderProcessor extends WorkerHost {
  private readonly logger          = new Logger(SitebuilderProcessor.name);
  private readonly deploymentsRoot: string;
  private readonly unsplashKey:     string;
  private readonly pluginAssetPath: string;

  /** Max immagini Unsplash per job (1 per pagina hero) — rispetta rate limit */
  private static readonly MAX_UNSPLASH_IMAGES = 5;
  /** Delay tra chiamate Unsplash in ms — evita rate limit 50 req/ora in demo */
  private static readonly UNSPLASH_DELAY_MS   = 1_300;

  constructor(
    @InjectRepository(SitebuilderJob)
    private readonly jobRepo: Repository<SitebuilderJob>,
    @Inject(ANTHROPIC_CLIENT)
    private readonly anthropic: Anthropic,
    private readonly config: ConfigService,
  ) {
    super();
    this.deploymentsRoot = path.resolve(
      config.get<string>('SITEBUILDER_DEPLOYMENTS_PATH', './deployments'),
    );
    this.unsplashKey     = config.get<string>('UNSPLASH_ACCESS_KEY') ?? '';
    this.pluginAssetPath = path.join(__dirname, 'assets', 'blocksy-companion-pro.zip');
  }

  // ════════════════════════════════════════════════════════════════════
  //  ENTRY POINT
  // ════════════════════════════════════════════════════════════════════
  async process(job: Job<SitebuilderJobPayload>): Promise<void> {
    const { jobId, siteDomain } = job.data;

    this.logger.log(`[${jobId}] Inizio elaborazione v3 — attempt #${job.attemptsMade + 1}`);

    await this.patchStatus(jobId, SitebuilderJobStatus.RUNNING, [
      `[attempt #${job.attemptsMade + 1}] Avvio build per: ${siteDomain}`,
    ]);

    const deployDir = path.join(this.deploymentsRoot, jobId);
    const wpDir     = path.join(deployDir, 'wordpress');

    if (job.attemptsMade > 0) {
      await this.appendLog(jobId, 'Cleanup attempt precedente...');
      await fs.rm(deployDir, { recursive: true, force: true });
    }

    await fs.mkdir(deployDir, { recursive: true });

    await this.appendLog(jobId, 'Download WordPress italiano...');
    await this.downloadWordPress(deployDir, wpDir);

    await this.appendLog(jobId, 'Download e installazione tema Blocksy...');
    await this.installBlocksyTheme(deployDir, wpDir);

    await this.appendLog(jobId, 'Installazione Blocksy Companion Pro...');
    await this.installBlocksyCompanionPro(wpDir);

    // Scelta pipeline: XML pre-parsato oppure generazione LLM
    let pages: SitePage[];
    if (job.data.xmlBlocks?.pages?.length) {
      await this.appendLog(jobId,
        `Modalità XML: utilizzo ${job.data.xmlBlocks.pages.length} pagine pre-parsate.`);
      pages = job.data.xmlBlocks.pages as SitePage[];
    } else {
      await this.appendLog(jobId, 'Generazione struttura sito con AI...');
      const structure = await this.generateSiteStructure(job.data);
      await this.appendLog(jobId, `Struttura generata: ${structure.length} pagine.`);
      await this.appendLog(jobId, 'Generazione contenuti con AI...');
      pages = await this.generatePageContents(job.data, structure, jobId);
    }

    await this.appendLog(jobId, 'Download immagini da Unsplash...');
    await this.downloadImages(pages, wpDir, jobId);

    await this.appendLog(jobId, 'Creazione wp-config.php...');
    await this.createWpConfig(wpDir, job.data);

    await this.appendLog(jobId, 'Generazione file di importazione WordPress...');
    await this.generateWXR(wpDir, pages, job.data);

    await this.generateReadme(deployDir, job.data);

    await this.appendLog(jobId, 'Creazione archivio ZIP...');
    const zipPath = path.join(deployDir, `${jobId}.zip`);
    await createZipArchive(wpDir, zipPath);

    const zipSize = (await fs.stat(zipPath)).size;
    await this.appendLog(jobId, `ZIP creato: ${(zipSize / 1024 / 1024).toFixed(1)} MB`);

    await this.jobRepo.update(jobId, {
      status:      SitebuilderJobStatus.DONE,
      zipFilename: `${jobId}.zip`,
      siteUrl:     `https://${job.data.siteDomain}`,
    });

    this.logger.log(`[${jobId}] Build completata ✓`);
    await this.appendLog(jobId, '✓ Sito completato! Scarica lo ZIP e importalo su SiteGround.');
  }

  // ════════════════════════════════════════════════════════════════════
  //  STEP IMPLEMENTATIONS
  // ════════════════════════════════════════════════════════════════════

  private async downloadWordPress(deployDir: string, wpDir: string): Promise<void> {
    const zipPath = path.join(deployDir, 'wordpress.zip');
    await downloadFile('https://it.wordpress.org/latest-it_IT.zip', zipPath);
    extractZip(zipPath, deployDir);

    try { await fs.access(wpDir); }
    catch { throw new Error('Estrazione WordPress fallita: cartella wordpress/ non trovata'); }

    await fs.unlink(zipPath);
  }

  private async installBlocksyTheme(deployDir: string, wpDir: string): Promise<void> {
    const themesDir = path.join(wpDir, 'wp-content', 'themes');
    await fs.mkdir(themesDir, { recursive: true });

    const infoRes = await fetch(
      'https://api.wordpress.org/themes/info/1.2/?action=theme_information&request[slug]=blocksy',
    );
    const info        = await infoRes.json() as { download_link?: string };
    const downloadUrl = info.download_link
      ?? 'https://downloads.wordpress.org/theme/blocksy.latest-stable.zip';

    const zipPath = path.join(deployDir, 'blocksy-theme.zip');
    await downloadFile(downloadUrl, zipPath);
    extractZip(zipPath, themesDir);
    await fs.unlink(zipPath);
  }

  private async installBlocksyCompanionPro(wpDir: string): Promise<void> {
    const pluginsDir = path.join(wpDir, 'wp-content', 'plugins');
    await fs.mkdir(pluginsDir, { recursive: true });

    try { await fs.access(this.pluginAssetPath); }
    catch {
      this.logger.warn(
        `[SitebuilderProcessor] Blocksy Companion Pro non trovato in ${this.pluginAssetPath}, skip.`,
      );
      return;
    }

    extractZip(this.pluginAssetPath, pluginsDir);
  }

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
      model: 'claude-sonnet-4-6', max_tokens: 1024,
      system,
      messages: [{ role: 'user', content: user }],
    });

    const raw = this.extractText(message).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
    return (JSON.parse(raw) as { pages: SitePage[] }).pages;
  }

  private async generatePageContents(
    payload: SitebuilderJobPayload,
    pages: SitePage[],
    jobId: string,
  ): Promise<SitePage[]> {
    const businessInfo = payload.businessDescription
      || `${payload.businessType} - ${payload.siteTitle}`;
    const result: SitePage[] = [];

    for (const page of pages) {
      await this.appendLog(jobId, `Generazione contenuto pagina "${page.title}"...`);
      const bricksWithContent: BrickContent[] = [];

      for (const brick of page.bricks) {
        const brickSchema = BRICK_SCHEMAS[brick.type]
          ?? `{"type":"${brick.type}","headline":"...","body":"..."}`;

        const { system, user } = PROMPTS.BRICK_CONTENT({
          brickType:    brick.type,
          pageTitle:    page.title,
          businessInfo,
          siteTitle:    payload.siteTitle,
          locale:       payload.locale,
          brickSchema,
        });

        const message = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-6', max_tokens: 1024,
          system,
          messages: [{ role: 'user', content: user }],
        });

        const raw = this.extractText(message)
          .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        try {
          bricksWithContent.push({ ...brick, ...(JSON.parse(raw) as BrickContent) });
        } catch {
          this.logger.warn(`[${jobId}] Parse fallito brick ${brick.type}, uso fallback`);
          bricksWithContent.push({ ...brick, headline: page.title, body: payload.businessType });
        }
      }

      result.push({ ...page, bricks: bricksWithContent });
    }

    return result;
  }

  private async downloadImages(pages: SitePage[], wpDir: string, jobId: string): Promise<void> {
    if (!this.unsplashKey) {
      this.logger.warn(`[${jobId}] UNSPLASH_ACCESS_KEY non configurata, skip immagini.`);
      return;
    }

    const uploadsDir = path.join(wpDir, 'wp-content', 'uploads', 'sitebuilder');
    await fs.mkdir(uploadsDir, { recursive: true });

    let downloaded = 0;

    for (const page of pages) {
      for (const brick of page.bricks) {
        if (!brick.image_query) continue;
        if (downloaded >= SitebuilderProcessor.MAX_UNSPLASH_IMAGES) {
          this.logger.debug(`[${jobId}] Limite Unsplash raggiunto (${SitebuilderProcessor.MAX_UNSPLASH_IMAGES}), skip immagini restanti.`);
          return;
        }

        try {
          // Delay tra richieste per rispettare rate limit
          if (downloaded > 0) {
            await new Promise((r) => setTimeout(r, SitebuilderProcessor.UNSPLASH_DELAY_MS));
          }

          const query  = encodeURIComponent(brick.image_query);
          const apiUrl = `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&content_filter=high&client_id=${this.unsplashKey}`;
          const res    = await fetch(apiUrl);

          if (res.status === 429) {
            this.logger.warn(`[${jobId}] Unsplash rate limit (429), skip immagini restanti.`);
            return;
          }
          if (!res.ok) {
            this.logger.warn(`[${jobId}] Unsplash error ${res.status} per "${brick.image_query}"`);
            continue;
          }

          const data     = await res.json() as { urls: { regular: string } };
          const safeSlug = `${page.slug}-${brick.type}`.replace(/[^a-z0-9-]/g, '-');
          const imgPath  = path.join(uploadsDir, `${safeSlug}.jpg`);

          await downloadFile(data.urls.regular, imgPath);
          brick.imageUrl = `/wp-content/uploads/sitebuilder/${safeSlug}.jpg`;
          downloaded++;
          await this.appendLog(jobId, `✓ Immagine: ${safeSlug}.jpg`);
        } catch (err) {
          this.logger.warn(`[${jobId}] Errore download immagine: ${String(err)}`);
        }
      }
    }
  }

  private async createWpConfig(wpDir: string, payload: SitebuilderJobPayload): Promise<void> {
    const samplePath = path.join(wpDir, 'wp-config-sample.php');
    const configPath = path.join(wpDir, 'wp-config.php');

    let sample = await fs.readFile(samplePath, 'utf8');

    sample = sample
      .replace("define( 'DB_NAME', 'database_name_here' );", "define( 'DB_NAME', 'YOUR_DB_NAME' );")
      .replace("define( 'DB_USER', 'username_here' );",      "define( 'DB_USER', 'YOUR_DB_USER' );")
      .replace("define( 'DB_PASSWORD', 'password_here' );",  "define( 'DB_PASSWORD', 'YOUR_DB_PASSWORD' );")
      .replace("define( 'DB_CHARSET', 'utf8' );",            "define( 'DB_CHARSET', 'utf8mb4' );");

    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.';
    for (let i = 0; i < 8; i++) {
      const key = Array.from({ length: 64 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
      sample    = sample.replace('put your unique phrase here', key);
    }

    await fs.writeFile(configPath, sample, 'utf8');
  }

  private async generateWXR(
    wpDir: string,
    pages: SitePage[],
    payload: SitebuilderJobPayload,
  ): Promise<void> {
    const now = new Date().toUTCString();

    const items = pages.map((page, i) => {
      const html   = bricksToGutenberg(page.bricks, payload);
      const postId = i + 2;
      const date   = new Date().toISOString().replace('T', ' ').substring(0, 19);

      return `
  <item>
    <title>${escapeXml(page.title)}</title>
    <link>https://${payload.siteDomain}/${page.slug}/</link>
    <pubDate>${now}</pubDate>
    <dc:creator><![CDATA[admin]]></dc:creator>
    <guid isPermaLink="false">https://${payload.siteDomain}/?page_id=${postId}</guid>
    <description></description>
    <content:encoded><![CDATA[${html}]]></content:encoded>
    <excerpt:encoded><![CDATA[]]></excerpt:encoded>
    <wp:post_id>${postId}</wp:post_id>
    <wp:post_date><![CDATA[${date}]]></wp:post_date>
    <wp:post_date_gmt><![CDATA[${date}]]></wp:post_date_gmt>
    <wp:comment_status><![CDATA[closed]]></wp:comment_status>
    <wp:ping_status><![CDATA[closed]]></wp:ping_status>
    <wp:post_name><![CDATA[${page.slug}]]></wp:post_name>
    <wp:status><![CDATA[publish]]></wp:status>
    <wp:post_parent>0</wp:post_parent>
    <wp:menu_order>${i}</wp:menu_order>
    <wp:post_type><![CDATA[page]]></wp:post_type>
    <wp:post_password><![CDATA[]]></wp:post_password>
    <wp:is_sticky>0</wp:is_sticky>
  </item>`;
    }).join('\n');

    const wxr = `<?xml version="1.0" encoding="UTF-8" ?>
<!-- Generato da DoFlow Sitebuilder — ${now} -->
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
  <title>${escapeXml(payload.siteTitle)}</title>
  <link>https://${payload.siteDomain}</link>
  <description>${escapeXml(payload.businessType)}</description>
  <pubDate>${now}</pubDate>
  <language>${payload.locale}</language>
  <wp:wxr_version>1.2</wp:wxr_version>
  <wp:base_site_url>https://${payload.siteDomain}</wp:base_site_url>
  <wp:base_blog_url>https://${payload.siteDomain}</wp:base_blog_url>
  <wp:author>
    <wp:author_id>1</wp:author_id>
    <wp:author_login><![CDATA[admin]]></wp:author_login>
    <wp:author_email><![CDATA[${payload.adminEmail}]]></wp:author_email>
    <wp:author_display_name><![CDATA[Admin]]></wp:author_display_name>
    <wp:author_first_name><![CDATA[]]></wp:author_first_name>
    <wp:author_last_name><![CDATA[]]></wp:author_last_name>
  </wp:author>
${items}
</channel>
</rss>`;

    await fs.writeFile(path.join(wpDir, 'wordpress-import.xml'), wxr, 'utf8');
  }

  private async generateReadme(deployDir: string, payload: SitebuilderJobPayload): Promise<void> {
    const readme = `# ${payload.siteTitle} — Installazione WordPress

Generato da DoFlow Sitebuilder il ${new Date().toLocaleDateString('it-IT')}

## Contenuto dello ZIP

- \`wordpress/\` — Installazione WordPress completa
- \`wordpress/wp-content/themes/blocksy/\` — Tema Blocksy
- \`wordpress/wp-content/plugins/blocksy-companion-pro/\` — Plugin Companion Pro
- \`wordpress/wp-content/uploads/sitebuilder/\` — Immagini
- \`wordpress/wordpress-import.xml\` — Pagine da importare
- \`wordpress/wp-config.php\` — Configurazione (da completare)

## Istruzioni SiteGround

### 1. Carica i file
File Manager → carica il contenuto di \`wordpress/\` in \`public_html/\`.

### 2. Crea il database
Databases → MySQL Databases → crea DB + utente → assegna privilegi.

### 3. Configura wp-config.php
Sostituisci: \`YOUR_DB_NAME\`, \`YOUR_DB_USER\`, \`YOUR_DB_PASSWORD\`.

### 4. Installa WordPress
Visita \`https://${payload.siteDomain}/wp-admin/install.php\`.

### 5. Importa le pagine
Strumenti → Importa → WordPress Importer → importa \`wordpress-import.xml\`.

### 6. Attiva tema e plugin
- Aspetto → Temi → Attiva **Blocksy**
- Plugin → Attiva **Blocksy Companion Pro**
- Segui la procedura guidata → starter site: **${payload.starterSite}**

### 7. Imposta Homepage
Impostazioni → Lettura → Pagina statica → Home.

---
*Generato da DoFlow Sitebuilder AI*
`;

    await fs.writeFile(path.join(deployDir, 'LEGGIMI.md'), readme, 'utf8');
    await fs.writeFile(path.join(deployDir, 'wordpress', 'LEGGIMI.md'), readme, 'utf8');
  }

  // ════════════════════════════════════════════════════════════════════
  //  ROLLBACK
  // ════════════════════════════════════════════════════════════════════
  @OnWorkerEvent('failed')
  async onFailed(job: Job<SitebuilderJobPayload>, error: Error): Promise<void> {
    const { jobId } = job.data;
    const isLast    = job.attemptsMade >= (job.opts.attempts ?? 1);

    this.logger.error(`[${jobId}] Fallito (attempt ${job.attemptsMade}): ${error.message}`);
    await this.appendLog(jobId, `ERRORE (attempt ${job.attemptsMade}): ${error.message}`);

    if (isLast) {
      try {
        await fs.rm(path.join(this.deploymentsRoot, jobId), { recursive: true, force: true });
      } catch { /* ignora */ }
      await this.jobRepo.update(jobId, { status: SitebuilderJobStatus.ROLLED_BACK });
    }
  }

  // ════════════════════════════════════════════════════════════════════
  //  UTILITY
  // ════════════════════════════════════════════════════════════════════

  /** Estrae tutto il testo dal response di Anthropic (type-safe, senza dipendenza dai tipi SDK) */
  private extractText(message: Anthropic.Message): string {
    return (message.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
  }

  private async patchStatus(
    jobId: string,
    status: SitebuilderJobStatus,
    additionalLogs: string[] = [],
  ): Promise<void> {
    const entity  = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
    entity.status = status;
    entity.logs   = [...entity.logs, ...additionalLogs];
    await this.jobRepo.save(entity);
  }

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