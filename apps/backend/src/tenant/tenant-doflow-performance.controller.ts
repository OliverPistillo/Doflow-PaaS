import { Body, Controller, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantDoflowPerformanceService } from './tenant-doflow-performance.service';

@Controller('tenant/doflow/performance')
@UseGuards(JwtAuthGuard)
export class TenantDoflowPerformanceController {
  constructor(private readonly service: TenantDoflowPerformanceService) {}

  @Get()
  state() { return this.service.state(); }

  @Patch('point-policy')
  updatePolicy(@Body() body: Record<string, unknown>) { return this.service.updatePolicy(body || {}); }

  @Post('point-ledger/adjustments')
  adjustment(@Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) {
    return this.service.manualAdjustment(body || {}, String(key || ''));
  }

  @Patch('rankings/configs/:role')
  updateRanking(@Param('role') role: string, @Body() body: Record<string, unknown>) {
    return this.service.updateRankingConfig(role, body || {});
  }

  @Get('rankings/preview')
  preview(@Query('period') period: string, @Query('role') role: string) {
    return this.service.previewRanking(period, role);
  }

  @Post('rankings/:period/:role/consolidate')
  consolidate(@Param('period') period: string, @Param('role') role: string, @Body() body: Record<string, unknown>) {
    return this.service.consolidateRanking(period, role, body?.reason);
  }

  @Post('rankings/snapshots/:id/recalculate')
  recalculate(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.consolidateRanking(String(body.period || ''), String(body.role || ''), body.reason, id);
  }

  @Post('rankings/snapshots/:id/revoke')
  revoke(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.revokeSnapshot(id, body?.reason);
  }

  @Patch('adapters/acceptance-synthetic')
  synthetic(@Body() body: Record<string, unknown>) { return this.service.setSyntheticAdapter(Boolean(body.enabled)); }
}
