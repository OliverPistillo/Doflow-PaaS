import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // ✅ mantiene /api/health
  @Get()
  live() {
    return { status: 'ok', service: 'doflow-backend', marker: 'health-v2-2025-12-18' };
  }

  // ✅ aggiunge /api/health/system
  @Get('system')
  system() {
    return this.health.system();
  }
}
