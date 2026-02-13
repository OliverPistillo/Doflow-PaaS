import { Controller, Get, Query } from '@nestjs/common';
import { SystemStatsService } from './telemetry.service';
import { TelemetryService } from '../telemetry/telemetry.service';

@Controller('superadmin/system')
export class SystemController {
  constructor(
    private readonly systemStatsService: SystemStatsService,
    private readonly telemetryService: TelemetryService
  ) {}

  // --- ENDPOINT 1: Hardware Stats (CPU, RAM, Redis Status) ---
  @Get('health') // Manteniamo 'health' se il frontend chiama questo
  async getSystemHealth() {
    // FIX: Usa il nome corretto del metodo definito nel tuo service
    const stats = await this.systemStatsService.getSystemStats();
    return stats;
  }

  // Se il frontend chiama /stats invece di /health, aggiungi questo alias:
  @Get('stats')
  async getStatsAlias() {
      return this.systemStatsService.getSystemStats();
  }

  // --- ENDPOINT 2: Traffic Logs (Shadow Logs) ---
  @Get('traffic-logs')
  async getTrafficLogs(@Query('limit') limit?: string) {
    const logLimit = limit ? parseInt(limit) : 50;
    const logs = await this.telemetryService.getRecentLogs(logLimit);
    
    return {
      status: 'success',
      engine: 'Doflow v3.5 (Shadow Logging Active)',
      count: logs.length,
      data: logs
    };
  }
}