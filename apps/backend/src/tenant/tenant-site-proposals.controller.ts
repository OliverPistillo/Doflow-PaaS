import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UnprocessableEntityException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantSiteProposalsDoflowGuard } from './tenant-site-proposals-doflow.guard';
import { TenantSiteProposalsService } from './tenant-site-proposals.service';
import { TenantSiteProposalsThemeService } from './tenant-site-proposals-theme.service';

@Controller('tenant/commercial/site-proposals')
@UseGuards(JwtAuthGuard, TenantSiteProposalsDoflowGuard)
export class TenantSiteProposalsController {
  constructor(private readonly service: TenantSiteProposalsService, private readonly themes: TenantSiteProposalsThemeService) {}

  @Get('templates')
  listTemplates() {
    return this.service.listTemplates();
  }

  @Get('templates/:slug')
  getTemplate(@Param('slug') slug: string, @Query('version') version?: string) {
    return this.service.getTemplate(slug, version);
  }

  @Get('themes')
  listThemes() { return this.themes.list(); }

  @Post('themes/upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadTheme(@UploadedFile() file?: Express.Multer.File) { return this.themes.upload(file); }

  @Get('themes/:slug/:version')
  getTheme(@Param('slug') slug: string, @Param('version') version: string) { return this.themes.get(slug, version); }

  @Get('themes/:slug/:version/preview')
  async previewTheme(@Param('slug') slug: string, @Param('version') version: string, @Res() res: Response) {
    const rendered = await this.themes.preview(slug, version);
    res.set({ 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    res.send(rendered.html);
  }

  @Get('themes/:slug/:version/download')
  async downloadTheme(@Param('slug') slug: string, @Param('version') version: string, @Res() res: Response) {
    const file = await this.themes.download(slug, version);
    res.set({ 'Content-Type': file.contentType || 'application/zip', 'Content-Disposition': `attachment; filename="${slug}-${version}.zip"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
    file.stream.pipe(res);
  }

  @Post('themes/:slug/:version/activate')
  activateTheme(@Param('slug') slug: string, @Param('version') version: string) { return this.themes.activate(slug, version); }

  @Patch('themes/:slug/:version/disable')
  disableTheme(@Param('slug') slug: string, @Param('version') version: string) { return this.themes.disable(slug, version); }

  @Post('themes/:slug/:version/default')
  defaultTheme(@Param('slug') slug: string, @Param('version') version: string) { return this.themes.setDefault(slug, version); }

  @Delete('themes/:slug/:version')
  deleteTheme(@Param('slug') slug: string, @Param('version') version: string) { return this.themes.delete(slug, version); }

  @Post('imports/preview')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 2 * 1024 * 1024 } }))
  previewImport(@UploadedFile() file: Express.Multer.File, @Body('templateSlug') templateSlug?: string, @Body('templateVersion') templateVersion?: string) {
    return this.service.previewImport(file, templateSlug, templateVersion);
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

  @Post('imports/:id/prepare')
  prepareImport(@Param('id') id: string, @Body() body: unknown) { return this.service.prepareImport(id, body); }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.service.list(query);
  }

  @Post('bulk/archive')
  archiveBulk(@Body() body: unknown) {
    return this.service.archiveBulk(body);
  }

  @Post('bulk/restore')
  restoreBulk(@Body() body: unknown) {
    return this.service.restoreBulk(body);
  }

  @Delete('bulk')
  deleteBulk(@Body() body: unknown) {
    return this.service.deleteBulk(body);
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

  @Post(':id/template-upgrade')
  upgradeTemplate(@Param('id') id: string, @Body() body: unknown) {
    return this.service.upgradeTemplate(id, body);
  }

  @Post(':id/personalize')
  personalize(@Param('id') id: string, @Body() body: unknown) {
    return this.service.personalizeProposal(id, body);
  }

  @Post(':id/prepare')
  prepare(@Param('id') id: string, @Body() body: unknown) { return this.service.prepareProposal(id, body); }

  @Get(':id/personalizations')
  personalizations(@Param('id') id: string) {
    return this.service.listPersonalizations(id);
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
  async generate(@Param('id') id: string) {
    const result = await this.service.generateProposal(id);
    if (result.status === 'failed') {
      throw new UnprocessableEntityException(this.generationFailureMessage(result.error_message));
    }
    return result;
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

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.service.restore(id);
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  private generationFailureMessage(value: unknown): string {
    if (typeof value !== 'string' || !value.trim()) return 'Generazione non riuscita.';
    const message = value.replace(/[\r\n]+/g, ' ').slice(0, 500);
    return /stack|sql|postgres|s3|stack trace/i.test(message) ? 'Generazione non riuscita.' : message;
  }
}
