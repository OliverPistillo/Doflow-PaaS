import { Controller, Get, Post, Body, Req, UnauthorizedException, Logger } from '@nestjs/common';
import { Request } from 'express';
import { TenantDashboardService } from './tenant-dashboard.service';

@Controller('tenant/dashboard')
export class TenantDashboardController {
  private readonly logger = new Logger(TenantDashboardController.name);

  constructor(private readonly service: TenantDashboardService) {}

  private getContext(req: Request) {
    const user = (req as any).user; // Popolato dalla JwtStrategy
    if (!user) throw new UnauthorizedException();

    // Priorità: 1. Header (se c'è middleware) 2. Token JWT 3. Fallback a public (per superadmin)
    // Nota: user.tenantId viene dal payload del token che abbiamo generato in AuthService
    let tenantId = (req as any).tenantId || user.tenantId || user.tenant_id;

    // Se l'utente è un Superadmin o Owner che sta operando globalmente, potrebbe non avere un tenantId nel token.
    // In quel caso, salviamo le preferenze su 'public'.
    if (!tenantId) {
        tenantId = 'public';
    }

    const userId = user.sub || user.id;
    return { userId, tenantId };
  }

  @Get()
  async getLayout(@Req() req: Request) {
    const { userId, tenantId } = this.getContext(req);
    return this.service.getUserLayout(tenantId, userId);
  }

  @Post()
  async saveLayout(@Req() req: Request, @Body() body: { widgets: any[] }) {
    const { userId, tenantId } = this.getContext(req);
    
    if (!body || !body.widgets) {
        return { success: false, message: "No widgets provided" };
    }

    return this.service.saveUserLayout(tenantId, userId, body.widgets);
  }
}