import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private readonly health: HealthService) {}

  // ✅ compatibilità con quello che testavi prima
  @Get()
  live() {
    return { status: 'ok', service: 'doflow-backend' };
  }

  // ✅ quello che serve alla dashboard
  @Get('system')
  system() {
    return this.health.system();
  }
}
