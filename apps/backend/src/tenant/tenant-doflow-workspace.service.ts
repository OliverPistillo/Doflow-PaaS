import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, EntityManager } from 'typeorm';
import { provisionSchemaOnce } from '../common/schema-provisioning-once';
import { safeSchema } from '../common/schema.utils';
import { isDoflowTenant } from './tenant-context';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ROLES = ['administrator', 'commercial', 'web_developer', 'project_manager'] as const;
const CAPABILITIES = [
  'canViewAllLeads', 'canViewAssignedLeads', 'canCreateLeads', 'canEditAssignedLead', 'canAssignLeads',
  'canViewCustomers', 'canEditCustomers', 'canViewProjects', 'canViewActivities', 'canManageProjects',
  'canManageAssignedActivities', 'canManageRoles', 'canViewCommercialValues', 'canViewGlobalCommerceValues', 'canViewAdministration',
  'canInspectDuplicates', 'canMergeDuplicates', 'canViewSales', 'canManageOwnSales', 'canViewOrders',
  'canManageOwnOrders', 'canManagePayments', 'canRecordPayments', 'canRecordRefunds',
  'canManagePaymentAllocations', 'canGenerateProjectFromOrder', 'canManageCatalog', 'canViewContracts', 'canManageOwnContracts',
  'canViewRenewals', 'canManageOwnRenewals', 'canManageCommerceRules', 'canApproveProjectWork',
  'canPublishClientUpdate', 'canManageArchive', 'canManageCustomerBranding', 'canViewCampaigns',
  'canManageCampaigns', 'canViewQuotes', 'canManageOwnQuotes', 'canViewInvoices', 'canManageInvoices',
  'canViewAutomations', 'canManageAutomations',
  'canViewAssignedProjects', 'canCreateProject', 'canEditProject', 'canManageProjectMembers',
  'canManageProjectTasks', 'canTrackProjectTime', 'canViewTeamTime', 'canSubmitProjectQa',
  'canSuperviseProject', 'canPublishProject', 'canDeliverProject', 'canReopenProject',
  'canArchiveProject', 'canViewGlobalWorkload', 'canUseBuilder',
  'canReadComments', 'canCreateComments', 'canReplyComments', 'canEditOwnComments',
  'canModerateComments', 'canResolveThreads', 'canMentionUsers', 'canReactComments',
  'canAttachCommentFiles', 'canReadTimeline', 'canReadHistory',
  'canReadNotifications', 'canManageNotificationPreferences', 'canReadAdministrativeAudit',
  'canRunAutomations', 'canRetryAutomations', 'canViewAutomationErrors',
  'canViewOwnPoints', 'canViewGlobalPoints', 'canManagePointPolicies',
  'canViewRankings', 'canManageRankings', 'canManageGoals',
] as const;
const GOAL_METRICS = ['revenue', 'won_leads', 'new_clients', 'completed_projects', 'completed_activities', 'on_time_deliveries', 'resolved_bugs', 'renewals'];
const GOAL_TARGETS = ['company', 'role', 'user'];
const GOAL_UNITS = ['number', 'currency', 'percentage'];
const GOAL_STATUSES = ['active', 'completed', 'paused', 'archived'];

