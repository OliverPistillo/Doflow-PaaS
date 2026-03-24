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

  @Get('stats')
  getStats() {
    return this.ticketsService.getStats();
  }

  @Get()
  findAll(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
    @Query('category') category?: string,
    @Query('search') search?: string,
  ) {
    return this.ticketsService.findAll({
      status: status as any,
      priority: priority as any,
      category: category as any,
      search,
    });
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.ticketsService.findOne(id);
  }

  @Post()
  create(@Body() dto: any) {
    return this.ticketsService.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) {
    return this.ticketsService.update(id, dto);
  }

  @Post(':id/reply')
  addReply(@Param('id') id: string, @Body() dto: { author: string; message: string; isInternal?: boolean }) {
    return this.ticketsService.addReply(id, dto);
  }

  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() body: { status: string }) {
    return this.ticketsService.updateStatus(id, body.status as any);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.ticketsService.delete(id);
  }
}
