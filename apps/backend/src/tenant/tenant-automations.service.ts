import { BadRequestException, ForbiddenException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import { ensureTenantAutomationsTables, seedTenantAutomationTemplatesAndRules } from './tenant-automations-schema';
import {
  AUTOMATION_ACTION_TYPES,
  AUTOMATION_CATEGORIES,
  AUTOMATION_CONDITION_TYPES,
  AUTOMATION_PRIORITIES,
  AUTOMATION_RUN_MODES,
  AUTOMATION_RUN_STATUSES,
  AUTOMATION_SCHEDULE_FREQUENCIES,
  AUTOMATION_TRIGGER_TYPES,
  FINANCE_AUTOMATION_ACTIONS,
  FINANCE_AUTOMATION_TRIGGERS,
} from './tenant-automations.types';
import { TenantNotificationsService } from './tenant-notifications.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin']);
const READ_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin', 'manager', 'editor', 'user', 'viewer']);
const SORT_COLUMNS = ['created_at', 'updated_at', 'last_run_at', 'next_run_at', 'name', 'category', 'trigger_type', 'priority'];
const FINANCE_ENTITY_TYPES = new Set(['invoice', 'payment', 'deadline', 'renewal', 'recurring_service', 'financial_deadline']);

type AuthUser = { id: string; email?: string; role: string };
type Match = {
  entity_type: string;
  entity_id: string | null;
  title: string;
  due_date?: string | null;
  assigned_to_user_id?: string | null;
  owner_user_id?: string | null;
  company_id?: string | null;
  project_id?: string | null;
  contract_id?: string | null;
  quote_id?: string | null;
  metadata?: Record<string, unknown>;
};
type RunContext = {
  actorUserId?: string | null;
  triggerSource?: string;
  payload?: Record<string, unknown>;
  force?: boolean;
};

