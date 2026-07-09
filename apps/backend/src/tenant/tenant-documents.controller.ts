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
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantDocumentsService } from './tenant-documents.service';

@Controller('tenant/documents')
@UseGuards(JwtAuthGuard)
export class TenantDocumentsController {
  constructor(private readonly service: TenantDocumentsService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('folders')
  listFolders(@Query() query: Record<string, any>) {
    return this.service.listFolders(query || {});
  }

  @Post('folders')
  createFolder(@Body() body: Record<string, any>) {
    return this.service.createFolder(body || {});
  }

  @Get('folders/:id')
  getFolder(@Param('id') id: string) {
    return this.service.getFolder(id);
  }

  @Patch('folders/:id')
  updateFolder(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateFolder(id, body || {});
  }

  @Delete('folders/:id')
  deleteFolder(@Param('id') id: string) {
    return this.service.deleteFolder(id);
  }

  @Get('entity/:entityType/:entityId')
  documentsForEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query() query: Record<string, any>,
  ) {
    return this.service.documentsForEntity(entityType, entityId, query || {});
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, any>,
  ) {
    return this.service.uploadDocument(file, body || {});
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.service.listDocuments(query || {});
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    const result = await this.service.downloadDocument(id);
    res.set({
      'Content-Type': result.contentType || 'application/octet-stream',
      'Content-Length': result.contentLength,
      'Content-Disposition': `attachment; filename="${encodeURIComponent(result.filename)}"`,
    });
    return new StreamableFile(result.stream);
  }

  @Post(':id/versions')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  createVersion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, any>,
  ) {
    return this.service.createVersion(id, file, body || {});
  }

  @Get(':id/activity')
  activity(@Param('id') id: string) {
    return this.service.activityForDocument(id);
  }

  @Post(':id/links')
  createLink(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createLink(id, body || {});
  }

  @Delete(':id/links/:linkId')
  deleteLink(@Param('id') id: string, @Param('linkId') linkId: string) {
    return this.service.deleteLink(id, linkId);
  }

  @Patch(':id/archive')
  archive(@Param('id') id: string) {
    return this.service.setDocumentStatus(id, 'archived');
  }

  @Patch(':id/restore')
  restore(@Param('id') id: string) {
    return this.service.setDocumentStatus(id, 'active');
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getDocument(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateDocument(id, body || {});
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.setDocumentStatus(id, 'deleted');
  }
}
