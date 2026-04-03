// apps/backend/src/sitebuilder/sitebuilder.controller.ts

import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Res,
  NotFoundException,
  UseGuards,
} from '@nestjs/common';
import { Response } from 'express';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import * as path from 'path';
import * as fs from 'fs';
import { spawn } from 'child_process';

import { CreateSitebuilderJobDto } from './dto/create-sitebuilder-job.dto';
import { SitebuilderProducerService } from './sitebuilder.producer.service';
import { SitebuilderJob, SitebuilderJobStatus } from './sitebuilder.entity';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ConfigService } from '@nestjs/config';

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
      message: 'Job accodato. Usa GET /sitebuilder/jobs/:jobId per monitorare lo stato.',
    };
  }

  // ─── GET /sitebuilder/jobs/:jobId ────────────────────────────────
  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Recupera lo stato e i log di un job' })
  async getJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ): Promise<SitebuilderJob> {
    return this.producer.findOne(jobId);
  }

  // ─── GET /sitebuilder/jobs/:jobId/download ───────────────────────
  // Zippa la cartella ./deployments/[jobId] e la restituisce come
  // attachment scaricabile direttamente dal browser.
  @Get('jobs/:jobId/download')
  @ApiOperation({ summary: 'Scarica la cartella WP generata come .zip' })
  async downloadJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
    @Res() res: Response,
  ): Promise<void> {
    // 1. Verifica che il job esista ed sia completato
    const job = await this.producer.findOne(jobId);
    if (job.status !== SitebuilderJobStatus.DONE) {
      throw new NotFoundException(
        `Il job ${jobId} non è ancora completato (status: ${job.status})`,
      );
    }

    // 2. Verifica che la cartella esista sul filesystem
    const deployDir = path.join(this.deploymentsRoot, jobId);
    if (!fs.existsSync(deployDir)) {
      throw new NotFoundException(
        `Cartella deployment non trovata per il job ${jobId}`,
      );
    }

    // 3. Nome del file zip da restituire
    const zipName = `wp-${job.siteDomain}-${jobId.slice(0, 8)}.zip`;

    // 4. Imposta gli header per il download
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    // 5. Lancia zip e pipe direttamente verso la response — nessun file
    //    temporaneo su disco, streaming puro
    //    -r  = ricorsivo
    //    -   = output su stdout
    //    .   = comprimi tutto il contenuto della cartella
    const zip = spawn('zip', ['-r', '-', '.'], {
      cwd: deployDir,
      shell: false,
    });

    zip.stdout.pipe(res);

    zip.stderr.on('data', (chunk: Buffer) => {
      // log non bloccante — zip scrive info su stderr anche in caso di successo
      console.warn(`[sitebuilder/download] zip stderr: ${chunk.toString()}`);
    });

    zip.on('error', (err) => {
      console.error(`[sitebuilder/download] zip process error:`, err);
      if (!res.headersSent) {
        res.status(500).json({ message: 'Errore durante la creazione dello zip' });
      }
    });

    zip.on('close', (code) => {
      if (code !== 0) {
        console.error(`[sitebuilder/download] zip exited with code ${code}`);
      }
    });
  }
}