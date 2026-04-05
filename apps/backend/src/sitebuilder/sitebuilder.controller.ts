// apps/backend/src/sitebuilder/sitebuilder.controller.ts

import {
  Body, Controller, Get, HttpCode, HttpStatus, Inject,
  Param, ParseUUIDPipe, Post, Query, StreamableFile,
  NotFoundException, UseGuards, Delete, Header,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import * as path from 'path';
import * as fs from 'fs';
import { ConfigService } from '@nestjs/config';
import Anthropic from '@anthropic-ai/sdk';

import { CreateSitebuilderJobDto } from './dto/create-sitebuilder-job.dto';
import { SitebuilderProducerService } from './sitebuilder.producer.service';
import { SitebuilderJob, SitebuilderJobStatus } from './sitebuilder.entity';
import { BLOCKSY_STARTER_SITES } from './sitebuilder.constants';
import { ANTHROPIC_CLIENT } from './sitebuilder.anthropic.provider';
import { PROMPTS } from './sitebuilder.prompts';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Sitebuilder')
@UseGuards(JwtAuthGuard)
@Controller('sitebuilder')
export class SitebuilderController {
  private readonly deploymentsRoot: string;

  constructor(
    private readonly producer: SitebuilderProducerService,
    private readonly config: ConfigService,
    @Inject(ANTHROPIC_CLIENT)
    private readonly anthropic: Anthropic,
  ) {
    this.deploymentsRoot = path.resolve(
      config.get<string>('SITEBUILDER_DEPLOYMENTS_PATH', './deployments'),
    );
  }

  // ─── Helper: estrae testo dal response Anthropic ────────────────────
  private extractText(message: Anthropic.Message): string {
    return (message.content as Array<{ type: string; text?: string }>)
      .filter((b) => b.type === 'text')
      .map((b) => b.text ?? '')
      .join('');
  }

  // ─── GET /sitebuilder/starter-sites ───────────────────────────────
  @Get('starter-sites')
  @ApiOperation({ summary: 'Lista dei Blocksy Starter Sites disponibili' })
  getStarterSites() {
    return BLOCKSY_STARTER_SITES;
  }

  // ─── POST /sitebuilder/jobs ────────────────────────────────────────
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
  @Get('jobs')
  @ApiOperation({ summary: 'Lista storico job (max 50)' })
  async listJobs(@Query('tenantId') tenantId?: string): Promise<SitebuilderJob[]> {
    return this.producer.findAll(tenantId);
  }

  // ─── GET /sitebuilder/jobs/:jobId ─────────────────────────────────
  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Recupera stato e log di un job' })
  async getJob(@Param('jobId', new ParseUUIDPipe()) jobId: string): Promise<SitebuilderJob> {
    return this.producer.findOne(jobId);
  }

  // ─── GET /sitebuilder/jobs/:jobId/download ────────────────────────
  // Usa StreamableFile per una gestione robusta degli stream e della memoria
  @Get('jobs/:jobId/download')
  @ApiOperation({ summary: 'Scarica lo ZIP del sito WordPress generato' })
  @Header('Content-Type', 'application/zip')
  async downloadJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ): Promise<StreamableFile> {
    const job = await this.producer.findOne(jobId);

    if (job.status !== SitebuilderJobStatus.DONE) {
      throw new NotFoundException(`Il job ${jobId} non è ancora completato (status: ${job.status})`);
    }

    const zipPath = path.join(this.deploymentsRoot, jobId, `${jobId}.zip`);
    if (!fs.existsSync(zipPath)) {
      throw new NotFoundException(`File ZIP non trovato per il job ${jobId}`);
    }

    const zipName = `${job.siteDomain.replace(/\./g, '-')}-wordpress.zip`;
    return new StreamableFile(fs.createReadStream(zipPath), {
      type:        'application/zip',
      disposition: `attachment; filename="${zipName}"`,
    });
  }

  // ─── DELETE /sitebuilder/jobs/:jobId ──────────────────────────────
  @Delete('jobs/:jobId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Elimina un job e il relativo ZIP dal filesystem' })
  async deleteJob(@Param('jobId', new ParseUUIDPipe()) jobId: string): Promise<void> {
    await this.producer.delete(jobId);
    try {
      await (await import('fs/promises')).rm(
        path.join(this.deploymentsRoot, jobId),
        { recursive: true, force: true },
      );
    } catch { /* cartella già assente, ignora */ }
  }

  // ─── POST /sitebuilder/enhance-description ────────────────────────
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
}