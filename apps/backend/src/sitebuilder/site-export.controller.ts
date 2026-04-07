// apps/backend/src/sitebuilder/site-export.controller.ts
import { Controller, Get, Query, UnauthorizedException } from '@nestjs/common';
import { SiteStorageService } from './site-storage.service';

@Controller('api/export')
export class SiteExportController {
  constructor(private readonly siteStorageService: SiteStorageService) {}

  // Endpoint chiamato dal plugin WordPress: /api/export/wp-pull?token=...
  @Get('wp-pull')
  async pullSiteData(@Query('token') token: string) {
    if (!token) {
      throw new UnauthorizedException('Token mancante');
    }

    try {
      const siteData = await this.siteStorageService.getSiteDataByToken(token);
      return {
        status: 'success',
        data: siteData
      };
    } catch (error) {
      throw new UnauthorizedException('Token invalido o dati non più disponibili');
    }
  }
}