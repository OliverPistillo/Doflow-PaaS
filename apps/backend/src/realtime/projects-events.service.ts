import { Injectable } from '@nestjs/common';
import { NotificationsService } from './notifications.service';

type TaskPayload = {
  id: string;
  title: string;
  status?: string | null;
  description?: string | null;
  assignee_id?: string | null;
  assignee_name?: string | null;
  due_date?: string | null;
  priority?: string | null;
};

@Injectable()
export class ProjectsEventsService {
  constructor(private readonly notifications: NotificationsService) {}

  async taskStatusChanged(params: {
    tenantId: string;
    projectId: string;
    task: TaskPayload;
  }) {
    await this.notifications.notifyTenant(params.tenantId, {
      kind: 'task_status_changed',
      projectId: params.projectId,
      task: params.task,
      ts: new Date().toISOString(),
    });
  }

  async taskCreated(params: {
    tenantId: string;
    projectId: string;
    task: TaskPayload;
  }) {
    await this.notifications.notifyTenant(params.tenantId, {
      kind: 'task_created',
      projectId: params.projectId,
      task: params.task,
      ts: new Date().toISOString(),
    });
  }

  async taskDeleted(params: {
    tenantId: string;
    projectId: string;
    taskId: string;
  }) {
    await this.notifications.notifyTenant(params.tenantId, {
      kind: 'task_deleted',
      projectId: params.projectId,
      taskId: params.taskId,
      ts: new Date().toISOString(),
    });
  }
}
