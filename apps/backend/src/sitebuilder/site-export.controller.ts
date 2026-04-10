// apps/backend/src/sitebuilder/site-export.controller.ts
import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { Response } from 'express';
import { SiteStorageService } from './site-storage.service';
import * as path from 'path';
import * as fs from 'fs';

@Controller('export')
export class SiteExportController {
  constructor(private readonly siteStorageService: SiteStorageService) {}

  // ── Endpoint chiamato dal plugin WordPress per i dati AI ──────────────────
  // GET /api/export/wp-pull?token=...
  @Get('wp-pull')
  async pullSiteData(@Query('token') token: string) {
    if (!token) {
      throw new UnauthorizedException('Token mancante');
    }

    try {
      const siteData = await this.siteStorageService.getSiteDataByToken(token);
      return {
        status: 'success',
        data: siteData,
      };
    } catch (error) {
      throw new UnauthorizedException('Token invalido o dati non più disponibili');
    }
  }

  // ── Endpoint per scaricare il tema zip — chiamato dal plugin WordPress ─────
  // GET /api/export/theme/doflow-first
  // Il plugin deve usare questo URL invece di /public/themes/doflow-first.zip
  //
  // URL da configurare in neuro-sitebuilder.php:
  //   $theme_zip_url = 'https://api.doflow.it/api/export/theme/' . $theme_slug;
  @Get('theme/:themeId')
  async downloadTheme(
    @Param('themeId') themeId: string,
    @Res() res: Response,
  ) {
    // Validazione: solo caratteri alfanumerici e trattini (evita path traversal)
    if (!themeId || !/^[a-z0-9\-]+$/.test(themeId)) {
      throw new BadRequestException('themeId non valido.');
    }

    const zipPath = path.resolve(
      process.cwd(),
      'public',
      'themes',
      `${themeId}.zip`,
    );

    if (!fs.existsSync(zipPath)) {
      throw new NotFoundException(
        `Tema "${themeId}" non trovato. Caricalo in: apps/backend/public/themes/${themeId}.zip`,
      );
    }

    const stat = fs.statSync(zipPath);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${themeId}.zip"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-cache');

    fs.createReadStream(zipPath).pipe(res);
  }
}