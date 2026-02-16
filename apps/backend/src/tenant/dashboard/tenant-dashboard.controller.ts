import { Controller, Get, Post, Body, Req, UnauthorizedException } from '@nestjs/common';
import { Request } from 'express';
import { TenantDashboardService } from './tenant-dashboard.service';

@Controller('tenant/dashboard')
export class TenantDashboardController {
  constructor(private readonly service: TenantDashboardService) {}

  @Get()
  async getLayout(@Req() req: Request) {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId; // Schema name
    
    if (!user || !tenantId) throw new UnauthorizedException();

    return this.service.getUserLayout(tenantId, user.sub || user.id);
  }

  @Post()
  async saveLayout(@Req() req: Request, @Body() body: { widgets: any[] }) {
    const user = (req as any).user;
    const tenantId = (req as any).tenantId;

    if (!user || !tenantId) throw new UnauthorizedException();

    return this.service.saveUserLayout(tenantId, user.sub || user.id, body.widgets);
  }
}