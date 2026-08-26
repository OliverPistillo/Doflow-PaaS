import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RequireFeature } from '../feature-access/feature-access.decorator';
import { TenantCompanyIntelligenceService } from './tenant-company-intelligence.service';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';
import { RequireTenantCapability, TenantUniversalCapabilityGuard } from './tenant-universal-capability.guard';

@Controller('tenant/company-intelligence')
@UseGuards(JwtAuthGuard, TenantUniversalScopeGuard, TenantUniversalCapabilityGuard)
@RequireFeature('crm.sales-intel')
@RequireTenantCapability('canViewAssignedLeads')
export class TenantCompanyIntelligenceController {
  constructor(private readonly service: TenantCompanyIntelligenceService) {}
  @Get('provider') provider() { return this.service.provider(); }
  @Get() list() { return this.service.list(); }
  @RequireTenantCapability('canAnalyzeCompanies')
  @Post() analyze(@Body() body: Record<string, unknown>) { return this.service.analyze(body || {}); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
}
