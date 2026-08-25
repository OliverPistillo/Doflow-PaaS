import {
  Body, Controller, Delete, Get, Headers, Param, Patch, Post, Query,
} from '@nestjs/common';
import {
  CorrectTimerDto, CreateChecklistItemDto, CreateDeliveryCommentDto, CreateDeliveryPhaseDto,
  CreateDeliveryProjectDto, CreateDeliveryTaskDto, CreateQaItemDto,
  CreateTaskDependencyDto, DeliveryMemberDto, DeliveryNoteDto,
  GenerateTaskRecurrenceDto, LinkCommercialActivityDto, PublishDeliveryProjectDto, QaDecisionDto,
  ReasonDto, ReorderDeliveryPhasesDto, ReorderDeliveryTasksDto, StartTimerDto, StopTimerDto,
  SubmitQaDto, TaskStateDto, TransitionDeliveryProjectDto,
  UpdateChecklistItemDto, UpdateDeliveryMemberDto, UpdateDeliveryPhaseDto,
  UpdateDeliveryProjectDto, UpdateDeliveryTaskDto, UpdateQaItemDto,
} from './tenant-delivery-core.dto';
import { TenantDeliveryCoreService } from './tenant-delivery-core.service';

@Controller('tenant/delivery')
export class TenantDeliveryCoreController {
  constructor(private readonly service: TenantDeliveryCoreService) {}

  private key(headers: Record<string, string | string[] | undefined>) {
    return headers['idempotency-key'];
  }

  @Get('projects')
  listProjects(@Query() query: Record<string, unknown>) { return this.service.listProjects(query); }

  @Post('projects')
  createProject(@Body() body: CreateDeliveryProjectDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createProject(body, this.key(headers));
  }

  @Get('projects/:projectId')
  workspace(@Param('projectId') projectId: string) { return this.service.getWorkspace(projectId); }

  @Patch('projects/:projectId')
  updateProject(@Param('projectId') projectId: string, @Body() body: UpdateDeliveryProjectDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.updateProject(projectId, body, this.key(headers));
  }

  @Patch('projects/:projectId/status')
  transitionProject(@Param('projectId') projectId: string, @Body() body: TransitionDeliveryProjectDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.transitionProject(projectId, body, this.key(headers));
  }

  @Delete('projects/:projectId')
  archiveProject(@Param('projectId') projectId: string, @Body() body: ReasonDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.archiveProject(projectId, body, this.key(headers));
  }

  @Post('projects/:projectId/restore')
  restoreProject(@Param('projectId') projectId: string, @Body() body: ReasonDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.restoreProject(projectId, body, this.key(headers));
  }

  @Post('projects/:projectId/members')
  upsertMember(@Param('projectId') projectId: string, @Body() body: DeliveryMemberDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.upsertMember(projectId, body, this.key(headers));
  }

  @Patch('projects/:projectId/members/:memberId')
  updateMember(@Param('projectId') projectId: string, @Param('memberId') memberId: string, @Body() body: UpdateDeliveryMemberDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.updateMember(projectId, memberId, body, this.key(headers));
  }

  @Delete('projects/:projectId/members/:memberId')
  removeMember(@Param('projectId') projectId: string, @Param('memberId') memberId: string, @Body() body: ReasonDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.removeMember(projectId, memberId, body, this.key(headers));
  }

  @Post('projects/:projectId/phases')
  createPhase(@Param('projectId') projectId: string, @Body() body: CreateDeliveryPhaseDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createPhase(projectId, body, this.key(headers));
  }

  @Patch('projects/:projectId/phases/reorder')
  reorderPhases(@Param('projectId') projectId: string, @Body() body: ReorderDeliveryPhasesDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.reorderPhases(projectId, body, this.key(headers));
  }

  @Patch('projects/:projectId/phases/:phaseId')
  updatePhase(@Param('projectId') projectId: string, @Param('phaseId') phaseId: string, @Body() body: UpdateDeliveryPhaseDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.updatePhase(projectId, phaseId, body, this.key(headers));
  }

  @Delete('projects/:projectId/phases/:phaseId')
  deletePhase(@Param('projectId') projectId: string, @Param('phaseId') phaseId: string, @Body() body: ReasonDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.deletePhase(projectId, phaseId, body, this.key(headers));
  }

  @Post('projects/:projectId/tasks')
  createTask(@Param('projectId') projectId: string, @Body() body: CreateDeliveryTaskDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createTask(projectId, body, this.key(headers));
  }

  @Patch('projects/:projectId/tasks/:taskId')
  updateTask(@Param('projectId') projectId: string, @Param('taskId') taskId: string, @Body() body: UpdateDeliveryTaskDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.updateTask(projectId, taskId, body, this.key(headers));
  }

  @Patch('projects/:projectId/tasks/reorder')
  reorderTasks(@Param('projectId') projectId: string, @Body() body: ReorderDeliveryTasksDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.reorderTasks(projectId, body, this.key(headers));
  }

  @Patch('projects/:projectId/tasks/:taskId/status')
  transitionTask(@Param('projectId') projectId: string, @Param('taskId') taskId: string, @Body() body: TaskStateDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.transitionTask(projectId, taskId, body, this.key(headers));
  }

