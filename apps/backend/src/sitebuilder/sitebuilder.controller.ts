// apps/backend/src/sitebuilder/sitebuilder.controller.ts

import {
  Body, Controller, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Post, Res, Query,
  NotFoundException, UseGuards, Delete,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';
import { ConfigService } from '@nestjs/config';

import { CreateSitebuilderJobDto } from './dto/create-sitebuilder-job.dto';
import { SitebuilderProducerService } from './sitebuilder.producer.service';
import { SitebuilderJob, SitebuilderJobStatus } from './sitebuilder.entity';
import { BLOCKSY_STARTER_SITES } from './sitebuilder.constants';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Sitebuilder')
@UseGuards(JwtAuthGuard)
@Controller('sitebuilder')
export class SitebuilderController {
  private readonly deploymentsRoot: string;

  constructor(
    private readonly producer: SitebuilderProducerService,
    private readonly config: ConfigService,
  ) {
    this.deploymentsRoot = path.resolve(
      config.get<string>('SITEBUILDER_DEPLOYMENTS_PATH', './deployments'),
    );
  }

  // ─── GET /sitebuilder/starter-sites ──────────────────────────────
  @Get('starter-sites')
  @ApiOperation({ summary: 'Lista dei Blocksy Starter Sites disponibili' })
  getStarterSites() {
    return BLOCKSY_STARTER_SITES;
  }

  // ─── POST /sitebuilder/jobs ───────────────────────────────────────
  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Accoda un nuovo job di creazione sito WordPress' })
  async createJob(
    @Body() dto: CreateSitebuilderJobDto,
  ): Promise<{ jobId: string; status: string; message: string }> {
    const job = await this.producer.enqueue(dto);
    return {
      jobId: job.id,
      status: job.status,
      message: 'Job accodato. Usa GET /sitebuilder/jobs/:jobId per monitorare.',
    };
  }

  // ─── GET /sitebuilder/jobs ────────────────────────────────────────
  @Get('jobs')
  @ApiOperation({ summary: 'Lista storico job (max 50)' })
  async listJobs(
    @Query('tenantId') tenantId?: string,
  ): Promise<SitebuilderJob[]> {
    return this.producer.findAll(tenantId);
  }

  // ─── GET /sitebuilder/jobs/:jobId ────────────────────────────────
  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Recupera stato e log di un job' })
  async getJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ): Promise<SitebuilderJob> {
    return this.producer.findOne(jobId);
  }

  // ─── GET /sitebuilder/jobs/:jobId/download ───────────────────────
  @Get('jobs/:jobId/download')
  @ApiOperation({ summary: 'Scarica lo ZIP del sito WordPress generato' })
  async downloadJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @Res() res: Response,
  ): Promise<void> {
    const job = await this.producer.findOne(jobId);

    if (job.status !== SitebuilderJobStatus.DONE) {
      throw new NotFoundException(
        `Il job ${jobId} non è ancora completato (status: ${job.status})`,
      );
    }

    const deployDir = path.join(this.deploymentsRoot, jobId);
    const zipPath = path.join(deployDir, `${jobId}.zip`);

    if (!fs.existsSync(zipPath)) {
      throw new NotFoundException(`File ZIP non trovato per il job ${jobId}`);
    }

    const zipName = `${job.siteDomain.replace(/\./g, '-')}-wordpress.zip`;
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const fileStream = fs.createReadStream(zipPath);
    fileStream.pipe(res);
    fileStream.on('error', () => {
      if (!res.headersSent) res.status(500).json({ message: 'Errore lettura ZIP' });
    });
  }

  // ─── POST /sitebuilder/enhance-description ───────────────────────
  @Post('enhance-description')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Migliora la descrizione del business con AI' })
  async enhanceDescription(
    @Body() body: { siteTitle?: string; businessType?: string; description?: string; locale?: string },
  ): Promise<{ enhanced: string }> {
    const { siteTitle, businessType, description, locale = 'it' } = body;
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') ?? '' });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `Sei un copywriter professionista specializzato in siti web aziendali.
Migliora la descrizione del business fornita, rendendola più dettagliata, professionale e utile per generare contenuti web.
Rispondi SOLO con il testo migliorato, senza introduzioni o spiegazioni. Lingua: ${locale}. Max 400 parole.`,
      messages: [{
        role: 'user',
        content: `Migliora questa descrizione per "${siteTitle}" (${businessType}):
${description || `Sito web per ${businessType || siteTitle}.`}

Aggiungi dettagli su servizi, punti di forza, target clienti e proposta di valore unica.`,
      }],
    });

    const enhanced = (message.content as Array<{type:string;text?:string}>)
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '').join('').trim();

    return { enhanced };
  }

  // ─── POST /sitebuilder/seo-keywords ──────────────────────────────
  @Post('seo-keywords')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Genera keyword SEO per il sito' })
  async generateSeoKeywords(
    @Body() body: { siteTitle?: string; businessType?: string; description?: string; locale?: string },
  ): Promise<{ keywords: string[]; metaDescription: string }> {
    const { siteTitle, businessType, description, locale = 'it' } = body;
    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') ?? '' });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system: `Sei un esperto SEO. Genera keyword e meta description per un sito web.
OUTPUT ESCLUSIVO: JSON puro. Primo carattere {, ultimo }.
Formato: {"keywords":["kw1","kw2",...],"metaDescription":"...max 160 chars..."}
Lingua: ${locale}.`,
      messages: [{
        role: 'user',
        content: `Sito: "${siteTitle}" | Settore: ${businessType} | Descrizione: ${description ?? ''}`,
      }],
    });

    const raw = (message.content as Array<{type:string;text?:string}>)
      .filter((b: unknown): b is { type: string; text: string } => (b as { type?: string }).type === 'text')
      .map((b) => (b as { text: string }).text).join('')
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      return JSON.parse(raw) as { keywords: string[]; metaDescription: string };
    } catch {
      return { keywords: [], metaDescription: '' };
    }
  }

  // ─── POST /sitebuilder/parse-xml ─────────────────────────────────
  @Post('parse-xml')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Parsa un XML sitebuilder_master_doc → JSON blocchi UI' })
  async parseXml(
    @Body() body: { xmlContent: string },
  ): Promise<{ pages: unknown[]; strategy: unknown }> {
    const { xmlContent } = body;
    if (!xmlContent?.trim()) {
      throw new NotFoundException('xmlContent mancante nel body');
    }

    const Anthropic = (await import('@anthropic-ai/sdk')).default;
    const anthropic = new Anthropic({ apiKey: this.config.get<string>('ANTHROPIC_API_KEY') ?? '' });

    const message = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 4096,
      system: `Sei un parser XML preciso e deterministico. Il tuo unico compito è leggere un documento XML custom chiamato <sitebuilder_master_doc> e trasformarlo in un JSON strutturato.

**REGOLE ASSOLUTE:**
- OUTPUT ESCLUSIVO: JSON puro. Primo carattere {, ultimo }.
- ZERO markdown, ZERO backtick, ZERO spiegazioni.
- Preserva i testi ESATTAMENTE come sono nell'XML (sono testi SEO/CRO ottimizzati, NON riscriverli).
- Ogni <pagina nome="..."> diventa un oggetto page.
- Ogni <sezione tipo="..."> diventa un brick nel seguente modo:

MAPPING SEZIONI → BRICK TYPE:
- tipo="Hero" → { "type":"hero", "headline":[testo H1], "subheadline":[testo H2], "body":[testo P], "cta_text":[testo CTA], "cta_url":"#contatti", "image_query":"[3 parole chiave in inglese per Unsplash basate sul settore]" }
- tipo="Value_Proposition" → { "type":"features", "headline":[testo H2], "items":[{"title":[titolo beneficio],"description":[descrizione beneficio]},...], "image_query":"[3 parole in inglese]" }
- tipo="Storytelling" → { "type":"about", "headline":[testo H1], "body":[testo P], "image_query":"[3 parole in inglese]" }
- tipo="Elenco_Servizi" → { "type":"services", "headline":[testo H1], "items":[{"title":[H2 servizio],"description":[P servizio]},...] }
- tipo="Testimonials" → { "type":"testimonials", "headline":[testo H2], "items":[{"title":[nome],"description":[testo]},...] }
- tipo="FAQ" → { "type":"faq", "headline":[testo H2], "items":[{"title":[domanda],"description":[risposta]},...] }
- tipo="CTA_Finale" → { "type":"cta", "headline":[testo H2], "subheadline":[testo P], "cta_text":[testo CTA], "cta_url":"#contatti" }
- tipo="Contatti" → { "type":"contact", "headline":[testo H1 o H2], "subheadline":[testo P] }

Per lo slug della pagina: converti il nome in lowercase con trattini (es. "Chi_Siamo" → "chi-siamo", "Home" → "home").

**FORMATO OUTPUT ESATTO:**
{
  "strategy": {
    "targetAudience": "[testo da <target_audience>]",
    "searchIntent": "[testo da <search_intent>]",
    "toneOfVoice": "[testo da <tono_di_voce>]"
  },
  "pages": [
    {
      "slug": "[slug-pagina]",
      "title": "[nome pagina leggibile]",
      "bricks": [ ...array di brick objects... ]
    }
  ]
}`,
      messages: [{
        role: 'user',
        content: `Analizza e converti questo XML in JSON strutturato:\n\n${xmlContent}`,
      }],
    });

    const raw = (message.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '').join('')
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      const parsed = JSON.parse(raw) as { pages: unknown[]; strategy: unknown };
      return parsed;
    } catch {
      throw new Error(`Claude ha restituito JSON non valido. Raw: ${raw.substring(0, 200)}`);
    }
  }

  @Delete('jobs/:jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un job e il relativo ZIP dal filesystem' })
  async deleteJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ): Promise<void> {
    await this.producer.delete(jobId);
    const deployDir = path.join(this.deploymentsRoot, jobId);
    try {
      await (await import('fs/promises')).rm(deployDir, { recursive: true, force: true });
    } catch { /* cartella già assente */ }
  }
}