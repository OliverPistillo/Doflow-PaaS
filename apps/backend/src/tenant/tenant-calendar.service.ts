import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import { TenantNotificationsService } from './tenant-notifications.service';
import { ensureTenantCalendarTables, seedTenantPlanningViews } from './tenant-calendar-schema';
import {
  CALENDAR_ATTENDEE_ROLES,
  CALENDAR_EVENT_STATUSES,
  CALENDAR_EVENT_TYPES,
  CALENDAR_LINK_RELATIONS,
  CALENDAR_PRIORITIES,
  CALENDAR_REMINDER_METHODS,
  CALENDAR_RESPONSE_STATUSES,
  CALENDAR_SOURCE_TYPES,
  CALENDAR_TRANSPARENCIES,
  CALENDAR_VISIBILITIES,
  DEADLINE_CALENDAR_EVENT_TYPES,
  FINANCE_CALENDAR_EVENT_TYPES,
  PLANNING_VIEW_TYPES,
} from './tenant-calendar.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const UUID_STRICT_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin']);
const READ_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin', 'manager', 'editor', 'user', 'viewer']);
const SORT_COLUMNS = ['start_at', 'end_at', 'created_at', 'updated_at', 'priority', 'event_type', 'status'];
const LINK_ENTITY_TYPES = new Set([
  'company',
  'contact',
  'lead',
  'opportunity',
  'briefing',
  'quote',
  'project',
  'task',
  'milestone',
  'invoice',
  'payment',
  'deadline',
  'renewal',
  'recurring_service',
  'contract',
  'paperwork_dossier',
  'paperwork_item',
  'document',
]);

type AuthUser = { id: string; email?: string; role: string };
type EventMatch = {
  title: string;
  description?: string | null;
  event_type: string;
  start_at: string;
  end_at?: string | null;
  all_day?: boolean;
  priority?: string;
  owner_user_id?: string | null;
  assigned_to_user_id?: string | null;
  source_entity_type: string;
  source_entity_id: string;
  source_fingerprint: string;
  visibility?: string;
  transparency?: string;
  metadata?: Record<string, unknown>;
};

@Injectable()
export class TenantCalendarService {
  private readonly logger = new Logger(TenantCalendarService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: TenantNotificationsService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getUser(): AuthUser {
    const user = this.request?.user || this.request?.authUser;
    if (!user) throw new ForbiddenException('Utente non valido');
    return {
      id: String(user.sub || user.id || user.userId || ''),
      email: typeof user.email === 'string' ? user.email : undefined,
      role: String(user.role || 'user').toLowerCase().trim(),
    };
  }

  private getSchema(): string {
    const user = this.request?.user || this.request?.authUser;
    const tenantRef = user?.tenantId || user?.tenant_id || this.request?.tenantId;
    const schema = safeSchema(tenantRef || 'public', 'TenantCalendarService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Calendario tenant non disponibile nel contesto public');
    return schema;
  }

  private isAdmin(role: string): boolean {
    return ADMIN_ROLES.has(String(role || '').toLowerCase());
  }

  private canRead(role: string): boolean {
    return READ_ROLES.has(String(role || '').toLowerCase());
  }

  private canManage(role: string): boolean {
    return this.isAdmin(role) || hasRoleAtLeast(role, 'manager');
  }

  private canSync(role: string): boolean {
    return this.isAdmin(role) || String(role).toLowerCase() === 'manager';
  }

  private canViewFinance(role: string): boolean {
    return this.isAdmin(role);
  }

  private assertRead(user = this.getUser()) {
    if (!this.canRead(user.role)) throw new ForbiddenException('Non hai accesso al calendario interno.');
    return user;
  }

  private assertManage(user = this.getUser()) {
    if (!this.canManage(user.role)) throw new ForbiddenException('Non hai permessi per gestire eventi calendario.');
    return user;
  }

  private assertSync(user = this.getUser()) {
    if (!this.canSync(user.role)) throw new ForbiddenException('Non hai permessi per sincronizzare eventi derivati.');
    return user;
  }

  private async ensureSchema(schema: string) {
    await ensureTenantCalendarTables(this.dataSource, schema);
  }

  private requireUuid(value: unknown, label = 'ID'): string {
    const text = String(value || '');
    if (!UUID_STRICT_RE.test(text)) throw new BadRequestException(`${label} non valido`);
    return text;
  }

  private uuidOrNull(value: unknown): string | null {
    const text = String(value || '');
    return UUID_STRICT_RE.test(text) ? text : null;
  }

  private textOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private parseBool(value: unknown): boolean {
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  private normalizeLimit(value: unknown, fallback = 50): number {
    const n = Number(value || fallback);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(200, Math.trunc(n)));
  }

  private normalizeOffset(value: unknown): number {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.trunc(n));
  }

  private normalizeSort(value: unknown): string {
    const sort = String(value || 'start_at').trim();
    return SORT_COLUMNS.includes(sort) ? sort : 'start_at';
  }

  private normalizeEnum(value: unknown, allowed: readonly string[], fallback: string, label: string): string {
    const text = String(value || fallback).trim();
    if (!allowed.includes(text)) throw new BadRequestException(`${label} non valido`);
    return text;
  }

  private normalizeDateTime(value: unknown, label = 'data'): string {
    const text = String(value || '').trim();
    const date = new Date(text);
    if (!text || Number.isNaN(date.getTime())) throw new BadRequestException(`${label} non valida`);
    return date.toISOString();
  }

  private normalizeDate(value: unknown, fallback?: string): string {
    const text = String(value || fallback || '').trim();
    const date = new Date(text ? `${text.slice(0, 10)}T00:00:00.000Z` : '');
    if (!text || Number.isNaN(date.getTime())) throw new BadRequestException('Data non valida');
    return date.toISOString().slice(0, 10);
  }

  private parseJsonObject(value: unknown, fallback: Record<string, unknown> | null = null): Record<string, unknown> | null {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    try {
      const parsed = JSON.parse(String(value));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestException('JSON non valido');
    }
    throw new BadRequestException('JSON deve essere un oggetto');
  }

