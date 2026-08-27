import { Body, Controller, Get, Headers, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantBonusService } from './tenant-bonus.service';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';
import { RequireTenantCapability, TenantUniversalCapabilityGuard } from './tenant-universal-capability.guard';
import { RequirePlan } from '../feature-access/feature-access.decorator';

@Controller('tenant/bonus')
@UseGuards(JwtAuthGuard, TenantUniversalScopeGuard, TenantUniversalCapabilityGuard)
@RequireTenantCapability('canViewOwnPoints')
@RequirePlan('PRO')
export class TenantBonusController {
  constructor(private readonly service: TenantBonusService) {}
  @Get() state(@Query() query: Record<string, unknown>) { return this.service.state(query || {}); }
  @Post('requests') request(@Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.requestBonus(body || {}, key); }
  @RequireTenantCapability('canManagePointPolicies')
  @Post('requests/:id/approve') approve(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.decide(id, 'approved', body || {}, key); }
  @RequireTenantCapability('canManagePointPolicies')
  @Post('requests/:id/reject') reject(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.decide(id, 'rejected', body || {}, key); }
  @RequireTenantCapability('canManagePointPolicies')
  @Post('requests/:id/payout') payout(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.payout(id, body || {}, key); }
  @RequireTenantCapability('canManagePointPolicies')
  @Post('adjustments') adjustment(@Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.adjustment(body || {}, key); }
  @RequireTenantCapability('canManagePointPolicies')
  @Post('policies/versions') policy(@Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.policyVersion(body || {}, key); }
  @RequireTenantCapability('canManagePointPolicies')
  @Post('periods/consolidate') consolidate(@Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.consolidatePeriod(body || {}, key); }
}
