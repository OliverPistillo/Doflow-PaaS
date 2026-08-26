import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantPreferencesService } from './tenant-preferences.service';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';

@Controller('tenant/preferences')
@UseGuards(JwtAuthGuard, TenantUniversalScopeGuard)
export class TenantPreferencesController {
  constructor(private readonly service: TenantPreferencesService) {}
  @Get() get() { return this.service.get(); }
  @Patch() update(@Body() body: Record<string, unknown>) { return this.service.update(body || {}); }
}
