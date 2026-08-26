import { Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantReleasesService } from './tenant-releases.service';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';

@Controller('tenant/releases')
@UseGuards(JwtAuthGuard, TenantUniversalScopeGuard)
export class TenantReleasesController {
  constructor(private readonly service: TenantReleasesService) {}
  @Get() list() { return this.service.list(); }
  @Post(':id/read') read(@Param('id') id: string) { return this.service.markRead(id); }
}
