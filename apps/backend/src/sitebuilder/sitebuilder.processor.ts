// apps/backend/src/sitebuilder/sitebuilder.processor.ts

import { Logger } from '@nestjs/common';
import {
  Processor,
  WorkerHost,
  OnWorkerEvent,
} from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Anthropic from '@anthropic-ai/sdk';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs/promises';
import * as path from 'path';
import { spawn, SpawnOptions } from 'child_process';

import {
  SitebuilderJob,
  SitebuilderJobStatus,
} from './sitebuilder.entity';
import { SITEBUILDER_QUEUE } from './sitebuilder.module';
import { SitebuilderJobPayload } from './sitebuilder.producer.service';

// ─────────────────────────────────────────────
//  Helper: wrappa spawn in una Promise tipizzata
// ─────────────────────────────────────────────
interface SpawnResult {
  stdout: string;
  stderr: string;
  code: number;
}

function spawnAsync(
  command: string,
  args: string[],
  options?: SpawnOptions,
): Promise<SpawnResult> {
  return new Promise((resolve, reject) => {
    const proc = spawn(command, args, { ...options, shell: false });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (chunk: Buffer) => { stdout += chunk.toString(); });
    proc.stderr?.on('data', (chunk: Buffer) => { stderr += chunk.toString(); });

    proc.on('error', (err) => reject(err));
    proc.on('close', (code) => {
      resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 1 });
    });
  });
}

// ─────────────────────────────────────────────
//  Helper: sleep
// ─────────────────────────────────────────────
const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

// ─────────────────────────────────────────────
//  Processor
// ─────────────────────────────────────────────
@Processor(SITEBUILDER_QUEUE)
export class SitebuilderProcessor extends WorkerHost {
  private readonly logger = new Logger(SitebuilderProcessor.name);
  private readonly anthropic: Anthropic;

  // Cartella root dove vengono creati i deployment
  // Usa un path assoluto in produzione; relativo in dev
  private readonly deploymentsRoot: string;

  constructor(
    @InjectRepository(SitebuilderJob)
    private readonly jobRepo: Repository<SitebuilderJob>,
    private readonly config: ConfigService,
  ) {
    super();
    this.anthropic = new Anthropic({
      apiKey: config.getOrThrow<string>('ANTHROPIC_API_KEY'),
    });
    this.deploymentsRoot = path.resolve(
      config.get<string>('SITEBUILDER_DEPLOYMENTS_PATH', './deployments'),
    );
  }

  // ════════════════════════════════════════════
  //  ENTRY POINT — chiamato da BullMQ per ogni job
  // ════════════════════════════════════════════
  async process(job: Job<SitebuilderJobPayload>): Promise<void> {
    const payload = job.data;
    const { jobId, siteDomain } = payload;

    this.logger.log(`[${jobId}] Inizio elaborazione — attempt #${job.attemptsMade + 1}`);

    // ─ Step 0: aggiorna stato → RUNNING ────────────────────────────
    await this.patchStatus(jobId, SitebuilderJobStatus.RUNNING, [
      `[attempt #${job.attemptsMade + 1}] Avvio job per dominio: ${siteDomain}`,
    ]);

    const deployDir = path.join(this.deploymentsRoot, jobId);

    // ─ Step 1: prepara la directory di deployment ───────────────────
    await this.appendLog(jobId, 'Creazione directory deployment...');
    await fs.mkdir(deployDir, { recursive: true });

    // ─ Step 2: genera il docker-compose.yml ────────────────────────
    await this.appendLog(jobId, 'Generazione docker-compose.yml...');
    await this.writeDockerCompose(deployDir, payload);

    // ─ Step 3: genera i contenuti con Anthropic ────────────────────
    await this.appendLog(jobId, 'Generazione contenuti Gutenberg con LLM...');
    const gutenbergBlocks = await this.generateGutenbergContent(payload);
    // Salva i blocchi in un file JSON nella dir per debug/audit
    await fs.writeFile(
      path.join(deployDir, 'gutenberg-blocks.json'),
      JSON.stringify(gutenbergBlocks, null, 2),
      'utf8',
    );
    await this.appendLog(jobId, `LLM: generati ${gutenbergBlocks.length} blocchi Gutenberg.`);

    // ─ Step 4: avvia i container Docker ────────────────────────────
    await this.appendLog(jobId, 'Avvio docker compose up -d...');
    await this.dockerComposeUp(deployDir, jobId);

    // ─ Step 5: wait-for-db (MariaDB ready) ─────────────────────────
    await this.appendLog(jobId, 'Attesa MariaDB ready...');
    await this.waitForMariaDB(deployDir, jobId, payload);

    // ─ Step 6: installa WP tramite WP-CLI ──────────────────────────
    await this.appendLog(jobId, 'Installazione WordPress...');
    await this.wpCliInstall(deployDir, jobId, payload);

    // ─ Step 7: installa tema Blocksy + plugin richiesti ─────────────
    await this.appendLog(jobId, 'Installazione tema Blocksy e plugin...');
    await this.wpCliInstallThemeAndPlugins(deployDir, jobId, payload);

    // ─ Step 8: inserisce i blocchi Gutenberg via WP-CLI ────────────
    await this.appendLog(jobId, 'Inserimento blocchi Gutenberg...');
    await this.wpCliInsertBlocks(deployDir, jobId, gutenbergBlocks, payload);

    // ─ Step 9: mark DONE ────────────────────────────────────────────
    const siteUrl = `https://${payload.siteDomain}`;
    await this.jobRepo.update(jobId, {
      status: SitebuilderJobStatus.DONE,
      siteUrl,
      logs: () => `logs || '["Sito creato con successo: ${siteUrl}"]'::jsonb`,
    });

    this.logger.log(`[${jobId}] Job completato — ${siteUrl}`);
  }

