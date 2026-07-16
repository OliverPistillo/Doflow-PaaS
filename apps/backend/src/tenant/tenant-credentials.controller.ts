import { Body, Controller, Delete, Get, Header, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantCredentialsService } from './tenant-credentials.service';

@Controller('tenant/credentials')
@UseGuards(JwtAuthGuard)
export class TenantCredentialsController {
  constructor(private readonly service: TenantCredentialsService) {}

  @Get('options')
  options() {
    return this.service.options();
  }

  @Get('dashboard')
  dashboard() {
    return this.service.dashboard();
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.service.list(query || {});
  }

  @Get('expiring')
  expiring(@Query() query: Record<string, any>) {
    return this.service.expiring(query || {});
  }

  @Get('renewals-due')
  renewalsDue(@Query() query: Record<string, any>) {
    return this.service.renewalsDue(query || {});
  }

  @Get('rotation-due')
  rotationDue(@Query() query: Record<string, any>) {
    return this.service.rotationDue(query || {});
  }

  @Post()
  create(@Body() body: Record<string, any>) {
    return this.service.create(body || {});
  }

  @Get('activity')
  @Header('Cache-Control', 'no-store, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  activity(@Query() query: Record<string, any>) {
    return this.service.activity(query || {});
  }

  @Get('export')
  @Header('Cache-Control', 'no-store, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  exportAll(@Query() query: Record<string, any>) {
    return this.service.exportAll(query || {});
  }

  @Get(':credentialId')
  @Header('Cache-Control', 'no-store, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  get(@Param('credentialId') credentialId: string) {
    return this.service.get(credentialId);
  }

  @Patch(':credentialId')
  update(@Param('credentialId') credentialId: string, @Body() body: Record<string, any>) {
    return this.service.update(credentialId, body || {});
  }

  @Delete(':credentialId')
  archive(@Param('credentialId') credentialId: string) {
    return this.service.archive(credentialId);
  }

  @Post(':credentialId/restore')
  restore(@Param('credentialId') credentialId: string) {
    return this.service.restore(credentialId);
  }

  @Post(':credentialId/secret')
  replaceSecret(@Param('credentialId') credentialId: string, @Body() body: Record<string, any>) {
    return this.service.replaceSecret(credentialId, body || {});
  }

  @Post(':credentialId/reveal')
  @Header('Cache-Control', 'no-store, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  reveal(@Param('credentialId') credentialId: string, @Body() body: Record<string, any>, @Res({ passthrough: true }) res: Response) {
    res.setHeader('Cache-Control', 'no-store, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    return this.service.reveal(credentialId, body || {});
  }

  @Post(':credentialId/rotate')
  rotate(@Param('credentialId') credentialId: string, @Body() body: Record<string, any>) {
    return this.service.rotate(credentialId, body || {});
  }

  @Get(':credentialId/permissions')
  @Header('Cache-Control', 'no-store, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  permissions(@Param('credentialId') credentialId: string) {
    return this.service.listPermissions(credentialId);
  }

  @Post(':credentialId/permissions')
  grantPermission(@Param('credentialId') credentialId: string, @Body() body: Record<string, any>) {
    return this.service.grantPermission(credentialId, body || {});
  }

  @Patch(':credentialId/permissions/:permissionId')
  updatePermission(@Param('credentialId') credentialId: string, @Param('permissionId') permissionId: string, @Body() body: Record<string, any>) {
    return this.service.updatePermission(credentialId, permissionId, body || {});
  }

  @Delete(':credentialId/permissions/:permissionId')
  deletePermission(@Param('credentialId') credentialId: string, @Param('permissionId') permissionId: string) {
    return this.service.deletePermission(credentialId, permissionId);
  }

  @Get(':credentialId/links')
  links(@Param('credentialId') credentialId: string) {
    return this.service.listLinks(credentialId);
  }

  @Post(':credentialId/links')
  createLink(@Param('credentialId') credentialId: string, @Body() body: Record<string, any>) {
    return this.service.createLink(credentialId, body || {});
  }

  @Delete(':credentialId/links/:linkId')
  deleteLink(@Param('credentialId') credentialId: string, @Param('linkId') linkId: string) {
    return this.service.deleteLink(credentialId, linkId);
  }

  @Get(':credentialId/audit')
  @Header('Cache-Control', 'no-store, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  audit(@Param('credentialId') credentialId: string, @Query() query: Record<string, any>) {
    return this.service.auditLog(credentialId, query || {});
  }

  @Get(':credentialId/rotations')
  @Header('Cache-Control', 'no-store, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  rotations(@Param('credentialId') credentialId: string) {
    return this.service.rotations(credentialId);
  }

  @Get(':credentialId/export')
  @Header('Cache-Control', 'no-store, private')
  @Header('Pragma', 'no-cache')
  @Header('Expires', '0')
  export(@Param('credentialId') credentialId: string) {
    return this.service.export(credentialId);
  }
}
