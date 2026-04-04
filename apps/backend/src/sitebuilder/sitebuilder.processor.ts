// apps/backend/src/sitebuilder/sitebuilder.processor.ts
// Architettura v2 — niente Docker, scarica WP reale, genera WXR XML, usa Unsplash

import { Logger } from '@nestjs/common';
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
import { pipeline } from 'stream/promises';
import { createUnzip } from 'zlib';
import { spawn } from 'child_process';

import { SitebuilderJob, SitebuilderJobStatus } from './sitebuilder.entity';
import { SITEBUILDER_QUEUE } from './sitebuilder.constants';
import { SitebuilderJobPayload } from './sitebuilder.producer.service';

// ─────────────────────────────────────────────
//  Helper: download file via HTTP/HTTPS
// ─────────────────────────────────────────────
function downloadFile(url: string, destPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file = createWriteStream(destPath);
    const protocol = url.startsWith('https') ? https : http;

    const request = protocol.get(url, (response) => {
      // Segui i redirect
      if (response.statusCode === 301 || response.statusCode === 302) {
        file.close();
        fsSync.unlinkSync(destPath);
        return downloadFile(response.headers.location!, destPath)
          .then(resolve)
          .catch(reject);
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
    file.on('error', (err) => { file.close(); reject(err); });
  });
}

// ─────────────────────────────────────────────
//  Helper: unzip tramite spawn (unzip è già nel container)
// ─────────────────────────────────────────────
function unzipFile(zipPath: string, destDir: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('unzip', ['-q', '-o', zipPath, '-d', destDir], { shell: false });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`unzip failed exit ${code}`));
      else resolve();
    });
  });
}

// ─────────────────────────────────────────────
//  Helper: zip directory
// ─────────────────────────────────────────────
function zipDirectory(sourceDir: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn('zip', ['-r', '-q', outputPath, '.'], {
      cwd: sourceDir,
      shell: false,
    });
    proc.on('error', reject);
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(`zip failed exit ${code}`));
      else resolve();
    });
  });
}

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
interface BrickContent {
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

interface SitePage {
  slug: string;
  title: string;
  bricks: BrickContent[];
}

// ─────────────────────────────────────────────
//  Processor
// ─────────────────────────────────────────────
@Processor(SITEBUILDER_QUEUE)
export class SitebuilderProcessor extends WorkerHost {
  private readonly logger = new Logger(SitebuilderProcessor.name);
  private readonly anthropic: Anthropic;
  private readonly deploymentsRoot: string;
  private readonly unsplashKey: string;
  private readonly pluginAssetPath: string;

  constructor(
    @InjectRepository(SitebuilderJob)
    private readonly jobRepo: Repository<SitebuilderJob>,
    private readonly config: ConfigService,
  ) {
    super();
    this.anthropic = new Anthropic({
      apiKey: config.get<string>('ANTHROPIC_API_KEY') ?? '',
    });
    this.deploymentsRoot = path.resolve(
      config.get<string>('SITEBUILDER_DEPLOYMENTS_PATH', './deployments'),
    );
    this.unsplashKey = config.get<string>('UNSPLASH_ACCESS_KEY') ?? '';
    // blocksy-companion-pro.zip deve stare in apps/backend/src/sitebuilder/assets/
    this.pluginAssetPath = path.join(__dirname, 'assets', 'blocksy-companion-pro.zip');
  }

