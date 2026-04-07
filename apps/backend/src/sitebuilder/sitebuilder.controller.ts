// apps/backend/src/sitebuilder/sitebuilder.controller.ts

import {
  Body, Controller, Get, HttpCode, HttpStatus, Inject,
  Param, ParseUUIDPipe, Post, Query,
  NotFoundException, UseGuards, Delete,
} from '@nestjs/common';
// BUG FIX: rimossi StreamableFile, path, fs — non più necessari senza endpoint ZIP
import { ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

import { CreateSitebuilderJobDto } from './dto/create-sitebuilder-job.dto';
import { SitebuilderProducerService } from './sitebuilder.producer.service';
import { SitebuilderJob } from './sitebuilder.entity';
import { BLOCKSY_STARTER_SITES } from './sitebuilder.constants';
import { ANTHROPIC_CLIENT } from './sitebuilder.anthropic.provider';
import { PROMPTS } from './sitebuilder.prompts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

/**
 * NOTA ARCHITETTURALE (FASE 1):
 * Il controller NON ha @UseGuards(JwtAuthGuard) a livello di classe.
 * La guard viene applicata individualmente su ogni metodo privato,
 * lasciando GET /sitebuilder/import/:token completamente pubblica.
 */
@ApiTags('Sitebuilder')
@Controller('sitebuilder')
export class SitebuilderController {
  // BUG FIX: rimosso deploymentsRoot — non esiste più un filesystem di deployment

  constructor(
    private readonly producer: SitebuilderProducerService,
    private readonly config: ConfigService,
    @Inject(ANTHROPIC_CLIENT)
    private readonly anthropic: Anthropic,
  ) {}

  // ─── Helper: estrae testo dal response Anthropic ────────────────────
  private extractText(message: Anthropic.Message): string {
    return (message.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
  }

  // ─── GET /sitebuilder/starter-sites ───────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('starter-sites')
  @ApiOperation({ summary: 'Lista dei Blocksy Starter Sites disponibili' })
  getStarterSites() {
    return BLOCKSY_STARTER_SITES;
  }

  // ─── POST /sitebuilder/jobs ────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED)
  @ApiOperation({ summary: 'Accoda un nuovo job di creazione sito WordPress' })
  async createJob(
    @Body() dto: CreateSitebuilderJobDto,
  ): Promise<{ jobId: string; status: string; message: string }> {
    const job = await this.producer.enqueue(dto);
    return {
      jobId:   job.id,
      status:  job.status,
      message: 'Job accodato. Usa GET /sitebuilder/jobs/:jobId per monitorare.',
    };
  }

  // ─── GET /sitebuilder/jobs ─────────────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('jobs')
  @ApiOperation({ summary: 'Lista storico job (max 50)' })
  async listJobs(@Query('tenantId') tenantId?: string): Promise<SitebuilderJob[]> {
    return this.producer.findAll(tenantId);
  }

  // ─── GET /sitebuilder/jobs/:jobId ─────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Recupera stato e log di un job' })
  async getJob(@Param('jobId', new ParseUUIDPipe()) jobId: string): Promise<SitebuilderJob> {
    return this.producer.findOne(jobId);
  }

  // ─── DELETE /sitebuilder/jobs/:jobId ──────────────────────────────
  // BUG FIX: rimosso il blocco fs.rm — non esiste più nessuna cartella
  // di deployment da cancellare; il job viene rimosso solo dal DB.
  @UseGuards(JwtAuthGuard)
  @Delete('jobs/:jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un job dal database' })
  async deleteJob(@Param('jobId', new ParseUUIDPipe()) jobId: string): Promise<void> {
    await this.producer.delete(jobId);
  }

  // ─── POST /sitebuilder/enhance-description ────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('enhance-description')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Migliora la descrizione business con AI' })
  async enhanceDescription(
    @Body() body: { siteTitle?: string; businessType?: string; description?: string; locale?: string },
  ): Promise<{ enhanced: string }> {
    const { siteTitle, businessType, description, locale = 'it' } = body;
    const { system } = PROMPTS.ENHANCE_DESCRIPTION(locale);

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 512,
      system,
      messages: [{
        role:    'user',
        content: `Migliora questa descrizione per "${siteTitle}" (${businessType}):\n${description || `Sito web per ${businessType || siteTitle}.`}\n\nAggiungi dettagli su servizi, punti di forza, target clienti e proposta di valore unica.`,
      }],
    });

    return { enhanced: this.extractText(message).trim() };
  }

  // ─── POST /sitebuilder/seo-keywords ───────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('seo-keywords')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Genera keyword SEO e meta description' })
  async generateSeoKeywords(
    @Body() body: { siteTitle?: string; businessType?: string; description?: string; locale?: string },
  ): Promise<{ keywords: string[]; metaDescription: string }> {
    const { siteTitle, businessType, description, locale = 'it' } = body;
    const { system } = PROMPTS.SEO_KEYWORDS(locale);

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 512,
      system,
      messages: [{
        role:    'user',
        content: `Sito: "${siteTitle}" | Settore: ${businessType} | Descrizione: ${description ?? ''}`,
      }],
    });

    const raw = this.extractText(message)
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      return JSON.parse(raw) as { keywords: string[]; metaDescription: string };
    } catch {
      return { keywords: [], metaDescription: '' };
    }
  }

  // ─── POST /sitebuilder/parse-xml ──────────────────────────────────
  @UseGuards(JwtAuthGuard)
  @Post('parse-xml')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Parsa XML sitebuilder_master_doc → JSON blocchi UI' })
  async parseXml(
    @Body() body: { xmlContent: string },
  ): Promise<{ pages: unknown[]; strategy: unknown }> {
    const { xmlContent } = body;
    if (!xmlContent?.trim()) throw new NotFoundException('xmlContent mancante nel body');

    const xmlPrompts = PROMPTS.PARSE_XML();

    const message = await this.anthropic.messages.create({
      model: 'claude-sonnet-4-6', max_tokens: 4096,
      system: xmlPrompts.system,
      messages: [{ role: 'user', content: xmlPrompts.user(xmlContent) }],
    });

    const raw = this.extractText(message)
      .replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();

    try {
      return JSON.parse(raw) as { pages: unknown[]; strategy: unknown };
    } catch {
      throw new Error(`Claude ha restituito JSON non valido. Inizio: ${raw.substring(0, 200)}`);
    }
  }

  // ─── GET /sitebuilder/import/:token — PUBBLICO, nessun @UseGuards ─
  @Get('import/:token')
  @ApiOperation({
    summary: 'Recupera i dati WP di un sito completato tramite token (pubblica, no JWT)',
  })
  @ApiParam({
    name:        'token',
    description: 'Token monouso generato al completamento del job',
    type:        String,
  })
  async getImportData(
    @Param('token') token: string,
  ): Promise<{ jobId: string; siteDomain: string; siteTitle: string; wpData: Record<string, unknown> | null }> {
    const job = await this.producer.findOneByToken(token);
    return {
      jobId:      job.id,
      siteDomain: job.siteDomain,
      siteTitle:  job.siteTitle,
      wpData:     job.wpData,
    };
  }
}