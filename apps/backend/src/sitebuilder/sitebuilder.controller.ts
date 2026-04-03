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
  UseGuards,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { CreateSitebuilderJobDto } from './dto/create-sitebuilder-job.dto';
import { SitebuilderProducerService } from './sitebuilder.producer.service';
import { SitebuilderJob } from './sitebuilder.entity';

// Riusa la guard JWT già presente nel progetto
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@ApiTags('Sitebuilder')
@UseGuards(JwtAuthGuard)
@Controller('sitebuilder')
export class SitebuilderController {
  constructor(private readonly producer: SitebuilderProducerService) {}

  // ─── POST /sitebuilder/jobs ───────────────────────────────────────
  @Post('jobs')
  @HttpCode(HttpStatus.ACCEPTED) // 202 — il lavoro è stato accettato, non completato
  @ApiOperation({ summary: 'Accoda un nuovo job di creazione sito WordPress' })
  @ApiResponse({
    status: HttpStatus.ACCEPTED,
    description: 'Job accodato con successo. Usare il jobId per il polling.',
    schema: {
      example: {
        jobId: '550e8400-e29b-41d4-a716-446655440000',
        status: 'PENDING',
        message: 'Il job è stato accodato. Usa GET /sitebuilder/jobs/:jobId per monitorare lo stato.',
      },
    },
  })
  async createJob(
    @Body() dto: CreateSitebuilderJobDto,
  ): Promise<{ jobId: string; status: string; message: string }> {
    const job = await this.producer.enqueue(dto);

    return {
      jobId: job.id,
      status: job.status,
      message:
        'Il job è stato accodato. Usa GET /sitebuilder/jobs/:jobId per monitorare lo stato.',
    };
  }

  // ─── GET /sitebuilder/jobs/:jobId ────────────────────────────────
  // Endpoint di polling: il frontend chiama questo ogni N secondi
  // finché status !== PENDING | RUNNING
  @Get('jobs/:jobId')
  @ApiOperation({ summary: 'Recupera lo stato e i log di un job' })
  @ApiResponse({ status: HttpStatus.OK, type: SitebuilderJob })
  async getJob(
    @Param('jobId', new ParseUUIDPipe()) jobId: string,
  ): Promise<SitebuilderJob> {
    return this.producer.findOne(jobId);
  }
}