  // ════════════════════════════════════════════
  //  ENTRY POINT
  // ════════════════════════════════════════════
  async process(job: Job<SitebuilderJobPayload>): Promise<void> {
    const payload = job.data;
    const { jobId, siteDomain } = payload;

    this.logger.log(`[${jobId}] Inizio elaborazione v2 — attempt #${job.attemptsMade + 1}`);

    await this.patchStatus(jobId, SitebuilderJobStatus.RUNNING, [
      `[attempt #${job.attemptsMade + 1}] Avvio build per: ${siteDomain}`,
    ]);

    const deployDir = path.join(this.deploymentsRoot, jobId);
    const wpDir    = path.join(deployDir, 'wordpress');

    // Cleanup attempt precedente se retry
    if (job.attemptsMade > 0) {
      await this.appendLog(jobId, 'Cleanup attempt precedente...');
      await fs.rm(deployDir, { recursive: true, force: true });
    }

    await fs.mkdir(deployDir, { recursive: true });

    // ─ Step 1: Scarica WordPress ────────────────────────────────────
    await this.appendLog(jobId, 'Download WordPress italiano...');
    await this.downloadWordPress(deployDir, wpDir);

    // ─ Step 2: Installa tema Blocksy ────────────────────────────────
    await this.appendLog(jobId, 'Download e installazione tema Blocksy...');
    await this.installBlocksyTheme(deployDir, wpDir);

    // ─ Step 3: Installa Blocksy Companion Pro ───────────────────────
    await this.appendLog(jobId, 'Installazione Blocksy Companion Pro...');
    await this.installBlocksyCompanionPro(deployDir, wpDir);

    // ─ Step 4: Genera struttura sito con LLM ────────────────────────
    await this.appendLog(jobId, 'Generazione struttura sito con AI...');
    const pages = await this.generateSiteStructure(payload);
    await this.appendLog(jobId, `Struttura generata: ${pages.length} pagine.`);

    // ─ Step 5: Genera contenuti per ogni pagina ─────────────────────
    await this.appendLog(jobId, 'Generazione contenuti con AI...');
    const pagesWithContent = await this.generatePageContents(payload, pages, jobId);

    // ─ Step 6: Scarica immagini da Unsplash ─────────────────────────
    await this.appendLog(jobId, 'Download immagini da Unsplash...');
    await this.downloadImages(pagesWithContent, wpDir, jobId);

    // ─ Step 7: Crea wp-config.php con placeholder ───────────────────
    await this.appendLog(jobId, 'Creazione wp-config.php...');
    await this.createWpConfig(wpDir, payload);

    // ─ Step 8: Genera WXR (WordPress Export XML) ────────────────────
    await this.appendLog(jobId, 'Generazione file di importazione WordPress...');
    await this.generateWXR(wpDir, pagesWithContent, payload);

    // ─ Step 9: Genera README con istruzioni ─────────────────────────
    await this.generateReadme(deployDir, payload);

    // ─ Step 10: ZIP dell'intera cartella ────────────────────────────
    await this.appendLog(jobId, 'Creazione archivio ZIP...');
    const zipPath = path.join(deployDir, `${jobId}.zip`);
    await zipDirectory(wpDir, zipPath);

    const zipSize = (await fs.stat(zipPath)).size;
    await this.appendLog(jobId, `ZIP creato: ${(zipSize / 1024 / 1024).toFixed(1)} MB`);

    // ─ Step 11: DONE ────────────────────────────────────────────────
    await this.jobRepo.update(jobId, {
      status:      SitebuilderJobStatus.DONE,
      zipFilename: `${jobId}.zip`,
      siteUrl:     `https://${payload.siteDomain}`,
    });

    this.logger.log(`[${jobId}] Build completata ✓`);
    await this.appendLog(jobId, `✓ Sito completato! Scarica lo ZIP e importalo su SiteGround.`);
  }

  // ════════════════════════════════════════════
  //  STEP IMPLEMENTATIONS
  // ════════════════════════════════════════════

  // ── Step 1: Download WordPress ────────────────────────────────────
  private async downloadWordPress(deployDir: string, wpDir: string): Promise<void> {
    const locale  = 'it_IT';
    const wpUrl   = `https://it.wordpress.org/latest-${locale}.zip`;
    const zipPath = path.join(deployDir, 'wordpress.zip');

    await downloadFile(wpUrl, zipPath);
    await unzipFile(zipPath, deployDir);

    // wordpress.org estrae in una cartella chiamata "wordpress/"
    // che è già la nostra wpDir — verifica
    const extracted = path.join(deployDir, 'wordpress');
    try {
      await fs.access(extracted);
    } catch {
      throw new Error('Estrazione WordPress fallita: cartella wordpress/ non trovata');
    }

    await fs.unlink(zipPath);
  }

  // ── Step 2: Installa tema Blocksy ─────────────────────────────────
  private async installBlocksyTheme(deployDir: string, wpDir: string): Promise<void> {
    // Scarica Blocksy free dall'API ufficiale di wordpress.org
    const apiUrl  = 'https://api.wordpress.org/themes/info/1.2/?action=theme_information&request[slug]=blocksy';
    const zipPath = path.join(deployDir, 'blocksy-theme.zip');
    const themesDir = path.join(wpDir, 'wp-content', 'themes');

    // Fetch info tema per ottenere download URL
    const infoRes = await fetch(apiUrl);
    const info = await infoRes.json() as { download_link?: string };
    const downloadUrl = info.download_link ?? 'https://downloads.wordpress.org/theme/blocksy.latest-stable.zip';

    await downloadFile(downloadUrl, zipPath);
    await unzipFile(zipPath, themesDir);
    await fs.unlink(zipPath);
  }

