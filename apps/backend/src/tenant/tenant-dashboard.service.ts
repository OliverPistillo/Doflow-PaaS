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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class TenantDashboardService {
  constructor(
    private readonly dataSource: DataSource,
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

  private async getRecentFiles(schema: string): Promise<DashboardActivityItem[]> {
    const safe = safeSchema(schema, 'TenantDashboardService.getRecentFiles');
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

  private async buildClientPortalOperationsSummary(schema: string, includeClientPortal: boolean): Promise<DashboardClientPortalOperationsSummary> {
    if (!includeClientPortal) {
      return {
        pendingClientApprovals: 0,
        clientMaterialsRequested: 0,
        recentClientComments: 0,
        pendingClientInvites: 0,
        sources: {
          clientPortalAccounts: await this.tableExists(schema, 'client_portal_accounts'),
          clientApprovalRequests: await this.tableExists(schema, 'client_approval_requests'),
          clientMaterialRequests: await this.tableExists(schema, 'client_material_requests'),
          clientPortalComments: await this.tableExists(schema, 'client_portal_comments'),
          clientPortalInvites: await this.tableExists(schema, 'client_portal_invites'),
        },
      };
    }

    return {
      pendingClientApprovals: await this.countByOptionalStatus(schema, 'client_approval_requests', ['pending']),
      clientMaterialsRequested: await this.countByOptionalStatus(schema, 'client_material_requests', ['requested']),
      recentClientComments: await this.countRows(
        schema,
        'client_portal_comments',
        `created_at >= now() - INTERVAL '14 days' AND LOWER(COALESCE(visibility::text, '')) IN ('client', 'internal_response')`,
      ),
      pendingClientInvites: await this.countRows(
        schema,
        'client_portal_invites',
        `LOWER(COALESCE(status::text, '')) = 'pending' AND expires_at > now()`,
      ),
      sources: {
        clientPortalAccounts: await this.tableExists(schema, 'client_portal_accounts'),
        clientApprovalRequests: await this.tableExists(schema, 'client_approval_requests'),
        clientMaterialRequests: await this.tableExists(schema, 'client_material_requests'),
        clientPortalComments: await this.tableExists(schema, 'client_portal_comments'),
        clientPortalInvites: await this.tableExists(schema, 'client_portal_invites'),
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

  private async buildTeamSummary(schema: string): Promise<DashboardTeamSummary> {
    const hasTasks = await this.tableExists(schema, 'tasks');
    const taskHasStatus = hasTasks && (await this.columnExists(schema, 'tasks', 'status'));
    const openTaskWhere = taskHasStatus
      ? `LOWER(COALESCE(status::text, '')) NOT IN ('done', 'closed', 'resolved', 'completed')`
      : 'TRUE';
    const pendingInvites = await this.countRows(schema, 'invites', 'accepted_at IS NULL AND (expires_at IS NULL OR expires_at > now())');

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
      workload: await this.getTeamWorkload(schema),
      blockedCollaborators: 0,
      pendingInvites,
      activeUsers: await this.countRows(schema, 'users', 'COALESCE(is_active, true) = true'),
      sources: {
        users: await this.tableExists(schema, 'users'),
        invites: await this.tableExists(schema, 'invites'),
        tasks: hasTasks,
      },
    };
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

  async getSummary(): Promise<TenantDashboardSummary> {
    const schema = this.getTenantSchema();
    const user = this.getAuthUser();
    const audience = this.getDashboardAudience(user.role);
    const tenant = await this.getTenantIdentity(schema);
    const showFinance = this.canViewFinance(user.role);

    const [
      sales,
      projects,
      team,
      customers,
      personal,
      recentFiles,
      recentComments,
      notifications,
      briefingOperations,
      clientPortalOperations,
    ] = await Promise.all([
      this.buildSalesSummary(schema, showFinance),
      this.buildProjectsSummary(schema, user, audience),
      this.buildTeamSummary(schema),
      this.buildCustomersSummary(schema, tenant),
      this.buildPersonalSummary(schema, user),
      this.getRecentFiles(schema),
      this.getRecentComments(schema),
      this.getRecentNotifications(tenant, user.email),
      this.buildBriefingOperationsSummary(schema),
      this.buildClientPortalOperationsSummary(schema, audience === 'executive' || audience === 'manager'),
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
        missingMaterials: briefingOperations.missingMaterials,
        incompleteBriefings: briefingOperations.incompleteBriefings,
        completedBriefings: briefingOperations.completedBriefings,
        openClientReviews: clientPortalOperations.pendingClientApprovals,
        pendingClientApprovals: clientPortalOperations.pendingClientApprovals,
        clientMaterialsRequested: clientPortalOperations.clientMaterialsRequested,
        recentClientCommentsCount: clientPortalOperations.recentClientComments,
        pendingClientInvites: clientPortalOperations.pendingClientInvites,
        upcomingDeliveries: projects.upcomingDeliveries,
        recentComments,
        recentFiles,
        notifications,
        sources: {
          ...briefingOperations.sources,
          ...clientPortalOperations.sources,
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
  workload: Array<{ assignee: string; openTasks: number }>;
  blockedCollaborators: number;
  pendingInvites: number;
  activeUsers: number;
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

interface DashboardClientPortalOperationsSummary {
  pendingClientApprovals: number;
  clientMaterialsRequested: number;
  recentClientComments: number;
  pendingClientInvites: number;
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
  sales: DashboardSalesSummary;
  projects: DashboardProjectsSummary;
  finance: DashboardFinanceSummary | null;
  team: DashboardTeamSummary;
  customers: DashboardCustomersSummary;
  personal: DashboardPersonalSummary;
  operations: {
    missingMaterials: number;
    incompleteBriefings: number;
    completedBriefings: number;
    openClientReviews: number;
    pendingClientApprovals: number;
    clientMaterialsRequested: number;
    recentClientCommentsCount: number;
    pendingClientInvites: number;
    upcomingDeliveries: number;
    recentComments: DashboardActivityItem[];
    recentFiles: DashboardActivityItem[];
    notifications: DashboardActivityItem[];
    sources: DashboardSourceFlags;
  };
}
