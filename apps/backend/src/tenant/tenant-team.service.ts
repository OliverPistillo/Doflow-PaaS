import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, EntityManager } from 'typeorm';
import * as crypto from 'crypto';
import { safeSchema } from '../common/schema.utils';
import { buildFrontendPath } from '../common/public-url.utils';
import { hasRoleAtLeast } from '../roles';
import { MailService } from '../mail/mail.service';
import { WebSessionService } from '../auth/web-session.service';
import { storedInviteToken } from '../auth/invite-token';
import {
  ensureTenantTeamTables,
  seedTenantTeamSkills,
  syncTenantUsersToTeamMembers,
} from './tenant-team-schema';
import { TenantNotificationsService } from './tenant-notifications.service';
import { isDoflowTenant } from './tenant-context';
import { PROJECT_ACTIVE_STAGE_ALIASES } from './project-stage-model';
import {
  PENDING_DOFLOW_IDENTITY_METADATA_KEY,
  inspectPendingDoflowIdentity,
} from './tenant-doflow-identity-policy';
import { ensureDoflowWorkspaceTables } from './tenant-doflow-workspace.service';
import { NEVER_OVERRIDE_FOR_NON_ADMIN } from './tenant-effective-permissions.service';
import {
  ASSIGNABLE_TENANT_ROLES,
  isAssignableTenantRole,
  isProtectedTenantRole,
  normalizedTenantRole,
} from './tenant-role-policy';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ADMIN_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin']);
const OPERATIONAL_ROLES = [
  'ceo_label', 'project_manager', 'sales', 'designer', 'developer', 'seo_specialist',
  'copywriter', 'administration', 'external_collaborator', 'generic',
];
const EMPLOYMENT_TYPES = ['employee', 'contractor', 'external', 'intern', 'admin'];
const MEMBER_STATUSES = ['active', 'inactive', 'invited', 'suspended', 'archived'];
const AVAILABILITY_STATUSES = ['available', 'busy', 'unavailable', 'vacation', 'sick', 'external_limited'];
const SKILL_LEVELS = ['junior', 'intermediate', 'senior', 'lead'];
const AVAILABILITY_TYPES = ['available', 'unavailable', 'vacation', 'sick', 'remote', 'reduced_hours', 'external_unavailable', 'focus_time'];
const AVAILABILITY_ENTRY_STATUSES = ['planned', 'confirmed', 'cancelled'];
const TIME_ACTIVITY_TYPES = ['design', 'development', 'seo', 'copywriting', 'meeting', 'project_management', 'support', 'admin', 'research', 'qa', 'work'];
const TIME_STATUSES = ['draft', 'submitted', 'approved', 'rejected'];
const MODULE_KEYS = [
  'dashboard',
  'crm',
  'briefing',
  'quotes',
  'projects',
  'calendar',
  'documents',
  'notifications',
  'finance',
  'team',
  'knowledge',
  'contracts',
  'paperwork',
  'reports',
  'automations',
  'settings',
  'credentials',
  'credentials.read',
  'credentials.create',
  'credentials.edit',
  'credentials.reveal',
  'credentials.manage_permissions',
  'credentials.audit',
];
const MODULE_PERMISSION_FIELDS = [
  'can_view',
  'can_create',
  'can_update',
  'can_delete',
  'can_manage',
] as const;
const ALWAYS_VISIBLE_MODULES = new Set(['dashboard', 'notifications']);

type NormalizedModulePermission = {
  moduleKey: string;
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_manage: boolean;
};

type AuthUser = { id: string; email?: string; role: string };
type ListResult<T = Record<string, any>> = { items: T[]; total?: number; limit?: number; offset?: number };
export type TeamInviteResult = { email_sent: boolean; invite_link: string; expires_at: string };
export type CreateTeamMemberResult = { member: Record<string, any>; invite: TeamInviteResult | null };

