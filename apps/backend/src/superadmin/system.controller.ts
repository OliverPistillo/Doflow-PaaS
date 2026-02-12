import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SystemStatsService } from './telemetry.service'; // Assumendo che il service sia qui

@Controller('superadmin/system')
@UseGuards(JwtAuthGuard)
export class SystemController {
  constructor(private readonly statsService: SystemStatsService) {}

  @Get('stats')
  async getStats() {
    return this.statsService.getSystemStats();
  }
}