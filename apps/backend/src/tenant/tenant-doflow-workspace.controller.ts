import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantDoflowWorkspaceService } from './tenant-doflow-workspace.service';

@Controller('tenant/doflow')
@UseGuards(JwtAuthGuard)
export class TenantDoflowWorkspaceController {
  constructor(private readonly service: TenantDoflowWorkspaceService) {}

  @Get('identity')
  identity() { return this.service.identity(); }

  @Patch('identity/preferences')
  preferences(@Body() body: Record<string, unknown>) { return this.service.updatePreferences(body || {}); }

  @Patch('identity/users/:id/roles')
  roles(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.updateRoles(id, body || {}); }

  @Patch('identity/users/:id/capabilities')
  capabilities(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.updateCapabilities(id, body || {}); }

  @Post('duplicates/merge')
  merge(@Body() body: Record<string, unknown>) { return this.service.mergeDuplicates(body || {}); }

  @Get('goals')
  goals() { return this.service.listGoals(); }

  @Post('goals')
  createGoal(@Body() body: Record<string, unknown>) { return this.service.createGoal(body || {}); }

  @Patch('goals/:id')
  updateGoal(@Param('id') id: string, @Body() body: Record<string, unknown>) { return this.service.updateGoal(id, body || {}); }

  @Patch('goals/:id/archive')
  archiveGoal(@Param('id') id: string) { return this.service.archiveGoal(id); }
}
