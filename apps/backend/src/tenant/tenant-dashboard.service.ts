import { BadRequestException, ForbiddenException, Injectable, Inject } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { REQUEST } from '@nestjs/core';
import { SaveDashboardDto } from './dto/save-dashboard.dto';
import { safeSchema } from '../common/schema.utils';
import {
  DASHBOARD_WIDGET_MIN_PLAN,
  normalizePlan,
  planIncludes,
  PlanTier,
} from '../feature-access/dashboard-widget-access';
import { TenantEffectivePermissionsService, type TenantModuleKey } from './tenant-effective-permissions.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantDashboardService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly accessService: TenantEffectivePermissionsService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getTenantSchema(): string {
    const user = this.request.user || this.request.authUser;

    // Il JWT è più affidabile dell'header tenant: evita salvataggi su public
    // quando l'app è aperta da app.doflow.it/localhost.
    const tenantRef =
      user?.tenantId ||
      user?.tenant_id ||
      this.request.tenantId ||
      'public';

    return safeSchema(tenantRef, 'TenantDashboardService.getTenantSchema');
  }

  private getUserId(): string {
    const user = this.request.user || this.request.authUser;
    const userId = user?.sub || user?.id || user?.userId;
    if (!userId) throw new ForbiddenException('Utente non valido');
    return String(userId);
  }

  private getAuthUser(): TenantDashboardAuthUser {
    const user = this.request.user || this.request.authUser;
    if (!user) throw new ForbiddenException('Utente non valido');
    return {
      id: String(user.sub || user.id || user.userId || ''),
      email: typeof user.email === 'string' ? user.email : undefined,
      role: String(user.role || 'user').toLowerCase().trim(),
      tenantId: typeof user.tenantId === 'string' ? user.tenantId : undefined,
      tenantSlug: typeof user.tenantSlug === 'string' ? user.tenantSlug : undefined,
    };
  }

  private getDashboardAudience(role: string): DashboardAudience {
    const normalized = role.toLowerCase().trim();
    if (normalized === 'owner' || normalized === 'admin' || normalized === 'superadmin' || normalized === 'super_admin') {
      return 'executive';
    }
    if (normalized === 'manager') return 'manager';
    return 'employee';
  }

  private canViewFinance(role: string): boolean {
    const normalized = role.toLowerCase().trim();
    return normalized === 'owner' || normalized === 'admin' || normalized === 'superadmin' || normalized === 'super_admin';
  }

  private canViewInternalNotifications(role: string): boolean {
    const normalized = role.toLowerCase().trim();
    return ['owner', 'admin', 'superadmin', 'super_admin', 'manager', 'editor', 'user'].includes(normalized);
  }

  private async getTenantIdentity(schema: string): Promise<TenantDashboardTenant> {
    if (!schema || schema === 'public') {
      return { schema: 'public', identifiers: ['public'] };
    }

    const rows = await this.dataSource.query(
      `SELECT id::text, slug, schema_name
       FROM public.tenants
       WHERE schema_name = $1 OR slug = $1 OR id::text = $1
       LIMIT 1`,
      [schema],
    );

    const row = rows[0] || {};
    const identifiers = Array.from(new Set(
      [row.id, row.slug, row.schema_name, schema].filter(Boolean).map((v) => String(v)),
    ));

    return {
      id: row.id,
      slug: row.slug,
      schema: row.schema_name || schema,
      identifiers: identifiers.length > 0 ? identifiers : [schema],
    };
  }

  private async getTenantPlan(schema: string): Promise<PlanTier> {
    if (!schema || schema === 'public') return 'ENTERPRISE';

    const rows = await this.dataSource.query(
      `SELECT plan_tier AS "planTier"
       FROM public.tenants
       WHERE schema_name = $1 OR slug = $1 OR id::text = $1
       LIMIT 1`,
      [schema],
    );

    return normalizePlan(rows[0]?.planTier);
  }

  private safeTableName(table: string): string {
    const normalized = String(table || '').trim();
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(normalized)) {
      throw new BadRequestException('Nome tabella dashboard non valido');
    }
    return normalized;
  }

  private async tableExists(schema: string, table: string): Promise<boolean> {
    const safe = safeSchema(schema, 'TenantDashboardService.tableExists');
    const safeTable = this.safeTableName(table);
    const rows = await this.dataSource.query(
      `SELECT to_regclass($1) AS exists`,
      [`"${safe}"."${safeTable}"`],
    );
    return Boolean(rows[0]?.exists);
  }

  private async publicTableExists(table: string): Promise<boolean> {
    const safeTable = this.safeTableName(table);
    const rows = await this.dataSource.query(
      `SELECT to_regclass($1) AS exists`,
      [`"public"."${safeTable}"`],
    );
    return Boolean(rows[0]?.exists);
  }

  private async columnExists(schema: string, table: string, column: string): Promise<boolean> {
    const safe = safeSchema(schema, 'TenantDashboardService.columnExists');
    const safeTable = this.safeTableName(table);
    const safeColumn = this.safeTableName(column);
    const rows = await this.dataSource.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
       LIMIT 1`,
      [safe, safeTable, safeColumn],
    );
    return rows.length > 0;
  }

  private async isNumericColumn(schema: string, table: string, column: string): Promise<boolean> {
    const safe = safeSchema(schema, 'TenantDashboardService.isNumericColumn');
    const safeTable = this.safeTableName(table);
    const safeColumn = this.safeTableName(column);
    const rows = await this.dataSource.query(
      `SELECT data_type
       FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
       LIMIT 1`,
      [safe, safeTable, safeColumn],
    );
    const type = String(rows[0]?.data_type || '').toLowerCase();
    return ['integer', 'bigint', 'numeric', 'real', 'double precision', 'smallint'].includes(type);
  }

  private async countRows(schema: string, table: string, where = 'TRUE', params: unknown[] = []): Promise<number> {
    const safe = safeSchema(schema, 'TenantDashboardService.countRows');
    const safeTable = this.safeTableName(table);
    if (!(await this.tableExists(safe, safeTable))) return 0;
    const safeWhere = (await this.columnExists(safe, safeTable, 'deleted_at')) && !where.includes('deleted_at')
      ? `(${where}) AND deleted_at IS NULL`
      : where;

    const rows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${safe}"."${safeTable}" WHERE ${safeWhere}`,
      params,
    );
    return Number(rows[0]?.count || 0);
  }

  private async countPublicRows(table: string, where = 'TRUE', params: unknown[] = []): Promise<number> {
    const safeTable = this.safeTableName(table);
    if (!(await this.publicTableExists(safeTable))) return 0;

    const rows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM public."${safeTable}" WHERE ${where}`,
      params,
    );
    return Number(rows[0]?.count || 0);
  }

  private async sumRows(schema: string, table: string, column: string, where = 'TRUE', params: unknown[] = []): Promise<number> {
    const safe = safeSchema(schema, 'TenantDashboardService.sumRows');
    const safeTable = this.safeTableName(table);
    const safeColumn = this.safeTableName(column);
    if (!(await this.tableExists(safe, safeTable))) return 0;
    if (!(await this.columnExists(safe, safeTable, safeColumn))) return 0;
    if (!(await this.isNumericColumn(safe, safeTable, safeColumn))) return 0;
    const safeWhere = (await this.columnExists(safe, safeTable, 'deleted_at')) && !where.includes('deleted_at')
      ? `(${where}) AND deleted_at IS NULL`
      : where;

    const rows = await this.dataSource.query(
      `SELECT COALESCE(SUM("${safeColumn}"), 0)::numeric AS total FROM "${safe}"."${safeTable}" WHERE ${safeWhere}`,
      params,
    );
    return Number(rows[0]?.total || 0);
  }

  private async countByOptionalStatus(schema: string, table: string, statuses: string[]): Promise<number> {
    const safe = safeSchema(schema, 'TenantDashboardService.countByOptionalStatus');
    const safeTable = this.safeTableName(table);
    if (!(await this.tableExists(safe, safeTable))) return 0;
    if (!(await this.columnExists(safe, safeTable, 'status'))) return this.countRows(safe, safeTable);

    return this.countRows(
      safe,
      safeTable,
      `LOWER(COALESCE(status::text, '')) = ANY($1::text[])`,
      [statuses.map((s) => s.toLowerCase())],
    );
  }

  private async countByOptionalColumn(schema: string, table: string, column: string, values: string[]): Promise<number> {
    const safe = safeSchema(schema, 'TenantDashboardService.countByOptionalColumn');
    const safeTable = this.safeTableName(table);
    const safeColumn = this.safeTableName(column);
    if (!(await this.tableExists(safe, safeTable))) return 0;
    if (!(await this.columnExists(safe, safeTable, safeColumn))) return this.countRows(safe, safeTable);

    return this.countRows(
      safe,
      safeTable,
      `LOWER(COALESCE(${safeColumn}::text, '')) = ANY($1::text[])`,
      [values.map((s) => s.toLowerCase())],
    );
  }

  private documentVisibilityWhere(user: TenantDashboardAuthUser, alias = 'd'): string {
    if (this.canViewFinance(user.role)) return 'TRUE';
    return `(${alias}.visibility <> 'finance' AND COALESCE(${alias}.category, '') NOT IN ('finance', 'invoice', 'receipt') AND COALESCE(${alias}.entity_type, '') NOT IN ('invoice', 'payment', 'deadline', 'renewal', 'recurring_service'))`;
  }

  private async getRecentFiles(schema: string, user: TenantDashboardAuthUser): Promise<DashboardActivityItem[]> {
    const safe = safeSchema(schema, 'TenantDashboardService.getRecentFiles');
    if (await this.tableExists(safe, 'documents')) {
      const rows = await this.dataSource.query(
        `SELECT title, original_filename, category, created_at
         FROM "${safe}".documents d
         WHERE d.deleted_at IS NULL AND d.status = 'active' AND ${this.documentVisibilityWhere(user, 'd')}
         ORDER BY d.created_at DESC
         LIMIT 5`,
      );

      return rows.map((row: any) => ({
        title: row.title || row.original_filename || 'Documento caricato',
        meta: row.category ? `Documento ${row.category}` : 'Documento interno',
        createdAt: row.created_at || null,
      }));
    }

    if (!(await this.tableExists(safe, 'files'))) return [];

    const rows = await this.dataSource.query(
      `SELECT original_name, created_by, created_at
       FROM "${safe}".files
       ORDER BY created_at DESC
       LIMIT 5`,
    );

    return rows.map((row: any) => ({
      title: row.original_name || 'File caricato',
      meta: row.created_by ? `Caricato da ${row.created_by}` : 'File tenant',
      createdAt: row.created_at || null,
    }));
  }

  private async getRecentComments(schema: string): Promise<DashboardActivityItem[]> {
    const safe = safeSchema(schema, 'TenantDashboardService.getRecentComments');
    if (await this.tableExists(safe, 'project_comments')) {
      const rows = await this.dataSource.query(
        `SELECT body AS title, created_at
         FROM "${safe}".project_comments
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 5`,
      );

      return rows.map((row: any) => ({
        title: String(row.title || 'Commento recente').slice(0, 120),
        meta: 'Commento operativo',
        createdAt: row.created_at || null,
      }));
    }

    if (!(await this.tableExists(safe, 'comments'))) return [];

    const titleColumn = (await this.columnExists(safe, 'comments', 'body')) ? 'body' : 'id::text';
    const rows = await this.dataSource.query(
      `SELECT ${titleColumn} AS title, created_at
       FROM "${safe}".comments
       ORDER BY created_at DESC
       LIMIT 5`,
    );

    return rows.map((row: any) => ({
      title: String(row.title || 'Commento recente').slice(0, 120),
      meta: 'Commento operativo',
      createdAt: row.created_at || null,
    }));
  }

  private async getRecentNotifications(tenant: TenantDashboardTenant, userEmail?: string): Promise<DashboardActivityItem[]> {
    if (!(await this.publicTableExists('platform_notifications'))) return [];

    const params: unknown[] = [tenant.identifiers, userEmail || null];
    const rows = await this.dataSource.query(
      `SELECT title, message, created_at
       FROM public.platform_notifications
       WHERE (target_tenant_id IS NULL OR target_tenant_id = ANY($1::text[]))
         AND (target_user_email IS NULL OR lower(target_user_email) = lower($2))
       ORDER BY created_at DESC
       LIMIT 5`,
      params,
    );

    return rows.map((row: any) => ({
      title: row.title || 'Notifica',
      meta: row.message || 'Notifica piattaforma',
      createdAt: row.created_at || null,
    }));
  }

  private notificationVisibilityWhere(user: TenantDashboardAuthUser, startParam: number): { sql: string; params: unknown[] } {
    const financeTypes = [
      'invoice_overdue',
      'invoice_due',
      'payment_received',
      'renewal_due',
      'recurring_due',
      'financial_deadline_due',
    ];
    if (this.canViewFinance(user.role)) return { sql: 'TRUE', params: [] };

    const userUuid = UUID_RE.test(user.id) ? user.id : null;
    const params: unknown[] = [];
    const parts: string[] = [];
    if (userUuid) {
      params.push(userUuid);
      parts.push(`recipient_user_id = $${startParam}`);
    }
    if (user.role === 'manager') {
      params.push(user.role);
      parts.push(`LOWER(COALESCE(recipient_role, '')) = LOWER($${startParam + params.length - 1})`);
    }
    const targetSql = parts.length > 0 ? `(${parts.join(' OR ')})` : 'FALSE';
    params.push(financeTypes);
    return {
      sql: `${targetSql} AND type <> ALL($${startParam + params.length - 1}::text[])`,
      params,
    };
  }

  private async getRecentTenantNotifications(schema: string, user: TenantDashboardAuthUser): Promise<DashboardActivityItem[]> {
    const safe = safeSchema(schema, 'TenantDashboardService.getRecentTenantNotifications');
    if (!(await this.tableExists(safe, 'notifications'))) return [];
    if (!this.canViewInternalNotifications(user.role)) return [];
    const visibility = this.notificationVisibilityWhere(user, 1);
    const rows = await this.dataSource.query(
      `SELECT title, body, priority, created_at
       FROM "${safe}".notifications
       WHERE deleted_at IS NULL AND ${visibility.sql}
       ORDER BY created_at DESC
       LIMIT 5`,
      visibility.params,
    );
    return rows.map((row: any) => ({
      title: row.title || 'Notifica',
      meta: row.body || `Priorita ${row.priority || 'medium'}`,
      createdAt: row.created_at || null,
    }));
  }

  private async buildNotificationsSummary(schema: string, user: TenantDashboardAuthUser): Promise<DashboardNotificationsSummary> {
    const safe = safeSchema(schema, 'TenantDashboardService.buildNotificationsSummary');
    const hasNotifications = await this.tableExists(safe, 'notifications');
    const hasDigests = await this.tableExists(safe, 'notification_digests');
    if (!hasNotifications || !this.canViewInternalNotifications(user.role)) {
      return {
        unreadNotifications: 0,
        urgentNotifications: 0,
        taskOverdueNotifications: 0,
        financeNotifications: 0,
        assignedTaskNotifications: 0,
        todayDigestAvailable: false,
        sources: { notifications: hasNotifications, notificationDigests: hasDigests },
      };
    }

    const visibility = this.notificationVisibilityWhere(user, 1);
    const base = `deleted_at IS NULL AND ${visibility.sql}`;
    const params = visibility.params;
    const count = async (extra: string, extraParams: unknown[] = []) => Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${safe}".notifications WHERE ${base} AND ${extra}`,
      [...params, ...extraParams],
    ))[0]?.count || 0);
    const userUuid = UUID_RE.test(user.id) ? user.id : null;
    const financeTypes = ['invoice_overdue', 'invoice_due', 'payment_received', 'renewal_due', 'recurring_due', 'financial_deadline_due'];
    const digestRows = hasDigests ? await this.dataSource.query(
      `SELECT 1 FROM "${safe}".notification_digests
       WHERE deleted_at IS NULL AND digest_date = current_date
         AND (($1::uuid IS NOT NULL AND user_id = $1::uuid) OR LOWER(COALESCE(role, '')) = LOWER($2))
       LIMIT 1`,
      [userUuid, user.role],
    ) : [];

    return {
      unreadNotifications: await count(`status = 'unread'`),
      urgentNotifications: await count(`status = 'unread' AND priority = 'urgent'`),
      taskOverdueNotifications: await count(`status = 'unread' AND type = 'task_overdue'`),
      financeNotifications: this.canViewFinance(user.role)
        ? await count(`status = 'unread' AND type = ANY($${params.length + 1}::text[])`, [financeTypes])
        : 0,
      assignedTaskNotifications: userUuid
        ? await count(`recipient_user_id = $${params.length + 1} AND entity_type = 'task'`, [userUuid])
        : 0,
      todayDigestAvailable: digestRows.length > 0,
      sources: { notifications: hasNotifications, notificationDigests: hasDigests },
    };
  }

  private async buildDocumentsSummary(schema: string, user: TenantDashboardAuthUser): Promise<DashboardDocumentsSummary> {
    const safe = safeSchema(schema, 'TenantDashboardService.buildDocumentsSummary');
    const hasDocuments = await this.tableExists(safe, 'documents');
    if (!hasDocuments || !this.canViewInternalNotifications(user.role)) {
      return {
        totalDocuments: 0,
        recentDocuments: [],
        projectDocuments: 0,
        financeDocuments: 0,
        storageUsedBytes: 0,
        sources: { documents: hasDocuments },
      };
    }

    const visibility = this.documentVisibilityWhere(user, 'd');
    const count = async (extra = 'TRUE') => Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${safe}".documents d
       WHERE d.deleted_at IS NULL AND d.status <> 'deleted' AND ${visibility} AND ${extra}`,
    ))[0]?.count || 0);
    const recentRows = await this.dataSource.query(
      `SELECT title, original_filename, category, created_at
       FROM "${safe}".documents d
       WHERE d.deleted_at IS NULL AND d.status = 'active' AND ${visibility}
       ORDER BY d.created_at DESC
       LIMIT 5`,
    );
    const storageRows = await this.dataSource.query(
      `SELECT COALESCE(SUM(size_bytes), 0)::bigint AS bytes
       FROM "${safe}".documents d
       WHERE d.deleted_at IS NULL AND d.status <> 'deleted' AND ${visibility}`,
    );

    return {
      totalDocuments: await count(),
      recentDocuments: recentRows.map((row: any) => ({
        title: row.title || row.original_filename || 'Documento',
        meta: row.category ? `Documento ${row.category}` : 'Documento interno',
        createdAt: row.created_at || null,
      })),
      projectDocuments: await count(`(d.entity_type = 'project' OR EXISTS (
        SELECT 1 FROM "${safe}".document_links dl
        WHERE dl.document_id = d.id AND dl.entity_type = 'project' AND dl.deleted_at IS NULL
      ))`),
      financeDocuments: this.canViewFinance(user.role)
        ? await count(`(d.visibility = 'finance' OR d.category IN ('finance', 'invoice', 'receipt'))`)
        : 0,
      storageUsedBytes: Number(storageRows[0]?.bytes || 0),
      sources: { documents: hasDocuments },
    };
  }

  private async getTeamWorkload(schema: string): Promise<Array<{ assignee: string; openTasks: number }>> {
    const safe = safeSchema(schema, 'TenantDashboardService.getTeamWorkload');
    if (!(await this.tableExists(safe, 'tasks'))) return [];

    const hasStatus = await this.columnExists(safe, 'tasks', 'status');
    const hasDeletedAt = await this.columnExists(safe, 'tasks', 'deleted_at');
    const deletedPredicate = hasDeletedAt ? 't.deleted_at IS NULL AND ' : '';
    const where = hasStatus
      ? `WHERE ${deletedPredicate}LOWER(COALESCE(t.status::text, '')) NOT IN ('done', 'closed', 'resolved', 'completed')`
      : hasDeletedAt ? 'WHERE t.deleted_at IS NULL' : '';

    if (await this.columnExists(safe, 'tasks', 'assignee_id')) {
      const rows = await this.dataSource.query(
        `SELECT COALESCE(u.email, t.assignee_id::text, 'Non assegnato') AS assignee, COUNT(*)::int AS "openTasks"
         FROM "${safe}".tasks t
         LEFT JOIN "${safe}".users u ON u.id = t.assignee_id
         ${where}
         GROUP BY COALESCE(u.email, t.assignee_id::text, 'Non assegnato')
         ORDER BY "openTasks" DESC, assignee ASC
         LIMIT 8`,
      );

      return rows.map((row: any) => ({
        assignee: row.assignee,
        openTasks: Number(row.openTasks || 0),
      }));
    }

    if (!(await this.columnExists(safe, 'tasks', 'assignee_email'))) return [];
    const legacyDeletedPredicate = hasDeletedAt ? 'deleted_at IS NULL AND ' : '';
    const legacyWhere = hasStatus
      ? `WHERE ${legacyDeletedPredicate}LOWER(COALESCE(status::text, '')) NOT IN ('done', 'closed', 'resolved', 'completed')`
      : hasDeletedAt ? 'WHERE deleted_at IS NULL'
      : '';

    const rows = await this.dataSource.query(
      `SELECT COALESCE(assignee_email, 'Non assegnato') AS assignee, COUNT(*)::int AS "openTasks"
       FROM "${safe}".tasks
       ${legacyWhere}
       GROUP BY COALESCE(assignee_email, 'Non assegnato')
       ORDER BY "openTasks" DESC, assignee ASC
       LIMIT 8`,
    );

    return rows.map((row: any) => ({
      assignee: row.assignee,
      openTasks: Number(row.openTasks || 0),
    }));
  }

  private async buildSalesSummary(schema: string, includeEconomicValue: boolean): Promise<DashboardSalesSummary> {
    const opportunitiesTable = (await this.tableExists(schema, 'opportunities'))
      ? 'opportunities'
      : (await this.tableExists(schema, 'deals')) ? 'deals' : null;
    const hasQuotes = await this.tableExists(schema, 'quotes');

    const opportunitiesActive = opportunitiesTable
      ? opportunitiesTable === 'opportunities'
        ? await this.countByOptionalColumn(schema, opportunitiesTable, 'stage', [
            'new_lead', 'to_contact', 'contacted', 'call_scheduled', 'briefing_sent',
            'briefing_received', 'quote_preparation', 'quote_sent', 'follow_up',
          ])
        : await this.countByOptionalStatus(schema, opportunitiesTable, ['open', 'active', 'in_progress', 'qualified', 'proposal'])
      : 0;

    const valueColumn = opportunitiesTable && (await this.columnExists(schema, opportunitiesTable, 'value_estimate'))
      ? 'value_estimate'
      : opportunitiesTable && (await this.columnExists(schema, opportunitiesTable, 'value'))
        ? 'value'
        : opportunitiesTable && (await this.columnExists(schema, opportunitiesTable, 'amount')) ? 'amount' : null;

    return {
      openLeads: await this.countByOptionalStatus(schema, 'leads', [
        'new', 'to_contact', 'contacted', 'call_scheduled', 'briefing_sent',
        'briefing_received', 'quote_preparation', 'quote_sent', 'follow_up', 'paused',
      ]),
      activeOpportunities: opportunitiesActive,
      pipelineValue: includeEconomicValue && opportunitiesTable && valueColumn
        ? await this.sumRows(schema, opportunitiesTable, valueColumn)
        : 0,
      sentQuotes: await this.countByOptionalStatus(schema, 'quotes', ['sent', 'viewed', 'pending', 'open']),
      acceptedQuotes: await this.countByOptionalStatus(schema, 'quotes', ['accepted']),
      rejectedQuotes: await this.countByOptionalStatus(schema, 'quotes', ['rejected']),
      sentQuoteValue: includeEconomicValue && hasQuotes
        ? await this.sumRows(
            schema,
            'quotes',
            'total',
            `LOWER(COALESCE(status::text, '')) IN ('sent', 'viewed')`,
          )
        : 0,
      acceptedQuoteValue: includeEconomicValue && hasQuotes
        ? await this.sumRows(schema, 'quotes', 'total', `LOWER(COALESCE(status::text, '')) = 'accepted'`)
        : 0,
      followUpsDue: await this.countDueFollowUps(schema),
      wonDeals: opportunitiesTable
        ? opportunitiesTable === 'opportunities'
          ? await this.countByOptionalColumn(schema, opportunitiesTable, 'stage', ['accepted'])
          : await this.countByOptionalStatus(schema, opportunitiesTable, ['won'])
        : 0,
      lostDeals: opportunitiesTable
        ? opportunitiesTable === 'opportunities'
          ? await this.countByOptionalColumn(schema, opportunitiesTable, 'stage', ['lost'])
          : await this.countByOptionalStatus(schema, opportunitiesTable, ['lost'])
        : 0,
      sources: {
        leads: await this.tableExists(schema, 'leads'),
        opportunities: Boolean(opportunitiesTable),
        quotes: hasQuotes,
        followUps: await this.tableExists(schema, 'follow_ups') || await this.tableExists(schema, 'commercial_activities'),
      },
    };
  }

  private async buildBriefingOperationsSummary(schema: string): Promise<DashboardBriefingOperationsSummary> {
    const incompleteStatuses = ['draft', 'sent', 'partially_completed', 'internal_reviewed'];
    const completedStatuses = ['completed', 'approved', 'converted_to_project'];

    return {
      incompleteBriefings: await this.countByOptionalStatus(schema, 'briefings', incompleteStatuses),
      completedBriefings: await this.countByOptionalStatus(schema, 'briefings', completedStatuses),
      missingMaterials: await this.countByOptionalStatus(schema, 'briefing_material_requests', ['missing', 'requested']),
      sources: {
        briefings: await this.tableExists(schema, 'briefings'),
        briefingMaterialRequests: await this.tableExists(schema, 'briefing_material_requests'),
      },
    };
  }

  private async countRowsIfColumnExists(schema: string, table: string, column: string, where: string): Promise<number> {
    if (!(await this.tableExists(schema, table))) return 0;
    if (!(await this.columnExists(schema, table, column))) return 0;
    return this.countRows(schema, table, where);
  }

  private async countDueFollowUps(schema: string): Promise<number> {
    if (await this.tableExists(schema, 'commercial_activities')) {
      return this.countRows(
        schema,
        'commercial_activities',
        `deleted_at IS NULL AND completed_at IS NULL AND due_at <= now()`,
      );
    }

    if (!(await this.tableExists(schema, 'follow_ups'))) return 0;
    if (!(await this.columnExists(schema, 'follow_ups', 'due_at'))) return 0;

    const hasCompletedAt = await this.columnExists(schema, 'follow_ups', 'completed_at');
    return this.countRows(
      schema,
      'follow_ups',
      hasCompletedAt ? `due_at <= now() AND completed_at IS NULL` : `due_at <= now()`,
    );
  }

  private async countLateProjects(schema: string, hasProjects: boolean): Promise<number> {
    if (!hasProjects) return 0;
    if (!(await this.columnExists(schema, 'projects', 'due_date'))) return 0;

    const hasStatus = await this.columnExists(schema, 'projects', 'status');
    const where = hasStatus
      ? `due_date < current_date AND LOWER(COALESCE(status::text, '')) NOT IN ('done', 'closed', 'completed')`
      : `due_date < current_date`;

    return this.countRows(schema, 'projects', where);
  }

  private async buildProjectsSummary(schema: string, user: TenantDashboardAuthUser, audience: DashboardAudience): Promise<DashboardProjectsSummary> {
    const hasProjects = await this.tableExists(schema, 'projects');
    const hasTasks = await this.tableExists(schema, 'tasks');
    const hasMilestones = await this.tableExists(schema, 'milestones');
    const userUuid = UUID_RE.test(user.id) ? user.id : null;
    const projectScopeParts: string[] = [];
    const projectScopeParams: unknown[] = [];

    if (audience !== 'executive' && hasProjects) {
      if (userUuid && (await this.columnExists(schema, 'projects', 'project_manager_id'))) {
        projectScopeParts.push('project_manager_id = $1');
      }
      if (userUuid && (await this.tableExists(schema, 'project_members'))) {
        projectScopeParts.push(`EXISTS (
          SELECT 1 FROM "${schema}".project_members pm
          WHERE pm.project_id = projects.id AND pm.user_id = $1 AND pm.deleted_at IS NULL
        )`);
      }
      if (userUuid && hasTasks && (await this.columnExists(schema, 'tasks', 'assignee_id'))) {
        projectScopeParts.push(`EXISTS (
          SELECT 1 FROM "${schema}".tasks t
          WHERE t.project_id = projects.id AND t.assignee_id = $1 AND t.deleted_at IS NULL
        )`);
      }
      if (projectScopeParts.length > 0) projectScopeParams.push(userUuid);
    }

    const projectScopeWhere = audience === 'executive'
      ? 'TRUE'
      : projectScopeParts.length > 0
        ? `(${projectScopeParts.join(' OR ')})`
        : audience === 'manager' && user.email && hasProjects && (await this.columnExists(schema, 'projects', 'owner_email'))
          ? 'lower(owner_email) = lower($1)'
          : 'FALSE';
    const scopedProjectParams = projectScopeParts.length > 0
      ? projectScopeParams
      : projectScopeWhere.includes('$1') && user.email ? [user.email] : [];

    const taskScopeWhere = audience === 'executive'
      ? 'TRUE'
      : userUuid && hasTasks && (await this.columnExists(schema, 'tasks', 'assignee_id'))
        ? 'assignee_id = $1'
        : 'FALSE';
    const taskScopeParams = taskScopeWhere.includes('$1') ? [userUuid] as unknown[] : [];

    const activeProjectStatuses = [
      'to_start', 'kickoff', 'materials_collection', 'strategy', 'ux_ui', 'copy_content',
      'development', 'internal_review', 'client_review', 'corrections', 'seo_performance',
      'qa', 'publishing', 'training', 'maintenance', 'blocked', 'active', 'open', 'in_progress',
    ];
    const openTaskStatuses = ['todo', 'open', 'in_progress', 'review', 'backlog', 'ready', 'internal_review', 'client_review', 'blocked'];

    return {
      activeProjects: hasProjects
        ? await this.countRows(
            schema,
            'projects',
            `${projectScopeWhere} AND LOWER(COALESCE(status::text, '')) = ANY($${scopedProjectParams.length + 1}::text[])`,
            [...scopedProjectParams, activeProjectStatuses],
          )
        : 0,
      assignedProjects: hasProjects
        ? await this.countRows(schema, 'projects', projectScopeWhere, scopedProjectParams)
        : 0,
      lateProjects: hasProjects && (await this.columnExists(schema, 'projects', 'due_date'))
        ? await this.countRows(
            schema,
            'projects',
            `${projectScopeWhere} AND due_date < current_date AND LOWER(COALESCE(status::text, '')) NOT IN ('delivered', 'closed', 'done', 'completed')`,
            scopedProjectParams,
          )
        : 0,
      blockedProjects: hasProjects && (await this.columnExists(schema, 'projects', 'status'))
        ? await this.countRows(schema, 'projects', `${projectScopeWhere} AND LOWER(COALESCE(status::text, '')) = 'blocked'`, scopedProjectParams)
        : 0,
      upcomingMilestones: hasMilestones && (await this.columnExists(schema, 'milestones', 'due_date'))
        ? audience === 'executive'
          ? await this.countRows(schema, 'milestones', `due_date BETWEEN current_date AND current_date + INTERVAL '14 days'`)
          : Number((await this.dataSource.query(
              `SELECT COUNT(*)::int AS count
               FROM "${schema}".milestones m
               JOIN "${schema}".projects projects ON projects.id = m.project_id
               WHERE m.deleted_at IS NULL
                 AND projects.deleted_at IS NULL
                 AND m.due_date BETWEEN current_date AND current_date + INTERVAL '14 days'
                 AND ${projectScopeWhere}`,
              scopedProjectParams,
            ))[0]?.count || 0)
        : 0,
      upcomingDeliveries: hasProjects && (await this.columnExists(schema, 'projects', 'due_date'))
        ? await this.countRows(schema, 'projects', `${projectScopeWhere} AND due_date BETWEEN current_date AND current_date + INTERVAL '14 days'`, scopedProjectParams)
        : 0,
      blockedTasks: hasTasks && (await this.columnExists(schema, 'tasks', 'status'))
        ? await this.countRows(schema, 'tasks', `${taskScopeWhere} AND LOWER(COALESCE(status::text, '')) = 'blocked'`, taskScopeParams)
        : 0,
      dueTasks: hasTasks && (await this.columnExists(schema, 'tasks', 'due_at'))
        ? await this.countRows(
            schema,
            'tasks',
            `${taskScopeWhere} AND due_at BETWEEN now() AND now() + INTERVAL '7 days' AND LOWER(COALESCE(status::text, '')) = ANY($${taskScopeParams.length + 1}::text[])`,
            [...taskScopeParams, openTaskStatuses],
          )
        : 0,
      sources: {
        projects: hasProjects,
        tasks: hasTasks,
        milestones: hasMilestones,
      },
    };
  }

  private async buildFinanceSummary(schema: string): Promise<DashboardFinanceSummary> {
    const invoiceTable = (await this.tableExists(schema, 'invoices')) ? 'invoices' : null;
    const invoiceHasStatus = Boolean(invoiceTable && (await this.columnExists(schema, invoiceTable, 'status')));
    const unpaidInvoiceWhere = invoiceHasStatus
      ? `LOWER(COALESCE(status::text, '')) NOT IN ('paid', 'closed', 'cancelled', 'void')`
      : 'TRUE';
    const hasPayments = await this.tableExists(schema, 'payments');
    const hasDeadlines = await this.tableExists(schema, 'financial_deadlines');
    const hasProjectFinancialStatus = await this.tableExists(schema, 'project_financial_status');

    return {
      issuedInvoices: invoiceTable ? await this.countRows(schema, invoiceTable) : 0,
      receivables: invoiceTable ? await this.countByOptionalStatus(schema, invoiceTable, ['issued', 'sent', 'partially_paid', 'overdue']) : 0,
      overdueInvoices: invoiceTable && (await this.columnExists(schema, invoiceTable, 'due_date'))
        ? await this.countRows(schema, invoiceTable, `due_date < current_date AND ${unpaidInvoiceWhere}`)
        : 0,
      balanceToRequest: invoiceTable && (await this.columnExists(schema, invoiceTable, 'remaining_total'))
        ? await this.sumRows(schema, invoiceTable, 'remaining_total', unpaidInvoiceWhere)
        : 0,
      paymentsThisMonth: hasPayments
        ? await this.sumRows(
            schema,
            'payments',
            'amount',
            `LOWER(COALESCE(status::text, '')) IN ('recorded', 'confirmed')
             AND date_trunc('month', COALESCE(payment_date, created_at::date)::timestamp) = date_trunc('month', current_date::timestamp)`,
          )
        : 0,
      totalOutstanding: invoiceTable && (await this.columnExists(schema, invoiceTable, 'remaining_total'))
        ? await this.sumRows(schema, invoiceTable, 'remaining_total', unpaidInvoiceWhere)
        : 0,
      upcomingRenewals: await this.countRowsIfColumnExists(schema, 'renewals', 'due_date', `due_date BETWEEN current_date AND current_date + INTERVAL '30 days'`),
      openFinanceDeadlines: hasDeadlines
        ? await this.countByOptionalStatus(schema, 'financial_deadlines', ['open', 'overdue'])
        : 0,
      projectsWithOpenPayments: hasProjectFinancialStatus
        ? await this.countByOptionalStatus(schema, 'project_financial_status', ['not_started', 'deposit_due', 'partially_paid', 'overdue'])
        : 0,
      estimatedMargin: invoiceTable && (await this.columnExists(schema, invoiceTable, 'margin'))
        ? await this.sumRows(schema, invoiceTable, 'margin')
        : 0,
      sources: {
        invoices: Boolean(invoiceTable),
        payments: hasPayments,
        renewals: await this.tableExists(schema, 'renewals'),
        financialDeadlines: hasDeadlines,
        projectFinancialStatus: hasProjectFinancialStatus,
      },
    };
  }

  private async buildTeamSummary(schema: string, user: TenantDashboardAuthUser): Promise<DashboardTeamSummary> {
    const hasTasks = await this.tableExists(schema, 'tasks');
    const hasTeamMembers = await this.tableExists(schema, 'team_members');
    const hasTimeEntries = await this.tableExists(schema, 'time_entries');
    const taskHasStatus = hasTasks && (await this.columnExists(schema, 'tasks', 'status'));
    const openTaskWhere = taskHasStatus
      ? `LOWER(COALESCE(status::text, '')) NOT IN ('done', 'closed', 'resolved', 'completed')`
      : 'TRUE';
    const pendingInvites = await this.countRows(schema, 'invites', 'accepted_at IS NULL AND (expires_at IS NULL OR expires_at > now())');
    const workload = hasTeamMembers
      ? await this.getEnhancedTeamWorkload(schema, user)
      : await this.getTeamWorkload(schema);
    const activeTeamMembers = hasTeamMembers ? await this.countByOptionalStatus(schema, 'team_members', ['active']) : 0;
    const availableTeamMembers = hasTeamMembers ? await this.countRows(schema, 'team_members', `availability_status = 'available'`) : 0;
    const unavailableTeamMembers = hasTeamMembers ? await this.countRows(schema, 'team_members', `availability_status <> 'available'`) : 0;
    const overloadedMembers = workload.filter((item: any) => item.isOverloaded).length;
    const capacityRows = hasTeamMembers ? await this.dataSource.query(
      `SELECT COALESCE(SUM(COALESCE(capacity_hours_per_week,
        CASE WHEN employment_type IN ('contractor', 'external') THEN 20 ELSE 40 END
      )), 0)::numeric AS total
       FROM "${schema}".team_members
       WHERE deleted_at IS NULL AND status = 'active'`,
    ) : [{ total: 0 }];
    const timeRows = hasTimeEntries ? await this.dataSource.query(
      `SELECT
        COALESCE(SUM(duration_minutes) FILTER (WHERE entry_date >= date_trunc('week', current_date)::date), 0)::int AS week,
        COALESCE(SUM(duration_minutes) FILTER (WHERE entry_date >= date_trunc('month', current_date)::date), 0)::int AS month,
        COUNT(*) FILTER (WHERE status = 'submitted')::int AS pending
       FROM "${schema}".time_entries
       WHERE deleted_at IS NULL`,
    ) : [{ week: 0, month: 0, pending: 0 }];
    const costRows = hasTimeEntries && hasTeamMembers && this.canViewFinance(user.role) ? await this.dataSource.query(
      `SELECT COALESCE(SUM((te.duration_minutes::numeric / 60) * tm.hourly_rate_cents::numeric), 0)::numeric AS cents
       FROM "${schema}".time_entries te
       JOIN "${schema}".team_members tm ON tm.id = te.team_member_id
       WHERE te.deleted_at IS NULL
         AND tm.deleted_at IS NULL
         AND te.entry_date >= date_trunc('month', current_date)::date
         AND tm.hourly_rate_cents IS NOT NULL`,
    ) : [{ cents: 0 }];

    return {
      overdueTasks: hasTasks && (await this.columnExists(schema, 'tasks', 'due_at'))
        ? await this.countRows(schema, 'tasks', `due_at < now() AND ${openTaskWhere}`)
        : 0,
      openTasks: hasTasks
        ? await this.countByOptionalStatus(schema, 'tasks', ['todo', 'open', 'in_progress', 'review', 'backlog', 'ready', 'internal_review', 'client_review', 'blocked'])
        : 0,
      blockedTasks: hasTasks && (await this.columnExists(schema, 'tasks', 'status'))
        ? await this.countByOptionalStatus(schema, 'tasks', ['blocked'])
        : 0,
      workload: workload.slice(0, 5).map((item: any) => ({
        assignee: item.assignee || item.display_name || item.email || 'Team',
        openTasks: Number(item.openTasks || 0),
        ...item,
      })),
      blockedCollaborators: overloadedMembers,
      pendingInvites,
      activeUsers: await this.countRows(schema, 'users', 'COALESCE(is_active, true) = true'),
      teamMembers: hasTeamMembers ? await this.countRows(schema, 'team_members') : 0,
      activeTeamMembers,
      availableTeamMembers,
      unavailableTeamMembers,
      overloadedMembers,
      totalCapacityHours: Number(capacityRows[0]?.total || 0),
      loggedHoursThisWeek: Math.round(Number(timeRows[0]?.week || 0) / 60),
      loggedHoursThisMonth: Math.round(Number(timeRows[0]?.month || 0) / 60),
      pendingTimeEntries: Number(timeRows[0]?.pending || 0),
      overdueTasksByTeam: workload.reduce((sum: number, item: any) => sum + Number(item.overdueTasks || 0), 0),
      costEstimateThisMonth: this.canViewFinance(user.role) ? Math.round(Number(costRows[0]?.cents || 0)) : undefined,
      sources: {
        users: await this.tableExists(schema, 'users'),
        invites: await this.tableExists(schema, 'invites'),
        tasks: hasTasks,
        teamMembers: hasTeamMembers,
        timeEntries: hasTimeEntries,
      },
    };
  }

  private async getEnhancedTeamWorkload(schema: string, user: TenantDashboardAuthUser): Promise<Array<Record<string, any>>> {
    const safe = safeSchema(schema, 'TenantDashboardService.getEnhancedTeamWorkload');
    if (!(await this.tableExists(safe, 'team_members'))) return [];
    const hasTasks = await this.tableExists(safe, 'tasks');
    const hasProjectMembers = await this.tableExists(safe, 'project_members');
    const hasTimeEntries = await this.tableExists(safe, 'time_entries');
    const rows = await this.dataSource.query(
      `SELECT id, user_id, email, display_name, operational_role, status, availability_status,
              employment_type, capacity_hours_per_week
       FROM "${safe}".team_members
       WHERE deleted_at IS NULL
       ORDER BY display_name ASC
       LIMIT 100`,
    );

    const result: Array<Record<string, any>> = [];
    for (const row of rows) {
      const userId = UUID_RE.test(String(row.user_id || '')) ? row.user_id : null;
      const capacity = Number(row.capacity_hours_per_week || (['contractor', 'external'].includes(String(row.employment_type || '')) ? 20 : 40));
      const taskRows = hasTasks && userId ? await this.dataSource.query(
        `SELECT
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND lower(COALESCE(status, '')) NOT IN ('done', 'closed', 'completed'))::int AS open,
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND lower(COALESCE(status, '')) NOT IN ('done', 'closed', 'completed') AND due_at < now())::int AS overdue,
          COUNT(*) FILTER (WHERE deleted_at IS NULL AND lower(COALESCE(status, '')) NOT IN ('done', 'closed', 'completed') AND due_at BETWEEN now() AND now() + INTERVAL '7 days')::int AS soon,
          COUNT(DISTINCT project_id) FILTER (WHERE deleted_at IS NULL AND project_id IS NOT NULL)::int AS projects
         FROM "${safe}".tasks
         WHERE assignee_id = $1`,
        [userId],
      ) : [{ open: 0, overdue: 0, soon: 0, projects: 0 }];
      const projectRows = hasProjectMembers && userId ? await this.dataSource.query(
        `SELECT COUNT(DISTINCT pm.project_id)::int AS count
         FROM "${safe}".project_members pm
         JOIN "${safe}".projects p ON p.id = pm.project_id
         WHERE pm.deleted_at IS NULL AND p.deleted_at IS NULL
           AND pm.user_id = $1
           AND lower(COALESCE(p.status, '')) NOT IN ('closed', 'delivered')`,
        [userId],
      ) : [{ count: 0 }];
      const timeRows = hasTimeEntries ? await this.dataSource.query(
        `SELECT
          COALESCE(SUM(duration_minutes) FILTER (WHERE entry_date >= date_trunc('week', current_date)::date), 0)::int AS week,
          COALESCE(SUM(duration_minutes) FILTER (WHERE entry_date >= date_trunc('month', current_date)::date), 0)::int AS month
         FROM "${safe}".time_entries
         WHERE deleted_at IS NULL AND team_member_id = $1`,
        [row.id],
      ) : [{ week: 0, month: 0 }];
      const openTasks = Number(taskRows[0]?.open || 0);
      const loggedHoursThisWeek = Number(timeRows[0]?.week || 0) / 60;
      const utilizationPercent = Math.min(999, Math.round(((loggedHoursThisWeek + openTasks * 2) / Math.max(capacity, 1)) * 100));
      result.push({
        team_member_id: row.id,
        assignee: row.display_name || row.email,
        display_name: row.display_name,
        email: row.email,
        operational_role: row.operational_role,
        status: row.status,
        availability_status: row.availability_status,
        capacity_hours_per_week: capacity,
        openTasks,
        overdueTasks: Number(taskRows[0]?.overdue || 0),
        dueSoonTasks: Number(taskRows[0]?.soon || 0),
        activeProjects: Number(projectRows[0]?.count || 0) || Number(taskRows[0]?.projects || 0),
        loggedMinutesThisWeek: Number(timeRows[0]?.week || 0),
        loggedMinutesThisMonth: Number(timeRows[0]?.month || 0),
        utilizationPercent,
        isOverloaded: utilizationPercent >= 100,
      });
    }

    return result.sort((a, b) => Number(b.utilizationPercent || 0) - Number(a.utilizationPercent || 0));
  }

  private async buildCustomersSummary(schema: string, tenant: TenantDashboardTenant): Promise<DashboardCustomersSummary> {
    const customersTable = (await this.tableExists(schema, 'companies'))
      ? 'companies'
      : (await this.tableExists(schema, 'customers')) ? 'customers' : null;
    const hasSupportTickets = await this.publicTableExists('support_tickets');
    const supportHasStatus = hasSupportTickets && (await this.publicSupportTicketHasStatus());

    return {
      activeCustomers: customersTable
        ? await this.countByOptionalStatus(schema, customersTable, ['active_client', 'active', 'client', 'customer'])
        : 0,
      dormantCustomers: customersTable && (await this.columnExists(schema, customersTable, 'status'))
        ? await this.countByOptionalStatus(schema, customersTable, ['dormant', 'inactive'])
        : 0,
      openTickets: hasSupportTickets
        ? await this.countPublicRows(
            'support_tickets',
            supportHasStatus
              ? `tenant_id = ANY($1::text[]) AND LOWER(COALESCE(status::text, '')) NOT IN ('resolved', 'closed')`
              : `tenant_id = ANY($1::text[])`,
            [tenant.identifiers],
          )
        : 0,
      activeMaintenance: await this.countRowsIfColumnExists(schema, 'maintenance_contracts', 'status', `LOWER(COALESCE(status::text, '')) = 'active'`),
      upsellOpportunities: await this.countRowsIfColumnExists(schema, 'upsells', 'status', `LOWER(COALESCE(status::text, '')) IN ('open', 'identified')`),
      sources: {
        companies: customersTable === 'companies',
        customers: customersTable === 'customers',
        supportTickets: hasSupportTickets,
        maintenance: await this.tableExists(schema, 'maintenance_contracts'),
        upsells: await this.tableExists(schema, 'upsells'),
      },
    };
  }

  private async publicSupportTicketHasStatus(): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'support_tickets' AND column_name = 'status'
       LIMIT 1`,
    );
    return rows.length > 0;
  }

  private async buildPersonalSummary(schema: string, user: TenantDashboardAuthUser): Promise<DashboardPersonalSummary> {
    const email = user.email || '';
    const userUuid = UUID_RE.test(user.id) ? user.id : null;
    const hasTasks = await this.tableExists(schema, 'tasks');
    const hasProjects = await this.tableExists(schema, 'projects');
    const hasAssigneeId = hasTasks && (await this.columnExists(schema, 'tasks', 'assignee_id'));
    const hasAssigneeEmail = hasTasks && (await this.columnExists(schema, 'tasks', 'assignee_email'));
    const assignedWhere = hasAssigneeId && userUuid
      ? 'assignee_id = $1'
      : hasAssigneeEmail && email ? 'lower(assignee_email) = lower($1)' : 'FALSE';
    const assignedParams = hasAssigneeId && userUuid
      ? [userUuid] as unknown[]
      : hasAssigneeEmail && email ? [email] as unknown[] : [];
    const dueColumn = hasTasks && (await this.columnExists(schema, 'tasks', 'due_at'))
      ? 'due_at'
      : hasTasks && (await this.columnExists(schema, 'tasks', 'due_date')) ? 'due_date' : null;
    const dueStart = dueColumn === 'due_date' ? 'current_date' : 'now()';
    const dueEnd = dueColumn === 'due_date' ? `current_date + INTERVAL '7 days'` : `now() + INTERVAL '7 days'`;

    let assignedProjects = 0;
    if (hasProjects && userUuid) {
      const parts: string[] = [];
      if (await this.columnExists(schema, 'projects', 'project_manager_id')) {
        parts.push('p.project_manager_id = $1');
      }
      if (await this.tableExists(schema, 'project_members')) {
        parts.push(`EXISTS (
          SELECT 1 FROM "${schema}".project_members pm
          WHERE pm.project_id = p.id AND pm.user_id = $1 AND pm.deleted_at IS NULL
        )`);
      }
      if (hasTasks && hasAssigneeId) {
        parts.push(`EXISTS (
          SELECT 1 FROM "${schema}".tasks t
          WHERE t.project_id = p.id AND t.assignee_id = $1 AND t.deleted_at IS NULL
        )`);
      }
      if (parts.length > 0) {
        const rows = await this.dataSource.query(
          `SELECT COUNT(*)::int AS count
           FROM "${schema}".projects p
           WHERE p.deleted_at IS NULL AND (${parts.join(' OR ')})`,
          [userUuid],
        );
        assignedProjects = Number(rows[0]?.count || 0);
      }
    }

    return {
      myTasks: hasTasks ? await this.countRows(schema, 'tasks', assignedWhere, assignedParams) : 0,
      dueSoon: hasTasks && dueColumn
        ? await this.countRows(schema, 'tasks', `${assignedWhere} AND ${dueColumn} BETWEEN ${dueStart} AND ${dueEnd}`, assignedParams)
        : 0,
      blockedTasks: hasTasks && (hasAssigneeId || hasAssigneeEmail) && (await this.columnExists(schema, 'tasks', 'status'))
        ? await this.countRows(schema, 'tasks', `${assignedWhere} AND LOWER(COALESCE(status::text, '')) = 'blocked'`, assignedParams)
        : 0,
      assignedProjects,
      upcomingDeadlines: hasTasks && dueColumn
        ? await this.countRows(schema, 'tasks', `${assignedWhere} AND ${dueColumn} >= ${dueStart}`, assignedParams)
        : 0,
      sources: {
        tasks: hasTasks,
        projects: hasProjects,
      },
    };
  }

  private assertWidgetsAllowed(plan: PlanTier, widgets: Array<{ i?: string; moduleKey?: string }>) {
    const violations: Array<{ widget: string; requiredPlan: PlanTier }> = [];
    const unknown: string[] = [];

    for (const widget of widgets || []) {
      const key = String(widget.moduleKey || widget.i || '').trim();
      if (!key) {
        unknown.push('(empty)');
        continue;
      }

      const required = DASHBOARD_WIDGET_MIN_PLAN[key];
      if (!required) {
        unknown.push(key);
        continue;
      }

      if (!planIncludes(plan, required)) {
        violations.push({ widget: key, requiredPlan: required });
      }
    }

    if (unknown.length > 0) {
      throw new BadRequestException({
        error: 'UNKNOWN_DASHBOARD_WIDGET',
        widgets: unknown,
        message: 'Widget dashboard non riconosciuto.',
      });
    }

    if (violations.length > 0) {
      throw new ForbiddenException({
        error: 'DASHBOARD_WIDGET_PLAN_REQUIRED',
        currentPlan: plan,
        violations,
        message: 'Il layout contiene widget non inclusi nel piano attuale.',
      });
    }
  }

  private async buildReportsSummary(schema: string, user: TenantDashboardAuthUser): Promise<DashboardReportsSummary> {
    const safe = safeSchema(schema, 'TenantDashboardService.buildReportsSummary');
    const showFinance = this.canViewFinance(user.role);
    const now = new Date();
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)).toISOString().slice(0, 10);
    const today = now.toISOString().slice(0, 10);
    const reportsAvailable = ['executive', 'sales', 'projects', 'team', 'documents', 'operations', 'customers'];
    if (showFinance) reportsAvailable.splice(3, 0, 'finance');

    const lastSnapshotRows = await this.tableExists(safe, 'report_snapshots')
      ? await this.dataSource.query(
          `SELECT created_at FROM "${safe}".report_snapshots WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`,
        )
      : [];
    const blockedProjects = await this.countRows(safe, 'projects', `LOWER(COALESCE(status, '')) = 'blocked'`);
    const overdueTasks = await this.countRows(
      safe,
      'tasks',
      `due_at IS NOT NULL AND due_at < now() AND LOWER(COALESCE(status, '')) <> 'done'`,
    );
    const staleQuotes = await this.countRows(
      safe,
      'quotes',
      `LOWER(COALESCE(status, '')) = 'sent' AND updated_at < now() - interval '7 days'`,
    );

    return {
      kpiTargetsConfigured: await this.countRows(safe, 'kpi_targets'),
      reportsAvailable,
      executiveRisksCount: blockedProjects + overdueTasks + staleQuotes,
      lastSnapshotAt: lastSnapshotRows[0]?.created_at || null,
      currentMonthRevenue: showFinance
        ? await this.sumRows(safe, 'payments', 'amount', `payment_date::date BETWEEN $1::date AND $2::date`, [monthStart, today])
        : 0,
      currentMonthNewLeads: await this.countRows(safe, 'leads', `created_at::date BETWEEN $1::date AND $2::date`, [monthStart, today]),
      currentMonthAcceptedQuotes: await this.countRows(
        safe,
        'quotes',
        `created_at::date BETWEEN $1::date AND $2::date AND LOWER(COALESCE(status, '')) = 'accepted'`,
        [monthStart, today],
      ),
      currentMonthOverdueTasks: overdueTasks,
      sources: {
        report_snapshots: await this.tableExists(safe, 'report_snapshots'),
        kpi_targets: await this.tableExists(safe, 'kpi_targets'),
        projects: await this.tableExists(safe, 'projects'),
        tasks: await this.tableExists(safe, 'tasks'),
        quotes: await this.tableExists(safe, 'quotes'),
        leads: await this.tableExists(safe, 'leads'),
        payments: showFinance && await this.tableExists(safe, 'payments'),
      },
    };
  }

  private async buildContractsSummary(schema: string): Promise<DashboardContractsSummary> {
    const safe = safeSchema(schema, 'TenantDashboardService.buildContractsSummary');
    const hasContracts = await this.tableExists(safe, 'contracts');
    if (!hasContracts) {
      return {
        totalContracts: 0,
        draftContracts: 0,
        sentContracts: 0,
        waitingSignatureContracts: 0,
        signedContracts: 0,
        expiringContracts: 0,
        overdueContracts: 0,
        recentContracts: [],
        sources: { contracts: false },
      };
    }
    const rows = await this.dataSource.query(
      `SELECT
         COUNT(*)::int AS "totalContracts",
         COUNT(*) FILTER (WHERE status = 'draft')::int AS "draftContracts",
         COUNT(*) FILTER (WHERE status = 'sent')::int AS "sentContracts",
         COUNT(*) FILTER (WHERE signature_status IN ('internal_pending', 'client_pending', 'partially_signed'))::int AS "waitingSignatureContracts",
         COUNT(*) FILTER (WHERE status IN ('signed', 'active') OR signature_status = 'completed')::int AS "signedContracts",
         COUNT(*) FILTER (WHERE renewal_date BETWEEN current_date AND current_date + INTERVAL '30 days')::int AS "expiringContracts",
         COUNT(*) FILTER (WHERE due_date < current_date AND status NOT IN ('signed', 'active', 'cancelled', 'archived'))::int AS "overdueContracts"
       FROM "${safe}".contracts
       WHERE deleted_at IS NULL`,
    );
    const recentContracts = await this.dataSource.query(
      `SELECT title, contract_number AS meta, created_at AS "createdAt"
       FROM "${safe}".contracts
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 5`,
    );
    return { ...rows[0], recentContracts, sources: { contracts: true } };
  }

  private async buildPaperworkSummary(schema: string): Promise<DashboardPaperworkSummary> {
    const safe = safeSchema(schema, 'TenantDashboardService.buildPaperworkSummary');
    const hasDossiers = await this.tableExists(safe, 'paperwork_dossiers');
    const hasItems = await this.tableExists(safe, 'paperwork_items');
    if (!hasDossiers) {
      return {
        openDossiers: 0,
        blockedDossiers: 0,
        overdueDossiers: 0,
        missingItems: 0,
        dueSoonItems: 0,
        recentDossiers: [],
        sources: { paperwork_dossiers: false, paperwork_items: hasItems },
      };
    }
    const dossierRows = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE status IN ('open', 'in_progress', 'waiting'))::int AS "openDossiers",
         COUNT(*) FILTER (WHERE status = 'blocked')::int AS "blockedDossiers",
         COUNT(*) FILTER (WHERE due_date < current_date AND status NOT IN ('completed', 'archived'))::int AS "overdueDossiers"
       FROM "${safe}".paperwork_dossiers
       WHERE deleted_at IS NULL`,
    );
    const itemRows = hasItems
      ? await this.dataSource.query(
          `SELECT
             COUNT(*) FILTER (WHERE status = 'missing' AND is_required = true)::int AS "missingItems",
             COUNT(*) FILTER (WHERE due_date BETWEEN current_date AND current_date + INTERVAL '7 days' AND status NOT IN ('approved', 'not_applicable'))::int AS "dueSoonItems"
           FROM "${safe}".paperwork_items
           WHERE deleted_at IS NULL`,
        )
      : [{ missingItems: 0, dueSoonItems: 0 }];
    const recentDossiers = await this.dataSource.query(
      `SELECT title, dossier_type AS meta, created_at AS "createdAt"
       FROM "${safe}".paperwork_dossiers
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 5`,
    );
    return {
      ...dossierRows[0],
      ...itemRows[0],
      recentDossiers,
      sources: { paperwork_dossiers: true, paperwork_items: hasItems },
    };
  }

  private async buildAutomationsSummary(schema: string, user: TenantDashboardAuthUser): Promise<DashboardAutomationsSummary> {
    const safe = safeSchema(schema, 'TenantDashboardService.buildAutomationsSummary');
    const hasRules = await this.tableExists(safe, 'automation_rules');
    const hasRuns = await this.tableExists(safe, 'automation_runs');
    const hasActions = await this.tableExists(safe, 'automation_action_logs');
    if (!hasRules) {
      return {
        totalRules: 0,
        enabledRules: 0,
        failedRunsToday: 0,
        successfulRunsToday: 0,
        actionsToday: 0,
        lastRunAt: null,
        dueRules: 0,
        automationRisksCount: 0,
        sources: { automation_rules: false, automation_runs: hasRuns, automation_action_logs: hasActions },
      };
    }
    const financeWhere = this.canViewFinance(user.role)
      ? 'TRUE'
      : `category <> 'finance' AND trigger_type <> ALL($1::text[])`;
    const params = this.canViewFinance(user.role)
      ? []
      : [['invoice_due_soon', 'invoice_overdue', 'financial_deadline_due_soon', 'renewal_due_soon', 'recurring_service_due_soon']];
    const rules = await this.dataSource.query(
      `SELECT
         COUNT(*)::int AS "totalRules",
         COUNT(*) FILTER (WHERE is_enabled = true)::int AS "enabledRules",
         COUNT(*) FILTER (WHERE is_enabled = true AND run_mode IN ('scheduled', 'hybrid') AND (next_run_at IS NULL OR next_run_at <= now()))::int AS "dueRules"
       FROM "${safe}".automation_rules
       WHERE deleted_at IS NULL AND ${financeWhere}`,
      params,
    );
    const runs = hasRuns
      ? await this.dataSource.query(
          `SELECT
             COUNT(*) FILTER (WHERE r.status = 'failed')::int AS "failedRunsToday",
             COUNT(*) FILTER (WHERE r.status IN ('success', 'partial_success'))::int AS "successfulRunsToday",
             MAX(r.started_at) AS "lastRunAt"
           FROM "${safe}".automation_runs r
           LEFT JOIN "${safe}".automation_rules ar ON ar.id = r.rule_id
           WHERE r.started_at >= CURRENT_DATE
             AND (ar.id IS NULL OR (${this.canViewFinance(user.role) ? 'TRUE' : `ar.category <> 'finance' AND ar.trigger_type <> ALL($1::text[])`}))`,
          params,
        )
      : [{ failedRunsToday: 0, successfulRunsToday: 0, lastRunAt: null }];
    const actions = hasActions
      ? await this.dataSource.query(
          `SELECT COUNT(*)::int AS "actionsToday"
           FROM "${safe}".automation_action_logs a
           LEFT JOIN "${safe}".automation_rules ar ON ar.id = a.rule_id
           WHERE a.created_at >= CURRENT_DATE
             AND (ar.id IS NULL OR (${this.canViewFinance(user.role) ? 'TRUE' : `ar.category <> 'finance' AND ar.trigger_type <> ALL($1::text[])`}))`,
          params,
        )
      : [{ actionsToday: 0 }];
    const failedRunsToday = Number(runs[0]?.failedRunsToday || 0);
    return {
      totalRules: Number(rules[0]?.totalRules || 0),
      enabledRules: Number(rules[0]?.enabledRules || 0),
      failedRunsToday,
      successfulRunsToday: Number(runs[0]?.successfulRunsToday || 0),
      actionsToday: Number(actions[0]?.actionsToday || 0),
      lastRunAt: runs[0]?.lastRunAt || null,
      dueRules: Number(rules[0]?.dueRules || 0),
      automationRisksCount: failedRunsToday,
      sources: { automation_rules: true, automation_runs: hasRuns, automation_action_logs: hasActions },
    };
  }

  private async buildCalendarSummary(schema: string, user: TenantDashboardAuthUser): Promise<DashboardCalendarSummary> {
    const safe = safeSchema(schema, 'TenantDashboardService.buildCalendarSummary');
    const hasEvents = await this.tableExists(safe, 'calendar_events');
    const hasReminders = await this.tableExists(safe, 'calendar_event_reminders');
    if (!hasEvents) {
      return {
        eventsToday: 0,
        eventsThisWeek: 0,
        overdueEvents: 0,
        conflictsCount: 0,
        deadlinesThisWeek: 0,
        teamUnavailableToday: 0,
        nextEventAt: null,
        remindersDue: 0,
        derivedEventsCount: 0,
        sources: { calendar_events: false, calendar_event_reminders: hasReminders },
      };
    }

    const financeWhere = this.canViewFinance(user.role)
      ? 'TRUE'
      : `event_type <> ALL($1::text[])`;
    const params = this.canViewFinance(user.role)
      ? []
      : [['invoice_due', 'financial_deadline', 'renewal_due', 'recurring_service_due']];
    const deadlineTypes = [
      'task_due',
      'milestone_due',
      'project_deadline',
      'invoice_due',
      'financial_deadline',
      'renewal_due',
      'contract_due',
      'contract_expiration',
      'paperwork_due',
      'paperwork_item_due',
    ];
    const deadlineParam = params.length + 1;
    const rows = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE start_at::date = CURRENT_DATE AND status NOT IN ('cancelled', 'completed'))::int AS "eventsToday",
         COUNT(*) FILTER (WHERE start_at >= date_trunc('week', now()) AND start_at < date_trunc('week', now()) + interval '7 days' AND status <> 'cancelled')::int AS "eventsThisWeek",
         COUNT(*) FILTER (WHERE COALESCE(end_at, start_at) < now() AND status IN ('scheduled', 'tentative'))::int AS "overdueEvents",
         COUNT(*) FILTER (WHERE start_at < now() + interval '7 days' AND event_type = ANY($${deadlineParam}::text[]) AND status <> 'cancelled')::int AS "deadlinesThisWeek",
         COUNT(*) FILTER (WHERE event_type = 'unavailable' AND start_at::date <= CURRENT_DATE AND COALESCE(end_at, start_at)::date >= CURRENT_DATE AND status <> 'cancelled')::int AS "teamUnavailableToday",
         MIN(start_at) FILTER (WHERE start_at >= now() AND status NOT IN ('cancelled', 'completed')) AS "nextEventAt",
         COUNT(*) FILTER (WHERE source_type = 'derived')::int AS "derivedEventsCount"
       FROM "${safe}".calendar_events
       WHERE deleted_at IS NULL AND ${financeWhere}`,
      [...params, deadlineTypes],
    );
    const remindersDue = hasReminders
      ? Number((await this.dataSource.query(
          `SELECT COUNT(*)::int AS count
           FROM "${safe}".calendar_event_reminders r
           JOIN "${safe}".calendar_events e ON e.id = r.event_id
           WHERE r.status = 'pending'
             AND r.remind_at <= now()
             AND e.deleted_at IS NULL
             AND ${this.canViewFinance(user.role) ? 'TRUE' : `e.event_type <> ALL($1::text[])`}`,
          params,
        ))[0]?.count || 0)
      : 0;
    const conflictsCount = Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM "${safe}".calendar_events a
       JOIN "${safe}".calendar_events b
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
       WHERE a.start_at >= CURRENT_DATE
         AND a.start_at < CURRENT_DATE + interval '7 days'
         AND ${this.canViewFinance(user.role) ? 'TRUE' : `a.event_type <> ALL($1::text[])`}`,
      params,
    ))[0]?.count || 0);

    return {
      eventsToday: Number(rows[0]?.eventsToday || 0),
      eventsThisWeek: Number(rows[0]?.eventsThisWeek || 0),
      overdueEvents: Number(rows[0]?.overdueEvents || 0),
      conflictsCount,
      deadlinesThisWeek: Number(rows[0]?.deadlinesThisWeek || 0),
      teamUnavailableToday: Number(rows[0]?.teamUnavailableToday || 0),
      nextEventAt: rows[0]?.nextEventAt || null,
      remindersDue,
      derivedEventsCount: Number(rows[0]?.derivedEventsCount || 0),
      sources: { calendar_events: true, calendar_event_reminders: hasReminders },
    };
  }

  private async buildKnowledgeSummary(schema: string, user: TenantDashboardAuthUser): Promise<DashboardKnowledgeSummary> {
    const safe = safeSchema(schema, 'TenantDashboardService.buildKnowledgeSummary');
    const hasArticles = await this.tableExists(safe, 'knowledge_articles');
    const hasAssets = await this.tableExists(safe, 'asset_items');
    const hasTemplates = await this.tableExists(safe, 'operational_templates');
    const hasFavorites = await this.tableExists(safe, 'knowledge_favorites');
    if (!hasArticles && !hasAssets && !hasTemplates) {
      return {
        publishedArticles: 0,
        draftArticles: 0,
        articlesDueForReview: 0,
        totalAssets: 0,
        activeTemplates: 0,
        favoritesCount: 0,
        recentlyUpdatedCount: 0,
        systemTemplatesCount: 0,
        knowledgeRisksCount: 0,
        sources: {
          knowledge_articles: hasArticles,
          asset_items: hasAssets,
          operational_templates: hasTemplates,
          knowledge_favorites: hasFavorites,
        },
      };
    }

    const canFinance = this.canViewFinance(user.role);
    const articleFinanceWhere = canFinance
      ? 'TRUE'
      : `NOT EXISTS (
          SELECT 1 FROM "${safe}".knowledge_categories kc
          WHERE kc.id = a.category_id AND lower(kc.name) LIKE '%finance%' AND kc.deleted_at IS NULL
        )`;
    const templateFinanceWhere = canFinance ? 'TRUE' : `ot.category <> 'finance'`;
    const articles = hasArticles
      ? await this.dataSource.query(
          `SELECT
             COUNT(*) FILTER (WHERE a.status = 'published')::int AS "publishedArticles",
             COUNT(*) FILTER (WHERE a.status = 'draft')::int AS "draftArticles",
             COUNT(*) FILTER (WHERE a.review_due_at IS NOT NULL AND a.review_due_at <= now() AND a.status <> 'archived')::int AS "articlesDueForReview",
             COUNT(*) FILTER (WHERE a.updated_at >= now() - interval '14 days')::int AS "recentlyUpdatedCount"
           FROM "${safe}".knowledge_articles a
           WHERE a.deleted_at IS NULL
             AND a.visibility <> 'private'
             AND ${canFinance ? 'TRUE' : `a.visibility <> 'admin'`}
             AND ${articleFinanceWhere}`,
        )
      : [{ publishedArticles: 0, draftArticles: 0, articlesDueForReview: 0, recentlyUpdatedCount: 0 }];
    const assets = hasAssets
      ? await this.dataSource.query(
          `SELECT COUNT(*)::int AS "totalAssets"
           FROM "${safe}".asset_items ai
           WHERE ai.deleted_at IS NULL
             AND ai.visibility <> 'private'
             AND ${canFinance ? 'TRUE' : `ai.visibility <> 'admin' AND COALESCE(ai.asset_type, '') <> 'legal_document'`}`,
        )
      : [{ totalAssets: 0 }];
    const templates = hasTemplates
      ? await this.dataSource.query(
          `SELECT
             COUNT(*) FILTER (WHERE ot.status = 'active')::int AS "activeTemplates",
             COUNT(*) FILTER (WHERE ot.is_system = true)::int AS "systemTemplatesCount"
           FROM "${safe}".operational_templates ot
           WHERE ot.deleted_at IS NULL
             AND ot.visibility <> 'private'
             AND ${canFinance ? 'TRUE' : `ot.visibility <> 'admin' AND ${templateFinanceWhere}`}`,
        )
      : [{ activeTemplates: 0, systemTemplatesCount: 0 }];
    const userId = UUID_RE.test(user.id) ? user.id : null;
    const favoritesCount = hasFavorites && userId
      ? Number((await this.dataSource.query(`SELECT COUNT(*)::int AS count FROM "${safe}".knowledge_favorites WHERE user_id = $1`, [userId]))[0]?.count || 0)
      : 0;
    const articlesDueForReview = Number(articles[0]?.articlesDueForReview || 0);
    return {
      publishedArticles: Number(articles[0]?.publishedArticles || 0),
      draftArticles: Number(articles[0]?.draftArticles || 0),
      articlesDueForReview,
      totalAssets: Number(assets[0]?.totalAssets || 0),
      activeTemplates: Number(templates[0]?.activeTemplates || 0),
      favoritesCount,
      recentlyUpdatedCount: Number(articles[0]?.recentlyUpdatedCount || 0),
      systemTemplatesCount: Number(templates[0]?.systemTemplatesCount || 0),
      knowledgeRisksCount: articlesDueForReview,
      sources: {
        knowledge_articles: hasArticles,
        asset_items: hasAssets,
        operational_templates: hasTemplates,
        knowledge_favorites: hasFavorites,
      },
    };
  }

  private async buildCredentialsSummary(schema: string, user: TenantDashboardAuthUser): Promise<DashboardCredentialsSummary> {
    const safe = safeSchema(schema, 'TenantDashboardService.buildCredentialsSummary');
    const hasCredentials = await this.tableExists(safe, 'credential_items');
    if (!hasCredentials) {
      return {
        totalCredentials: 0,
        activeCredentials: 0,
        expiringCredentials: 0,
        renewalsDue: 0,
        rotationDue: 0,
        expiredCredentials: 0,
        sources: { credential_items: false },
      };
    }
    const userId = UUID_RE.test(user.id) ? user.id : null;
    const canAdmin = this.canViewFinance(user.role);
    const visibilitySql = canAdmin
      ? 'TRUE'
      : userId
        ? `EXISTS (
             SELECT 1 FROM "${safe}".credential_permissions cp
             WHERE cp.credential_item_id = ci.id
               AND cp.user_id = $1
               AND cp.can_view_metadata = true
               AND cp.deleted_at IS NULL
           )`
        : 'FALSE';
    const params = canAdmin || !userId ? [] : [userId];
    const counts = await this.dataSource.query(
      `SELECT
         COUNT(*)::int AS "totalCredentials",
         COUNT(*) FILTER (WHERE ci.status = 'active')::int AS "activeCredentials",
         COUNT(*) FILTER (WHERE ci.expires_at IS NOT NULL AND ci.expires_at <= now() + interval '30 days' AND ci.expires_at >= now())::int AS "expiringCredentials",
         COUNT(*) FILTER (WHERE ci.renewal_at IS NOT NULL AND ci.renewal_at <= now() + interval '30 days')::int AS "renewalsDue",
         COUNT(*) FILTER (WHERE ci.rotation_due_at IS NOT NULL AND ci.rotation_due_at <= now() + interval '30 days')::int AS "rotationDue",
         COUNT(*) FILTER (WHERE ci.expires_at IS NOT NULL AND ci.expires_at < now())::int AS "expiredCredentials"
       FROM "${safe}".credential_items ci
       WHERE ci.deleted_at IS NULL AND ${visibilitySql}`,
      params,
    );
    return {
      totalCredentials: Number(counts[0]?.totalCredentials || 0),
      activeCredentials: Number(counts[0]?.activeCredentials || 0),
      expiringCredentials: Number(counts[0]?.expiringCredentials || 0),
      renewalsDue: Number(counts[0]?.renewalsDue || 0),
      rotationDue: Number(counts[0]?.rotationDue || 0),
      expiredCredentials: Number(counts[0]?.expiredCredentials || 0),
      sources: { credential_items: true },
    };
  }

  async getSummary(): Promise<TenantDashboardSummary> {
    const schema = this.getTenantSchema();
    const user = this.getAuthUser();
    const access = await this.accessService.getCurrentAccess();
    const audience = access.audience;
    const can = (moduleKey: TenantModuleKey) => Boolean(access.modules[moduleKey]?.can_view);
    const tenant = await this.getTenantIdentity(schema);
    const showFinance = this.canViewFinance(user.role) && can('finance');

    const [
      sales,
      projects,
      team,
      customers,
      personal,
      recentFiles,
      recentComments,
      platformNotifications,
      tenantNotifications,
      notificationSummary,
      documentsSummary,
      briefingOperations,
      reportsSummary,
      contractsSummary,
      paperworkSummary,
      automationsSummary,
      calendarSummary,
      knowledgeSummary,
      credentialsSummary,
    ] = await Promise.all([
      can('crm') ? this.buildSalesSummary(schema, showFinance) : Promise.resolve(null),
      can('projects') ? this.buildProjectsSummary(schema, user, audience) : Promise.resolve(null),
      can('team') ? this.buildTeamSummary(schema, user) : Promise.resolve(null),
      can('crm') ? this.buildCustomersSummary(schema, tenant) : Promise.resolve(null),
      this.buildPersonalSummary(schema, user),
      can('documents') ? this.getRecentFiles(schema, user) : Promise.resolve([]),
      can('projects') ? this.getRecentComments(schema) : Promise.resolve([]),
      can('notifications') ? this.getRecentNotifications(tenant, user.email) : Promise.resolve([]),
      can('notifications') ? this.getRecentTenantNotifications(schema, user) : Promise.resolve([]),
      can('notifications') ? this.buildNotificationsSummary(schema, user) : Promise.resolve(null),
      can('documents') ? this.buildDocumentsSummary(schema, user) : Promise.resolve(null),
      can('briefing') ? this.buildBriefingOperationsSummary(schema) : Promise.resolve(null),
      can('reports') ? this.buildReportsSummary(schema, user) : Promise.resolve(null),
      can('contracts') ? this.buildContractsSummary(schema) : Promise.resolve(null),
      can('paperwork') ? this.buildPaperworkSummary(schema) : Promise.resolve(null),
      can('automations') ? this.buildAutomationsSummary(schema, user) : Promise.resolve(null),
      can('calendar') ? this.buildCalendarSummary(schema, user) : Promise.resolve(null),
      can('knowledge') ? this.buildKnowledgeSummary(schema, user) : Promise.resolve(null),
      can('credentials') ? this.buildCredentialsSummary(schema, user) : Promise.resolve(null),
    ]);

    const finance = showFinance
      ? await this.buildFinanceSummary(schema)
      : null;

    return {
      tenant: {
        id: tenant.id,
        slug: tenant.slug,
        schema: tenant.schema,
      },
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        dashboardAudience: audience,
        canViewFinance: showFinance,
      },
      generatedAt: new Date().toISOString(),
      sales,
      projects,
      finance,
      team,
      customers,
      personal,
      operations: {
        missingMaterials: briefingOperations?.missingMaterials || 0,
        incompleteBriefings: briefingOperations?.incompleteBriefings || 0,
        completedBriefings: briefingOperations?.completedBriefings || 0,
        upcomingDeliveries: projects?.upcomingDeliveries || 0,
        unreadNotifications: notificationSummary?.unreadNotifications || 0,
        urgentNotifications: notificationSummary?.urgentNotifications || 0,
        taskOverdueNotifications: notificationSummary?.taskOverdueNotifications || 0,
        financeNotifications: notificationSummary?.financeNotifications || 0,
        assignedTaskNotifications: notificationSummary?.assignedTaskNotifications || 0,
        todayDigestAvailable: notificationSummary?.todayDigestAvailable || false,
        recentComments,
        recentFiles,
        notifications: tenantNotifications.length > 0 ? tenantNotifications : platformNotifications,
        documentsSummary,
        reportsSummary,
        contractsSummary,
        paperworkSummary,
        automationsSummary,
        calendarSummary,
        knowledgeSummary,
        credentialsSummary,
        sources: {
          ...(briefingOperations?.sources || {}),
          ...(notificationSummary?.sources || {}),
          ...(documentsSummary?.sources || {}),
          ...(reportsSummary?.sources || {}),
          ...(contractsSummary?.sources || {}),
          ...(paperworkSummary?.sources || {}),
          ...(automationsSummary?.sources || {}),
          ...(calendarSummary?.sources || {}),
          ...(knowledgeSummary?.sources || {}),
          ...(credentialsSummary?.sources || {}),
        },
      },
    };
  }

  async getLayout() {
    const schema = this.getTenantSchema();
    const userId = this.getUserId();
    const plan = await this.getTenantPlan(schema);

    const widgets = await this.dataSource.query(
      `SELECT
         module_key AS "moduleKey",
         module_key AS i,
         x,
         y,
         w,
         h
       FROM "${schema}".dashboard_widgets
       WHERE user_id = $1
       ORDER BY y ASC, x ASC`,
      [userId],
    );

    // Non mostrare vecchi widget diventati illegali dopo downgrade piano.
    return widgets.filter((w: any) => {
      const required = DASHBOARD_WIDGET_MIN_PLAN[w.moduleKey || w.i];
      return required ? planIncludes(plan, required) : false;
    });
  }

  async saveLayout(dto: SaveDashboardDto) {
    const schema = this.getTenantSchema();
    const userId = this.getUserId();
    const widgets = dto.widgets || [];
    const plan = await this.getTenantPlan(schema);

    this.assertWidgetsAllowed(plan, widgets);

    const queryRunner = this.dataSource.createQueryRunner();

    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.query(
        `DELETE FROM "${schema}".dashboard_widgets WHERE user_id = $1`,
        [userId],
      );

      if (widgets.length > 0) {
        const placeholders = widgets
          .map((_, i) => {
            const base = i * 6;
            return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6})`;
          })
          .join(', ');

        const params = widgets.flatMap((w) => [
          userId,
          w.moduleKey || w.i,
          w.x,
          w.y,
          w.w,
          w.h,
        ]);

        await queryRunner.query(
          `INSERT INTO "${schema}".dashboard_widgets
             (user_id, module_key, x, y, w, h)
           VALUES ${placeholders}`,
          params,
        );
      }

      await queryRunner.commitTransaction();
      return { success: true };

    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }
}