  // ── Step 3: Installa Blocksy Companion Pro ────────────────────────
  private async installBlocksyCompanionPro(deployDir: string, wpDir: string): Promise<void> {
    const pluginsDir = path.join(wpDir, 'wp-content', 'plugins');
    await fs.mkdir(pluginsDir, { recursive: true });

    // Controlla che il plugin esista nell'assets del backend
    try {
      await fs.access(this.pluginAssetPath);
    } catch {
      this.logger.warn(`[SitebuilderProcessor] Blocksy Companion Pro non trovato in ${this.pluginAssetPath}, skip.`);
      return;
    }

    await unzipFile(this.pluginAssetPath, pluginsDir);
  }

  // ── Step 4: Genera struttura sito (brick schema) ──────────────────
  private async generateSiteStructure(payload: SitebuilderJobPayload): Promise<SitePage[]> {
    const businessInfo = payload.businessDescription
      ? `Descrizione: ${payload.businessDescription}`
      : `Tipo di business: ${payload.businessType}`;

    const message = await this.anthropic.messages.create({
      model:      'claude-sonnet-4-6',
      max_tokens: 1024,
      system: `**Ruolo:** Sei un Senior WordPress Architect specializzato in architettura informativa.

**Obiettivo:** Genera la struttura JSON delle pagine per un sito WordPress.

**Vincoli:**
- OUTPUT ESCLUSIVO: solo JSON puro. Primo carattere {, ultimo }.
- Nessun markdown, nessun testo, nessun backtick.
- Usa solo questi tipi di brick: hero, features, about, services, gallery, testimonials, team, faq, contact, cta, stats, pricing.
- Max 3-5 pagine, 2-4 brick per pagina.
- Lingue supportate: ${payload.locale}

**Formato output:**
{"pages": [{"slug": "home", "title": "Home", "bricks": [{"type": "hero"}, {"type": "features"}]}]}`,
      messages: [{
        role:    'user',
        content: `Crea la struttura per questo sito:
Titolo: ${payload.siteTitle}
${businessInfo}
Tema starter: ${payload.starterSite}
Sezioni richieste: ${payload.contentTopics.join(', ')}
Lingua: ${payload.locale}`,
      }],
    });

    const raw = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text).join('')
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    const parsed = JSON.parse(raw) as { pages: SitePage[] };
    return parsed.pages;
  }

  // ── Step 5: Genera contenuto per ogni brick ───────────────────────
  private async generatePageContents(
    payload: SitebuilderJobPayload,
    pages: SitePage[],
    jobId: string,
  ): Promise<SitePage[]> {
    const businessInfo = payload.businessDescription || `${payload.businessType} - ${payload.siteTitle}`;
    const result: SitePage[] = [];

    for (const page of pages) {
      await this.appendLog(jobId, `Generazione contenuto pagina "${page.title}"...`);
      const bricksWithContent: BrickContent[] = [];

      for (const brick of page.bricks) {
        const message = await this.anthropic.messages.create({
          model:      'claude-sonnet-4-6',
          max_tokens: 1024,
          system: `**Ruolo:** Sei un Senior Copywriter specializzato in siti web WordPress.

**Obiettivo:** Genera il contenuto testuale per un singolo blocco (brick) di una pagina WordPress.

**Vincoli ASSOLUTI:**
- OUTPUT ESCLUSIVO: solo JSON puro. Primo carattere {, ultimo }.
- Nessun markdown, nessun testo, nessun backtick.
- Usa SOLO apici singoli DENTRO le stringhe HTML, mai doppie virgolette.
- Lingua: ${payload.locale}
- Testi brevi, efficaci, professionali.

**Formato output per brick tipo "${brick.type}":**
${this.getBrickSchema(brick.type)}`,
          messages: [{
            role: 'user',
            content: `Genera il contenuto per il brick "${brick.type}" della pagina "${page.title}".
Business: ${businessInfo}
Sito: ${payload.siteTitle}
Lingua: ${payload.locale}`,
          }],
        });

        const raw = message.content
          .filter((b): b is Anthropic.TextBlock => b.type === 'text')
          .map((b) => b.text).join('')
          .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

        try {
          const content = JSON.parse(raw) as BrickContent;
          bricksWithContent.push({ ...brick, ...content });
        } catch {
          this.logger.warn(`[${jobId}] Parse fallito per brick ${brick.type}, uso fallback`);
          bricksWithContent.push({ ...brick, headline: page.title, body: payload.businessType });
        }
      }

      result.push({ ...page, bricks: bricksWithContent });
    }

    return result;
  }

