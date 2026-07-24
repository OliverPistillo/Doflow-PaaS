import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantReportsService } from './tenant-reports.service';

@Controller('tenant/reports')
@UseGuards(JwtAuthGuard)
export class TenantReportsController {
  constructor(private readonly service: TenantReportsService) {}

  @Get('summary')
  summary(@Query() query: Record<string, any>) {
    return this.service.summary(query || {});
  }

  @Get('executive')
  executive(@Query() query: Record<string, any>) {
    return this.service.executive(query || {});
  }

  @Get('sales')
  sales(@Query() query: Record<string, any>) {
    return this.service.sales(query || {});
  }

  @Get('projects')
  projects(@Query() query: Record<string, any>) {
    return this.service.projects(query || {});
  }

  @Get('finance')
  finance(@Query() query: Record<string, any>) {
    return this.service.finance(query || {});
  }

  @Get('team')
  team(@Query() query: Record<string, any>) {
    return this.service.team(query || {});
  }

  @Get('documents')
  documents(@Query() query: Record<string, any>) {
    return this.service.documents(query || {});
  }

  @Get('operations')
  operations(@Query() query: Record<string, any>) {
    return this.service.operations(query || {});
  }

  @Get('customers')
  customers(@Query() query: Record<string, any>) {
    return this.service.customers(query || {});
  }

  @Get('compare')
  compare(@Query() query: Record<string, any>) {
    return this.service.compare(query || {});
  }

  @Get('targets')
  listTargets(@Query() query: Record<string, any>) {
    return this.service.listTargets(query || {});
  }

  @Post('targets')
  createTarget(@Body() body: Record<string, any>) {
    return this.service.createTarget(body || {});
  }

  @Patch('targets/:id')
  updateTarget(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateTarget(id, body || {});
  }

  @Delete('targets/:id')
  deleteTarget(@Param('id') id: string) {
    return this.service.deleteTarget(id);
  }

  @Get('saved-views')
  listSavedViews(@Query() query: Record<string, any>) {
    return this.service.listSavedViews(query || {});
  }

  @Post('saved-views')
  createSavedView(@Body() body: Record<string, any>) {
    return this.service.createSavedView(body || {});
  }

  @Patch('saved-views/:id')
  updateSavedView(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateSavedView(id, body || {});
  }

  @Delete('saved-views/:id')
  deleteSavedView(@Param('id') id: string) {
    return this.service.deleteSavedView(id);
  }

  @Get('snapshots')
  listSnapshots(@Query() query: Record<string, any>) {
    return this.service.listSnapshots(query || {});
  }

  @Post('snapshots')
  createSnapshot(@Body() body: Record<string, any>, @Query() query: Record<string, any>) {
    return this.service.createSnapshot(body || {}, query || {});
  }

  @Get('snapshots/:id')
  getSnapshot(@Param('id') id: string) {
    return this.service.getSnapshot(id);
  }

  @Delete('snapshots/:id')
  deleteSnapshot(@Param('id') id: string) {
    return this.service.deleteSnapshot(id);
  }

  @Get(':reportKey/export')
  export(@Param('reportKey') reportKey: string, @Query() query: Record<string, any>) {
    return this.service.exportReport(reportKey, query || {});
  }

  @Post('targets/seed-base')
  seedBaseTargets() {
    return this.service.seedBaseTargets();
  }
}
