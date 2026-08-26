import { Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantFlowboardsService } from './tenant-flowboards.service';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';
import { RequireTenantCapability, TenantUniversalCapabilityGuard } from './tenant-universal-capability.guard';
import { RequirePlan } from '../feature-access/feature-access.decorator';

@Controller('tenant/flowboards')
@UseGuards(JwtAuthGuard, TenantUniversalScopeGuard, TenantUniversalCapabilityGuard)
@RequireTenantCapability('canViewProjects')
@RequirePlan('PRO')
export class TenantFlowboardsController {
  constructor(private readonly service: TenantFlowboardsService) {}
  @Get() list(@Query() query: Record<string, unknown>) { return this.service.list(query || {}); }
  @RequireTenantCapability('canCreateFlowboards')
  @Post() create(@Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.create(body || {}, key); }
  @Get(':id') get(@Param('id') id: string) { return this.service.get(id); }
  @RequireTenantCapability('canUpdateFlowboards')
  @Patch(':id') update(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.update(id, body || {}, key); }
  @RequireTenantCapability('canUpdateFlowboards')
  @Post(':id/save') save(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.save(id, body || {}, key); }
  @RequireTenantCapability('canCreateFlowboardComments')
  @Post(':id/comments') comment(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.addComment(id, body || {}, key); }
  @RequireTenantCapability('canUpdateFlowboardComments')
  @Patch(':id/comments/:commentId') updateComment(@Param('id') id: string, @Param('commentId') commentId: string, @Body() body: Record<string, unknown>) { return this.service.updateComment(id, commentId, body || {}); }
  @RequireTenantCapability('canDeleteFlowboardComments')
  @Delete(':id/comments/:commentId') deleteComment(@Param('id') id: string, @Param('commentId') commentId: string) { return this.service.deleteComment(id, commentId); }
  @RequireTenantCapability('canUpdateFlowboards')
  @Post(':id/versions') version(@Param('id') id: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.createVersion(id, body || {}, key); }
  @RequireTenantCapability('canUpdateFlowboards')
  @Post(':id/versions/:versionId/restore') restore(@Param('id') id: string, @Param('versionId') versionId: string, @Body() body: Record<string, unknown>, @Headers('idempotency-key') key?: string) { return this.service.restoreVersion(id, versionId, body || {}, key); }
  @RequireTenantCapability('canDeleteFlowboards')
  @Patch(':id/archive') archive(@Param('id') id: string) { return this.service.archive(id, true); }
  @RequireTenantCapability('canUpdateFlowboards')
  @Patch(':id/restore') restoreBoard(@Param('id') id: string) { return this.service.archive(id, false); }
  @RequireTenantCapability('canDeleteFlowboards')
  @Delete(':id') remove(@Param('id') id: string) { return this.service.remove(id); }
}
