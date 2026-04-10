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
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { SiteStorageService } from './site-storage.service';
import * as path from 'path';
import * as fs from 'fs';

@Controller('export')
export class SiteExportController {
  private readonly logger = new Logger(SiteExportController.name);

  constructor(private readonly siteStorageService: SiteStorageService) {}

  // ── Endpoint chiamato dal plugin WordPress per i dati AI ──────────────────
  // GET /api/export/wp-pull?token=...
  @Get('wp-pull')
  async pullSiteData(@Query('token') token: string) {
    if (!token) throw new UnauthorizedException('Token mancante');
    try {
      const siteData = await this.siteStorageService.getSiteDataByToken(token);
      return { status: 'success', data: siteData };
    } catch {
      throw new UnauthorizedException('Token invalido o dati non più disponibili');
    }
  }

  // ── Endpoint download tema zip — chiamato da neuro-sitebuilder.php ─────────
  // GET /api/export/theme/doflow-first
  // Configurare nel plugin: $theme_zip_url = 'https://api.doflow.it/api/export/theme/' . $theme_slug;
  @Get('theme/:themeId')
  async downloadTheme(@Param('themeId') themeId: string, @Res() res: Response) {
    // Validazione: solo caratteri alfanumerici e trattini (evita path traversal)
    if (!themeId || !/^[a-z0-9\-]+$/.test(themeId)) {
      throw new BadRequestException('themeId non valido.');
    }

    const zipName = `${themeId}.zip`;
    const zipPath = this.resolveThemePath(zipName);

    this.logger.log(`Richiesta tema: ${zipName} → ${zipPath}`);

    if (!fs.existsSync(zipPath)) {
      this.logger.error(`File non trovato: ${zipPath}`);
      throw new NotFoundException(
        `Tema "${themeId}" non trovato. Path cercato: ${zipPath}`,
      );
    }

    const stat = fs.statSync(zipPath);
    this.logger.log(`Invio ${zipName} — ${(stat.size / 1024).toFixed(1)} KB`);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-cache');

    fs.createReadStream(zipPath).pipe(res);
  }

  // ── Risoluzione path robusta ───────────────────────────────────────────────
  // Prova più candidati in ordine: si adatta a dev locale e container Docker.
  private resolveThemePath(filename: string): string {
    if (process.env.THEMES_DIR) {
      return path.join(process.env.THEMES_DIR, filename);
    }

    const candidates = [
      // ✅ CORRETTO per questo container: dist/sitebuilder/ → 2 su → /app/apps/backend/
      path.resolve(__dirname, '..', '..', 'public', 'themes', filename),
      // Fallback se tsconfig genera dist/src/sitebuilder/
      path.resolve(__dirname, '..', '..', '..', 'public', 'themes', filename),
      path.resolve(__dirname, '..', '..', '..', '..', 'public', 'themes', filename),
      path.resolve(process.cwd(), 'public', 'themes', filename),
    ];

    for (const candidate of candidates) {
      this.logger.debug(`Cerco in: ${candidate}`);
      if (fs.existsSync(candidate)) return candidate;
    }

    return candidates[0];
  }
}