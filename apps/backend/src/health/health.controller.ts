// apps/backend/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // mantiene compatibilità col tuo test attuale: https://api.doflow.it/api/health
  @Get()
  basic() {
    return { status: 'ok', service: 'doflow-backend' };
  }

  // endpoint reale per i pallini: https://api.doflow.it/api/health/system
  @Get('system')
  system() {
    return this.health.system();
  }
}