  // ── Step 6: Download immagini Unsplash ────────────────────────────
  private async downloadImages(
    pages: SitePage[],
    wpDir: string,
    jobId: string,
  ): Promise<void> {
    if (!this.unsplashKey) {
      this.logger.warn(`[${jobId}] UNSPLASH_ACCESS_KEY non configurata, skip immagini.`);
      return;
    }

    const uploadsDir = path.join(wpDir, 'wp-content', 'uploads', 'sitebuilder');
    await fs.mkdir(uploadsDir, { recursive: true });

    for (const page of pages) {
      for (const brick of page.bricks) {
        if (!brick.image_query) continue;

        try {
          const query = encodeURIComponent(brick.image_query);
          const apiUrl = `https://api.unsplash.com/photos/random?query=${query}&orientation=landscape&content_filter=high`;
          const res = await fetch(apiUrl, {
            headers: { Authorization: `Client-ID ${this.unsplashKey}` },
          });

          if (!res.ok) {
            this.logger.warn(`[${jobId}] Unsplash error ${res.status} per "${brick.image_query}"`);
            continue;
          }

          const data = await res.json() as {
            urls: { regular: string };
            user: { name: string };
          };

          const imgUrl  = data.urls.regular;
          const safeSlug = `${page.slug}-${brick.type}`.replace(/[^a-z0-9-]/g, '-');
          const imgPath  = path.join(uploadsDir, `${safeSlug}.jpg`);

          await downloadFile(imgUrl, imgPath);
          brick.imageUrl = `/wp-content/uploads/sitebuilder/${safeSlug}.jpg`;
          await this.appendLog(jobId, `✓ Immagine: ${safeSlug}.jpg`);
        } catch (err) {
          this.logger.warn(`[${jobId}] Errore download immagine "${brick.image_query}": ${String(err)}`);
        }
      }
    }
  }

  // ── Step 7: Crea wp-config.php ────────────────────────────────────
  private async createWpConfig(wpDir: string, payload: SitebuilderJobPayload): Promise<void> {
    const samplePath = path.join(wpDir, 'wp-config-sample.php');
    const configPath = path.join(wpDir, 'wp-config.php');

    let sample = await fs.readFile(samplePath, 'utf8');

    // Sostituisce i placeholder con valori SiteGround standard
    sample = sample
      .replace("define( 'DB_NAME', 'database_name_here' );",     "define( 'DB_NAME', 'YOUR_DB_NAME' );")
      .replace("define( 'DB_USER', 'username_here' );",           "define( 'DB_USER', 'YOUR_DB_USER' );")
      .replace("define( 'DB_PASSWORD', 'password_here' );",       "define( 'DB_PASSWORD', 'YOUR_DB_PASSWORD' );")
      .replace("define( 'DB_HOST', 'localhost' );",               "define( 'DB_HOST', 'localhost' );")
      .replace("define( 'DB_CHARSET', 'utf8' );",                 "define( 'DB_CHARSET', 'utf8mb4' );")
      .replace("$table_prefix = 'wp_';",                          `$table_prefix = 'wp_';`);

    // Aggiunge le chiavi di sicurezza (placeholder)
    const keys = [
      'AUTH_KEY', 'SECURE_AUTH_KEY', 'LOGGED_IN_KEY', 'NONCE_KEY',
      'AUTH_SALT', 'SECURE_AUTH_SALT', 'LOGGED_IN_SALT', 'NONCE_SALT',
    ];
    for (const key of keys) {
      const random = Array.from({ length: 64 }, () =>
        'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}|;:,.<>?'[
          Math.floor(Math.random() * 88)
        ],
      ).join('');
      sample = sample.replace(`put your unique phrase here`, random);
    }

    await fs.writeFile(configPath, sample, 'utf8');
  }