  // ════════════════════════════════════════════
  //  STEP IMPLEMENTATIONS
  // ════════════════════════════════════════════

  // ── 2. Docker Compose file ────────────────────────────────────────
  private async writeDockerCompose(
    deployDir: string,
    payload: SitebuilderJobPayload,
  ): Promise<void> {
    // Il nome dello stack usa solo il jobId (safe per Docker)
    const stackName = `sb-${payload.jobId.replace(/-/g, '').substring(0, 16)}`;
    const dbPassword = this.generateSafePassword();

    // Salva la password in un file separato con permessi 600
    await fs.writeFile(path.join(deployDir, '.db_password'), dbPassword, { mode: 0o600 });

    const compose = `# Auto-generated by DoFlow Sitebuilder — ${new Date().toISOString()}
# Stack: ${stackName}

version: "3.8"

services:
  db:
    image: mariadb:10.11
    container_name: ${stackName}-db
    restart: unless-stopped
    environment:
      MYSQL_ROOT_PASSWORD: "rootpwd_${stackName}"
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wpuser
      MYSQL_PASSWORD: "${dbPassword}"
    volumes:
      - db_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "healthcheck.sh", "--connect", "--innodb_initialized"]
      interval: 10s
      timeout: 5s
      retries: 10
      start_period: 30s

  wordpress:
    image: wordpress:6.5-apache
    container_name: ${stackName}-wp
    restart: unless-stopped
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "0:80"          # porta dinamica — il reverse proxy (Nginx/Traefik) si occupa del routing
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_DB_USER: wpuser
      WORDPRESS_DB_PASSWORD: "${dbPassword}"
      WORDPRESS_TABLE_PREFIX: wp_
    volumes:
      - wp_data:/var/www/html

  wpcli:
    image: wordpress:cli-2.10
    container_name: ${stackName}-cli
    depends_on:
      - wordpress
    volumes:
      - wp_data:/var/www/html
    environment:
      WORDPRESS_DB_HOST: db:3306
      WORDPRESS_DB_NAME: wordpress
      WORDPRESS_DB_USER: wpuser
      WORDPRESS_DB_PASSWORD: "${dbPassword}"
    user: "33:33"   # www-data
    entrypoint: tail
    command: ["-f", "/dev/null"]   # mantieni il container vivo per i comandi exec

volumes:
  db_data:
  wp_data:
`;
    await fs.writeFile(path.join(deployDir, 'docker-compose.yml'), compose, 'utf8');
  }

