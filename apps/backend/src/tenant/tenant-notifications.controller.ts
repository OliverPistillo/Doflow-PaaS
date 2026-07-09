import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Req, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantNotificationsService } from './tenant-notifications.service';

@Controller('tenant/notifications')
@UseGuards(JwtAuthGuard)
export class TenantNotificationsController {
  constructor(private readonly service: TenantNotificationsService) {}

  @Get()
  list(@Req() req: any, @Query() query: Record<string, any>) {
    return this.service.list(req, query || {});
  }

  @Get('summary')
  summary(@Req() req: any) {
    return this.service.summary(req);
  }

  @Patch('mark-all-read')
  markAllRead(@Req() req: any) {
    return this.service.markAllRead(req);
  }

  @Get('preferences')
  preferences(@Req() req: any) {
    return this.service.getPreferences(req);
  }

  @Patch('preferences')
  updatePreferences(@Req() req: any, @Body() body: Record<string, any>) {
    return this.service.updatePreferences(req, body || {});
  }

  @Get('rules')
  rules(@Req() req: any) {
    return this.service.listRules(req);
  }

  @Patch('rules/:key')
  updateRule(@Req() req: any, @Param('key') key: string, @Body() body: Record<string, any>) {
    return this.service.updateRule(req, key, body || {});
  }

  @Post('rules/run')
  runRules(@Req() req: any) {
    return this.service.runRulesFromRequest(req);
  }

  @Post('rules/:key/run')
  runRule(@Req() req: any, @Param('key') key: string) {
    return this.service.runRulesFromRequest(req, key);
  }

  @Get('digests')
  digests(@Req() req: any) {
    return this.service.listDigests(req);
  }

  @Get('digests/today')
  todayDigest(@Req() req: any) {
    return this.service.todayDigest(req);
  }

  @Post('digests/generate')
  generateDigest(@Req() req: any) {
    return this.service.generateDigestFromRequest(req);
  }

  @Get(':id')
  getOne(@Req() req: any, @Param('id') id: string) {
    return this.service.getOne(req, id);
  }

  @Patch(':id/read')
  markRead(@Req() req: any, @Param('id') id: string) {
    return this.service.setStatus(req, id, 'read');
  }

  @Patch(':id/unread')
  markUnread(@Req() req: any, @Param('id') id: string) {
    return this.service.setStatus(req, id, 'unread');
  }

  @Patch(':id/archive')
  archive(@Req() req: any, @Param('id') id: string) {
    return this.service.setStatus(req, id, 'archived');
  }

  @Delete(':id')
  delete(@Req() req: any, @Param('id') id: string) {
    return this.service.softDelete(req, id);
  }
}
