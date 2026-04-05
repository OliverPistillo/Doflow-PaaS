import { Controller, Get, Query } from '@nestjs/common';
import { TelemetryService } from '../telemetry/telemetry.service';

@Controller('superadmin/system')
export class SystemController {
  constructor(private readonly telemetryService: TelemetryService) {}

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

  @Get('health')
  async getSystemHealth() {
    return {
      status: 'operational',
      timestamp: new Date().toISOString(),
      node_version: process.version,
      memory: process.memoryUsage(),
      uptime: process.uptime()
    };
  }
}