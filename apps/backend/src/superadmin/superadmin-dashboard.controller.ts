import { Controller, Get, Patch, Body, Query, Param, UseGuards, SetMetadata } from '@nestjs/common';
import { SuperadminDashboardService } from './superadmin-dashboard.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { GetDealsQueryDto, UpdateDealDto } from './dto/deals.dto';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller('superadmin/dashboard')
@UseGuards(JwtAuthGuard)
export class SuperadminDashboardController {
  constructor(private readonly dashboardService: SuperadminDashboardService) {}

  // 1. KPI Generali (Esistente)
  @Get('stats')
  @Roles('superadmin')
  async getStats() {
    return this.dashboardService.getSalesStats();
  }

  // 2. Lista Filtrata (Drill-down)
  @Get('deals')
  @Roles('superadmin')
  async getDeals(@Query() query: GetDealsQueryDto) {
    return this.dashboardService.findAllDeals(query);
  }

  // 3. Clienti Unici (Per i filtri)
  @Get('filters/clients')
  @Roles('superadmin')
  async getClients() {
    return this.dashboardService.getUniqueClients();
  }

  // 4. Modifica Offerta
  @Patch('deals/:id')
  @Roles('superadmin')
  async updateDeal(@Param('id') id: string, @Body() body: UpdateDealDto) {
    return this.dashboardService.updateDeal(id, body);
  }
}