import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantClientPortalService } from './tenant-client-portal.service';

@Controller('tenant/client-portal/admin')
@UseGuards(JwtAuthGuard)
export class TenantClientPortalAdminController {
  constructor(private readonly service: TenantClientPortalService) {}

  @Get('summary')
  summary() {
    return this.service.adminSummary();
  }

  @Get('accounts')
  listAccounts(@Query() query: Record<string, any>) {
    return this.service.listAccounts(query);
  }

  @Post('accounts')
  createAccount(@Body() body: Record<string, any>) {
    return this.service.createAccount(body || {});
  }

  @Get('accounts/:id')
  getAccount(@Param('id') id: string) {
    return this.service.getAccount(id);
  }

  @Patch('accounts/:id')
  updateAccount(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateAccount(id, body || {});
  }

  @Delete('accounts/:id')
  deleteAccount(@Param('id') id: string) {
    return this.service.deleteAccount(id);
  }

  @Patch('accounts/:id/status')
  updateAccountStatus(@Param('id') id: string, @Body() body: { status?: string }) {
    return this.service.updateAccountStatus(id, String(body.status || ''));
  }

  @Post('accounts/:id/invites')
  createInvite(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createInvite(id, body || {});
  }

  @Get('invites')
  listInvites(@Query() query: Record<string, any>) {
    return this.service.listInvites(query);
  }

  @Patch('invites/:id/revoke')
  revokeInvite(@Param('id') id: string) {
    return this.service.revokeInvite(id);
  }

  @Get('accounts/:id/projects')
  listAccountProjects(@Param('id') id: string) {
    return this.service.listAccountProjects(id);
  }

  @Post('accounts/:id/projects')
  createProjectAccess(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createProjectAccess(id, body || {});
  }

  @Patch('project-access/:accessId')
  updateProjectAccess(@Param('accessId') accessId: string, @Body() body: Record<string, any>) {
    return this.service.updateProjectAccess(accessId, body || {});
  }

  @Delete('project-access/:accessId')
  deleteProjectAccess(@Param('accessId') accessId: string) {
    return this.service.deleteProjectAccess(accessId);
  }

  @Get('approvals')
  listApprovals(@Query() query: Record<string, any>) {
    return this.service.listApprovalsAdmin(query);
  }

  @Post('approvals')
  createApproval(@Body() body: Record<string, any>) {
    return this.service.createApproval(body || {});
  }

  @Get('approvals/:id')
  getApproval(@Param('id') id: string) {
    return this.service.getApprovalAdmin(id);
  }

  @Patch('approvals/:id')
  updateApproval(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateApproval(id, body || {});
  }

  @Delete('approvals/:id')
  deleteApproval(@Param('id') id: string) {
    return this.service.deleteApproval(id);
  }

  @Patch('approvals/:id/status')
  updateApprovalStatus(@Param('id') id: string, @Body() body: { status?: string; note?: string }) {
    return this.service.updateApprovalStatus(id, String(body.status || ''), body.note);
  }

  @Get('material-requests')
  listMaterials(@Query() query: Record<string, any>) {
    return this.service.listMaterialsAdmin(query);
  }

  @Post('material-requests')
  createMaterial(@Body() body: Record<string, any>) {
    return this.service.createMaterial(body || {});
  }

  @Patch('material-requests/:id')
  updateMaterial(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateMaterial(id, body || {});
  }

  @Delete('material-requests/:id')
  deleteMaterial(@Param('id') id: string) {
    return this.service.deleteMaterial(id);
  }

  @Patch('material-requests/:id/status')
  updateMaterialStatus(@Param('id') id: string, @Body() body: { status?: string }) {
    return this.service.updateMaterialStatus(id, String(body.status || ''));
  }

  @Get('comments')
  listComments(@Query() query: Record<string, any>) {
    return this.service.listCommentsAdmin(query);
  }

  @Post('comments')
  createComment(@Body() body: Record<string, any>) {
    return this.service.createCommentAdmin(body || {});
  }

  @Delete('comments/:id')
  deleteComment(@Param('id') id: string) {
    return this.service.deleteCommentAdmin(id);
  }
}

@Controller('tenant/client-portal')
export class TenantClientPortalController {
  constructor(private readonly service: TenantClientPortalService) {}

  @Post('auth/accept-invite')
  acceptInvite(@Body() body: Record<string, any>) {
    return this.service.acceptInvite(body || {});
  }

  @Post('auth/login')
  login(@Body() body: Record<string, any>) {
    return this.service.login(body || {});
  }

  @Post('auth/magic-login')
  magicLogin() {
    return this.service.magicLogin();
  }

  @Get('me')
  me() {
    return this.service.me();
  }

  @Get('summary')
  summary() {
    return this.service.clientSummary();
  }

  @Get('projects')
  listProjects() {
    return this.service.listClientProjects();
  }

  @Get('projects/:projectId/milestones')
  listMilestones(@Param('projectId') projectId: string) {
    return this.service.listClientMilestones(projectId);
  }

  @Get('projects/:projectId/tasks')
  listTasks(@Param('projectId') projectId: string) {
    return this.service.listClientTasks(projectId);
  }

  @Get('projects/:projectId/files')
  listFiles(@Param('projectId') projectId: string) {
    return this.service.listClientFiles(projectId);
  }

  @Get('projects/:projectId')
  getProject(@Param('projectId') projectId: string) {
    return this.service.getClientProject(projectId);
  }

  @Get('approvals')
  listApprovals(@Query() query: Record<string, any>) {
    return this.service.listClientApprovals(query);
  }

  @Get('approvals/:id')
  getApproval(@Param('id') id: string) {
    return this.service.getClientApproval(id);
  }

  @Patch('approvals/:id/approve')
  approve(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.decideApproval(id, 'approved', body || {});
  }

  @Patch('approvals/:id/reject')
  reject(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.decideApproval(id, 'rejected', body || {});
  }

  @Patch('approvals/:id/request-changes')
  requestChanges(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.decideApproval(id, 'changes_requested', body || {});
  }

  @Get('material-requests')
  listMaterialRequests(@Query() query: Record<string, any>) {
    return this.service.listClientMaterialRequests(query);
  }

  @Patch('material-requests/:id/submit')
  submitMaterial(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.submitClientMaterial(id, body || {});
  }

  @Post('material-requests/:id/files')
  addMaterialFile(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.addClientMaterialFile(id, body || {});
  }

  @Get('comments')
  listComments(@Query() query: Record<string, any>) {
    return this.service.listClientComments(query);
  }

  @Post('comments')
  createComment(@Body() body: Record<string, any>) {
    return this.service.createClientComment(body || {});
  }
}