export const DOFLOW_ROLE_CAPABILITIES: Record<string, readonly string[]> = {
  administrator: CAPABILITIES,
  commercial: ['canViewAssignedLeads', 'canCreateLeads', 'canEditAssignedLead', 'canViewCustomers', 'canEditCustomers', 'canViewProjects', 'canViewActivities', 'canViewCommercialValues', 'canInspectDuplicates', 'canViewSales', 'canManageOwnSales', 'canViewOrders', 'canManageOwnOrders', 'canManagePayments', 'canRecordPayments', 'canRecordRefunds', 'canGenerateProjectFromOrder', 'canViewContracts', 'canManageOwnContracts', 'canViewRenewals', 'canManageOwnRenewals', 'canViewCampaigns', 'canViewQuotes', 'canManageOwnQuotes', 'canViewOwnPoints', 'canViewRankings', 'canReadComments', 'canCreateComments', 'canReplyComments', 'canEditOwnComments', 'canResolveThreads', 'canMentionUsers', 'canReactComments', 'canAttachCommentFiles', 'canReadTimeline', 'canReadHistory', 'canReadNotifications', 'canManageNotificationPreferences'],
  web_developer: ['canViewCustomers', 'canViewProjects', 'canViewAssignedProjects', 'canViewActivities', 'canManageAssignedActivities', 'canManageProjectTasks', 'canTrackProjectTime', 'canSubmitProjectQa', 'canUseBuilder', 'canViewOrders', 'canViewContracts', 'canViewRenewals', 'canViewOwnPoints', 'canViewRankings', 'canReadComments', 'canCreateComments', 'canReplyComments', 'canEditOwnComments', 'canResolveThreads', 'canMentionUsers', 'canReactComments', 'canAttachCommentFiles', 'canReadTimeline', 'canReadHistory', 'canReadNotifications', 'canManageNotificationPreferences'],
  project_manager: ['canViewCustomers', 'canViewProjects', 'canViewAssignedProjects', 'canCreateProject', 'canEditProject', 'canManageProjects', 'canManageProjectMembers', 'canManageProjectTasks', 'canTrackProjectTime', 'canViewTeamTime', 'canSubmitProjectQa', 'canSuperviseProject', 'canManageAssignedActivities', 'canViewOrders', 'canViewContracts', 'canViewRenewals', 'canApproveProjectWork', 'canPublishClientUpdate', 'canPublishProject', 'canDeliverProject', 'canReopenProject', 'canArchiveProject', 'canViewGlobalWorkload', 'canUseBuilder', 'canViewAutomations', 'canRunAutomations', 'canViewAutomationErrors', 'canViewOwnPoints', 'canViewGlobalPoints', 'canViewRankings', 'canReadComments', 'canCreateComments', 'canReplyComments', 'canEditOwnComments', 'canModerateComments', 'canResolveThreads', 'canMentionUsers', 'canReactComments', 'canAttachCommentFiles', 'canReadTimeline', 'canReadHistory', 'canReadNotifications', 'canManageNotificationPreferences'],
};

async function provisionDoflowWorkspaceTables(
  dataSource: DataSource,
  schema: string,
) {
  if (!isDoflowTenant(schema)) {
    throw new ForbiddenException(
      'Le tabelle workspace sono riservate al tenant doflow',
    );
  }
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${schema}".doflow_user_preferences (
      user_id UUID PRIMARY KEY,
      preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${schema}".doflow_user_roles (
      user_id UUID NOT NULL,
      role TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, role)
    )`);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${schema}".doflow_user_capabilities (
      user_id UUID NOT NULL,
      capability TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (user_id, capability)
    )`);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${schema}".doflow_goals (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      target_type TEXT NOT NULL,
      target_id TEXT,
      metric TEXT NOT NULL,
      target_value NUMERIC NOT NULL,
      unit TEXT NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      responsible_id UUID,
      notes TEXT,
      created_by UUID NOT NULL,
      updated_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )`);
  await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_${schema}_doflow_goals_period" ON "${schema}".doflow_goals(starts_at, ends_at) WHERE deleted_at IS NULL`);
  await dataSource.query(`CREATE INDEX IF NOT EXISTS "idx_${schema}_doflow_goals_target" ON "${schema}".doflow_goals(target_type, target_id) WHERE deleted_at IS NULL`);
}

export function ensureDoflowWorkspaceTables(
  dataSource: DataSource,
  schema: string,
): Promise<void> {
  const safe = safeSchema(schema, 'ensureDoflowWorkspaceTables');
  return provisionSchemaOnce(dataSource, `doflow-workspace:${safe}`, () =>
    provisionDoflowWorkspaceTables(dataSource, safe),
  );
}

@Injectable()
export class TenantDoflowWorkspaceService {
  constructor(private readonly dataSource: DataSource, @Inject(REQUEST) private readonly request: any) {}

  private user() {
    const source = this.request.user || this.request.authUser;
    const schema = String(source?.tenantId || source?.tenant_id || this.request.tenantId || '').toLowerCase();
    if (!source?.sub || !isDoflowTenant(schema)) throw new ForbiddenException('Workspace disponibile soltanto per il tenant doflow');
    return { id: String(source.sub), email: String(source.email || ''), role: String(source.role || '').toLowerCase(), schema };
  }

  private assertOwner() {
    const user = this.user();
    if (!['owner', 'admin'].includes(user.role)) throw new ForbiddenException('Permesso di amministrazione richiesto');
    return user;
  }

  private uuid(value: unknown, label: string) {
    const id = String(value || '');
    if (!UUID_RE.test(id)) throw new BadRequestException(`${label} non valido`);
    return id;
  }

