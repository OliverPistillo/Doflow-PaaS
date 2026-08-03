import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantSiteProposalsDoflowGuard } from './tenant-site-proposals-doflow.guard';
import { TenantSiteProposalsService } from './tenant-site-proposals.service';

@Controller('tenant/commercial/site-proposals')
@UseGuards(JwtAuthGuard, TenantSiteProposalsDoflowGuard)
export class TenantSiteProposalsController {
  constructor(private readonly service: TenantSiteProposalsService) {}

  @Get('templates')
  listTemplates() {
    return this.service.listTemplates();
  }

  @Get('templates/:slug')
  getTemplate(@Param('slug') slug: string, @Query('version') version?: string) {
    return this.service.getTemplate(slug, version);
  }

  @Post('imports/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  previewImport(@UploadedFile() file: Express.Multer.File, @Body('templateSlug') templateSlug?: string) {
    return this.service.previewImport(file, templateSlug || 'colsova');
  }

  @Get('imports/:id')
  getImport(@Param('id') id: string) {
    return this.service.getImport(id);
  }

  @Post('imports/:id/confirm')
  confirmImport(@Param('id') id: string) {
    return this.service.confirmImport(id);
  }

  @Post('imports/:id/generate')
  generateImport(@Param('id') id: string) {
    return this.service.generateImport(id);
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.service.list(query);
  }

  @Post()
  create(@Body() body: Record<string, any>) {
    return this.service.createManual(body);
  }

  @Get(':id/activity')
  listActivity(@Param('id') id: string, @Query('limit') limit?: string, @Query('offset') offset?: string) {
    return this.service.listActivity(id, { limit, offset });
  }

  @Get(':id')
  get(@Param('id') id: string) {
    return this.service.get(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.update(id, body);
  }

  @Get(':id/versions')
  listVersions(@Param('id') id: string) {
    return this.service.listVersions(id);
  }

  @Post(':id/versions/:version/restore')
  restoreVersion(@Param('id') id: string, @Param('version') version: string) {
    return this.service.restoreVersion(id, Number(version));
  }

  @Post(':id/generate')
  generate(@Param('id') id: string) {
    return this.service.generateProposal(id);
  }

  @Get(':id/generations')
  listGenerations(@Param('id') id: string) {
    return this.service.listGenerations(id);
  }

  @Get(':id/preview')
  async preview(@Param('id') id: string, @Query('generationId') generationId: string | undefined, @Res() res: Response) {
    const stream = await this.service.previewHtml(id, generationId);
    res.set({
      'Content-Type': 'text/html; charset=utf-8',
      'Content-Disposition': 'inline',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; img-src data: https:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-src 'none'; object-src 'none'; connect-src 'none'; media-src 'none'",
      'Cross-Origin-Resource-Policy': 'same-origin',
    });
    stream.pipe(res);
  }

  @Get(':id/download/html')
  async downloadHtml(@Param('id') id: string, @Query('generationId') generationId: string | undefined, @Res() res: Response) {
    const file = await this.service.downloadArtifact(id, 'html', generationId);
    res.set({
      'Content-Type': file.contentType || 'text/html; charset=utf-8',
      'Content-Disposition': 'attachment; filename="index.html"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    file.stream.pipe(res);
  }

  @Get(':id/download/zip')
  async downloadZip(@Param('id') id: string, @Query('generationId') generationId: string | undefined, @Res() res: Response) {
    const file = await this.service.downloadArtifact(id, 'zip', generationId);
    res.set({
      'Content-Type': file.contentType || 'application/zip',
      'Content-Disposition': 'attachment; filename="demo.zip"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    });
    file.stream.pipe(res);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.service.archive(id);
  }
}