type DashboardAudience = 'executive' | 'manager' | 'employee';

interface TenantDashboardAuthUser {
  id: string;
  email?: string;
  role: string;
  tenantId?: string;
  tenantSlug?: string;
}

interface TenantDashboardTenant {
  id?: string;
  slug?: string;
  schema: string;
  identifiers: string[];
}

interface DashboardSourceFlags {
  [key: string]: boolean;
}

interface DashboardSalesSummary {
  openLeads: number;
  activeOpportunities: number;
  pipelineValue: number;
  sentQuotes: number;
  acceptedQuotes: number;
  rejectedQuotes: number;
  sentQuoteValue: number;
  acceptedQuoteValue: number;
  followUpsDue: number;
  wonDeals: number;
  lostDeals: number;
  sources: DashboardSourceFlags;
}

interface DashboardProjectsSummary {
  activeProjects: number;
  assignedProjects: number;
  lateProjects: number;
  blockedProjects: number;
  upcomingMilestones: number;
  upcomingDeliveries: number;
  blockedTasks: number;
  dueTasks: number;
  sources: DashboardSourceFlags;
}

interface DashboardFinanceSummary {
  issuedInvoices: number;
  receivables: number;
  overdueInvoices: number;
  balanceToRequest: number;
  paymentsThisMonth: number;
  totalOutstanding: number;
  upcomingRenewals: number;
  openFinanceDeadlines: number;
  projectsWithOpenPayments: number;
  estimatedMargin: number;
  sources: DashboardSourceFlags;
}

