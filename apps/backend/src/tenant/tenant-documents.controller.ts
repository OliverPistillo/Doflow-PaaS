import {
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Inject,
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
import { REQUEST } from '@nestjs/core';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantDocumentsService } from './tenant-documents.service';
import { isDoflowTenant } from './tenant-context';
import { TenantEffectivePermissionsService } from './tenant-effective-permissions.service';

@Controller('tenant/documents')
@UseGuards(JwtAuthGuard)
export class TenantDocumentsController {
  constructor(
    private readonly service: TenantDocumentsService,
    private readonly permissions: TenantEffectivePermissionsService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private async assertDoflowAccess(action: 'view' | 'create' | 'update') {
    const user = this.request.user || this.request.authUser;
    if (!isDoflowTenant(user?.tenantId || user?.tenant_id || this.request.tenantId)) return;
    const capability = (await this.permissions.getCurrentAccess()).modules.documents;
    const allowed = action === 'view' ? capability?.can_view : action === 'create' ? capability?.can_create : capability?.can_update;
    if (!allowed) throw new ForbiddenException('Permesso documenti insufficiente.');
  }

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
  async documentsForEntity(
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query() query: Record<string, any>,
  ) {
    await this.assertDoflowAccess('view');
    return this.service.documentsForEntity(entityType, entityId, query || {});
  }

  @Post('upload')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 25 * 1024 * 1024 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, any>,
  ) {
    await this.assertDoflowAccess('create');
    return this.service.uploadDocument(file, body || {});
  }

  @Get()
  async list(@Query() query: Record<string, any>) {
    await this.assertDoflowAccess('view');
    return this.service.listDocuments(query || {});
  }

  @Get(':id/download')
  async download(@Param('id') id: string, @Res({ passthrough: true }) res: Response) {
    await this.assertDoflowAccess('view');
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
  async createVersion(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: Record<string, any>,
  ) {
    await this.assertDoflowAccess('update');
    return this.service.createVersion(id, file, body || {});
  }

  @Get(':id/activity')
  activity(@Param('id') id: string) {
    return this.service.activityForDocument(id);
  }

  @Post(':id/links')
  async createLink(@Param('id') id: string, @Body() body: Record<string, any>) {
    await this.assertDoflowAccess('update');
    return this.service.createLink(id, body || {});
  }

  @Delete(':id/links/:linkId')
  deleteLink(@Param('id') id: string, @Param('linkId') linkId: string) {
    return this.service.deleteLink(id, linkId);
  }

  @Patch(':id/archive')
  async archive(@Param('id') id: string) {
    await this.assertDoflowAccess('update');
    return this.service.setDocumentStatus(id, 'archived');
  }

  @Patch(':id/restore')
  async restore(@Param('id') id: string) {
    await this.assertDoflowAccess('update');
    return this.service.setDocumentStatus(id, 'active');
  }

  @Get(':id')
  async getOne(@Param('id') id: string) {
    await this.assertDoflowAccess('view');
    return this.service.getDocument(id);
  }

  @Patch(':id')
  async update(@Param('id') id: string, @Body() body: Record<string, any>) {
    await this.assertDoflowAccess('update');
    return this.service.updateDocument(id, body || {});
  }

  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.setDocumentStatus(id, 'deleted');
  }
}
