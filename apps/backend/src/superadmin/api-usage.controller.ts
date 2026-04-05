// apps/backend/src/superadmin/api-usage.controller.ts
// MODIFICATO: aggiunto alias GET /stats per compatibilità con tab-api-usage.tsx.
// Il frontend refactored chiama /superadmin/api-usage/stats;
// il metodo originale /dashboard viene mantenuto invariato.

import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiUsageService } from './api-usage.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/api-usage')
@UseGuards(JwtAuthGuard)
export class ApiUsageController {
  constructor(private readonly apiUsageService: ApiUsageService) {}

  // ── GET /superadmin/api-usage/dashboard ──────────────────────────────────
  // Endpoint originale — mantenuto per backward compat.
  @Get('dashboard')
  getDashboard() {
    return this.apiUsageService.getUsageDashboard();
  }

  // ── GET /superadmin/api-usage/stats ──────────────────────────────────────
  // NUOVO: alias di /dashboard usato dal tab-api-usage.tsx nel System Monitor.
  // Stessa risposta, percorso aggiornato al nuovo naming convention.
  @Get('stats')
  getStats() {
    return this.apiUsageService.getUsageDashboard();
  }

  // ── GET /superadmin/api-usage/rate-limits ────────────────────────────────
  @Get('rate-limits')
  getRateLimits() {
    return this.apiUsageService.getRateLimitStatus();
  }
}