interface DashboardTeamSummary {
  overdueTasks: number;
  openTasks: number;
  blockedTasks: number;
  workload: Array<Record<string, any> & { assignee: string; openTasks: number }>;
  blockedCollaborators: number;
  pendingInvites: number;
  activeUsers: number;
  teamMembers?: number;
  activeTeamMembers?: number;
  availableTeamMembers?: number;
  unavailableTeamMembers?: number;
  overloadedMembers?: number;
  totalCapacityHours?: number;
  loggedHoursThisWeek?: number;
  loggedHoursThisMonth?: number;
  pendingTimeEntries?: number;
  overdueTasksByTeam?: number;
  costEstimateThisMonth?: number;
  sources: DashboardSourceFlags;
}

interface DashboardCustomersSummary {
  activeCustomers: number;
  dormantCustomers: number;
  openTickets: number;
  activeMaintenance: number;
  upsellOpportunities: number;
  sources: DashboardSourceFlags;
}

interface DashboardPersonalSummary {
  myTasks: number;
  dueSoon: number;
  blockedTasks: number;
  assignedProjects: number;
  upcomingDeadlines: number;
  sources: DashboardSourceFlags;
}

interface DashboardActivityItem {
  title: string;
  meta: string;
  createdAt: string | null;
}

interface DashboardBriefingOperationsSummary {
  incompleteBriefings: number;
  completedBriefings: number;
  missingMaterials: number;
  sources: DashboardSourceFlags;
}

