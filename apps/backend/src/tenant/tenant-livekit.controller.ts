import { Body, Controller, Delete, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantLivekitService } from './tenant-livekit.service';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';
import { RequireTenantCapability, TenantUniversalCapabilityGuard } from './tenant-universal-capability.guard';

@Controller('tenant/collaboration/calls')
@UseGuards(JwtAuthGuard, TenantUniversalScopeGuard, TenantUniversalCapabilityGuard)
@RequireTenantCapability('canViewProjects')
export class TenantLivekitController {
  constructor(private readonly service: TenantLivekitService) {}
  @Get('status') status() { return this.service.status(); }
  @Post('token') token(@Body() body: Record<string, unknown>) { return this.service.token(body || {}); }
  @Delete(':callId') end(@Param('callId') callId: string) { return this.service.end(callId); }
}