  private async ensureIdentityTables() {
    const { schema } = this.user();
    await ensureDoflowWorkspaceTables(this.dataSource, schema);
  }

  private async assertGoalManager() {
    const user = this.user();
    await ensureDoflowWorkspaceTables(this.dataSource, user.schema);
    if (['owner', 'admin'].includes(user.role)) return user;
    const [roles, capabilities] = await Promise.all([
      this.dataSource.query(`SELECT role FROM "${user.schema}".doflow_user_roles WHERE user_id = $1`, [user.id]),
      this.dataSource.query(`SELECT 1 FROM "${user.schema}".doflow_user_capabilities WHERE user_id = $1 AND capability = 'canManageRoles' LIMIT 1`, [user.id]),
    ]);
    const inherited = roles.some((row: any) => (DOFLOW_ROLE_CAPABILITIES[String(row.role)] || []).includes('canManageRoles'));
    if (!inherited && !capabilities[0]) throw new ForbiddenException('Gestione obiettivi non autorizzata');
    return user;
  }

  private goalBody(body: Record<string, unknown>, partial = false) {
    const values: Record<string, unknown> = {};
    const add = (key: string, value: unknown) => {
      if (!partial || body[key] !== undefined) values[key] = value;
    };
    const title = String(body.title || '').trim();
    if (!partial && !title) throw new BadRequestException('Titolo obiettivo obbligatorio');
    add('title', title);
    add('description', String(body.description || '').trim());
    const targetType = String(body.targetType || body.target_type || 'company');
    if ((!partial || body.targetType !== undefined || body.target_type !== undefined) && !GOAL_TARGETS.includes(targetType)) throw new BadRequestException('Target obiettivo non valido');
    if (!partial || body.targetType !== undefined || body.target_type !== undefined) values.target_type = targetType;
    if (!partial || body.targetId !== undefined || body.target_id !== undefined) values.target_id = String(body.targetId || body.target_id || '').trim() || null;
    const metric = String(body.metric || '');
    if ((!partial || body.metric !== undefined) && !GOAL_METRICS.includes(metric)) throw new BadRequestException('Metrica obiettivo non valida');
    add('metric', metric);
    const targetValue = Number(body.targetValue ?? body.target_value);
    if ((!partial || body.targetValue !== undefined || body.target_value !== undefined) && (!Number.isFinite(targetValue) || targetValue < 0)) throw new BadRequestException('Valore obiettivo non valido');
    if (!partial || body.targetValue !== undefined || body.target_value !== undefined) values.target_value = targetValue;
    const unit = String(body.unit || 'number');
    if ((!partial || body.unit !== undefined) && !GOAL_UNITS.includes(unit)) throw new BadRequestException('Unità obiettivo non valida');
    add('unit', unit);
    for (const [source, target] of [['startsAt', 'starts_at'], ['endsAt', 'ends_at']] as const) {
      if (partial && body[source] === undefined && body[target] === undefined) continue;
      const date = new Date(String(body[source] || body[target] || ''));
      if (!Number.isFinite(date.getTime())) throw new BadRequestException(`${source} non valido`);
      values[target] = date.toISOString();
    }
    const status = String(body.status || 'active');
    if ((!partial || body.status !== undefined) && !GOAL_STATUSES.includes(status)) throw new BadRequestException('Stato obiettivo non valido');
    add('status', status);
    const responsible = body.responsibleId ?? body.responsible_id;
    if (!partial || body.responsibleId !== undefined || body.responsible_id !== undefined) values.responsible_id = responsible ? this.uuid(responsible, 'Responsabile') : null;
    add('notes', String(body.notes || '').trim() || null);
    if (!partial && new Date(String(values.ends_at)).getTime() < new Date(String(values.starts_at)).getTime()) throw new BadRequestException('Periodo obiettivo non valido');
    return values;
  }