interface DashboardNotificationsSummary {
  unreadNotifications: number;
  urgentNotifications: number;
  taskOverdueNotifications: number;
  financeNotifications: number;
  assignedTaskNotifications: number;
  todayDigestAvailable: boolean;
  sources: DashboardSourceFlags;
}

interface DashboardDocumentsSummary {
  totalDocuments: number;
  recentDocuments: DashboardActivityItem[];
  projectDocuments: number;
  financeDocuments: number;
  storageUsedBytes: number;
  sources: DashboardSourceFlags;
}

interface DashboardReportsSummary {
  kpiTargetsConfigured: number;
  reportsAvailable: string[];
  executiveRisksCount: number;
  lastSnapshotAt: string | null;
  currentMonthRevenue: number;
  currentMonthNewLeads: number;
  currentMonthAcceptedQuotes: number;
  currentMonthOverdueTasks: number;
  sources: DashboardSourceFlags;
}

interface DashboardContractsSummary {
  totalContracts: number;
  draftContracts: number;
  sentContracts: number;
  waitingSignatureContracts: number;
  signedContracts: number;
  expiringContracts: number;
  overdueContracts: number;
  recentContracts: DashboardActivityItem[];
  sources: DashboardSourceFlags;
}

interface DashboardPaperworkSummary {
  openDossiers: number;
  blockedDossiers: number;
  overdueDossiers: number;
  missingItems: number;
  dueSoonItems: number;
  recentDossiers: DashboardActivityItem[];
  sources: DashboardSourceFlags;
}

