import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, UseGuards,
} from '@nestjs/common';
import { AutomationsService } from './automations.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

@Controller('superadmin/automations')
@UseGuards(JwtAuthGuard)
export class AutomationsController {
  constructor(private readonly svc: AutomationsService) {}

  @Get('stats')
  getStats() { return this.svc.getStats(); }

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get(':id')
  findOne(@Param('id') id: string) { return this.svc.findOne(id); }

  @Post()
  create(@Body() dto: any) { return this.svc.create(dto); }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: any) { return this.svc.update(id, dto); }

  @Patch(':id/toggle')
  toggle(@Param('id') id: string, @Body() body: { isActive: boolean }) {
    return this.svc.toggle(id, body.isActive);
  }

  @Delete(':id')
  remove(@Param('id') id: string) { return this.svc.delete(id); }

  /** Test manuale: triggera un evento con contesto di prova */
  @Post('test')
  testEvent(@Body() body: { event: string; context: Record<string, any> }) {
    return this.svc.processEvent(body.event as any, body.context);
  }
}
