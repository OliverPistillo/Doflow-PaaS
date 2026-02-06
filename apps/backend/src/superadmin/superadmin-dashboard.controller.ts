import { Controller, Get, UseGuards, SetMetadata } from '@nestjs/common';
import { SuperadminDashboardService } from './superadmin-dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

// Creiamo il decorator Roles localmente per semplicità
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller('superadmin/dashboard')
@UseGuards(JwtAuthGuard)
export class SuperadminDashboardController {
  constructor(private readonly dashboardService: SuperadminDashboardService) {}

  @Get('stats')
  // Usiamo la stringa 'superadmin' come definito nel tuo roles.ts
  @Roles('superadmin') 
  async getStats() {
    return this.dashboardService.getSalesStats();
  }
}