interface DashboardAutomationsSummary {
  totalRules: number;
  enabledRules: number;
  failedRunsToday: number;
  successfulRunsToday: number;
  actionsToday: number;
  lastRunAt: string | null;
  dueRules: number;
  automationRisksCount: number;
  sources: DashboardSourceFlags;
}

interface DashboardCalendarSummary {
  eventsToday: number;
  eventsThisWeek: number;
  overdueEvents: number;
  conflictsCount: number;
  deadlinesThisWeek: number;
  teamUnavailableToday: number;
  nextEventAt: string | null;
  remindersDue: number;
  derivedEventsCount: number;
  sources: DashboardSourceFlags;
}

interface DashboardKnowledgeSummary {
  publishedArticles: number;
  draftArticles: number;
  articlesDueForReview: number;
  totalAssets: number;
  activeTemplates: number;
  favoritesCount: number;
  recentlyUpdatedCount: number;
  systemTemplatesCount: number;
  knowledgeRisksCount: number;
  sources: DashboardSourceFlags;
}

interface DashboardCredentialsSummary {
  totalCredentials: number;
  activeCredentials: number;
  expiringCredentials: number;
  renewalsDue: number;
  rotationDue: number;
  expiredCredentials: number;
  sources: DashboardSourceFlags;
}

