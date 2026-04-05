// apps/backend/src/superadmin/quote-request.controller.ts
// MODIFICATO: aggiunto GET /superadmin/quote-requests/stats nel controller Admin.
// Ritorna { total, pendingCount, assignedCount } per la Control Room.
//
// ENDPOINT PUBBLICI (nessuna autenticazione richiesta):
//   POST /api/public/quote-request   → Ricezione form + file dal sito web
//
// ENDPOINT PROTETTI (solo admin autenticati):
//   GET    /api/superadmin/quote-requests/stats            → Contatori KPI  ← NUOVO
//   GET    /api/superadmin/quote-requests                  → Lista richieste
//   GET    /api/superadmin/quote-requests/:id              → Dettaglio richiesta
//   PATCH  /api/superadmin/quote-requests/:id              → Aggiorna stato/note
//   GET    /api/superadmin/quote-requests/:id/download     → Download zip file
//   DELETE /api/superadmin/quote-requests/:id/files        → Elimina file MinIO
//   DELETE /api/superadmin/quote-requests/:id              → Elimina richiesta completa

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Query,
  Body,
  Req,
  Res,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
  SetMetadata,
  HttpCode,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { Request, Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { QuoteRequestService, QuoteFormData } from './quote-request.service';
import { QuoteRequestStatus } from './entities/quote-request.entity';

const Roles = (...roles: string[]) => SetMetadata('roles', roles);

// ══════════════════════════════════════════════════════════════════════════════
// CONTROLLER PUBBLICO — Riceve richieste dal sito web (nessuna auth)
// ══════════════════════════════════════════════════════════════════════════════

@Controller('public/quote-request')
export class PublicQuoteRequestController {
  private readonly logger = new Logger(PublicQuoteRequestController.name);

  constructor(private readonly quoteService: QuoteRequestService) {}

  /**
   * POST /api/public/quote-request
   *
   * Riceve un multipart/form-data con:
   * - Campi testuali: clientName, clientEmail, clientPhone, companyName, subject, message
   * - File allegati: campo "files" (multiplo, max 10 file, max 20MB ciascuno)
   *
   * Risposta: { success: true, requestId: "uuid" }
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: {
        fileSize: 20 * 1024 * 1024, // 20MB per file
      },
      fileFilter: (_req, file, cb) => {
        const blockedMimes = [
          'application/x-executable',
          'application/x-msdownload',
          'application/x-msdos-program',
        ];
        const blockedExtensions = ['.exe', '.bat', '.cmd', '.sh', '.ps1', '.msi'];
        const ext = (file.originalname || '').toLowerCase();
        const isBlocked =
          blockedMimes.includes(file.mimetype) ||
          blockedExtensions.some((e) => ext.endsWith(e));

        if (isBlocked) {
          return cb(new Error(`Tipo di file non consentito: ${file.originalname}`), false);
        }
        cb(null, true);
      },
    }),
  )
  async submitQuoteRequest(
    @Req()            req:   Request,
    @Body()           body:  any,
    @UploadedFiles()  files: Express.Multer.File[],
  ) {
    const formData: QuoteFormData = {
      clientName:  body.clientName  || body.client_name  || '',
      clientEmail: body.clientEmail || body.client_email || '',
      clientPhone: body.clientPhone || body.client_phone || undefined,
      companyName: body.companyName || body.company_name || undefined,
      subject:     body.subject     || undefined,
      message:     body.message     || undefined,
    };

    const sourceIp =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      req.ip ||
      req.socket?.remoteAddress ||
      null;
    const sourceOrigin =
      (req.headers['origin'] as string) ||
      (req.headers['referer'] as string) ||
      null;

    this.logger.log(
      `📥 Nuova richiesta preventivo da ${formData.clientEmail} (${files?.length || 0} file)`,
    );

    try {
      const result = await this.quoteService.createQuoteRequest(
        formData,
        files || [],
        sourceIp  || undefined,
        sourceOrigin || undefined,
      );

      return {
        success:       true,
        requestId:     result.id,
        filesUploaded: result.filesCount,
        message: 'Richiesta di preventivo ricevuta con successo. Ti contatteremo al più presto!',
      };
    } catch (error) {
      this.logger.error(`❌ Errore ricezione preventivo: ${(error as Error).message}`);
      throw error;
    }
  }
}

// ══════════════════════════════════════════════════════════════════════════════
// CONTROLLER ADMIN — Gestione richieste nel CRM superadmin (auth richiesta)
// ══════════════════════════════════════════════════════════════════════════════

@Controller('superadmin/quote-requests')
@UseGuards(JwtAuthGuard)
export class AdminQuoteRequestController {
  private readonly logger = new Logger(AdminQuoteRequestController.name);

  constructor(private readonly quoteService: QuoteRequestService) {}

  // ── GET /superadmin/quote-requests/stats ─────────────────────────────────
  // NUOVO: KPI rapidi per la Control Room dashboard.
  // Ritorna: { total, pendingCount, assignedCount }
  // ATTENZIONE: deve stare PRIMA di ':id' altrimenti NestJS lo interpreta come param.
  @Get('stats')
  @Roles('superadmin')
  async getStats() {
    return this.quoteService.getStats();
  }

  // ── GET /superadmin/quote-requests ──────────────────────────────────────
  @Get()
  @Roles('superadmin')
  async findAll(
    @Query('status') status?: QuoteRequestStatus,
    @Query('search') search?: string,
  ) {
    return this.quoteService.findAll({ status, search });
  }

  // ── GET /superadmin/quote-requests/:id ──────────────────────────────────
  @Get(':id')
  @Roles('superadmin')
  async findOne(@Param('id') id: string) {
    return this.quoteService.findOne(id);
  }

  // ── PATCH /superadmin/quote-requests/:id ────────────────────────────────
  @Patch(':id')
  @Roles('superadmin')
  async update(
    @Param('id') id: string,
    @Body() body: { status?: QuoteRequestStatus; adminNotes?: string },
  ) {
    return this.quoteService.updateRequest(id, body);
  }

  // ── GET /superadmin/quote-requests/:id/download ─────────────────────────
  @Get(':id/download')
  @Roles('superadmin')
  async downloadFiles(
    @Param('id') id: string,
    @Res()       res: Response,
  ) {
    const { stream, filename } = await this.quoteService.downloadFilesAsZip(id);

    res.set({
      'Content-Type':        'application/zip',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control':       'no-cache',
    });

    stream.pipe(res);

    stream.on('error', (err) => {
      this.logger.error(`Errore streaming zip: ${err.message}`);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Errore durante la generazione dello zip' });
      }
    });
  }

  // ── DELETE /superadmin/quote-requests/:id/files ──────────────────────────
  @Delete(':id/files')
  @Roles('superadmin')
  async deleteFiles(@Param('id') id: string) {
    const result = await this.quoteService.deleteRequestFiles(id);
    return {
      success: true,
      message: `${result.deleted} file eliminati da MinIO`,
      ...result,
    };
  }

  // ── DELETE /superadmin/quote-requests/:id ───────────────────────────────
  @Delete(':id')
  @Roles('superadmin')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteRequest(@Param('id') id: string) {
    await this.quoteService.deleteRequest(id);
  }
}
