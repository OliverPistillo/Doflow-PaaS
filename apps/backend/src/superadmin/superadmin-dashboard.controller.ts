import { Controller, Get, Patch, Body, Query, Param, UseGuards, SetMetadata } from '@nestjs/common';
import { SuperadminDashboardService } from './superadmin-dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetDealsQueryDto, UpdateDealDto } from './dto/deals.dto';

// Helper per i ruoli
export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller('superadmin/dashboard')
@UseGuards(JwtAuthGuard)
export class SuperadminDashboardController {
  constructor(private readonly dashboardService: SuperadminDashboardService) {}

  // 1. STATISTICHE GENERALI (KPI Cards)
  // Supporta gli stessi filtri della lista per coerenza numerica
  @Get('stats')
  @Roles('superadmin')
  async getStats(@Query() query: GetDealsQueryDto) {
    return this.dashboardService.getSalesStats(query);
  }

  // 2. LISTA DETTAGLIATA (Drill-down Sheet)
  @Get('deals')
  @Roles('superadmin')
  async getDeals(@Query() query: GetDealsQueryDto) {
    return this.dashboardService.findAllDeals(query);
  }

  // 3. DROPDOWN CLIENTI (Per la barra filtri)
  @Get('filters/clients')
  @Roles('superadmin')
  async getClients() {
    return this.dashboardService.getUniqueClients();
  }

  // 4. MODIFICA DEAL (Form di dettaglio)
  @Patch('deals/:id')
  @Roles('superadmin')
  async updateDeal(
    @Param('id') id: string, 
    @Body() body: UpdateDealDto
  ) {
    return this.dashboardService.updateDeal(id, body);
  }
}