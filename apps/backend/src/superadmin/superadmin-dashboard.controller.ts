// apps/backend/src/superadmin/superadmin-dashboard.controller.ts
// MODIFICATO: aggiunto GET /superadmin/dashboard/activity-feed
// per il feed attività della Control Room (ultimi eventi cross-modulo).

import {
  Controller, Get, Patch, Post, Delete,
  Body, Query, Param,
  UseGuards, SetMetadata,
} from '@nestjs/common';
import { SuperadminDashboardService } from './superadmin-dashboard.service';
import { JwtAuthGuard }               from '../auth/jwt-auth.guard';
import { GetDealsQueryDto, UpdateDealDto } from './dto/deals.dto';

export const Roles = (...roles: string[]) => SetMetadata('roles', roles);

@Controller('superadmin/dashboard')
@UseGuards(JwtAuthGuard)
export class SuperadminDashboardController {
  constructor(private readonly dashboardService: SuperadminDashboardService) {}

  // ── GET /superadmin/dashboard/stats ──────────────────────────────────────
  // KPI cards Sales Dashboard: leadsCount, totalValue, winRate, avgDealValue,
  // dealsClosingThisMonth, pipeline by stage, top deals.
  @Get('stats')
  @Roles('superadmin')
  async getStats(@Query() query: GetDealsQueryDto) {
    return this.dashboardService.getSalesStats(query);
  }

  // ── GET /superadmin/dashboard/deals ──────────────────────────────────────
  // Lista dettagliata per il drill-down sheet.
  @Get('deals')
  @Roles('superadmin')
  async getDeals(@Query() query: GetDealsQueryDto) {
    return this.dashboardService.findAllDeals(query);
  }

  // ── GET /superadmin/dashboard/filters/clients ────────────────────────────
  // Dropdown clienti per la barra filtri della Sales Dashboard.
  @Get('filters/clients')
  @Roles('superadmin')
  async getClients() {
    return this.dashboardService.getUniqueClients();
  }

  // ── GET /superadmin/dashboard/activity-feed ──────────────────────────────
  // NUOVO: stream dei 20 eventi più recenti cross-modulo per la Control Room.
  // Aggrega: deal modificati, tenant creati, ticket aperti, fatture emesse.
  // Shape risposta: { items: ActivityFeedItem[] }
  @Get('activity-feed')
  @Roles('superadmin')
  async getActivityFeed(@Query('limit') limit?: string) {
    const n = limit ? Math.min(parseInt(limit, 10) || 20, 50) : 20;
    return this.dashboardService.getActivityFeed(n);
  }

  // ── PATCH /superadmin/dashboard/deals/:id ────────────────────────────────
  // Modifica deal dal drill-down form.
  @Patch('deals/:id')
  @Roles('superadmin')
  async updateDeal(
    @Param('id') id: string,
    @Body()      body: UpdateDealDto,
  ) {
    return this.dashboardService.updateDeal(id, body);
  }

  // ── POST /superadmin/dashboard/deals ─────────────────────────────────────
  @Post('deals')
  @Roles('superadmin')
  async createDeal(@Body() body: UpdateDealDto) {
    return this.dashboardService.createDeal(body);
  }

  // ── DELETE /superadmin/dashboard/deals/:id ───────────────────────────────
  @Delete('deals/:id')
  @Roles('superadmin')
  async deleteDeal(@Param('id') id: string) {
    return this.dashboardService.deleteDeal(id);
  }
}