  // ── 3. Anthropic — genera blocchi Gutenberg ───────────────────────
  private async generateGutenbergContent(
    payload: SitebuilderJobPayload,
  ): Promise<GutenbergBlock[]> {
    const topicList = payload.contentTopics
      .map((t, i) => `${i + 1}. ${t}`)
      .join('\n');

    const systemPrompt = `Sei un esperto sviluppatore WordPress. Genera ESCLUSIVAMENTE codice HTML valido
compatibile con l'editor Gutenberg di WordPress per le sezioni elencate dall'utente.
Il tuo output deve essere un array JSON puro, senza alcun testo aggiuntivo, senza blocchi
markdown (niente triple backtick), senza spiegazioni.
Ogni elemento dell'array deve avere questa struttura:
{"topic": "<nome sezione>", "html": "<HTML del blocco Gutenberg>"}
Usa blocchi Gutenberg standard (<!-- wp:paragraph -->, <!-- wp:heading -->, <!-- wp:group -->, ecc.).
Il sito è in lingua: ${payload.locale}.
Il titolo del sito è: ${payload.siteTitle}.`;

    const userMessage = `Genera i blocchi Gutenberg per queste sezioni del sito "${payload.siteTitle}":\n${topicList}`;

    const message = await this.anthropic.messages.create({
      model: 'claude-3-7-sonnet-20250219',
      max_tokens: 8192,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    // Estrai il testo dalla risposta
    const rawText = message.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    // Rimuovi eventuali fence markdown residui prima del parse
    const cleanedText = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    const blocks = JSON.parse(cleanedText) as GutenbergBlock[];
    return blocks;
  }

  // ── 4. docker compose up ──────────────────────────────────────────
  private async dockerComposeUp(deployDir: string, jobId: string): Promise<void> {
    const result = await spawnAsync(
      'docker',
      ['compose', '-f', path.join(deployDir, 'docker-compose.yml'), 'up', '-d', '--remove-orphans'],
      { cwd: deployDir },
    );

    await this.appendLog(jobId, `docker compose up: ${result.stdout || result.stderr}`);

    if (result.code !== 0) {
      throw new Error(`docker compose up fallito (exit ${result.code}): ${result.stderr}`);
    }
  }

  // ── 5. Wait for MariaDB ───────────────────────────────────────────
  private async waitForMariaDB(
    deployDir: string,
    jobId: string,
    payload: SitebuilderJobPayload,
  ): Promise<void> {
    const stackName = `sb-${payload.jobId.replace(/-/g, '').substring(0, 16)}`;
    const MAX_RETRIES = 18;    // 18 × 10 s = 3 minuti max
    const RETRY_DELAY = 10_000;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const result = await spawnAsync(
        'docker',
        [
          'exec',
          `${stackName}-db`,
          'healthcheck.sh',
          '--connect',
          '--innodb_initialized',
        ],
      );

      if (result.code === 0) {
        await this.appendLog(jobId, `MariaDB ready dopo ${attempt} tentativo/i.`);
        return;
      }

      await this.appendLog(
        jobId,
        `MariaDB non ancora pronto (attempt ${attempt}/${MAX_RETRIES}), attendo ${RETRY_DELAY / 1000}s...`,
      );
      await sleep(RETRY_DELAY);
    }

    throw new Error('MariaDB non disponibile dopo il timeout massimo (3 minuti).');
  }

  // ── 6. WP-CLI install ─────────────────────────────────────────────
  private async wpCliInstall(
    deployDir: string,
    jobId: string,
    payload: SitebuilderJobPayload,
  ): Promise<void> {
    const stackName = `sb-${payload.jobId.replace(/-/g, '').substring(0, 16)}`;

    const result = await spawnAsync('docker', [
      'exec',
      `${stackName}-cli`,
      'wp',
      'core',
      'install',
      `--url=https://${payload.siteDomain}`,
      `--title=${payload.siteTitle}`,
      `--admin_user=admin`,
      `--admin_email=${payload.adminEmail}`,
      `--admin_password=${payload.adminPassword}`,
      '--skip-email',
      '--allow-root',
    ]);

    await this.appendLog(jobId, `wp core install: ${result.stdout}`);
    if (result.code !== 0) {
      throw new Error(`wp core install fallito (exit ${result.code}): ${result.stderr}`);
    }
  }

  // ── 7. Tema Blocksy + plugin aggiuntivi ──────────────────────────
  /**
   * Eseguiti nell'ordine corretto:
   *   1. wp theme install blocksy --activate
   *   2. wp theme install blocksy-companion --activate  (companion plugin obbligatorio)
   *   3. Per ogni slug in payload.plugins: wp plugin install <slug> --activate
   *
   * Usiamo --force per sovrascrivere eventuali versioni pre-installate.
   * Se un singolo plugin fallisce non blocchiamo l'intero job:
   * logghiamo un warning e continuiamo (comportamento degradato accettabile).
   */
  private async wpCliInstallThemeAndPlugins(
    deployDir: string,
    jobId: string,
    payload: SitebuilderJobPayload,
  ): Promise<void> {
    const stackName = `sb-${payload.jobId.replace(/-/g, '').substring(0, 16)}`;

    // ── Helper locale: esegue un singolo comando WP-CLI nel container
    const wpExec = async (args: string[], label: string): Promise<void> => {
      const result = await spawnAsync('docker', [
        'exec',
        `${stackName}-cli`,
        'wp',
        ...args,
        '--allow-root',
      ]);
      if (result.code !== 0) {
        // Warning non bloccante per plugin opzionali
        await this.appendLog(jobId, `⚠ ${label}: ${result.stderr.slice(0, 200)}`);
        this.logger.warn(`[${jobId}] ${label} exit ${result.code}: ${result.stderr}`);
      } else {
        await this.appendLog(jobId, `✓ ${label}`);
      }
    };

    // ── 1. Installa + attiva tema Blocksy ─────────────────────────
    await wpExec(
      ['theme', 'install', 'blocksy', '--activate', '--force'],
      'Tema Blocksy installato e attivato',
    );

    // ── 2. Companion plugin (necessario per Blocksy starter sites) ─
    await wpExec(
      ['plugin', 'install', 'blocksy-companion', '--activate', '--force'],
      'Plugin Blocksy Companion attivato',
    );

    // ── 3. Plugin aggiuntivi richiesti nel payload ─────────────────
    const extraPlugins = payload.plugins ?? [];
    if (extraPlugins.length === 0) {
      await this.appendLog(jobId, 'Nessun plugin aggiuntivo richiesto.');
      return;
    }

    await this.appendLog(jobId, `Installazione ${extraPlugins.length} plugin aggiuntivi...`);

    for (const slug of extraPlugins) {
      // Ogni slug è già validato dal DTO con @Matches(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/)
      // quindi non c'è rischio di injection — spawn non usa shell
      await wpExec(
        ['plugin', 'install', slug, '--activate', '--force'],
        `Plugin ${slug}`,
      );
    }
  }

  // ── 8. WP-CLI: inserisce blocchi Gutenberg ────────────────────────
  private async wpCliInsertBlocks(
    deployDir: string,
    jobId: string,
    blocks: GutenbergBlock[],
    payload: SitebuilderJobPayload,
  ): Promise<void> {
    const stackName = `sb-${payload.jobId.replace(/-/g, '').substring(0, 16)}`;

    for (const block of blocks) {
      // Scrive il contenuto HTML in un file temporaneo montato nel container
      const tmpFile = path.join(deployDir, `block-${sanitizeFilename(block.topic)}.html`);
      await fs.writeFile(tmpFile, block.html, 'utf8');

      // Crea la pagina tramite WP-CLI usando stdin-file trick
      const result = await spawnAsync('docker', [
        'exec',
        '-i',
        `${stackName}-cli`,
        'wp',
        'post',
        'create',
        '--post_type=page',
        '--post_status=publish',
        `--post_title=${block.topic}`,
        `--post_content=${block.html}`,
        '--porcelain',  // ritorna solo il post ID
        '--allow-root',
      ]);

      if (result.code !== 0) {
        throw new Error(
          `wp post create per "${block.topic}" fallito (exit ${result.code}): ${result.stderr}`,
        );
      }

      const postId = result.stdout.trim();
      await this.appendLog(jobId, `Pagina "${block.topic}" creata → post_id=${postId}`);
    }
  }

  // ════════════════════════════════════════════
  //  ROLLBACK & CLEANUP
  // ════════════════════════════════════════════

  /**
   * Chiamato da BullMQ quando il job ha esaurito tutti i retry.
   * Esegue `docker compose down -v` e rimuove la directory.
   */
  @OnWorkerEvent('failed')
  async onFailed(
    job: Job<SitebuilderJobPayload>,
    error: Error,
  ): Promise<void> {
    const { jobId } = job.data;
    const isLastAttempt = job.attemptsMade >= (job.opts.attempts ?? 1);

    this.logger.error(`[${jobId}] Job fallito (attempt ${job.attemptsMade}): ${error.message}`);

    await this.appendLog(
      jobId,
      `ERRORE (attempt ${job.attemptsMade}): ${error.message}`,
    );

    // Esegui il cleanup completo solo all'ultimo tentativo
    if (isLastAttempt) {
      await this.performRollback(jobId, job.data);
    }
  }

  private async performRollback(
    jobId: string,
    payload: SitebuilderJobPayload,
  ): Promise<void> {
    const deployDir = path.join(this.deploymentsRoot, jobId);
    this.logger.warn(`[${jobId}] Inizio rollback — distruzione container e rimozione directory`);

    // 1. docker compose down -v (rimuove container + volumi orfani)
    try {
      const composePath = path.join(deployDir, 'docker-compose.yml');
      // Controlla se il file esiste prima di provare
      await fs.access(composePath);

      const result = await spawnAsync('docker', [
        'compose',
        '-f',
        composePath,
        'down',
        '-v',
        '--remove-orphans',
        '--timeout', '30',
      ]);

      if (result.code !== 0) {
        this.logger.error(`[${jobId}] docker compose down fallito: ${result.stderr}`);
      } else {
        this.logger.log(`[${jobId}] Container distrutti con successo.`);
      }
    } catch (err) {
      // Il compose file potrebbe non esistere se il job è fallito prima di crearlo
      this.logger.warn(`[${jobId}] Rollback Docker saltato (compose file non trovato): ${String(err)}`);
    }

    // 2. Rimuovi la directory di deployment
    try {
      await fs.rm(deployDir, { recursive: true, force: true });
      this.logger.log(`[${jobId}] Directory ${deployDir} rimossa.`);
    } catch (err) {
      this.logger.error(`[${jobId}] Impossibile rimuovere ${deployDir}: ${String(err)}`);
    }

    // 3. Aggiorna lo stato nel DB
    await this.jobRepo.update(jobId, {
      status: SitebuilderJobStatus.ROLLED_BACK,
      logs: () => `logs || '["ROLLBACK completato: container e directory eliminati."]'::jsonb`,
    });
  }

  // ════════════════════════════════════════════
  //  UTILITY PRIVATI
  // ════════════════════════════════════════════

  private async patchStatus(
    jobId: string,
    status: SitebuilderJobStatus,
    additionalLogs: string[] = [],
  ): Promise<void> {
    const entity = await this.jobRepo.findOneOrFail({ where: { id: jobId } });
    entity.status = status;
    entity.logs = [...entity.logs, ...additionalLogs];
    await this.jobRepo.save(entity);
  }

  private async appendLog(jobId: string, message: string): Promise<void> {
    const ts = new Date().toISOString();
    const entry = `[${ts}] ${message}`;
    this.logger.debug(`[${jobId}] ${message}`);
    // Usa un raw query per append atomico su JSONB senza race condition
    await this.jobRepo
      .createQueryBuilder()
      .update(SitebuilderJob)
      .set({
        logs: () => `logs || '${JSON.stringify([entry])}'::jsonb`,
        attemptCount: () => 'attempt_count + 0', // no-op, mantiene updatedAt
      })
      .where('id = :id', { id: jobId })
      .execute();
  }

  /** Genera una password random sicura (24 char alfanumerici) */
  private generateSafePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    return Array.from({ length: 24 }, () =>
      chars[Math.floor(Math.random() * chars.length)],
    ).join('');
  }
}

// ─────────────────────────────────────────────
//  Tipi locali
// ─────────────────────────────────────────────
interface GutenbergBlock {
  topic: string;
  html: string;
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 40);
}