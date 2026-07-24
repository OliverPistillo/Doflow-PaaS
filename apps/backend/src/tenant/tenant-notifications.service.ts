import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantNotificationsTables, seedTenantNotificationRules } from './tenant-notifications-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FINANCE_TYPES = new Set([
  'invoice_overdue',
  'invoice_due',
  'payment_received',
  'renewal_due',
  'recurring_due',
  'financial_deadline_due',
]);
const FINANCE_RULES = new Set([
  'invoice_overdue',
  'invoice_due_soon',
  'financial_deadline_due_soon',
  'renewal_due_30_days',
  'recurring_service_due_30_days',
]);
const ADMIN_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin']);
const MANAGER_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin', 'manager']);
const READABLE_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin', 'manager', 'editor', 'user']);
const NOTIFICATION_STATUSES = ['unread', 'read', 'archived'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const SORT_COLUMNS = ['created_at', 'updated_at', 'priority', 'type', 'status'];

type AuthUser = { id: string; email?: string; role: string };
type RequestLike = {
  user?: Record<string, any>;
  authUser?: Record<string, any>;
  tenantId?: string;
};
type NotificationInput = {
  recipient_user_id?: string | null;
  recipient_role?: string | null;
  title: string;
  body?: string | null;
  type: string;
  priority?: string;
  entity_type?: string | null;
  entity_id?: string | null;
  link_url?: string | null;
  fingerprint?: string | null;
  metadata?: Record<string, unknown> | null;
  created_by?: string | null;
};
type RuleRunResult = { ruleKey: string; status: 'success' | 'failed' | 'skipped'; notificationsCreated: number; errorMessage?: string };

@Injectable()
export class TenantNotificationsService {
  private readonly logger = new Logger(TenantNotificationsService.name);

  constructor(private readonly dataSource: DataSource) {}

  private getUser(req: RequestLike): AuthUser {
    const user = req.user || req.authUser;
    if (!user) throw new ForbiddenException('Utente non valido');
    return {
      id: String(user.sub || user.id || user.userId || ''),
      email: typeof user.email === 'string' ? user.email : undefined,
      role: String(user.role || 'user').toLowerCase().trim(),
    };
  }

  private getSchema(req: RequestLike): string {
    const user = req.user || req.authUser;
    const tenantRef = user?.tenantId || user?.tenant_id || req.tenantId;
    const schema = safeSchema(tenantRef || 'public', 'TenantNotificationsService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Notifiche interne non disponibili nel contesto public');
    return schema;
  }

  private isAdmin(role: string): boolean {
    return ADMIN_ROLES.has(role);
  }

  private isManagerOrAbove(role: string): boolean {
    return MANAGER_ROLES.has(role);
  }

  private canRead(role: string): boolean {
    return READABLE_ROLES.has(role);
  }

  private canSeeFinance(role: string): boolean {
    return this.isAdmin(role);
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

  private textOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private arrayOrNull(value: unknown): string[] | null {
    if (!Array.isArray(value)) return null;
    return value.map((v) => String(v).trim()).filter(Boolean);
  }

  private async ensureSchema(schema: string) {
    await ensureTenantNotificationsTables(this.dataSource, schema);
  }

  private async tableExists(schema: string, table: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1`,
      [schema, table],
    );
    return rows.length > 0;
  }

  private async columnExists(schema: string, table: string, column: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3 LIMIT 1`,
      [schema, table, column],
    );
    return rows.length > 0;
  }

  private visibilityWhere(user: AuthUser, startParam: number) {
    if (this.isAdmin(user.role)) return { sql: 'TRUE', params: [] as unknown[] };
    if (!this.canRead(user.role)) return { sql: 'FALSE', params: [] as unknown[] };

    const userId = this.userIdOrNull(user.id);
    const roleParam = startParam + (userId ? 1 : 0);
    const parts: string[] = [];
    const params: unknown[] = [];

    if (userId) {
      parts.push(`recipient_user_id = $${startParam}`);
      params.push(userId);
    }
    if (this.isManagerOrAbove(user.role)) {
      parts.push(`LOWER(COALESCE(recipient_role, '')) = LOWER($${roleParam})`);
      params.push(user.role);
    }

    const sql = parts.length > 0 ? `(${parts.join(' OR ')})` : 'FALSE';
    return { sql: `${sql} AND type <> ALL($${startParam + params.length}::text[])`, params: [...params, Array.from(FINANCE_TYPES)] };
  }

  async createNotification(schema: string, input: NotificationInput): Promise<{ created: boolean; notification?: any }> {
    const s = safeSchema(schema, 'TenantNotificationsService.createNotification');
    await this.ensureSchema(s);
    const priority = PRIORITIES.includes(String(input.priority || 'medium')) ? String(input.priority || 'medium') : 'medium';
    const fingerprint = this.textOrNull(input.fingerprint);
    const params = [
      this.userIdOrNull(String(input.recipient_user_id || '')),
      this.textOrNull(input.recipient_role)?.toLowerCase() || null,
      String(input.title || '').trim(),
      this.textOrNull(input.body),
      String(input.type || '').trim(),
      priority,
      this.textOrNull(input.entity_type),
      this.userIdOrNull(String(input.entity_id || '')),
      this.textOrNull(input.link_url),
      fingerprint,
      JSON.stringify(input.metadata || {}),
      this.userIdOrNull(String(input.created_by || '')),
    ];

    if (!params[2]) throw new BadRequestException('Titolo notifica obbligatorio');
    if (!params[4]) throw new BadRequestException('Tipo notifica obbligatorio');

    const rows = await this.dataSource.query(
      `
      INSERT INTO "${s}".notifications (
        recipient_user_id, recipient_role, title, body, type, priority,
        entity_type, entity_id, link_url, fingerprint, metadata, created_by,
        created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, now(), now())
      ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL AND deleted_at IS NULL AND status <> 'archived' DO NOTHING
      RETURNING *
      `,
      params,
    );
    return { created: rows.length > 0, notification: rows[0] };
  }

  private async notifyRoles(schema: string, roles: string[], input: Omit<NotificationInput, 'recipient_role' | 'fingerprint'> & { fingerprint: string }) {
    let created = 0;
    for (const role of roles) {
      const result = await this.createNotification(schema, {
        ...input,
        recipient_role: role,
        fingerprint: `${input.fingerprint}:role:${role}`,
      });
      if (result.created) created += 1;
    }
    return created;
  }

  private async notifyUserOrRole(schema: string, userId: unknown, fallbackRole: string, input: Omit<NotificationInput, 'recipient_user_id' | 'recipient_role'>) {
    const id = this.userIdOrNull(String(userId || ''));
    const result = await this.createNotification(schema, id
      ? { ...input, recipient_user_id: id }
      : { ...input, recipient_role: fallbackRole });
    return result.created ? 1 : 0;
  }

  async list(req: RequestLike, query: Record<string, any>) {
    const user = this.getUser(req);
    if (!this.canRead(user.role)) throw new ForbiddenException('Notifiche interne non disponibili per questo ruolo.');
    const schema = this.getSchema(req);
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sortBy = SORT_COLUMNS.includes(String(query.sortBy || '')) ? String(query.sortBy) : 'created_at';
    const sortDir = String(query.sortDir || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const params: unknown[] = [];
    const where: string[] = ['deleted_at IS NULL'];

    const visibility = this.visibilityWhere(user, params.length + 1);
    where.push(visibility.sql);
    params.push(...visibility.params);

    for (const filter of ['status', 'type', 'priority', 'entity_type'] as const) {
      if (query[filter]) {
        params.push(String(query[filter]));
        where.push(`${filter} = $${params.length}`);
      }
    }
    if (query.unread === 'true') where.push(`status = 'unread'`);
    if (query.date_from) {
      params.push(String(query.date_from));
      where.push(`created_at >= $${params.length}::timestamptz`);
    }
    if (query.date_to) {
      params.push(String(query.date_to));
      where.push(`created_at <= $${params.length}::timestamptz`);
    }

    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".notifications
       WHERE ${where.join(' AND ')}
       ORDER BY ${sortBy} ${sortDir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const total = Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".notifications WHERE ${where.join(' AND ')}`,
      params,
    ))[0]?.count || 0);
    return { items: rows, total, limit, offset };
  }

  async summary(req: RequestLike) {
    const user = this.getUser(req);
    if (!this.canRead(user.role)) {
      return {
        unreadNotifications: 0,
        urgentNotifications: 0,
        taskOverdueNotifications: 0,
        assignedTaskNotifications: 0,
        financeNotifications: 0,
        todayDigestAvailable: false,
      };
    }
    const schema = this.getSchema(req);
    await this.ensureSchema(schema);
    const visibility = this.visibilityWhere(user, 1);
    const base = `deleted_at IS NULL AND ${visibility.sql}`;
    const params = visibility.params;
    const count = async (extra: string, extraParams: unknown[] = []) => Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".notifications WHERE ${base} AND ${extra}`,
      [...params, ...extraParams],
    ))[0]?.count || 0);
    const userUuid = this.userIdOrNull(user.id);
    return {
      unreadNotifications: await count(`status = 'unread'`),
      urgentNotifications: await count(`status = 'unread' AND priority = 'urgent'`),
      taskOverdueNotifications: await count(`status = 'unread' AND type = 'task_overdue'`),
      assignedTaskNotifications: userUuid ? await count(`recipient_user_id = $${params.length + 1}`, [userUuid]) : 0,
      financeNotifications: this.canSeeFinance(user.role)
        ? await count(`status = 'unread' AND type = ANY($${params.length + 1}::text[])`, [Array.from(FINANCE_TYPES)])
        : 0,
      todayDigestAvailable: await this.hasTodayDigest(schema, user),
    };
  }

  private async hasTodayDigest(schema: string, user: AuthUser): Promise<boolean> {
    const userUuid = this.userIdOrNull(user.id);
    const rows = await this.dataSource.query(
      `SELECT 1 FROM "${schema}".notification_digests
       WHERE deleted_at IS NULL AND digest_date = current_date
         AND (($1::uuid IS NOT NULL AND user_id = $1::uuid) OR LOWER(COALESCE(role, '')) = LOWER($2))
       LIMIT 1`,
      [userUuid, user.role],
    );
    return rows.length > 0;
  }

  async getOne(req: RequestLike, id: string) {
    this.requireUuid(id);
    const listed = await this.list(req, { limit: 1, offset: 0 });
    const schema = this.getSchema(req);
    const user = this.getUser(req);
    const visibility = this.visibilityWhere(user, 2);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".notifications WHERE id = $1 AND deleted_at IS NULL AND ${visibility.sql} LIMIT 1`,
      [id, ...visibility.params],
    );
    void listed;
    if (!rows[0]) throw new NotFoundException('Notifica non trovata');
    return rows[0];
  }

  async setStatus(req: RequestLike, id: string, status: 'read' | 'unread' | 'archived') {
    this.requireUuid(id);
    const schema = this.getSchema(req);
    const user = this.getUser(req);
    await this.ensureSchema(schema);
    const visibility = this.visibilityWhere(user, 2);
    const readAt = status === 'read' ? 'now()' : 'NULL';
    const archivedAt = status === 'archived' ? 'now()' : 'NULL';
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".notifications
       SET status = $1, read_at = ${readAt}, archived_at = ${archivedAt}, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL AND ${visibility.sql}
       RETURNING *`,
      [status, id, ...visibility.params],
    );
    if (!rows[0]) throw new NotFoundException('Notifica non trovata');
    return rows[0];
  }

  async markAllRead(req: RequestLike) {
    const schema = this.getSchema(req);
    const user = this.getUser(req);
    await this.ensureSchema(schema);
    const visibility = this.visibilityWhere(user, 1);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".notifications
       SET status = 'read', read_at = COALESCE(read_at, now()), updated_at = now()
       WHERE deleted_at IS NULL AND status = 'unread' AND ${visibility.sql}
       RETURNING id`,
      visibility.params,
    );
    return { updated: rows.length };
  }

  async softDelete(req: RequestLike, id: string) {
    this.requireUuid(id);
    const schema = this.getSchema(req);
    const user = this.getUser(req);
    await this.ensureSchema(schema);
    const visibility = this.visibilityWhere(user, 2);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".notifications SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL AND ${visibility.sql}
       RETURNING id`,
      [id, ...visibility.params],
    );
    if (!rows[0]) throw new NotFoundException('Notifica non trovata');
    return { success: true };
  }

  async getPreferences(req: RequestLike) {
    const user = this.getUser(req);
    const userId = this.userIdOrNull(user.id);
    if (!userId) throw new BadRequestException('Utente UUID richiesto per le preferenze notifiche.');
    const schema = this.getSchema(req);
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".notification_preferences (user_id, created_at, updated_at)
       VALUES ($1, now(), now())
       ON CONFLICT (user_id) WHERE deleted_at IS NULL DO UPDATE SET updated_at = "${schema}".notification_preferences.updated_at
       RETURNING *`,
      [userId],
    );
    return rows[0];
  }

  async updatePreferences(req: RequestLike, body: Record<string, any>) {
    const user = this.getUser(req);
    const userId = this.userIdOrNull(user.id);
    if (!userId) throw new BadRequestException('Utente UUID richiesto per le preferenze notifiche.');
    const schema = this.getSchema(req);
    await this.ensureSchema(schema);
    const mutedTypes = this.arrayOrNull(body.muted_types);
    const mutedPriorities = this.arrayOrNull(body.muted_priorities);
    const dailyDigestEnabled = body.daily_digest_enabled === undefined ? true : Boolean(body.daily_digest_enabled);
    const digestTime = this.textOrNull(body.digest_time) || '08:30';
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".notification_preferences (
         user_id, muted_types, muted_priorities, daily_digest_enabled, digest_time, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, now(), now())
       ON CONFLICT (user_id) WHERE deleted_at IS NULL DO UPDATE
         SET muted_types = EXCLUDED.muted_types,
             muted_priorities = EXCLUDED.muted_priorities,
             daily_digest_enabled = EXCLUDED.daily_digest_enabled,
             digest_time = EXCLUDED.digest_time,
             updated_at = now()
       RETURNING *`,
      [userId, mutedTypes, mutedPriorities, dailyDigestEnabled, digestTime],
    );
    return rows[0];
  }

  async listRules(req: RequestLike) {
    const user = this.getUser(req);
    if (!this.isManagerOrAbove(user.role)) throw new ForbiddenException('Manager o superiore richiesto.');
    const schema = this.getSchema(req);
    await this.ensureSchema(schema);
    const where = this.canSeeFinance(user.role) ? 'deleted_at IS NULL' : `deleted_at IS NULL AND category <> 'finance'`;
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".notification_rules WHERE ${where} ORDER BY category ASC, key ASC`,
    );
    return { items: rows };
  }

  async updateRule(req: RequestLike, key: string, body: Record<string, any>) {
    const user = this.getUser(req);
    if (!this.isAdmin(user.role)) throw new ForbiddenException('Solo CEO/Admin puo modificare le regole notifiche.');
    const schema = this.getSchema(req);
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".notification_rules
       SET is_enabled = COALESCE($2, is_enabled),
           severity = COALESCE($3, severity),
           target_roles = COALESCE($4::text[], target_roles),
           config = COALESCE($5::jsonb, config),
           updated_at = now()
       WHERE key = $1 AND deleted_at IS NULL
       RETURNING *`,
      [
        key,
        body.is_enabled === undefined ? null : Boolean(body.is_enabled),
        body.severity && PRIORITIES.includes(String(body.severity)) ? String(body.severity) : null,
        this.arrayOrNull(body.target_roles),
        body.config ? JSON.stringify(body.config) : null,
      ],
    );
    if (!rows[0]) throw new NotFoundException('Regola notifica non trovata');
    return rows[0];
  }

  async runRulesFromRequest(req: RequestLike, key?: string) {
    const user = this.getUser(req);
    if (!this.isManagerOrAbove(user.role)) throw new ForbiddenException('Manager o superiore richiesto.');
    if (key && FINANCE_RULES.has(key) && !this.canSeeFinance(user.role)) {
      throw new ForbiddenException('Regole finance disponibili solo per CEO/Admin.');
    }
    const schema = this.getSchema(req);
    return this.runRulesForSchema(schema, {
      key,
      includeFinance: this.canSeeFinance(user.role),
      triggeredBy: user.id,
    });
  }

  async runRulesForSchema(schema: string, options: { key?: string; includeFinance?: boolean; triggeredBy?: string } = {}) {
    const s = safeSchema(schema, 'TenantNotificationsService.runRulesForSchema');
    await seedTenantNotificationRules(this.dataSource, s);
    const params: unknown[] = [];
    const where = ['deleted_at IS NULL', 'is_enabled = true'];
    if (options.key) {
      params.push(options.key);
      where.push(`key = $${params.length}`);
    }
    if (!options.includeFinance) {
      where.push(`category <> 'finance'`);
    }
    const rules = await this.dataSource.query(
      `SELECT * FROM "${s}".notification_rules WHERE ${where.join(' AND ')} ORDER BY category ASC, key ASC`,
      params,
    );
    const results: RuleRunResult[] = [];
    for (const rule of rules) {
      const started = new Date();
      try {
        const created = await this.runRule(s, rule);
        await this.dataSource.query(
          `UPDATE "${s}".notification_rules SET last_run_at = now(), updated_at = now() WHERE key = $1 AND deleted_at IS NULL`,
          [rule.key],
        );
        await this.recordRun(s, rule.key, 'success', created, started, null, { triggeredBy: options.triggeredBy || null });
        results.push({ ruleKey: rule.key, status: 'success', notificationsCreated: created });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await this.recordRun(s, rule.key, 'failed', 0, started, message, { triggeredBy: options.triggeredBy || null });
        results.push({ ruleKey: rule.key, status: 'failed', notificationsCreated: 0, errorMessage: message });
      }
    }
    return {
      results,
      notificationsCreated: results.reduce((sum, row) => sum + row.notificationsCreated, 0),
    };
  }

  private async recordRun(schema: string, ruleKey: string | null, status: string, created: number, started: Date, errorMessage: string | null, metadata: Record<string, unknown>) {
    await this.dataSource.query(
      `INSERT INTO "${schema}".notification_rule_runs (
         rule_key, status, notifications_created, started_at, finished_at, error_message, metadata
       )
       VALUES ($1, $2, $3, $4, now(), $5, $6::jsonb)`,
      [ruleKey, status, created, started, errorMessage, JSON.stringify(metadata)],
    );
  }

  private async runRule(schema: string, rule: any): Promise<number> {
    switch (rule.key) {
      case 'task_overdue': return this.scanTaskOverdue(schema);
      case 'task_due_today': return this.scanTaskDueToday(schema);
      case 'milestone_overdue': return this.scanMilestoneOverdue(schema);
      case 'milestone_due_soon': return this.scanMilestoneDueSoon(schema);
      case 'project_blocked': return this.scanProjectBlocked(schema);
      case 'project_due_soon': return this.scanProjectDueSoon(schema);
      case 'quote_sent_follow_up_7_days': return this.scanQuoteFollowUp(schema);
      case 'quote_draft_stale_14_days': return this.scanQuoteDraftStale(schema);
      case 'briefing_incomplete_3_days': return this.scanBriefingIncomplete(schema);
      case 'invoice_overdue': return this.scanInvoiceOverdue(schema);
      case 'invoice_due_soon': return this.scanInvoiceDueSoon(schema);
      case 'financial_deadline_due_soon': return this.scanFinancialDeadlineDueSoon(schema);
      case 'renewal_due_30_days': return this.scanRenewalDueSoon(schema);
      case 'recurring_service_due_30_days': return this.scanRecurringServiceDueSoon(schema);
      case 'daily_digest': return 0;
      default: return 0;
    }
  }

  private async scanTaskOverdue(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'tasks'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT t.id, t.title, t.due_at, t.assignee_id, t.project_id, p.project_manager_id, p.name AS project_name
       FROM "${schema}".tasks t
       LEFT JOIN "${schema}".projects p ON p.id = t.project_id
       WHERE t.deleted_at IS NULL
         AND t.due_at < now()
         AND LOWER(COALESCE(t.status::text, '')) NOT IN ('done', 'closed', 'completed')`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyUserOrRole(schema, row.assignee_id || row.project_manager_id, 'manager', {
        title: `Task scaduto: ${row.title}`,
        body: row.project_name ? `Progetto: ${row.project_name}` : null,
        type: 'task_overdue',
        priority: 'high',
        entity_type: 'task',
        entity_id: row.id,
        link_url: row.project_id ? `/projects/${row.project_id}` : '/projects/tasks',
        fingerprint: `task_overdue:${row.id}:${row.due_at}`,
        metadata: { due_at: row.due_at, project_id: row.project_id },
      });
    }
    return created;
  }

  private async scanTaskDueToday(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'tasks'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT t.id, t.title, t.due_at, t.assignee_id, t.project_id, p.project_manager_id, p.name AS project_name
       FROM "${schema}".tasks t
       LEFT JOIN "${schema}".projects p ON p.id = t.project_id
       WHERE t.deleted_at IS NULL
         AND t.due_at >= current_date
         AND t.due_at < current_date + INTERVAL '1 day'
         AND LOWER(COALESCE(t.status::text, '')) NOT IN ('done', 'closed', 'completed')`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyUserOrRole(schema, row.assignee_id || row.project_manager_id, 'manager', {
        title: `Task in scadenza oggi: ${row.title}`,
        body: row.project_name ? `Progetto: ${row.project_name}` : null,
        type: 'task_due',
        priority: 'medium',
        entity_type: 'task',
        entity_id: row.id,
        link_url: row.project_id ? `/projects/${row.project_id}` : '/projects/tasks',
        fingerprint: `task_due_today:${row.id}:${row.due_at}`,
        metadata: { due_at: row.due_at, project_id: row.project_id },
      });
    }
    return created;
  }

  private async scanMilestoneOverdue(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'milestones'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT m.id, m.title, m.due_date, m.project_id, p.project_manager_id, p.name AS project_name
       FROM "${schema}".milestones m
       LEFT JOIN "${schema}".projects p ON p.id = m.project_id
       WHERE m.deleted_at IS NULL
         AND m.due_date < current_date
         AND LOWER(COALESCE(m.status::text, '')) NOT IN ('completed', 'skipped')`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyUserOrRole(schema, row.project_manager_id, 'manager', {
        title: `Milestone scaduta: ${row.title}`,
        body: row.project_name ? `Progetto: ${row.project_name}` : null,
        type: 'milestone_overdue',
        priority: 'high',
        entity_type: 'milestone',
        entity_id: row.id,
        link_url: row.project_id ? `/projects/${row.project_id}` : '/projects/milestones',
        fingerprint: `milestone_overdue:${row.id}:${row.due_date}`,
        metadata: { due_date: row.due_date, project_id: row.project_id },
      });
    }
    return created;
  }

  private async scanMilestoneDueSoon(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'milestones'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT m.id, m.title, m.due_date, m.project_id, p.project_manager_id, p.name AS project_name
       FROM "${schema}".milestones m
       LEFT JOIN "${schema}".projects p ON p.id = m.project_id
       WHERE m.deleted_at IS NULL
         AND m.due_date BETWEEN current_date AND current_date + INTERVAL '7 days'
         AND LOWER(COALESCE(m.status::text, '')) IN ('pending', 'in_progress')`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyUserOrRole(schema, row.project_manager_id, 'manager', {
        title: `Milestone in scadenza: ${row.title}`,
        body: row.project_name ? `Progetto: ${row.project_name}` : null,
        type: 'milestone_due',
        priority: 'medium',
        entity_type: 'milestone',
        entity_id: row.id,
        link_url: row.project_id ? `/projects/${row.project_id}` : '/projects/milestones',
        fingerprint: `milestone_due_soon:${row.id}:${row.due_date}`,
        metadata: { due_date: row.due_date, project_id: row.project_id },
      });
    }
    return created;
  }

  private async scanProjectBlocked(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'projects'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT id, name, project_manager_id FROM "${schema}".projects
       WHERE deleted_at IS NULL AND LOWER(COALESCE(status::text, '')) = 'blocked'`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyUserOrRole(schema, row.project_manager_id, 'manager', {
        title: `Progetto bloccato: ${row.name}`,
        type: 'project_blocked',
        priority: 'urgent',
        entity_type: 'project',
        entity_id: row.id,
        link_url: `/projects/${row.id}`,
        fingerprint: `project_blocked:${row.id}`,
        metadata: {},
      });
      created += await this.notifyRoles(schema, ['owner', 'admin', 'superadmin'], {
        title: `Progetto bloccato: ${row.name}`,
        type: 'project_blocked',
        priority: 'urgent',
        entity_type: 'project',
        entity_id: row.id,
        link_url: `/projects/${row.id}`,
        fingerprint: `project_blocked:${row.id}`,
        metadata: {},
      });
    }
    return created;
  }

  private async scanProjectDueSoon(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'projects'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT id, name, due_date, project_manager_id FROM "${schema}".projects
       WHERE deleted_at IS NULL
         AND due_date BETWEEN current_date AND current_date + INTERVAL '7 days'
         AND LOWER(COALESCE(status::text, '')) NOT IN ('delivered', 'closed', 'done', 'completed')`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyUserOrRole(schema, row.project_manager_id, 'manager', {
        title: `Progetto in consegna: ${row.name}`,
        body: `Scadenza: ${row.due_date}`,
        type: 'project_due',
        priority: 'medium',
        entity_type: 'project',
        entity_id: row.id,
        link_url: `/projects/${row.id}`,
        fingerprint: `project_due_soon:${row.id}:${row.due_date}`,
        metadata: { due_date: row.due_date },
      });
    }
    return created;
  }

  private async scanQuoteFollowUp(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'quotes'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT id, title, quote_number, company_id, created_by, updated_at, created_at FROM "${schema}".quotes
       WHERE deleted_at IS NULL
         AND LOWER(COALESCE(status::text, '')) = 'sent'
         AND COALESCE(updated_at, created_at) <= now() - INTERVAL '7 days'`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyUserOrRole(schema, row.created_by, 'manager', {
        title: `Follow-up preventivo: ${row.quote_number || row.title}`,
        body: 'Preventivo inviato da almeno 7 giorni.',
        type: 'quote_follow_up',
        priority: 'medium',
        entity_type: 'quote',
        entity_id: row.id,
        link_url: '/quotes/sent',
        fingerprint: `quote_follow_up_7_days:${row.id}`,
        metadata: { company_id: row.company_id },
      });
    }
    return created;
  }

  private async scanQuoteDraftStale(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'quotes'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT id, title, quote_number, created_by, created_at FROM "${schema}".quotes
       WHERE deleted_at IS NULL
         AND LOWER(COALESCE(status::text, '')) = 'draft'
         AND created_at <= now() - INTERVAL '14 days'`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyUserOrRole(schema, row.created_by, 'manager', {
        title: `Preventivo bozza fermo: ${row.quote_number || row.title}`,
        body: 'Bozza aperta da oltre 14 giorni.',
        type: 'quote_follow_up',
        priority: 'low',
        entity_type: 'quote',
        entity_id: row.id,
        link_url: '/quotes/drafts',
        fingerprint: `quote_draft_stale_14_days:${row.id}`,
        metadata: { created_at: row.created_at },
      });
    }
    return created;
  }

  private async scanBriefingIncomplete(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'briefings'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT id, title, created_by, created_at FROM "${schema}".briefings
       WHERE deleted_at IS NULL
         AND LOWER(COALESCE(status::text, '')) IN ('draft', 'sent', 'partially_completed', 'pending')
         AND created_at <= now() - INTERVAL '3 days'`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyUserOrRole(schema, row.created_by, 'manager', {
        title: `Briefing incompleto: ${row.title}`,
        body: 'Briefing aperto da oltre 3 giorni.',
        type: 'briefing_incomplete',
        priority: 'medium',
        entity_type: 'briefing',
        entity_id: row.id,
        link_url: '/briefings/incomplete',
        fingerprint: `briefing_incomplete_3_days:${row.id}`,
        metadata: { created_at: row.created_at },
      });
    }
    return created;
  }

  private async scanInvoiceOverdue(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'invoices'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT id, invoice_number, title, due_date FROM "${schema}".invoices
       WHERE deleted_at IS NULL
         AND due_date < current_date
         AND LOWER(COALESCE(status::text, '')) NOT IN ('paid', 'cancelled', 'void')`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyRoles(schema, ['owner', 'admin', 'superadmin'], {
        title: `Fattura scaduta: ${row.invoice_number || row.title}`,
        body: `Scadenza: ${row.due_date}`,
        type: 'invoice_overdue',
        priority: 'urgent',
        entity_type: 'invoice',
        entity_id: row.id,
        link_url: '/finance/invoices',
        fingerprint: `invoice_overdue:${row.id}:${row.due_date}`,
        metadata: { due_date: row.due_date },
      });
    }
    return created;
  }

  private async scanInvoiceDueSoon(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'invoices'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT id, invoice_number, title, due_date FROM "${schema}".invoices
       WHERE deleted_at IS NULL
         AND due_date BETWEEN current_date AND current_date + INTERVAL '7 days'
         AND LOWER(COALESCE(status::text, '')) NOT IN ('paid', 'cancelled', 'void')`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyRoles(schema, ['owner', 'admin', 'superadmin'], {
        title: `Fattura in scadenza: ${row.invoice_number || row.title}`,
        body: `Scadenza: ${row.due_date}`,
        type: 'invoice_due',
        priority: 'high',
        entity_type: 'invoice',
        entity_id: row.id,
        link_url: '/finance/invoices',
        fingerprint: `invoice_due_soon:${row.id}:${row.due_date}`,
        metadata: { due_date: row.due_date },
      });
    }
    return created;
  }

  private async scanFinancialDeadlineDueSoon(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'financial_deadlines'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT id, title, due_date FROM "${schema}".financial_deadlines
       WHERE deleted_at IS NULL
         AND due_date BETWEEN current_date AND current_date + INTERVAL '7 days'
         AND LOWER(COALESCE(status::text, '')) = 'open'`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyRoles(schema, ['owner', 'admin', 'superadmin'], {
        title: `Scadenza economica: ${row.title}`,
        body: `Scadenza: ${row.due_date}`,
        type: 'financial_deadline_due',
        priority: 'high',
        entity_type: 'deadline',
        entity_id: row.id,
        link_url: '/finance/deadlines',
        fingerprint: `financial_deadline_due_soon:${row.id}:${row.due_date}`,
        metadata: { due_date: row.due_date },
      });
    }
    return created;
  }

  private async scanRenewalDueSoon(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'renewals'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT id, title, due_date FROM "${schema}".renewals
       WHERE deleted_at IS NULL
         AND due_date BETWEEN current_date AND current_date + INTERVAL '30 days'
         AND LOWER(COALESCE(status::text, '')) IN ('upcoming', 'reminded')`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyRoles(schema, ['owner', 'admin', 'superadmin'], {
        title: `Rinnovo in scadenza: ${row.title}`,
        body: `Scadenza: ${row.due_date}`,
        type: 'renewal_due',
        priority: 'medium',
        entity_type: 'renewal',
        entity_id: row.id,
        link_url: '/finance/renewals',
        fingerprint: `renewal_due_30_days:${row.id}:${row.due_date}`,
        metadata: { due_date: row.due_date },
      });
    }
    return created;
  }

  private async scanRecurringServiceDueSoon(schema: string): Promise<number> {
    if (!(await this.tableExists(schema, 'recurring_services'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT id, name, next_due_date FROM "${schema}".recurring_services
       WHERE deleted_at IS NULL
         AND next_due_date BETWEEN current_date AND current_date + INTERVAL '30 days'
         AND LOWER(COALESCE(status::text, '')) = 'active'`,
    );
    let created = 0;
    for (const row of rows) {
      created += await this.notifyRoles(schema, ['owner', 'admin', 'superadmin'], {
        title: `Servizio ricorrente in scadenza: ${row.name}`,
        body: `Scadenza: ${row.next_due_date}`,
        type: 'recurring_due',
        priority: 'medium',
        entity_type: 'recurring_service',
        entity_id: row.id,
        link_url: '/finance/recurring-services',
        fingerprint: `recurring_service_due_30_days:${row.id}:${row.next_due_date}`,
        metadata: { next_due_date: row.next_due_date },
      });
    }
    return created;
  }

  async listDigests(req: RequestLike) {
    const user = this.getUser(req);
    if (!this.canRead(user.role)) throw new ForbiddenException('Notifiche interne non disponibili per questo ruolo.');
    const schema = this.getSchema(req);
    await this.ensureSchema(schema);
    const userUuid = this.userIdOrNull(user.id);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".notification_digests
       WHERE deleted_at IS NULL
         AND (($1::uuid IS NOT NULL AND user_id = $1::uuid) OR LOWER(COALESCE(role, '')) = LOWER($2) OR $3::boolean = true)
       ORDER BY digest_date DESC, created_at DESC
       LIMIT 30`,
      [userUuid, user.role, this.isAdmin(user.role)],
    );
    return { items: rows };
  }

  async todayDigest(req: RequestLike) {
    const user = this.getUser(req);
    const schema = this.getSchema(req);
    await this.ensureSchema(schema);
    const userUuid = this.userIdOrNull(user.id);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".notification_digests
       WHERE deleted_at IS NULL AND digest_date = current_date
         AND (($1::uuid IS NOT NULL AND user_id = $1::uuid) OR LOWER(COALESCE(role, '')) = LOWER($2) OR $3::boolean = true)
       ORDER BY created_at DESC
       LIMIT 1`,
      [userUuid, user.role, this.isAdmin(user.role)],
    );
    return rows[0] || null;
  }

  async generateDigestFromRequest(req: RequestLike) {
    const user = this.getUser(req);
    if (!this.canRead(user.role)) throw new ForbiddenException('Notifiche interne non disponibili per questo ruolo.');
    const schema = this.getSchema(req);
    return this.generateDailyDigest(schema, user);
  }

  async generateDailyDigest(schema: string, user?: AuthUser) {
    const s = safeSchema(schema, 'TenantNotificationsService.generateDailyDigest');
    await this.ensureSchema(s);
    if (user) return this.generateDigestForUser(s, user);

    if (!(await this.tableExists(s, 'users'))) return { generated: 0 };
    const users = await this.dataSource.query(
      `SELECT id, email, role FROM "${s}".users WHERE COALESCE(is_active, true) = true AND role IS NOT NULL`,
    );
    let generated = 0;
    for (const row of users) {
      if (!this.canRead(String(row.role || ''))) continue;
      await this.generateDigestForUser(s, { id: row.id, email: row.email, role: String(row.role).toLowerCase() });
      generated += 1;
    }
    return { generated };
  }

  private async generateDigestForUser(schema: string, user: AuthUser) {
    const visibility = this.visibilityWhere(user, 1);
    const params = visibility.params;
    const count = async (extra: string, extraParams: unknown[] = []) => Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".notifications
       WHERE deleted_at IS NULL AND ${visibility.sql} AND ${extra}`,
      [...params, ...extraParams],
    ))[0]?.count || 0);
    const notificationRows = await this.dataSource.query(
      `SELECT id FROM "${schema}".notifications
       WHERE deleted_at IS NULL AND status = 'unread' AND ${visibility.sql}
       ORDER BY created_at DESC
       LIMIT 50`,
      params,
    );
    const summary = {
      task_overdue: await count(`type = 'task_overdue' AND status = 'unread'`),
      task_due: await count(`type = 'task_due' AND status = 'unread'`),
      milestone_overdue: await count(`type = 'milestone_overdue' AND status = 'unread'`),
      project_blocked: await count(`type = 'project_blocked' AND status = 'unread'`),
      quote_follow_up: await count(`type = 'quote_follow_up' AND status = 'unread'`),
      briefing_incomplete: await count(`type = 'briefing_incomplete' AND status = 'unread'`),
      invoice_overdue: this.canSeeFinance(user.role) ? await count(`type = 'invoice_overdue' AND status = 'unread'`) : 0,
      renewals_due: this.canSeeFinance(user.role) ? await count(`type = 'renewal_due' AND status = 'unread'`) : 0,
      financial_deadlines_due: this.canSeeFinance(user.role) ? await count(`type = 'financial_deadline_due' AND status = 'unread'`) : 0,
    };
    const notificationIds = notificationRows.map((row: any) => row.id);
    const userUuid = this.userIdOrNull(user.id);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".notification_digests (
         user_id, role, digest_date, status, title, summary, notification_ids, created_at
       )
       VALUES ($1, $2, current_date, 'generated', $3, $4::jsonb, $5::uuid[], now())
       RETURNING *`,
      [userUuid, user.role, 'Digest giornaliero interno', JSON.stringify(summary), notificationIds],
    );
    return rows[0];
  }

  @Cron(CronExpression.EVERY_HOUR)
  async scheduledRuleScan() {
    await this.runScheduled('rules');
  }

  @Cron(CronExpression.EVERY_DAY_AT_8AM)
  async scheduledDigest() {
    await this.runScheduled('digest');
  }

  private async runScheduled(kind: 'rules' | 'digest') {
    try {
      const tenants = await this.dataSource.query(
        `SELECT COALESCE(NULLIF(schema_name, ''), slug) AS schema
         FROM public.tenants
         WHERE is_active = true`,
      );
      for (const tenant of tenants) {
        const schema = safeSchema(tenant.schema, 'TenantNotificationsService.runScheduled');
        try {
          if (kind === 'rules') await this.runRulesForSchema(schema, { includeFinance: true });
          else await this.generateDailyDigest(schema);
        } catch (error) {
          this.logger.warn(`Scheduled notifications ${kind} failed for ${schema}: ${error instanceof Error ? error.message : error}`);
        }
      }
    } catch (error) {
      this.logger.warn(`Scheduled notifications ${kind} failed: ${error instanceof Error ? error.message : error}`);
    }
  }
}