  // ── Step 8: Genera WXR (WordPress eXtended RSS) ───────────────────
  private async generateWXR(
    wpDir: string,
    pages: SitePage[],
    payload: SitebuilderJobPayload,
  ): Promise<void> {
    const now     = new Date().toUTCString();
    const pubDate = new Date().toUTCString();

    const items = pages.map((page, index) => {
      const gutenbergHtml = this.bricksToGutenberg(page.bricks, payload);
      const postId = index + 2; // 1 è solitamente la Sample Page default

      return `
  <item>
    <title>${this.escapeXml(page.title)}</title>
    <link>https://${payload.siteDomain}/${page.slug}/</link>
    <pubDate>${pubDate}</pubDate>
    <dc:creator><![CDATA[admin]]></dc:creator>
    <guid isPermaLink="false">https://${payload.siteDomain}/?page_id=${postId}</guid>
    <description></description>
    <content:encoded><![CDATA[${gutenbergHtml}]]></content:encoded>
    <excerpt:encoded><![CDATA[]]></excerpt:encoded>
    <wp:post_id>${postId}</wp:post_id>
    <wp:post_date><![CDATA[${new Date().toISOString().replace('T', ' ').substring(0, 19)}]]></wp:post_date>
    <wp:post_date_gmt><![CDATA[${new Date().toISOString().replace('T', ' ').substring(0, 19)}]]></wp:post_date_gmt>
    <wp:comment_status><![CDATA[closed]]></wp:comment_status>
    <wp:ping_status><![CDATA[closed]]></wp:ping_status>
    <wp:post_name><![CDATA[${page.slug}]]></wp:post_name>
    <wp:status><![CDATA[publish]]></wp:status>
    <wp:post_parent>0</wp:post_parent>
    <wp:menu_order>${index}</wp:menu_order>
    <wp:post_type><![CDATA[page]]></wp:post_type>
    <wp:post_password><![CDATA[]]></wp:post_password>
    <wp:is_sticky>0</wp:is_sticky>
  </item>`;
    }).join('\n');

    const wxr = `<?xml version="1.0" encoding="UTF-8" ?>
<!-- Generato da DoFlow Sitebuilder — ${now} -->
<!-- Importa questo file in WordPress: Strumenti → Importa → WordPress -->
<rss version="2.0"
  xmlns:excerpt="http://wordpress.org/export/1.2/excerpt/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:wfw="http://wellformedweb.org/CommentAPI/"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:wp="http://wordpress.org/export/1.2/"
>
<channel>
  <title>${this.escapeXml(payload.siteTitle)}</title>
  <link>https://${payload.siteDomain}</link>
  <description>${this.escapeXml(payload.businessType)}</description>
  <pubDate>${pubDate}</pubDate>
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

    const xmlPath = path.join(wpDir, 'wordpress-import.xml');
    await fs.writeFile(xmlPath, wxr, 'utf8');
  }

  // ── Step 9: README con istruzioni ────────────────────────────────
  private async generateReadme(deployDir: string, payload: SitebuilderJobPayload): Promise<void> {
    const readme = `# ${payload.siteTitle} — Installazione WordPress

Generato da DoFlow Sitebuilder il ${new Date().toLocaleDateString('it-IT')}

## Contenuto dello ZIP

- \`wordpress/\` — Installazione WordPress completa
- \`wordpress/wp-content/themes/blocksy/\` — Tema Blocksy (già incluso)
- \`wordpress/wp-content/plugins/blocksy-companion-pro/\` — Plugin Companion Pro
- \`wordpress/wp-content/uploads/sitebuilder/\` — Immagini generate
- \`wordpress/wordpress-import.xml\` — Pagine da importare
- \`wordpress/wp-config.php\` — Configurazione (da completare)

## Istruzioni SiteGround

### 1. Carica i file
Vai in **File Manager** su SiteGround e carica il contenuto della cartella \`wordpress/\`
nella cartella \`public_html/\` (o sottocartella desiderata).

### 2. Crea il database
In **Databases → MySQL Databases** crea:
- Un nuovo database
- Un utente MySQL
- Assegna l'utente al database con tutti i privilegi

### 3. Configura wp-config.php
Modifica \`wp-config.php\` e sostituisci:
\`\`\`
YOUR_DB_NAME     → nome del database creato
YOUR_DB_USER     → nome dell'utente MySQL
YOUR_DB_PASSWORD → password dell'utente MySQL
\`\`\`

### 4. Installa WordPress
Visita \`https://${payload.siteDomain}/wp-admin/install.php\` e completa l'installazione.

### 5. Importa le pagine
1. Nel pannello WordPress vai in **Strumenti → Importa**
2. Installa e attiva il plugin "WordPress Importer"
3. Importa il file \`wordpress-import.xml\`

### 6. Attiva tema e plugin
1. Vai in **Aspetto → Temi** → Attiva **Blocksy**
2. Vai in **Plugin** → Attiva **Blocksy Companion Pro**
3. Segui la procedura guidata di Blocksy per selezionare il starter site: **${payload.starterSite}**

### 7. Imposta la Homepage
Vai in **Impostazioni → Lettura** → seleziona "Una pagina statica" → scegli la pagina Home.

---
*Generato automaticamente da DoFlow Sitebuilder AI*
`;

    await fs.writeFile(path.join(deployDir, 'LEGGIMI.md'), readme, 'utf8');
    await fs.writeFile(path.join(path.join(deployDir, 'wordpress'), 'LEGGIMI.md'), readme, 'utf8');
  }