@Injectable()
export class TenantTeamService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: TenantNotificationsService,
    private readonly mailService: MailService,
    private readonly webSessions: WebSessionService,
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
    const schema = safeSchema(tenantRef || 'public', 'TenantTeamService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Team tenant non disponibile nel contesto public');
    return schema;
  }

  private isAdmin(role: string): boolean {
    return ADMIN_ROLES.has(role);
  }

  private isManager(role: string): boolean {
    return hasRoleAtLeast(role, 'manager');
  }

  private canReadTeam(role: string): boolean {
    return this.isManager(role) || role === 'editor' || role === 'user' || role === 'viewer';
  }

  private canManageTeam(role: string): boolean {
    return this.isAdmin(role);
  }

  private canManageOperations(role: string): boolean {
    return this.isManager(role);
  }

  private canSeeSensitive(role: string): boolean {
    return this.isAdmin(role);
  }

  private assertCanRead(user = this.getUser()) {
    if (!this.canReadTeam(user.role)) throw new ForbiddenException('Non hai accesso al modulo Team.');
    return user;
  }

  private assertCanManage(user = this.getUser()) {
    if (!this.canManageTeam(user.role)) throw new ForbiddenException('Solo owner/admin possono gestire i membri del team.');
    return user;
  }

  private assertCanManageOperations(user = this.getUser()) {
    if (!this.canManageOperations(user.role)) throw new ForbiddenException('Manager o superiore richiesto.');
    return user;
  }

  private requireUuid(value: string, label = 'ID'): string {
    if (!UUID_RE.test(String(value))) throw new BadRequestException(`${label} non valido`);
    return String(value);
  }

  private userIdOrNull(value: unknown): string | null {
    const text = String(value || '');
    return UUID_RE.test(text) ? text : null;
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

  private normalizeNullableDate(value: unknown, fieldName: string): string | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const text = String(value).trim();
    if (!text) return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) throw new BadRequestException(`${fieldName} non valida`);
    const date = new Date(`${text}T00:00:00.000Z`);
    if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
      throw new BadRequestException(`${fieldName} non valida`);
    }
    return text;
  }

  private normalizeNullableNumber(value: unknown, fieldName: string, integer = false): number | null | undefined {
    if (value === undefined) return undefined;
    if (value === null) return null;
    const text = String(value).trim();
    if (!text) return null;
    const n = Number(text);
    if (!Number.isFinite(n)) throw new BadRequestException(`${fieldName} non valido`);
    if (integer && !Number.isInteger(n)) throw new BadRequestException(`${fieldName} non valido`);
    if (n < 0) throw new BadRequestException(`${fieldName} non valido`);
    return n;
  }

  private assertDateRange(start: string | null | undefined, end: string | null | undefined) {
    if (start && end && new Date(`${end}T00:00:00.000Z`) < new Date(`${start}T00:00:00.000Z`)) {
      throw new BadRequestException('end_date deve essere successiva o uguale a start_date');
    }
  }

  private pick(value: unknown, allowed: string[], fallback: string): string {
    const text = String(value || '').trim();
    return allowed.includes(text) ? text : fallback;
  }

  private validateEmail(value: unknown): string {
    const email = String(value || '').trim().toLowerCase();
    if (!email) throw new BadRequestException('email obbligatoria');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException('email non valida');
    return email;
  }

  private normalizeTenantRole(value: unknown, actor: AuthUser): string {
    const role = normalizedTenantRole(value || 'user');
    if (isProtectedTenantRole(role)) {
      throw new BadRequestException('Ruolo tenant non consentito per invito team');
    }
    if (!isAssignableTenantRole(role)) throw new BadRequestException('tenant_role non valido');
    if (role === 'admin' && !['owner', 'superadmin', 'super_admin'].includes(actor.role)) {
      throw new ForbiddenException('Solo owner/superadmin possono invitare admin.');
    }
    return role;
  }

  private parseStringArray(value: unknown): string[] | null {
    if (value === undefined || value === null || value === '') return null;
    if (Array.isArray(value)) return value.map((item) => String(item).trim()).filter(Boolean);
    return String(value).split(',').map((item) => item.trim()).filter(Boolean);
  }

  private parseMetadata(value: unknown): Record<string, unknown> | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    try {
      const parsed = JSON.parse(String(value));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      throw new BadRequestException('metadata JSON non valido');
    }
    throw new BadRequestException('metadata deve essere un oggetto JSON');
  }

  private parseCallerMetadata(value: unknown): Record<string, unknown> | null {
    const metadata = this.parseMetadata(value);
    if (metadata && Object.prototype.hasOwnProperty.call(metadata, PENDING_DOFLOW_IDENTITY_METADATA_KEY)) {
      throw new BadRequestException('La configurazione identity pending deve usare il campo doflow_identity.');
    }
    return metadata;
  }

  private normalizeModulePermissionEntries(
    value: unknown,
    tenantRoleValue: unknown,
  ): NormalizedModulePermission[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new BadRequestException('module_permissions deve essere un array');
    const tenantRole = normalizedTenantRole(tenantRoleValue || 'user');
    if (ADMIN_ROLES.has(tenantRole) && value.length > 0) {
      throw new BadRequestException('I ruoli amministrativi ereditano i permessi modulo e non accettano override.');
    }

    const seen = new Set<string>();
    return value.map((rawEntry) => {
      if (!rawEntry || typeof rawEntry !== 'object' || Array.isArray(rawEntry)) {
        throw new BadRequestException('Override modulo non valido');
      }
      const entry = rawEntry as Record<string, unknown>;
      const moduleKey = String(entry.module_key || entry.moduleKey || '').trim();
      if (!MODULE_KEYS.includes(moduleKey)) throw new BadRequestException('module_key non valido');
      if (seen.has(moduleKey)) throw new BadRequestException('module_key duplicato');
      seen.add(moduleKey);

      const values = Object.fromEntries(
        MODULE_PERMISSION_FIELDS.map((field) => [field, entry[field] === true]),
      ) as Record<(typeof MODULE_PERMISSION_FIELDS)[number], boolean>;
      if (NEVER_OVERRIDE_FOR_NON_ADMIN.has(moduleKey as any) && MODULE_PERMISSION_FIELDS.some((field) => values[field])) {
        throw new BadRequestException(`Il modulo ${moduleKey} non accetta grant positivi per ruoli non amministrativi.`);
      }
      if (tenantRole === 'viewer' && MODULE_PERMISSION_FIELDS.slice(1).some((field) => values[field])) {
        throw new BadRequestException('Il ruolo viewer può ricevere soltanto permessi di lettura.');
      }
      if (ALWAYS_VISIBLE_MODULES.has(moduleKey) && values.can_view === false) {
        throw new BadRequestException(`Il modulo ${moduleKey} deve restare visibile.`);
      }
      if (!values.can_view) {
        values.can_create = false;
        values.can_update = false;
        values.can_delete = false;
        values.can_manage = false;
      }
      return { moduleKey, ...values };
    });
  }

  private normalizeSkillIds(value: unknown): string[] {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new BadRequestException('skill_ids deve essere un array');
    if (value.length > 100) throw new BadRequestException('Troppe competenze selezionate');
    return Array.from(new Set(value.map((item) => this.requireUuid(String(item), 'skill_id'))));
  }

  private async insertMemberConfiguration(
    manager: EntityManager,
    schema: string,
    memberId: string,
    modulePermissions: NormalizedModulePermission[],
    skillIds: string[],
    actor: AuthUser,
  ) {
    const actorId = this.userIdOrNull(actor.id);
    for (const entry of modulePermissions) {
      await manager.query(
        `INSERT INTO "${schema}".team_module_permissions (
           team_member_id, module_key, can_view, can_create, can_update, can_delete, can_manage, created_by, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())`,
        [
          memberId,
          entry.moduleKey,
          entry.can_view,
          entry.can_create,
          entry.can_update,
          entry.can_delete,
          entry.can_manage,
          actorId,
        ],
      );
    }

    if (skillIds.length > 0) {
      const skillRows = await manager.query(
        `SELECT id FROM "${schema}".team_skills
         WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [skillIds],
      );
      const existingSkillIds = new Set(skillRows.map((row: Record<string, unknown>) => String(row.id)));
      if (skillIds.some((skillId) => !existingSkillIds.has(skillId))) {
        throw new BadRequestException('Una o più competenze non sono disponibili nel tenant.');
      }
      for (const skillId of skillIds) {
        await manager.query(
          `INSERT INTO "${schema}".team_member_skills (team_member_id, skill_id, created_at)
           VALUES ($1, $2, now())`,
          [memberId, skillId],
        );
      }
    }
  }

  private async ensureSchema(schema: string) {
    await ensureTenantTeamTables(this.dataSource, schema);
  }

  private sanitizeMember(row: Record<string, any>, user = this.getUser()) {
    if (!row) return row;
    if (this.canSeeSensitive(user.role)) return row;
    const {
      hourly_rate_cents: _hourlyRate,
      daily_rate_cents: _dailyRate,
      currency: _currency,
      private_notes: _privateNotes,
      ...safe
    } = row;
    return safe;
  }

  private sanitizeTimeEntry(row: Record<string, any>, user = this.getUser()) {
    if (!row || this.canSeeSensitive(user.role)) return row;
    const { hourly_rate_cents: _hourlyRate, daily_rate_cents: _dailyRate, cost_cents: _cost, ...safe } = row;
    return safe;
  }

  private memberAccessSql(user: AuthUser, alias: string, paramIndex: number) {
    if (this.isManager(user.role)) return { sql: 'TRUE', params: [] as unknown[] };
    const userId = this.userIdOrNull(user.id);
    if (userId) return { sql: `${alias}.user_id = $${paramIndex}`, params: [userId] as unknown[] };
    if (user.email) return { sql: `lower(${alias}.email) = lower($${paramIndex})`, params: [user.email] as unknown[] };
    return { sql: 'FALSE', params: [] as unknown[] };
  }

  private async currentMember(schema: string, user = this.getUser()) {
    await syncTenantUsersToTeamMembers(this.dataSource, schema);
    const userId = this.userIdOrNull(user.id);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".team_members
       WHERE deleted_at IS NULL
         AND (($1::uuid IS NOT NULL AND user_id = $1::uuid) OR lower(email) = lower($2))
       LIMIT 1`,
      [userId, user.email || ''],
    );
    return rows[0] || null;
  }

  private async activityWith(executor: { query: (sql: string, params?: unknown[]) => Promise<any> }, schema: string, action: string, user: AuthUser, teamMemberId?: string | null, entityType?: string | null, entityId?: string | null, metadata?: Record<string, unknown>) {
    await executor.query(
      `INSERT INTO "${schema}".team_activity (team_member_id, actor_user_id, action, entity_type, entity_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())`,
      [
        teamMemberId ? this.requireUuid(teamMemberId, 'team_member_id') : null,
        this.userIdOrNull(user.id),
        action,
        this.textOrNull(entityType),
        entityId ? this.requireUuid(entityId, 'entity_id') : null,
        JSON.stringify(metadata || {}),
      ],
    );
  }

  private async activity(schema: string, action: string, user: AuthUser, teamMemberId?: string | null, entityType?: string | null, entityId?: string | null, metadata?: Record<string, unknown>) {
    await this.activityWith(this.dataSource, schema, action, user, teamMemberId, entityType, entityId, metadata);
  }

  private async administrativeAuditWith(
    executor: { query: (sql: string, params?: unknown[]) => Promise<any> },
    schema: string,
    action: string,
    user: AuthUser,
    target: string,
    metadata: Record<string, unknown>,
  ) {
    await executor.query(
      `INSERT INTO "${schema}".audit_log
         (actor_email, actor_role, action, target, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
      [user.email || null, user.role, action, target, JSON.stringify(metadata)],
    );
  }

  private async tableExists(manager: EntityManager, schema: string, table: string): Promise<boolean> {
    const rows = await manager.query(`SELECT to_regclass($1) AS relation`, [`${schema}.${table}`]);
    return Boolean(rows[0]?.relation);
  }

  private assertMutableTarget(role: unknown) {
    if (isProtectedTenantRole(role)) {
      throw new ForbiddenException('Il proprietario del tenant non puo essere modificato da questa operazione.');
    }
  }

  private normalizeLifecycleStatus(value: unknown): string {
    const status = String(value || '').trim().toLowerCase();
    if (!MEMBER_STATUSES.includes(status)) throw new BadRequestException('status non valido');
    if (!['active', 'inactive', 'suspended'].includes(status)) {
      throw new BadRequestException('Usa il flusso invito o rimozione per questo stato.');
    }
    return status;
  }

  private async revokeMemberSessions(schema: string, userId: string | null | undefined) {
    if (!userId || !UUID_RE.test(userId)) return;
    const tenantSlug = await this.tenantSlugFor(schema);
    await this.webSessions.revokeUserSessions(tenantSlug, userId);
  }

  private generateInviteToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  private async tenantSlugFor(schema: string): Promise<string> {
    const fromRequest = this.request.user?.tenantSlug || this.request.user?.tenant_slug || this.request.tenantSlug;
    if (fromRequest) return String(fromRequest);
    const rows = await this.dataSource.query(
      `SELECT slug FROM public.tenants WHERE schema_name = $1 OR slug = $1 LIMIT 1`,
      [schema],
    ).catch(() => []);
    return String(rows[0]?.slug || schema);
  }

  private buildInviteLink(tenantSlug: string, token: string): string {
    return buildFrontendPath('/accept-invite', { token, tenant: tenantSlug });
  }

  private async sendInviteEmail(email: string, tenantSlug: string, inviteLink: string): Promise<boolean> {
    const timeoutMs = this.inviteEmailTimeoutMs();
    let timeout: NodeJS.Timeout | undefined;
    const sendPromise = this.mailService.sendInviteEmail({
        to: email,
        tenantName: tenantSlug,
        inviteLink,
      }).then(Boolean).catch(() => false);
    const timeoutPromise = new Promise<boolean>((resolve) => {
      timeout = setTimeout(() => resolve(false), timeoutMs);
    });
    const result = await Promise.race([sendPromise, timeoutPromise]);
    if (timeout) clearTimeout(timeout);
    void sendPromise.catch(() => false);
    return result;
  }

  private inviteEmailTimeoutMs(): number {
    const raw = Number(process.env.TEAM_INVITE_EMAIL_TIMEOUT_MS || process.env.MAIL_SOCKET_TIMEOUT_MS || 15000);
    if (!Number.isFinite(raw)) return 15000;
    return Math.max(1000, Math.min(60000, Math.trunc(raw)));
  }

  private async lockInviteEmail(
    executor: { query: (sql: string, params?: unknown[]) => Promise<any> },
    schema: string,
    email: string,
  ) {
    await executor.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [`${schema}:${email.trim().toLowerCase()}`],
    );
  }

  private async createInviteRecord(
    executor: { query: (sql: string, params?: unknown[]) => Promise<any> },
    schema: string,
    email: string,
    role: string,
    token: string,
    acquireLock = true,
  ) {
    // Serializza create/resend sulla coppia tenant+email. Senza un lock stabile,
    // due transazioni concorrenti potrebbero entrambe invalidare il vecchio
    // invito e poi inserire due nuovi token ancora validi.
    if (acquireLock) await this.lockInviteEmail(executor, schema, email);
    await executor.query(
      `UPDATE "${schema}".invites
       SET accepted_at = now()
       WHERE lower(email) = lower($1)
         AND accepted_at IS NULL`,
      [email],
    );
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const rows = await executor.query(
      `INSERT INTO "${schema}".invites (email, role, token, expires_at, created_at)
       VALUES ($1, $2, $3, $4::timestamptz, now())
       RETURNING expires_at`,
       [email, role, storedInviteToken(token), expiresAt],
    );
    return rows[0]?.expires_at ? new Date(rows[0].expires_at).toISOString() : expiresAt;
  }

  private async notify(schema: string, input: { title: string; body?: string; type?: string; priority?: string; entityType?: string; entityId?: string; role?: string; userId?: string | null; fingerprint: string }) {
    try {
      await this.notifications.createNotification(schema, {
        recipient_user_id: input.userId || null,
        recipient_role: input.role || null,
        title: input.title,
        body: input.body || null,
        type: input.type || 'system',
        priority: input.priority || 'medium',
        entity_type: input.entityType || null,
        entity_id: input.entityId || null,
        link_url: '/team',
        fingerprint: input.fingerprint,
        metadata: {},
      });
    } catch {
      // Le notifiche sono accessorie: non devono bloccare operazioni team.
    }
  }

  async syncUsers() {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await syncTenantUsersToTeamMembers(this.dataSource, schema);
    await seedTenantTeamSkills(this.dataSource, schema);
    await this.activity(schema, 'profile_updated', user, null, 'team_member', null, { sync: 'users' });
    const total = Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".team_members WHERE deleted_at IS NULL`,
    ))[0]?.count || 0);
    return { ok: true, total };
  }

  async listMembers(query: Record<string, any>): Promise<ListResult> {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await syncTenantUsersToTeamMembers(this.dataSource, schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sort = ['display_name', 'email', 'created_at', 'updated_at', 'status', 'operational_role'].includes(String(query.sort || ''))
      ? String(query.sort)
      : 'display_name';
    const where = ['tm.deleted_at IS NULL'];
    const params: unknown[] = [];

    const access = this.memberAccessSql(user, 'tm', params.length + 1);
    where.push(access.sql);
    params.push(...access.params);

    if (query.search) {
      params.push(`%${String(query.search).toLowerCase()}%`);
      where.push(`(lower(tm.email) LIKE $${params.length} OR lower(tm.display_name) LIKE $${params.length} OR lower(COALESCE(tm.job_title, '')) LIKE $${params.length})`);
    }
    for (const field of ['status', 'tenant_role', 'operational_role', 'employment_type', 'availability_status']) {
      if (!query[field]) continue;
      params.push(String(query[field]));
      where.push(`tm.${field} = $${params.length}`);
    }
    if (query.skill) {
      params.push(String(query.skill).toLowerCase());
      where.push(`EXISTS (
        SELECT 1 FROM "${schema}".team_member_skills tms
        JOIN "${schema}".team_skills ts ON ts.id = tms.skill_id
        WHERE tms.team_member_id = tm.id AND tms.deleted_at IS NULL AND ts.deleted_at IS NULL
          AND (lower(ts.slug) = $${params.length} OR lower(ts.name) = $${params.length})
      )`);
    }

    const total = Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "${schema}".team_members tm WHERE ${where.join(' AND ')}`,
      params,
    ))[0]?.total || 0);
    const rows = await this.dataSource.query(
      `SELECT tm.*,
        COALESCE(json_agg(json_build_object('id', ts.id, 'name', ts.name, 'slug', ts.slug, 'category', ts.category, 'level', tms.level)
          ORDER BY ts.name) FILTER (WHERE ts.id IS NOT NULL), '[]') AS skill_items
       FROM "${schema}".team_members tm
       LEFT JOIN "${schema}".team_member_skills tms ON tms.team_member_id = tm.id AND tms.deleted_at IS NULL
       LEFT JOIN "${schema}".team_skills ts ON ts.id = tms.skill_id AND ts.deleted_at IS NULL
       WHERE ${where.join(' AND ')}
       GROUP BY tm.id
       ORDER BY tm.${sort} ASC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return { items: rows.map((row: any) => this.sanitizeMember(row, user)), total, limit, offset };
  }

  async createMember(body: Record<string, any>): Promise<CreateTeamMemberResult> {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const email = this.validateEmail(body.email);
    const displayName = String(body.display_name || body.displayName || email).trim();
    if (!displayName) throw new BadRequestException('display_name obbligatorio');
    const sendInvite = body.send_invite !== false;
    const linkedUserId = !sendInvite && body.user_id
      ? this.requireUuid(String(body.user_id), 'user_id')
      : null;
    const tenantRole = this.normalizeTenantRole(body.tenant_role, user);
    const status = sendInvite ? 'invited' : this.pick(body.status, MEMBER_STATUSES, 'active');
    const identityInspection = inspectPendingDoflowIdentity(body.doflow_identity);
    if (identityInspection.provided && !isDoflowTenant(schema)) {
      throw new BadRequestException('La configurazione identity pre-invito è disponibile soltanto per Doflow.');
    }
    if (
      identityInspection.provided
      && (!identityInspection.validShape
        || identityInspection.invalidRoles.length > 0
        || identityInspection.invalidCapabilities.length > 0)
    ) {
      throw new BadRequestException('Ruoli o capability Doflow non validi.');
    }
    if (identityInspection.provided && !sendInvite && body.user_id) {
      throw new BadRequestException('Usa le API identity per configurare un account già collegato.');
    }
    const metadata = { ...(this.parseCallerMetadata(body.metadata) || {}) };
    if (identityInspection.provided) {
      metadata[PENDING_DOFLOW_IDENTITY_METADATA_KEY] = identityInspection.value;
      await ensureDoflowWorkspaceTables(this.dataSource, schema);
    }
    const modulePermissions = this.normalizeModulePermissionEntries(body.module_permissions, tenantRole);
    const skillIds = this.normalizeSkillIds(body.skill_ids);
    const startDate = this.normalizeNullableDate(body.start_date, 'start_date') ?? null;
    const endDate = this.normalizeNullableDate(body.end_date, 'end_date') ?? null;
    this.assertDateRange(startDate, endDate);
    const capacityHours = this.normalizeNullableNumber(body.capacity_hours_per_week, 'capacity_hours_per_week') ?? null;
    const hourlyRate = this.normalizeNullableNumber(body.hourly_rate_cents, 'hourly_rate_cents', true) ?? null;
    const dailyRate = this.normalizeNullableNumber(body.daily_rate_cents, 'daily_rate_cents', true) ?? null;
    const queryRunner = this.dataSource.createQueryRunner();
    let member: Record<string, any> | null = null;
    let invite: Omit<TeamInviteResult, 'email_sent'> | null = null;
    let inviteEmail: string | null = null;
    let inviteTenantSlug: string | null = null;
    let inviteLink: string | null = null;

    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const existingMember = await queryRunner.manager.query(
        `SELECT id FROM "${schema}".team_members WHERE lower(email) = lower($1) AND deleted_at IS NULL LIMIT 1`,
        [email],
      );
      if (existingMember[0]) throw new BadRequestException('Esiste gia un membro team con questa email.');

      if (sendInvite) {
        const existingUser = await queryRunner.manager.query(
          `SELECT id FROM "${schema}".users WHERE lower(email) = lower($1) LIMIT 1`,
          [email],
        );
        if (existingUser[0]) throw new BadRequestException('Esiste gia un utente tenant con questa email.');
      } else if (linkedUserId) {
        const linkedUsers = await queryRunner.manager.query(
          `SELECT id, email, role, is_active
           FROM "${schema}".users
           WHERE id = $1
           LIMIT 1
           FOR UPDATE`,
          [linkedUserId],
        );
        const linkedUser = linkedUsers[0];
        if (!linkedUser) throw new NotFoundException('Account tenant collegato non trovato');
        if (String(linkedUser.email || '').trim().toLowerCase() !== email) {
          throw new BadRequestException('L\'email del profilo Team non coincide con l\'account tenant collegato.');
        }
      }

      const rows = await queryRunner.manager.query(
        `INSERT INTO "${schema}".team_members (
          user_id, email, display_name, first_name, last_name, phone, tenant_role, job_title, department,
          operational_role, employment_type, status, skills, capacity_hours_per_week, availability_status,
          hourly_rate_cents, daily_rate_cents, currency, start_date, end_date, notes, private_notes,
          metadata, created_by, created_at, updated_at
        )
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::text[],$14,$15,$16,$17,$18,$19,$20,$21,$22,$23::jsonb,$24,now(),now())
        RETURNING *`,
        [
          linkedUserId,
          email,
          displayName,
          this.textOrNull(body.first_name),
          this.textOrNull(body.last_name),
          this.textOrNull(body.phone),
          tenantRole,
          this.textOrNull(body.job_title),
          this.textOrNull(body.department),
          this.pick(body.operational_role, OPERATIONAL_ROLES, 'generic'),
          this.pick(body.employment_type, EMPLOYMENT_TYPES, 'employee'),
          status,
          this.parseStringArray(body.skills),
          capacityHours,
          this.pick(body.availability_status, AVAILABILITY_STATUSES, 'available'),
          hourlyRate,
          dailyRate,
          this.textOrNull(body.currency) || 'EUR',
          startDate,
          endDate,
          this.textOrNull(body.notes),
          this.textOrNull(body.private_notes),
          JSON.stringify(metadata),
          this.userIdOrNull(user.id),
        ],
      );
      member = rows[0];

      await this.insertMemberConfiguration(
        queryRunner.manager,
        schema,
        String(member!.id),
        modulePermissions,
        skillIds,
        user,
      );

      if (sendInvite) {
        const token = this.generateInviteToken();
        const expiresAt = await this.createInviteRecord(queryRunner.manager, schema, email, tenantRole, token);
        inviteTenantSlug = await this.tenantSlugFor(schema);
        inviteLink = this.buildInviteLink(inviteTenantSlug, token);
        inviteEmail = email;
        invite = { invite_link: inviteLink, expires_at: expiresAt };
      }

      await this.activityWith(queryRunner.manager, schema, 'profile_created', user, member!.id, 'team_member', member!.id, {
        invite_created: sendInvite,
        identity_staged: identityInspection.provided,
        module_override_count: modulePermissions.length,
        skill_count: skillIds.length,
      });
      if (identityInspection.provided || modulePermissions.length > 0 || skillIds.length > 0) {
        await this.administrativeAuditWith(
          queryRunner.manager,
          schema,
          'team_member_invite_configuration_staged',
          user,
          String(member!.id),
          {
            identity_role_count: identityInspection.value.roles.length,
            explicit_capability_count: identityInspection.value.capabilities.length,
            module_override_count: modulePermissions.length,
            skill_count: skillIds.length,
          },
        );
      }
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    let emailSent = false;
    if (invite && inviteEmail && inviteTenantSlug && inviteLink) {
      emailSent = await this.sendInviteEmail(inviteEmail, inviteTenantSlug, inviteLink);
    }

    return {
      member: this.sanitizeMember(member!, user),
      invite: invite ? { ...invite, email_sent: emailSent } : null,
    };
  }

  async inviteMember(id: string): Promise<TeamInviteResult> {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const memberId = this.requireUuid(id, 'team_member_id');
    const rows = await this.dataSource.query(
      `SELECT id, email, tenant_role, user_id, status FROM "${schema}".team_members
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [memberId],
    );
    const member = rows[0];
    if (!member) throw new NotFoundException('Membro team non trovato');
    if (member.user_id) throw new BadRequestException('Il membro ha gia un account attivo.');
    const initialEmail = this.validateEmail(member.email);

    const queryRunner = this.dataSource.createQueryRunner();
    let inviteLink = '';
    let expiresAt = '';
    let email = initialEmail;
    const tenantSlug = await this.tenantSlugFor(schema);
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      // Tutte le mutation che possono rendere un invito obsoleto condividono
      // questo lock e lo acquisiscono prima del row lock del membro.
      await this.lockInviteEmail(queryRunner.manager, schema, initialEmail);
      const lockedRows = await queryRunner.manager.query(
        `SELECT id, email, tenant_role, user_id, status
         FROM "${schema}".team_members
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [memberId],
      );
      const lockedMember = lockedRows[0];
      if (!lockedMember) throw new NotFoundException('Membro team non trovato');
      if (lockedMember.user_id) throw new BadRequestException('Il membro ha gia un account attivo.');
      email = this.validateEmail(lockedMember.email);
      if (email !== initialEmail) {
        await this.lockInviteEmail(queryRunner.manager, schema, email);
      }
      const tenantRole = this.normalizeTenantRole(lockedMember.tenant_role || 'user', user);
      const existingUser = await queryRunner.manager.query(
        `SELECT id FROM "${schema}".users WHERE lower(email) = lower($1) LIMIT 1 FOR UPDATE`,
        [email],
      );
      if (existingUser[0]) throw new BadRequestException('Esiste gia un utente tenant con questa email.');

      const token = this.generateInviteToken();
      expiresAt = await this.createInviteRecord(queryRunner.manager, schema, email, tenantRole, token, false);
      await queryRunner.manager.query(
        `UPDATE "${schema}".team_members
         SET status = 'invited',
             tenant_role = $2,
             updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL`,
        [memberId, tenantRole],
      );
      inviteLink = this.buildInviteLink(tenantSlug, token);
      await this.activityWith(queryRunner.manager, schema, 'member_invited', user, memberId, 'team_member', memberId, { email_sent: false });
      await queryRunner.commitTransaction();
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }

    const emailSent = await this.sendInviteEmail(email, tenantSlug, inviteLink);
    if (emailSent) {
      await this.activity(schema, 'member_invite_email_sent', user, memberId, 'team_member', memberId);
    }
    return { email_sent: emailSent, invite_link: inviteLink, expires_at: expiresAt };
  }

  async inviteMemberByEmail(emailValue: unknown): Promise<TeamInviteResult> {
    this.assertCanManage();
    const schema = this.getSchema();
    const email = this.validateEmail(emailValue);
    await syncTenantUsersToTeamMembers(this.dataSource, schema);
    const rows = await this.dataSource.query(
      `SELECT id FROM "${schema}".team_members
       WHERE lower(email) = lower($1) AND deleted_at IS NULL
       LIMIT 1`,
      [email],
    );
    if (!rows[0]) throw new NotFoundException('Membro team non trovato');
    return this.inviteMember(String(rows[0].id));
  }

  async cancelInvite(inviteIdValue: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const inviteId = this.requireUuid(inviteIdValue, 'invite_id');
    const previewRows = await this.dataSource.query(
      `SELECT id, email
       FROM "${schema}".invites
       WHERE id = $1
       LIMIT 1`,
      [inviteId],
    );
    if (!previewRows[0]) throw new NotFoundException('Invito non trovato');
    const initialEmail = this.validateEmail(previewRows[0].email);
    let memberId: string | null = null;

    await this.dataSource.transaction(async (manager) => {
      await this.lockInviteEmail(manager, schema, initialEmail);
      const inviteRows = await manager.query(
        `SELECT id, email, accepted_at
         FROM "${schema}".invites
         WHERE id = $1
         LIMIT 1
         FOR UPDATE`,
        [inviteId],
      );
      if (!inviteRows[0]) throw new NotFoundException('Invito non trovato');
      const email = this.validateEmail(inviteRows[0].email);
      if (email !== initialEmail) {
        await this.lockInviteEmail(manager, schema, email);
      }

      // L'ID legacy identifica la richiesta dell'amministratore, ma la revoca
      // deve coprire ogni token ancora vivo per la stessa identità.
      await manager.query(
        `UPDATE "${schema}".invites
         SET accepted_at = now()
         WHERE lower(email) = lower($1)
           AND accepted_at IS NULL`,
        [email],
      );

      const pendingRows = await manager.query(
        `SELECT id
         FROM "${schema}".team_members
         WHERE lower(email) = lower($1)
           AND user_id IS NULL
           AND deleted_at IS NULL
         LIMIT 1
         FOR UPDATE`,
        [email],
      );
      memberId = pendingRows[0]?.id ? String(pendingRows[0].id) : null;
      if (memberId) {
        await manager.query(
          `UPDATE "${schema}".team_module_permissions
           SET deleted_at = now(), updated_at = now()
           WHERE team_member_id = $1 AND deleted_at IS NULL`,
          [memberId],
        );
        await manager.query(
          `UPDATE "${schema}".team_member_skills
           SET deleted_at = now()
           WHERE team_member_id = $1 AND deleted_at IS NULL`,
          [memberId],
        );
        await manager.query(
          `UPDATE "${schema}".team_members
           SET status = 'archived', deleted_at = now(), updated_at = now()
           WHERE id = $1 AND user_id IS NULL AND deleted_at IS NULL`,
          [memberId],
        );
        await this.activityWith(manager, schema, 'member_invite_cancelled', user, memberId, 'team_member', memberId, {
          invite_id: inviteId,
        });
      }
      await this.administrativeAuditWith(manager, schema, 'team_member_invite_cancelled', user, memberId || inviteId, {
        invite_id: inviteId,
        pending_member_archived: Boolean(memberId),
      });
    });

    return { success: true, invite_id: inviteId, email: initialEmail, member_id: memberId };
  }

  async updateMemberRoleByUserId(userIdValue: string, role: unknown) {
    this.assertCanManage();
    const schema = this.getSchema();
    const userId = this.requireUuid(userIdValue, 'user_id');
    await syncTenantUsersToTeamMembers(this.dataSource, schema);
    const rows = await this.dataSource.query(
      `SELECT id FROM "${schema}".team_members
       WHERE user_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('Membro team non trovato');
    return this.updateMember(String(rows[0].id), { tenant_role: role });
  }

  async deleteMemberByUserId(userIdValue: string) {
    this.assertCanManage();
    const schema = this.getSchema();
    const userId = this.requireUuid(userIdValue, 'user_id');
    await syncTenantUsersToTeamMembers(this.dataSource, schema);
    const rows = await this.dataSource.query(
      `SELECT id FROM "${schema}".team_members
       WHERE user_id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [userId],
    );
    if (!rows[0]) throw new NotFoundException('Membro team non trovato');
    return this.deleteMember(String(rows[0].id));
  }

  async getMember(id: string) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await syncTenantUsersToTeamMembers(this.dataSource, schema);
    const access = this.memberAccessSql(user, 'tm', 2);
    const rows = await this.dataSource.query(
      `SELECT tm.* FROM "${schema}".team_members tm
       WHERE tm.id = $1 AND tm.deleted_at IS NULL AND ${access.sql}
       LIMIT 1`,
      [this.requireUuid(id), ...access.params],
    );
    if (!rows[0]) throw new NotFoundException('Membro team non trovato');
    return this.sanitizeMember(rows[0], user);
  }

  async updateMember(id: string, body: Record<string, any>) {
    const user = this.getUser();
    const schema = this.getSchema();
    const member = await this.getMember(id);
    const isSelf = member.user_id && member.user_id === this.userIdOrNull(user.id);
    const canManage = this.canManageTeam(user.role);
    if (!canManage && !isSelf) throw new ForbiddenException('Puoi modificare solo il tuo profilo.');
    const allowedForSelf = new Set(['display_name', 'first_name', 'last_name', 'phone', 'notes', 'availability_status', 'skills', 'metadata']);
    if (!canManage && Object.entries(body).some(([key, value]) => value !== undefined && !allowedForSelf.has(key))) {
      throw new ForbiddenException('Il campo richiesto richiede amministrazione account.');
    }
    let normalizedEmail: string | undefined;
    if (body.email !== undefined) {
      normalizedEmail = this.validateEmail(body.email);
      const memberEmail = String(member.email || '').trim().toLowerCase();
      if (member.user_id) {
        const accountRows = await this.dataSource.query(
          `SELECT id, email FROM "${schema}".users WHERE id = $1 LIMIT 1`,
          [member.user_id],
        );
        const account = accountRows[0];
        if (!account) throw new NotFoundException('Account tenant collegato non trovato');
        const accountEmail = String(account.email || '').trim().toLowerCase();
        if (normalizedEmail !== accountEmail) {
          throw new BadRequestException('L’email di un account attivo non puo essere modificata dal profilo team.');
        }
        if (memberEmail === accountEmail) {
          normalizedEmail = undefined;
        }
      } else if (normalizedEmail === memberEmail) {
        normalizedEmail = undefined;
      } else {
        const pendingInviteRows = String(member.status || '').trim().toLowerCase() === 'invited'
          ? [{ pending: true }]
          : await this.dataSource.query(
              `SELECT 1 AS pending
               FROM "${schema}".invites
               WHERE lower(email) = lower($1)
                 AND accepted_at IS NULL
               LIMIT 1`,
              [memberEmail],
            );
        if (pendingInviteRows[0]) {
          throw new BadRequestException(
            'L’email di un membro invitato non puo essere modificata: rimuovi il profilo e crea un nuovo invito.',
          );
        }
      }
    }
    await this.ensureSchema(schema);
    const normalizedStartDate = this.normalizeNullableDate(body.start_date, 'start_date');
    const normalizedEndDate = this.normalizeNullableDate(body.end_date, 'end_date');
    const effectiveStartDate = normalizedStartDate !== undefined ? normalizedStartDate : (member.start_date ? String(member.start_date).slice(0, 10) : null);
    const effectiveEndDate = normalizedEndDate !== undefined ? normalizedEndDate : (member.end_date ? String(member.end_date).slice(0, 10) : null);
    this.assertDateRange(effectiveStartDate, effectiveEndDate);
    const requestedRole = canManage && body.tenant_role !== undefined
      ? this.normalizeTenantRole(body.tenant_role, user)
      : undefined;
    const requestedStatus = canManage && body.status !== undefined
      ? this.normalizeLifecycleStatus(body.status)
      : undefined;

    const fields: Array<[string, unknown, string]> = [
      ['email', normalizedEmail, 'email'],
      ['display_name', body.display_name, 'display_name'],
      ['first_name', body.first_name, 'first_name'],
      ['last_name', body.last_name, 'last_name'],
      ['phone', body.phone, 'phone'],
      ['tenant_role', requestedRole, 'tenant_role'],
      ['job_title', body.job_title, 'job_title'],
      ['department', body.department, 'department'],
      ['operational_role', body.operational_role ? this.pick(body.operational_role, OPERATIONAL_ROLES, 'generic') : undefined, 'operational_role'],
      ['employment_type', body.employment_type ? this.pick(body.employment_type, EMPLOYMENT_TYPES, 'employee') : undefined, 'employment_type'],
      ['status', requestedStatus, 'status'],
      ['skills', body.skills !== undefined ? this.parseStringArray(body.skills) : undefined, 'skills'],
      ['capacity_hours_per_week', this.normalizeNullableNumber(body.capacity_hours_per_week, 'capacity_hours_per_week'), 'capacity_hours_per_week'],
      ['availability_status', body.availability_status ? this.pick(body.availability_status, AVAILABILITY_STATUSES, 'available') : undefined, 'availability_status'],
      ['hourly_rate_cents', this.normalizeNullableNumber(body.hourly_rate_cents, 'hourly_rate_cents', true), 'hourly_rate_cents'],
      ['daily_rate_cents', this.normalizeNullableNumber(body.daily_rate_cents, 'daily_rate_cents', true), 'daily_rate_cents'],
      ['currency', body.currency, 'currency'],
      ['start_date', normalizedStartDate, 'start_date'],
      ['end_date', normalizedEndDate, 'end_date'],
      ['notes', body.notes, 'notes'],
      ['private_notes', body.private_notes, 'private_notes'],
      ['metadata', body.metadata !== undefined ? this.parseCallerMetadata(body.metadata) : undefined, 'metadata'],
    ];
    const sets: string[] = [];
    const params: unknown[] = [this.requireUuid(id)];
    for (const [column, value, key] of fields) {
      if (value === undefined) continue;
      if (!canManage && !allowedForSelf.has(key)) continue;
      if (!this.canSeeSensitive(user.role) && ['hourly_rate_cents', 'daily_rate_cents', 'private_notes'].includes(key)) continue;
      params.push(column === 'metadata' ? JSON.stringify(value || {}) : value);
      const cast = column === 'metadata' ? '::jsonb' : column === 'skills' ? '::text[]' : '';
      sets.push(`${column} = $${params.length}${cast}`);
    }
    if (sets.length === 0) return member;

    if (canManage && (
      requestedRole !== undefined
      || requestedStatus !== undefined
      || normalizedEmail !== undefined
    )) {
      let updated: Record<string, any> | null = null;
      let accountUserId: string | null = null;
      await this.dataSource.transaction(async (manager) => {
        await this.lockInviteEmail(manager, schema, String(member.email || '').trim().toLowerCase());
        const lockedRows = await manager.query(
          `SELECT * FROM "${schema}".team_members
           WHERE id = $1 AND deleted_at IS NULL
           FOR UPDATE`,
          [this.requireUuid(id)],
        );
        const lockedMember = lockedRows[0];
        if (!lockedMember) throw new NotFoundException('Membro team non trovato');
        const lockedEmail = this.validateEmail(lockedMember.email);
        const previewEmail = this.validateEmail(member.email);
        if (lockedEmail !== previewEmail) {
          await this.lockInviteEmail(manager, schema, lockedEmail);
        }

        const accountRows = lockedMember.user_id
          ? await manager.query(
              `SELECT id, email, role, is_active FROM "${schema}".users WHERE id = $1 FOR UPDATE`,
              [lockedMember.user_id],
            )
          : [];
        const account = accountRows[0] || null;
        if (lockedMember.user_id && !account) throw new NotFoundException('Account tenant collegato non trovato');
        const currentRole = account?.role || lockedMember.tenant_role;
        this.assertMutableTarget(currentRole);

        if (normalizedEmail !== undefined) {
          if (account) {
            if (normalizedEmail !== String(account.email || '').trim().toLowerCase()) {
              throw new BadRequestException('L’email di un account attivo non puo essere modificata dal profilo team.');
            }
          } else if (normalizedEmail !== lockedEmail) {
            const pendingInviteRows = await manager.query(
              `SELECT 1 AS pending
               FROM "${schema}".invites
               WHERE lower(email) = lower($1)
                 AND accepted_at IS NULL
               LIMIT 1`,
              [lockedEmail],
            );
            if (String(lockedMember.status || '').trim().toLowerCase() === 'invited' || pendingInviteRows[0]) {
              throw new BadRequestException(
                'L’email di un membro invitato non puo essere modificata: rimuovi il profilo e crea un nuovo invito.',
              );
            }
            // Serializza anche rispetto a una creazione/invito concorrente sul
            // nuovo indirizzo prima di affidarsi al vincolo univoco del profilo.
            await this.lockInviteEmail(manager, schema, normalizedEmail);
          }
        }

        const rows = await manager.query(
          `UPDATE "${schema}".team_members SET ${sets.join(', ')}, updated_at = now()
           WHERE id = $1 AND deleted_at IS NULL
           RETURNING *`,
          params,
        );
        updated = rows[0] || null;
        if (!updated) throw new NotFoundException('Membro team non trovato');

        if (account) {
          const accountSets: string[] = [];
          const accountParams: unknown[] = [account.id];
          if (requestedRole !== undefined) {
            accountParams.push(requestedRole);
            accountSets.push(`role = $${accountParams.length}`);
          }
          if (requestedStatus !== undefined) {
            accountParams.push(requestedStatus === 'active');
            accountSets.push(`is_active = $${accountParams.length}`);
          }
          if (accountSets.length) {
            await manager.query(
              `UPDATE "${schema}".users
               SET ${accountSets.join(', ')}, updated_at = now()
               WHERE id = $1`,
              accountParams,
            );
          }
          accountUserId = String(account.id);
        }

        if (requestedStatus && ['inactive', 'suspended'].includes(requestedStatus)) {
          await manager.query(
            `UPDATE "${schema}".invites
             SET accepted_at = now()
             WHERE lower(email) = lower($1)
               AND accepted_at IS NULL`,
            [lockedEmail],
          );
        } else if (requestedRole !== undefined && !account) {
          await manager.query(
            `UPDATE "${schema}".invites
             SET role = $2
             WHERE lower(email) = lower($1)
               AND accepted_at IS NULL`,
            [lockedEmail, requestedRole],
          );
        }

        const changes = {
          before: { tenant_role: currentRole || null, status: lockedMember.status || null },
          after: {
            tenant_role: requestedRole ?? currentRole ?? null,
            status: requestedStatus ?? lockedMember.status ?? null,
          },
        };
        await this.activityWith(manager, schema, 'member_access_updated', user, id, 'team_member', id, changes);
        await this.administrativeAuditWith(manager, schema, 'team_member_access_updated', user, id, changes);
      });
      await this.revokeMemberSessions(schema, accountUserId);
      return this.sanitizeMember(updated!, user);
    }

    const rows = await this.dataSource.query(
      `UPDATE "${schema}".team_members SET ${sets.join(', ')}, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      params,
    );
    await this.activity(schema, 'profile_updated', user, id, 'team_member', id);
    return this.sanitizeMember(rows[0], user);
  }

  async deleteMember(id: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const memberId = this.requireUuid(id);
    const initialMember = await this.getMember(memberId);
    const initialEmail = this.validateEmail(initialMember.email);
    let accountUserId: string | null = null;
    let deletedEmail = '';

    await this.dataSource.transaction(async (manager) => {
      await this.lockInviteEmail(manager, schema, initialEmail);
      const memberRows = await manager.query(
        `SELECT id, user_id, email, tenant_role, status
         FROM "${schema}".team_members
         WHERE id = $1 AND deleted_at IS NULL
         FOR UPDATE`,
        [memberId],
      );
      const member = memberRows[0];
      if (!member) throw new NotFoundException('Membro team non trovato');
      const lockedEmail = this.validateEmail(member.email);
      if (lockedEmail !== initialEmail) {
        await this.lockInviteEmail(manager, schema, lockedEmail);
      }

      const accountRows = member.user_id
        ? await manager.query(
            `SELECT id, role, is_active FROM "${schema}".users WHERE id = $1 FOR UPDATE`,
            [member.user_id],
          )
        : [];
      const account = accountRows[0] || null;
      if (member.user_id && !account) throw new NotFoundException('Account tenant collegato non trovato');
      this.assertMutableTarget(account?.role || member.tenant_role);
      accountUserId = account ? String(account.id) : null;
      deletedEmail = lockedEmail;

      if (account) {
        await manager.query(
          `UPDATE "${schema}".users SET is_active = false, updated_at = now() WHERE id = $1`,
          [account.id],
        );
      }
      await manager.query(
        `UPDATE "${schema}".team_module_permissions
         SET deleted_at = now(), updated_at = now()
         WHERE team_member_id = $1 AND deleted_at IS NULL`,
        [memberId],
      );

      if (account && isDoflowTenant(schema)) {
        if (await this.tableExists(manager, schema, 'doflow_user_roles')) {
          await manager.query(`DELETE FROM "${schema}".doflow_user_roles WHERE user_id = $1`, [account.id]);
        }
        if (await this.tableExists(manager, schema, 'doflow_user_capabilities')) {
          await manager.query(`DELETE FROM "${schema}".doflow_user_capabilities WHERE user_id = $1`, [account.id]);
        }
      }

      await manager.query(
        `UPDATE "${schema}".invites SET accepted_at = now()
         WHERE lower(email) = lower($1) AND accepted_at IS NULL`,
        [deletedEmail],
      );
      if (await this.tableExists(manager, schema, 'password_reset_tokens')) {
        await manager.query(
          `UPDATE "${schema}".password_reset_tokens
           SET invalidated_at = now()
           WHERE lower(email) = lower($1) AND used_at IS NULL AND invalidated_at IS NULL`,
          [deletedEmail],
        );
      }

      const archived = await manager.query(
        `UPDATE "${schema}".team_members
         SET deleted_at = now(), status = 'archived', updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING id`,
        [memberId],
      );
      if (!archived[0]) throw new NotFoundException('Membro team non trovato');
      const metadata = {
        before: { tenant_role: account?.role || member.tenant_role || null, status: member.status || null },
        after: { status: 'archived', account_active: false },
        revoked: ['module_permissions', 'pending_invites', 'password_reset_tokens', 'doflow_roles', 'doflow_capabilities'],
      };
      await this.activityWith(manager, schema, 'member_removed', user, memberId, 'team_member', memberId, metadata);
      await this.administrativeAuditWith(manager, schema, 'team_member_removed', user, memberId, metadata);
    });

    await this.revokeMemberSessions(schema, accountUserId);
    return { success: true, member_id: memberId, email: deletedEmail };
  }

  async listSkills(query: Record<string, any>) {
    this.assertCanRead();
    const schema = this.getSchema();
    await seedTenantTeamSkills(this.dataSource, schema);
    const params: unknown[] = [];
    const where = ['deleted_at IS NULL'];
    if (query.category) {
      params.push(String(query.category));
      where.push(`category = $${params.length}`);
    }
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".team_skills WHERE ${where.join(' AND ')} ORDER BY category ASC NULLS LAST, name ASC`,
      params,
    );
    return { items: rows };
  }

  async createSkill(body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('name obbligatorio');
    const slug = this.textOrNull(body.slug) || name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".team_skills (name, slug, category, description, created_at, updated_at)
       VALUES ($1, $2, $3, $4, now(), now())
       ON CONFLICT (slug) WHERE deleted_at IS NULL DO UPDATE
         SET name = EXCLUDED.name, category = EXCLUDED.category, description = EXCLUDED.description, updated_at = now()
       RETURNING *`,
      [name, slug, this.textOrNull(body.category), this.textOrNull(body.description)],
    );
    await this.activity(schema, 'skill_added', user, null, 'team_skill', rows[0].id);
    return rows[0];
  }

  async updateSkill(id: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    const fields: string[] = [];
    const params: unknown[] = [this.requireUuid(id)];
    for (const field of ['name', 'category', 'description']) {
      if (body[field] === undefined) continue;
      params.push(this.textOrNull(body[field]));
      fields.push(`${field} = $${params.length}`);
    }
    if (fields.length === 0) throw new BadRequestException('Nessun campo da aggiornare');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".team_skills SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Skill non trovata');
    await this.activity(schema, 'skill_added', user, null, 'team_skill', id);
    return rows[0];
  }

  async deleteSkill(id: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.dataSource.query(`UPDATE "${schema}".team_skills SET deleted_at = now() WHERE id = $1 AND deleted_at IS NULL`, [this.requireUuid(id)]);
    await this.activity(schema, 'skill_removed', user, null, 'team_skill', id);
    return { success: true };
  }

  async addMemberSkill(memberId: string, body: Record<string, any>) {
    const user = this.assertCanManageOperations();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getMember(memberId);
    const skillId = this.requireUuid(String(body.skill_id || body.skillId || ''), 'skill_id');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".team_member_skills (team_member_id, skill_id, level, years_experience, notes, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (team_member_id, skill_id) WHERE deleted_at IS NULL DO UPDATE
         SET level = EXCLUDED.level, years_experience = EXCLUDED.years_experience, notes = EXCLUDED.notes
       RETURNING *`,
      [
        this.requireUuid(memberId, 'team_member_id'),
        skillId,
        body.level ? this.pick(body.level, SKILL_LEVELS, 'intermediate') : null,
        body.years_experience === undefined || body.years_experience === '' ? null : Number(body.years_experience),
        this.textOrNull(body.notes),
      ],
    );
    await this.activity(schema, 'skill_added', user, memberId, 'team_skill', skillId);
    return rows[0];
  }

  async removeMemberSkill(memberId: string, skillId: string) {
    const user = this.assertCanManageOperations();
    const schema = this.getSchema();
    await this.getMember(memberId);
    await this.dataSource.query(
      `UPDATE "${schema}".team_member_skills SET deleted_at = now()
       WHERE team_member_id = $1 AND skill_id = $2 AND deleted_at IS NULL`,
      [this.requireUuid(memberId, 'team_member_id'), this.requireUuid(skillId, 'skill_id')],
    );
    await this.activity(schema, 'skill_removed', user, memberId, 'team_skill', skillId);
    return { success: true };
  }

  async listAvailability(query: Record<string, any>): Promise<ListResult> {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const params: unknown[] = [];
    const where = ['a.deleted_at IS NULL'];
    if (!this.isManager(user.role)) {
      const current = await this.currentMember(schema, user);
      if (!current) return { items: [] };
      params.push(current.id);
      where.push(`a.team_member_id = $${params.length}`);
    }
    for (const field of ['team_member_id', 'type', 'status']) {
      if (!query[field]) continue;
      params.push(field === 'team_member_id' ? this.requireUuid(String(query[field]), field) : String(query[field]));
      where.push(`a.${field} = $${params.length}`);
    }
    if (query.date_from) {
      params.push(String(query.date_from));
      where.push(`a.ends_at >= $${params.length}::timestamptz`);
    }
    if (query.date_to) {
      params.push(String(query.date_to));
      where.push(`a.starts_at <= $${params.length}::timestamptz`);
    }
    const rows = await this.dataSource.query(
      `SELECT a.*, tm.display_name, tm.email
       FROM "${schema}".team_availability a
       JOIN "${schema}".team_members tm ON tm.id = a.team_member_id
       WHERE ${where.join(' AND ')}
       ORDER BY a.starts_at ASC
       LIMIT 200`,
      params,
    );
    return { items: rows };
  }

  async createAvailability(body: Record<string, any>) {
    const user = this.assertCanManageOperations();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const memberId = this.requireUuid(String(body.team_member_id || body.teamMemberId || ''), 'team_member_id');
    const starts = new Date(String(body.starts_at || body.startsAt || ''));
    const ends = new Date(String(body.ends_at || body.endsAt || ''));
    if (!Number.isFinite(starts.getTime()) || !Number.isFinite(ends.getTime()) || ends <= starts) {
      throw new BadRequestException('Intervallo disponibilità non valido');
    }
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".team_availability (
        team_member_id, type, title, starts_at, ends_at, capacity_hours, is_all_day, status, notes, created_by, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,now(),now())
      RETURNING *`,
      [
        memberId,
        this.pick(body.type, AVAILABILITY_TYPES, 'unavailable'),
        this.textOrNull(body.title),
        starts.toISOString(),
        ends.toISOString(),
        body.capacity_hours === undefined || body.capacity_hours === '' ? null : Number(body.capacity_hours),
        Boolean(body.is_all_day || body.isAllDay),
        this.pick(body.status, AVAILABILITY_ENTRY_STATUSES, 'confirmed'),
        this.textOrNull(body.notes),
        this.userIdOrNull(user.id),
      ],
    );
    await this.activity(schema, 'availability_created', user, memberId, 'team_availability', rows[0].id);
    if (['vacation', 'sick'].includes(rows[0].type)) {
      await this.notify(schema, {
        role: 'manager',
        title: `Assenza registrata: ${rows[0].type}`,
        body: rows[0].title || rows[0].notes || null,
        type: 'system',
        priority: 'medium',
        entityType: 'team_member',
        entityId: memberId,
        fingerprint: `team_availability:${rows[0].id}`,
      });
    }
    return rows[0];
  }

  async updateAvailability(id: string, body: Record<string, any>) {
    const user = this.assertCanManageOperations();
    const schema = this.getSchema();
    const fields: string[] = [];
    const params: unknown[] = [this.requireUuid(id)];
    const mapping: Record<string, string> = {
      type: 'type',
      title: 'title',
      starts_at: 'starts_at',
      ends_at: 'ends_at',
      capacity_hours: 'capacity_hours',
      is_all_day: 'is_all_day',
      status: 'status',
      notes: 'notes',
    };
    for (const [key, column] of Object.entries(mapping)) {
      if (body[key] === undefined) continue;
      const value = key === 'type' ? this.pick(body[key], AVAILABILITY_TYPES, 'unavailable')
        : key === 'status' ? this.pick(body[key], AVAILABILITY_ENTRY_STATUSES, 'confirmed')
        : body[key];
      params.push(value);
      fields.push(`${column} = $${params.length}`);
    }
    if (fields.length === 0) throw new BadRequestException('Nessun campo da aggiornare');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".team_availability SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Disponibilità non trovata');
    await this.activity(schema, 'availability_updated', user, rows[0].team_member_id, 'team_availability', id);
    return rows[0];
  }

  async deleteAvailability(id: string) {
    const user = this.assertCanManageOperations();
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".team_availability SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      [this.requireUuid(id)],
    );
    if (rows[0]) await this.activity(schema, 'availability_updated', user, rows[0].team_member_id, 'team_availability', id, { deleted: true });
    return { success: true };
  }

  private async timeEntryAccessWhere(user: AuthUser, schema: string, alias: string, params: unknown[]) {
    if (this.isManager(user.role)) return 'TRUE';
    const current = await this.currentMember(schema, user);
    if (!current) return 'FALSE';
    params.push(current.id);
    return `${alias}.team_member_id = $${params.length}`;
  }

  async listTimeEntries(query: Record<string, any>): Promise<ListResult> {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const params: unknown[] = [];
    const where = ['te.deleted_at IS NULL'];
    where.push(await this.timeEntryAccessWhere(user, schema, 'te', params));
    for (const field of ['team_member_id', 'user_id', 'project_id', 'task_id', 'status', 'activity_type']) {
      if (!query[field]) continue;
      params.push(['team_member_id', 'user_id', 'project_id', 'task_id'].includes(field) ? this.requireUuid(String(query[field]), field) : String(query[field]));
      where.push(`te.${field} = $${params.length}`);
    }
    if (query.date_from) {
      params.push(String(query.date_from));
      where.push(`te.entry_date >= $${params.length}::date`);
    }
    if (query.date_to) {
      params.push(String(query.date_to));
      where.push(`te.entry_date <= $${params.length}::date`);
    }
    const total = Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "${schema}".time_entries te WHERE ${where.join(' AND ')}`,
      params,
    ))[0]?.total || 0);
    const rows = await this.dataSource.query(
      `SELECT te.*, tm.display_name, tm.email, p.name AS project_name, t.title AS task_title
       FROM "${schema}".time_entries te
       JOIN "${schema}".team_members tm ON tm.id = te.team_member_id
       LEFT JOIN "${schema}".projects p ON p.id = te.project_id
       LEFT JOIN "${schema}".tasks t ON t.id = te.task_id
       WHERE ${where.join(' AND ')}
       ORDER BY te.entry_date DESC, te.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return { items: rows.map((row: any) => this.sanitizeTimeEntry(row, user)), total, limit, offset };
  }

  private computeDuration(body: Record<string, any>): number {
    if (body.duration_minutes !== undefined && body.duration_minutes !== '') {
      const n = Number(body.duration_minutes);
      if (!Number.isFinite(n) || n < 0) throw new BadRequestException('duration_minutes non valido');
      return Math.trunc(n);
    }
    if (body.started_at && body.ended_at) {
      const start = new Date(String(body.started_at));
      const end = new Date(String(body.ended_at));
      if (!Number.isFinite(start.getTime()) || !Number.isFinite(end.getTime()) || end <= start) {
        throw new BadRequestException('started_at/ended_at non validi');
      }
      return Math.trunc((end.getTime() - start.getTime()) / 60000);
    }
    return 0;
  }

  async createTimeEntry(body: Record<string, any>) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const current = await this.currentMember(schema, user);
    const requestedMemberId = body.team_member_id ? this.requireUuid(String(body.team_member_id), 'team_member_id') : current?.id;
    if (!requestedMemberId) throw new BadRequestException('team_member_id obbligatorio');
    if (!this.isManager(user.role) && current?.id !== requestedMemberId) {
      throw new ForbiddenException('Puoi creare time entry solo per te stesso.');
    }
    const duration = this.computeDuration(body);
    const entryDate = this.textOrNull(body.entry_date) || (body.started_at ? String(body.started_at).slice(0, 10) : new Date().toISOString().slice(0, 10));
    const requestedId = isDoflowTenant(schema) && body.id
      ? this.requireUuid(String(body.id), 'id')
      : null;
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".time_entries (
        ${requestedId ? 'id, ' : ''}team_member_id, user_id, project_id, task_id, company_id, entry_date, started_at, ended_at,
        duration_minutes, activity_type, description, is_billable, status, metadata, created_by, created_at, updated_at
      )
      VALUES (${requestedId ? '$1,' : ''}$${requestedId ? 2 : 1},$${requestedId ? 3 : 2},$${requestedId ? 4 : 3},$${requestedId ? 5 : 4},$${requestedId ? 6 : 5},$${requestedId ? 7 : 6}::date,$${requestedId ? 8 : 7},$${requestedId ? 9 : 8},$${requestedId ? 10 : 9},$${requestedId ? 11 : 10},$${requestedId ? 12 : 11},$${requestedId ? 13 : 12},$${requestedId ? 14 : 13},$${requestedId ? 15 : 14}::jsonb,$${requestedId ? 16 : 15},now(),now())
      RETURNING *`,
      [
        ...(requestedId ? [requestedId] : []),
        requestedMemberId,
        this.userIdOrNull(body.user_id) || (current?.user_id || this.userIdOrNull(user.id)),
        body.project_id ? this.requireUuid(String(body.project_id), 'project_id') : null,
        body.task_id ? this.requireUuid(String(body.task_id), 'task_id') : null,
        body.company_id ? this.requireUuid(String(body.company_id), 'company_id') : null,
        entryDate,
        this.textOrNull(body.started_at),
        this.textOrNull(body.ended_at),
        duration,
        this.pick(body.activity_type, TIME_ACTIVITY_TYPES, 'work'),
        this.textOrNull(body.description),
        Boolean(body.is_billable),
        this.pick(body.status, TIME_STATUSES, 'draft'),
        JSON.stringify(this.parseMetadata(body.metadata) || {}),
        this.userIdOrNull(user.id),
      ],
    );
    await this.activity(schema, 'time_logged', user, requestedMemberId, 'time_entry', rows[0].id);
    return this.sanitizeTimeEntry(rows[0], user);
  }

  async getTimeEntry(id: string) {
    const data = await this.listTimeEntries({ id: this.requireUuid(id), limit: 1 });
    const row = data.items.find((item: any) => item.id === id);
    if (!row) {
      const user = this.assertCanRead();
      const schema = this.getSchema();
      const params: unknown[] = [this.requireUuid(id)];
      const access = await this.timeEntryAccessWhere(user, schema, 'te', params);
      const rows = await this.dataSource.query(
        `SELECT te.* FROM "${schema}".time_entries te WHERE te.id = $1 AND te.deleted_at IS NULL AND ${access} LIMIT 1`,
        params,
      );
      if (!rows[0]) throw new NotFoundException('Time entry non trovata');
      return this.sanitizeTimeEntry(rows[0], user);
    }
    return row;
  }

  async updateTimeEntry(id: string, body: Record<string, any>) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const existing = await this.getTimeEntry(id);
    if (!this.isManager(user.role) && existing.status !== 'draft') throw new ForbiddenException('Puoi modificare solo time entry in bozza.');
    const fields: string[] = [];
    const params: unknown[] = [this.requireUuid(id)];
    const allowed = ['project_id', 'task_id', 'company_id', 'entry_date', 'started_at', 'ended_at', 'activity_type', 'description', 'is_billable', 'metadata'];
    for (const key of allowed) {
      if (body[key] === undefined) continue;
      let value = body[key];
      if (['project_id', 'task_id', 'company_id'].includes(key)) value = value ? this.requireUuid(String(value), key) : null;
      if (key === 'activity_type') value = this.pick(value, TIME_ACTIVITY_TYPES, 'work');
      if (key === 'metadata') value = JSON.stringify(this.parseMetadata(value) || {});
      params.push(value);
      fields.push(`${key} = $${params.length}${key === 'metadata' ? '::jsonb' : ''}`);
    }
    if (body.duration_minutes !== undefined || (body.started_at && body.ended_at)) {
      params.push(this.computeDuration(body));
      fields.push(`duration_minutes = $${params.length}`);
    }
    if (fields.length === 0) return existing;
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".time_entries SET ${fields.join(', ')}, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING *`,
      params,
    );
    await this.activity(schema, 'time_logged', user, rows[0].team_member_id, 'time_entry', id);
    return this.sanitizeTimeEntry(rows[0], user);
  }

  async deleteTimeEntry(id: string) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const existing = await this.getTimeEntry(id);
    if (!this.isManager(user.role) && existing.status !== 'draft') throw new ForbiddenException('Puoi eliminare solo time entry in bozza.');
    await this.dataSource.query(`UPDATE "${schema}".time_entries SET deleted_at = now(), updated_at = now() WHERE id = $1`, [this.requireUuid(id)]);
    return { success: true };
  }

  async setTimeEntryStatus(id: string, status: 'submitted' | 'approved') {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const existing = await this.getTimeEntry(id);
    if (status === 'approved' && !this.canManageTeam(user.role)) throw new ForbiddenException('Solo CEO/Admin possono approvare time entry.');
    if (status === 'submitted' && !this.isManager(user.role) && existing.status !== 'draft') throw new ForbiddenException('Solo bozze possono essere inviate.');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".time_entries
       SET status = $2,
           approved_by = CASE WHEN $2 = 'approved' THEN $3 ELSE approved_by END,
           approved_at = CASE WHEN $2 = 'approved' THEN now() ELSE approved_at END,
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [this.requireUuid(id), status, this.userIdOrNull(user.id)],
    );
    await this.activity(schema, status === 'submitted' ? 'time_submitted' : 'time_approved', user, rows[0].team_member_id, 'time_entry', id);
    if (status === 'submitted') {
      await this.notify(schema, {
        role: 'owner',
        title: 'Time entry da approvare',
        body: rows[0].description || 'Una time entry e stata inviata.',
        type: 'system',
        priority: 'medium',
        entityType: 'team_member',
        entityId: rows[0].team_member_id,
        fingerprint: `time_entry_submitted:${id}`,
      });
    }
    return this.sanitizeTimeEntry(rows[0], user);
  }

  async rejectTimeEntry(id: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    const reason = this.textOrNull(body.rejected_reason || body.reason);
    if (!reason) throw new BadRequestException('rejected_reason obbligatorio');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".time_entries
       SET status = 'rejected', rejected_reason = $2, approved_by = NULL, approved_at = NULL, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [this.requireUuid(id), reason],
    );
    if (!rows[0]) throw new NotFoundException('Time entry non trovata');
    await this.activity(schema, 'time_rejected', user, rows[0].team_member_id, 'time_entry', id, { reason });
    return this.sanitizeTimeEntry(rows[0], user);
  }

  async memberActivity(id: string) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.getMember(id);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".team_activity
       WHERE team_member_id = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [this.requireUuid(id, 'team_member_id')],
    );
    return { items: rows.map((row: any) => this.canSeeSensitive(user.role) ? row : { ...row, metadata: row.metadata || {} }) };
  }

  async getModulePermissions(memberId: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getMember(memberId);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".team_module_permissions
       WHERE team_member_id = $1 AND deleted_at IS NULL
       ORDER BY module_key ASC`,
      [this.requireUuid(memberId, 'team_member_id')],
    );
    return { items: rows, managedByRoleSystem: true };
  }

  async updateModulePermissions(memberId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const member = await this.getMember(memberId);
    const roleRows = member.user_id
      ? await this.dataSource.query(
          `SELECT role FROM "${schema}".users WHERE id = $1 LIMIT 1`,
          [member.user_id],
        )
      : [];
    this.assertMutableTarget(roleRows[0]?.role || member.tenant_role);
    const normalized = this.normalizeModulePermissionEntries(
      body.permissions,
      roleRows[0]?.role || member.tenant_role,
    );
    const id = this.requireUuid(memberId, 'team_member_id');
    await this.dataSource.transaction(async (manager) => {
      for (const entry of normalized) {
        await manager.query(
          `INSERT INTO "${schema}".team_module_permissions (
             team_member_id, module_key, can_view, can_create, can_update, can_delete, can_manage, created_by, created_at, updated_at
           )
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,now(),now())
           ON CONFLICT (team_member_id, module_key) WHERE deleted_at IS NULL DO UPDATE
             SET can_view = EXCLUDED.can_view,
                 can_create = EXCLUDED.can_create,
                 can_update = EXCLUDED.can_update,
                 can_delete = EXCLUDED.can_delete,
                 can_manage = EXCLUDED.can_manage,
                 updated_at = now()`,
          [
            id,
            entry.moduleKey,
            entry.can_view,
            entry.can_create,
            entry.can_update,
            entry.can_delete,
            entry.can_manage,
            this.userIdOrNull(user.id),
          ],
        );
      }
      await this.administrativeAuditWith(manager, schema, 'team_member_module_permissions_updated', user, id, {
        modules: normalized.map((entry) => entry.moduleKey),
      });
    });
    if (member.user_id) {
      await this.revokeMemberSessions(schema, String(member.user_id));
    }
    return this.getModulePermissions(memberId);
  }

  private capacityFor(row: Record<string, any>): number {
    const configured = Number(row.capacity_hours_per_week);
    if (Number.isFinite(configured) && configured > 0) return configured;
    return ['contractor', 'external'].includes(String(row.employment_type || '')) ? 20 : 40;
  }

  async workload(query: Record<string, any> = {}) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await syncTenantUsersToTeamMembers(this.dataSource, schema);
    const memberRows = await this.listMembers({ ...query, limit: query.limit || 100, offset: query.offset || 0 });
    const items = await Promise.all(memberRows.items.map((member: any) => this.computeMemberWorkload(schema, member, user)));
    return { items };
  }

  async memberWorkload(id: string) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    const member = await this.getMember(id);
    return this.computeMemberWorkload(schema, member, user);
  }

  private async computeMemberWorkload(schema: string, member: Record<string, any>, user: AuthUser) {
    const userId = this.userIdOrNull(member.user_id);
    const params = [member.id, userId];
    const taskRows = await this.dataSource.query(
      `SELECT
        COUNT(*) FILTER (WHERE t.deleted_at IS NULL AND lower(COALESCE(t.status, '')) NOT IN ('done', 'closed', 'completed'))::int AS "openTasks",
        COUNT(*) FILTER (WHERE t.deleted_at IS NULL AND lower(COALESCE(t.status, '')) NOT IN ('done', 'closed', 'completed') AND t.due_at < now())::int AS "overdueTasks",
        COUNT(*) FILTER (WHERE t.deleted_at IS NULL AND lower(COALESCE(t.status, '')) NOT IN ('done', 'closed', 'completed') AND t.due_at BETWEEN now() AND now() + INTERVAL '7 days')::int AS "dueSoonTasks",
        COUNT(DISTINCT t.project_id) FILTER (WHERE t.deleted_at IS NULL AND t.project_id IS NOT NULL)::int AS "taskProjects"
       FROM "${schema}".tasks t
       WHERE ($2::uuid IS NOT NULL AND t.assignee_id = $2::uuid)`,
      params,
    ).catch(() => [{ openTasks: 0, overdueTasks: 0, dueSoonTasks: 0, taskProjects: 0 }]);
    const projectRows = await this.dataSource.query(
      `SELECT COUNT(DISTINCT pm.project_id)::int AS count
       FROM "${schema}".project_members pm
         JOIN "${schema}".projects p ON p.id = pm.project_id
         WHERE pm.deleted_at IS NULL AND p.deleted_at IS NULL
           AND pm.user_id = $2::uuid
         AND ${isDoflowTenant(schema)
          ? `lower(COALESCE(p.status, '')) = ANY($3::text[])`
          : `lower(COALESCE(p.status, '')) NOT IN ('closed', 'delivered')`}`,
      isDoflowTenant(schema) ? [...params, PROJECT_ACTIVE_STAGE_ALIASES] : params,
    ).catch(() => [{ count: 0 }]);
    const timeRows = await this.dataSource.query(
      `SELECT
        COALESCE(SUM(duration_minutes) FILTER (WHERE entry_date >= date_trunc('week', current_date)::date), 0)::int AS "week",
        COALESCE(SUM(duration_minutes) FILTER (WHERE entry_date >= date_trunc('month', current_date)::date), 0)::int AS "month"
       FROM "${schema}".time_entries
       WHERE deleted_at IS NULL AND team_member_id = $1`,
      params,
    ).catch(() => [{ week: 0, month: 0 }]);
    const capacity = this.capacityFor(member);
    const loggedHoursThisWeek = Number(timeRows[0]?.week || 0) / 60;
    const openTasks = Number(taskRows[0]?.openTasks || 0);
    const utilizationPercent = Math.min(999, Math.round(((loggedHoursThisWeek + openTasks * 2) / capacity) * 100));
    const warnings: string[] = [];
    if (Number(taskRows[0]?.overdueTasks || 0) > 0) warnings.push('task_scaduti');
    if (utilizationPercent >= 100) warnings.push('sovraccarico');
    if (member.availability_status && member.availability_status !== 'available') warnings.push(`disponibilita_${member.availability_status}`);

    const result: Record<string, any> = {
      team_member_id: member.id,
      display_name: member.display_name,
      email: member.email,
      operational_role: member.operational_role,
      status: member.status,
      availability_status: member.availability_status,
      capacity_hours_per_week: capacity,
      openTasks,
      overdueTasks: Number(taskRows[0]?.overdueTasks || 0),
      dueSoonTasks: Number(taskRows[0]?.dueSoonTasks || 0),
      activeProjects: Number(projectRows[0]?.count || 0) || Number(taskRows[0]?.taskProjects || 0),
      loggedMinutesThisWeek: Number(timeRows[0]?.week || 0),
      loggedMinutesThisMonth: Number(timeRows[0]?.month || 0),
      utilizationPercent,
      isOverloaded: utilizationPercent >= 100,
      warnings,
    };
    if (this.canSeeSensitive(user.role)) {
      result.hourly_rate_cents = member.hourly_rate_cents || null;
      result.daily_rate_cents = member.daily_rate_cents || null;
      result.currency = member.currency || 'EUR';
    }
    return result;
  }

  async summary() {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await syncTenantUsersToTeamMembers(this.dataSource, schema);
    const workload = await this.workload({ limit: 100 });
    const active = workload.items.filter((item: any) => item.status === 'active');
    const rows = await this.dataSource.query(
      `SELECT
        COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS total,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND status = 'active')::int AS active,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND availability_status = 'available')::int AS available,
        COUNT(*) FILTER (WHERE deleted_at IS NULL AND availability_status <> 'available')::int AS unavailable
       FROM "${schema}".team_members`,
    );
    const timeRows = await this.dataSource.query(
      `SELECT
        COALESCE(SUM(duration_minutes) FILTER (WHERE entry_date >= date_trunc('week', current_date)::date), 0)::int AS "week",
        COALESCE(SUM(duration_minutes) FILTER (WHERE entry_date >= date_trunc('month', current_date)::date), 0)::int AS "month",
        COUNT(*) FILTER (WHERE status = 'submitted' AND deleted_at IS NULL)::int AS "pending"
       FROM "${schema}".time_entries
       WHERE deleted_at IS NULL`,
    );
    return {
      teamMembers: Number(rows[0]?.total || 0),
      activeTeamMembers: Number(rows[0]?.active || 0),
      availableTeamMembers: Number(rows[0]?.available || 0),
      unavailableTeamMembers: Number(rows[0]?.unavailable || 0),
      overloadedMembers: workload.items.filter((item: any) => item.isOverloaded).length,
      totalCapacityHours: active.reduce((sum: number, item: any) => sum + Number(item.capacity_hours_per_week || 0), 0),
      loggedHoursThisWeek: Math.round(Number(timeRows[0]?.week || 0) / 60),
      loggedHoursThisMonth: Math.round(Number(timeRows[0]?.month || 0) / 60),
      pendingTimeEntries: Number(timeRows[0]?.pending || 0),
      overdueTasksByTeam: workload.items.reduce((sum: number, item: any) => sum + Number(item.overdueTasks || 0), 0),
      workload: workload.items.sort((a: any, b: any) => Number(b.utilizationPercent || 0) - Number(a.utilizationPercent || 0)).slice(0, 5),
      sources: { teamMembers: true, timeEntries: true, workload: true },
    };
  }

  options() {
    const user = this.assertCanRead();
    return {
      tenantRoles: user.role === 'admin'
        ? ASSIGNABLE_TENANT_ROLES.filter((role) => role !== 'admin')
        : [...ASSIGNABLE_TENANT_ROLES],
      operationalRoles: OPERATIONAL_ROLES,
      employmentTypes: EMPLOYMENT_TYPES,
      memberStatuses: MEMBER_STATUSES,
      availabilityStatuses: AVAILABILITY_STATUSES,
      skillLevels: SKILL_LEVELS,
      availabilityTypes: AVAILABILITY_TYPES,
      availabilityEntryStatuses: AVAILABILITY_ENTRY_STATUSES,
      timeActivityTypes: TIME_ACTIVITY_TYPES,
      timeStatuses: TIME_STATUSES,
      moduleKeys: MODULE_KEYS,
      sensitiveFieldsVisible: this.canSeeSensitive(user.role),
    };
  }
}
