import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Patch,
  Req,
  Res,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DataSource } from 'typeorm';
import { hasRoleAtLeast, Role } from './roles';
import { AuditService } from './audit.service';
import { ProjectsEventsService } from './realtime/projects-events.service';

type CreateProjectBody = {
  name: string;
  description?: string;
};

type CreateTaskBody = {
  title: string;
  description?: string;
  assignee_email?: string;
  due_date?: string; // ISO string (YYYY-MM-DD)
};

type UpdateTaskStatusBody = {
  status?: string;
};

type TaskRow = {
  id: number;
  project_id: number;
  title: string | null;
  description: string | null;
  status: string | null;
  assignee_email: string | null;
  due_date: string | null;
  created_at: string;
  updated_at: string;
};

@Controller('projects')
export class ProjectsController {
  constructor(
    private readonly auditService: AuditService,
    private readonly projectsEvents: ProjectsEventsService,
  ) {}

  private getConn(req: Request): DataSource {
    const conn = (req as any).tenantConnection as DataSource | undefined;
    if (!conn) {
      throw new Error('No tenant connection on request');
    }
    return conn;
  }

  private getTenantId(req: Request): string {
    const tenantId = (req as any).tenantId as string | undefined;
    return tenantId ?? 'public';
  }

  private getAuthUser(req: Request) {
    return (req as any).authUser as
      | { email?: string; role?: Role; tenantId?: string }
      | undefined;
  }

  // Helper per mappare la row del DB nel payload task realtime
  private mapTaskRowToRealtimePayload(row: TaskRow) {
    return {
      id: String(row.id),
      title: row.title ?? '',
      status: row.status ?? null,
      description: row.description ?? null,
      assignee_id: row.assignee_email ?? null,
      assignee_name: null,
      due_date: row.due_date ?? null,
      priority: null,
    };
  }

  @Get()
  async listProjects(@Req() req: Request, @Res() res: Response) {
    const authUser = this.getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const rows = await conn.query(
      `
      select id, name, description, status, owner_email, created_at, updated_at
      from ${tenantId}.projects
      order by id desc
      `,
    );

    return res.json({ projects: rows });
  }

  @Post()
  async createProject(
    @Body() body: CreateProjectBody,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const authUser = this.getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!hasRoleAtLeast(authUser.role, 'editor')) {
      return res.status(403).json({ error: 'Editor or above required' });
    }

    if (!body.name) {
      return res.status(400).json({ error: 'name required' });
    }

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const rows = await conn.query(
      `
      insert into ${tenantId}.projects (name, description, owner_email)
      values ($1, $2, $3)
      returning id, name, description, status, owner_email, created_at, updated_at
      `,
      [body.name, body.description ?? null, authUser.email ?? null],
    );

    const project = rows[0];

    await this.auditService.log(req, {
      action: 'project_created',
      targetEmail: authUser.email,
      metadata: { projectId: project.id, name: project.name },
    });

    return res.json({ project });
  }

  @Get(':id/tasks')
  async listTasks(
    @Param('id') id: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const authUser = this.getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const projectId = Number(id);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project id' });
    }

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const rows = await conn.query(
      `
      select
        id,
        project_id,
        title,
        description,
        status,
        assignee_email,
        due_date,
        created_at,
        updated_at
      from ${tenantId}.tasks
      where project_id = $1
      order by id
      `,
      [projectId],
    );

    return res.json({ tasks: rows });
  }

  @Post(':id/tasks')
  async createTask(
    @Param('id') id: string,
    @Body() body: CreateTaskBody,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const authUser = this.getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!hasRoleAtLeast(authUser.role, 'editor')) {
      return res.status(403).json({ error: 'Editor or above required' });
    }

    const projectId = Number(id);
    if (Number.isNaN(projectId)) {
      return res.status(400).json({ error: 'Invalid project id' });
    }

    if (!body.title) {
      return res.status(400).json({ error: 'title required' });
    }

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const rows = await conn.query(
      `
      insert into ${tenantId}.tasks
      (project_id, title, description, assignee_email, due_date)
      values ($1, $2, $3, $4, $5)
      returning
        id,
        project_id,
        title,
        description,
        status,
        assignee_email,
        due_date,
        created_at,
        updated_at
      `,
      [
        projectId,
        body.title,
        body.description ?? null,
        body.assignee_email ?? null,
        body.due_date ?? null,
      ],
    );

    const task = rows[0] as TaskRow;

    await this.auditService.log(req, {
      action: 'task_created',
      targetEmail: body.assignee_email ?? authUser.email,
      metadata: { projectId, taskId: task.id, title: task.title },
    });

    // 🔥 evento realtime "task_created"
    await this.projectsEvents.taskCreated({
      tenantId,
      projectId: String(projectId),
      task: {
        id: String(task.id),
        title: task.title ?? '',
        status: task.status ?? null,
        description: task.description ?? null,
        assignee_id: task.assignee_email ?? null,
        assignee_name: null,
        due_date: task.due_date ?? null,
        priority: null,
      },
    });

    return res.json({ task });
  }

  @Patch(':id/tasks/:taskId')
  async updateTaskStatus(
    @Param('id') id: string,
    @Param('taskId') taskIdParam: string,
    @Body() body: UpdateTaskStatusBody,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    const authUser = this.getAuthUser(req);
    if (!authUser) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!hasRoleAtLeast(authUser.role, 'editor')) {
      return res.status(403).json({ error: 'Editor or above required' });
    }

    const projectId = Number(id);
    const taskId = Number(taskIdParam);
    if (Number.isNaN(projectId) || Number.isNaN(taskId)) {
      return res
        .status(400)
        .json({ error: 'Invalid project id or task id' });
    }

    const rawStatus = (body.status ?? '').trim().toUpperCase();
    if (!rawStatus) {
      return res.status(400).json({ error: 'status required' });
    }

    const allowedStatuses = [
      'BACKLOG',
      'TODO',
      'IN_PROGRESS',
      'REVIEW',
      'DONE',
    ];
    if (!allowedStatuses.includes(rawStatus)) {
      return res.status(400).json({ error: 'invalid status' });
    }

    const conn = this.getConn(req);
    const tenantId = this.getTenantId(req);

    const rows = await conn.query(
      `
      update ${tenantId}.tasks
      set status = $1, updated_at = now()
      where id = $2 and project_id = $3
      returning
        id,
        project_id,
        title,
        description,
        status,
        assignee_email,
        due_date,
        created_at,
        updated_at
      `,
      [rawStatus, taskId, projectId],
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: 'task not found' });
    }

    const task = rows[0] as TaskRow;

    await this.auditService.log(req, {
      action: 'task_status_changed',
      targetEmail: task.assignee_email ?? authUser.email,
      metadata: {
        projectId,
        taskId: task.id,
        title: task.title,
        newStatus: task.status,
      },
    });

    // 🔥 evento realtime "task_status_changed"
    await this.projectsEvents.taskStatusChanged({
      tenantId,
      projectId: String(projectId),
      task: {
        // qui usiamo SEMPRE il taskId della route, non row.id
        id: String(taskId),
        title: task.title ?? '',
        status: task.status ?? null,
        description: task.description ?? null,
        assignee_id: task.assignee_email ?? null,
        assignee_name: null,
        due_date: task.due_date ?? null,
        priority: null,
      },
    });

    return res.json({ task });
  }
}