  @Delete('projects/:projectId/tasks/:taskId')
  archiveTask(@Param('projectId') projectId: string, @Param('taskId') taskId: string, @Body() body: ReasonDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.archiveTask(projectId, taskId, body, this.key(headers));
  }

  @Post('projects/:projectId/tasks/:taskId/recurrence')
  generateTaskRecurrence(@Param('projectId') projectId: string, @Param('taskId') taskId: string, @Body() body: GenerateTaskRecurrenceDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.generateTaskRecurrence(projectId, taskId, body, this.key(headers));
  }

  @Post('projects/:projectId/dependencies')
  addDependency(@Param('projectId') projectId: string, @Body() body: CreateTaskDependencyDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.addDependency(projectId, body, this.key(headers));
  }

  @Delete('projects/:projectId/dependencies/:dependencyId')
  removeDependency(@Param('projectId') projectId: string, @Param('dependencyId') dependencyId: string, @Body() body: ReasonDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.removeDependency(projectId, dependencyId, body, this.key(headers));
  }

  @Post('projects/:projectId/tasks/:taskId/checklist')
  createChecklist(@Param('projectId') projectId: string, @Param('taskId') taskId: string, @Body() body: CreateChecklistItemDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.createChecklistItem(projectId, taskId, body, this.key(headers));
  }

  @Patch('projects/:projectId/tasks/:taskId/checklist/:itemId')
  updateChecklist(@Param('projectId') projectId: string, @Param('taskId') taskId: string, @Param('itemId') itemId: string, @Body() body: UpdateChecklistItemDto, @Headers() headers: Record<string, string | string[] | undefined>) {
    return this.service.updateChecklistItem(projectId, taskId, itemId, body, this.key(headers));
  }

  @Get('timers/active')
  activeTimer() { return this.service.activeTimer(); }

  @Post('timers/start')
  startTimer(@Body() body: StartTimerDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.startTimer(body, this.key(headers)); }

  @Post('timers/:sessionId/stop')
  stopTimer(@Param('sessionId') sessionId: string, @Body() body: StopTimerDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.stopTimer(sessionId, body, this.key(headers)); }

  @Patch('timers/:sessionId')
  correctTimer(@Param('sessionId') sessionId: string, @Body() body: CorrectTimerDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.correctTimer(sessionId, body, this.key(headers)); }

  @Delete('timers/:sessionId')
  archiveTimer(@Param('sessionId') sessionId: string, @Body() body: ReasonDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.archiveTimer(sessionId, body, this.key(headers)); }

  @Post('projects/:projectId/qa/items')
  createQaItem(@Param('projectId') projectId: string, @Body() body: CreateQaItemDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.createQaItem(projectId, body, this.key(headers)); }

  @Patch('projects/:projectId/qa/items/:itemId')
  updateQaItem(@Param('projectId') projectId: string, @Param('itemId') itemId: string, @Body() body: UpdateQaItemDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.updateQaItem(projectId, itemId, body, this.key(headers)); }

  @Post('projects/:projectId/qa/submit')
  submitQa(@Param('projectId') projectId: string, @Body() body: SubmitQaDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.submitQa(projectId, body, this.key(headers)); }

  @Post('projects/:projectId/qa/changes')
  requestChanges(@Param('projectId') projectId: string, @Body() body: QaDecisionDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.requestChanges(projectId, body, this.key(headers)); }

  @Post('projects/:projectId/qa/approve')
  approveQa(@Param('projectId') projectId: string, @Body() body: QaDecisionDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.approveQa(projectId, body, this.key(headers)); }

  @Post('projects/:projectId/publish')
  publish(@Param('projectId') projectId: string, @Body() body: PublishDeliveryProjectDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.publishProject(projectId, body, this.key(headers)); }

  @Post('projects/:projectId/deliver')
  deliver(@Param('projectId') projectId: string, @Body() body: DeliveryNoteDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.deliverProject(projectId, body, this.key(headers)); }

  @Post('projects/:projectId/support')
  support(@Param('projectId') projectId: string, @Body() body: ReasonDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.supportProject(projectId, body, this.key(headers)); }

  @Post('projects/:projectId/activities/:activityId/link')
  linkActivity(@Param('projectId') projectId: string, @Param('activityId') activityId: string, @Body() body: LinkCommercialActivityDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.linkCommercialActivity(projectId, activityId, body, this.key(headers)); }

  @Post('projects/:projectId/activities/:activityId/unlink')
  unlinkActivity(@Param('projectId') projectId: string, @Param('activityId') activityId: string, @Body() body: LinkCommercialActivityDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.unlinkCommercialActivity(projectId, activityId, body, this.key(headers)); }

  @Post('projects/:projectId/comments')
  createComment(@Param('projectId') projectId: string, @Body() body: CreateDeliveryCommentDto, @Headers() headers: Record<string, string | string[] | undefined>) { return this.service.createComment(projectId, body, this.key(headers)); }

  @Get('projects/:projectId/history')
  history(@Param('projectId') projectId: string, @Query() query: Record<string, unknown>) { return this.service.history(projectId, query); }

  @Get('workload')
  workload(@Query() query: Record<string, unknown>) { return this.service.workload(query); }
}
