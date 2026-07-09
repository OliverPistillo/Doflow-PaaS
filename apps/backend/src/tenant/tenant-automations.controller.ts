import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantAutomationsService } from './tenant-automations.service';

@Controller('tenant/automations')
@UseGuards(JwtAuthGuard)
export class TenantAutomationsController {
  constructor(private readonly service: TenantAutomationsService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('templates')
  templates(@Query() query: Record<string, any>) {
    return this.service.listTemplates(query || {});
  }

  @Post('templates/seed-base')
  seedBaseTemplates() {
    return this.service.seedBaseTemplates();
  }

  @Get('templates/:id')
  template(@Param('id') id: string) {
    return this.service.getTemplate(id);
  }

  @Get('rules')
  rules(@Query() query: Record<string, any>) {
    return this.service.listRules(query || {});
  }

  @Post('rules')
  createRule(@Body() body: Record<string, any>) {
    return this.service.createRule(body || {});
  }

  @Get('rules/:id')
  rule(@Param('id') id: string) {
    return this.service.getRule(id);
  }

  @Patch('rules/:id')
  updateRule(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateRule(id, body || {});
  }

  @Delete('rules/:id')
  deleteRule(@Param('id') id: string) {
    return this.service.deleteRule(id);
  }

  @Patch('rules/:id/enable')
  enableRule(@Param('id') id: string) {
    return this.service.setEnabled(id, true);
  }

  @Patch('rules/:id/disable')
  disableRule(@Param('id') id: string) {
    return this.service.setEnabled(id, false);
  }

  @Post('rules/:id/run')
  runRule(@Param('id') id: string, @Body() body: Record<string, unknown>) {
    return this.service.runRuleFromRequest(id, body || {});
  }

  @Post('run-due')
  runDue() {
    return this.service.runDueFromRequest();
  }

  @Post('run-trigger/:triggerType')
  runTrigger(@Param('triggerType') triggerType: string, @Body() body: Record<string, unknown>) {
    return this.service.runTriggerFromRequest(triggerType, body || {});
  }

  @Get('runs')
  runs(@Query() query: Record<string, any>) {
    return this.service.listRuns(query || {});
  }

  @Get('runs/:id')
  run(@Param('id') id: string) {
    return this.service.getRun(id);
  }

  @Get('rules/:id/runs')
  ruleRuns(@Param('id') id: string, @Query() query: Record<string, any>) {
    return this.service.listRuleRuns(id, query || {});
  }

  @Get('runs/:id/actions')
  runActions(@Param('id') id: string) {
    return this.service.listRunActions(id);
  }

  @Get('activity')
  activity(@Query() query: Record<string, any>) {
    return this.service.activity(query || {});
  }

  @Get('dedupe')
  dedupe(@Query() query: Record<string, any>) {
    return this.service.listDedupe(query || {});
  }

  @Delete('dedupe/:id')
  deleteDedupe(@Param('id') id: string) {
    return this.service.deleteDedupe(id);
  }

  @Get('options')
  options() {
    return this.service.options();
  }

  @Get('rules/:id/export')
  exportRule(@Param('id') id: string) {
    return this.service.exportRule(id);
  }

  @Get('runs/:id/export')
  exportRun(@Param('id') id: string) {
    return this.service.exportRun(id);
  }
}
