// apps/backend/src/superadmin/system.controller.ts
// MODIFICATO: aggiunto endpoint GET /health-summary per la Control Room.
// Aggrega i 3 service status (DB, Redis, API) in un singolo semaforo.

import { Controller, Get, Query } from '@nestjs/common';
import { SystemStatsService } from './telemetry.service';
import { TelemetryService } from '../telemetry/telemetry.service';

@Controller('superadmin/system')
export class SystemController {
  constructor(
    private readonly systemStatsService: SystemStatsService,
    private readonly telemetryService: TelemetryService,
  ) {}

  // ── GET /superadmin/system/health ────────────────────────────────────────
  // Dati completi hardware + service status (usato dal System Monitor frontend).
  @Get('health')
  async getSystemHealth() {
    return this.systemStatsService.getSystemStats();
  }

  // ── GET /superadmin/system/stats ─────────────────────────────────────────
  // Alias di /health — mantenuto per compatibilità con il tab-overview.tsx.
  @Get('stats')
  async getStatsAlias() {
    return this.systemStatsService.getSystemStats();
  }

  // ── GET /superadmin/system/health-summary ────────────────────────────────
  // NUOVO: semaforo aggregato per la Control Room dashboard.
  // Ritorna { status: "up" | "degraded" | "down" } senza caricare i dati HW.
  // "up"       → tutti e 3 i servizi sono "up"
  // "down"     → almeno un servizio è "down"
  // "degraded" → almeno un servizio è "unknown" (ma nessuno è "down")
  @Get('health-summary')
  async getHealthSummary() {
    const stats = await this.systemStatsService.getSystemStats();
    const { database, redis, api } = stats.services;
    const vals = [database, redis, api];

    let status: 'up' | 'degraded' | 'down' = 'up';

    if (vals.some((v) => String(v).toLowerCase() === 'down')) {
      status = 'down';
    } else if (vals.some((v) => String(v).toLowerCase() !== 'up')) {
      status = 'degraded';
    }

    return { status };
  }

  // ── GET /superadmin/system/traffic-logs ──────────────────────────────────
  // Log di traffico real-time dal motore shadow logging Redis.
  @Get('traffic-logs')
  async getTrafficLogs(@Query('limit') limit?: string) {
    const logLimit = limit ? parseInt(limit, 10) : 50;
    const logs = await this.telemetryService.getRecentLogs(logLimit);

    return {
      status:  'success',
      engine:  'Doflow v3.5 (Shadow Logging Active)',
      count:   logs.length,
      data:    logs,
    };
  }
}
