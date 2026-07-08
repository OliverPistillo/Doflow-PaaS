import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, QueryRunner } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import {
  createStandardProjectPlan,
  ensureTenantProjectsTables,
} from './tenant-projects-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const PROJECT_STATUSES = [
  'to_start', 'kickoff', 'materials_collection', 'strategy', 'ux_ui', 'copy_content',
  'development', 'internal_review', 'client_review', 'corrections', 'seo_performance',
  'qa', 'publishing', 'training', 'delivered', 'maintenance', 'closed', 'blocked',
];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PROJECT_MEMBER_ROLES = ['project_manager', 'designer', 'developer', 'seo', 'copywriter', 'sales', 'admin', 'member', 'external'];
const MILESTONE_STATUSES = ['pending', 'in_progress', 'completed', 'blocked', 'skipped'];
const TASK_STATUSES = ['backlog', 'ready', 'in_progress', 'internal_review', 'client_review', 'blocked', 'done'];
const COMMENT_VISIBILITIES = ['internal', 'client', 'private'];
const FILE_VISIBILITIES = ['internal', 'client', 'private'];
const FILE_TYPES = [
  'logo', 'image', 'video', 'text', 'contract', 'quote', 'invoice', 'screenshot',
  'seo_report', 'performance_report', 'access_reference', 'backup', 'deliverable', 'other',
];

type AuthUser = { id: string; email?: string; role: string };

@Injectable()
export class TenantProjectsService {
  private readonly logger = new Logger(TenantProjectsService.name);

  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getUser(): AuthUser {
    const user = this.request.user || this.request.authUser;
    if (!user) throw new ForbiddenException('Utente non valido');
    return {
      id: String(user.sub || user.id || user.userId || ''),
      email: typeof user.email === 'string' ? user.email : undefined,
      role: String(user.role || 'user').toLowerCase().trim(),
    };
  }

  private getSchema(): string {
    const user = this.request.user || this.request.authUser;
    const tenantRef = user?.tenantId || user?.tenant_id || this.request.tenantId;
    const schema = safeSchema(tenantRef || 'public', 'TenantProjectsService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Projects V2 non disponibili nel contesto public');
    return schema;
  }

  private isManagerRole(role: string): boolean {
    return hasRoleAtLeast(role, 'manager');
  }

  private canReadAssignedRole(role: string): boolean {
    return role === 'editor' || role === 'user';
  }

  private assertCanRead(user = this.getUser()) {
    if (this.isManagerRole(user.role) || this.canReadAssignedRole(user.role)) return user;
    throw new ForbiddenException('Non hai accesso ai progetti interni.');
  }

  private assertCanManage(user = this.getUser()) {
    if (!this.isManagerRole(user.role)) {
      throw new ForbiddenException('Manager o superiore richiesto per modificare i progetti.');
    }
    return user;
  }

  private userIdOrNull(userId: string): string | null {
    return UUID_RE.test(userId) ? userId : null;
  }

  private requireUuid(value: string, label = 'ID'): string {
    if (!UUID_RE.test(String(value))) throw new BadRequestException(`${label} non valido`);
    return String(value);
  }

  private normalizeLimit(value: unknown): number {
    const n = Number(value || 50);
    if (!Number.isFinite(n)) return 50;
    return Math.max(1, Math.min(100, Math.trunc(n)));
  }

