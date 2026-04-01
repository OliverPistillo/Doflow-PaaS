// apps/backend/src/superadmin/subscriptions.controller.ts
// MODIFICATO: aggiunto GET /revenue-trend per la Control Room dashboard.
// Espone solo l'array revenueTrend già calcolato in getRevenueDashboard(),
// evitando di serializzare l'intera risposta revenue per un uso puntuale.

import { Controller, Get, Param, Patch, Body, UseGuards } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/subscriptions')
@UseGuards(JwtAuthGuard)
export class SubscriptionsController {
  constructor(private readonly subsService: SubscriptionsService) {}

  // ── GET /superadmin/subscriptions/revenue ────────────────────────────────
  // Risposta completa: MRR, ARR, tier breakdown, top modules, revenue trend, ecc.
  // Usato dalla pagina Subscriptions dedicata.
  @Get('revenue')
  getRevenueDashboard() {
    return this.subsService.getRevenueDashboard();
  }

  // ── GET /superadmin/subscriptions/revenue-trend ──────────────────────────
  // NUOVO: ritorna solo l'array revenueTrend per il LineChart della Control Room.
  // Shape: { revenueTrend: { month: string; amount: number }[] }
  // Evita di caricare tutto il blob /revenue quando serve solo il trend 6 mesi.
  @Get('revenue-trend')
  async getRevenueTrend() {
    const full = await this.subsService.getRevenueDashboard();
    return { revenueTrend: full.revenueTrend ?? [] };
  }

  // ── GET /superadmin/subscriptions ────────────────────────────────────────
  // Lista completa subscriptions con relazioni tenant + module.
  @Get()
  findAll() {
    return this.subsService.findAll();
  }

  // ── GET /superadmin/subscriptions/tenant/:tenantId ───────────────────────
  @Get('tenant/:tenantId')
  findByTenant(@Param('tenantId') tenantId: string) {
    return this.subsService.findByTenant(tenantId);
  }

  // ── PATCH /superadmin/subscriptions/:id/status ───────────────────────────
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'ACTIVE' | 'TRIAL' | 'EXPIRED' | 'CANCELLED' },
  ) {
    return this.subsService.updateStatus(id, body.status);
  }
}
