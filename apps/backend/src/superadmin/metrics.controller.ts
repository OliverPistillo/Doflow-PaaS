import { Controller, Get, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PlatformSuperadminGuard } from './platform-superadmin.guard';

@Controller('superadmin/metrics')
@UseGuards(JwtAuthGuard, PlatformSuperadminGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getDashboardMetrics() {
    return this.metricsService.getDashboardMetrics();
  }
}