@Injectable()
export class TenantAutomationsService {
  private readonly logger = new Logger(TenantAutomationsService.name);

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
    const schema = safeSchema(tenantRef || 'public', 'TenantAutomationsService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Automazioni tenant non disponibili nel contesto public');
    return schema;
  }

  private isAdmin(role: string): boolean {
    return ADMIN_ROLES.has(String(role || '').toLowerCase());
  }

  private canRead(role: string): boolean {
    return READ_ROLES.has(String(role || '').toLowerCase());
  }

  private canManage(role: string): boolean {
    return this.isAdmin(role);
  }

  private canRun(role: string): boolean {
    return this.isAdmin(role) || hasRoleAtLeast(role, 'manager');
  }

  private canViewFinance(role: string): boolean {
    return this.isAdmin(role);
  }

  private assertRead(user = this.getUser()) {
    if (!this.canRead(user.role)) throw new ForbiddenException('Non hai accesso alle automazioni interne.');
    return user;
  }

  private assertManage(user = this.getUser()) {
    if (!this.canManage(user.role)) throw new ForbiddenException('Solo CEO/Admin possono gestire automazioni.');
    return user;
  }

  private assertRun(user = this.getUser()) {
    if (!this.canRun(user.role)) throw new ForbiddenException('Non hai permessi per eseguire automazioni.');
    return user;
  }

  private async ensureSchema(schema: string) {
    await ensureTenantAutomationsTables(this.dataSource, schema);
  }

  private safeTableName(value: string): string {
    const text = String(value || '').trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) throw new BadRequestException('Nome tabella non valido');
    return text;
  }

  private async tableExists(schema: string, table: string): Promise<boolean> {
    const s = safeSchema(schema, 'TenantAutomationsService.tableExists');
    const t = this.safeTableName(table);
    const rows = await this.dataSource.query(`SELECT to_regclass($1) AS exists`, [`"${s}"."${t}"`]);
    return Boolean(rows[0]?.exists);
  }

  private uuidOrNull(value: unknown): string | null {
    const text = String(value || '');
    return UUID_RE.test(text) ? text : null;
  }

  private requireUuid(value: unknown, label = 'ID'): string {
    const text = String(value || '');
    if (!UUID_RE.test(text)) throw new BadRequestException(`${label} non valido`);
    return text;
  }

  private textOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
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

  private normalizeSort(value: unknown): string {
    const sort = String(value || 'created_at').trim();
    return SORT_COLUMNS.includes(sort) ? sort : 'created_at';
  }

  private normalizeEnum(value: unknown, allowed: readonly string[], fallback: string, label: string): string {
    const text = String(value || fallback).trim();
    if (!allowed.includes(text)) throw new BadRequestException(`${label} non valido`);
    return text;
  }

  private parseJson(value: unknown, fallback: unknown): unknown {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch {
      throw new BadRequestException('JSON non valido');
    }
  }

  private normalizeConditions(value: unknown): unknown {
    const parsed = this.parseJson(value, null);
    const list = Array.isArray(parsed) ? parsed : parsed && typeof parsed === 'object' ? [parsed as Record<string, unknown>] : [];
    for (const condition of list as Array<Record<string, unknown>>) {
      const type = String(condition.type || Object.keys(condition)[0] || '').trim();
      if (type && !AUTOMATION_CONDITION_TYPES.includes(type as any) && !['older_than_days', 'due_within_days', 'no_activity_for_days', 'missing_required_items_count_gt'].includes(type)) {
        throw new BadRequestException(`Condizione non consentita: ${type}`);
      }
    }
    return parsed;
  }

  private normalizeActions(value: unknown): Array<Record<string, unknown>> {
    const parsed = this.parseJson(value, []);
    if (!Array.isArray(parsed)) throw new BadRequestException('actions deve essere un array');
    for (const action of parsed) {
      if (!action || typeof action !== 'object') throw new BadRequestException('azione non valida');
      const type = String((action as any).type || (action as any).action_type || '').trim();
      if (!AUTOMATION_ACTION_TYPES.includes(type as any)) throw new BadRequestException(`Azione non consentita: ${type}`);
    }
    return parsed as Array<Record<string, unknown>>;
  }

  private normalizeSchedule(value: unknown): Record<string, unknown> | null {
    const parsed = this.parseJson(value, null) as Record<string, unknown> | null;
    if (!parsed) return null;
    const frequency = String(parsed.frequency || 'daily');
    if (!AUTOMATION_SCHEDULE_FREQUENCIES.includes(frequency as any)) throw new BadRequestException('frequency non valida');
    if (parsed.hour !== undefined) {
      const hour = Number(parsed.hour);
      if (!Number.isInteger(hour) || hour < 0 || hour > 23) throw new BadRequestException('hour non valida');
    }
    if (parsed.day_of_week !== undefined) {
      const day = Number(parsed.day_of_week);
      if (!Number.isInteger(day) || day < 0 || day > 6) throw new BadRequestException('day_of_week non valido');
    }
    return parsed;
  }

  private normalizePositiveInt(value: unknown, fallback: number, min: number, max: number, label: string): number {
    const n = Number(value ?? fallback);
    if (!Number.isFinite(n)) return fallback;
    const clean = Math.trunc(n);
    if (clean < min || clean > max) throw new BadRequestException(`${label} non valido`);
    return clean;
  }

  private isFinanceRule(rule: Record<string, any>): boolean {
    const category = String(rule.category || '').toLowerCase();
    const trigger = String(rule.trigger_type || '').toLowerCase();
    const actions = Array.isArray(rule.actions) ? rule.actions : [];
    return category === 'finance'
      || FINANCE_AUTOMATION_TRIGGERS.has(trigger)
      || actions.some((a: any) => FINANCE_AUTOMATION_ACTIONS.has(String(a?.type || a?.action_type || '')));
  }

  private sanitizeRule(row: Record<string, any>, user: AuthUser) {
    if (this.canViewFinance(user.role) || !this.isFinanceRule(row)) return row;
    return null;
  }

  private financeWhere(user: AuthUser, alias = '') {
    if (this.canViewFinance(user.role)) return { sql: 'TRUE', params: [] as unknown[] };
    const prefix = alias ? `${alias}.` : '';
    return {
      sql: `${prefix}category <> 'finance' AND ${prefix}trigger_type <> ALL($1::text[])`,
      params: [Array.from(FINANCE_AUTOMATION_TRIGGERS)],
    };
  }

  private qualifyRuleWhere(sql: string, alias: string): string {
    return sql.split('category').join(`${alias}.category`).split('trigger_type').join(`${alias}.trigger_type`);
  }

  private getConditionNumber(conditions: unknown, key: string, fallback: number): number {
    if (!conditions) return fallback;
    const list = Array.isArray(conditions) ? conditions : [conditions];
    for (const item of list as Array<Record<string, unknown>>) {
      if (item[key] !== undefined) {
        const n = Number(item[key]);
        return Number.isFinite(n) ? n : fallback;
      }
      if (item.type === key && item.value !== undefined) {
        const n = Number(item.value);
        return Number.isFinite(n) ? n : fallback;
      }
    }
    return fallback;
  }

  async summary() {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const visibility = this.financeWhere(user);
    const params = visibility.params;
    const [rules, runs, actions, due] = await Promise.all([
      this.dataSource.query(
        `SELECT
           COUNT(*)::int AS "totalRules",
           COUNT(*) FILTER (WHERE is_enabled = true)::int AS "enabledRules"
         FROM "${schema}".automation_rules
         WHERE deleted_at IS NULL AND ${visibility.sql}`,
        params,
      ),
      this.dataSource.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'failed')::int AS "failedRunsToday",
           COUNT(*) FILTER (WHERE status IN ('success', 'partial_success'))::int AS "successfulRunsToday",
           MAX(started_at) AS "lastRunAt"
         FROM "${schema}".automation_runs r
         LEFT JOIN "${schema}".automation_rules ar ON ar.id = r.rule_id
         WHERE r.started_at >= CURRENT_DATE AND (ar.id IS NULL OR (${this.qualifyRuleWhere(visibility.sql, 'ar')}))`,
        params,
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS "actionsToday"
         FROM "${schema}".automation_action_logs a
         LEFT JOIN "${schema}".automation_rules ar ON ar.id = a.rule_id
         WHERE a.created_at >= CURRENT_DATE AND (ar.id IS NULL OR (${this.qualifyRuleWhere(visibility.sql, 'ar')}))`,
        params,
      ),
      this.dataSource.query(
        `SELECT COUNT(*)::int AS "dueRules"
         FROM "${schema}".automation_rules
         WHERE deleted_at IS NULL AND is_enabled = true
           AND run_mode IN ('scheduled', 'hybrid')
           AND (next_run_at IS NULL OR next_run_at <= now())
           AND ${visibility.sql}`,
        params,
      ),
    ]);
    const failedRunsToday = Number(runs[0]?.failedRunsToday || 0);
    return {
      totalRules: Number(rules[0]?.totalRules || 0),
      enabledRules: Number(rules[0]?.enabledRules || 0),
      failedRunsToday,
      successfulRunsToday: Number(runs[0]?.successfulRunsToday || 0),
      actionsToday: Number(actions[0]?.actionsToday || 0),
      lastRunAt: runs[0]?.lastRunAt || null,
      dueRules: Number(due[0]?.dueRules || 0),
      automationRisksCount: failedRunsToday,
      sources: { automation_rules: true, automation_runs: true, automation_action_logs: true },
    };
  }

  async options() {
    this.assertRead();
    return {
      triggers: AUTOMATION_TRIGGER_TYPES,
      conditions: AUTOMATION_CONDITION_TYPES,
      actions: AUTOMATION_ACTION_TYPES,
      categories: AUTOMATION_CATEGORIES,
      runModes: AUTOMATION_RUN_MODES,
      runStatuses: AUTOMATION_RUN_STATUSES,
      priorities: AUTOMATION_PRIORITIES,
      scheduleFrequencies: AUTOMATION_SCHEDULE_FREQUENCIES,
    };
  }

  async seedBaseTemplates() {
    const user = this.assertManage();
    const schema = this.getSchema();
    await seedTenantAutomationTemplatesAndRules(this.dataSource, schema, this.uuidOrNull(user.id));
    await this.logActivity(schema, 'template_seeded', null, null, user.id, { source: 'api' });
    return { success: true, templatesSeeded: true, rulesSeeded: true };
  }

  async listTemplates(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const where: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    if (!this.canViewFinance(user.role)) where.push(`category <> 'finance' AND trigger_type <> ALL($${params.length + 1}::text[])`) && params.push(Array.from(FINANCE_AUTOMATION_TRIGGERS));
    if (query.category) where.push(`category = $${params.length + 1}`) && params.push(String(query.category));
    if (query.trigger_type) where.push(`trigger_type = $${params.length + 1}`) && params.push(String(query.trigger_type));
    if (query.search) {
      where.push(`(name ILIKE $${params.length + 1} OR key ILIKE $${params.length + 1})`);
      params.push(`%${String(query.search).trim()}%`);
    }
    const rows = await this.dataSource.query(
      `SELECT id, key, name, description, category, trigger_type, default_conditions, default_actions, default_schedule, is_active, is_system, created_at, updated_at
       FROM "${schema}".automation_templates
       WHERE ${where.join(' AND ')}
       ORDER BY category ASC, name ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const totalRows = await this.dataSource.query(`SELECT COUNT(*)::int AS total FROM "${schema}".automation_templates WHERE ${where.join(' AND ')}`, params);
    return { items: rows, total: Number(totalRows[0]?.total || 0), limit, offset };
  }

  async getTemplate(id: string) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT id, key, name, description, category, trigger_type, default_conditions, default_actions, default_schedule, is_active, is_system, created_at, updated_at
       FROM "${schema}".automation_templates WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [this.requireUuid(id)],
    );
    if (!rows[0]) throw new NotFoundException('Template automazione non trovato');
    if (!this.canViewFinance(user.role) && this.isFinanceRule(rows[0])) throw new ForbiddenException('Template finance riservato a CEO/Admin.');
    return rows[0];
  }

  async listRules(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sort = this.normalizeSort(query.sort);
    const direction = String(query.direction || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const where: string[] = ['deleted_at IS NULL'];
    const params: unknown[] = [];
    if (!this.canViewFinance(user.role)) where.push(`category <> 'finance' AND trigger_type <> ALL($${params.length + 1}::text[])`) && params.push(Array.from(FINANCE_AUTOMATION_TRIGGERS));
    for (const key of ['category', 'trigger_type', 'run_mode', 'priority']) {
      if (query[key]) {
        where.push(`${key} = $${params.length + 1}`);
        params.push(String(query[key]));
      }
    }
    if (query.is_enabled !== undefined) {
      where.push(`is_enabled = $${params.length + 1}`);
      params.push(String(query.is_enabled) === 'true');
    }
    if (query.search) {
      where.push(`(name ILIKE $${params.length + 1} OR description ILIKE $${params.length + 1})`);
      params.push(`%${String(query.search).trim()}%`);
    }
    const rows = await this.dataSource.query(
      `SELECT id, template_id, name, description, category, trigger_type, trigger_config, conditions, actions, schedule_config,
              is_enabled, run_mode, priority, cooldown_minutes, max_runs_per_day, last_run_at, next_run_at,
              last_success_at, last_error_at, last_error_message, created_by, updated_by, created_at, updated_at
       FROM "${schema}".automation_rules
       WHERE ${where.join(' AND ')}
       ORDER BY ${sort} ${direction}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const totalRows = await this.dataSource.query(`SELECT COUNT(*)::int AS total FROM "${schema}".automation_rules WHERE ${where.join(' AND ')}`, params);
    return { items: rows, total: Number(totalRows[0]?.total || 0), limit, offset };
  }

  async getRule(id: string) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rule = await this.getRuleInternal(schema, id);
    const sanitized = this.sanitizeRule(rule, user);
    if (!sanitized) throw new ForbiddenException('Regola finance riservata a CEO/Admin.');
    return sanitized;
  }

  private async getRuleInternal(schema: string, id: string) {
    const rows = await this.dataSource.query(
      `SELECT id, template_id, name, description, category, trigger_type, trigger_config, conditions, actions, schedule_config,
              is_enabled, run_mode, priority, cooldown_minutes, max_runs_per_day, last_run_at, next_run_at,
              last_success_at, last_error_at, last_error_message, created_by, updated_by, created_at, updated_at
       FROM "${schema}".automation_rules
       WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [this.requireUuid(id)],
    );
    if (!rows[0]) throw new NotFoundException('Regola automazione non trovata');
    return rows[0];
  }

  async createRule(body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const triggerType = this.normalizeEnum(body.trigger_type, AUTOMATION_TRIGGER_TYPES, 'manual_run', 'trigger_type');
    const category = this.normalizeEnum(body.category, AUTOMATION_CATEGORIES, 'general', 'category');
    const actions = this.normalizeActions(body.actions);
    if (!this.canViewFinance(user.role) && (category === 'finance' || FINANCE_AUTOMATION_TRIGGERS.has(triggerType) || actions.some((a) => FINANCE_AUTOMATION_ACTIONS.has(String(a.type))))) {
      throw new ForbiddenException('Automazioni finance riservate a CEO/Admin.');
    }
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".automation_rules (
        template_id, name, description, category, trigger_type, trigger_config, conditions,
        actions, schedule_config, is_enabled, run_mode, priority, cooldown_minutes,
        max_runs_per_day, created_by, updated_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10, $11, $12, $13, $14, $15, $15, now(), now())
      RETURNING *`,
      [
        this.uuidOrNull(body.template_id),
        this.textOrNull(body.name) || (() => { throw new BadRequestException('name obbligatorio'); })(),
        this.textOrNull(body.description),
        category,
        triggerType,
        JSON.stringify(this.parseJson(body.trigger_config, {})),
        JSON.stringify(this.normalizeConditions(body.conditions)),
        JSON.stringify(actions),
        JSON.stringify(this.normalizeSchedule(body.schedule_config)),
        Boolean(body.is_enabled),
        this.normalizeEnum(body.run_mode, AUTOMATION_RUN_MODES, 'manual', 'run_mode'),
        this.normalizeEnum(body.priority, AUTOMATION_PRIORITIES, 'medium', 'priority'),
        this.normalizePositiveInt(body.cooldown_minutes, 60, 0, 10080, 'cooldown_minutes'),
        this.normalizePositiveInt(body.max_runs_per_day, 50, 1, 500, 'max_runs_per_day'),
        this.uuidOrNull(user.id),
      ],
    );
    await this.logActivity(schema, 'rule_created', rows[0].id, rows[0].template_id, user.id, { name: rows[0].name });
    return rows[0];
  }

  async updateRule(id: string, body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const current = await this.getRuleInternal(schema, id);
    const category = body.category === undefined ? current.category : this.normalizeEnum(body.category, AUTOMATION_CATEGORIES, current.category, 'category');
    const triggerType = body.trigger_type === undefined ? current.trigger_type : this.normalizeEnum(body.trigger_type, AUTOMATION_TRIGGER_TYPES, current.trigger_type, 'trigger_type');
    const actions = body.actions === undefined ? current.actions : this.normalizeActions(body.actions);
    if (!this.canViewFinance(user.role) && this.isFinanceRule({ ...current, category, trigger_type: triggerType, actions })) {
      throw new ForbiddenException('Automazioni finance riservate a CEO/Admin.');
    }
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".automation_rules
       SET name = COALESCE($2, name),
           description = COALESCE($3, description),
           category = $4,
           trigger_type = $5,
           trigger_config = COALESCE($6::jsonb, trigger_config),
           conditions = COALESCE($7::jsonb, conditions),
           actions = $8::jsonb,
           schedule_config = COALESCE($9::jsonb, schedule_config),
           run_mode = COALESCE($10, run_mode),
           priority = COALESCE($11, priority),
           cooldown_minutes = COALESCE($12, cooldown_minutes),
           max_runs_per_day = COALESCE($13, max_runs_per_day),
           updated_by = $14,
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [
        this.requireUuid(id),
        body.name === undefined ? null : this.textOrNull(body.name),
        body.description === undefined ? null : this.textOrNull(body.description),
        category,
        triggerType,
        body.trigger_config === undefined ? null : JSON.stringify(this.parseJson(body.trigger_config, {})),
        body.conditions === undefined ? null : JSON.stringify(this.normalizeConditions(body.conditions)),
        JSON.stringify(actions),
        body.schedule_config === undefined ? null : JSON.stringify(this.normalizeSchedule(body.schedule_config)),
        body.run_mode === undefined ? null : this.normalizeEnum(body.run_mode, AUTOMATION_RUN_MODES, current.run_mode, 'run_mode'),
        body.priority === undefined ? null : this.normalizeEnum(body.priority, AUTOMATION_PRIORITIES, current.priority, 'priority'),
        body.cooldown_minutes === undefined ? null : this.normalizePositiveInt(body.cooldown_minutes, current.cooldown_minutes, 0, 10080, 'cooldown_minutes'),
        body.max_runs_per_day === undefined ? null : this.normalizePositiveInt(body.max_runs_per_day, current.max_runs_per_day, 1, 500, 'max_runs_per_day'),
        this.uuidOrNull(user.id),
      ],
    );
    await this.logActivity(schema, 'rule_updated', id, current.template_id, user.id, {});
    return rows[0];
  }

  async deleteRule(id: string) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".automation_rules SET deleted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1`, [this.requireUuid(id), this.uuidOrNull(user.id)]);
    await this.logActivity(schema, 'rule_deleted', id, null, user.id, {});
    return { success: true };
  }

  async setEnabled(id: string, enabled: boolean) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rule = await this.getRuleInternal(schema, id);
    const nextRunAt = enabled ? this.computeNextRunAt(rule.schedule_config, new Date()) : null;
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".automation_rules SET is_enabled = $2, next_run_at = $3, updated_by = $4, updated_at = now() WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [this.requireUuid(id), enabled, nextRunAt, this.uuidOrNull(user.id)],
    );
    await this.logActivity(schema, enabled ? 'rule_enabled' : 'rule_disabled', id, rule.template_id, user.id, {});
    return rows[0];
  }

  async runRuleFromRequest(id: string, payload: Record<string, unknown> = {}) {
    const user = this.assertRun();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rule = await this.getRuleInternal(schema, id);
    if (!this.canViewFinance(user.role) && this.isFinanceRule(rule)) throw new ForbiddenException('Automazione finance riservata a CEO/Admin.');
    if (!this.isAdmin(user.role) && this.isFinanceRule(rule)) throw new ForbiddenException('Automazione finance riservata a CEO/Admin.');
    return this.runRule(schema, rule, { actorUserId: this.uuidOrNull(user.id), triggerSource: 'manual', payload, force: true });
  }

  async runDueFromRequest() {
    const user = this.assertRun();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    return this.runDueRulesForSchema(schema, { actorUserId: this.uuidOrNull(user.id), triggerSource: 'manual_due', force: this.isAdmin(user.role) }, user);
  }

  async runTriggerFromRequest(triggerType: string, payload: Record<string, unknown> = {}) {
    const user = this.assertRun();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const trigger = this.normalizeEnum(triggerType, AUTOMATION_TRIGGER_TYPES, 'manual_run', 'triggerType');
    if (!this.canViewFinance(user.role) && FINANCE_AUTOMATION_TRIGGERS.has(trigger)) throw new ForbiddenException('Trigger finance riservato a CEO/Admin.');
    const where = ['deleted_at IS NULL', 'is_enabled = true', 'trigger_type = $1', `run_mode IN ('event', 'hybrid', 'scheduled')`];
    const params: unknown[] = [trigger];
    if (!this.canViewFinance(user.role)) {
      where.push(`category <> 'finance'`);
    }
    const rules = await this.dataSource.query(`SELECT * FROM "${schema}".automation_rules WHERE ${where.join(' AND ')} ORDER BY priority DESC, created_at ASC LIMIT 25`, params);
    const runs = [];
    for (const rule of rules) runs.push(await this.runRule(schema, rule, { actorUserId: this.uuidOrNull(user.id), triggerSource: 'manual_trigger', payload }));
    return { triggerType: trigger, rulesRun: runs.length, runs };
  }

  async listRuns(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const where = ['1=1'];
    const params: unknown[] = [];
    if (query.rule_id) where.push(`r.rule_id = $${params.length + 1}`) && params.push(this.requireUuid(query.rule_id, 'rule_id'));
    if (query.status) where.push(`r.status = $${params.length + 1}`) && params.push(String(query.status));
    if (!this.canViewFinance(user.role)) where.push(`(ar.id IS NULL OR ar.category <> 'finance')`);
    const rows = await this.dataSource.query(
      `SELECT r.id, r.rule_id, ar.name AS rule_name, r.trigger_type, r.trigger_source, r.status, r.started_at, r.finished_at,
              r.duration_ms, r.matched_count, r.actions_count, r.actions_success_count, r.actions_failed_count,
              r.skipped_reason, r.error_message, r.actor_user_id, r.result_payload
       FROM "${schema}".automation_runs r
       LEFT JOIN "${schema}".automation_rules ar ON ar.id = r.rule_id
       WHERE ${where.join(' AND ')}
       ORDER BY r.started_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const totalRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "${schema}".automation_runs r LEFT JOIN "${schema}".automation_rules ar ON ar.id = r.rule_id WHERE ${where.join(' AND ')}`,
      params,
    );
    return { items: rows, total: Number(totalRows[0]?.total || 0), limit, offset };
  }

  async getRun(id: string) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT r.*, ar.category, ar.name AS rule_name FROM "${schema}".automation_runs r LEFT JOIN "${schema}".automation_rules ar ON ar.id = r.rule_id WHERE r.id = $1 LIMIT 1`,
      [this.requireUuid(id)],
    );
    if (!rows[0]) throw new NotFoundException('Run automazione non trovato');
    if (!this.canViewFinance(user.role) && rows[0].category === 'finance') throw new ForbiddenException('Run finance riservato a CEO/Admin.');
    return rows[0];
  }

  async listRunActions(runId: string) {
    await this.getRun(runId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT id, run_id, rule_id, action_type, status, target_entity_type, target_entity_id, dedupe_key, message, error_message, payload, created_at
       FROM "${schema}".automation_action_logs WHERE run_id = $1 ORDER BY created_at ASC`,
      [this.requireUuid(runId)],
    );
    return { items: rows };
  }

  async listRuleRuns(ruleId: string, query: Record<string, any> = {}) {
    await this.getRule(ruleId);
    return this.listRuns({ ...query, rule_id: ruleId });
  }

  async activity(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const rows = await this.dataSource.query(
      `SELECT a.id, a.action, a.rule_id, a.template_id, a.actor_user_id, a.metadata, a.created_at
       FROM "${schema}".automation_activity a
       LEFT JOIN "${schema}".automation_rules ar ON ar.id = a.rule_id
       WHERE ${this.canViewFinance(user.role) ? 'TRUE' : `(ar.id IS NULL OR ar.category <> 'finance')`}
       ORDER BY a.created_at DESC
       LIMIT $1`,
      [limit],
    );
    return { items: rows };
  }

  async listDedupe(query: Record<string, any> = {}) {
    this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const rows = await this.dataSource.query(
      `SELECT id, rule_id, dedupe_key, entity_type, entity_id, action_type, first_seen_at, last_seen_at, expires_at, hit_count
       FROM "${schema}".automation_dedupe ORDER BY last_seen_at DESC LIMIT $1`,
      [limit],
    );
    return { items: rows };
  }

  async deleteDedupe(id: string) {
    this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`DELETE FROM "${schema}".automation_dedupe WHERE id = $1`, [this.requireUuid(id)]);
    return { success: true };
  }

  async exportRule(id: string) {
    const rule = await this.getRule(id);
    return { exportedAt: new Date().toISOString(), rule };
  }

  async exportRun(id: string) {
    const run = await this.getRun(id);
    const actions = await this.listRunActions(id);
    return { exportedAt: new Date().toISOString(), run, actions: actions.items };
  }

  private async runRule(schema: string, rule: Record<string, any>, context: RunContext = {}) {
    const started = Date.now();
    const dailyCountRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".automation_runs WHERE rule_id = $1 AND started_at >= CURRENT_DATE`,
      [rule.id],
    );
    if (!context.force && Number(dailyCountRows[0]?.count || 0) >= Number(rule.max_runs_per_day || 50)) {
      return this.createSkippedRun(schema, rule, 'max_runs_per_day raggiunto', context);
    }

    const runRows = await this.dataSource.query(
      `INSERT INTO "${schema}".automation_runs (rule_id, trigger_type, trigger_source, status, input_payload, actor_user_id, started_at, created_at)
       VALUES ($1, $2, $3, 'running', $4::jsonb, $5, now(), now())
       RETURNING id, started_at`,
      [rule.id, rule.trigger_type, context.triggerSource || 'manual', JSON.stringify(context.payload || {}), this.uuidOrNull(context.actorUserId)],
    );
    const runId = runRows[0].id;
    let matches: Match[] = [];
    let success = 0;
    let failed = 0;
    let skipped = 0;
    try {
      matches = await this.findMatches(schema, rule, context);
      const actions = this.normalizeActions(rule.actions || []);
      for (const match of matches) {
        for (const action of actions) {
          const result = await this.executeAction(schema, runId, rule, action, match, context);
          if (result === 'success') success += 1;
          else if (result === 'skipped') skipped += 1;
          else failed += 1;
        }
      }
      const status = failed > 0 && success > 0 ? 'partial_success' : failed > 0 ? 'failed' : 'success';
      await this.dataSource.query(
        `UPDATE "${schema}".automation_runs
         SET status = $2,
             finished_at = now(),
             duration_ms = $3,
             matched_count = $4,
             actions_count = $5,
             actions_success_count = $6,
             actions_failed_count = $7,
             result_payload = $8::jsonb
         WHERE id = $1`,
        [runId, status, Date.now() - started, matches.length, success + failed + skipped, success, failed, JSON.stringify({ skipped })],
      );
      await this.updateRuleAfterRun(schema, rule, status, null);
      await this.logActivity(schema, context.triggerSource === 'scheduled' ? 'rule_run_scheduled' : 'rule_run_manual', rule.id, rule.template_id, context.actorUserId || null, { runId, status, matches: matches.length });
      return { id: runId, ruleId: rule.id, status, matchedCount: matches.length, actionsSuccessCount: success, actionsFailedCount: failed, actionsSkippedCount: skipped };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || 'Errore automazione');
      this.logger.error(`Automation rule ${rule.id} failed: ${message}`, err instanceof Error ? err.stack : undefined);
      await this.dataSource.query(
        `UPDATE "${schema}".automation_runs
         SET status = 'failed', finished_at = now(), duration_ms = $2, matched_count = $3, actions_success_count = $4, actions_failed_count = $5, error_message = $6
         WHERE id = $1`,
        [runId, Date.now() - started, matches.length, success, failed + 1, message],
      );
      await this.updateRuleAfterRun(schema, rule, 'failed', message);
      return { id: runId, ruleId: rule.id, status: 'failed', matchedCount: matches.length, actionsSuccessCount: success, actionsFailedCount: failed + 1, errorMessage: message };
    }
  }

  private async createSkippedRun(schema: string, rule: Record<string, any>, reason: string, context: RunContext) {
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".automation_runs (rule_id, trigger_type, trigger_source, status, skipped_reason, input_payload, actor_user_id, started_at, finished_at, created_at)
       VALUES ($1, $2, $3, 'skipped', $4, $5::jsonb, $6, now(), now(), now())
       RETURNING id`,
      [rule.id, rule.trigger_type, context.triggerSource || 'manual', reason, JSON.stringify(context.payload || {}), this.uuidOrNull(context.actorUserId)],
    );
    return { id: rows[0].id, ruleId: rule.id, status: 'skipped', matchedCount: 0, actionsSuccessCount: 0, actionsFailedCount: 0, skippedReason: reason };
  }

  async runDueRulesForSchema(schema: string, context: RunContext = {}, user?: AuthUser) {
    const s = safeSchema(schema, 'TenantAutomationsService.runDueRulesForSchema');
    await ensureTenantAutomationsTables(this.dataSource, s);
    const params: unknown[] = [];
    const financeFilter = user && !this.canViewFinance(user.role) ? `AND category <> 'finance' AND trigger_type <> ALL($1::text[])` : '';
    if (financeFilter) params.push(Array.from(FINANCE_AUTOMATION_TRIGGERS));
    const rules = await this.dataSource.query(
      `SELECT * FROM "${s}".automation_rules
       WHERE deleted_at IS NULL
         AND is_enabled = true
         AND run_mode IN ('scheduled', 'hybrid')
         AND (next_run_at IS NULL OR next_run_at <= now())
         ${financeFilter}
       ORDER BY COALESCE(next_run_at, created_at) ASC
       LIMIT 25`,
      params,
    );
    const runs = [];
    for (const rule of rules) runs.push(await this.runRule(s, rule, { ...context, triggerSource: context.triggerSource || 'scheduled' }));
    return { rulesRun: runs.length, runs };
  }

  @Cron(CronExpression.EVERY_HOUR)
  async runScheduled() {
    try {
      const tenants = await this.dataSource.query(`SELECT schema_name FROM public.tenants WHERE is_active = true AND schema_name IS NOT NULL`);
      for (const tenant of tenants.slice(0, 50)) {
        const schema = safeSchema(tenant.schema_name, 'TenantAutomationsService.runScheduled');
        try {
          await this.runDueRulesForSchema(schema, { triggerSource: 'scheduled' });
        } catch (err) {
          this.logger.error(`Scheduled automations failed for ${schema}: ${err instanceof Error ? err.message : String(err)}`);
        }
      }
    } catch (err) {
      this.logger.error(`Scheduled automations loop failed: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  private async findMatches(schema: string, rule: Record<string, any>, context: RunContext): Promise<Match[]> {
    const conditions = rule.conditions || {};
    const days = this.getConditionNumber(conditions, 'older_than_days', this.getConditionNumber(conditions, 'no_activity_for_days', 7));
    const dueDays = this.getConditionNumber(conditions, 'due_within_days', rule.trigger_type === 'contract_expiring_30_days' ? 30 : 7);
    const missingCount = this.getConditionNumber(conditions, 'missing_required_items_count_gt', 0);
    const limit = 50;
    switch (rule.trigger_type) {
      case 'manual_run':
      case 'scheduled_daily':
      case 'scheduled_hourly':
      case 'scheduled_weekly':
      case 'daily_digest':
      case 'executive_risk_detected':
        return [{
          entity_type: String(context.payload?.entity_type || 'system'),
          entity_id: this.uuidOrNull(context.payload?.entity_id),
          title: String(context.payload?.title || rule.name || 'Automazione manuale'),
          metadata: { payload: context.payload || {} },
        }];
      case 'quote_sent_followup':
        return this.queryMatches(schema, 'quotes', ['id', 'title', 'quote_number', 'company_id', 'contact_id', 'opportunity_id', 'created_by', 'updated_at'], `status = 'sent' AND COALESCE(updated_at, created_at) < now() - ($1::int * interval '1 day')`, [days], limit, 'quote', (r) => ({
          title: r.title || r.quote_number || 'Preventivo inviato',
          owner_user_id: r.created_by,
          company_id: r.company_id,
          metadata: { quote_number: r.quote_number, opportunity_id: r.opportunity_id },
        }));
      case 'lead_stale':
        return this.queryMatches(schema, 'leads', ['id', 'first_name', 'last_name', 'email', 'status', 'assigned_to', 'updated_at'], `deleted_at IS NULL AND COALESCE(updated_at, created_at) < now() - ($1::int * interval '1 day')`, [days], limit, 'lead', (r) => ({
          title: [r.first_name, r.last_name].filter(Boolean).join(' ') || r.email || 'Lead fermo',
          assigned_to_user_id: r.assigned_to,
        }));
      case 'opportunity_stale':
        return this.queryMatches(schema, 'opportunities', ['id', 'title', 'stage', 'assigned_to', 'updated_at'], `deleted_at IS NULL AND COALESCE(updated_at, created_at) < now() - ($1::int * interval '1 day')`, [days], limit, 'opportunity', (r) => ({ title: r.title || 'Opportunita ferma', assigned_to_user_id: r.assigned_to }));
      case 'commercial_activity_due':
        return this.queryMatches(schema, 'commercial_activities', ['id', 'title', 'due_at', 'assigned_to', 'opportunity_id', 'lead_id'], `deleted_at IS NULL AND completed_at IS NULL AND due_at IS NOT NULL AND due_at <= now()`, [], limit, 'commercial_activity', (r) => ({ title: r.title || 'Attivita commerciale in scadenza', due_date: r.due_at, assigned_to_user_id: r.assigned_to, metadata: { opportunity_id: r.opportunity_id, lead_id: r.lead_id } }));
      case 'project_blocked':
        return this.queryMatches(schema, 'projects', ['id', 'name', 'status', 'project_manager_id', 'due_date'], `deleted_at IS NULL AND status = 'blocked'`, [], limit, 'project', (r) => ({ title: r.name || 'Progetto bloccato', due_date: r.due_date, owner_user_id: r.project_manager_id }));
      case 'project_due_soon':
        return this.queryMatches(schema, 'projects', ['id', 'name', 'status', 'project_manager_id', 'due_date'], `deleted_at IS NULL AND due_date BETWEEN current_date AND current_date + ($1::int * interval '1 day') AND status NOT IN ('closed', 'delivered')`, [dueDays], limit, 'project', (r) => ({ title: r.name || 'Progetto in consegna', due_date: r.due_date, owner_user_id: r.project_manager_id }));
      case 'project_overdue':
        return this.queryMatches(schema, 'projects', ['id', 'name', 'status', 'project_manager_id', 'due_date'], `deleted_at IS NULL AND due_date < current_date AND status NOT IN ('closed', 'delivered')`, [], limit, 'project', (r) => ({ title: r.name || 'Progetto in ritardo', due_date: r.due_date, owner_user_id: r.project_manager_id }));
      case 'task_due_today':
        return this.queryMatches(schema, 'tasks', ['id', 'title', 'project_id', 'assignee_id', 'due_at'], `deleted_at IS NULL AND due_at::date = current_date AND status <> 'done'`, [], limit, 'task', (r) => ({ title: r.title || 'Task in scadenza', due_date: r.due_at, assigned_to_user_id: r.assignee_id, project_id: r.project_id }));
      case 'task_overdue':
        return this.queryMatches(schema, 'tasks', ['id', 'title', 'project_id', 'assignee_id', 'due_at'], `deleted_at IS NULL AND due_at < now() AND status <> 'done'`, [], limit, 'task', (r) => ({ title: r.title || 'Task scaduto', due_date: r.due_at, assigned_to_user_id: r.assignee_id, project_id: r.project_id }));
      case 'milestone_due_soon':
        return this.queryMatches(schema, 'milestones', ['id', 'title', 'project_id', 'due_date'], `deleted_at IS NULL AND due_date BETWEEN current_date AND current_date + ($1::int * interval '1 day') AND status IN ('pending', 'in_progress')`, [dueDays], limit, 'milestone', (r) => ({ title: r.title || 'Milestone in scadenza', due_date: r.due_date, project_id: r.project_id }));
      case 'milestone_overdue':
        return this.queryMatches(schema, 'milestones', ['id', 'title', 'project_id', 'due_date'], `deleted_at IS NULL AND due_date < current_date AND status NOT IN ('completed', 'skipped')`, [], limit, 'milestone', (r) => ({ title: r.title || 'Milestone scaduta', due_date: r.due_date, project_id: r.project_id }));
      case 'invoice_due_soon':
        return this.queryMatches(schema, 'invoices', ['id', 'title', 'company_id', 'project_id', 'due_date', 'remaining_total'], `deleted_at IS NULL AND due_date BETWEEN current_date AND current_date + ($1::int * interval '1 day') AND status NOT IN ('paid', 'cancelled', 'void')`, [dueDays], limit, 'invoice', (r) => ({ title: r.title || 'Fattura in scadenza', due_date: r.due_date, project_id: r.project_id, company_id: r.company_id, metadata: { remaining_total: r.remaining_total } }));
      case 'invoice_overdue':
        return this.queryMatches(schema, 'invoices', ['id', 'title', 'company_id', 'project_id', 'due_date', 'remaining_total'], `deleted_at IS NULL AND due_date < current_date AND status NOT IN ('paid', 'cancelled', 'void')`, [], limit, 'invoice', (r) => ({ title: r.title || 'Fattura scaduta', due_date: r.due_date, project_id: r.project_id, company_id: r.company_id, metadata: { remaining_total: r.remaining_total } }));
      case 'financial_deadline_due_soon':
        return this.queryMatches(schema, 'financial_deadlines', ['id', 'title', 'company_id', 'project_id', 'due_date', 'amount'], `deleted_at IS NULL AND status = 'open' AND due_date BETWEEN current_date AND current_date + ($1::int * interval '1 day')`, [dueDays], limit, 'deadline', (r) => ({ title: r.title || 'Scadenza finance', due_date: r.due_date, project_id: r.project_id, company_id: r.company_id, metadata: { amount: r.amount } }));
      case 'renewal_due_soon':
        return this.queryMatches(schema, 'renewals', ['id', 'title', 'company_id', 'project_id', 'due_date', 'amount'], `deleted_at IS NULL AND status IN ('upcoming', 'reminded') AND due_date BETWEEN current_date AND current_date + ($1::int * interval '1 day')`, [dueDays], limit, 'renewal', (r) => ({ title: r.title || 'Rinnovo in scadenza', due_date: r.due_date, project_id: r.project_id, company_id: r.company_id, metadata: { amount: r.amount } }));
      case 'recurring_service_due_soon':
        return this.queryMatches(schema, 'recurring_services', ['id', 'name', 'company_id', 'project_id', 'next_due_date', 'amount'], `deleted_at IS NULL AND status = 'active' AND next_due_date BETWEEN current_date AND current_date + ($1::int * interval '1 day')`, [dueDays], limit, 'recurring_service', (r) => ({ title: r.name || 'Servizio ricorrente', due_date: r.next_due_date, project_id: r.project_id, company_id: r.company_id, metadata: { amount: r.amount } }));
      case 'time_entry_submitted':
        return this.queryMatches(schema, 'time_entries', ['id', 'team_member_id', 'project_id', 'task_id', 'entry_date', 'duration_minutes'], `deleted_at IS NULL AND status = 'submitted'`, [], limit, 'time_entry', (r) => ({ title: `Time entry ${r.duration_minutes || 0} min`, due_date: r.entry_date, project_id: r.project_id, metadata: { team_member_id: r.team_member_id, task_id: r.task_id } }));
      case 'member_overloaded':
        return this.queryMatches(schema, 'team_members', ['id', 'display_name', 'email', 'availability_status'], `deleted_at IS NULL AND availability_status = 'busy'`, [], limit, 'team_member', (r) => ({ title: r.display_name || r.email || 'Membro team sovraccarico' }));
      case 'availability_starts_today':
        return this.queryMatches(schema, 'team_availability', ['id', 'team_member_id', 'type', 'title', 'starts_at'], `deleted_at IS NULL AND status <> 'cancelled' AND starts_at::date = current_date`, [], limit, 'team_availability', (r) => ({ title: r.title || `Disponibilita ${r.type}`, due_date: r.starts_at, metadata: { team_member_id: r.team_member_id } }));
      case 'contract_due_soon':
        return this.queryMatches(schema, 'contracts', ['id', 'title', 'company_id', 'project_id', 'quote_id', 'assigned_to_user_id', 'owner_user_id', 'due_date'], `deleted_at IS NULL AND due_date BETWEEN current_date AND current_date + ($1::int * interval '1 day') AND status NOT IN ('signed', 'active', 'cancelled', 'archived')`, [dueDays], limit, 'contract', (r) => ({ title: r.title || 'Contratto in scadenza', due_date: r.due_date, assigned_to_user_id: r.assigned_to_user_id, owner_user_id: r.owner_user_id, project_id: r.project_id, quote_id: r.quote_id, company_id: r.company_id }));
      case 'contract_overdue':
        return this.queryMatches(schema, 'contracts', ['id', 'title', 'company_id', 'project_id', 'quote_id', 'assigned_to_user_id', 'owner_user_id', 'due_date'], `deleted_at IS NULL AND due_date < current_date AND status NOT IN ('signed', 'active', 'cancelled', 'archived')`, [], limit, 'contract', (r) => ({ title: r.title || 'Contratto scaduto', due_date: r.due_date, assigned_to_user_id: r.assigned_to_user_id, owner_user_id: r.owner_user_id, project_id: r.project_id, quote_id: r.quote_id, company_id: r.company_id }));
      case 'contract_waiting_signature':
        return this.queryMatches(schema, 'contracts', ['id', 'title', 'company_id', 'project_id', 'quote_id', 'assigned_to_user_id', 'owner_user_id', 'updated_at'], `deleted_at IS NULL AND signature_status IN ('internal_pending', 'client_pending', 'partially_signed') AND updated_at < now() - ($1::int * interval '1 day')`, [days], limit, 'contract', (r) => ({ title: r.title || 'Contratto in firma', assigned_to_user_id: r.assigned_to_user_id, owner_user_id: r.owner_user_id, project_id: r.project_id, quote_id: r.quote_id, company_id: r.company_id }));
      case 'contract_expiring_30_days':
        return this.queryMatches(schema, 'contracts', ['id', 'title', 'company_id', 'project_id', 'quote_id', 'renewal_date'], `deleted_at IS NULL AND renewal_date BETWEEN current_date AND current_date + ($1::int * interval '1 day') AND status NOT IN ('cancelled', 'archived')`, [dueDays], limit, 'contract', (r) => ({ title: r.title || 'Contratto in rinnovo', due_date: r.renewal_date, project_id: r.project_id, quote_id: r.quote_id, company_id: r.company_id }));
      case 'paperwork_due_soon':
        return this.queryMatches(schema, 'paperwork_dossiers', ['id', 'title', 'company_id', 'project_id', 'quote_id', 'contract_id', 'assigned_to_user_id', 'owner_user_id', 'due_date'], `deleted_at IS NULL AND due_date BETWEEN current_date AND current_date + ($1::int * interval '1 day') AND status NOT IN ('completed', 'archived')`, [dueDays], limit, 'paperwork_dossier', (r) => ({ title: r.title || 'Dossier in scadenza', due_date: r.due_date, assigned_to_user_id: r.assigned_to_user_id, owner_user_id: r.owner_user_id, project_id: r.project_id, quote_id: r.quote_id, contract_id: r.contract_id, company_id: r.company_id }));
      case 'paperwork_overdue':
        return this.queryMatches(schema, 'paperwork_dossiers', ['id', 'title', 'company_id', 'project_id', 'quote_id', 'contract_id', 'assigned_to_user_id', 'owner_user_id', 'due_date'], `deleted_at IS NULL AND due_date < current_date AND status NOT IN ('completed', 'archived')`, [], limit, 'paperwork_dossier', (r) => ({ title: r.title || 'Dossier scaduto', due_date: r.due_date, assigned_to_user_id: r.assigned_to_user_id, owner_user_id: r.owner_user_id, project_id: r.project_id, quote_id: r.quote_id, contract_id: r.contract_id, company_id: r.company_id }));
      case 'paperwork_blocked':
        return this.queryMatches(schema, 'paperwork_dossiers', ['id', 'title', 'company_id', 'project_id', 'quote_id', 'contract_id', 'assigned_to_user_id', 'owner_user_id'], `deleted_at IS NULL AND status = 'blocked'`, [], limit, 'paperwork_dossier', (r) => ({ title: r.title || 'Dossier bloccato', assigned_to_user_id: r.assigned_to_user_id, owner_user_id: r.owner_user_id, project_id: r.project_id, quote_id: r.quote_id, contract_id: r.contract_id, company_id: r.company_id }));
      case 'paperwork_missing_required_items':
        return this.paperworkMissingItems(schema, missingCount, limit);
      case 'document_uploaded':
        return this.queryMatches(schema, 'documents', ['id', 'title', 'original_filename', 'entity_type', 'entity_id', 'uploaded_by', 'created_at'], `deleted_at IS NULL AND created_at >= now() - interval '1 day'`, [], limit, 'document', (r) => ({ title: r.title || r.original_filename || 'Documento caricato', owner_user_id: r.uploaded_by, metadata: { entity_type: r.entity_type, entity_id: r.entity_id } }));
      default:
        return [];
    }
  }

  private async queryMatches(
    schema: string,
    table: string,
    fields: string[],
    where: string,
    params: unknown[],
    limit: number,
    entityType: string,
    map: (row: any) => Partial<Match>,
  ): Promise<Match[]> {
    if (!(await this.tableExists(schema, table))) return [];
    const selected = fields.map((field) => `"${field}"`).join(', ');
    const rows = await this.dataSource.query(
      `SELECT ${selected} FROM "${schema}".${this.safeTableName(table)} WHERE ${where} ORDER BY COALESCE(updated_at, created_at, now()) DESC LIMIT $${params.length + 1}`,
      [...params, limit],
    ).catch(async () => {
      const fallbackRows = await this.dataSource.query(
        `SELECT ${selected} FROM "${schema}".${this.safeTableName(table)} WHERE ${where} LIMIT $${params.length + 1}`,
        [...params, limit],
      );
      return fallbackRows;
    });
    return rows.map((row: any) => ({
      entity_type: entityType,
      entity_id: row.id || null,
      title: row.title || row.name || row.id,
      ...map(row),
    }));
  }

  private async paperworkMissingItems(schema: string, threshold: number, limit: number): Promise<Match[]> {
    if (!(await this.tableExists(schema, 'paperwork_dossiers')) || !(await this.tableExists(schema, 'paperwork_items'))) return [];
    const rows = await this.dataSource.query(
      `SELECT d.id, d.title, d.company_id, d.project_id, d.quote_id, d.contract_id, d.assigned_to_user_id, d.owner_user_id, COUNT(i.id)::int AS missing_count
       FROM "${schema}".paperwork_dossiers d
       JOIN "${schema}".paperwork_items i ON i.dossier_id = d.id AND i.deleted_at IS NULL AND i.is_required = true AND i.status IN ('missing', 'requested', 'rejected')
       WHERE d.deleted_at IS NULL AND d.status NOT IN ('completed', 'archived')
       GROUP BY d.id
       HAVING COUNT(i.id) > $1
       ORDER BY missing_count DESC
       LIMIT $2`,
      [threshold, limit],
    );
    return rows.map((row: any) => ({
      entity_type: 'paperwork_dossier',
      entity_id: row.id,
      title: row.title || 'Dossier con item mancanti',
      assigned_to_user_id: row.assigned_to_user_id,
      owner_user_id: row.owner_user_id,
      project_id: row.project_id,
      quote_id: row.quote_id,
      contract_id: row.contract_id,
      company_id: row.company_id,
      metadata: { missing_count: row.missing_count },
    }));
  }

  private async executeAction(schema: string, runId: string, rule: Record<string, any>, action: Record<string, unknown>, match: Match, context: RunContext): Promise<'success' | 'failed' | 'skipped'> {
    const actionType = String(action.type || action.action_type || '');
    const dedupeKey = `${rule.id}:${actionType}:${match.entity_type}:${match.entity_id || 'system'}`;
    const dedupe = await this.claimDedupe(schema, rule.id, dedupeKey, match, actionType, Number(rule.cooldown_minutes || 60), Number((action as any).dedupe_ttl_hours || 24));
    if (!dedupe) {
      await this.logAction(schema, runId, rule.id, actionType, 'skipped', match, dedupeKey, 'Dedupe/cooldown attivo', null, { action, match });
      return 'skipped';
    }
    try {
      switch (actionType) {
        case 'create_notification':
          await this.actionCreateNotification(schema, rule, action, match, context, dedupeKey);
          break;
        case 'create_commercial_activity':
          await this.actionCreateCommercialActivity(schema, match, dedupeKey);
          break;
        case 'create_paperwork_dossier':
          await this.actionCreatePaperworkDossier(schema, match, dedupeKey);
          break;
        case 'create_paperwork_item':
          await this.actionCreatePaperworkItem(schema, match, action);
          break;
        case 'create_contract_checklist_item':
          await this.actionCreateContractChecklistItem(schema, match, action);
          break;
        case 'create_financial_deadline':
          await this.actionCreateFinancialDeadline(schema, match, action);
          break;
        case 'create_report_snapshot':
          await this.actionCreateReportSnapshot(schema, rule, match);
          break;
        case 'update_entity_status':
          await this.actionUpdateEntityStatus(schema, match, action);
          break;
        case 'add_activity_log':
          await this.actionAddActivityLog(schema, match, rule, action);
          break;
        case 'mark_rule_run':
        case 'noop':
          break;
        case 'create_task':
          await this.actionCreateTask(schema, match, action);
          break;
        default:
          throw new BadRequestException(`Azione non implementata: ${actionType}`);
      }
      await this.logAction(schema, runId, rule.id, actionType, 'success', match, dedupeKey, 'Azione eseguita', null, { action, match });
      await this.logActivity(schema, 'action_executed', rule.id, rule.template_id, context.actorUserId || null, { actionType, entity: match.entity_type, entityId: match.entity_id });
      return 'success';
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err || 'Errore azione');
      await this.logAction(schema, runId, rule.id, actionType, 'failed', match, dedupeKey, null, message, { action, match });
      await this.logActivity(schema, 'action_failed', rule.id, rule.template_id, context.actorUserId || null, { actionType, error: message });
      return 'failed';
    }
  }

  private async claimDedupe(schema: string, ruleId: string, dedupeKey: string, match: Match, actionType: string, cooldownMinutes: number, ttlHours: number): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT id, last_seen_at, expires_at
       FROM "${schema}".automation_dedupe
       WHERE rule_id = $1 AND dedupe_key = $2
       LIMIT 1`,
      [ruleId, dedupeKey],
    );
    if (rows[0]) {
      const allowed = await this.dataSource.query(
        `SELECT ($1::timestamptz <= now() - ($2::int * interval '1 minute') OR ($3::timestamptz IS NOT NULL AND $3::timestamptz < now())) AS allowed`,
        [rows[0].last_seen_at, cooldownMinutes, rows[0].expires_at],
      );
      await this.dataSource.query(
        `UPDATE "${schema}".automation_dedupe SET last_seen_at = now(), hit_count = hit_count + 1 WHERE id = $1`,
        [rows[0].id],
      );
      if (!allowed[0]?.allowed) return false;
      return true;
    }
    await this.dataSource.query(
      `INSERT INTO "${schema}".automation_dedupe (rule_id, dedupe_key, entity_type, entity_id, action_type, expires_at, first_seen_at, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, now() + ($6::int * interval '1 hour'), now(), now())`,
      [ruleId, dedupeKey, match.entity_type, this.uuidOrNull(match.entity_id), actionType, ttlHours],
    );
    return true;
  }

  private async actionCreateNotification(schema: string, rule: Record<string, any>, action: Record<string, unknown>, match: Match, context: RunContext, dedupeKey: string) {
    const roles = Array.isArray((action as any).target_roles)
      ? (action as any).target_roles.map((r: unknown) => String(r).toLowerCase())
      : this.isFinanceRule(rule) || FINANCE_ENTITY_TYPES.has(match.entity_type)
        ? ['owner', 'admin', 'superadmin']
        : ['manager', 'owner', 'admin', 'superadmin'];
    const title = String(action.title || `${rule.name}: ${match.title}`);
    const body = String(action.body || `Automazione ${rule.name} ha rilevato: ${match.title}`);
    const priority = String(action.priority || rule.priority || 'medium');
    const entityTypeForNotification = match.entity_type === 'financial_deadline' ? 'deadline' : match.entity_type;
    const common = {
      title,
      body,
      type: this.notificationTypeFromTrigger(rule.trigger_type),
      priority,
      entity_type: entityTypeForNotification,
      entity_id: match.entity_id,
      link_url: this.linkUrl(match),
      metadata: { automation_rule_id: rule.id, automation_run_source: context.triggerSource, match: match.metadata || {} },
      created_by: context.actorUserId || null,
    };
    if (match.assigned_to_user_id) {
      await this.notifications.createNotification(schema, { ...common, recipient_user_id: match.assigned_to_user_id, fingerprint: `automation:${dedupeKey}:user:${match.assigned_to_user_id}` });
      return;
    }
    if (match.owner_user_id) {
      await this.notifications.createNotification(schema, { ...common, recipient_user_id: match.owner_user_id, fingerprint: `automation:${dedupeKey}:user:${match.owner_user_id}` });
      return;
    }
    for (const role of roles) {
      await this.notifications.createNotification(schema, { ...common, recipient_role: role, fingerprint: `automation:${dedupeKey}:role:${role}` });
    }
  }

  private notificationTypeFromTrigger(trigger: string): string {
    const map: Record<string, string> = {
      quote_sent_followup: 'quote_follow_up',
      project_blocked: 'project_blocked',
      project_due_soon: 'project_due',
      project_overdue: 'project_due',
      task_due_today: 'task_due',
      task_overdue: 'task_overdue',
      milestone_due_soon: 'milestone_due',
      milestone_overdue: 'milestone_overdue',
      invoice_due_soon: 'invoice_due',
      invoice_overdue: 'invoice_overdue',
      renewal_due_soon: 'renewal_due',
      recurring_service_due_soon: 'recurring_due',
      financial_deadline_due_soon: 'financial_deadline_due',
    };
    return map[trigger] || 'system';
  }

  private linkUrl(match: Match): string | null {
    if (match.project_id) return `/projects/${match.project_id}`;
    if (match.entity_type === 'project' && match.entity_id) return `/projects/${match.entity_id}`;
    if (match.entity_type === 'task') return '/projects/tasks';
    if (match.entity_type === 'quote' && match.entity_id) return '/quotes';
    if (match.entity_type === 'invoice') return '/finance/invoices';
    if (match.entity_type === 'contract' && match.entity_id) return `/contracts/${match.entity_id}`;
    if (match.entity_type === 'paperwork_dossier' && match.entity_id) return `/paperwork/dossiers/${match.entity_id}`;
    return null;
  }

  private async actionCreateCommercialActivity(schema: string, match: Match, dedupeKey: string) {
    if (!(await this.tableExists(schema, 'commercial_activities'))) return;
    const title = `Follow-up automatico: ${match.title}`;
    await this.dataSource.query(
      `INSERT INTO "${schema}".commercial_activities (type, title, description, due_at, assigned_to, created_at, updated_at)
       VALUES ('follow_up', $1, $2, now() + interval '1 day', $3, now(), now())`,
      [title, `Creato da automazione interna (${dedupeKey}).`, this.uuidOrNull(match.assigned_to_user_id || match.owner_user_id)],
    );
  }

  private async actionCreatePaperworkDossier(schema: string, match: Match, dedupeKey: string) {
    if (!(await this.tableExists(schema, 'paperwork_dossiers'))) return;
    const existing = await this.dataSource.query(
      `SELECT id FROM "${schema}".paperwork_dossiers
       WHERE deleted_at IS NULL AND (
         ($1::uuid IS NOT NULL AND contract_id = $1) OR
         ($2::uuid IS NOT NULL AND project_id = $2) OR
         ($3::uuid IS NOT NULL AND quote_id = $3)
       )
       LIMIT 1`,
      [this.uuidOrNull(match.contract_id || (match.entity_type === 'contract' ? match.entity_id : null)), this.uuidOrNull(match.project_id || (match.entity_type === 'project' ? match.entity_id : null)), this.uuidOrNull(match.quote_id || (match.entity_type === 'quote' ? match.entity_id : null))],
    );
    if (existing[0]) return;
    await this.dataSource.query(
      `INSERT INTO "${schema}".paperwork_dossiers (
        title, description, dossier_type, company_id, quote_id, project_id, contract_id,
        owner_user_id, assigned_to_user_id, status, priority, due_date, metadata, created_at, updated_at
      ) VALUES ($1, $2, 'contract', $3, $4, $5, $6, $7, $8, 'open', 'medium', current_date + interval '7 days', $9::jsonb, now(), now())`,
      [
        `Scartoffie - ${match.title}`,
        `Creato da automazione interna (${dedupeKey}).`,
        this.uuidOrNull(match.company_id),
        this.uuidOrNull(match.quote_id),
        this.uuidOrNull(match.project_id),
        this.uuidOrNull(match.contract_id || (match.entity_type === 'contract' ? match.entity_id : null)),
        this.uuidOrNull(match.owner_user_id),
        this.uuidOrNull(match.assigned_to_user_id),
        JSON.stringify({ automation_dedupe_key: dedupeKey }),
      ],
    );
  }

  private async actionCreatePaperworkItem(schema: string, match: Match, action: Record<string, unknown>) {
    if (!(await this.tableExists(schema, 'paperwork_items'))) return;
    const dossierId = this.uuidOrNull(match.entity_type === 'paperwork_dossier' ? match.entity_id : match.metadata?.dossier_id);
    if (!dossierId) return;
    await this.dataSource.query(
      `INSERT INTO "${schema}".paperwork_items (dossier_id, title, description, category, is_required, status, due_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, 'missing', current_date + interval '7 days', now(), now())`,
      [dossierId, String(action.title || 'Item automatico'), this.textOrNull(action.description), String(action.category || 'document')],
    );
  }

  private async actionCreateContractChecklistItem(schema: string, match: Match, action: Record<string, unknown>) {
    if (!(await this.tableExists(schema, 'contract_checklist_items'))) return;
    const contractId = this.uuidOrNull(match.entity_type === 'contract' ? match.entity_id : match.contract_id);
    if (!contractId) return;
    await this.dataSource.query(
      `INSERT INTO "${schema}".contract_checklist_items (contract_id, title, description, category, is_required, status, due_date, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, 'missing', current_date + interval '7 days', now(), now())`,
      [contractId, String(action.title || 'Checklist automatica'), this.textOrNull(action.description), String(action.category || 'document')],
    );
  }

  private async actionCreateFinancialDeadline(schema: string, match: Match, action: Record<string, unknown>) {
    if (!(await this.tableExists(schema, 'financial_deadlines'))) return;
    await this.dataSource.query(
      `INSERT INTO "${schema}".financial_deadlines (company_id, project_id, quote_id, title, type, status, amount, currency, due_date, notes, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, 'open', $6, 'EUR', COALESCE($7::date, current_date + interval '7 days'), $8, now(), now())`,
      [
        this.uuidOrNull(match.company_id),
        this.uuidOrNull(match.project_id),
        this.uuidOrNull(match.quote_id),
        String(action.title || `Scadenza - ${match.title}`),
        String(action.deadline_type || 'other'),
        action.amount === undefined ? null : Number(action.amount),
        match.due_date || null,
        this.textOrNull(action.notes) || 'Creata da automazione interna.',
      ],
    );
  }

  private async actionCreateReportSnapshot(schema: string, rule: Record<string, any>, match: Match) {
    if (!(await this.tableExists(schema, 'report_snapshots'))) return;
    await this.dataSource.query(
      `INSERT INTO "${schema}".report_snapshots (report_key, title, payload, created_at)
       VALUES ('operations', $1, $2::jsonb, now())`,
      [`Snapshot automazione - ${rule.name}`, JSON.stringify({ rule_id: rule.id, match })],
    );
  }

  private async actionUpdateEntityStatus(schema: string, match: Match, action: Record<string, unknown>) {
    const nextStatus = this.textOrNull(action.status || action.next_status);
    if (!nextStatus || !match.entity_id) return;
    const allowed: Record<string, { table: string; statuses: string[] }> = {
      project: { table: 'projects', statuses: ['blocked', 'to_start', 'closed'] },
      task: { table: 'tasks', statuses: ['blocked', 'ready', 'done'] },
      contract: { table: 'contracts', statuses: ['archived', 'expired', 'cancelled'] },
      paperwork_dossier: { table: 'paperwork_dossiers', statuses: ['blocked', 'waiting', 'archived'] },
    };
    const config = allowed[match.entity_type];
    if (!config || !config.statuses.includes(nextStatus) || !(await this.tableExists(schema, config.table))) return;
    await this.dataSource.query(`UPDATE "${schema}".${config.table} SET status = $2, updated_at = now() WHERE id = $1 AND deleted_at IS NULL`, [match.entity_id, nextStatus]);
  }

  private async actionAddActivityLog(schema: string, match: Match, rule: Record<string, any>, action: Record<string, unknown>) {
    const message = this.textOrNull(action.message) || `Automazione ${rule.name}`;
    if (match.entity_type === 'contract' && match.entity_id && await this.tableExists(schema, 'contract_activity')) {
      await this.dataSource.query(`INSERT INTO "${schema}".contract_activity (contract_id, action, entity_type, entity_id, metadata, created_at) VALUES ($1, 'automation_activity', $2, $3, $4::jsonb, now())`, [match.entity_id, match.entity_type, match.entity_id, JSON.stringify({ message, rule_id: rule.id })]);
    }
    if (match.entity_type === 'paperwork_dossier' && match.entity_id && await this.tableExists(schema, 'paperwork_activity')) {
      await this.dataSource.query(`INSERT INTO "${schema}".paperwork_activity (dossier_id, action, entity_type, entity_id, metadata, created_at) VALUES ($1, 'automation_activity', $2, $3, $4::jsonb, now())`, [match.entity_id, match.entity_type, match.entity_id, JSON.stringify({ message, rule_id: rule.id })]);
    }
  }

  private async actionCreateTask(schema: string, match: Match, action: Record<string, unknown>) {
    if (!(await this.tableExists(schema, 'tasks'))) return;
    await this.dataSource.query(
      `INSERT INTO "${schema}".tasks (project_id, company_id, title, description, status, priority, assignee_id, due_at, created_at, updated_at)
       VALUES ($1, $2, $3, $4, 'backlog', $5, $6, now() + interval '2 days', now(), now())`,
      [this.uuidOrNull(match.project_id), this.uuidOrNull(match.company_id), String(action.title || `Task automatico: ${match.title}`), this.textOrNull(action.description), String(action.priority || 'medium'), this.uuidOrNull(match.assigned_to_user_id)],
    );
  }

  private async logAction(schema: string, runId: string, ruleId: string, actionType: string, status: string, match: Match, dedupeKey: string, message: string | null, errorMessage: string | null, payload: Record<string, unknown>) {
    await this.dataSource.query(
      `INSERT INTO "${schema}".automation_action_logs (
        run_id, rule_id, action_type, status, target_entity_type, target_entity_id,
        dedupe_key, message, error_message, payload, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, now())`,
      [runId, ruleId, actionType, status, match.entity_type, this.uuidOrNull(match.entity_id), dedupeKey, message, errorMessage, JSON.stringify(payload)],
    );
  }

  private async logActivity(schema: string, action: string, ruleId: string | null, templateId: string | null, actorUserId: string | null | undefined, metadata: Record<string, unknown>) {
    await this.dataSource.query(
      `INSERT INTO "${schema}".automation_activity (action, rule_id, template_id, actor_user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
      [action, this.uuidOrNull(ruleId), this.uuidOrNull(templateId), this.uuidOrNull(actorUserId), JSON.stringify(metadata || {})],
    );
  }

  private async updateRuleAfterRun(schema: string, rule: Record<string, any>, status: string, errorMessage: string | null) {
    const next = this.computeNextRunAt(rule.schedule_config, new Date());
    await this.dataSource.query(
      `UPDATE "${schema}".automation_rules
       SET last_run_at = now(),
           next_run_at = $2,
           last_success_at = CASE WHEN $3 IN ('success', 'partial_success') THEN now() ELSE last_success_at END,
           last_error_at = CASE WHEN $3 = 'failed' THEN now() ELSE last_error_at END,
           last_error_message = CASE WHEN $3 = 'failed' THEN $4 ELSE NULL END,
           updated_at = now()
       WHERE id = $1`,
      [rule.id, next, status, errorMessage],
    );
  }

  private computeNextRunAt(schedule: Record<string, unknown> | null, from: Date): Date {
    const config = schedule || {};
    const frequency = String(config.frequency || 'daily');
    const next = new Date(from);
    if (frequency === 'hourly') {
      next.setHours(next.getHours() + 1, 0, 0, 0);
      return next;
    }
    if (frequency === 'weekly') {
      const targetDay = Number.isInteger(Number(config.day_of_week)) ? Number(config.day_of_week) : next.getDay();
      const add = ((targetDay - next.getDay() + 7) % 7) || 7;
      next.setDate(next.getDate() + add);
      next.setHours(Number(config.hour ?? 8), 0, 0, 0);
      return next;
    }
    next.setDate(next.getDate() + 1);
    next.setHours(Number(config.hour ?? 8), 0, 0, 0);
    return next;
  }
}
