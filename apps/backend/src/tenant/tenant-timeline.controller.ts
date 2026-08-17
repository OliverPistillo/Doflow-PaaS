import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantTimelineService } from './tenant-timeline.service';

@Controller('tenant/timeline')
@UseGuards(JwtAuthGuard)
export class TenantTimelineController {
  constructor(private readonly service: TenantTimelineService) {}

  @Get('projects')
  listProjectTimeline(@Query() query: Record<string, any>) {
    return this.service.listProjects(query || {});
  }

  @Get()
  list(@Query() query: Record<string, any>) {
    return this.service.list(query);
  }

  @Post('note')
  createNote(@Body() body: Record<string, any>) {
    return this.service.createNote(body);
  }

  @Post('activity')
  createActivity(@Body() body: Record<string, any>) {
    return this.service.createActivity(body);
  }

  @Post('appointment')
  createAppointment(@Body() body: Record<string, any>) {
    return this.service.createAppointment(body);
  }

  @Post('call')
  createCall(@Body() body: Record<string, any>) {
    return this.service.createCall(body);
  }

  @Post('external-message')
  createExternalMessage(@Body() body: Record<string, any>) {
    return this.service.createExternalMessage(body);
  }
}