  private async targetUserExists(manager: EntityManager, schema: string, userId: string) {
    const rows = await manager.query(
      `SELECT id FROM "${schema}".users WHERE id = $1 AND is_active = true LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('Utente Doflow non trovato');
  }

  private async repointIfPresent(
    manager: EntityManager,
    schema: string,
    table: string,
    column: string,
    primaryId: string,
    secondaryId: string,
  ) {
    const rows = await manager.query(
      `SELECT 1
         FROM information_schema.columns
        WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
        LIMIT 1`,
      [schema, table, column],
    );
    if (!rows[0]) return;
    await manager.query(
      `UPDATE "${schema}"."${table}" SET "${column}" = $1 WHERE "${column}" = $2`,
      [primaryId, secondaryId],
    );
  }

  async identity() {
    const user = this.user();
    await this.ensureIdentityTables();
    const [preferenceRows, roleRows, capabilityRows, users, allRoleRows, allCapabilityRows] = await Promise.all([
      this.dataSource.query(`SELECT preferences FROM "${user.schema}".doflow_user_preferences WHERE user_id = $1`, [user.id]),
      this.dataSource.query(`SELECT role FROM "${user.schema}".doflow_user_roles WHERE user_id = $1`, [user.id]),
      this.dataSource.query(`SELECT capability FROM "${user.schema}".doflow_user_capabilities WHERE user_id = $1`, [user.id]),
      this.dataSource.query(`SELECT id, role FROM "${user.schema}".users WHERE is_active = true`),
      this.dataSource.query(`SELECT user_id, role FROM "${user.schema}".doflow_user_roles`),
      this.dataSource.query(`SELECT user_id, capability FROM "${user.schema}".doflow_user_capabilities`),
    ]);
    const roles = ['owner', 'admin'].includes(user.role)
      ? ['administrator']
      : roleRows.map((row: any) => String(row.role)).filter((role: string) => ROLES.includes(role as any));
    const inherited = roles.flatMap((role: string) => DOFLOW_ROLE_CAPABILITIES[role] || []);
    const explicit = capabilityRows.map((row: any) => String(row.capability)).filter((capability: string) => CAPABILITIES.includes(capability as any));
    const assignments = users.map((account: any) => {
      const accountId = String(account.id);
      const assignedRoles = ['owner', 'admin'].includes(String(account.role || '').toLowerCase())
        ? [...ROLES]
        : allRoleRows
            .filter((row: any) => String(row.user_id) === accountId)
            .map((row: any) => String(row.role))
            .filter((role: string) => ROLES.includes(role as any));
      const assignedCapabilities = allCapabilityRows
        .filter((row: any) => String(row.user_id) === accountId)
        .map((row: any) => String(row.capability))
        .filter((capability: string) => CAPABILITIES.includes(capability as any));
      return {
        userId: accountId,
        roles: assignedRoles,
        capabilities: Array.from(new Set([
          ...assignedRoles.flatMap((role: string) => DOFLOW_ROLE_CAPABILITIES[role] || []),
          ...assignedCapabilities,
        ])),
      };
    });
    return {
      preferences: preferenceRows[0]?.preferences || {},
      capabilities: Array.from(new Set([...inherited, ...explicit])),
      assignments,
    };
  }

  async updatePreferences(body: Record<string, unknown>) {
    const user = this.user();
    await this.ensureIdentityTables();
    const allowed = {
      leadOpenMode: body.leadOpenMode === 'full' ? 'full' : 'quick',
      clientOpenMode: body.clientOpenMode === 'full' ? 'full' : 'quick',
      leadList: { sort: String((body.leadList as any)?.sort || 'updated-desc').slice(0, 64), group: String((body.leadList as any)?.group || 'none').slice(0, 64) },
      clientList: { sort: String((body.clientList as any)?.sort || 'updated-desc').slice(0, 64), group: String((body.clientList as any)?.group || 'none').slice(0, 64) },
    };
    await this.dataSource.query(
      `INSERT INTO "${user.schema}".doflow_user_preferences (user_id, preferences, updated_at) VALUES ($1, $2::jsonb, now())
       ON CONFLICT (user_id) DO UPDATE SET preferences = excluded.preferences, updated_at = now()`,
      [user.id, JSON.stringify(allowed)],
    );
    return { preferences: allowed };
  }

  async listGoals() {
    const user = this.user();
    await this.ensureIdentityTables();
    if (['owner', 'admin'].includes(user.role)) {
      return { items: await this.dataSource.query(`SELECT * FROM "${user.schema}".doflow_goals WHERE deleted_at IS NULL ORDER BY starts_at DESC, created_at DESC`) };
    }
    const roles = await this.dataSource.query(`SELECT role FROM "${user.schema}".doflow_user_roles WHERE user_id = $1`, [user.id]);
    return {
      items: await this.dataSource.query(
        `SELECT * FROM "${user.schema}".doflow_goals
         WHERE deleted_at IS NULL AND (
           target_type = 'company' OR
           (target_type = 'user' AND target_id = $1) OR
           (target_type = 'role' AND target_id = ANY($2::text[]))
         ) ORDER BY starts_at DESC, created_at DESC`,
        [user.id, roles.map((row: any) => String(row.role))],
      ),
    };
  }

  async createGoal(body: Record<string, unknown>) {
    const user = await this.assertGoalManager();
    const values = this.goalBody(body);
    const requestedId = body.id ? this.uuid(body.id, 'Obiettivo') : null;
    const columns = [...(requestedId ? ['id'] : []), ...Object.keys(values), 'created_by', 'updated_by'];
    const params = [...(requestedId ? [requestedId] : []), ...Object.values(values), user.id, user.id];
    const rows = await this.dataSource.query(
      `INSERT INTO "${user.schema}".doflow_goals (${columns.join(', ')}) VALUES (${columns.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`,
      params,
    );
    await this.dataSource.query(`INSERT INTO "${user.schema}".audit_log (actor_email, actor_role, action, target, metadata, created_at) VALUES ($1, $2, 'doflow_goal_created', $3, '{}'::jsonb, now())`, [user.email, user.role, rows[0].id]);
    return rows[0];
  }

  async updateGoal(idValue: string, body: Record<string, unknown>) {
    const user = await this.assertGoalManager();
    const id = this.uuid(idValue, 'Obiettivo');
    const values = this.goalBody(body, true);
    const entries = Object.entries(values);
    if (!entries.length) {
      const rows = await this.dataSource.query(`SELECT * FROM "${user.schema}".doflow_goals WHERE id = $1 AND deleted_at IS NULL`, [id]);
      if (!rows[0]) throw new NotFoundException('Obiettivo non trovato');
      return rows[0];
    }
    const params = [...entries.map(([, value]) => value), user.id, id];
    const rows = await this.dataSource.query(
      `UPDATE "${user.schema}".doflow_goals SET ${entries.map(([key], index) => `${key} = $${index + 1}`).join(', ')}, updated_by = $${entries.length + 1}, updated_at = now() WHERE id = $${entries.length + 2} AND deleted_at IS NULL RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Obiettivo non trovato');
    await this.dataSource.query(`INSERT INTO "${user.schema}".audit_log (actor_email, actor_role, action, target, metadata, created_at) VALUES ($1, $2, 'doflow_goal_updated', $3, $4::jsonb, now())`, [user.email, user.role, id, JSON.stringify({ fields: entries.map(([key]) => key) })]);
    return rows[0];
  }

  async archiveGoal(idValue: string) {
    return this.updateGoal(idValue, { status: 'archived' });
  }

  async updateRoles(userIdValue: string, body: Record<string, unknown>) {
    const actor = this.assertOwner();
    await this.ensureIdentityTables();
    const userId = this.uuid(userIdValue, 'Utente');
    const roles = Array.from(new Set((Array.isArray(body.roles) ? body.roles : []).map(String))).filter((role) => ROLES.includes(role as any));
    await this.dataSource.transaction(async (manager) => {
      await this.targetUserExists(manager, actor.schema, userId);
      await manager.query(`DELETE FROM "${actor.schema}".doflow_user_roles WHERE user_id = $1`, [userId]);
      for (const role of roles) await manager.query(`INSERT INTO "${actor.schema}".doflow_user_roles (user_id, role) VALUES ($1, $2)`, [userId, role]);
      await manager.query(`UPDATE "${actor.schema}".team_members SET operational_role = $1, updated_at = now() WHERE user_id = $2 AND deleted_at IS NULL`, [roles.find((role) => role !== 'administrator') || roles[0] || null, userId]);
      await manager.query(`INSERT INTO "${actor.schema}".audit_log (actor_email, actor_role, action, target, metadata, created_at) VALUES ($1, $2, 'doflow_identity_roles_updated', $3, $4::jsonb, now())`, [actor.email, actor.role, userId, JSON.stringify({ roles })]);
    });
    return { userId, roles };
  }

  async updateCapabilities(userIdValue: string, body: Record<string, unknown>) {
    const actor = this.assertOwner();
    await this.ensureIdentityTables();
    const userId = this.uuid(userIdValue, 'Utente');
    const capabilities = Array.from(new Set((Array.isArray(body.capabilities) ? body.capabilities : []).map(String))).filter((capability) => CAPABILITIES.includes(capability as any));
    await this.dataSource.transaction(async (manager) => {
      await this.targetUserExists(manager, actor.schema, userId);
      await manager.query(`DELETE FROM "${actor.schema}".doflow_user_capabilities WHERE user_id = $1`, [userId]);
      for (const capability of capabilities) await manager.query(`INSERT INTO "${actor.schema}".doflow_user_capabilities (user_id, capability) VALUES ($1, $2)`, [userId, capability]);
      await manager.query(`INSERT INTO "${actor.schema}".audit_log (actor_email, actor_role, action, target, metadata, created_at) VALUES ($1, $2, 'doflow_identity_capabilities_updated', $3, $4::jsonb, now())`, [actor.email, actor.role, userId, JSON.stringify({ capabilities })]);
    });
    return { userId, capabilities };
  }

  async mergeDuplicates(body: Record<string, unknown>) {
    const actor = this.assertOwner();
    const primaryId = this.uuid(body.primaryId, 'Record principale');
    const secondaryId = this.uuid(body.secondaryId, 'Record secondario');
    if (primaryId === secondaryId) throw new BadRequestException('I record devono essere distinti');
    const fields = body.fields && typeof body.fields === 'object' ? body.fields as Record<string, unknown> : {};

    return this.dataSource.transaction(async (manager) => {
      const opportunities = await manager.query(`SELECT id FROM "${actor.schema}".opportunities WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL FOR UPDATE`, [[primaryId, secondaryId]]);
      if (opportunities.length === 2) {
        const updates: Record<string, unknown> = {};
        const mapping: Record<string, string> = { opportunityName: 'title', service: 'service_type', value: 'value_estimate', probability: 'probability', assigneeId: 'assigned_to', nextAction: 'next_action', nextActionAt: 'next_action_at', stage: 'stage' };
        for (const [source, target] of Object.entries(mapping)) if (source in fields) updates[target] = fields[source];
        const entries = Object.entries(updates);
        if (entries.length) await manager.query(`UPDATE "${actor.schema}".opportunities SET ${entries.map(([key], index) => `${key} = $${index + 1}`).join(', ')}, updated_by = $${entries.length + 1}, updated_at = now() WHERE id = $${entries.length + 2}`, [...entries.map(([, value]) => value), actor.id, primaryId]);
        for (const [table, column] of [['commercial_activities', 'opportunity_id'], ['projects', 'opportunity_id'], ['quotes', 'opportunity_id'], ['contracts', 'opportunity_id']] as const) {
          await this.repointIfPresent(manager, actor.schema, table, column, primaryId, secondaryId);
        }
        await manager.query(`UPDATE "${actor.schema}".opportunities SET deleted_at = now(), updated_by = $1, updated_at = now() WHERE id = $2`, [actor.id, secondaryId]);
      } else {
        const companies = await manager.query(`SELECT id FROM "${actor.schema}".companies WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL FOR UPDATE`, [[primaryId, secondaryId]]);
        if (companies.length !== 2) throw new NotFoundException('Coppia di record omogenei non trovata');
        const updates: Record<string, unknown> = {};
        const mapping: Record<string, string> = { company: 'name', email: 'email', phone: 'phone', vatNumber: 'vat_number', taxCode: 'fiscal_code', location: 'address', owner: 'owner_user_id' };
        for (const [source, target] of Object.entries(mapping)) if (source in fields) updates[target] = fields[source];
        const entries = Object.entries(updates);
        if (entries.length) await manager.query(`UPDATE "${actor.schema}".companies SET ${entries.map(([key], index) => `${key} = $${index + 1}`).join(', ')}, updated_at = now() WHERE id = $${entries.length + 1}`, [...entries.map(([, value]) => value), primaryId]);
        for (const table of ['contacts', 'leads', 'opportunities', 'commercial_activities', 'projects', 'quotes', 'contracts']) {
          await this.repointIfPresent(manager, actor.schema, table, 'company_id', primaryId, secondaryId);
        }
        await manager.query(`UPDATE "${actor.schema}".companies SET deleted_at = now(), updated_at = now() WHERE id = $1`, [secondaryId]);
      }
      await manager.query(`INSERT INTO "${actor.schema}".audit_log (actor_email, actor_role, action, target, metadata, created_at) VALUES ($1, $2, 'doflow_duplicate_merged', $3, $4::jsonb, now())`, [actor.email, actor.role, primaryId, JSON.stringify({ primaryId, secondaryId })]);
      return { ok: true, primaryId, secondaryId };
    });
  }
}
