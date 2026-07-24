import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TenantProjectsService } from './tenant-projects.service';

@Controller('tenant/projects')
@UseGuards(JwtAuthGuard)
export class TenantProjectsController {
  constructor(private readonly service: TenantProjectsService) {}

  @Get('tasks')
  listTasks(@Query() query: Record<string, any>) {
    return this.service.listTasks(query);
  }

  @Get('tasks/:taskId/checklist')
  listChecklist(@Param('taskId') taskId: string) {
    return this.service.listChecklist(taskId);
  }

  @Post('tasks/:taskId/checklist')
  createChecklistItem(@Param('taskId') taskId: string, @Body() body: Record<string, any>) {
    return this.service.createChecklistItem(taskId, body);
  }

  @Patch('tasks/:taskId/checklist/:itemId')
  updateChecklistItem(@Param('taskId') taskId: string, @Param('itemId') itemId: string, @Body() body: Record<string, any>) {
    return this.service.updateChecklistItem(taskId, itemId, body);
  }

  @Delete('tasks/:taskId/checklist/:itemId')
  deleteChecklistItem(@Param('taskId') taskId: string, @Param('itemId') itemId: string) {
    return this.service.deleteChecklistItem(taskId, itemId);
  }

  @Get('tasks/:taskId/comments')
  listTaskComments(@Param('taskId') taskId: string) {
    return this.service.listTaskComments(taskId);
  }

  @Post('tasks/:taskId/comments')
  createTaskComment(@Param('taskId') taskId: string, @Body() body: Record<string, any>) {
    return this.service.createTaskComment(taskId, body);
  }

  @Patch('comments/:commentId')
  updateComment(@Param('commentId') commentId: string, @Body() body: Record<string, any>) {
    return this.service.updateComment(commentId, body);
  }

  @Delete('comments/:commentId')
  deleteComment(@Param('commentId') commentId: string) {
    return this.service.deleteComment(commentId);
  }

  @Delete('files/:linkId')
  deleteFileLink(@Param('linkId') linkId: string) {
    return this.service.deleteFileLink(linkId);
  }

  @Post('from-quote/:quoteId')
  createFromQuote(@Param('quoteId') quoteId: string, @Body() body: Record<string, any>) {
    return this.service.createFromQuote(quoteId, body || {});
  }

  @Get()
  listProjects(@Query() query: Record<string, any>) {
    return this.service.listProjects(query);
  }

  @Post()
  createProject(@Body() body: Record<string, any>) {
    return this.service.createProject(body);
  }

  @Get(':id')
  getProject(@Param('id') id: string) {
    return this.service.getProject(id);
  }

  @Patch(':id')
  updateProject(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.updateProject(id, body);
  }

  @Delete(':id')
  deleteProject(@Param('id') id: string) {
    return this.service.deleteProject(id);
  }

  @Patch(':id/status')
  updateProjectStatus(@Param('id') id: string, @Body() body: { status?: string }) {
    return this.service.updateProjectStatus(id, String(body.status || ''));
  }

  @Get(':id/members')
  listMembers(@Param('id') id: string) {
    return this.service.listMembers(id);
  }

  @Post(':id/members')
  createMember(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createMember(id, body);
  }

  @Patch(':id/members/:memberId')
  updateMember(@Param('id') id: string, @Param('memberId') memberId: string, @Body() body: Record<string, any>) {
    return this.service.updateMember(id, memberId, body);
  }

  @Delete(':id/members/:memberId')
  deleteMember(@Param('id') id: string, @Param('memberId') memberId: string) {
    return this.service.deleteMember(id, memberId);
  }

  @Get(':id/milestones')
  listMilestones(@Param('id') id: string) {
    return this.service.listMilestones(id);
  }

  @Post(':id/milestones')
  createMilestone(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createMilestone(id, body);
  }

  @Patch(':id/milestones/:milestoneId')
  updateMilestone(@Param('id') id: string, @Param('milestoneId') milestoneId: string, @Body() body: Record<string, any>) {
    return this.service.updateMilestone(id, milestoneId, body);
  }

  @Delete(':id/milestones/:milestoneId')
  deleteMilestone(@Param('id') id: string, @Param('milestoneId') milestoneId: string) {
    return this.service.deleteMilestone(id, milestoneId);
  }

  @Patch(':id/milestones/:milestoneId/complete')
  completeMilestone(@Param('id') id: string, @Param('milestoneId') milestoneId: string) {
    return this.service.completeMilestone(id, milestoneId);
  }

  @Get(':id/tasks')
  listProjectTasks(@Param('id') id: string, @Query() query: Record<string, any>) {
    return this.service.listTasks(query, id);
  }

  @Post(':id/tasks')
  createTask(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createTask(id, body);
  }

  @Patch(':id/tasks/:taskId')
  updateTask(@Param('id') id: string, @Param('taskId') taskId: string, @Body() body: Record<string, any>) {
    return this.service.updateTask(id, taskId, body);
  }

  @Delete(':id/tasks/:taskId')
  deleteTask(@Param('id') id: string, @Param('taskId') taskId: string) {
    return this.service.deleteTask(id, taskId);
  }

  @Patch(':id/tasks/:taskId/status')
  updateTaskStatus(@Param('id') id: string, @Param('taskId') taskId: string, @Body() body: { status?: string }) {
    return this.service.updateTaskStatus(id, taskId, String(body.status || ''));
  }

  @Patch(':id/tasks/:taskId/assign')
  assignTask(@Param('id') id: string, @Param('taskId') taskId: string, @Body() body: Record<string, any>) {
    return this.service.assignTask(id, taskId, body);
  }

  @Patch(':id/tasks/:taskId/complete')
  completeTask(@Param('id') id: string, @Param('taskId') taskId: string) {
    return this.service.completeTask(id, taskId);
  }

  @Get(':id/comments')
  listProjectComments(@Param('id') id: string) {
    return this.service.listProjectComments(id);
  }

  @Post(':id/comments')
  createProjectComment(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createProjectComment(id, body);
  }

  @Get(':id/files')
  listProjectFiles(@Param('id') id: string) {
    return this.service.listProjectFiles(id);
  }

  @Post(':id/files')
  createProjectFile(@Param('id') id: string, @Body() body: Record<string, any>) {
    return this.service.createProjectFile(id, body);
  }
}
