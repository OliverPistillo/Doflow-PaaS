import { Body, Controller, Delete, Get, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantPresenceService } from './tenant-presence.service';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';
import { RequireTenantCapability, TenantUniversalCapabilityGuard } from './tenant-universal-capability.guard';

@Controller('tenant/collaboration/presence')
@UseGuards(JwtAuthGuard, TenantUniversalScopeGuard, TenantUniversalCapabilityGuard)
@RequireTenantCapability('canViewProjects')
export class TenantPresenceController {
  constructor(private readonly service: TenantPresenceService) {}
  @Get() list() { return this.service.list(); }
  @Post() heartbeat(@Body() body: Record<string, unknown>) { return this.service.heartbeat(body || {}); }
  @Delete() disconnect() { return this.service.disconnect(); }
}
