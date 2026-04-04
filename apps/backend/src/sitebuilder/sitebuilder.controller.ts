// apps/backend/src/sitebuilder/sitebuilder.controller.ts

import {
  Body, Controller, Get, HttpCode, HttpStatus,
  Param, ParseUUIDPipe, Post, Res, Query,
  NotFoundException, UseGuards,
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
}