  private safeIdentifier(value: string, label = 'identificatore'): string {
    const text = String(value || '').trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) throw new BadRequestException(`${label} non valido`);
    return text;
  }

  private async tableExists(schema: string, table: string): Promise<boolean> {
    const safe = safeSchema(schema, 'TenantCalendarService.tableExists');
    const safeTable = this.safeIdentifier(table, 'tabella');
    const rows = await this.dataSource.query(`SELECT to_regclass($1) AS exists`, [`"${safe}"."${safeTable}"`]);
    return Boolean(rows[0]?.exists);
  }

  private async columnExists(schema: string, table: string, column: string): Promise<boolean> {
    const safe = safeSchema(schema, 'TenantCalendarService.columnExists');
    const rows = await this.dataSource.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3 LIMIT 1`,
      [safe, this.safeIdentifier(table, 'tabella'), this.safeIdentifier(column, 'colonna')],
    );
    return rows.length > 0;
  }

  private visibilityWhere(user: AuthUser, alias = 'e', startParam = 1): { sql: string; params: unknown[] } {
    const financeSql = this.canViewFinance(user.role)
      ? 'TRUE'
      : `${alias}.event_type <> ALL($${startParam}::text[])`;
    const params: unknown[] = this.canViewFinance(user.role) ? [] : [Array.from(FINANCE_CALENDAR_EVENT_TYPES)];
    if (this.isAdmin(user.role)) return { sql: financeSql, params };

    const userId = this.uuidOrNull(user.id);
    const privateParts = [
      `${alias}.visibility <> 'private'`,
      userId ? `${alias}.owner_user_id = $${startParam + params.length + 1}` : null,
      userId ? `${alias}.assigned_to_user_id = $${startParam + params.length + 1}` : null,
      userId ? `${alias}.created_by = $${startParam + params.length + 1}` : null,
    ].filter(Boolean);
    if (userId) params.push(userId);
    return { sql: `(${financeSql}) AND (${privateParts.join(' OR ') || 'FALSE'})`, params };
  }

  private scrubEvent(row: any, user: AuthUser) {
    if (!row) return row;
    if (this.canViewFinance(user.role) || !FINANCE_CALENDAR_EVENT_TYPES.has(row.event_type)) return row;
    return {
      ...row,
      description: null,
      metadata: { scrubbed: true },
      title: this.financeTitle(row.event_type),
      source_entity_id: null,
    };
  }

  private financeTitle(eventType: string): string {
    if (eventType === 'invoice_due') return 'Scadenza fattura';
    if (eventType === 'financial_deadline') return 'Scadenza finance';
    if (eventType === 'renewal_due') return 'Rinnovo in scadenza';
    if (eventType === 'recurring_service_due') return 'Servizio ricorrente in scadenza';
    return 'Scadenza finance';
  }

  private async logActivity(schema: string, action: string, payload: { eventId?: string | null; viewId?: string | null; entityType?: string | null; entityId?: string | null; metadata?: Record<string, unknown> | null; actorUserId?: string | null }) {
    const s = safeSchema(schema, 'TenantCalendarService.logActivity');
    await this.dataSource.query(
      `INSERT INTO "${s}".planning_activity (
         action, event_id, view_id, actor_user_id, entity_type, entity_id, metadata, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())`,
      [
        action,
        payload.eventId || null,
        payload.viewId || null,
        payload.actorUserId || null,
        payload.entityType || null,
        payload.entityId || null,
        payload.metadata ? JSON.stringify(payload.metadata) : null,
      ],
    );
  }

  private defaultRange(query: Record<string, any> = {}) {
    const now = new Date();
    const start = query.start
      ? new Date(String(query.start))
      : new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const end = query.end
      ? new Date(String(query.end))
      : new Date(now.getTime() + 30 * 86400000);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new BadRequestException('Range calendario non valido');
    if (start > end) throw new BadRequestException('start deve essere precedente a end');
    return { start: start.toISOString(), end: end.toISOString() };
  }

  private buildEventFilters(schema: string, user: AuthUser, query: Record<string, any> = {}) {
    const { start, end } = this.defaultRange(query);
    const params: unknown[] = [start, end];
    const filters = [`e.deleted_at IS NULL`, `e.start_at <= $2::timestamptz`, `COALESCE(e.end_at, e.start_at) >= $1::timestamptz`];
    if (!this.parseBool(query.include_cancelled)) filters.push(`e.status <> 'cancelled'`);
    const visibility = this.visibilityWhere(user, 'e', params.length + 1);
    filters.push(visibility.sql);
    params.push(...visibility.params);
    for (const [key, column] of [
      ['event_type', 'event_type'],
      ['status', 'status'],
      ['priority', 'priority'],
      ['owner_user_id', 'owner_user_id'],
      ['assigned_to_user_id', 'assigned_to_user_id'],
      ['source_entity_type', 'source_entity_type'],
    ] as Array<[string, string]>) {
      if (query[key]) {
        params.push(String(query[key]));
        filters.push(`e.${column} = $${params.length}`);
      }
    }
    if (query.source_entity_id) {
      params.push(this.requireUuid(query.source_entity_id, 'source_entity_id'));
      filters.push(`e.source_entity_id = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${String(query.search).trim()}%`);
      filters.push(`(e.title ILIKE $${params.length} OR COALESCE(e.description, '') ILIKE $${params.length})`);
    }
    return { where: filters.join(' AND '), params, start, end };
  }

  async options() {
    return {
      event_types: CALENDAR_EVENT_TYPES,
      statuses: CALENDAR_EVENT_STATUSES,
      priorities: CALENDAR_PRIORITIES,
      visibilities: CALENDAR_VISIBILITIES,
      transparencies: CALENDAR_TRANSPARENCIES,
      source_types: CALENDAR_SOURCE_TYPES,
      attendee_roles: CALENDAR_ATTENDEE_ROLES,
      response_statuses: CALENDAR_RESPONSE_STATUSES,
      reminder_methods: CALENDAR_REMINDER_METHODS,
      link_relations: CALENDAR_LINK_RELATIONS,
      view_types: PLANNING_VIEW_TYPES,
      deadline_event_types: DEADLINE_CALENDAR_EVENT_TYPES,
    };
  }

  async summary() {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const visibility = this.visibilityWhere(user, 'e', 1);
    const rows = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE e.start_at::date = CURRENT_DATE AND e.status NOT IN ('cancelled', 'completed'))::int AS "eventsToday",
         COUNT(*) FILTER (WHERE e.start_at >= date_trunc('week', now()) AND e.start_at < date_trunc('week', now()) + interval '7 days' AND e.status <> 'cancelled')::int AS "eventsThisWeek",
         COUNT(*) FILTER (WHERE COALESCE(e.end_at, e.start_at) < now() AND e.status IN ('scheduled', 'tentative'))::int AS "overdueEvents",
         COUNT(*) FILTER (WHERE e.start_at < now() + interval '7 days' AND e.event_type = ANY($${visibility.params.length + 1}::text[]) AND e.status <> 'cancelled')::int AS "deadlinesThisWeek",
         COUNT(*) FILTER (WHERE e.event_type = 'unavailable' AND e.start_at::date <= CURRENT_DATE AND COALESCE(e.end_at, e.start_at)::date >= CURRENT_DATE AND e.status <> 'cancelled')::int AS "teamUnavailableToday",
         MIN(e.start_at) FILTER (WHERE e.start_at >= now() AND e.status NOT IN ('cancelled', 'completed')) AS "nextEventAt",
         COUNT(*) FILTER (WHERE e.source_type = 'derived' AND e.deleted_at IS NULL)::int AS "derivedEventsCount"
       FROM "${schema}".calendar_events e
       WHERE e.deleted_at IS NULL AND ${visibility.sql}`,
      [...visibility.params, Array.from(DEADLINE_CALENDAR_EVENT_TYPES)],
    );
    const remindersDue = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM "${schema}".calendar_event_reminders r
       JOIN "${schema}".calendar_events e ON e.id = r.event_id
       WHERE r.status = 'pending' AND r.remind_at <= now() AND e.deleted_at IS NULL AND ${visibility.sql}`,
      visibility.params,
    );
    const conflicts = await this.conflicts({ start: new Date().toISOString(), end: new Date(Date.now() + 7 * 86400000).toISOString(), limit: 1 });
    return {
      eventsToday: Number(rows[0]?.eventsToday || 0),
      eventsThisWeek: Number(rows[0]?.eventsThisWeek || 0),
      overdueEvents: Number(rows[0]?.overdueEvents || 0),
      conflictsCount: Number(conflicts.total || 0),
      deadlinesThisWeek: Number(rows[0]?.deadlinesThisWeek || 0),
      teamUnavailableToday: Number(rows[0]?.teamUnavailableToday || 0),
      nextEventAt: rows[0]?.nextEventAt || null,
      remindersDue: Number(remindersDue[0]?.count || 0),
      derivedEventsCount: Number(rows[0]?.derivedEventsCount || 0),
      sources: { calendar_events: true, calendar_event_reminders: true },
    };
  }

  async listEvents(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sort = this.normalizeSort(query.sort);
    const dir = String(query.dir || 'asc').toLowerCase() === 'desc' ? 'DESC' : 'ASC';
    const filters = this.buildEventFilters(schema, user, query);
    const rows = await this.dataSource.query(
      `SELECT e.*
       FROM "${schema}".calendar_events e
       WHERE ${filters.where}
       ORDER BY e.${sort} ${dir}, e.created_at DESC
       LIMIT $${filters.params.length + 1} OFFSET $${filters.params.length + 2}`,
      [...filters.params, limit, offset],
    );
    const totalRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "${schema}".calendar_events e WHERE ${filters.where}`,
      filters.params,
    );
    return { items: rows.map((row: any) => this.scrubEvent(row, user)), total: Number(totalRows[0]?.total || 0), limit, offset };
  }

  async getEvent(eventId: string) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const id = this.requireUuid(eventId, 'eventId');
    const visibility = this.visibilityWhere(user, 'e', 2);
    const rows = await this.dataSource.query(
      `SELECT e.* FROM "${schema}".calendar_events e WHERE e.id = $1 AND e.deleted_at IS NULL AND ${visibility.sql} LIMIT 1`,
      [id, ...visibility.params],
    );
    if (!rows[0]) throw new NotFoundException('Evento non trovato');
    return this.scrubEvent(rows[0], user);
  }

  private normalizeEventInput(body: Record<string, any>, existing?: any) {
    const startAt = body.start_at !== undefined ? this.normalizeDateTime(body.start_at, 'start_at') : existing?.start_at;
    if (!startAt) throw new BadRequestException('start_at obbligatorio');
    const endAt = body.end_at === null || body.end_at === '' ? null : body.end_at !== undefined ? this.normalizeDateTime(body.end_at, 'end_at') : existing?.end_at || null;
    if (endAt && new Date(endAt) < new Date(startAt)) throw new BadRequestException('end_at deve essere successivo o uguale a start_at');
    const sourceEntityType = this.textOrNull(body.source_entity_type ?? existing?.source_entity_type);
    if (sourceEntityType && !LINK_ENTITY_TYPES.has(sourceEntityType)) throw new BadRequestException('source_entity_type non consentito');
    return {
      title: String(body.title ?? existing?.title ?? '').trim(),
      description: this.textOrNull(body.description ?? existing?.description),
      event_type: this.normalizeEnum(body.event_type ?? existing?.event_type, CALENDAR_EVENT_TYPES, 'internal', 'event_type'),
      status: this.normalizeEnum(body.status ?? existing?.status, CALENDAR_EVENT_STATUSES, 'scheduled', 'status'),
      priority: this.normalizeEnum(body.priority ?? existing?.priority, CALENDAR_PRIORITIES, 'medium', 'priority'),
      start_at: startAt,
      end_at: endAt,
      all_day: body.all_day !== undefined ? this.parseBool(body.all_day) : Boolean(existing?.all_day || false),
      timezone: this.textOrNull(body.timezone ?? existing?.timezone) || 'Europe/Rome',
      location: this.textOrNull(body.location ?? existing?.location),
      meeting_url: this.textOrNull(body.meeting_url ?? existing?.meeting_url),
      color: this.textOrNull(body.color ?? existing?.color),
      visibility: this.normalizeEnum(body.visibility ?? existing?.visibility, CALENDAR_VISIBILITIES, 'team', 'visibility'),
      transparency: this.normalizeEnum(body.transparency ?? existing?.transparency, CALENDAR_TRANSPARENCIES, 'busy', 'transparency'),
      owner_user_id: this.uuidOrNull(body.owner_user_id ?? existing?.owner_user_id),
      assigned_to_user_id: this.uuidOrNull(body.assigned_to_user_id ?? existing?.assigned_to_user_id),
      source_type: this.normalizeEnum(body.source_type ?? existing?.source_type, CALENDAR_SOURCE_TYPES, 'manual', 'source_type'),
      source_entity_type: sourceEntityType,
      source_entity_id: this.uuidOrNull(body.source_entity_id ?? existing?.source_entity_id),
      source_fingerprint: this.textOrNull(body.source_fingerprint ?? existing?.source_fingerprint),
      is_system_generated: body.is_system_generated !== undefined ? this.parseBool(body.is_system_generated) : Boolean(existing?.is_system_generated || false),
      is_locked: body.is_locked !== undefined ? this.parseBool(body.is_locked) : Boolean(existing?.is_locked || false),
      recurrence_rule: this.textOrNull(body.recurrence_rule ?? existing?.recurrence_rule),
      recurrence_until: body.recurrence_until ? this.normalizeDateTime(body.recurrence_until, 'recurrence_until') : existing?.recurrence_until || null,
      parent_event_id: this.uuidOrNull(body.parent_event_id ?? existing?.parent_event_id),
      reminders_config: this.parseJsonObject(body.reminders_config ?? existing?.reminders_config, null),
      metadata: this.parseJsonObject(body.metadata ?? existing?.metadata, null),
    };
  }

  async createEvent(body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const input = this.normalizeEventInput(body || {});
    if (!input.title) throw new BadRequestException('title obbligatorio');
    if (!this.canViewFinance(user.role) && FINANCE_CALENDAR_EVENT_TYPES.has(input.event_type)) {
      throw new ForbiddenException('Eventi finance disponibili solo per CEO/Admin.');
    }
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".calendar_events (
         title, description, event_type, status, priority, start_at, end_at, all_day,
         timezone, location, meeting_url, color, visibility, transparency,
         owner_user_id, assigned_to_user_id, created_by, source_type, source_entity_type,
         source_entity_id, source_fingerprint, is_system_generated, is_locked,
         recurrence_rule, recurrence_until, parent_event_id, reminders_config, metadata,
         created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26,$27::jsonb,$28::jsonb,now(),now())
       RETURNING *`,
      [
        input.title, input.description, input.event_type, input.status, input.priority, input.start_at, input.end_at, input.all_day,
        input.timezone, input.location, input.meeting_url, input.color, input.visibility, input.transparency,
        input.owner_user_id || this.uuidOrNull(user.id), input.assigned_to_user_id, this.uuidOrNull(user.id), input.source_type, input.source_entity_type,
        input.source_entity_id, input.source_fingerprint, input.is_system_generated, input.is_locked,
        input.recurrence_rule, input.recurrence_until, input.parent_event_id, input.reminders_config ? JSON.stringify(input.reminders_config) : null, input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
    await this.logActivity(schema, 'event_created', { eventId: rows[0].id, actorUserId: this.uuidOrNull(user.id), metadata: { event_type: input.event_type } });
    return this.scrubEvent(rows[0], user);
  }

  async updateEvent(eventId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const existing = await this.getEvent(eventId);
    if (existing.is_locked && !this.isAdmin(user.role)) throw new ForbiddenException('Evento bloccato');
    const input = this.normalizeEventInput(body || {}, existing);
    if (!this.canViewFinance(user.role) && FINANCE_CALENDAR_EVENT_TYPES.has(input.event_type)) {
      throw new ForbiddenException('Eventi finance disponibili solo per CEO/Admin.');
    }
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".calendar_events
       SET title=$2, description=$3, event_type=$4, status=$5, priority=$6, start_at=$7, end_at=$8,
           all_day=$9, timezone=$10, location=$11, meeting_url=$12, color=$13, visibility=$14,
           transparency=$15, owner_user_id=$16, assigned_to_user_id=$17, source_type=$18,
           source_entity_type=$19, source_entity_id=$20, source_fingerprint=$21,
           is_system_generated=$22, is_locked=$23, recurrence_rule=$24, recurrence_until=$25,
           parent_event_id=$26, reminders_config=$27::jsonb, metadata=$28::jsonb, updated_at=now()
       WHERE id=$1 AND deleted_at IS NULL
       RETURNING *`,
      [
        this.requireUuid(eventId, 'eventId'), input.title, input.description, input.event_type, input.status, input.priority,
        input.start_at, input.end_at, input.all_day, input.timezone, input.location, input.meeting_url, input.color,
        input.visibility, input.transparency, input.owner_user_id, input.assigned_to_user_id, input.source_type,
        input.source_entity_type, input.source_entity_id, input.source_fingerprint, input.is_system_generated, input.is_locked,
        input.recurrence_rule, input.recurrence_until, input.parent_event_id, input.reminders_config ? JSON.stringify(input.reminders_config) : null,
        input.metadata ? JSON.stringify(input.metadata) : null,
      ],
    );
    await this.logActivity(schema, 'event_updated', { eventId, actorUserId: this.uuidOrNull(user.id) });
    return this.scrubEvent(rows[0], user);
  }

  async deleteEvent(eventId: string) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const id = this.requireUuid(eventId, 'eventId');
    await this.dataSource.query(`UPDATE "${schema}".calendar_events SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, [id]);
    await this.logActivity(schema, 'event_deleted', { eventId: id, actorUserId: this.uuidOrNull(user.id) });
    return { deleted: true };
  }

  async setEventStatus(eventId: string, status: 'completed' | 'cancelled') {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const id = this.requireUuid(eventId, 'eventId');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".calendar_events SET status = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [id, status],
    );
    if (!rows[0]) throw new NotFoundException('Evento non trovato');
    await this.logActivity(schema, status === 'completed' ? 'event_completed' : 'event_cancelled', { eventId: id, actorUserId: this.uuidOrNull(user.id) });
    return this.scrubEvent(rows[0], user);
  }

  async exportEvent(eventId: string) {
    const event = await this.getEvent(eventId);
    return {
      exportedAt: new Date().toISOString(),
      event,
      attendees: await this.listAttendees(eventId),
      reminders: await this.listReminders(eventId),
      links: await this.listLinks(eventId),
    };
  }

  async listAttendees(eventId: string) {
    await this.getEvent(eventId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".calendar_event_attendees WHERE event_id = $1 ORDER BY created_at ASC`,
      [this.requireUuid(eventId, 'eventId')],
    );
    return { items: rows };
  }

  async addAttendee(eventId: string, body: Record<string, any>) {
    const user = this.assertManage();
    await this.getEvent(eventId);
    const schema = this.getSchema();
    const role = this.normalizeEnum(body.role, CALENDAR_ATTENDEE_ROLES, 'required', 'role');
    const response = this.normalizeEnum(body.response_status, CALENDAR_RESPONSE_STATUSES, 'needs_action', 'response_status');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".calendar_event_attendees (event_id, user_id, contact_id, name, email, role, response_status, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now()) RETURNING *`,
      [this.requireUuid(eventId, 'eventId'), this.uuidOrNull(body.user_id), this.uuidOrNull(body.contact_id), this.textOrNull(body.name), this.textOrNull(body.email), role, response],
    );
    await this.logActivity(schema, 'attendee_added', { eventId, actorUserId: this.uuidOrNull(user.id), metadata: { attendee_id: rows[0].id } });
    return rows[0];
  }

  async updateAttendee(eventId: string, attendeeId: string, body: Record<string, any>) {
    const user = this.assertManage();
    await this.getEvent(eventId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".calendar_event_attendees
       SET user_id = COALESCE($3, user_id),
           contact_id = COALESCE($4, contact_id),
           name = COALESCE($5, name),
           email = COALESCE($6, email),
           role = $7,
           response_status = $8,
           updated_at = now()
       WHERE id = $1 AND event_id = $2
       RETURNING *`,
      [
        this.requireUuid(attendeeId, 'attendeeId'),
        this.requireUuid(eventId, 'eventId'),
        this.uuidOrNull(body.user_id),
        this.uuidOrNull(body.contact_id),
        this.textOrNull(body.name),
        this.textOrNull(body.email),
        this.normalizeEnum(body.role, CALENDAR_ATTENDEE_ROLES, 'required', 'role'),
        this.normalizeEnum(body.response_status, CALENDAR_RESPONSE_STATUSES, 'needs_action', 'response_status'),
      ],
    );
    if (!rows[0]) throw new NotFoundException('Partecipante non trovato');
    await this.logActivity(schema, 'attendee_updated', { eventId, actorUserId: this.uuidOrNull(user.id), metadata: { attendee_id: attendeeId } });
    return rows[0];
  }

  async deleteAttendee(eventId: string, attendeeId: string) {
    const user = this.assertManage();
    await this.getEvent(eventId);
    const schema = this.getSchema();
    await this.dataSource.query(`DELETE FROM "${schema}".calendar_event_attendees WHERE id = $1 AND event_id = $2`, [this.requireUuid(attendeeId, 'attendeeId'), this.requireUuid(eventId, 'eventId')]);
    await this.logActivity(schema, 'attendee_removed', { eventId, actorUserId: this.uuidOrNull(user.id), metadata: { attendee_id: attendeeId } });
    return { deleted: true };
  }

  async listReminders(eventId: string) {
    await this.getEvent(eventId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".calendar_event_reminders WHERE event_id = $1 ORDER BY remind_at ASC`,
      [this.requireUuid(eventId, 'eventId')],
    );
    return { items: rows };
  }

  async addReminder(eventId: string, body: Record<string, any>) {
    const user = this.assertManage();
    await this.getEvent(eventId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".calendar_event_reminders (event_id, remind_at, method, status, created_at, updated_at)
       VALUES ($1,$2,$3,'pending',now(),now()) RETURNING *`,
      [this.requireUuid(eventId, 'eventId'), this.normalizeDateTime(body.remind_at, 'remind_at'), this.normalizeEnum(body.method, CALENDAR_REMINDER_METHODS, 'in_app', 'method')],
    );
    await this.logActivity(schema, 'reminder_created', { eventId, actorUserId: this.uuidOrNull(user.id), metadata: { reminder_id: rows[0].id } });
    return rows[0];
  }

  async dismissReminder(reminderId: string) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".calendar_event_reminders SET status = 'dismissed', dismissed_at = now(), updated_at = now() WHERE id = $1 RETURNING *`,
      [this.requireUuid(reminderId, 'reminderId')],
    );
    if (!rows[0]) throw new NotFoundException('Reminder non trovato');
    await this.logActivity(schema, 'reminder_dismissed', { eventId: rows[0].event_id, actorUserId: this.uuidOrNull(user.id), metadata: { reminder_id: reminderId } });
    return rows[0];
  }

  async deleteReminder(reminderId: string) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`DELETE FROM "${schema}".calendar_event_reminders WHERE id = $1`, [this.requireUuid(reminderId, 'reminderId')]);
    await this.logActivity(schema, 'reminder_deleted', { actorUserId: this.uuidOrNull(user.id), metadata: { reminder_id: reminderId } });
    return { deleted: true };
  }

  async dueReminders() {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const visibility = this.visibilityWhere(user, 'e', 1);
    const rows = await this.dataSource.query(
      `SELECT r.*, e.title AS event_title, e.event_type, e.start_at
       FROM "${schema}".calendar_event_reminders r
       JOIN "${schema}".calendar_events e ON e.id = r.event_id
       WHERE r.status = 'pending' AND r.remind_at <= now() AND e.deleted_at IS NULL AND ${visibility.sql}
       ORDER BY r.remind_at ASC
       LIMIT 100`,
      visibility.params,
    );
    return { items: rows };
  }

  async listLinks(eventId: string) {
    await this.getEvent(eventId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".calendar_event_links WHERE event_id = $1 ORDER BY created_at ASC`,
      [this.requireUuid(eventId, 'eventId')],
    );
    return { items: rows };
  }

  async addLink(eventId: string, body: Record<string, any>) {
    const user = this.assertManage();
    await this.getEvent(eventId);
    const schema = this.getSchema();
    const entityType = String(body.entity_type || '').trim();
    if (!LINK_ENTITY_TYPES.has(entityType)) throw new BadRequestException('entity_type non consentito');
    const relation = this.normalizeEnum(body.relation_type, CALENDAR_LINK_RELATIONS, 'related', 'relation_type');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".calendar_event_links (event_id, entity_type, entity_id, relation_type, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,now())
       ON CONFLICT (event_id, entity_type, entity_id, relation_type) DO UPDATE
         SET metadata = EXCLUDED.metadata
       RETURNING *`,
      [this.requireUuid(eventId, 'eventId'), entityType, this.requireUuid(body.entity_id, 'entity_id'), relation, body.metadata ? JSON.stringify(this.parseJsonObject(body.metadata)) : null],
    );
    await this.logActivity(schema, 'event_linked', { eventId, actorUserId: this.uuidOrNull(user.id), entityType, entityId: rows[0].entity_id });
    return rows[0];
  }

  async deleteLink(eventId: string, linkId: string) {
    const user = this.assertManage();
    await this.getEvent(eventId);
    const schema = this.getSchema();
    await this.dataSource.query(`DELETE FROM "${schema}".calendar_event_links WHERE id = $1 AND event_id = $2`, [this.requireUuid(linkId, 'linkId'), this.requireUuid(eventId, 'eventId')]);
    await this.logActivity(schema, 'event_unlinked', { eventId, actorUserId: this.uuidOrNull(user.id), metadata: { link_id: linkId } });
    return { deleted: true };
  }

  async agenda(query: Record<string, any> = {}) {
    const date = this.normalizeDate(query.date, new Date().toISOString().slice(0, 10));
    const start = `${date}T00:00:00.000Z`;
    const end = `${date}T23:59:59.999Z`;
    const result = await this.listEvents({ ...query, start, end, limit: query.limit || 200, sort: 'start_at' });
    return { date, items: result.items, total: result.total };
  }

  async week(query: Record<string, any> = {}) {
    const weekStart = this.normalizeDate(query.week_start, new Date().toISOString().slice(0, 10));
    const startDate = new Date(`${weekStart}T00:00:00.000Z`);
    const endDate = new Date(startDate.getTime() + 7 * 86400000 - 1);
    return this.listEvents({ ...query, start: startDate.toISOString(), end: endDate.toISOString(), limit: query.limit || 200, sort: 'start_at' });
  }

  async timeline(query: Record<string, any> = {}) {
    return this.listEvents({ ...query, event_type: query.event_type, limit: query.limit || 200, sort: 'start_at' });
  }

  async deadlines(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const base = this.buildEventFilters(schema, user, query);
    const params = [...base.params, Array.from(DEADLINE_CALENDAR_EVENT_TYPES)];
    const rows = await this.dataSource.query(
      `SELECT e.*
       FROM "${schema}".calendar_events e
       WHERE ${base.where} AND e.event_type = ANY($${params.length}::text[])
       ORDER BY e.start_at ASC
       LIMIT 200`,
      params,
    );
    return { items: rows.map((row: any) => this.scrubEvent(row, user)), total: rows.length };
  }

  async workload(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const range = this.defaultRange(query);
    const visibility = this.visibilityWhere(user, 'e', 3);
    const rows = await this.dataSource.query(
      `SELECT
         COALESCE(e.assigned_to_user_id, e.owner_user_id, e.created_by) AS user_id,
         COUNT(*)::int AS "eventCount",
         COUNT(*) FILTER (WHERE e.priority IN ('high', 'urgent'))::int AS "highPriorityCount",
         COUNT(*) FILTER (WHERE COALESCE(e.end_at, e.start_at) < now() AND e.status IN ('scheduled', 'tentative'))::int AS "overdueCount",
         COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(e.end_at, e.start_at + interval '1 hour') - e.start_at)) / 60) FILTER (WHERE e.transparency = 'busy'), 0)::int AS "busyMinutes"
       FROM "${schema}".calendar_events e
       WHERE e.deleted_at IS NULL
         AND e.status IN ('scheduled', 'tentative')
         AND e.start_at <= $2::timestamptz
         AND COALESCE(e.end_at, e.start_at) >= $1::timestamptz
         AND ${visibility.sql}
       GROUP BY COALESCE(e.assigned_to_user_id, e.owner_user_id, e.created_by)
       ORDER BY "busyMinutes" DESC`,
      [range.start, range.end, ...visibility.params],
    );
    return { range, items: rows };
  }

  async conflicts(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const range = this.defaultRange(query);
    const visibility = this.visibilityWhere(user, 'a', 3);
    const rows = await this.dataSource.query(
      `SELECT
         a.id AS event_a_id,
         b.id AS event_b_id,
         a.title AS event_a_title,
         b.title AS event_b_title,
         COALESCE(a.assigned_to_user_id, a.owner_user_id, a.created_by) AS user_id,
         'overlap_busy_events' AS reason,
         GREATEST(a.start_at, b.start_at) AS overlap_start,
         LEAST(COALESCE(a.end_at, a.start_at + interval '1 hour'), COALESCE(b.end_at, b.start_at + interval '1 hour')) AS overlap_end
       FROM "${schema}".calendar_events a
       JOIN "${schema}".calendar_events b
         ON a.id < b.id
        AND COALESCE(a.assigned_to_user_id, a.owner_user_id, a.created_by) IS NOT DISTINCT FROM COALESCE(b.assigned_to_user_id, b.owner_user_id, b.created_by)
        AND a.transparency = 'busy'
        AND b.transparency = 'busy'
        AND a.status IN ('scheduled', 'tentative')
        AND b.status IN ('scheduled', 'tentative')
        AND a.deleted_at IS NULL
        AND b.deleted_at IS NULL
        AND a.start_at < COALESCE(b.end_at, b.start_at + interval '1 hour')
        AND b.start_at < COALESCE(a.end_at, a.start_at + interval '1 hour')
       WHERE a.start_at <= $2::timestamptz
         AND COALESCE(a.end_at, a.start_at) >= $1::timestamptz
         AND ${visibility.sql}
       ORDER BY overlap_start ASC
       LIMIT $${visibility.params.length + 3}`,
      [range.start, range.end, ...visibility.params, this.normalizeLimit(query.limit, 100)],
    );
    return { range, items: rows, total: rows.length };
  }

  async availability(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const range = this.defaultRange(query);
    const userFilter = query.user_id ? this.requireUuid(query.user_id, 'user_id') : null;
    const visibility = this.visibilityWhere(user, 'e', userFilter ? 4 : 3);
    const eventParams: unknown[] = userFilter ? [range.start, range.end, userFilter, ...visibility.params] : [range.start, range.end, ...visibility.params];
    const eventUserSql = userFilter ? `AND (e.owner_user_id = $3 OR e.assigned_to_user_id = $3 OR e.created_by = $3)` : '';
    const events = await this.dataSource.query(
      `SELECT e.id, e.title, e.event_type, e.start_at, e.end_at, e.transparency, e.owner_user_id, e.assigned_to_user_id
       FROM "${schema}".calendar_events e
       WHERE e.deleted_at IS NULL
         AND e.status <> 'cancelled'
         AND e.start_at <= $2::timestamptz
         AND COALESCE(e.end_at, e.start_at) >= $1::timestamptz
         ${eventUserSql}
         AND ${visibility.sql}
       ORDER BY e.start_at ASC`,
      eventParams,
    );
    let teamAvailability: any[] = [];
    if (await this.tableExists(schema, 'team_availability')) {
      const hasMembers = await this.tableExists(schema, 'team_members');
      const params: unknown[] = [range.start, range.end];
      let where = `ta.deleted_at IS NULL AND ta.status <> 'cancelled' AND ta.starts_at <= $2::timestamptz AND ta.ends_at >= $1::timestamptz`;
      if (userFilter && hasMembers) {
        params.push(userFilter);
        where += ` AND tm.user_id = $3`;
      }
      teamAvailability = await this.dataSource.query(
        `SELECT ta.*, ${hasMembers ? 'tm.user_id, tm.display_name' : 'NULL AS user_id, NULL AS display_name'}
         FROM "${schema}".team_availability ta
         ${hasMembers ? `LEFT JOIN "${schema}".team_members tm ON tm.id = ta.team_member_id` : ''}
         WHERE ${where}
         ORDER BY ta.starts_at ASC`,
        params,
      );
    }
    return { range, events, teamAvailability };
  }

  async listViews(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const params: unknown[] = [];
    const where = ['deleted_at IS NULL'];
    if (query.view_type) {
      params.push(this.normalizeEnum(query.view_type, PLANNING_VIEW_TYPES, 'calendar', 'view_type'));
      where.push(`view_type = $${params.length}`);
    }
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".planning_views WHERE ${where.join(' AND ')} ORDER BY is_default DESC, name ASC`,
      params,
    );
    return { items: rows };
  }

  async getView(viewId: string) {
    this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(`SELECT * FROM "${schema}".planning_views WHERE id = $1 AND deleted_at IS NULL LIMIT 1`, [this.requireUuid(viewId, 'viewId')]);
    if (!rows[0]) throw new NotFoundException('Vista non trovata');
    return rows[0];
  }

  async createView(body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".planning_views (name, description, view_type, filters, layout_config, is_default, is_system, is_shared, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6,false,$7,$8,now(),now()) RETURNING *`,
      [
        String(body.name || '').trim(),
        this.textOrNull(body.description),
        this.normalizeEnum(body.view_type, PLANNING_VIEW_TYPES, 'calendar', 'view_type'),
        body.filters ? JSON.stringify(this.parseJsonObject(body.filters)) : null,
        body.layout_config ? JSON.stringify(this.parseJsonObject(body.layout_config)) : null,
        this.parseBool(body.is_default),
        body.is_shared === undefined ? true : this.parseBool(body.is_shared),
        this.uuidOrNull(user.id),
      ],
    );
    await this.logActivity(schema, 'view_created', { viewId: rows[0].id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async updateView(viewId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const existing = await this.getView(viewId);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".planning_views
       SET name=$2, description=$3, view_type=$4, filters=$5::jsonb, layout_config=$6::jsonb,
           is_default=$7, is_shared=$8, updated_at=now()
       WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
      [
        this.requireUuid(viewId, 'viewId'),
        String(body.name ?? existing.name).trim(),
        this.textOrNull(body.description ?? existing.description),
        this.normalizeEnum(body.view_type ?? existing.view_type, PLANNING_VIEW_TYPES, 'calendar', 'view_type'),
        body.filters !== undefined ? JSON.stringify(this.parseJsonObject(body.filters)) : JSON.stringify(existing.filters || {}),
        body.layout_config !== undefined ? JSON.stringify(this.parseJsonObject(body.layout_config)) : JSON.stringify(existing.layout_config || {}),
        body.is_default !== undefined ? this.parseBool(body.is_default) : Boolean(existing.is_default),
        body.is_shared !== undefined ? this.parseBool(body.is_shared) : Boolean(existing.is_shared),
      ],
    );
    await this.logActivity(schema, 'view_updated', { viewId, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async deleteView(viewId: string) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".planning_views SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, [this.requireUuid(viewId, 'viewId')]);
    await this.logActivity(schema, 'view_deleted', { viewId, actorUserId: this.uuidOrNull(user.id) });
    return { deleted: true };
  }

  async activity(query: Record<string, any> = {}) {
    this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit, 100);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".planning_activity ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, this.normalizeOffset(query.offset)],
    );
    return { items: rows, limit, offset: this.normalizeOffset(query.offset) };
  }

  async seedViews() {
    const user = this.assertManage();
    const schema = this.getSchema();
    await seedTenantPlanningViews(this.dataSource, schema, this.uuidOrNull(user.id));
    return this.listViews({});
  }

  private async selectDerived(schema: string, source: { table: string; entity: string; eventType: string; titleColumn: string; dateColumn: string; statusExclude?: string[]; assignedColumn?: string; ownerColumn?: string; description?: string; priorityColumn?: string; extraWhere?: string; }) {
    try {
      if (!(await this.tableExists(schema, source.table))) return [];
      for (const column of ['id', source.titleColumn, source.dateColumn]) {
        if (!(await this.columnExists(schema, source.table, column))) return [];
      }
      const deleted = (await this.columnExists(schema, source.table, 'deleted_at')) ? 'deleted_at IS NULL' : 'TRUE';
      const status = (await this.columnExists(schema, source.table, 'status')) && source.statusExclude?.length
        ? `AND LOWER(COALESCE(status, '')) <> ALL($1::text[])`
        : '';
      const params = status ? [source.statusExclude!.map((s) => s.toLowerCase())] : [];
      const assignedSql = source.assignedColumn && await this.columnExists(schema, source.table, source.assignedColumn) ? source.assignedColumn : null;
      const ownerSql = source.ownerColumn && await this.columnExists(schema, source.table, source.ownerColumn) ? source.ownerColumn : null;
      const prioritySql = source.priorityColumn && await this.columnExists(schema, source.table, source.priorityColumn) ? source.priorityColumn : null;
      return await this.dataSource.query(
        `SELECT id,
                COALESCE(${source.titleColumn}::text, '${source.eventType}') AS title,
                ${source.dateColumn} AS date_value,
                ${assignedSql ? `${assignedSql}` : 'NULL'} AS assigned_to_user_id,
                ${ownerSql ? `${ownerSql}` : 'NULL'} AS owner_user_id,
                ${prioritySql ? `${prioritySql}` : 'NULL'} AS priority
         FROM "${schema}"."${source.table}"
         WHERE ${deleted}
           AND ${source.dateColumn} IS NOT NULL
           ${status}
           ${source.extraWhere || ''}
         ORDER BY ${source.dateColumn} ASC
         LIMIT 200`,
        params,
      ).then((rows: any[]) => rows.map((row) => ({
        title: row.title,
        description: source.description || null,
        event_type: source.eventType,
        start_at: new Date(row.date_value).toISOString(),
        all_day: String(row.date_value).length <= 10,
        priority: CALENDAR_PRIORITIES.includes(row.priority) ? row.priority : 'medium',
        owner_user_id: this.uuidOrNull(row.owner_user_id),
        assigned_to_user_id: this.uuidOrNull(row.assigned_to_user_id),
        source_entity_type: source.entity,
        source_entity_id: row.id,
        source_fingerprint: `${source.entity}:${row.id}:${source.eventType}`,
        source_type: 'derived',
        is_system_generated: true,
        visibility: FINANCE_CALENDAR_EVENT_TYPES.has(source.eventType) ? 'admin' : 'team',
        metadata: { derived_from: source.table },
      })));
    } catch (err) {
      this.logger.warn(`Sync derived skip ${source.table}.${source.dateColumn}: ${err instanceof Error ? err.message : err}`);
      return [];
    }
  }

  private async collectDerivedMatches(schema: string): Promise<EventMatch[]> {
    const sources = [
      { table: 'commercial_activities', entity: 'commercial_activity', eventType: 'commercial_activity_due', titleColumn: 'title', dateColumn: 'due_at', statusExclude: ['done', 'completed', 'cancelled'], assignedColumn: 'assigned_to' },
      { table: 'quotes', entity: 'quote', eventType: 'quote_followup', titleColumn: 'title', dateColumn: 'updated_at', statusExclude: ['accepted', 'rejected', 'cancelled'], extraWhere: `AND LOWER(COALESCE(status, '')) = 'sent' AND updated_at <= now() - interval '7 days'` },
      { table: 'tasks', entity: 'task', eventType: 'task_due', titleColumn: 'title', dateColumn: 'due_at', statusExclude: ['done', 'completed', 'cancelled'], assignedColumn: 'assignee_id' },
      { table: 'milestones', entity: 'milestone', eventType: 'milestone_due', titleColumn: 'title', dateColumn: 'due_date', statusExclude: ['completed', 'skipped', 'cancelled'] },
      { table: 'projects', entity: 'project', eventType: 'project_deadline', titleColumn: 'name', dateColumn: 'due_date', statusExclude: ['closed', 'delivered', 'cancelled'], ownerColumn: 'project_manager_id', priorityColumn: 'priority' },
      { table: 'invoices', entity: 'invoice', eventType: 'invoice_due', titleColumn: 'title', dateColumn: 'due_date', statusExclude: ['paid', 'cancelled', 'void'] },
      { table: 'financial_deadlines', entity: 'deadline', eventType: 'financial_deadline', titleColumn: 'title', dateColumn: 'due_date', statusExclude: ['completed', 'cancelled'] },
      { table: 'renewals', entity: 'renewal', eventType: 'renewal_due', titleColumn: 'title', dateColumn: 'due_date', statusExclude: ['completed', 'cancelled'] },
      { table: 'recurring_services', entity: 'recurring_service', eventType: 'recurring_service_due', titleColumn: 'name', dateColumn: 'next_due_date', statusExclude: ['inactive', 'cancelled', 'ended'] },
      { table: 'contracts', entity: 'contract', eventType: 'contract_due', titleColumn: 'title', dateColumn: 'due_date', statusExclude: ['signed', 'active', 'cancelled', 'archived'], ownerColumn: 'owner_user_id', assignedColumn: 'assigned_to_user_id', priorityColumn: 'priority' },
      { table: 'contracts', entity: 'contract', eventType: 'contract_expiration', titleColumn: 'title', dateColumn: 'end_date', statusExclude: ['cancelled', 'archived'], ownerColumn: 'owner_user_id', assignedColumn: 'assigned_to_user_id', priorityColumn: 'priority' },
      { table: 'paperwork_dossiers', entity: 'paperwork_dossier', eventType: 'paperwork_due', titleColumn: 'title', dateColumn: 'due_date', statusExclude: ['completed', 'archived'], ownerColumn: 'owner_user_id', assignedColumn: 'assigned_to_user_id', priorityColumn: 'priority' },
      { table: 'paperwork_items', entity: 'paperwork_item', eventType: 'paperwork_item_due', titleColumn: 'title', dateColumn: 'due_date', statusExclude: ['approved', 'not_applicable'], assignedColumn: 'assigned_to_user_id' },
      { table: 'briefings', entity: 'briefing', eventType: 'briefing_due', titleColumn: 'title', dateColumn: 'deadline', statusExclude: ['completed', 'cancelled'] },
    ];
    const chunks = await Promise.all(sources.map((source) => this.selectDerived(schema, source)));
    const derived = chunks.flat() as EventMatch[];
    if (await this.tableExists(schema, 'team_availability')) {
      try {
        const rows = await this.dataSource.query(
          `SELECT ta.id, ta.title, ta.type, ta.starts_at, ta.ends_at, tm.user_id
           FROM "${schema}".team_availability ta
           LEFT JOIN "${schema}".team_members tm ON tm.id = ta.team_member_id
           WHERE ta.deleted_at IS NULL AND ta.status <> 'cancelled'
           ORDER BY ta.starts_at ASC
           LIMIT 200`,
        );
        derived.push(...rows.map((row: any) => ({
          title: row.title || row.type || 'Indisponibilità',
          event_type: 'unavailable',
          start_at: new Date(row.starts_at).toISOString(),
          end_at: row.ends_at ? new Date(row.ends_at).toISOString() : null,
          source_entity_type: 'team_availability',
          source_entity_id: row.id,
          source_fingerprint: `team_availability:${row.id}:unavailable`,
          assigned_to_user_id: this.uuidOrNull(row.user_id),
          transparency: 'busy',
          visibility: 'team',
          metadata: { type: row.type },
        } as EventMatch)));
      } catch (err) {
        this.logger.warn(`Sync derived skip team_availability: ${err instanceof Error ? err.message : err}`);
      }
    }
    return derived;
  }

  async derivedPreview() {
    this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const matches = await this.collectDerivedMatches(schema);
    return { total: matches.length, items: matches.slice(0, 200) };
  }

  async syncDerived(body: Record<string, any> = {}) {
    const user = this.assertSync();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(body.limit, 200);
    const matches = (await this.collectDerivedMatches(schema)).slice(0, limit);
    let created = 0;
    let updated = 0;
    let skippedLocked = 0;
    for (const match of matches) {
      const existing = await this.dataSource.query(
        `SELECT id, is_locked FROM "${schema}".calendar_events WHERE source_fingerprint = $1 AND deleted_at IS NULL LIMIT 1`,
        [match.source_fingerprint],
      );
      if (existing[0]?.is_locked) {
        skippedLocked += 1;
        continue;
      }
      if (existing[0]) {
        await this.dataSource.query(
          `UPDATE "${schema}".calendar_events
           SET title=$2, description=$3, event_type=$4, start_at=$5, end_at=$6, all_day=$7,
               priority=$8, owner_user_id=$9, assigned_to_user_id=$10, source_entity_type=$11,
               source_entity_id=$12, visibility=$13, transparency=$14, metadata=$15::jsonb, updated_at=now()
           WHERE id=$1`,
          [
            existing[0].id, match.title, match.description || null, match.event_type, match.start_at, match.end_at || null,
            Boolean(match.all_day), match.priority || 'medium', match.owner_user_id || null, match.assigned_to_user_id || null,
            match.source_entity_type, match.source_entity_id, match.visibility || 'team', match.transparency || 'busy',
            match.metadata ? JSON.stringify(match.metadata) : null,
          ],
        );
        updated += 1;
      } else {
        await this.dataSource.query(
          `INSERT INTO "${schema}".calendar_events (
             title, description, event_type, status, priority, start_at, end_at, all_day,
             timezone, visibility, transparency, owner_user_id, assigned_to_user_id, created_by,
             source_type, source_entity_type, source_entity_id, source_fingerprint,
             is_system_generated, is_locked, metadata, created_at, updated_at
           )
           VALUES ($1,$2,$3,'scheduled',$4,$5,$6,$7,'Europe/Rome',$8,$9,$10,$11,$12,'derived',$13,$14,$15,true,false,$16::jsonb,now(),now())`,
          [
            match.title, match.description || null, match.event_type, match.priority || 'medium', match.start_at, match.end_at || null,
            Boolean(match.all_day), match.visibility || 'team', match.transparency || 'busy', match.owner_user_id || null,
            match.assigned_to_user_id || null, this.uuidOrNull(user.id), match.source_entity_type, match.source_entity_id,
            match.source_fingerprint, match.metadata ? JSON.stringify(match.metadata) : null,
          ],
        );
        created += 1;
      }
    }
    await this.logActivity(schema, 'derived_events_synced', { actorUserId: this.uuidOrNull(user.id), metadata: { matched: matches.length, created, updated, skippedLocked } });
    return { matched: matches.length, created, updated, skippedLocked };
  }

  async processDueReminders(schema?: string) {
    const s = schema ? safeSchema(schema, 'TenantCalendarService.processDueReminders') : this.getSchema();
    await this.ensureSchema(s);
    const rows = await this.dataSource.query(
      `SELECT r.id, r.event_id, e.title, e.event_type, e.assigned_to_user_id, e.owner_user_id
       FROM "${s}".calendar_event_reminders r
       JOIN "${s}".calendar_events e ON e.id = r.event_id
       WHERE r.status = 'pending' AND r.remind_at <= now() AND e.deleted_at IS NULL
       LIMIT 100`,
    );
    let sent = 0;
    for (const row of rows) {
      try {
        await this.notifications.createNotification(s, {
          recipient_user_id: row.assigned_to_user_id || row.owner_user_id || null,
          recipient_role: row.assigned_to_user_id || row.owner_user_id ? null : 'manager',
          title: `Reminder: ${row.title}`,
          body: 'Promemoria calendario interno.',
          type: 'system',
          priority: 'medium',
          entity_type: 'project',
          entity_id: null,
          link_url: '/calendar',
          fingerprint: `calendar_reminder:${row.id}`,
          metadata: { event_id: row.event_id, event_type: row.event_type },
        });
        await this.dataSource.query(`UPDATE "${s}".calendar_event_reminders SET status = 'sent', sent_at = now(), updated_at = now() WHERE id = $1`, [row.id]);
        await this.logActivity(s, 'reminder_sent', { eventId: row.event_id, metadata: { reminder_id: row.id } });
        sent += 1;
      } catch (err) {
        await this.dataSource.query(`UPDATE "${s}".calendar_event_reminders SET status = 'failed', error_message = $2, updated_at = now() WHERE id = $1`, [row.id, err instanceof Error ? err.message : String(err)]);
      }
    }
    return { processed: rows.length, sent };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async hourlyReminderCron() {
    try {
      const tenants = await this.dataSource.query(`SELECT schema_name FROM public.tenants WHERE is_active = true AND schema_name IS NOT NULL LIMIT 100`);
      for (const tenant of tenants) {
        await this.processDueReminders(String(tenant.schema_name));
      }
    } catch (err) {
      this.logger.warn(`Reminder cron skipped: ${err instanceof Error ? err.message : err}`);
    }
  }

  async exportCalendar(query: Record<string, any> = {}) {
    const events = await this.listEvents({ ...query, limit: query.limit || 200 });
    return { exportedAt: new Date().toISOString(), events };
  }
}
