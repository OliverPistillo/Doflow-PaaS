import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import * as crypto from 'crypto';
import { safeSchema } from '../common/schema.utils';
import { buildFrontendPath } from '../common/public-url.utils';
import { hasRoleAtLeast } from '../roles';
import { MailService } from '../mail/mail.service';
import {
  ensureTenantTeamTables,
  seedTenantTeamSkills,
  syncTenantUsersToTeamMembers,
} from './tenant-team-schema';
import { TenantNotificationsService } from './tenant-notifications.service';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ADMIN_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin']);
const TEAM_ROLES = ['owner', 'admin', 'manager', 'editor', 'viewer', 'user', 'superadmin', 'super_admin'];
const INVITABLE_TENANT_ROLES = ['admin', 'manager', 'editor', 'user', 'viewer'];
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
  'crm',
  'briefing',
  'quotes',
  'projects',
  'documents',
  'notifications',
  'finance',
  'team',
  'reports',
  'settings',
  'credentials',
  'credentials.read',
  'credentials.create',
  'credentials.edit',
  'credentials.reveal',
  'credentials.manage_permissions',
  'credentials.audit',
];

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
    const role = String(value || 'user').trim().toLowerCase();
    if (['owner', 'superadmin', 'super_admin', 'ceo'].includes(role)) {
      throw new BadRequestException('Ruolo tenant non consentito per invito team');
    }
    if (!INVITABLE_TENANT_ROLES.includes(role)) throw new BadRequestException('tenant_role non valido');
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

  private async createInviteRecord(executor: { query: (sql: string, params?: unknown[]) => Promise<any> }, schema: string, email: string, role: string, token: string) {
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
      [email, role, token, expiresAt],
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
    const tenantRole = this.normalizeTenantRole(body.tenant_role, user);
    const status = sendInvite ? 'invited' : this.pick(body.status, MEMBER_STATUSES, 'active');
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
          sendInvite ? null : (body.user_id ? this.requireUuid(String(body.user_id), 'user_id') : null),
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
          body.capacity_hours_per_week === undefined || body.capacity_hours_per_week === '' ? null : Number(body.capacity_hours_per_week),
          this.pick(body.availability_status, AVAILABILITY_STATUSES, 'available'),
          body.hourly_rate_cents === undefined || body.hourly_rate_cents === '' ? null : Number(body.hourly_rate_cents),
          body.daily_rate_cents === undefined || body.daily_rate_cents === '' ? null : Number(body.daily_rate_cents),
          this.textOrNull(body.currency) || 'EUR',
          this.textOrNull(body.start_date),
          this.textOrNull(body.end_date),
          this.textOrNull(body.notes),
          this.textOrNull(body.private_notes),
          JSON.stringify(this.parseMetadata(body.metadata) || {}),
          this.userIdOrNull(user.id),
        ],
      );
      member = rows[0];

      if (sendInvite) {
        const token = this.generateInviteToken();
        const expiresAt = await this.createInviteRecord(queryRunner.manager, schema, email, tenantRole, token);
        inviteTenantSlug = await this.tenantSlugFor(schema);
        inviteLink = this.buildInviteLink(inviteTenantSlug, token);
        inviteEmail = email;
        invite = { invite_link: inviteLink, expires_at: expiresAt };
      }

      await this.activityWith(queryRunner.manager, schema, 'profile_created', user, member!.id, 'team_member', member!.id, { invite_created: sendInvite });
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
    const email = this.validateEmail(member.email);
    const tenantRole = this.normalizeTenantRole(member.tenant_role || 'user', user);
    const existingUser = await this.dataSource.query(
      `SELECT id FROM "${schema}".users WHERE lower(email) = lower($1) LIMIT 1`,
      [email],
    );
    if (existingUser[0]) throw new BadRequestException('Esiste gia un utente tenant con questa email.');

    const queryRunner = this.dataSource.createQueryRunner();
    let inviteLink = '';
    let expiresAt = '';
    const tenantSlug = await this.tenantSlugFor(schema);
    await queryRunner.connect();
    await queryRunner.startTransaction();
    try {
      const token = this.generateInviteToken();
      expiresAt = await this.createInviteRecord(queryRunner.manager, schema, email, tenantRole, token);
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
    if (!this.canManageTeam(user.role) && !isSelf) throw new ForbiddenException('Puoi modificare solo il tuo profilo.');
    await this.ensureSchema(schema);

    const allowedForSelf = new Set(['display_name', 'first_name', 'last_name', 'phone', 'notes', 'availability_status', 'skills', 'metadata']);
    const fields: Array<[string, unknown, string]> = [
      ['email', body.email ? String(body.email).toLowerCase() : undefined, 'email'],
      ['display_name', body.display_name, 'display_name'],
      ['first_name', body.first_name, 'first_name'],
      ['last_name', body.last_name, 'last_name'],
      ['phone', body.phone, 'phone'],
      ['tenant_role', body.tenant_role, 'tenant_role'],
      ['job_title', body.job_title, 'job_title'],
      ['department', body.department, 'department'],
      ['operational_role', body.operational_role ? this.pick(body.operational_role, OPERATIONAL_ROLES, 'generic') : undefined, 'operational_role'],
      ['employment_type', body.employment_type ? this.pick(body.employment_type, EMPLOYMENT_TYPES, 'employee') : undefined, 'employment_type'],
      ['status', body.status ? this.pick(body.status, MEMBER_STATUSES, 'active') : undefined, 'status'],
      ['skills', body.skills !== undefined ? this.parseStringArray(body.skills) : undefined, 'skills'],
      ['capacity_hours_per_week', body.capacity_hours_per_week === undefined ? undefined : Number(body.capacity_hours_per_week), 'capacity_hours_per_week'],
      ['availability_status', body.availability_status ? this.pick(body.availability_status, AVAILABILITY_STATUSES, 'available') : undefined, 'availability_status'],
      ['hourly_rate_cents', body.hourly_rate_cents === undefined ? undefined : Number(body.hourly_rate_cents), 'hourly_rate_cents'],
      ['daily_rate_cents', body.daily_rate_cents === undefined ? undefined : Number(body.daily_rate_cents), 'daily_rate_cents'],
      ['currency', body.currency, 'currency'],
      ['start_date', body.start_date, 'start_date'],
      ['end_date', body.end_date, 'end_date'],
      ['notes', body.notes, 'notes'],
      ['private_notes', body.private_notes, 'private_notes'],
      ['metadata', body.metadata !== undefined ? this.parseMetadata(body.metadata) : undefined, 'metadata'],
    ];
    const sets: string[] = [];
    const params: unknown[] = [this.requireUuid(id)];
    for (const [column, value, key] of fields) {
      if (value === undefined) continue;
      if (!this.canManageTeam(user.role) && !allowedForSelf.has(key)) continue;
      if (!this.canSeeSensitive(user.role) && ['hourly_rate_cents', 'daily_rate_cents', 'private_notes'].includes(key)) continue;
      params.push(column === 'metadata' ? JSON.stringify(value || {}) : value);
      const cast = column === 'metadata' ? '::jsonb' : column === 'skills' ? '::text[]' : '';
      sets.push(`${column} = $${params.length}${cast}`);
    }
    if (sets.length === 0) return member;
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
    await this.dataSource.query(
      `UPDATE "${schema}".team_members SET deleted_at = now(), status = 'archived', updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [this.requireUuid(id)],
    );
    await this.activity(schema, 'status_changed', user, id, 'team_member', id, { status: 'archived' });
    return { success: true };
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
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".time_entries (
        team_member_id, user_id, project_id, task_id, company_id, entry_date, started_at, ended_at,
        duration_minutes, activity_type, description, is_billable, status, metadata, created_by, created_at, updated_at
      )
      VALUES ($1,$2,$3,$4,$5,$6::date,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,now(),now())
      RETURNING *`,
      [
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
    const entries = Array.isArray(body.permissions) ? body.permissions : [];
    for (const entry of entries) {
      const moduleKey = String(entry.module_key || entry.moduleKey || '').trim();
      if (!MODULE_KEYS.includes(moduleKey)) continue;
      await this.dataSource.query(
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
          this.requireUuid(memberId, 'team_member_id'),
          moduleKey,
          Boolean(entry.can_view),
          Boolean(entry.can_create),
          Boolean(entry.can_update),
          Boolean(entry.can_delete),
          Boolean(entry.can_manage),
          this.userIdOrNull(user.id),
        ],
      );
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
         AND lower(COALESCE(p.status, '')) NOT IN ('closed', 'delivered')`,
      params,
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
    this.assertCanRead();
    return {
      tenantRoles: TEAM_ROLES,
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
      sensitiveFieldsVisible: this.canSeeSensitive(this.getUser().role),
    };
  }
}
