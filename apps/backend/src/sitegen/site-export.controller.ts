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
import { ExportStoreService } from './storage/export-store.service';
import * as path from 'path';
import * as fs from 'fs';
import { legacyThemeIdForSiteKind } from './theme-compat/theme-map';

@Controller(['export', 'sitegen/export'])
export class SiteExportController {
  private readonly logger = new Logger(SiteExportController.name);

  constructor(private readonly exportStoreService: ExportStoreService) {}

  @Get('wp-pull')
  async pullSiteData(@Query('token') token: string) {
    if (!token) {
      throw new UnauthorizedException('Token mancante');
    }

    const siteData = await this.exportStoreService.getSiteDataByToken(token);
    return { status: 'success', data: siteData };
  }

  @Get('manifest/:token')
  async pullManifest(@Param('token') token: string) {
    if (!token) {
      throw new UnauthorizedException('Token mancante');
    }

    const siteData = await this.exportStoreService.getSiteDataByToken(token);
    return { status: 'success', data: siteData };
  }

  @Get('theme/:themeId')
  async downloadTheme(@Param('themeId') themeId: string, @Res() res: Response) {
    if (!themeId || !/^[a-z0-9\-]+$/i.test(themeId)) {
      throw new BadRequestException('themeId non valido.');
    }

    const resolvedThemeId = this.resolveThemeId(themeId);
    const zipName = `${resolvedThemeId}.zip`;
    const zipPath = this.resolveThemePath(zipName);

    this.logger.log(`Richiesta tema: ${zipName} → ${zipPath}`);

    if (!fs.existsSync(zipPath)) {
      this.logger.error(`File non trovato: ${zipPath}`);
      throw new NotFoundException(
        `Tema "${resolvedThemeId}" non trovato. Path cercato: ${zipPath}`,
      );
    }

    const stat = fs.statSync(zipPath);

    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Cache-Control', 'no-cache');

    fs.createReadStream(zipPath).pipe(res);
  }

  private resolveThemeId(themeId: string): string {
    if (themeId === 'doflow-theme') {
      return themeId;
    }

    if ((['agency', 'startup', 'studio', 'local-business', 'ecommerce'] as string[]).includes(themeId)) {
      return legacyThemeIdForSiteKind(themeId as any);
    }

    return themeId;
  }

  private resolveThemePath(filename: string): string {
    if (process.env.THEMES_DIR) {
      return path.join(process.env.THEMES_DIR, filename);
    }

    const candidates = [
      path.resolve(__dirname, '..', '..', 'public', 'themes', filename),
      path.resolve(__dirname, '..', '..', '..', 'public', 'themes', filename),
      path.resolve(__dirname, '..', '..', '..', '..', 'public', 'themes', filename),
      path.resolve(process.cwd(), 'apps', 'backend', 'public', 'themes', filename),
      path.resolve(process.cwd(), 'public', 'themes', filename),
    ];

    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) {
        return candidate;
      }
    }

    return candidates[0];
  }
}
