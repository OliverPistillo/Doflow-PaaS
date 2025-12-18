import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // ✅ mantiene /api/health
  @Get()
  live() {
    return { status: 'ok', service: 'doflow-backend' };
  }

  // ✅ aggiunge /api/health/system
  @Get('system')
  system() {
    return this.health.system();
  }
}
