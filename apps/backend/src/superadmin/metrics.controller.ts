import { Controller, Get, UseGuards } from '@nestjs/common';
import { MetricsService } from './metrics.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/metrics')
@UseGuards(JwtAuthGuard)
export class MetricsController {
  constructor(private readonly metricsService: MetricsService) {}

  @Get()
  async getDashboardMetrics() {
    return this.metricsService.getDashboardMetrics();
  }
}
