import { BadRequestException, ForbiddenException, Inject, Injectable, InternalServerErrorException, Logger, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import { ensureTenantReportsTables, seedTenantKpiTargets } from './tenant-reports-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin']);
const REPORT_KEYS = ['executive', 'sales', 'projects', 'finance', 'team', 'documents', 'operations', 'customers'] as const;
const GROUP_BY = ['day', 'week', 'month', 'quarter'] as const;
const TARGET_PERIODS = ['weekly', 'monthly', 'quarterly', 'yearly'] as const;
const SAVED_VIEW_VISIBILITIES = ['private', 'team', 'management'] as const;

type ReportKey = typeof REPORT_KEYS[number];
type AuthUser = { id: string; email?: string; role: string };
type Period = { dateFrom: string; dateTo: string; groupBy: typeof GROUP_BY[number]; comparePrevious: boolean };
type SourceFlags = Record<string, boolean>;
type ListResult<T = Record<string, any>> = { items: T[]; total: number; limit: number; offset: number };

@Injectable()
export class TenantReportsService {
  private readonly logger = new Logger(TenantReportsService.name);

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
    const schema = safeSchema(tenantRef || 'public', 'TenantReportsService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Report tenant non disponibili nel contesto public');
    return schema;
  }

  private isAdmin(role: string): boolean {
    return ADMIN_ROLES.has(role);
  }

  private isManager(role: string): boolean {
    return hasRoleAtLeast(role, 'manager');
  }

  private canReadReports(role: string): boolean {
    return this.isManager(role) || ['editor', 'user', 'viewer'].includes(role);
  }

  private canSeeFinance(role: string): boolean {
    return this.isAdmin(role);
  }

  private canManageReports(role: string): boolean {
    return this.isAdmin(role);
  }

  private assertCanRead(user = this.getUser()) {
    if (!this.canReadReports(user.role)) throw new ForbiddenException('Non hai accesso ai report.');
    return user;
  }

  private assertFinance(user = this.getUser()) {
    if (!this.canSeeFinance(user.role)) throw new ForbiddenException('Report finance disponibile solo per CEO/Admin.');
    return user;
  }

  private userIdOrNull(value: unknown): string | null {
    const text = String(value || '');
    return UUID_RE.test(text) ? text : null;
  }

  private requireUuid(value: string, label = 'ID'): string {
    if (!UUID_RE.test(String(value))) throw new BadRequestException(`${label} non valido`);
    return String(value);
  }

  private safeIdentifier(value: string, label = 'identificatore'): string {
    const text = String(value || '').trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(text)) throw new BadRequestException(`${label} non valido`);
    return text;
  }

  private async ensureSchema(schema: string) {
    await ensureTenantReportsTables(this.dataSource, schema);
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

  private normalizeReportKey(value: unknown): ReportKey {
    const key = String(value || '').trim().toLowerCase();
    if (!REPORT_KEYS.includes(key as ReportKey)) throw new BadRequestException('report_key non valido');
    return key as ReportKey;
  }

  private parseBool(value: unknown): boolean {
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  private toDateOnly(date: Date): string {
    return date.toISOString().slice(0, 10);
  }

  private normalizeDate(value: unknown, fallback: string): string {
    const text = String(value || '').trim();
    if (!text) return fallback;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) throw new BadRequestException('Data report non valida');
    return this.toDateOnly(date);
  }

  private getPeriod(query: Record<string, any> = {}): Period {
    const now = new Date();
    const firstDay = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const dateFrom = this.normalizeDate(query.date_from, this.toDateOnly(firstDay));
    const dateTo = this.normalizeDate(query.date_to, this.toDateOnly(now));
    if (dateFrom > dateTo) throw new BadRequestException('date_from deve essere precedente o uguale a date_to');
    const requestedGroup = String(query.group_by || 'month').trim().toLowerCase();
    const groupBy = GROUP_BY.includes(requestedGroup as any) ? requestedGroup as Period['groupBy'] : 'month';
    return { dateFrom, dateTo, groupBy, comparePrevious: this.parseBool(query.compare_previous) };
  }

  private previousPeriod(period: Period): { dateFrom: string; dateTo: string } {
    const from = new Date(`${period.dateFrom}T00:00:00.000Z`);
    const to = new Date(`${period.dateTo}T00:00:00.000Z`);
    const days = Math.max(1, Math.round((to.getTime() - from.getTime()) / 86400000) + 1);
    const previousTo = new Date(from.getTime() - 86400000);
    const previousFrom = new Date(previousTo.getTime() - (days - 1) * 86400000);
    return { dateFrom: this.toDateOnly(previousFrom), dateTo: this.toDateOnly(previousTo) };
  }

  private async tableExists(schema: string, table: string): Promise<boolean> {
    const safe = safeSchema(schema, 'TenantReportsService.tableExists');
    const safeTable = this.safeIdentifier(table, 'tabella');
    const rows = await this.dataSource.query(
      `SELECT to_regclass($1) AS exists`,
      [`"${safe}"."${safeTable}"`],
    );
    return Boolean(rows[0]?.exists);
  }

  private async columnExists(schema: string, table: string, column: string): Promise<boolean> {
    const safe = safeSchema(schema, 'TenantReportsService.columnExists');
    const safeTable = this.safeIdentifier(table, 'tabella');
    const safeColumn = this.safeIdentifier(column, 'colonna');
    const rows = await this.dataSource.query(
      `SELECT 1 FROM information_schema.columns WHERE table_schema = $1 AND table_name = $2 AND column_name = $3 LIMIT 1`,
      [safe, safeTable, safeColumn],
    );
    return rows.length > 0;
  }

  private async deletedWhere(schema: string, table: string, alias = ''): Promise<string> {
    const prefix = alias ? `${alias}.` : '';
    return (await this.columnExists(schema, table, 'deleted_at')) ? `${prefix}deleted_at IS NULL` : 'TRUE';
  }

  private async countRows(schema: string, table: string, where = 'TRUE', params: unknown[] = []): Promise<number> {
    const safe = safeSchema(schema, 'TenantReportsService.countRows');
    const safeTable = this.safeIdentifier(table, 'tabella');
    if (!(await this.tableExists(safe, safeTable))) return 0;
    const deleted = await this.deletedWhere(safe, safeTable);
    const rows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${safe}"."${safeTable}" WHERE (${where}) AND ${deleted}`,
      params,
    );
    return Number(rows[0]?.count || 0);
  }

  private async sumRows(schema: string, table: string, column: string, where = 'TRUE', params: unknown[] = []): Promise<number> {
    const safe = safeSchema(schema, 'TenantReportsService.sumRows');
    const safeTable = this.safeIdentifier(table, 'tabella');
    const safeColumn = this.safeIdentifier(column, 'colonna');
    if (!(await this.tableExists(safe, safeTable))) return 0;
    if (!(await this.columnExists(safe, safeTable, safeColumn))) return 0;
    const deleted = await this.deletedWhere(safe, safeTable);
    const rows = await this.dataSource.query(
      `SELECT COALESCE(SUM("${safeColumn}"), 0)::numeric AS total FROM "${safe}"."${safeTable}" WHERE (${where}) AND ${deleted}`,
      params,
    );
    return Number(rows[0]?.total || 0);
  }

  private async groupCount(schema: string, table: string, column: string, where = 'TRUE', params: unknown[] = []): Promise<Record<string, number>> {
    const safe = safeSchema(schema, 'TenantReportsService.groupCount');
    const safeTable = this.safeIdentifier(table, 'tabella');
    const safeColumn = this.safeIdentifier(column, 'colonna');
    if (!(await this.tableExists(safe, safeTable))) return {};
    if (!(await this.columnExists(safe, safeTable, safeColumn))) return {};
    const deleted = await this.deletedWhere(safe, safeTable);
    const rows = await this.dataSource.query(
      `SELECT COALESCE("${safeColumn}"::text, 'unknown') AS key, COUNT(*)::int AS count
       FROM "${safe}"."${safeTable}"
       WHERE (${where}) AND ${deleted}
       GROUP BY COALESCE("${safeColumn}"::text, 'unknown')
       ORDER BY count DESC`,
      params,
    );
    return Object.fromEntries(rows.map((row: any) => [String(row.key), Number(row.count || 0)]));
  }

  private async groupSum(schema: string, table: string, groupColumn: string, sumColumn: string, where = 'TRUE', params: unknown[] = []): Promise<Record<string, number>> {
    const safe = safeSchema(schema, 'TenantReportsService.groupSum');
    const safeTable = this.safeIdentifier(table, 'tabella');
    const safeGroupColumn = this.safeIdentifier(groupColumn, 'colonna gruppo');
    const safeSumColumn = this.safeIdentifier(sumColumn, 'colonna somma');
    if (!(await this.tableExists(safe, safeTable))) return {};
    if (!(await this.columnExists(safe, safeTable, safeGroupColumn))) return {};
    if (!(await this.columnExists(safe, safeTable, safeSumColumn))) return {};
    const deleted = await this.deletedWhere(safe, safeTable);
    const rows = await this.dataSource.query(
      `SELECT COALESCE("${safeGroupColumn}"::text, 'unknown') AS key, COALESCE(SUM("${safeSumColumn}"), 0)::numeric AS total
       FROM "${safe}"."${safeTable}"
       WHERE (${where}) AND ${deleted}
       GROUP BY COALESCE("${safeGroupColumn}"::text, 'unknown')
       ORDER BY total DESC`,
      params,
    );
    return Object.fromEntries(rows.map((row: any) => [String(row.key), Number(row.total || 0)]));
  }

  private periodWhere(column: string, params: unknown[], period: Pick<Period, 'dateFrom' | 'dateTo'>, cast = 'date'): string {
    const safeColumn = this.safeIdentifier(column, 'colonna periodo');
    params.push(period.dateFrom, period.dateTo);
    const fromIndex = params.length - 1;
    const toIndex = params.length;
    return `${safeColumn}::${cast} BETWEEN $${fromIndex}::date AND $${toIndex}::date`;
  }

  private async recentRows(schema: string, table: string, fields: string[], where = 'TRUE', params: unknown[] = [], limit = 5): Promise<any[]> {
    const safe = safeSchema(schema, 'TenantReportsService.recentRows');
    const safeTable = this.safeIdentifier(table, 'tabella');
    if (!(await this.tableExists(safe, safeTable))) return [];
    const existingFields: string[] = [];
    for (const field of fields) {
      const safeField = this.safeIdentifier(field, 'campo');
      if (await this.columnExists(safe, safeTable, safeField)) existingFields.push(`"${safeField}"`);
    }
    if (!existingFields.includes('"id"') && await this.columnExists(safe, safeTable, 'id')) existingFields.unshift('"id"');
    if (!existingFields.includes('"created_at"') && await this.columnExists(safe, safeTable, 'created_at')) existingFields.push('"created_at"');
    const deleted = await this.deletedWhere(safe, safeTable);
    return this.dataSource.query(
      `SELECT ${existingFields.length ? existingFields.join(', ') : '*'}
       FROM "${safe}"."${safeTable}"
       WHERE (${where}) AND ${deleted}
       ORDER BY created_at DESC NULLS LAST
       LIMIT $${params.length + 1}`,
      [...params, limit],
    );
  }

  private async logActivity(schema: string, user: AuthUser, action: string, reportKey?: string, metadata?: Record<string, unknown>) {
    const safe = safeSchema(schema, 'TenantReportsService.logActivity');
    await this.ensureSchema(safe);
    const userId = this.userIdOrNull(user.id);
    await this.dataSource.query(
      `INSERT INTO "${safe}".report_activity (action, report_key, actor_user_id, metadata, created_at)
       VALUES ($1, $2, $3, $4::jsonb, now())`,
      [action, reportKey || null, userId, JSON.stringify(metadata || {})],
    );
  }

  private emptySources(keys: string[]): SourceFlags {
    return Object.fromEntries(keys.map((key) => [key, false]));
  }

  private async tenantMeta(schema: string) {
    const rows = await this.dataSource.query(
      `SELECT id::text, slug, schema_name FROM public.tenants WHERE schema_name = $1 OR slug = $1 LIMIT 1`,
      [schema],
    );
    return rows[0] || { schema_name: schema };
  }

  private async baseEnvelope(schema: string, user: AuthUser, period: Period) {
    const tenant = await this.tenantMeta(schema);
    return {
      tenant: { id: tenant.id, slug: tenant.slug, schema: tenant.schema_name || schema },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        canViewFinance: this.canSeeFinance(user.role),
        canViewCosts: this.canSeeFinance(user.role),
      },
      period: {
        dateFrom: period.dateFrom,
        dateTo: period.dateTo,
        groupBy: period.groupBy,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  private async salesReport(schema: string, user: AuthUser, period: Period, query: Record<string, any> = {}) {
    const sources = this.emptySources(['leads', 'opportunities', 'quotes', 'commercial_activities']);
    const periodParams: unknown[] = [];
    const createdInPeriod = this.periodWhere('created_at', periodParams, period, 'date');

    const leadVisible = this.isManager(user.role) ? 'TRUE' : 'assigned_to = $1';
    const leadVisibleParams = this.isManager(user.role) ? [] : [this.userIdOrNull(user.id)];
    const newLeadParams: unknown[] = [period.dateFrom, period.dateTo, ...leadVisibleParams];
    const newLeadScope = this.isManager(user.role) ? 'TRUE' : `assigned_to = $3`;
    const leadSourceWhere = query.source ? `AND source = $${newLeadParams.length + 1}` : '';
    if (query.source) newLeadParams.push(String(query.source));

    const openLeads = await this.countRows(schema, 'leads', `${leadVisible} AND LOWER(COALESCE(status, '')) <> ALL($${leadVisibleParams.length + 1}::text[])`, [...leadVisibleParams, ['won', 'lost', 'paused']]);
    const newLeadsInPeriod = await this.countRows(schema, 'leads', `created_at::date BETWEEN $1::date AND $2::date AND (${newLeadScope}) ${leadSourceWhere}`, newLeadParams);
    const leadCountByStatus = await this.groupCount(schema, 'leads', 'status', leadVisible, leadVisibleParams);
    const leadCountBySource = await this.groupCount(schema, 'leads', 'source', leadVisible, leadVisibleParams);
    sources.leads = await this.tableExists(schema, 'leads');

    const opportunityVisibleParams: unknown[] = [];
    const opportunityVisible = this.isManager(user.role) ? 'TRUE' : `assigned_to = $1`;
    if (!this.isManager(user.role)) opportunityVisibleParams.push(this.userIdOrNull(user.id));
    const activeOpportunities = await this.countRows(schema, 'opportunities', `${opportunityVisible} AND LOWER(COALESCE(stage, '')) <> ALL($${opportunityVisibleParams.length + 1}::text[])`, [...opportunityVisibleParams, ['accepted', 'lost', 'paused']]);
    const pipelineValue = this.canSeeFinance(user.role) || this.isManager(user.role)
      ? await this.sumRows(schema, 'opportunities', 'value_estimate', `${opportunityVisible} AND LOWER(COALESCE(stage, '')) <> ALL($${opportunityVisibleParams.length + 1}::text[])`, [...opportunityVisibleParams, ['accepted', 'lost', 'paused']])
      : 0;
    const opportunitiesByStage = await this.groupCount(schema, 'opportunities', 'stage', opportunityVisible, opportunityVisibleParams);
    const pipelineValueByStage = this.isManager(user.role)
      ? await this.groupSum(schema, 'opportunities', 'stage', 'value_estimate', opportunityVisible, opportunityVisibleParams)
      : {};
    const wonDeals = await this.countRows(schema, 'opportunities', `${opportunityVisible} AND LOWER(COALESCE(stage, '')) = 'accepted'`, opportunityVisibleParams);
    const lostDeals = await this.countRows(schema, 'opportunities', `${opportunityVisible} AND LOWER(COALESCE(stage, '')) = 'lost'`, opportunityVisibleParams);
    const stagnantOpportunities = await this.recentRows(
      schema,
      'opportunities',
      ['id', 'title', 'stage', 'updated_at', 'value_estimate'],
      `${opportunityVisible} AND updated_at < now() - interval '14 days' AND LOWER(COALESCE(stage, '')) <> ALL($${opportunityVisibleParams.length + 1}::text[])`,
      [...opportunityVisibleParams, ['accepted', 'lost', 'paused']],
      10,
    );
    sources.opportunities = await this.tableExists(schema, 'opportunities');

    const sentQuotes = await this.countRows(schema, 'quotes', `LOWER(COALESCE(status, '')) = 'sent'`);
    const acceptedQuotes = await this.countRows(schema, 'quotes', `LOWER(COALESCE(status, '')) = 'accepted'`);
    const rejectedQuotes = await this.countRows(schema, 'quotes', `LOWER(COALESCE(status, '')) = 'rejected'`);
    const quoteCountByStatus = await this.groupCount(schema, 'quotes', 'status');
    const quoteValueByStatus = this.isManager(user.role) ? await this.groupSum(schema, 'quotes', 'status', 'total') : {};
    const quoteDenominator = acceptedQuotes + rejectedQuotes;
    const quoteAcceptanceRate = quoteDenominator > 0 ? Number(((acceptedQuotes / quoteDenominator) * 100).toFixed(2)) : 0;
    const acceptedQuoteValue = this.isManager(user.role) ? await this.sumRows(schema, 'quotes', 'total', `LOWER(COALESCE(status, '')) = 'accepted'`) : 0;
    const averageQuoteValue = acceptedQuotes > 0 ? Number((acceptedQuoteValue / acceptedQuotes).toFixed(2)) : 0;
    sources.quotes = await this.tableExists(schema, 'quotes');

    const followUpsDue = await this.countRows(schema, 'commercial_activities', `completed_at IS NULL AND due_at IS NOT NULL AND due_at <= now()`);
    const activityParams: unknown[] = [];
    const activitiesCompleted = await this.countRows(schema, 'commercial_activities', `completed_at IS NOT NULL AND ${this.periodWhere('completed_at', activityParams, period, 'date')}`, activityParams).catch(() => 0);
    const activitiesOpen = await this.countRows(schema, 'commercial_activities', `completed_at IS NULL`);
    sources.commercial_activities = await this.tableExists(schema, 'commercial_activities');

    return {
      openLeads,
      newLeadsInPeriod,
      leadCountByStatus,
      leadCountBySource,
      activeOpportunities,
      opportunitiesByStage,
      pipelineValue,
      pipelineValueByStage,
      sentQuotes,
      acceptedQuotes,
      rejectedQuotes,
      quoteCountByStatus,
      quoteValueByStatus,
      quoteAcceptanceRate,
      averageQuoteValue,
      followUpsDue,
      wonDeals,
      lostDeals,
      topOpportunities: await this.recentRows(schema, 'opportunities', ['id', 'title', 'stage', 'value_estimate', 'expected_close_date'], `${opportunityVisible} AND LOWER(COALESCE(stage, '')) <> ALL($${opportunityVisibleParams.length + 1}::text[])`, [...opportunityVisibleParams, ['accepted', 'lost', 'paused']], 10),
      stagnantOpportunities,
      commercialActivities: { completed: activitiesCompleted, open: activitiesOpen },
      sources,
    };
  }

  private async projectsReport(schema: string, user: AuthUser, period: Period) {
    const userId = this.userIdOrNull(user.id);
    const sources = this.emptySources(['projects', 'tasks', 'milestones', 'briefing_material_requests']);
    const projectScope = this.isManager(user.role)
      ? 'TRUE'
      : `(project_manager_id = $1 OR created_by = $1 OR id IN (SELECT project_id FROM "${schema}".project_members WHERE user_id = $1 AND deleted_at IS NULL))`;
    const projectParams = this.isManager(user.role) ? [] : [userId];
    const taskScope = this.isManager(user.role) ? 'TRUE' : `assignee_id = $1`;
    const taskParams = this.isManager(user.role) ? [] : [userId];

    const activeProjects = await this.countRows(schema, 'projects', `${projectScope} AND LOWER(COALESCE(status, '')) <> ALL($${projectParams.length + 1}::text[])`, [...projectParams, ['delivered', 'closed']]);
    const completedProjects = await this.countRows(schema, 'projects', `${projectScope} AND LOWER(COALESCE(status, '')) = ANY($${projectParams.length + 1}::text[])`, [...projectParams, ['delivered', 'closed']]);
    const lateProjects = await this.countRows(schema, 'projects', `${projectScope} AND due_date IS NOT NULL AND due_date < CURRENT_DATE AND LOWER(COALESCE(status, '')) <> ALL($${projectParams.length + 1}::text[])`, [...projectParams, ['delivered', 'closed']]);
    const blockedProjects = await this.countRows(schema, 'projects', `${projectScope} AND LOWER(COALESCE(status, '')) = 'blocked'`, projectParams);
    const projectsByStatus = await this.groupCount(schema, 'projects', 'status', projectScope, projectParams);
    sources.projects = await this.tableExists(schema, 'projects');

    const tasksByStatus = await this.groupCount(schema, 'tasks', 'status', taskScope, taskParams);
    const overdueTasks = await this.countRows(schema, 'tasks', `${taskScope} AND due_at IS NOT NULL AND due_at < now() AND LOWER(COALESCE(status, '')) <> 'done'`, taskParams);
    const dueSoonTasks = await this.countRows(schema, 'tasks', `${taskScope} AND due_at IS NOT NULL AND due_at BETWEEN now() AND now() + interval '7 days' AND LOWER(COALESCE(status, '')) <> 'done'`, taskParams);
    sources.tasks = await this.tableExists(schema, 'tasks');

    const milestonesByStatus = await this.groupCount(schema, 'milestones', 'status');
    const upcomingMilestones = await this.countRows(schema, 'milestones', `due_date IS NOT NULL AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 7 AND LOWER(COALESCE(status, '')) <> ALL($1::text[])`, [['completed', 'skipped']]);
    sources.milestones = await this.tableExists(schema, 'milestones');

    const projectDeliveryRate = activeProjects + completedProjects > 0
      ? Number(((completedProjects / (activeProjects + completedProjects)) * 100).toFixed(2))
      : 0;
    const projectRisks = await this.recentRows(
      schema,
      'projects',
      ['id', 'name', 'status', 'due_date', 'project_manager_id'],
      `${projectScope} AND (LOWER(COALESCE(status, '')) = 'blocked' OR (due_date IS NOT NULL AND due_date <= CURRENT_DATE + 7 AND LOWER(COALESCE(status, '')) <> ALL($${projectParams.length + 1}::text[])))`,
      [...projectParams, ['delivered', 'closed']],
      10,
    );
    const missingMaterials = await this.countRows(schema, 'briefing_material_requests', `LOWER(COALESCE(status, '')) IN ('missing', 'requested')`);
    sources.briefing_material_requests = await this.tableExists(schema, 'briefing_material_requests');

    return {
      projectsByStatus,
      activeProjects,
      completedProjects,
      lateProjects,
      blockedProjects,
      tasksByStatus,
      overdueTasks,
      dueSoonTasks,
      milestonesByStatus,
      upcomingMilestones,
      projectDeliveryRate,
      averageProjectAgeDays: await this.averageAgeDays(schema, 'projects', 'created_at', projectScope, projectParams),
      projectsWithoutRecentActivity: await this.countRows(schema, 'projects', `${projectScope} AND updated_at < now() - interval '14 days' AND LOWER(COALESCE(status, '')) <> ALL($${projectParams.length + 1}::text[])`, [...projectParams, ['delivered', 'closed']]),
      projectRisks,
      missingMaterials,
      workloadByProject: await this.workloadByProject(schema, user),
      sources,
    };
  }

  private async financeReport(schema: string, user: AuthUser, period: Period) {
    this.assertFinance(user);
    const sources = this.emptySources(['invoices', 'payments', 'financial_deadlines', 'renewals', 'recurring_services', 'project_financial_status', 'time_entries', 'team_members']);
    const periodParams: unknown[] = [];
    const invoicePeriod = this.periodWhere('created_at', periodParams, period, 'date');
    const issuedInvoices = await this.countRows(schema, 'invoices', invoicePeriod, periodParams);
    const invoicesByStatus = await this.groupCount(schema, 'invoices', 'status');
    const issuedInvoiceValue = await this.sumRows(schema, 'invoices', 'total', invoicePeriod, periodParams);
    const paidInvoices = await this.countRows(schema, 'invoices', `LOWER(COALESCE(status, '')) = 'paid'`);
    const paidInvoiceValue = await this.sumRows(schema, 'invoices', 'paid_total', `LOWER(COALESCE(status, '')) = 'paid'`);
    const overdueInvoices = await this.countRows(schema, 'invoices', `due_date IS NOT NULL AND due_date < CURRENT_DATE AND LOWER(COALESCE(status, '')) <> ALL($1::text[])`, [['paid', 'cancelled', 'void']]);
    const overdueInvoiceValue = await this.sumRows(schema, 'invoices', 'remaining_total', `due_date IS NOT NULL AND due_date < CURRENT_DATE AND LOWER(COALESCE(status, '')) <> ALL($1::text[])`, [['paid', 'cancelled', 'void']]);
    const receivables = await this.sumRows(schema, 'invoices', 'remaining_total', `LOWER(COALESCE(status, '')) <> ALL($1::text[])`, [['paid', 'cancelled', 'void']]);
    const paymentsParams: unknown[] = [];
    const paymentsPeriod = this.periodWhere('payment_date', paymentsParams, period, 'date');
    const paymentsInPeriod = await this.sumRows(schema, 'payments', 'amount', paymentsPeriod, paymentsParams);
    const paymentsByMonth = await this.timeSeries(schema, 'payments', 'payment_date', 'amount', period, 'sum');
    const openFinancialDeadlines = await this.countRows(schema, 'financial_deadlines', `LOWER(COALESCE(status, '')) = 'open'`);
    const upcomingRenewals = await this.countRows(schema, 'renewals', `due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 AND LOWER(COALESCE(status, '')) = ANY($1::text[])`, [['upcoming', 'reminded']]);
    const recurringServicesActive = await this.countRows(schema, 'recurring_services', `LOWER(COALESCE(status, '')) = 'active'`);
    const projectFinancialStatus = await this.groupCount(schema, 'project_financial_status', 'payment_status');
    const topUnpaidInvoices = await this.recentRows(schema, 'invoices', ['id', 'invoice_number', 'title', 'due_date', 'remaining_total', 'status'], `remaining_total > 0 AND LOWER(COALESCE(status, '')) <> ALL($1::text[])`, [['paid', 'cancelled', 'void']], 10);
    const projectsWithOpenBalance = await this.countRows(schema, 'project_financial_status', `total_expected > total_paid`);
    const estimatedMargin = await this.estimatedMargin(schema, period);
    for (const table of Object.keys(sources)) sources[table] = await this.tableExists(schema, table);

    return {
      invoicesByStatus,
      issuedInvoices,
      issuedInvoiceValue,
      paidInvoices,
      paidInvoiceValue,
      overdueInvoices,
      overdueInvoiceValue,
      receivables,
      paymentsByMonth,
      paymentsInPeriod,
      totalOutstanding: receivables,
      openFinancialDeadlines,
      upcomingRenewals,
      recurringServicesActive,
      projectFinancialStatus,
      estimatedMargin,
      topUnpaidInvoices,
      projectsWithOpenBalance,
      sources,
    };
  }

  private async teamReport(schema: string, user: AuthUser, period: Period) {
    const sources = this.emptySources(['team_members', 'team_availability', 'time_entries', 'tasks', 'projects']);
    const userId = this.userIdOrNull(user.id);
    const memberScope = this.isManager(user.role) ? 'TRUE' : `user_id = $1`;
    const memberParams = this.isManager(user.role) ? [] : [userId];
    const membersByStatus = await this.groupCount(schema, 'team_members', 'status', memberScope, memberParams);
    const availabilityDistribution = await this.groupCount(schema, 'team_members', 'availability_status', memberScope, memberParams);
    const workload = await this.workloadItems(schema, user, 100);
    const overloadedMembers = workload.filter((item: any) => item.isOverloaded).length;
    const loggedParams: unknown[] = [...memberParams];
    const timeWhere = `${memberScope.replace('user_id', 'user_id')} AND ${this.periodWhere('entry_date', loggedParams, period, 'date')}`;
    const loggedHoursByMember = await this.loggedHoursByMember(schema, user, period);
    const loggedHoursByActivityType = await this.groupSum(schema, 'time_entries', 'activity_type', 'duration_minutes', timeWhere, loggedParams);
    const timeEntriesByStatus = await this.groupCount(schema, 'time_entries', 'status', memberScope.replace('user_id', 'user_id'), memberParams);
    const activeProjectsByMember = await this.activeProjectsByMember(schema, user);
    const overdueTasksByMember = await this.overdueTasksByMember(schema, user);
    const result: Record<string, any> = {
      membersByStatus,
      availabilityDistribution,
      workloadDistribution: this.workloadDistribution(workload),
      overloadedMembers,
      loggedHoursByMember,
      loggedHoursByActivityType: Object.fromEntries(Object.entries(loggedHoursByActivityType).map(([k, v]) => [k, Number((v / 60).toFixed(2))])),
      timeEntriesByStatus,
      capacityVsLoggedHours: workload.map((item: any) => ({
        team_member_id: item.team_member_id,
        display_name: item.display_name,
        capacityHours: item.capacity_hours_per_week,
        loggedHoursThisWeek: Number((item.loggedMinutesThisWeek / 60).toFixed(2)),
        utilizationPercent: item.utilizationPercent,
      })),
      overdueTasksByMember,
      activeProjectsByMember,
      sources,
    };
    if (this.canSeeFinance(user.role)) {
      result.estimatedInternalCost = await this.estimatedInternalCost(schema, period);
    }
    for (const table of Object.keys(sources)) sources[table] = await this.tableExists(schema, table);
    return result;
  }

  private async documentsReport(schema: string, user: AuthUser, period: Period) {
    const canFinance = this.canSeeFinance(user.role);
    const visibility = canFinance
      ? 'TRUE'
      : `(visibility <> 'finance' AND COALESCE(category, '') NOT IN ('finance', 'invoice', 'receipt') AND COALESCE(entity_type, '') NOT IN ('invoice', 'payment', 'deadline', 'renewal', 'recurring_service'))`;
    const periodParams: unknown[] = [];
    const createdPeriod = this.periodWhere('created_at', periodParams, period, 'date');
    const totalDocuments = await this.countRows(schema, 'documents', visibility);
    const documentsUploadedInPeriod = await this.countRows(schema, 'documents', `${visibility} AND ${createdPeriod}`, periodParams);
    const documentsByCategory = await this.groupCount(schema, 'documents', 'category', visibility);
    const documentsByVisibility = await this.groupCount(schema, 'documents', 'visibility', visibility);
    const documentsByEntityType = await this.groupCount(schema, 'documents', 'entity_type', visibility);
    const storageUsedBytes = await this.sumRows(schema, 'documents', 'size_bytes', visibility);
    const recentUploads = await this.recentRows(schema, 'documents', ['id', 'title', 'original_filename', 'category', 'visibility', 'size_bytes', 'created_at'], visibility, [], 10);
    const archivedDocuments = await this.countRows(schema, 'documents', `${visibility} AND LOWER(COALESCE(status, '')) = 'archived'`);
    const financeDocuments = canFinance ? await this.countRows(schema, 'documents', `(visibility = 'finance' OR category IN ('finance', 'invoice', 'receipt'))`) : 0;
    return {
      totalDocuments,
      documentsUploadedInPeriod,
      documentsByCategory,
      documentsByVisibility,
      documentsByEntityType,
      storageUsedBytes,
      recentUploads,
      archivedDocuments,
      financeDocuments,
      topLinkedEntities: await this.topDocumentEntities(schema, visibility),
      sources: { documents: await this.tableExists(schema, 'documents'), document_links: await this.tableExists(schema, 'document_links') },
    };
  }

  private async operationsReport(schema: string, user: AuthUser) {
    const canFinance = this.canSeeFinance(user.role);
    const notificationTypeWhere = canFinance ? 'TRUE' : `type <> ALL($1::text[])`;
    const notificationTypeParams = canFinance ? [] : [['invoice_overdue', 'invoice_due', 'payment_received', 'renewal_due', 'recurring_due', 'financial_deadline_due']];
    const unreadNotifications = await this.countRows(schema, 'notifications', `${notificationTypeWhere} AND status = 'unread'`, notificationTypeParams);
    const urgentNotifications = await this.countRows(schema, 'notifications', `${notificationTypeWhere} AND priority = 'urgent'`, notificationTypeParams);
    const notificationsByType = await this.groupCount(schema, 'notifications', 'type', notificationTypeWhere, notificationTypeParams);
    const notificationRulesStatus = await this.groupCount(schema, 'notification_rules', 'is_enabled');
    const incompleteBriefings = await this.countRows(schema, 'briefings', `LOWER(COALESCE(status, '')) = ANY($1::text[])`, [['draft', 'sent', 'partially_completed']]);
    const missingMaterials = await this.countRows(schema, 'briefing_material_requests', `LOWER(COALESCE(status, '')) = ANY($1::text[])`, [['missing', 'requested']]);
    const overdueTasks = await this.countRows(schema, 'tasks', `due_at IS NOT NULL AND due_at < now() AND LOWER(COALESCE(status, '')) <> 'done'`);
    const blockedProjects = await this.countRows(schema, 'projects', `LOWER(COALESCE(status, '')) = 'blocked'`);
    const staleQuotes = await this.countRows(schema, 'quotes', `LOWER(COALESCE(status, '')) = 'sent' AND updated_at < now() - interval '7 days'`);
    const contractsWaitingSignature = await this.countRows(schema, 'contracts', `signature_status IN ('internal_pending', 'client_pending', 'partially_signed')`);
    const overdueContracts = await this.countRows(schema, 'contracts', `due_date < current_date AND status NOT IN ('signed', 'active', 'cancelled', 'archived')`);
    const openPaperworkDossiers = await this.countRows(schema, 'paperwork_dossiers', `status IN ('open', 'in_progress', 'waiting')`);
    const missingPaperworkItems = await this.countRows(schema, 'paperwork_items', `status = 'missing' AND is_required = true`);
    const dailyDigestAvailable = await this.countRows(schema, 'notification_digests', `digest_date = CURRENT_DATE`) > 0;
    const openRisks = [
      ...(await this.recentRows(schema, 'projects', ['id', 'name', 'status', 'due_date'], `LOWER(COALESCE(status, '')) = 'blocked'`, [], 5)).map((row) => ({ type: 'project_blocked', ...row })),
      ...(await this.recentRows(schema, 'tasks', ['id', 'title', 'status', 'due_at'], `due_at IS NOT NULL AND due_at < now() AND LOWER(COALESCE(status, '')) <> 'done'`, [], 5)).map((row) => ({ type: 'task_overdue', ...row })),
      ...(await this.recentRows(schema, 'contracts', ['id', 'title', 'status', 'signature_status', 'due_date'], `due_date < current_date AND status NOT IN ('signed', 'active', 'cancelled', 'archived')`, [], 5)).map((row) => ({ type: 'contract_overdue', ...row })),
      ...(await this.recentRows(schema, 'paperwork_dossiers', ['id', 'title', 'status', 'due_date'], `status = 'blocked' OR (due_date < current_date AND status NOT IN ('completed', 'archived'))`, [], 5)).map((row) => ({ type: 'paperwork_risk', ...row })),
    ].slice(0, 10);
    return {
      unreadNotifications,
      urgentNotifications,
      notificationsByType,
      notificationRulesStatus,
      incompleteBriefings,
      missingMaterials,
      overdueTasks,
      blockedProjects,
      staleQuotes,
      contractsWaitingSignature,
      overdueContracts,
      openPaperworkDossiers,
      missingPaperworkItems,
      openRisks,
      dailyDigestAvailable,
      sources: {
        notifications: await this.tableExists(schema, 'notifications'),
        notification_rules: await this.tableExists(schema, 'notification_rules'),
        briefings: await this.tableExists(schema, 'briefings'),
        briefing_material_requests: await this.tableExists(schema, 'briefing_material_requests'),
        tasks: await this.tableExists(schema, 'tasks'),
        projects: await this.tableExists(schema, 'projects'),
        quotes: await this.tableExists(schema, 'quotes'),
        contracts: await this.tableExists(schema, 'contracts'),
        paperwork_dossiers: await this.tableExists(schema, 'paperwork_dossiers'),
        paperwork_items: await this.tableExists(schema, 'paperwork_items'),
      },
    };
  }

  private async customersReport(schema: string, user: AuthUser) {
    const canFinance = this.canSeeFinance(user.role);
    const companiesByStatus = await this.groupCount(schema, 'companies', 'status');
    const activeCustomers = await this.countRows(schema, 'companies', `LOWER(COALESCE(status, '')) = 'active_client'`);
    const prospects = await this.countRows(schema, 'companies', `LOWER(COALESCE(status, '')) = 'prospect'`);
    const dormantCustomers = await this.countRows(schema, 'companies', `LOWER(COALESCE(status, '')) = 'dormant' OR updated_at < now() - interval '90 days'`);
    const customersWithActiveProjects = await this.countRows(schema, 'companies', `id IN (SELECT company_id FROM "${schema}".projects WHERE deleted_at IS NULL AND company_id IS NOT NULL AND LOWER(COALESCE(status, '')) <> ALL($1::text[]))`, [['delivered', 'closed']]);
    const customersWithRecurringServices = await this.countRows(schema, 'companies', `id IN (SELECT company_id FROM "${schema}".recurring_services WHERE deleted_at IS NULL AND company_id IS NOT NULL AND LOWER(COALESCE(status, '')) = 'active')`);
    const customersWithUpcomingRenewals = await this.countRows(schema, 'companies', `id IN (SELECT company_id FROM "${schema}".renewals WHERE deleted_at IS NULL AND company_id IS NOT NULL AND due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 30 AND LOWER(COALESCE(status, '')) = ANY($1::text[]))`, [['upcoming', 'reminded']]);
    const customersWithUnpaidInvoices = canFinance
      ? await this.countRows(schema, 'companies', `id IN (SELECT company_id FROM "${schema}".invoices WHERE deleted_at IS NULL AND company_id IS NOT NULL AND remaining_total > 0)`)
      : 0;
    const hasContracts = await this.tableExists(schema, 'contracts');
    const customersWithActiveContracts = hasContracts
      ? await this.countRows(schema, 'companies', `id IN (SELECT company_id FROM "${schema}".contracts WHERE deleted_at IS NULL AND company_id IS NOT NULL AND status IN ('signed', 'active'))`)
      : 0;
    const customersWithExpiringContracts = hasContracts
      ? await this.countRows(schema, 'companies', `id IN (SELECT company_id FROM "${schema}".contracts WHERE deleted_at IS NULL AND company_id IS NOT NULL AND renewal_date BETWEEN current_date AND current_date + INTERVAL '30 days')`)
      : 0;
    const upsellCandidates = await this.recentRows(
      schema,
      'companies',
      ['id', 'name', 'status', 'updated_at'],
      `(LOWER(COALESCE(status, '')) = 'dormant' OR id IN (
        SELECT company_id FROM "${schema}".projects p
        WHERE p.deleted_at IS NULL AND p.company_id IS NOT NULL AND LOWER(COALESCE(p.status, '')) IN ('delivered', 'closed')
        AND NOT EXISTS (
          SELECT 1 FROM "${schema}".recurring_services rs
          WHERE rs.deleted_at IS NULL AND rs.company_id = p.company_id AND LOWER(COALESCE(rs.status, '')) = 'active'
        )
      ))`,
      [],
      10,
    );
    return {
      companiesByStatus,
      activeCustomers,
      prospects,
      dormantCustomers,
      customersWithActiveProjects,
      customersWithRecurringServices,
      customersWithUpcomingRenewals,
      customersWithUnpaidInvoices,
      customersWithActiveContracts,
      customersWithExpiringContracts,
      upsellCandidates,
      sources: {
        companies: await this.tableExists(schema, 'companies'),
        projects: await this.tableExists(schema, 'projects'),
        recurring_services: await this.tableExists(schema, 'recurring_services'),
        renewals: await this.tableExists(schema, 'renewals'),
        invoices: canFinance && await this.tableExists(schema, 'invoices'),
        contracts: hasContracts,
      },
    };
  }

  private async targetProgress(schema: string, actuals: Record<string, number>) {
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT id, kpi_key, label, target_value, period, applies_to_role, applies_to_user_id, metadata
       FROM "${schema}".kpi_targets
       WHERE deleted_at IS NULL
       ORDER BY kpi_key ASC`,
    );
    return rows.map((row: any) => {
      const actual = Number(actuals[row.kpi_key] || 0);
      const target = Number(row.target_value || 0);
      const lowerIsBetter = ['overdue_tasks_max', 'overdue_invoices_max'].includes(row.kpi_key);
      const progressPercent = target > 0 ? Number(((actual / target) * 100).toFixed(2)) : (actual > 0 ? 100 : 0);
      let status: 'below' | 'on_track' | 'exceeded' = 'below';
      if (lowerIsBetter) status = actual <= target ? 'on_track' : 'exceeded';
      else if (progressPercent >= 100) status = 'exceeded';
      else if (progressPercent >= 75) status = 'on_track';
      return {
        id: row.id,
        kpiKey: row.kpi_key,
        label: row.label,
        actual,
        target,
        period: row.period,
        progressPercent,
        status,
        lowerIsBetter,
      };
    });
  }

  private async executiveReport(schema: string, user: AuthUser, period: Period, query: Record<string, any> = {}) {
    const [sales, projects, team, documents, operations, customers] = await Promise.all([
      this.salesReport(schema, user, period, query),
      this.projectsReport(schema, user, period),
      this.teamReport(schema, user, period),
      this.documentsReport(schema, user, period),
      this.operationsReport(schema, user),
      this.customersReport(schema, user),
    ]);
    const finance = this.canSeeFinance(user.role) ? await this.financeReport(schema, user, period) : null;
    const targets = await this.targetProgress(schema, {
      monthly_new_leads: sales.newLeadsInPeriod,
      quote_acceptance_rate: sales.quoteAcceptanceRate,
      monthly_revenue: finance?.paymentsInPeriod || 0,
      overdue_tasks_max: projects.overdueTasks,
      overdue_invoices_max: finance?.overdueInvoices || 0,
      billable_hours_monthly: Number(((team.loggedHoursByActivityType?.work || 0) + (team.loggedHoursByActivityType?.development || 0) + (team.loggedHoursByActivityType?.design || 0)).toFixed(2)),
    });
    const risks = [
      ...projects.projectRisks.map((risk: any) => ({ type: 'project', ...risk })),
      ...operations.openRisks,
      ...(finance?.topUnpaidInvoices || []).slice(0, 5).map((risk: any) => ({ type: 'finance', ...risk })),
    ].slice(0, 10);
    const envelope = await this.baseEnvelope(schema, user, period);
    return {
      ...envelope,
      permissions: {
        canViewFinance: this.canSeeFinance(user.role),
        canViewCosts: this.canSeeFinance(user.role),
        canManageReports: this.canManageReports(user.role),
      },
      sales,
      projects,
      finance,
      team,
      documents,
      operations,
      customers,
      targets,
      risks,
      sources: {
        sales: sales.sources,
        projects: projects.sources,
        finance: finance?.sources || null,
        team: team.sources,
        documents: documents.sources,
        operations: operations.sources,
        customers: customers.sources,
      },
    };
  }

  async summary(query: Record<string, any> = {}) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const period = this.getPeriod(query);
    await this.ensureSchema(schema);
    const [sales, projects, operations] = await Promise.all([
      this.salesReport(schema, user, period, query),
      this.projectsReport(schema, user, period),
      this.operationsReport(schema, user),
    ]);
    const finance = this.canSeeFinance(user.role) ? await this.financeReport(schema, user, period) : null;
    await this.logActivity(schema, user, 'report_viewed', 'summary');
    return {
      ...(await this.baseEnvelope(schema, user, period)),
      reportsAvailable: REPORT_KEYS.filter((key) => key !== 'finance' || this.canSeeFinance(user.role)),
      kpiTargetsConfigured: await this.countRows(schema, 'kpi_targets'),
      executiveRisksCount: projects.projectRisks.length + operations.openRisks.length + (finance?.topUnpaidInvoices?.length || 0),
      lastSnapshotAt: await this.lastSnapshotAt(schema),
      currentMonthRevenue: this.canSeeFinance(user.role) ? finance?.paymentsInPeriod || 0 : undefined,
      currentMonthNewLeads: sales.newLeadsInPeriod,
      currentMonthAcceptedQuotes: sales.acceptedQuotes,
      currentMonthOverdueTasks: projects.overdueTasks,
    };
  }

  async executive(query: Record<string, any> = {}) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const period = this.getPeriod(query);
    await this.ensureSchema(schema);
    const report = await this.executiveReport(schema, user, period, query);
    await this.logActivity(schema, user, 'report_viewed', 'executive', { period });
    return report;
  }

  async sales(query: Record<string, any> = {}) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const period = this.getPeriod(query);
    await this.ensureSchema(schema);
    const report = { ...(await this.baseEnvelope(schema, user, period)), sales: await this.salesReport(schema, user, period, query) };
    await this.logActivity(schema, user, 'report_viewed', 'sales', { period });
    return report;
  }

  async projects(query: Record<string, any> = {}) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const period = this.getPeriod(query);
    await this.ensureSchema(schema);
    const report = { ...(await this.baseEnvelope(schema, user, period)), projects: await this.projectsReport(schema, user, period) };
    await this.logActivity(schema, user, 'report_viewed', 'projects', { period });
    return report;
  }

  async finance(query: Record<string, any> = {}) {
    const user = this.assertFinance();
    const schema = this.getSchema();
    const period = this.getPeriod(query);
    await this.ensureSchema(schema);
    const report = { ...(await this.baseEnvelope(schema, user, period)), finance: await this.financeReport(schema, user, period) };
    await this.logActivity(schema, user, 'report_viewed', 'finance', { period });
    return report;
  }

  async team(query: Record<string, any> = {}) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const period = this.getPeriod(query);
    await this.ensureSchema(schema);
    const report = { ...(await this.baseEnvelope(schema, user, period)), team: await this.teamReport(schema, user, period) };
    await this.logActivity(schema, user, 'report_viewed', 'team', { period });
    return report;
  }

  async documents(query: Record<string, any> = {}) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const period = this.getPeriod(query);
    await this.ensureSchema(schema);
    const report = { ...(await this.baseEnvelope(schema, user, period)), documents: await this.documentsReport(schema, user, period) };
    await this.logActivity(schema, user, 'report_viewed', 'documents', { period });
    return report;
  }

  async operations(query: Record<string, any> = {}) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const period = this.getPeriod(query);
    await this.ensureSchema(schema);
    const report = { ...(await this.baseEnvelope(schema, user, period)), operations: await this.operationsReport(schema, user) };
    await this.logActivity(schema, user, 'report_viewed', 'operations', { period });
    return report;
  }

  async customers(query: Record<string, any> = {}) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const period = this.getPeriod(query);
    await this.ensureSchema(schema);
    const report = { ...(await this.baseEnvelope(schema, user, period)), customers: await this.customersReport(schema, user) };
    await this.logActivity(schema, user, 'report_viewed', 'customers', { period });
    return report;
  }

  async compare(query: Record<string, any> = {}) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const reportKey = this.normalizeReportKey(query.report_key || 'sales');
    if (reportKey === 'finance') this.assertFinance(user);
    const currentPeriod = this.getPeriod(query);
    const previous = query.compare_from && query.compare_to
      ? { dateFrom: this.normalizeDate(query.compare_from, currentPeriod.dateFrom), dateTo: this.normalizeDate(query.compare_to, currentPeriod.dateTo) }
      : this.previousPeriod(currentPeriod);
    const previousPeriod = { ...currentPeriod, dateFrom: previous.dateFrom, dateTo: previous.dateTo };
    const [current, previousReport] = await Promise.all([
      this.computeReportByKey(schema, user, reportKey, currentPeriod, query),
      this.computeReportByKey(schema, user, reportKey, previousPeriod, query),
    ]);
    await this.logActivity(schema, user, 'report_viewed', 'compare', { reportKey, currentPeriod, previousPeriod });
    return {
      reportKey,
      currentPeriod,
      previousPeriod,
      current,
      previous: previousReport,
      deltas: this.deltaNumbers(current, previousReport),
    };
  }

  private async computeReportByKey(schema: string, user: AuthUser, key: ReportKey, period: Period, query: Record<string, any>) {
    if (key === 'executive') return this.executiveReport(schema, user, period, query);
    if (key === 'sales') return this.salesReport(schema, user, period, query);
    if (key === 'projects') return this.projectsReport(schema, user, period);
    if (key === 'finance') return this.financeReport(schema, user, period);
    if (key === 'team') return this.teamReport(schema, user, period);
    if (key === 'documents') return this.documentsReport(schema, user, period);
    if (key === 'operations') return this.operationsReport(schema, user);
    return this.customersReport(schema, user);
  }

  async listTargets(query: Record<string, any> = {}): Promise<ListResult> {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".kpi_targets WHERE deleted_at IS NULL ORDER BY kpi_key ASC LIMIT $1 OFFSET $2`,
      [limit, offset],
    );
    const totalRows = await this.dataSource.query(`SELECT COUNT(*)::int AS total FROM "${schema}".kpi_targets WHERE deleted_at IS NULL`);
    return { items: rows, total: Number(totalRows[0]?.total || 0), limit, offset };
  }

  async createTarget(body: Record<string, any>) {
    const user = this.getUser();
    if (!this.canManageReports(user.role)) throw new ForbiddenException('Solo CEO/Admin possono gestire i target KPI.');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const kpiKey = String(body.kpi_key || '').trim();
    const label = String(body.label || '').trim();
    if (!kpiKey || !label) throw new BadRequestException('kpi_key e label obbligatori');
    const period = TARGET_PERIODS.includes(String(body.period || 'monthly') as any) ? String(body.period || 'monthly') : 'monthly';
    const appliesToRole = this.textOrNull(body.applies_to_role);
    const appliesToUserId = this.userIdOrNull(body.applies_to_user_id);
    const existing = await this.dataSource.query(
      `SELECT id
       FROM "${schema}".kpi_targets
       WHERE kpi_key = $1
         AND period = $2
         AND applies_to_role IS NOT DISTINCT FROM $3
         AND applies_to_user_id IS NOT DISTINCT FROM $4
         AND deleted_at IS NULL
       LIMIT 1`,
      [kpiKey, period, appliesToRole, appliesToUserId],
    );
    if (existing[0]?.id) {
      return this.updateTarget(existing[0].id, {
        label,
        target_value: Number(body.target_value || 0),
        period,
        applies_to_role: appliesToRole,
        applies_to_user_id: appliesToUserId,
        metadata: body.metadata || {},
      });
    }
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".kpi_targets (
         kpi_key, label, target_value, period, applies_to_role, applies_to_user_id, metadata, created_by, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, now(), now())
       RETURNING *`,
      [
        kpiKey,
        label,
        Number(body.target_value || 0),
        period,
        appliesToRole,
        appliesToUserId,
        JSON.stringify(body.metadata || {}),
        this.userIdOrNull(user.id),
      ],
    );
    await this.logActivity(schema, user, 'target_updated', undefined, { id: rows[0]?.id, kpiKey });
    return rows[0];
  }

  async updateTarget(id: string, body: Record<string, any>) {
    const user = this.getUser();
    if (!this.canManageReports(user.role)) throw new ForbiddenException('Solo CEO/Admin possono gestire i target KPI.');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const allowed = ['label', 'target_value', 'period', 'applies_to_role', 'applies_to_user_id', 'metadata'];
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const field of allowed) {
      if (!(field in body)) continue;
      params.push(field === 'metadata' ? JSON.stringify(body[field] || {}) : field === 'applies_to_user_id' ? this.userIdOrNull(body[field]) : body[field]);
      sets.push(`${field} = $${params.length}${field === 'metadata' ? '::jsonb' : ''}`);
    }
    if (sets.length === 0) throw new BadRequestException('Nessun campo da aggiornare');
    params.push(this.requireUuid(id));
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".kpi_targets SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} AND deleted_at IS NULL RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Target KPI non trovato');
    await this.logActivity(schema, user, 'target_updated', undefined, { id });
    return rows[0];
  }

  async deleteTarget(id: string) {
    const user = this.getUser();
    if (!this.canManageReports(user.role)) throw new ForbiddenException('Solo CEO/Admin possono gestire i target KPI.');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".kpi_targets SET deleted_at = now(), updated_at = now() WHERE id = $1`, [this.requireUuid(id)]);
    await this.logActivity(schema, user, 'target_updated', undefined, { id, deleted: true });
    return { success: true };
  }

  async listSavedViews(query: Record<string, any> = {}): Promise<ListResult> {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const params: unknown[] = [];
    const where = ['deleted_at IS NULL'];
    if (!this.canManageReports(user.role)) {
      params.push(this.userIdOrNull(user.id), user.role);
      where.push(`(visibility = 'team' OR created_by = $1 OR (visibility = 'management' AND $2 = ANY(ARRAY['owner','admin','superadmin','super_admin','manager'])))`);
    }
    if (query.report_key) {
      params.push(this.normalizeReportKey(query.report_key));
      where.push(`report_key = $${params.length}`);
    }
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".report_saved_views WHERE ${where.join(' AND ')} ORDER BY updated_at DESC NULLS LAST LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const totalRows = await this.dataSource.query(`SELECT COUNT(*)::int AS total FROM "${schema}".report_saved_views WHERE ${where.join(' AND ')}`, params);
    return { items: rows, total: Number(totalRows[0]?.total || 0), limit, offset };
  }

  async createSavedView(body: Record<string, any>) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const visibility = SAVED_VIEW_VISIBILITIES.includes(String(body.visibility || 'private') as any) ? String(body.visibility || 'private') : 'private';
    if (visibility === 'management' && !this.isManager(user.role)) throw new ForbiddenException('Solo manager o superiore possono creare viste management.');
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('Nome vista obbligatorio');
    const reportKey = this.normalizeReportKey(body.report_key || 'executive');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".report_saved_views (name, description, report_key, filters, visibility, created_by, created_at, updated_at)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, now(), now())
       RETURNING *`,
      [name, this.textOrNull(body.description), reportKey, JSON.stringify(body.filters || {}), visibility, this.userIdOrNull(user.id)],
    );
    await this.logActivity(schema, user, 'report_saved_view_created', reportKey, { id: rows[0]?.id });
    return rows[0];
  }

  async updateSavedView(id: string, body: Record<string, any>) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const existing = await this.dataSource.query(`SELECT * FROM "${schema}".report_saved_views WHERE id = $1 AND deleted_at IS NULL`, [this.requireUuid(id)]);
    if (!existing[0]) throw new NotFoundException('Vista salvata non trovata');
    if (!this.canManageReports(user.role) && existing[0].created_by !== this.userIdOrNull(user.id)) throw new ForbiddenException('Puoi modificare solo le tue viste.');
    const allowed = ['name', 'description', 'filters', 'visibility'];
    const sets: string[] = [];
    const params: unknown[] = [];
    for (const field of allowed) {
      if (!(field in body)) continue;
      params.push(field === 'filters' ? JSON.stringify(body[field] || {}) : body[field]);
      sets.push(`${field} = $${params.length}${field === 'filters' ? '::jsonb' : ''}`);
    }
    if (sets.length === 0) throw new BadRequestException('Nessun campo da aggiornare');
    params.push(id);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".report_saved_views SET ${sets.join(', ')}, updated_at = now() WHERE id = $${params.length} RETURNING *`,
      params,
    );
    await this.logActivity(schema, user, 'report_saved_view_updated', rows[0]?.report_key, { id });
    return rows[0];
  }

  async deleteSavedView(id: string) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const existing = await this.dataSource.query(`SELECT * FROM "${schema}".report_saved_views WHERE id = $1 AND deleted_at IS NULL`, [this.requireUuid(id)]);
    if (!existing[0]) throw new NotFoundException('Vista salvata non trovata');
    if (!this.canManageReports(user.role) && existing[0].created_by !== this.userIdOrNull(user.id)) throw new ForbiddenException('Puoi eliminare solo le tue viste.');
    await this.dataSource.query(`UPDATE "${schema}".report_saved_views SET deleted_at = now(), updated_at = now() WHERE id = $1`, [id]);
    return { success: true };
  }

  async listSnapshots(query: Record<string, any> = {}): Promise<ListResult> {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const params: unknown[] = [];
    const where = ['deleted_at IS NULL'];
    if (query.report_key) {
      params.push(this.normalizeReportKey(query.report_key));
      where.push(`report_key = $${params.length}`);
    }
    if (!this.canManageReports(user.role)) {
      params.push(this.userIdOrNull(user.id));
      where.push(`generated_by = $${params.length}`);
    }
    const rows = await this.dataSource.query(
      `SELECT id, report_key, title, period_from, period_to, generated_by, created_at
       FROM "${schema}".report_snapshots
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const totalRows = await this.dataSource.query(`SELECT COUNT(*)::int AS total FROM "${schema}".report_snapshots WHERE ${where.join(' AND ')}`, params);
    return { items: rows, total: Number(totalRows[0]?.total || 0), limit, offset };
  }

  async createSnapshot(body: Record<string, any>, query: Record<string, any> = {}) {
    const user = this.getUser();
    if (!this.isManager(user.role)) throw new ForbiddenException('Manager o superiore richiesto per creare snapshot.');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const reportKey = this.normalizeReportKey(body.report_key || query.report_key || 'executive');
    if (reportKey === 'finance') this.assertFinance(user);
    const period = this.getPeriod({ ...query, ...body });
    const payload = body.payload || await this.computeReportByKey(schema, user, reportKey, period, query);
    const title = String(body.title || `Snapshot ${reportKey} ${period.dateFrom} - ${period.dateTo}`).trim();
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".report_snapshots (report_key, title, period_from, period_to, generated_by, payload, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())
       RETURNING id, report_key, title, period_from, period_to, generated_by, payload, created_at`,
      [reportKey, title, period.dateFrom, period.dateTo, this.userIdOrNull(user.id), JSON.stringify(payload)],
    );
    await this.logActivity(schema, user, 'report_snapshot_created', reportKey, { id: rows[0]?.id });
    return rows[0];
  }

  async getSnapshot(id: string) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".report_snapshots WHERE id = $1 AND deleted_at IS NULL`,
      [this.requireUuid(id)],
    );
    if (!rows[0]) throw new NotFoundException('Snapshot non trovato');
    if (!this.canManageReports(user.role) && rows[0].generated_by !== this.userIdOrNull(user.id)) throw new ForbiddenException('Snapshot non accessibile.');
    return rows[0];
  }

  async deleteSnapshot(id: string) {
    const user = this.getUser();
    if (!this.canManageReports(user.role)) throw new ForbiddenException('Solo CEO/Admin possono eliminare snapshot.');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".report_snapshots SET deleted_at = now() WHERE id = $1`, [this.requireUuid(id)]);
    return { success: true };
  }

  async exportReport(reportKeyRaw: string, query: Record<string, any> = {}) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const reportKey = this.normalizeReportKey(reportKeyRaw);
    if (reportKey === 'finance') this.assertFinance(user);
    const period = this.getPeriod(query);
    const payload = await this.computeReportByKey(schema, user, reportKey, period, query);
    await this.logActivity(schema, user, 'report_viewed', reportKey, { export: true, format: query.format || 'json' });
    if (String(query.format || '').toLowerCase() === 'csv') {
      const rows = this.flattenForCsv(payload);
      return { reportKey, format: 'csv', csv: this.toCsv(rows) };
    }
    return { reportKey, format: 'json', payload };
  }

  async seedBaseTargets() {
    const user = this.getUser();
    if (!this.canManageReports(user.role)) throw new ForbiddenException('Solo CEO/Admin possono seedare i target KPI.');
    const schema = this.getSchema();
    try {
      const result = await seedTenantKpiTargets(this.dataSource, schema, this.userIdOrNull(user.id));
      return { success: true, ...result };
    } catch (error) {
      this.logger.error(
        `Seed target KPI fallito per tenant ${schema}: ${error instanceof Error ? error.message : String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Seed target KPI non completato.');
    }
  }

  private textOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private async lastSnapshotAt(schema: string): Promise<string | null> {
    const rows = await this.dataSource.query(
      `SELECT created_at FROM "${schema}".report_snapshots WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
    ).catch(() => []);
    return rows[0]?.created_at || null;
  }

  private async averageAgeDays(schema: string, table: string, column: string, where = 'TRUE', params: unknown[] = []) {
    const safeTable = this.safeIdentifier(table, 'tabella');
    const safeColumn = this.safeIdentifier(column, 'colonna');
    if (!(await this.tableExists(schema, safeTable))) return 0;
    const deleted = await this.deletedWhere(schema, safeTable);
    const rows = await this.dataSource.query(
      `SELECT COALESCE(AVG(EXTRACT(EPOCH FROM (now() - "${safeColumn}")) / 86400), 0)::numeric AS avg_days
       FROM "${schema}"."${safeTable}" WHERE (${where}) AND ${deleted}`,
      params,
    );
    return Number(Number(rows[0]?.avg_days || 0).toFixed(1));
  }

  private async workloadByProject(schema: string, user: AuthUser) {
    if (!(await this.tableExists(schema, 'tasks'))) return [];
    const rows = await this.dataSource.query(
      `SELECT p.id, p.name,
              COUNT(t.id)::int AS "openTasks",
              COUNT(t.id) FILTER (WHERE t.due_at IS NOT NULL AND t.due_at < now())::int AS "overdueTasks"
       FROM "${schema}".tasks t
       LEFT JOIN "${schema}".projects p ON p.id = t.project_id
       WHERE t.deleted_at IS NULL
         AND LOWER(COALESCE(t.status, '')) <> 'done'
         AND ($1::boolean OR t.assignee_id = $2)
       GROUP BY p.id, p.name
       ORDER BY "openTasks" DESC
       LIMIT 10`,
      [this.isManager(user.role), this.userIdOrNull(user.id)],
    );
    return rows;
  }

  private async workloadItems(schema: string, user: AuthUser, limit = 5) {
    if (!(await this.tableExists(schema, 'team_members'))) return [];
    const rows = await this.dataSource.query(
      `SELECT tm.id AS team_member_id,
              tm.display_name,
              tm.email,
              tm.operational_role,
              tm.status,
              tm.availability_status,
              COALESCE(tm.capacity_hours_per_week, CASE WHEN tm.employment_type IN ('contractor', 'external') THEN 20 ELSE 40 END)::numeric AS capacity_hours_per_week,
              COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL AND LOWER(COALESCE(t.status, '')) <> 'done')::int AS "openTasks",
              COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL AND t.due_at < now() AND LOWER(COALESCE(t.status, '')) <> 'done')::int AS "overdueTasks",
              COUNT(t.id) FILTER (WHERE t.deleted_at IS NULL AND t.due_at BETWEEN now() AND now() + interval '7 days' AND LOWER(COALESCE(t.status, '')) <> 'done')::int AS "dueSoonTasks",
              COUNT(DISTINCT pm.project_id)::int AS "activeProjects",
              COALESCE(SUM(te.duration_minutes) FILTER (WHERE te.entry_date >= date_trunc('week', CURRENT_DATE)::date AND te.deleted_at IS NULL), 0)::int AS "loggedMinutesThisWeek",
              COALESCE(SUM(te.duration_minutes) FILTER (WHERE te.entry_date >= date_trunc('month', CURRENT_DATE)::date AND te.deleted_at IS NULL), 0)::int AS "loggedMinutesThisMonth"
       FROM "${schema}".team_members tm
       LEFT JOIN "${schema}".tasks t ON t.assignee_id = tm.user_id
       LEFT JOIN "${schema}".project_members pm ON pm.user_id = tm.user_id AND pm.deleted_at IS NULL
       LEFT JOIN "${schema}".time_entries te ON te.team_member_id = tm.id AND te.deleted_at IS NULL
       WHERE tm.deleted_at IS NULL
         AND ($1::boolean OR tm.user_id = $2)
       GROUP BY tm.id
       ORDER BY "openTasks" DESC, "loggedMinutesThisWeek" DESC
       LIMIT $3`,
      [this.isManager(user.role), this.userIdOrNull(user.id), limit],
    );
    return rows.map((row: any) => {
      const capacity = Number(row.capacity_hours_per_week || 40);
      const utilizationPercent = capacity > 0 ? Math.round((Number(row.loggedMinutesThisWeek || 0) / 60 / capacity) * 100) : 0;
      return {
        ...row,
        capacity_hours_per_week: capacity,
        utilizationPercent,
        isOverloaded: utilizationPercent >= 100 || Number(row.openTasks || 0) >= 10 || Number(row.overdueTasks || 0) > 0,
        warnings: [
          Number(row.overdueTasks || 0) > 0 ? 'task_scaduti' : null,
          utilizationPercent >= 100 ? 'capacita_superata' : null,
          ['vacation', 'sick', 'unavailable'].includes(String(row.availability_status || '')) ? 'non_disponibile' : null,
        ].filter(Boolean),
      };
    });
  }

  private workloadDistribution(items: any[]) {
    return {
      low: items.filter((item) => Number(item.utilizationPercent || 0) < 50).length,
      medium: items.filter((item) => Number(item.utilizationPercent || 0) >= 50 && Number(item.utilizationPercent || 0) < 85).length,
      high: items.filter((item) => Number(item.utilizationPercent || 0) >= 85 && Number(item.utilizationPercent || 0) < 100).length,
      overloaded: items.filter((item) => item.isOverloaded).length,
    };
  }

  private async loggedHoursByMember(schema: string, user: AuthUser, period: Period) {
    if (!(await this.tableExists(schema, 'time_entries'))) return [];
    const rows = await this.dataSource.query(
      `SELECT tm.id AS team_member_id, tm.display_name, COALESCE(SUM(te.duration_minutes), 0)::int AS minutes
       FROM "${schema}".time_entries te
       JOIN "${schema}".team_members tm ON tm.id = te.team_member_id
       WHERE te.deleted_at IS NULL
         AND te.entry_date BETWEEN $1::date AND $2::date
         AND ($3::boolean OR te.user_id = $4)
       GROUP BY tm.id, tm.display_name
       ORDER BY minutes DESC`,
      [period.dateFrom, period.dateTo, this.isManager(user.role), this.userIdOrNull(user.id)],
    );
    return rows.map((row: any) => ({ ...row, hours: Number((Number(row.minutes || 0) / 60).toFixed(2)) }));
  }

  private async activeProjectsByMember(schema: string, user: AuthUser) {
    if (!(await this.tableExists(schema, 'project_members'))) return [];
    return this.dataSource.query(
      `SELECT tm.id AS team_member_id, tm.display_name, COUNT(DISTINCT pm.project_id)::int AS active_projects
       FROM "${schema}".project_members pm
       JOIN "${schema}".team_members tm ON tm.user_id = pm.user_id AND tm.deleted_at IS NULL
       JOIN "${schema}".projects p ON p.id = pm.project_id AND p.deleted_at IS NULL
       WHERE pm.deleted_at IS NULL
         AND LOWER(COALESCE(p.status, '')) <> ALL($1::text[])
         AND ($2::boolean OR tm.user_id = $3)
       GROUP BY tm.id, tm.display_name
       ORDER BY active_projects DESC`,
      [['delivered', 'closed'], this.isManager(user.role), this.userIdOrNull(user.id)],
    );
  }

  private async overdueTasksByMember(schema: string, user: AuthUser) {
    if (!(await this.tableExists(schema, 'tasks'))) return [];
    return this.dataSource.query(
      `SELECT tm.id AS team_member_id, tm.display_name, COUNT(t.id)::int AS overdue_tasks
       FROM "${schema}".tasks t
       JOIN "${schema}".team_members tm ON tm.user_id = t.assignee_id AND tm.deleted_at IS NULL
       WHERE t.deleted_at IS NULL
         AND t.due_at IS NOT NULL
         AND t.due_at < now()
         AND LOWER(COALESCE(t.status, '')) <> 'done'
         AND ($1::boolean OR t.assignee_id = $2)
       GROUP BY tm.id, tm.display_name
       ORDER BY overdue_tasks DESC`,
      [this.isManager(user.role), this.userIdOrNull(user.id)],
    );
  }

  private async estimatedInternalCost(schema: string, period: Period) {
    if (!(await this.tableExists(schema, 'time_entries')) || !(await this.tableExists(schema, 'team_members'))) return 0;
    const rows = await this.dataSource.query(
      `SELECT COALESCE(SUM((te.duration_minutes::numeric / 60) * (tm.hourly_rate_cents::numeric / 100)), 0)::numeric AS cost
       FROM "${schema}".time_entries te
       JOIN "${schema}".team_members tm ON tm.id = te.team_member_id
       WHERE te.deleted_at IS NULL
         AND tm.deleted_at IS NULL
         AND te.entry_date BETWEEN $1::date AND $2::date`,
      [period.dateFrom, period.dateTo],
    );
    return Number(Number(rows[0]?.cost || 0).toFixed(2));
  }

  private async estimatedMargin(schema: string, period: Period) {
    const revenue = await this.sumRows(schema, 'payments', 'amount', `payment_date BETWEEN $1::date AND $2::date`, [period.dateFrom, period.dateTo]);
    const cost = await this.estimatedInternalCost(schema, period);
    return Number((revenue - cost).toFixed(2));
  }

  private async topDocumentEntities(schema: string, visibilityWhere: string) {
    if (!(await this.tableExists(schema, 'documents'))) return [];
    return this.dataSource.query(
      `SELECT COALESCE(entity_type, 'none') AS entity_type, entity_id, COUNT(*)::int AS documents
       FROM "${schema}".documents
       WHERE deleted_at IS NULL AND ${visibilityWhere}
       GROUP BY COALESCE(entity_type, 'none'), entity_id
       ORDER BY documents DESC
       LIMIT 10`,
    );
  }

  private async timeSeries(schema: string, table: string, dateColumn: string, valueColumn: string, period: Period, mode: 'count' | 'sum') {
    const safeTable = this.safeIdentifier(table, 'tabella');
    const safeDateColumn = this.safeIdentifier(dateColumn, 'colonna data');
    const safeValueColumn = this.safeIdentifier(valueColumn, 'colonna valore');
    if (!(await this.tableExists(schema, safeTable))) return [];
    const expression = period.groupBy === 'quarter'
      ? `date_trunc('quarter', "${safeDateColumn}"::timestamp)`
      : `date_trunc('${period.groupBy}', "${safeDateColumn}"::timestamp)`;
    const metric = mode === 'sum' ? `COALESCE(SUM("${safeValueColumn}"), 0)::numeric` : 'COUNT(*)::int';
    const deleted = await this.deletedWhere(schema, safeTable);
    return this.dataSource.query(
      `SELECT ${expression}::date AS period, ${metric} AS value
       FROM "${schema}"."${safeTable}"
       WHERE "${safeDateColumn}"::date BETWEEN $1::date AND $2::date AND ${deleted}
       GROUP BY 1
       ORDER BY 1 ASC`,
      [period.dateFrom, period.dateTo],
    );
  }

  private flattenNumbers(value: any, prefix = '', out: Record<string, number> = {}) {
    if (!value || typeof value !== 'object') return out;
    for (const [key, item] of Object.entries(value)) {
      const nextKey = prefix ? `${prefix}.${key}` : key;
      if (typeof item === 'number' && Number.isFinite(item)) out[nextKey] = item;
      else if (item && typeof item === 'object' && !Array.isArray(item)) this.flattenNumbers(item, nextKey, out);
    }
    return out;
  }

  private deltaNumbers(current: any, previous: any) {
    const currentNumbers = this.flattenNumbers(current);
    const previousNumbers = this.flattenNumbers(previous);
    const keys = Array.from(new Set([...Object.keys(currentNumbers), ...Object.keys(previousNumbers)]));
    return Object.fromEntries(keys.map((key) => {
      const currentValue = currentNumbers[key] || 0;
      const previousValue = previousNumbers[key] || 0;
      const delta = Number((currentValue - previousValue).toFixed(2));
      const deltaPercent = previousValue !== 0 ? Number(((delta / previousValue) * 100).toFixed(2)) : null;
      return [key, { current: currentValue, previous: previousValue, delta, deltaPercent }];
    }));
  }

  private flattenForCsv(payload: any) {
    const numbers = this.flattenNumbers(payload);
    return Object.entries(numbers).map(([metric, value]) => ({ metric, value }));
  }

  private toCsv(rows: Array<Record<string, unknown>>) {
    if (rows.length === 0) return '';
    const headers = Object.keys(rows[0]);
    const escape = (value: unknown) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    return [headers.join(','), ...rows.map((row) => headers.map((header) => escape(row[header])).join(','))].join('\n');
  }
}