  private normalizeOffset(value: unknown): number {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.trunc(n));
  }

  private async ensureSchema(schema: string) {
    await ensureTenantProjectsTables(this.dataSource, schema);
  }

  private projectAccessClause(user: AuthUser, schema: string, startParam: number) {
    if (this.isManagerRole(user.role)) return { sql: 'TRUE', params: [] as unknown[] };
    const userId = this.userIdOrNull(user.id);
    if (!userId || !this.canReadAssignedRole(user.role)) return { sql: 'FALSE', params: [] as unknown[] };
    return {
      sql: `(p.project_manager_id = $${startParam}
        OR EXISTS (
          SELECT 1 FROM "${schema}".project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = $${startParam} AND pm.deleted_at IS NULL
        )
        OR EXISTS (
          SELECT 1 FROM "${schema}".tasks t
          WHERE t.project_id = p.id AND t.assignee_id = $${startParam} AND t.deleted_at IS NULL
        ))`,
      params: [userId] as unknown[],
    };
  }

  private taskAccessClause(user: AuthUser, alias: string, startParam: number) {
    if (this.isManagerRole(user.role)) return { sql: 'TRUE', params: [] as unknown[] };
    const userId = this.userIdOrNull(user.id);
    if (!userId || !this.canReadAssignedRole(user.role)) return { sql: 'FALSE', params: [] as unknown[] };
    return { sql: `${alias}.assignee_id = $${startParam}`, params: [userId] as unknown[] };
  }

  async listProjects(query: Record<string, any>) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sortBy = ['created_at', 'updated_at', 'due_date', 'name', 'status'].includes(String(query.sortBy || ''))
      ? String(query.sortBy)
      : 'updated_at';
    const sortOrder = String(query.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const where = ['p.deleted_at IS NULL'];
    const params: unknown[] = [];

    const search = String(query.search || '').trim();
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(lower(coalesce(p.name, '')) LIKE $${params.length} OR lower(coalesce(p.description, '')) LIKE $${params.length})`);
    }
    for (const field of ['status', 'type', 'priority', 'company_id', 'project_manager_id']) {
      const value = query[field];
      if (value === undefined || value === null || value === '') continue;
      params.push(value);
      where.push(`p.${field} = $${params.length}`);
    }

    const access = this.projectAccessClause(user, schema, params.length + 1);
    where.push(access.sql);
    params.push(...access.params);

    const countRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total
       FROM "${schema}".projects p
       WHERE ${where.join(' AND ')}`,
      params,
    );
    const rows = await this.dataSource.query(
      `SELECT p.*,
         c.name AS company_name,
         concat_ws(' ', ct.first_name, ct.last_name) AS contact_name,
         o.title AS opportunity_title,
         b.title AS briefing_title,
         q.quote_number,
         q.title AS quote_title,
         u.email AS project_manager_email
       FROM "${schema}".projects p
       LEFT JOIN "${schema}".companies c ON c.id = p.company_id
       LEFT JOIN "${schema}".contacts ct ON ct.id = p.contact_id
       LEFT JOIN "${schema}".opportunities o ON o.id = p.opportunity_id
       LEFT JOIN "${schema}".briefings b ON b.id = p.briefing_id
       LEFT JOIN "${schema}".quotes q ON q.id = p.quote_id
       LEFT JOIN "${schema}".users u ON u.id = p.project_manager_id
       WHERE ${where.join(' AND ')}
       ORDER BY p.${sortBy} ${sortOrder} NULLS LAST, p.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return { items: rows, total: Number(countRows[0]?.total || 0), limit, offset };
  }

  async getProject(id: string) {
    const user = this.assertCanRead();
    this.requireUuid(id);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const params: unknown[] = [id];
    const access = this.projectAccessClause(user, schema, 2);
    params.push(...access.params);
    const rows = await this.dataSource.query(
      `SELECT p.*,
         c.name AS company_name,
         concat_ws(' ', ct.first_name, ct.last_name) AS contact_name,
         o.title AS opportunity_title,
         b.title AS briefing_title,
         q.quote_number,
         q.title AS quote_title,
         u.email AS project_manager_email
       FROM "${schema}".projects p
       LEFT JOIN "${schema}".companies c ON c.id = p.company_id
       LEFT JOIN "${schema}".contacts ct ON ct.id = p.contact_id
       LEFT JOIN "${schema}".opportunities o ON o.id = p.opportunity_id
       LEFT JOIN "${schema}".briefings b ON b.id = p.briefing_id
       LEFT JOIN "${schema}".quotes q ON q.id = p.quote_id
       LEFT JOIN "${schema}".users u ON u.id = p.project_manager_id
       WHERE p.id = $1 AND p.deleted_at IS NULL AND ${access.sql}
       LIMIT 1`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Progetto non trovato');
    return rows[0];
  }

  async createProject(body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanProjectBody(body, false);
    return this.insertProject(schema, cleaned, this.userIdOrNull(user.id), user);
  }

  async updateProject(id: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    this.requireUuid(id);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanProjectBody(body, true);
    const entries = Object.entries(cleaned);
    if (entries.length === 0) return this.getProject(id);
    const sets = entries.map(([field], i) => `${field} = $${i + 1}`);
    const params = entries.map(([, value]) => value);
    params.push(this.userIdOrNull(user.id), id);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".projects
       SET ${sets.join(', ')}, updated_by = $${params.length - 1}, updated_at = now()
       WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING id`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Progetto non trovato');
    await this.audit(schema, user, 'project_updated', id, cleaned);
    return this.getProject(id);
  }

  async deleteProject(id: string) {
    const user = this.assertCanManage();
    this.requireUuid(id);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".projects
       SET deleted_at = now(), updated_by = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [this.userIdOrNull(user.id), id],
    );
    if (!rows[0]) throw new NotFoundException('Progetto non trovato');
    await this.audit(schema, user, 'project_deleted', id, {});
    return { success: true };
  }

  async updateProjectStatus(id: string, status: string) {
    if (!PROJECT_STATUSES.includes(status)) throw new BadRequestException('Status progetto non valido');
    return this.updateProject(id, { status });
  }

  async createFromQuote(quoteId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    this.requireUuid(quoteId, 'ID preventivo');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const userId = this.userIdOrNull(user.id);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const existing = await runner.query(
        `SELECT id FROM "${schema}".projects WHERE quote_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [quoteId],
      );
      if (existing[0]) {
        await runner.commitTransaction();
        return { existing: true, project: await this.getProject(existing[0].id) };
      }

      const quoteRows = await runner.query(
        `SELECT q.*, o.title AS opportunity_title, o.service_type, b.type AS briefing_type
         FROM "${schema}".quotes q
         LEFT JOIN "${schema}".opportunities o ON o.id = q.opportunity_id
         LEFT JOIN "${schema}".briefings b ON b.id = q.briefing_id
         WHERE q.id = $1 AND q.deleted_at IS NULL
         LIMIT 1`,
        [quoteId],
      );
      const quote = quoteRows[0];
      if (!quote) throw new NotFoundException('Preventivo non trovato');
      if (String(quote.status || '').toLowerCase() !== 'accepted') {
        throw new BadRequestException('Preventivo non accettato');
      }

      const projectManagerId = body.project_manager_id && UUID_RE.test(String(body.project_manager_id))
        ? String(body.project_manager_id)
        : userId;
      const projectType = this.normalizeProjectType(quote.service_type || quote.briefing_type || body.type);
      const name = this.normalizeProjectName(body.name || quote.title || quote.opportunity_title);
      const status = this.normalizeProjectStatus(body.status);
      const priority = this.normalizeProjectPriority(body.priority);
      const progress = this.normalizeProjectProgress(body.progress);
      const projectRows = await runner.query(
        `INSERT INTO "${schema}".projects (
           company_id, contact_id, opportunity_id, briefing_id, quote_id,
           name, description, type, status, priority, progress, project_manager_id,
           created_by, updated_by, created_at, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $13, now(), now())
         RETURNING id`,
        [
          quote.company_id || null,
          quote.contact_id || null,
          quote.opportunity_id || null,
          quote.briefing_id || null,
          quote.id,
          name,
          body.description || null,
          projectType,
          status,
          priority,
          progress,
          projectManagerId,
          userId,
        ],
      );
      const projectId = projectRows[0].id;
      if (projectManagerId) {
        await runner.query(
          `INSERT INTO "${schema}".project_members (project_id, user_id, role, created_by, created_at)
           VALUES ($1, $2, 'project_manager', $3, now())
           ON CONFLICT (project_id, user_id) WHERE deleted_at IS NULL DO NOTHING`,
          [projectId, projectManagerId, userId],
        );
      }
      await createStandardProjectPlan(runner, schema, projectId, quote.company_id || null, projectManagerId);
      await runner.commitTransaction();
      await this.audit(schema, user, 'project_created_from_quote', projectId, { quoteId });
      return { existing: false, project: await this.getProject(projectId) };
    } catch (err) {
      await runner.rollbackTransaction();
      if (err instanceof BadRequestException || err instanceof NotFoundException || err instanceof ConflictException) throw err;
      this.logProjectInsertError(err, 'create_from_quote');
      throw err;
    } finally {
      await runner.release();
    }
  }

  async listMembers(projectId: string) {
    await this.getProject(projectId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT pm.*, u.email, u.full_name
       FROM "${schema}".project_members pm
       LEFT JOIN "${schema}".users u ON u.id = pm.user_id
       WHERE pm.project_id = $1 AND pm.deleted_at IS NULL
       ORDER BY pm.created_at ASC`,
      [projectId],
    );
    return { items: rows };
  }

  async createMember(projectId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    await this.getProject(projectId);
    const schema = this.getSchema();
    const userId = this.requireUuid(String(body.user_id || ''), 'user_id');
    const role = PROJECT_MEMBER_ROLES.includes(String(body.role || 'member')) ? String(body.role || 'member') : 'member';
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".project_members (
         project_id, user_id, role, hourly_rate, allocation_percent, created_by, created_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (project_id, user_id) WHERE deleted_at IS NULL DO UPDATE
         SET role = EXCLUDED.role,
             hourly_rate = EXCLUDED.hourly_rate,
             allocation_percent = EXCLUDED.allocation_percent
       RETURNING id`,
      [
        projectId,
        userId,
        role,
        this.numberOrNull(body.hourly_rate, 'hourly_rate'),
        this.integerOrNull(body.allocation_percent, 'allocation_percent'),
        this.userIdOrNull(user.id),
      ],
    );
    await this.audit(schema, user, 'project_member_upserted', rows[0].id, { projectId, userId });
    return this.listMembers(projectId);
  }

  async updateMember(projectId: string, memberId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    this.requireUuid(memberId, 'ID membro');
    await this.getProject(projectId);
    const schema = this.getSchema();
    const fields: Record<string, unknown> = {};
    if ('role' in body) {
      if (!PROJECT_MEMBER_ROLES.includes(String(body.role))) throw new BadRequestException('Ruolo progetto non valido');
      fields.role = body.role;
    }
    if ('hourly_rate' in body) fields.hourly_rate = this.numberOrNull(body.hourly_rate, 'hourly_rate');
    if ('allocation_percent' in body) fields.allocation_percent = this.integerOrNull(body.allocation_percent, 'allocation_percent');
    const entries = Object.entries(fields);
    if (entries.length === 0) return this.listMembers(projectId);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".project_members
       SET ${entries.map(([field], i) => `${field} = $${i + 1}`).join(', ')}
       WHERE id = $${entries.length + 1} AND project_id = $${entries.length + 2} AND deleted_at IS NULL
       RETURNING id`,
      [...entries.map(([, value]) => value), memberId, projectId],
    );
    if (!rows[0]) throw new NotFoundException('Membro progetto non trovato');
    await this.audit(schema, user, 'project_member_updated', memberId, { projectId });
    return this.listMembers(projectId);
  }

  async deleteMember(projectId: string, memberId: string) {
    const user = this.assertCanManage();
    this.requireUuid(memberId, 'ID membro');
    await this.getProject(projectId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".project_members SET deleted_at = now()
       WHERE id = $1 AND project_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [memberId, projectId],
    );
    if (!rows[0]) throw new NotFoundException('Membro progetto non trovato');
    await this.audit(schema, user, 'project_member_deleted', memberId, { projectId });
    return { success: true };
  }

  async listMilestones(projectId: string) {
    await this.getProject(projectId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".milestones
       WHERE project_id = $1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, due_date ASC NULLS LAST, created_at ASC`,
      [projectId],
    );
    return { items: rows };
  }

  async createMilestone(projectId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    await this.getProject(projectId);
    const schema = this.getSchema();
    const cleaned = this.cleanMilestoneBody(body, false);
    const rows = await this.insertRow(schema, 'milestones', { project_id: projectId, ...cleaned, created_by: this.userIdOrNull(user.id), updated_by: this.userIdOrNull(user.id) });
    await this.audit(schema, user, 'milestone_created', rows.id, { projectId });
    return this.listMilestones(projectId);
  }

  async updateMilestone(projectId: string, milestoneId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    this.requireUuid(milestoneId, 'ID milestone');
    await this.getProject(projectId);
    const schema = this.getSchema();
    const cleaned = this.cleanMilestoneBody(body, true);
    await this.updateRow(schema, 'milestones', milestoneId, cleaned, this.userIdOrNull(user.id), `project_id = $${Object.keys(cleaned).length + 3}`, [projectId]);
    await this.audit(schema, user, 'milestone_updated', milestoneId, { projectId });
    return this.listMilestones(projectId);
  }

  async deleteMilestone(projectId: string, milestoneId: string) {
    const user = this.assertCanManage();
    this.requireUuid(milestoneId, 'ID milestone');
    await this.getProject(projectId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".milestones
       SET deleted_at = now(), updated_by = $1, updated_at = now()
       WHERE id = $2 AND project_id = $3 AND deleted_at IS NULL
       RETURNING id`,
      [this.userIdOrNull(user.id), milestoneId, projectId],
    );
    if (!rows[0]) throw new NotFoundException('Milestone non trovata');
    await this.audit(schema, user, 'milestone_deleted', milestoneId, { projectId });
    return { success: true };
  }

  async completeMilestone(projectId: string, milestoneId: string) {
    return this.updateMilestone(projectId, milestoneId, { status: 'completed', completed_at: new Date().toISOString() });
  }

  async listTasks(query: Record<string, any>, projectId?: string) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    if (projectId) await this.getProject(projectId);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sortBy = ['created_at', 'updated_at', 'due_at', 'priority', 'status'].includes(String(query.sortBy || ''))
      ? String(query.sortBy)
      : 'updated_at';
    const sortOrder = String(query.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const where = ['t.deleted_at IS NULL'];
    const params: unknown[] = [];
    if (projectId) {
      params.push(projectId);
      where.push(`t.project_id = $${params.length}`);
    }
    for (const field of ['project_id', 'assignee_id', 'status']) {
      const value = query[field];
      if (value === undefined || value === null || value === '') continue;
      params.push(value);
      where.push(`t.${field} = $${params.length}`);
    }
    if (query.due_from) {
      params.push(query.due_from);
      where.push(`t.due_at >= $${params.length}`);
    }
    if (query.due_to) {
      params.push(query.due_to);
      where.push(`t.due_at <= $${params.length}`);
    }
    const search = String(query.search || '').trim();
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(lower(coalesce(t.title, '')) LIKE $${params.length} OR lower(coalesce(t.description, '')) LIKE $${params.length})`);
    }
    const access = this.taskAccessClause(user, 't', params.length + 1);
    where.push(access.sql);
    params.push(...access.params);
    const countRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "${schema}".tasks t WHERE ${where.join(' AND ')}`,
      params,
    );
    const rows = await this.dataSource.query(
      `SELECT t.*, p.name AS project_name, m.title AS milestone_title, u.email AS assignee_email
       FROM "${schema}".tasks t
       LEFT JOIN "${schema}".projects p ON p.id = t.project_id
       LEFT JOIN "${schema}".milestones m ON m.id = t.milestone_id
       LEFT JOIN "${schema}".users u ON u.id = t.assignee_id
       WHERE ${where.join(' AND ')}
       ORDER BY t.${sortBy} ${sortOrder} NULLS LAST, t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return { items: rows, total: Number(countRows[0]?.total || 0), limit, offset };
  }

  async createTask(projectId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    await this.getProject(projectId);
    const schema = this.getSchema();
    const cleaned = this.cleanTaskBody({ ...body, project_id: projectId }, false);
    const rows = await this.insertRow(schema, 'tasks', { ...cleaned, created_by: this.userIdOrNull(user.id), updated_by: this.userIdOrNull(user.id) });
    await this.audit(schema, user, 'task_created', rows.id, { projectId });
    return this.listTasks({}, projectId);
  }

  async updateTask(projectId: string, taskId: string, body: Record<string, any>) {
    const user = this.assertCanRead();
    this.requireUuid(taskId, 'ID task');
    await this.getProject(projectId);
    const schema = this.getSchema();
    const task = await this.getVisibleTask(schema, taskId, user, projectId);
    const manager = this.isManagerRole(user.role);
    if (!manager && task.assignee_id !== this.userIdOrNull(user.id)) {
      throw new ForbiddenException('Puoi aggiornare solo task assegnati a te.');
    }
    const cleaned = manager
      ? this.cleanTaskBody(body, true)
      : this.cleanTaskBody(this.pick(body, ['status', 'actual_minutes', 'blocked_reason', 'completed_at']), true);
    if (Object.keys(cleaned).length === 0) return this.listTasks({}, projectId);
    await this.updateRow(schema, 'tasks', taskId, cleaned, this.userIdOrNull(user.id), `project_id = $${Object.keys(cleaned).length + 3}`, [projectId]);
    await this.audit(schema, user, 'task_updated', taskId, { projectId });
    return this.listTasks({}, projectId);
  }

  async deleteTask(projectId: string, taskId: string) {
    const user = this.assertCanManage();
    this.requireUuid(taskId, 'ID task');
    await this.getProject(projectId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".tasks
       SET deleted_at = now(), updated_by = $1, updated_at = now()
       WHERE id = $2 AND project_id = $3 AND deleted_at IS NULL
       RETURNING id`,
      [this.userIdOrNull(user.id), taskId, projectId],
    );
    if (!rows[0]) throw new NotFoundException('Task non trovato');
    await this.audit(schema, user, 'task_deleted', taskId, { projectId });
    return { success: true };
  }

  async updateTaskStatus(projectId: string, taskId: string, status: string) {
    if (!TASK_STATUSES.includes(status)) throw new BadRequestException('Status task non valido');
    return this.updateTask(projectId, taskId, { status, completed_at: status === 'done' ? new Date().toISOString() : null });
  }

  async assignTask(projectId: string, taskId: string, body: Record<string, any>) {
    this.assertCanManage();
    const assigneeId = body.assignee_id ? this.requireUuid(String(body.assignee_id), 'assignee_id') : null;
    return this.updateTask(projectId, taskId, { assignee_id: assigneeId, assigned_by: this.userIdOrNull(this.getUser().id) });
  }

  async completeTask(projectId: string, taskId: string) {
    return this.updateTask(projectId, taskId, { status: 'done', completed_at: new Date().toISOString() });
  }

  async listChecklist(taskId: string) {
    const schema = this.getSchema();
    const user = this.assertCanRead();
    await this.ensureSchema(schema);
    await this.getVisibleTask(schema, this.requireUuid(taskId, 'ID task'), user);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".task_checklist_items
       WHERE task_id = $1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, created_at ASC`,
      [taskId],
    );
    return { items: rows };
  }

  async createChecklistItem(taskId: string, body: Record<string, any>) {
    const { schema, user } = await this.assertCanWriteTaskById(taskId);
    const title = String(body.title || '').trim();
    if (!title) throw new BadRequestException('title obbligatorio');
    const rows = await this.insertRow(schema, 'task_checklist_items', {
      task_id: taskId,
      title,
      is_done: Boolean(body.is_done),
      sort_order: this.integerOrNull(body.sort_order, 'sort_order') ?? 0,
    });
    await this.audit(schema, user, 'task_checklist_created', rows.id, { taskId });
    return this.listChecklist(taskId);
  }

  async updateChecklistItem(taskId: string, itemId: string, body: Record<string, any>) {
    const { schema, user } = await this.assertCanWriteTaskById(taskId);
    this.requireUuid(itemId, 'ID checklist');
    const cleaned: Record<string, unknown> = {};
    if ('title' in body) {
      const title = String(body.title || '').trim();
      if (!title) throw new BadRequestException('title obbligatorio');
      cleaned.title = title;
    }
    if ('is_done' in body) cleaned.is_done = Boolean(body.is_done);
    if ('sort_order' in body) cleaned.sort_order = this.integerOrNull(body.sort_order, 'sort_order') ?? 0;
    await this.updateRow(schema, 'task_checklist_items', itemId, cleaned, null, `task_id = $${Object.keys(cleaned).length + 2}`, [taskId], false);
    await this.audit(schema, user, 'task_checklist_updated', itemId, { taskId });
    return this.listChecklist(taskId);
  }

  async deleteChecklistItem(taskId: string, itemId: string) {
    const { schema, user } = await this.assertCanWriteTaskById(taskId);
    this.requireUuid(itemId, 'ID checklist');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".task_checklist_items
       SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND task_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [itemId, taskId],
    );
    if (!rows[0]) throw new NotFoundException('Elemento checklist non trovato');
    await this.audit(schema, user, 'task_checklist_deleted', itemId, { taskId });
    return { success: true };
  }

  async listProjectComments(projectId: string) {
    await this.getProject(projectId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT pc.*, u.email AS created_by_email
       FROM "${schema}".project_comments pc
       LEFT JOIN "${schema}".users u ON u.id = pc.created_by
       WHERE pc.project_id = $1 AND pc.deleted_at IS NULL
       ORDER BY pc.created_at DESC`,
      [projectId],
    );
    return { items: rows };
  }

  async createProjectComment(projectId: string, body: Record<string, any>) {
    const user = this.assertCanRead();
    await this.getProject(projectId);
    const schema = this.getSchema();
    const row = await this.createComment(schema, user, { project_id: projectId }, body);
    return row;
  }

  async listTaskComments(taskId: string) {
    const schema = this.getSchema();
    const user = this.assertCanRead();
    await this.ensureSchema(schema);
    await this.getVisibleTask(schema, this.requireUuid(taskId, 'ID task'), user);
    const rows = await this.dataSource.query(
      `SELECT pc.*, u.email AS created_by_email
       FROM "${schema}".project_comments pc
       LEFT JOIN "${schema}".users u ON u.id = pc.created_by
       WHERE pc.task_id = $1 AND pc.deleted_at IS NULL
       ORDER BY pc.created_at DESC`,
      [taskId],
    );
    return { items: rows };
  }

  async createTaskComment(taskId: string, body: Record<string, any>) {
    const schema = this.getSchema();
    const user = this.assertCanRead();
    await this.ensureSchema(schema);
    await this.getVisibleTask(schema, this.requireUuid(taskId, 'ID task'), user);
    return this.createComment(schema, user, { task_id: taskId }, body);
  }

  async updateComment(commentId: string, body: Record<string, any>) {
    const user = this.assertCanRead();
    this.requireUuid(commentId, 'ID commento');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".project_comments WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [commentId],
    );
    const comment = rows[0];
    if (!comment) throw new NotFoundException('Commento non trovato');
    if (!this.isManagerRole(user.role) && comment.created_by !== this.userIdOrNull(user.id)) {
      throw new ForbiddenException('Puoi modificare solo i tuoi commenti.');
    }
    const cleaned = this.cleanCommentBody(body, true);
    await this.updateRow(schema, 'project_comments', commentId, cleaned, this.userIdOrNull(user.id));
    await this.audit(schema, user, 'project_comment_updated', commentId, {});
    return { success: true };
  }

  async deleteComment(commentId: string) {
    const user = this.assertCanRead();
    this.requireUuid(commentId, 'ID commento');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".project_comments
       SET deleted_at = now(), updated_by = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
         AND ($3::boolean = true OR created_by = $1)
       RETURNING id`,
      [this.userIdOrNull(user.id), commentId, this.isManagerRole(user.role)],
    );
    if (!rows[0]) throw new NotFoundException('Commento non trovato');
    await this.audit(schema, user, 'project_comment_deleted', commentId, {});
    return { success: true };
  }

  async listProjectFiles(projectId: string) {
    await this.getProject(projectId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".project_file_links
       WHERE project_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [projectId],
    );
    return { items: rows };
  }

  async createProjectFile(projectId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    await this.getProject(projectId);
    const schema = this.getSchema();
    const fileId = this.requireUuid(String(body.file_id || ''), 'file_id');
    const type = body.type && FILE_TYPES.includes(String(body.type)) ? String(body.type) : null;
    const visibility = FILE_VISIBILITIES.includes(String(body.visibility || 'internal')) ? String(body.visibility || 'internal') : 'internal';
    const row = await this.insertRow(schema, 'project_file_links', {
      project_id: projectId,
      task_id: body.task_id ? this.requireUuid(String(body.task_id), 'task_id') : null,
      file_id: fileId,
      type,
      visibility,
      created_by: this.userIdOrNull(user.id),
    });
    await this.audit(schema, user, 'project_file_link_created', row.id, { projectId, fileId });
    return this.listProjectFiles(projectId);
  }

  async deleteFileLink(linkId: string) {
    const user = this.assertCanManage();
    this.requireUuid(linkId, 'ID file link');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".project_file_links
       SET deleted_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [linkId],
    );
    if (!rows[0]) throw new NotFoundException('Link file non trovato');
    await this.audit(schema, user, 'project_file_link_deleted', linkId, {});
    return { success: true };
  }

  private cleanProjectBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, [
      'company_id', 'contact_id', 'opportunity_id', 'briefing_id', 'quote_id',
      'name', 'description', 'type', 'status', 'priority', 'current_phase', 'progress',
      'project_manager_id', 'start_date', 'due_date', 'delivered_at', 'closed_at',
      'internal_notes', 'client_notes',
    ]);
    if (!partial || 'name' in cleaned) cleaned.name = this.normalizeProjectName(cleaned.name);
    for (const field of ['company_id', 'contact_id', 'opportunity_id', 'briefing_id', 'quote_id', 'project_manager_id']) {
      if (cleaned[field] === '') cleaned[field] = null;
      if (cleaned[field] && !UUID_RE.test(String(cleaned[field]))) throw new BadRequestException(`${field} non valido`);
    }
    if (!partial || 'status' in cleaned) cleaned.status = this.normalizeProjectStatus(cleaned.status);
    if (!partial || 'priority' in cleaned) cleaned.priority = this.normalizeProjectPriority(cleaned.priority);
    if (!partial || 'progress' in cleaned) cleaned.progress = this.normalizeProjectProgress(cleaned.progress);
    if ('type' in cleaned) cleaned.type = this.normalizeProjectType(cleaned.type);
    return cleaned;
  }

  private cleanMilestoneBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, ['title', 'description', 'status', 'due_date', 'completed_at', 'sort_order']);
    if (!partial && !String(cleaned.title || '').trim()) throw new BadRequestException('title obbligatorio');
    if (cleaned.status && !MILESTONE_STATUSES.includes(String(cleaned.status))) throw new BadRequestException('Status milestone non valido');
    if ('sort_order' in cleaned) cleaned.sort_order = this.integerOrNull(cleaned.sort_order, 'sort_order') ?? 0;
    return cleaned;
  }

  private cleanTaskBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, [
      'project_id', 'milestone_id', 'company_id', 'title', 'description', 'status',
      'priority', 'assignee_id', 'assigned_by', 'due_at', 'estimated_minutes',
      'actual_minutes', 'tags', 'blocked_reason', 'completed_at',
    ]);
    if (!partial && !String(cleaned.title || '').trim()) throw new BadRequestException('title obbligatorio');
    for (const field of ['project_id', 'milestone_id', 'company_id', 'assignee_id', 'assigned_by']) {
      if (cleaned[field] === '') cleaned[field] = null;
      if (cleaned[field] && !UUID_RE.test(String(cleaned[field]))) throw new BadRequestException(`${field} non valido`);
    }
    if (cleaned.status && !TASK_STATUSES.includes(String(cleaned.status))) throw new BadRequestException('Status task non valido');
    if (cleaned.priority && !PRIORITIES.includes(String(cleaned.priority))) throw new BadRequestException('Priorita task non valida');
    for (const field of ['estimated_minutes', 'actual_minutes']) {
      if (field in cleaned) cleaned[field] = this.integerOrNull(cleaned[field], field);
    }
    if ('tags' in cleaned && cleaned.tags !== null && cleaned.tags !== undefined) {
      cleaned.tags = Array.isArray(cleaned.tags)
        ? cleaned.tags.map((tag: unknown) => String(tag).trim()).filter(Boolean)
        : String(cleaned.tags).split(',').map((tag) => tag.trim()).filter(Boolean);
    }
    return cleaned;
  }

  private cleanCommentBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, ['body', 'visibility']);
    if (!partial && !String(cleaned.body || '').trim()) throw new BadRequestException('body obbligatorio');
    if (cleaned.visibility && !COMMENT_VISIBILITIES.includes(String(cleaned.visibility))) throw new BadRequestException('Visibilita commento non valida');
    return cleaned;
  }

  private async insertProject(schema: string, cleaned: Record<string, unknown>, userId: string | null, user: AuthUser) {
    try {
      const row = await this.insertRow(schema, 'projects', { ...cleaned, created_by: userId, updated_by: userId });
      await this.audit(schema, user, 'project_created', row.id, cleaned);
      return this.getProject(row.id);
    } catch (err) {
      this.logProjectInsertError(err, 'create_manual');
      throw err;
    }
  }

  private normalizeProjectName(value: unknown): string {
    const name = String(value ?? '').trim();
    return name || 'Nuovo progetto';
  }

  private normalizeProjectStatus(value: unknown): string {
    const status = String(value ?? '').trim();
    if (!status) return 'to_start';
    if (!PROJECT_STATUSES.includes(status)) throw new BadRequestException('Status progetto non valido');
    return status;
  }

  private normalizeProjectPriority(value: unknown): string {
    const priority = String(value ?? '').trim();
    if (!priority) return 'medium';
    if (!PRIORITIES.includes(priority)) throw new BadRequestException('Priorita progetto non valida');
    return priority;
  }

  private normalizeProjectProgress(value: unknown): number {
    if (value === undefined || value === null || value === '') return 0;
    const progress = Number(value);
    if (!Number.isFinite(progress)) throw new BadRequestException('progress non valido');
    return Math.max(0, Math.min(100, Math.trunc(progress)));
  }

  private normalizeProjectType(value: unknown): string {
    const type = String(value ?? '').trim();
    return type || 'custom';
  }

  private logProjectInsertError(err: unknown, context: string) {
    const error = err as {
      name?: string;
      message?: string;
      code?: string;
      detail?: string;
      table?: string;
      column?: string;
      constraint?: string;
      schema?: string;
    };
    this.logger.error(
      `Project insert failed (${context}): ${error?.message || String(err)}`,
      JSON.stringify({
        name: error?.name,
        code: error?.code,
        detail: error?.detail,
        table: error?.table,
        column: error?.column,
        constraint: error?.constraint,
        schema: error?.schema,
      }),
    );
  }

  private async createComment(schema: string, user: AuthUser, scope: Record<string, string>, body: Record<string, any>) {
    const cleaned = this.cleanCommentBody(body, false);
    const row = await this.insertRow(schema, 'project_comments', {
      ...scope,
      ...cleaned,
      created_by: this.userIdOrNull(user.id),
      updated_by: this.userIdOrNull(user.id),
    });
    await this.audit(schema, user, 'project_comment_created', row.id, scope);
    return row;
  }

  private async getVisibleTask(schema: string, taskId: string, user: AuthUser, projectId?: string) {
    const params: unknown[] = [taskId];
    const where = ['t.id = $1', 't.deleted_at IS NULL'];
    if (projectId) {
      params.push(projectId);
      where.push(`t.project_id = $${params.length}`);
    }
    const access = this.taskAccessClause(user, 't', params.length + 1);
    where.push(access.sql);
    params.push(...access.params);
    const rows = await this.dataSource.query(
      `SELECT t.* FROM "${schema}".tasks t WHERE ${where.join(' AND ')} LIMIT 1`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Task non trovato');
    return rows[0];
  }

  private async assertCanWriteTaskById(taskId: string) {
    const schema = this.getSchema();
    const user = this.assertCanRead();
    await this.ensureSchema(schema);
    const task = await this.getVisibleTask(schema, this.requireUuid(taskId, 'ID task'), user);
    if (!this.isManagerRole(user.role) && task.assignee_id !== this.userIdOrNull(user.id)) {
      throw new ForbiddenException('Puoi modificare solo task assegnati a te.');
    }
    return { schema, user, task };
  }

  private async insertRow(schema: string, table: string, values: Record<string, unknown>) {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined);
    const columns = entries.map(([field]) => field);
    const params = entries.map(([, value]) => value);
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".${table} (${columns.join(', ')})
       VALUES (${placeholders})
       RETURNING *`,
      params,
    );
    return rows[0];
  }

  private async updateRow(
    schema: string,
    table: string,
    id: string,
    values: Record<string, unknown>,
    updatedBy: string | null,
    extraWhere = '',
    extraParams: unknown[] = [],
    touchUpdatedBy = true,
  ) {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return;
    const sets = entries.map(([field], i) => `${field} = $${i + 1}`);
    const params = entries.map(([, value]) => value);
    if (touchUpdatedBy) {
      sets.push(`updated_by = $${params.length + 1}`);
      params.push(updatedBy);
    }
    sets.push('updated_at = now()');
    params.push(id, ...extraParams);
    const idParam = params.length - extraParams.length;
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".${table}
       SET ${sets.join(', ')}
       WHERE id = $${idParam} AND deleted_at IS NULL ${extraWhere ? `AND ${extraWhere}` : ''}
       RETURNING id`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Risorsa non trovata');
  }

  private pick(body: Record<string, any>, fields: string[]) {
    const cleaned: Record<string, any> = {};
    for (const field of fields) {
      if (!(field in body)) continue;
      cleaned[field] = body[field] === '' ? null : body[field];
    }
    return cleaned;
  }

  private numberOrNull(value: unknown, field: string): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new BadRequestException(`${field} non valido`);
    return n;
  }

  private integerOrNull(value: unknown, field: string): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n)) throw new BadRequestException(`${field} non valido`);
    return Math.trunc(n);
  }

  private async audit(schema: string, user: AuthUser, action: string, target: string, metadata: Record<string, unknown>) {
    try {
      await this.dataSource.query(
        `INSERT INTO "${schema}".audit_log (actor_email, actor_role, action, target, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
        [user.email || null, user.role, action, target, JSON.stringify(metadata || {})],
      );
    } catch {
      // Audit non bloccante per tenant legacy.
    }
  }
}
