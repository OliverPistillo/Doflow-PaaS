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

  @Get('templates/:templateId')
  template(@Param('templateId') templateId: string) {
    return this.service.getTemplate(templateId);
  }

  @Get('rules')
  rules(@Query() query: Record<string, any>) {
    return this.service.listRules(query || {});
  }

  @Post('rules')
  createRule(@Body() body: Record<string, any>) {
    return this.service.createRule(body || {});
  }

  @Patch('rules/:ruleId/enable')
  enableRule(@Param('ruleId') ruleId: string) {
    return this.service.setEnabled(ruleId, true);
  }

  @Patch('rules/:ruleId/disable')
  disableRule(@Param('ruleId') ruleId: string) {
    return this.service.setEnabled(ruleId, false);
  }

  @Post('rules/:ruleId/run')
  runRule(@Param('ruleId') ruleId: string, @Body() body: Record<string, unknown>) {
    return this.service.runRuleFromRequest(ruleId, body || {});
  }

  @Get('rules/:ruleId/runs')
  ruleRuns(@Param('ruleId') ruleId: string, @Query() query: Record<string, any>) {
    return this.service.listRuleRuns(ruleId, query || {});
  }

  @Get('rules/:ruleId/export')
  exportRule(@Param('ruleId') ruleId: string) {
    return this.service.exportRule(ruleId);
  }

  @Get('rules/:ruleId')
  rule(@Param('ruleId') ruleId: string) {
    return this.service.getRule(ruleId);
  }

  @Patch('rules/:ruleId')
  updateRule(@Param('ruleId') ruleId: string, @Body() body: Record<string, any>) {
    return this.service.updateRule(ruleId, body || {});
  }

  @Delete('rules/:ruleId')
  deleteRule(@Param('ruleId') ruleId: string) {
    return this.service.deleteRule(ruleId);
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

  @Get('runs/:runId/actions')
  runActions(@Param('runId') runId: string) {
    return this.service.listRunActions(runId);
  }

  @Get('runs/:runId/export')
  exportRun(@Param('runId') runId: string) {
    return this.service.exportRun(runId);
  }

  @Get('runs/:runId')
  run(@Param('runId') runId: string) {
    return this.service.getRun(runId);
  }

  @Get('activity')
  activity(@Query() query: Record<string, any>) {
    return this.service.activity(query || {});
  }

  @Get('dedupe')
  dedupe(@Query() query: Record<string, any>) {
    return this.service.listDedupe(query || {});
  }

  @Delete('dedupe/:dedupeId')
  deleteDedupe(@Param('dedupeId') dedupeId: string) {
    return this.service.deleteDedupe(dedupeId);
  }

  @Get('options')
  options() {
    return this.service.options();
  }

}
