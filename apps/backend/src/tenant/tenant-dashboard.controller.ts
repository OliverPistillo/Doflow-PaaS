import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantDashboardService } from './tenant-dashboard.service';
import { SaveDashboardDto } from './dto/save-dashboard.dto';

@Controller('tenant/dashboard') // URL: /api/tenant/dashboard
@UseGuards(JwtAuthGuard)
export class TenantDashboardController {
  constructor(private readonly dashboardService: TenantDashboardService) {}

  @Get()
  async getLayout() {
    return this.dashboardService.getLayout();
  }

  @Post()
  async saveLayout(@Body() body: SaveDashboardDto) {
    return this.dashboardService.saveLayout(body);
  }
}