interface TenantDashboardSummary {
  tenant: {
    id?: string;
    slug?: string;
    schema: string;
  };
  user: {
    id: string;
    email?: string;
    role: string;
    dashboardAudience: DashboardAudience;
    canViewFinance: boolean;
  };
  generatedAt: string;
  sales: DashboardSalesSummary | null;
  projects: DashboardProjectsSummary | null;
  finance: DashboardFinanceSummary | null;
  team: DashboardTeamSummary | null;
  customers: DashboardCustomersSummary | null;
  personal: DashboardPersonalSummary;
  operations: {
    missingMaterials: number;
    incompleteBriefings: number;
    completedBriefings: number;
    upcomingDeliveries: number;
    unreadNotifications: number;
    urgentNotifications: number;
    taskOverdueNotifications: number;
    financeNotifications: number;
    assignedTaskNotifications: number;
    todayDigestAvailable: boolean;
    recentComments: DashboardActivityItem[];
    recentFiles: DashboardActivityItem[];
    notifications: DashboardActivityItem[];
    documentsSummary: DashboardDocumentsSummary | null;
    reportsSummary: DashboardReportsSummary | null;
    contractsSummary: DashboardContractsSummary | null;
    paperworkSummary: DashboardPaperworkSummary | null;
    automationsSummary: DashboardAutomationsSummary | null;
    calendarSummary: DashboardCalendarSummary | null;
    knowledgeSummary: DashboardKnowledgeSummary | null;
    credentialsSummary: DashboardCredentialsSummary | null;
    sources: DashboardSourceFlags;
  };
}
