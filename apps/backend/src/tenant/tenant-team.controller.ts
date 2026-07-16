import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantTeamService } from './tenant-team.service';

@Controller('tenant/team')
@UseGuards(JwtAuthGuard)
export class TenantTeamController {
  constructor(private readonly service: TenantTeamService) {}

  @Get('summary')
  summary() {
    return this.service.summary();
  }

  @Get('workload')
  workload(@Query() query: Record<string, any>) {
    return this.service.workload(query || {});
  }

  @Post('members/sync-users')
  syncUsers() {
    return this.service.syncUsers();
  }

  @Get('members')
  listMembers(@Query() query: Record<string, any>) {
    return this.service.listMembers(query || {});
  }

  @Post('members')
  createMember(@Body() body: Record<string, any>) {
    return this.service.createMember(body || {});
  }

  @Post('members/:id/invite')
  inviteMember(@Param('id') id: string) {
    return this.service.inviteMember(id);
  }

  @Get('members/:id')
  getMember(@Param('id') id: string) {
    return this.service.getMember(id);
  }

  @Patch('members/:id')
  updateMember(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateMember(id, body || {});
  }

  @Delete('members/:id')
  deleteMember(@Param('id') id: string) {
    return this.service.deleteMember(id);
  }

  @Get('members/:id/workload')
  memberWorkload(@Param('id') id: string) {
    return this.service.memberWorkload(id);
  }

  @Get('members/:id/activity')
  memberActivity(@Param('id') id: string) {
    return this.service.memberActivity(id);
  }

  @Get('skills')
  listSkills(@Query() query: Record<string, any>) {
    return this.service.listSkills(query || {});
  }

  @Post('skills')
  createSkill(@Body() body: Record<string, any>) {
    return this.service.createSkill(body || {});
  }

  @Patch('skills/:id')
  updateSkill(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateSkill(id, body || {});
  }

  @Delete('skills/:id')
  deleteSkill(@Param('id') id: string) {
    return this.service.deleteSkill(id);
  }

  @Post('members/:id/skills')
  addMemberSkill(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.addMemberSkill(id, body || {});
  }

  @Delete('members/:id/skills/:skillId')
  removeMemberSkill(@Param('id') id: string, @Param('skillId') skillId: string) {
    return this.service.removeMemberSkill(id, skillId);
  }

  @Get('availability')
  listAvailability(@Query() query: Record<string, any>) {
    return this.service.listAvailability(query || {});
  }

  @Post('availability')
  createAvailability(@Body() body: Record<string, any>) {
    return this.service.createAvailability(body || {});
  }

  @Patch('availability/:id')
  updateAvailability(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateAvailability(id, body || {});
  }

  @Delete('availability/:id')
  deleteAvailability(@Param('id') id: string) {
    return this.service.deleteAvailability(id);
  }

  @Get('time-entries')
  listTimeEntries(@Query() query: Record<string, any>) {
    return this.service.listTimeEntries(query || {});
  }

  @Post('time-entries')
  createTimeEntry(@Body() body: Record<string, any>) {
    return this.service.createTimeEntry(body || {});
  }

  @Get('time-entries/:id')
  getTimeEntry(@Param('id') id: string) {
    return this.service.getTimeEntry(id);
  }

  @Patch('time-entries/:id')
  updateTimeEntry(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateTimeEntry(id, body || {});
  }

  @Delete('time-entries/:id')
  deleteTimeEntry(@Param('id') id: string) {
    return this.service.deleteTimeEntry(id);
  }

  @Patch('time-entries/:id/submit')
  submitTimeEntry(@Param('id') id: string) {
    return this.service.setTimeEntryStatus(id, 'submitted');
  }

  @Patch('time-entries/:id/approve')
  approveTimeEntry(@Param('id') id: string) {
    return this.service.setTimeEntryStatus(id, 'approved');
  }

  @Patch('time-entries/:id/reject')
  rejectTimeEntry(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.rejectTimeEntry(id, body || {});
  }

  @Get('members/:id/module-permissions')
  modulePermissions(@Param('id') id: string) {
    return this.service.getModulePermissions(id);
  }

  @Patch('members/:id/module-permissions')
  updateModulePermissions(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateModulePermissions(id, body || {});
  }

  @Get('options')
  options() {
    return this.service.options();
  }
}
