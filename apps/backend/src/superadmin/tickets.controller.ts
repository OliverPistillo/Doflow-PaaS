// apps/backend/src/superadmin/tickets.controller.ts
// MODIFICATO: getStats() ora include openCount nel response
// per alimentare la card "Ticket Aperti" della Control Room.

import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, UseGuards,
} from '@nestjs/common';
import { TicketsService } from './tickets.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/tickets')
@UseGuards(JwtAuthGuard)
export class TicketsController {
  constructor(private readonly ticketsService: TicketsService) {}

  // ── GET /superadmin/tickets/stats ────────────────────────────────────────
  // MODIFICATO: aggiunto openCount nel return per la Control Room.
  // Il service ritorna byStatus (Record<string, number>); lo esplicitiamo
  // come campo di primo livello per semplicità di consumo nel frontend.
  @Get('stats')
  async getStats() {
    const stats = await this.ticketsService.getStats();

    // Il service espone già `open` come campo diretto nel return.
    // Lo aliasamo come `openCount` per il frontend Control Room
    // senza rompere chi già consuma `stats.open`.
    return {
      ...stats,
      openCount: stats.open ?? 0,
    };
  }

  // ── GET /superadmin/tickets ──────────────────────────────────────────────
  @Get()
  findAll(
    @Query('status')   status?:   string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('search')   search?:   string,
  ) {
    return this.ticketsService.findAll({
      status:   status   as any,
      priority: priority as any,
      category: category as any,
      search,
    });
  }

  // ── GET /superadmin/tickets/:id ──────────────────────────────────────────
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  // ── POST /superadmin/tickets ─────────────────────────────────────────────
  @Post()
  create(@Body() dto: any) {
    return this.ticketsService.create(dto);
  }

  // ── PUT /superadmin/tickets/:id ──────────────────────────────────────────
  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.ticketsService.update(id, dto);
  }

  // ── POST /superadmin/tickets/:id/reply ──────────────────────────────────
  @Post(':id/reply')
  addReply(
    @Param('id') id: string,
    @Body() dto: { author: string; message: string; isInternal?: boolean },
  ) {
    return this.ticketsService.addReply(id, dto);
  }

  // ── PATCH /superadmin/tickets/:id/status ─────────────────────────────────
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: string },
  ) {
    return this.ticketsService.updateStatus(id, body.status as any);
  }

  // ── DELETE /superadmin/tickets/:id ───────────────────────────────────────
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketsService.delete(id);
  }
}