  // ════════════════════════════════════════════
  //  HELPER: Bricks → Gutenberg HTML
  // ════════════════════════════════════════════
  private bricksToGutenberg(bricks: BrickContent[], payload: SitebuilderJobPayload): string {
    return bricks.map((brick) => {
      switch (brick.type) {
        case 'hero':
          return `<!-- wp:group {"align":"full","className":"wp-block-hero","style":{"spacing":{"padding":{"top":"80px","bottom":"80px"}}}} -->
<div class='wp-block-group alignfull wp-block-hero'>
<!-- wp:heading {"level":1,"textAlign":"center"} --><h1 class='wp-block-heading has-text-align-center'>${brick.headline ?? payload.siteTitle}</h1><!-- /wp:heading -->
<!-- wp:paragraph {"align":"center"} --><p class='has-text-align-center'>${brick.subheadline ?? ''}</p><!-- /wp:paragraph -->
${brick.cta_text ? `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} --><div class='wp-block-buttons'><!-- wp:button --><div class='wp-block-button'><a class='wp-block-button__link' href='${brick.cta_url ?? '#'}'>${brick.cta_text}</a></div><!-- /wp:button --></div><!-- /wp:buttons -->` : ''}
${brick.imageUrl ? `<!-- wp:image {"align":"center","sizeSlug":"large"} --><figure class='wp-block-image aligncenter size-large'><img src='${brick.imageUrl}' alt='${brick.headline ?? ''}'/></figure><!-- /wp:image -->` : ''}
</div><!-- /wp:group -->`;

        case 'features':
        case 'services':
          return `<!-- wp:group {"align":"wide","className":"wp-block-features"} -->
<div class='wp-block-group alignwide wp-block-features'>
<!-- wp:heading {"textAlign":"center"} --><h2 class='wp-block-heading has-text-align-center'>${brick.headline ?? 'Servizi'}</h2><!-- /wp:heading -->
<!-- wp:paragraph {"align":"center"} --><p class='has-text-align-center'>${brick.subheadline ?? ''}</p><!-- /wp:paragraph -->
<!-- wp:columns -->
<div class='wp-block-columns'>
${(brick.items ?? []).map((item) => `<!-- wp:column -->
<div class='wp-block-column'>
<!-- wp:heading {"level":3} --><h3 class='wp-block-heading'>${item.title}</h3><!-- /wp:heading -->
<!-- wp:paragraph --><p>${item.description}</p><!-- /wp:paragraph -->
</div><!-- /wp:column -->`).join('\n')}
</div><!-- /wp:columns -->
</div><!-- /wp:group -->`;

        case 'about':
          return `<!-- wp:group {"align":"wide","className":"wp-block-about"} -->
<div class='wp-block-group alignwide wp-block-about'>
<!-- wp:columns {"verticalAlignment":"center"} -->
<div class='wp-block-columns are-vertically-aligned-center'>
<!-- wp:column -->
<div class='wp-block-column'>
<!-- wp:heading --><h2 class='wp-block-heading'>${brick.headline ?? 'Chi Siamo'}</h2><!-- /wp:heading -->
<!-- wp:paragraph --><p>${brick.body ?? brick.subheadline ?? ''}</p><!-- /wp:paragraph -->
</div><!-- /wp:column -->
${brick.imageUrl ? `<!-- wp:column -->
<div class='wp-block-column'>
<!-- wp:image {"sizeSlug":"large"} --><figure class='wp-block-image size-large'><img src='${brick.imageUrl}' alt=''/></figure><!-- /wp:image -->
</div><!-- /wp:column -->` : ''}
</div><!-- /wp:columns -->
</div><!-- /wp:group -->`;

        case 'testimonials':
          return `<!-- wp:group {"align":"wide","className":"wp-block-testimonials"} -->
<div class='wp-block-group alignwide wp-block-testimonials'>
<!-- wp:heading {"textAlign":"center"} --><h2 class='wp-block-heading has-text-align-center'>${brick.headline ?? 'Testimonianze'}</h2><!-- /wp:heading -->
<!-- wp:columns -->
<div class='wp-block-columns'>
${(brick.items ?? []).slice(0, 3).map((item) => `<!-- wp:column -->
<div class='wp-block-column'>
<!-- wp:quote --><blockquote class='wp-block-quote'><p>${item.description}</p><cite>${item.title}</cite></blockquote><!-- /wp:quote -->
</div><!-- /wp:column -->`).join('\n')}
</div><!-- /wp:columns -->
</div><!-- /wp:group -->`;

        case 'faq':
          return `<!-- wp:group {"align":"wide","className":"wp-block-faq"} -->
<div class='wp-block-group alignwide wp-block-faq'>
<!-- wp:heading {"textAlign":"center"} --><h2 class='wp-block-heading has-text-align-center'>${brick.headline ?? 'FAQ'}</h2><!-- /wp:heading -->
${(brick.items ?? []).map((item) => `<!-- wp:details -->
<details class='wp-block-details'><summary>${item.title}</summary><p>${item.description}</p></details>
<!-- /wp:details -->`).join('\n')}
</div><!-- /wp:group -->`;

        case 'contact':
          return `<!-- wp:group {"align":"wide","className":"wp-block-contact"} -->
<div class='wp-block-group alignwide wp-block-contact'>
<!-- wp:heading {"textAlign":"center"} --><h2 class='wp-block-heading has-text-align-center'>${brick.headline ?? 'Contatti'}</h2><!-- /wp:heading -->
<!-- wp:paragraph {"align":"center"} --><p class='has-text-align-center'>${brick.subheadline ?? brick.body ?? ''}</p><!-- /wp:paragraph -->
<!-- wp:shortcode -->[contact-form-7 id='1' title='Modulo di contatto 1']<!-- /wp:shortcode -->
</div><!-- /wp:group -->`;

        case 'cta':
          return `<!-- wp:group {"align":"full","className":"wp-block-cta","style":{"spacing":{"padding":{"top":"60px","bottom":"60px"}},"color":{"background":"#f8f8f8"}}} -->
<div class='wp-block-group alignfull wp-block-cta' style='background-color:#f8f8f8;padding-top:60px;padding-bottom:60px'>
<!-- wp:heading {"textAlign":"center"} --><h2 class='wp-block-heading has-text-align-center'>${brick.headline ?? ''}</h2><!-- /wp:heading -->
<!-- wp:paragraph {"align":"center"} --><p class='has-text-align-center'>${brick.subheadline ?? ''}</p><!-- /wp:paragraph -->
${brick.cta_text ? `<!-- wp:buttons {"layout":{"type":"flex","justifyContent":"center"}} --><div class='wp-block-buttons'><!-- wp:button {"backgroundColor":"primary"} --><div class='wp-block-button'><a class='wp-block-button__link has-primary-background-color has-background' href='${brick.cta_url ?? '#'}'>${brick.cta_text}</a></div><!-- /wp:button --></div><!-- /wp:buttons -->` : ''}
</div><!-- /wp:group -->`;

        case 'stats':
          return `<!-- wp:group {"align":"wide","className":"wp-block-stats"} -->
<div class='wp-block-group alignwide wp-block-stats'>
<!-- wp:columns -->
<div class='wp-block-columns'>
${(brick.items ?? []).slice(0, 4).map((item) => `<!-- wp:column {"textColor":"primary"} -->
<div class='wp-block-column'>
<!-- wp:heading {"textAlign":"center","level":3} --><h3 class='wp-block-heading has-text-align-center'>${item.title}</h3><!-- /wp:heading -->
<!-- wp:paragraph {"align":"center"} --><p class='has-text-align-center'>${item.description}</p><!-- /wp:paragraph -->
</div><!-- /wp:column -->`).join('\n')}
</div><!-- /wp:columns -->
</div><!-- /wp:group -->`;

        case 'gallery':
          return `<!-- wp:gallery {"columns":3,"linkTo":"none","align":"wide"} -->
<figure class='wp-block-gallery alignwide has-nested-images columns-3'>
${brick.imageUrl ? `<!-- wp:image {"sizeSlug":"large"} --><figure class='wp-block-image size-large'><img src='${brick.imageUrl}' alt='Gallery'/></figure><!-- /wp:image -->` : ''}
</figure><!-- /wp:gallery -->`;

        default:
          return `<!-- wp:paragraph --><p>${brick.headline ?? brick.body ?? ''}</p><!-- /wp:paragraph -->`;
      }
    }).join('\n\n');
  }

  // ── Schema JSON per ogni tipo di brick ────────────────────────────
  private getBrickSchema(type: string): string {
    const schemas: Record<string, string> = {
      hero:         '{"type":"hero","headline":"...","subheadline":"...","cta_text":"...","cta_url":"#","image_query":"keyword per ricerca immagine su Unsplash"}',
      features:     '{"type":"features","headline":"...","subheadline":"...","items":[{"title":"...","description":"..."}],"image_query":"..."}',
      services:     '{"type":"services","headline":"...","subheadline":"...","items":[{"title":"...","description":"..."}]}',
      about:        '{"type":"about","headline":"...","body":"...","image_query":"keyword per Unsplash"}',
      testimonials: '{"type":"testimonials","headline":"...","items":[{"title":"Nome Cliente","description":"Testo testimonianza"}]}',
      team:         '{"type":"team","headline":"...","items":[{"title":"Nome Cognome","description":"Ruolo"}]}',
      faq:          '{"type":"faq","headline":"...","items":[{"title":"Domanda?","description":"Risposta."}]}',
      contact:      '{"type":"contact","headline":"...","subheadline":"...","body":"..."}',
      cta:          '{"type":"cta","headline":"...","subheadline":"...","cta_text":"...","cta_url":"#"}',
      stats:        '{"type":"stats","items":[{"title":"100+","description":"Clienti"}]}',
      gallery:      '{"type":"gallery","headline":"...","image_query":"keyword per Unsplash"}',
      pricing:      '{"type":"pricing","headline":"...","items":[{"title":"Piano","description":"Prezzo e descrizione"}]}',
    };
    return schemas[type] ?? '{"type":"' + type + '","headline":"...","body":"..."}';
  }

  // ─── Escape XML ───────────────────────────────────────────────────
  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  // ════════════════════════════════════════════
  //  ROLLBACK
  // ════════════════════════════════════════════
  @OnWorkerEvent('failed')
  async onFailed(job: Job<SitebuilderJobPayload>, error: Error): Promise<void> {
    const { jobId } = job.data;
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);

    this.logger.error(`[${jobId}] Job fallito (attempt ${job.attemptsMade}): ${error.message}`);
    await this.appendLog(jobId, `ERRORE (attempt ${job.attemptsMade}): ${error.message}`);

    if (isLastAttempt) {
      const deployDir = path.join(this.deploymentsRoot, jobId);
      try {
        await fs.rm(deployDir, { recursive: true, force: true });
        this.logger.log(`[${jobId}] Cartella deployment rimossa.`);
      } catch { /* ignora */ }

      await this.jobRepo.update(jobId, {
        status: SitebuilderJobStatus.ROLLED_BACK,
      });
    }
  }

  // ════════════════════════════════════════════
  //  UTILITY
  // ════════════════════════════════════════════
  private async patchStatus(
    jobId: string,
    status: SitebuilderJobStatus,
    additionalLogs: string[] = [],
  ): Promise<void> {
    const entity = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
    entity.status = status;
    entity.logs   = [...entity.logs, ...additionalLogs];
    await this.jobRepo.save(entity);
  }

  private async appendLog(jobId: string, message: string): Promise<void> {
    const ts    = new Date().toISOString();
    const entry = `[${ts}] ${message}`;
    this.logger.debug(`[${jobId}] ${message}`);
    await this.jobRepo
      .createQueryBuilder()
      .update(SitebuilderJob)
      .set({ logs: () => `logs || :entry::jsonb` })
      .setParameter('entry', JSON.stringify([entry]))
      .where('id = :id', { id: jobId })
      .execute();
  }
}