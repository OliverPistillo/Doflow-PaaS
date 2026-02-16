import { Controller, Get, Post, Body, Req, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { TenantDashboardService } from './tenant-dashboard.service';

@Controller('tenant/dashboard')
export class TenantDashboardController {
  private readonly logger = new Logger(TenantDashboardController.name);

  constructor(private readonly service: TenantDashboardService) {}

  private getContext(req: Request) {
    const user = (req as any).user;
    // FIX: Se req.tenantId non c'è (middleware mancante), prendilo dal token utente
    const tenantId = (req as any).tenantId || user?.tenantId || 'public';
    
    if (!user) throw new UnauthorizedException();
    return { userId: user.sub || user.id, tenantId };
  }

  @Get()
  async getLayout(@Req() req: Request) {
    const { userId, tenantId } = this.getContext(req);
    // this.logger.log(`GET Dashboard layout for user ${userId} in tenant ${tenantId}`);
    return this.service.getUserLayout(tenantId, userId);
  }

  @Post()
  async saveLayout(@Req() req: Request, @Body() body: { widgets: any[] }) {
    const { userId, tenantId } = this.getContext(req);
    // this.logger.log(`SAVING Dashboard layout for user ${userId} in tenant ${tenantId}`);
    return this.service.saveUserLayout(tenantId, userId, body.widgets);
  }
}