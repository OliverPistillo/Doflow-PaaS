import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  NotImplementedException,
  UnauthorizedException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';
import * as jwt from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import { ensureTenantClientPortalTables } from './tenant-client-portal-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const ACCOUNT_STATUSES = ['invited', 'active', 'suspended', 'disabled'];
const INVITE_STATUSES = ['pending', 'accepted', 'expired', 'revoked'];
const ACCESS_LEVELS = ['viewer', 'commenter', 'approver'];
const APPROVAL_TYPES = [
  'quote_approval',
  'briefing_approval',
  'design_approval',
  'content_approval',
  'milestone_approval',
  'go_live_approval',
  'file_approval',
  'general',
];
const APPROVAL_STATUSES = ['pending', 'approved', 'rejected', 'changes_requested', 'cancelled', 'expired'];
const MATERIAL_TYPES = ['logo', 'images', 'texts', 'credentials', 'domain', 'hosting', 'brand_assets', 'legal_docs', 'generic'];
const MATERIAL_STATUSES = ['requested', 'submitted', 'approved', 'rejected', 'cancelled'];
const MATERIAL_FILE_STATUSES = ['submitted', 'accepted', 'rejected'];
const COMMENT_VISIBILITIES = ['client', 'internal_response'];

type AuthUser = { id: string; email?: string; role: string };
type ClientAccount = {
  id: string;
  company_id?: string | null;
  contact_id?: string | null;
  email: string;
  name?: string | null;
  phone?: string | null;
  status: string;
};
type ClientContext = { schema: string; account: ClientAccount; token: Record<string, any> };

@Injectable()
export class TenantClientPortalService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getInternalUser(): AuthUser {
    const user = this.request.user || this.request.authUser;
    if (!user || String(user.type || '') === 'client_portal') throw new ForbiddenException('Utente interno non valido');
    return {
      id: String(user.sub || user.id || user.userId || ''),
      email: typeof user.email === 'string' ? user.email : undefined,
      role: String(user.role || 'user').toLowerCase().trim(),
    };
  }

  private getInternalSchema(): string {
    const user = this.request.user || this.request.authUser;
    const tenantRef = user?.tenantId || user?.tenant_id || this.request.tenantId;
    const schema = safeSchema(tenantRef || 'public', 'TenantClientPortalService.getInternalSchema');
    if (schema === 'public') throw new ForbiddenException('Client Portal non disponibile nel contesto public');
    return schema;
  }

  private getSchemaFromBody(body?: Record<string, any>): string {
    const tenantRef = this.request.tenantId || body?.tenant || body?.tenantSlug || body?.tenant_schema || body?.schema;
    const schema = safeSchema(tenantRef || 'public', 'TenantClientPortalService.getSchemaFromBody');
    if (schema === 'public') throw new BadRequestException('Tenant richiesto per il portale cliente');
    return schema;
  }

  private assertAdminAccess() {
    const user = this.getInternalUser();
    if (!hasRoleAtLeast(user.role, 'manager')) {
      throw new ForbiddenException('Manager o superiore richiesto per gestire il portale cliente.');
    }
    return user;
  }

  private async ensureSchema(schema: string) {
    await ensureTenantClientPortalTables(this.dataSource, schema);
  }

  private getJwtSecret(): string {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new UnauthorizedException('JWT_SECRET non configurato');
    return secret;
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private generateInviteToken(): string {
    return randomBytes(32).toString('base64url');
  }

  private signClientToken(schema: string, account: ClientAccount): string {
    return jwt.sign(
      {
        type: 'client_portal',
        sub: account.id,
        account_id: account.id,
        company_id: account.company_id || null,
        contact_id: account.contact_id || null,
        email: account.email,
        tenantId: schema,
        tenantSlug: schema,
        tenantSchema: schema,
      },
      this.getJwtSecret(),
      { expiresIn: '7d' },
    );
  }

  private async getClientContext(body?: Record<string, any>): Promise<ClientContext> {
    const auth = String(this.request.headers?.authorization || '');
    if (!auth.toLowerCase().startsWith('bearer ')) throw new UnauthorizedException('Token portale cliente richiesto');
    let payload: any;
    try {
      payload = jwt.verify(auth.slice(7), this.getJwtSecret()) as any;
    } catch {
      throw new UnauthorizedException('Token portale cliente non valido');
    }
    if (payload?.type !== 'client_portal' || !payload.account_id) {
      throw new UnauthorizedException('Token portale cliente non valido');
    }
    const schema = safeSchema(payload.tenantSchema || payload.tenantId || payload.tenantSlug || body?.tenant, 'TenantClientPortalService.getClientContext');
    if (schema === 'public') throw new UnauthorizedException('Tenant cliente non valido');
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT id, company_id, contact_id, email, name, phone, status
       FROM "${schema}".client_portal_accounts
       WHERE id = $1 AND deleted_at IS NULL AND status = 'active'
       LIMIT 1`,
      [payload.account_id],
    );
    if (!rows[0]) throw new UnauthorizedException('Account cliente non attivo');
    return { schema, account: rows[0], token: payload };
  }

  private requireUuid(value: string, label = 'ID'): string {
    if (!UUID_RE.test(String(value))) throw new BadRequestException(`${label} non valido`);
    return String(value);
  }

  private userIdOrNull(value: string): string | null {
    return UUID_RE.test(value) ? value : null;
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

  private enumValue(value: unknown, allowed: string[], fallback: string, message: string): string {
    const text = String(value ?? '').trim();
    if (!text) return fallback;
    if (!allowed.includes(text)) throw new BadRequestException(message);
    return text;
  }

  private validateUuidFields(values: Record<string, unknown>, fields: string[]) {
    for (const field of fields) {
      if (values[field] === '') values[field] = null;
      if (values[field] !== undefined && values[field] !== null && !UUID_RE.test(String(values[field]))) {
        throw new BadRequestException(`${field} non valido`);
      }
    }
  }

  private pick(body: Record<string, any>, fields: string[]) {
    const values: Record<string, any> = {};
    for (const field of fields) {
      if (field in body) values[field] = body[field] === '' ? null : body[field];
    }
    return values;
  }

  private sanitizeAccount(account: Record<string, any>) {
    const { password_hash: _passwordHash, ...safe } = account;
    return safe;
  }

  private sanitizeInvite(invite: Record<string, any>) {
    const { token_hash: _tokenHash, ...safe } = invite;
    return safe;
  }

  private sanitizeProjectForClient(row: Record<string, any>) {
    return {
      id: row.id,
      company_id: row.company_id,
      name: row.name,
      description: row.description,
      type: row.type,
      status: row.status,
      current_phase: row.current_phase,
      progress: Number(row.progress || 0),
      start_date: row.start_date,
      due_date: row.due_date,
      delivered_at: row.delivered_at,
      client_notes: row.client_notes,
      company_name: row.company_name,
      access_level: row.access_level,
      can_view_milestones: row.can_view_milestones,
      can_view_tasks: row.can_view_tasks,
      can_comment: row.can_comment,
      can_upload_files: row.can_upload_files,
      can_approve: row.can_approve,
    };
  }

  private sanitizeMilestoneForClient(row: Record<string, any>) {
    return {
      id: row.id,
      project_id: row.project_id,
      title: row.title,
      description: row.description,
      status: row.status,
      due_date: row.due_date,
      completed_at: row.completed_at,
      sort_order: row.sort_order,
    };
  }

  private sanitizeTaskForClient(row: Record<string, any>) {
    return {
      id: row.id,
      project_id: row.project_id,
      milestone_id: row.milestone_id,
      title: row.title,
      status: row.status,
      priority: row.priority,
      due_at: row.due_at,
      completed_at: row.completed_at,
    };
  }

  private sanitizeApprovalForClient(row: Record<string, any>) {
    return {
      id: row.id,
      company_id: row.company_id,
      contact_id: row.contact_id,
      project_id: row.project_id,
      quote_id: row.quote_id,
      briefing_id: row.briefing_id,
      milestone_id: row.milestone_id,
      task_id: row.task_id,
      file_link_id: row.file_link_id,
      type: row.type,
      title: row.title,
      description: row.description,
      status: row.status,
      due_date: row.due_date,
      approved_at: row.approved_at,
      rejected_at: row.rejected_at,
      changes_requested_at: row.changes_requested_at,
      decision_note: row.decision_note,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private sanitizeMaterialForClient(row: Record<string, any>) {
    return {
      id: row.id,
      company_id: row.company_id,
      contact_id: row.contact_id,
      project_id: row.project_id,
      briefing_id: row.briefing_id,
      title: row.title,
      description: row.description,
      type: row.type,
      status: row.status,
      due_date: row.due_date,
      submitted_at: row.submitted_at,
      approved_at: row.approved_at,
      rejected_at: row.rejected_at,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  private sanitizeFileLinkForClient(row: Record<string, any>) {
    return {
      id: row.id,
      project_id: row.project_id,
      task_id: row.task_id,
      file_id: row.file_id,
      type: row.type,
      visibility: row.visibility,
      created_at: row.created_at,
    };
  }

  async listAccounts(query: Record<string, any>) {
    this.assertAdminAccess();
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    return this.listGeneric(schema, 'client_portal_accounts', query, {
      search: ['email', 'name', 'phone'],
      filters: ['status', 'company_id', 'contact_id'],
      select: `t.*, c.name AS company_name, concat_ws(' ', ct.first_name, ct.last_name) AS contact_name`,
      joins: `
        LEFT JOIN "${schema}".companies c ON c.id = t.company_id
        LEFT JOIN "${schema}".contacts ct ON ct.id = t.contact_id
      `,
      sanitize: (row) => this.sanitizeAccount(row),
    });
  }

  async createAccount(body: Record<string, any>) {
    const user = this.assertAdminAccess();
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanAccountBody(body, false);
    if (body.password) cleaned.password_hash = await bcrypt.hash(String(body.password), 12);
    const row = await this.insertRow(schema, 'client_portal_accounts', {
      ...cleaned,
      created_by: this.userIdOrNull(user.id),
      updated_by: this.userIdOrNull(user.id),
    });
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), action: 'client_account_created', entityType: 'client_portal_account', entityId: row.id });
    return this.getAccount(row.id);
  }

  async getAccount(id: string) {
    this.assertAdminAccess();
    this.requireUuid(id);
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT a.*, c.name AS company_name, concat_ws(' ', ct.first_name, ct.last_name) AS contact_name
       FROM "${schema}".client_portal_accounts a
       LEFT JOIN "${schema}".companies c ON c.id = a.company_id
       LEFT JOIN "${schema}".contacts ct ON ct.id = a.contact_id
       WHERE a.id = $1 AND a.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Account cliente non trovato');
    return this.sanitizeAccount(rows[0]);
  }

  async updateAccount(id: string, body: Record<string, any>) {
    const user = this.assertAdminAccess();
    this.requireUuid(id);
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanAccountBody(body, true);
    if (body.password) cleaned.password_hash = await bcrypt.hash(String(body.password), 12);
    await this.updateRow(schema, 'client_portal_accounts', id, cleaned, this.userIdOrNull(user.id));
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), action: 'client_account_updated', entityType: 'client_portal_account', entityId: id, metadata: cleaned });
    return this.getAccount(id);
  }

  async deleteAccount(id: string) {
    const user = this.assertAdminAccess();
    this.requireUuid(id);
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    await this.softDelete(schema, 'client_portal_accounts', id, this.userIdOrNull(user.id), true);
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), action: 'client_account_deleted', entityType: 'client_portal_account', entityId: id });
    return { success: true };
  }

  async updateAccountStatus(id: string, status: string) {
    if (!ACCOUNT_STATUSES.includes(status)) throw new BadRequestException('Status account cliente non valido');
    return this.updateAccount(id, { status });
  }

  async createInvite(accountId: string, body: Record<string, any>) {
    const user = this.assertAdminAccess();
    this.requireUuid(accountId, 'ID account');
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const account = await this.getAccountInternal(schema, accountId);
    const token = this.generateInviteToken();
    const expiresAt = body.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const row = await this.insertRow(schema, 'client_portal_invites', {
      account_id: accountId,
      company_id: body.company_id || account.company_id || null,
      contact_id: body.contact_id || account.contact_id || null,
      token_hash: this.hashToken(token),
      status: 'pending',
      expires_at: expiresAt,
      created_by: this.userIdOrNull(user.id),
    });
    await this.updateRow(schema, 'client_portal_accounts', accountId, { status: account.status === 'active' ? 'active' : 'invited' }, this.userIdOrNull(user.id));
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), accountId, action: 'client_invite_created', entityType: 'client_portal_invite', entityId: row.id });
    return { invite: this.sanitizeInvite(row), token };
  }

  async listInvites(query: Record<string, any>) {
    this.assertAdminAccess();
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    return this.listGeneric(schema, 'client_portal_invites', query, {
      search: ['status'],
      filters: ['status', 'account_id', 'company_id', 'contact_id'],
      select: `t.*, a.email AS account_email, a.name AS account_name`,
      joins: `LEFT JOIN "${schema}".client_portal_accounts a ON a.id = t.account_id`,
      sanitize: (row) => this.sanitizeInvite(row),
    });
  }

  async revokeInvite(id: string) {
    const user = this.assertAdminAccess();
    this.requireUuid(id);
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".client_portal_invites
       SET status = 'revoked', revoked_at = now()
       WHERE id = $1 AND deleted_at IS NULL AND status = 'pending'
       RETURNING id, account_id`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Invito cliente non trovato o non revocabile');
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), accountId: rows[0].account_id, action: 'client_invite_revoked', entityType: 'client_portal_invite', entityId: id });
    return { success: true };
  }

  async listAccountProjects(accountId: string) {
    this.assertAdminAccess();
    this.requireUuid(accountId, 'ID account');
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT cpa.*, p.name AS project_name, c.name AS company_name
       FROM "${schema}".client_project_access cpa
       LEFT JOIN "${schema}".projects p ON p.id = cpa.project_id
       LEFT JOIN "${schema}".companies c ON c.id = cpa.company_id
       WHERE cpa.account_id = $1 AND cpa.deleted_at IS NULL
       ORDER BY cpa.created_at DESC`,
      [accountId],
    );
    return { items: rows };
  }

  async createProjectAccess(accountId: string, body: Record<string, any>) {
    const user = this.assertAdminAccess();
    this.requireUuid(accountId, 'ID account');
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanProjectAccessBody({ ...body, account_id: accountId }, false);
    const row = await this.insertRow(schema, 'client_project_access', {
      ...cleaned,
      created_by: this.userIdOrNull(user.id),
      updated_by: this.userIdOrNull(user.id),
    }, `ON CONFLICT (account_id, project_id) WHERE deleted_at IS NULL DO UPDATE SET
      access_level = EXCLUDED.access_level,
      company_id = EXCLUDED.company_id,
      can_view_milestones = EXCLUDED.can_view_milestones,
      can_view_tasks = EXCLUDED.can_view_tasks,
      can_comment = EXCLUDED.can_comment,
      can_upload_files = EXCLUDED.can_upload_files,
      can_approve = EXCLUDED.can_approve,
      updated_by = EXCLUDED.updated_by,
      updated_at = now()`);
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), accountId, projectId: cleaned.project_id as string, action: 'client_project_access_upserted', entityType: 'client_project_access', entityId: row.id });
    return this.listAccountProjects(accountId);
  }

  async updateProjectAccess(accessId: string, body: Record<string, any>) {
    const user = this.assertAdminAccess();
    this.requireUuid(accessId, 'ID accesso');
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanProjectAccessBody(body, true);
    await this.updateRow(schema, 'client_project_access', accessId, cleaned, this.userIdOrNull(user.id));
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), action: 'client_project_access_updated', entityType: 'client_project_access', entityId: accessId, metadata: cleaned });
    return { success: true };
  }

  async deleteProjectAccess(accessId: string) {
    const user = this.assertAdminAccess();
    this.requireUuid(accessId, 'ID accesso');
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    await this.softDelete(schema, 'client_project_access', accessId, this.userIdOrNull(user.id), true);
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), action: 'client_project_access_deleted', entityType: 'client_project_access', entityId: accessId });
    return { success: true };
  }

  async listApprovalsAdmin(query: Record<string, any>) {
    this.assertAdminAccess();
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    return this.listGeneric(schema, 'client_approval_requests', query, {
      search: ['title', 'description', 'decision_note'],
      filters: ['status', 'type', 'company_id', 'project_id', 'account_id'],
      select: `t.*, c.name AS company_name, p.name AS project_name, a.email AS account_email`,
      joins: `
        LEFT JOIN "${schema}".companies c ON c.id = t.company_id
        LEFT JOIN "${schema}".projects p ON p.id = t.project_id
        LEFT JOIN "${schema}".client_portal_accounts a ON a.id = t.account_id
      `,
    });
  }

  async createApproval(body: Record<string, any>) {
    const user = this.assertAdminAccess();
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanApprovalBody(body, false);
    const row = await this.insertRow(schema, 'client_approval_requests', {
      ...cleaned,
      created_by: this.userIdOrNull(user.id),
      updated_by: this.userIdOrNull(user.id),
    });
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), accountId: cleaned.account_id as string | null, projectId: cleaned.project_id as string | null, action: 'client_approval_created', entityType: 'client_approval_request', entityId: row.id });
    return this.getApprovalAdmin(row.id);
  }

  async getApprovalAdmin(id: string) {
    this.assertAdminAccess();
    this.requireUuid(id);
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT ar.*, c.name AS company_name, p.name AS project_name, a.email AS account_email
       FROM "${schema}".client_approval_requests ar
       LEFT JOIN "${schema}".companies c ON c.id = ar.company_id
       LEFT JOIN "${schema}".projects p ON p.id = ar.project_id
       LEFT JOIN "${schema}".client_portal_accounts a ON a.id = ar.account_id
       WHERE ar.id = $1 AND ar.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Richiesta approvazione non trovata');
    return rows[0];
  }

  async updateApproval(id: string, body: Record<string, any>) {
    const user = this.assertAdminAccess();
    this.requireUuid(id);
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanApprovalBody(body, true);
    await this.updateRow(schema, 'client_approval_requests', id, cleaned, this.userIdOrNull(user.id));
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), action: 'client_approval_updated', entityType: 'client_approval_request', entityId: id, metadata: cleaned });
    return this.getApprovalAdmin(id);
  }

  async deleteApproval(id: string) {
    const user = this.assertAdminAccess();
    this.requireUuid(id);
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    await this.softDelete(schema, 'client_approval_requests', id, this.userIdOrNull(user.id), true);
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), action: 'client_approval_deleted', entityType: 'client_approval_request', entityId: id });
    return { success: true };
  }

  async updateApprovalStatus(id: string, status: string, note?: string) {
    if (!APPROVAL_STATUSES.includes(status)) throw new BadRequestException('Status approvazione non valido');
    const patch: Record<string, any> = { status };
    if (note !== undefined) patch.decision_note = note;
    return this.updateApproval(id, patch);
  }

  async listMaterialsAdmin(query: Record<string, any>) {
    this.assertAdminAccess();
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    return this.listGeneric(schema, 'client_material_requests', query, {
      search: ['title', 'description'],
      filters: ['status', 'type', 'company_id', 'project_id', 'account_id', 'briefing_id'],
      select: `t.*, c.name AS company_name, p.name AS project_name, a.email AS account_email`,
      joins: `
        LEFT JOIN "${schema}".companies c ON c.id = t.company_id
        LEFT JOIN "${schema}".projects p ON p.id = t.project_id
        LEFT JOIN "${schema}".client_portal_accounts a ON a.id = t.account_id
      `,
    });
  }

  async createMaterial(body: Record<string, any>) {
    const user = this.assertAdminAccess();
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanMaterialBody(body, false);
    const row = await this.insertRow(schema, 'client_material_requests', {
      ...cleaned,
      created_by: this.userIdOrNull(user.id),
      updated_by: this.userIdOrNull(user.id),
    });
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), accountId: cleaned.account_id as string | null, projectId: cleaned.project_id as string | null, action: 'client_material_request_created', entityType: 'client_material_request', entityId: row.id });
    return row;
  }

  async updateMaterial(id: string, body: Record<string, any>) {
    const user = this.assertAdminAccess();
    this.requireUuid(id);
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanMaterialBody(body, true);
    await this.updateRow(schema, 'client_material_requests', id, cleaned, this.userIdOrNull(user.id));
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), action: 'client_material_request_updated', entityType: 'client_material_request', entityId: id, metadata: cleaned });
    return { success: true };
  }

  async deleteMaterial(id: string) {
    const user = this.assertAdminAccess();
    this.requireUuid(id);
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    await this.softDelete(schema, 'client_material_requests', id, this.userIdOrNull(user.id), true);
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), action: 'client_material_request_deleted', entityType: 'client_material_request', entityId: id });
    return { success: true };
  }

  async updateMaterialStatus(id: string, status: string) {
    if (!MATERIAL_STATUSES.includes(status)) throw new BadRequestException('Status materiale non valido');
    const patch: Record<string, any> = { status };
    if (status === 'submitted') patch.submitted_at = new Date().toISOString();
    if (status === 'approved') patch.approved_at = new Date().toISOString();
    if (status === 'rejected') patch.rejected_at = new Date().toISOString();
    return this.updateMaterial(id, patch);
  }

  async listCommentsAdmin(query: Record<string, any>) {
    this.assertAdminAccess();
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    return this.listGeneric(schema, 'client_portal_comments', query, {
      search: ['body'],
      filters: ['account_id', 'company_id', 'project_id', 'approval_request_id', 'material_request_id'],
      select: `t.*, a.email AS account_email, u.email AS user_email`,
      joins: `
        LEFT JOIN "${schema}".client_portal_accounts a ON a.id = t.created_by_account_id
        LEFT JOIN "${schema}".users u ON u.id = t.created_by_user_id
      `,
    });
  }

  async createCommentAdmin(body: Record<string, any>) {
    const user = this.assertAdminAccess();
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanCommentBody(body, false, false);
    const row = await this.insertRow(schema, 'client_portal_comments', {
      ...cleaned,
      visibility: this.enumValue(cleaned.visibility, COMMENT_VISIBILITIES, 'internal_response', 'Visibilita commento non valida'),
      created_by_user_id: this.userIdOrNull(user.id),
      updated_by_user_id: this.userIdOrNull(user.id),
    });
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), accountId: cleaned.account_id as string | null, projectId: cleaned.project_id as string | null, action: 'client_comment_admin_created', entityType: 'client_portal_comment', entityId: row.id });
    return row;
  }

  async deleteCommentAdmin(id: string) {
    const user = this.assertAdminAccess();
    this.requireUuid(id);
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    await this.softDelete(schema, 'client_portal_comments', id, this.userIdOrNull(user.id), true);
    await this.portalAudit(schema, { userId: this.userIdOrNull(user.id), action: 'client_comment_deleted', entityType: 'client_portal_comment', entityId: id });
    return { success: true };
  }

  async adminSummary() {
    this.assertAdminAccess();
    const schema = this.getInternalSchema();
    await this.ensureSchema(schema);
    const [
      accountsTotal,
      accountsActive,
      invitesPending,
      approvalsPending,
      approvalsChangesRequested,
      materialsRequested,
      materialsSubmitted,
      commentsRecentCount,
      projectsSharedCount,
    ] = await Promise.all([
      this.count(schema, 'client_portal_accounts'),
      this.count(schema, 'client_portal_accounts', `status = 'active'`),
      this.count(schema, 'client_portal_invites', `status = 'pending' AND expires_at > now()`),
      this.count(schema, 'client_approval_requests', `status = 'pending'`),
      this.count(schema, 'client_approval_requests', `status = 'changes_requested'`),
      this.count(schema, 'client_material_requests', `status = 'requested'`),
      this.count(schema, 'client_material_requests', `status = 'submitted'`),
      this.count(schema, 'client_portal_comments', `created_at >= now() - INTERVAL '14 days'`),
      this.count(schema, 'client_project_access'),
    ]);
    return {
      accounts_total: accountsTotal,
      accounts_active: accountsActive,
      invites_pending: invitesPending,
      approvals_pending: approvalsPending,
      approvals_changes_requested: approvalsChangesRequested,
      materials_requested: materialsRequested,
      materials_submitted: materialsSubmitted,
      comments_recent_count: commentsRecentCount,
      projects_shared_count: projectsSharedCount,
    };
  }

  async acceptInvite(body: Record<string, any>) {
    const token = String(body.token || '').trim();
    if (!token) throw new BadRequestException('token obbligatorio');
    const schema = this.getSchemaFromBody(body);
    await this.ensureSchema(schema);
    const tokenHash = this.hashToken(token);
    const rows = await this.dataSource.query(
      `SELECT i.*, a.email, a.name, a.phone, a.status AS account_status
       FROM "${schema}".client_portal_invites i
       JOIN "${schema}".client_portal_accounts a ON a.id = i.account_id
       WHERE i.token_hash = $1 AND i.deleted_at IS NULL AND a.deleted_at IS NULL
       LIMIT 1`,
      [tokenHash],
    );
    const invite = rows[0];
    if (!invite) throw new UnauthorizedException('Invito cliente non valido');
    if (invite.status !== 'pending') throw new BadRequestException('Invito cliente non utilizzabile');
    if (new Date(invite.expires_at).getTime() <= Date.now()) {
      await this.dataSource.query(`UPDATE "${schema}".client_portal_invites SET status = 'expired' WHERE id = $1`, [invite.id]);
      throw new BadRequestException('Invito cliente scaduto');
    }
    const passwordHash = body.password ? await bcrypt.hash(String(body.password), 12) : null;
    const accountRows = await this.dataSource.query(
      `UPDATE "${schema}".client_portal_accounts
       SET status = 'active',
           name = COALESCE($2, name),
           password_hash = COALESCE($3, password_hash),
           accepted_terms_at = COALESCE(accepted_terms_at, now()),
           last_login_at = now(),
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, company_id, contact_id, email, name, phone, status`,
      [invite.account_id, this.textOrNull(body.name), passwordHash],
    );
    await this.dataSource.query(
      `UPDATE "${schema}".client_portal_invites
       SET status = 'accepted', accepted_at = now()
       WHERE id = $1`,
      [invite.id],
    );
    const account = accountRows[0];
    await this.portalAudit(schema, { accountId: account.id, companyId: account.company_id, action: 'client_invite_accepted', entityType: 'client_portal_invite', entityId: invite.id });
    return { account: this.sanitizeAccount(account), accessToken: this.signClientToken(schema, account) };
  }

  async login(body: Record<string, any>) {
    const schema = this.getSchemaFromBody(body);
    await this.ensureSchema(schema);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!email || !password) throw new BadRequestException('email e password obbligatorie');
    const rows = await this.dataSource.query(
      `SELECT id, company_id, contact_id, email, name, phone, status, password_hash
       FROM "${schema}".client_portal_accounts
       WHERE lower(email) = lower($1) AND deleted_at IS NULL
       LIMIT 1`,
      [email],
    );
    const account = rows[0];
    if (!account || account.status !== 'active' || !account.password_hash) throw new UnauthorizedException('Credenziali cliente non valide');
    if (!(await bcrypt.compare(password, account.password_hash))) throw new UnauthorizedException('Credenziali cliente non valide');
    await this.dataSource.query(`UPDATE "${schema}".client_portal_accounts SET last_login_at = now(), updated_at = now() WHERE id = $1`, [account.id]);
    await this.portalAudit(schema, { accountId: account.id, companyId: account.company_id, action: 'client_login', entityType: 'client_portal_account', entityId: account.id });
    return { account: this.sanitizeAccount(account), accessToken: this.signClientToken(schema, account) };
  }

  async magicLogin() {
    throw new NotImplementedException('Magic login senza email non implementato in questa fase.');
  }

  async me() {
    const { account } = await this.getClientContext();
    return { account: this.sanitizeAccount(account) };
  }

  async listClientProjects() {
    const { schema, account } = await this.getClientContext();
    const rows = await this.dataSource.query(
      `SELECT p.*, c.name AS company_name, cpa.access_level, cpa.can_view_milestones,
              cpa.can_view_tasks, cpa.can_comment, cpa.can_upload_files, cpa.can_approve
       FROM "${schema}".client_project_access cpa
       JOIN "${schema}".projects p ON p.id = cpa.project_id
       LEFT JOIN "${schema}".companies c ON c.id = p.company_id
       WHERE cpa.account_id = $1 AND cpa.deleted_at IS NULL AND p.deleted_at IS NULL
       ORDER BY p.updated_at DESC`,
      [account.id],
    );
    return { items: rows.map((row: any) => this.sanitizeProjectForClient(row)) };
  }

  async getClientProject(projectId: string) {
    const { schema, account } = await this.getClientContext();
    const access = await this.requireProjectAccess(schema, account, projectId);
    return this.sanitizeProjectForClient(access);
  }

  async listClientMilestones(projectId: string) {
    const { schema, account } = await this.getClientContext();
    const access = await this.requireProjectAccess(schema, account, projectId);
    if (!access.can_view_milestones) return { items: [] };
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".milestones
       WHERE project_id = $1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, due_date ASC NULLS LAST`,
      [projectId],
    );
    return { items: rows.map((row: any) => this.sanitizeMilestoneForClient(row)) };
  }

  async listClientTasks(projectId: string) {
    const { schema, account } = await this.getClientContext();
    const access = await this.requireProjectAccess(schema, account, projectId);
    if (!access.can_view_tasks) return { items: [] };
    const rows = await this.dataSource.query(
      `SELECT DISTINCT t.*
       FROM "${schema}".tasks t
       JOIN "${schema}".client_approval_requests ar ON ar.task_id = t.id AND ar.deleted_at IS NULL
       WHERE t.project_id = $1
         AND t.deleted_at IS NULL
         AND (ar.account_id = $2 OR ar.account_id IS NULL)
       ORDER BY t.due_at ASC NULLS LAST, t.created_at DESC`,
      [projectId, account.id],
    );
    return { items: rows.map((row: any) => this.sanitizeTaskForClient(row)) };
  }

  async listClientFiles(projectId: string) {
    const { schema, account } = await this.getClientContext();
    await this.requireProjectAccess(schema, account, projectId);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".project_file_links
       WHERE project_id = $1 AND visibility = 'client' AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [projectId],
    );
    return { items: rows.map((row: any) => this.sanitizeFileLinkForClient(row)) };
  }

  async listClientApprovals(query: Record<string, any>) {
    const { schema, account } = await this.getClientContext();
    const { where, params } = this.clientApprovalWhere(schema, account, query);
    const rows = await this.dataSource.query(
      `SELECT ar.*
       FROM "${schema}".client_approval_requests ar
       WHERE ${where}
       ORDER BY ar.due_date ASC NULLS LAST, ar.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, this.normalizeLimit(query.limit), this.normalizeOffset(query.offset)],
    );
    return { items: rows.map((row: any) => this.sanitizeApprovalForClient(row)) };
  }

  async getClientApproval(id: string) {
    const { schema, account } = await this.getClientContext();
    const approval = await this.getVisibleApproval(schema, account, id);
    return this.sanitizeApprovalForClient(approval);
  }

  async decideApproval(id: string, decision: 'approved' | 'rejected' | 'changes_requested', body: Record<string, any>) {
    const { schema, account } = await this.getClientContext();
    const approval = await this.getVisibleApproval(schema, account, id, true);
    const timestamps: Record<string, string> = {
      approved: 'approved_at',
      rejected: 'rejected_at',
      changes_requested: 'changes_requested_at',
    };
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".client_approval_requests
       SET status = $1,
           ${timestamps[decision]} = now(),
           decided_by_account_id = $2,
           decision_note = $3,
           updated_at = now()
       WHERE id = $4 AND deleted_at IS NULL
       RETURNING *`,
      [decision, account.id, this.textOrNull(body.decision_note || body.note), approval.id],
    );
    await this.portalAudit(schema, { accountId: account.id, companyId: account.company_id || null, projectId: approval.project_id || null, action: `client_approval_${decision}`, entityType: 'client_approval_request', entityId: approval.id, metadata: { decisionNote: Boolean(body.decision_note || body.note) } });
    return this.sanitizeApprovalForClient(rows[0]);
  }

  async listClientMaterialRequests(query: Record<string, any>) {
    const { schema, account } = await this.getClientContext();
    const where = ['m.deleted_at IS NULL', '(m.account_id = $1 OR m.company_id = $2 OR EXISTS (SELECT 1 FROM "' + schema + '".client_project_access cpa WHERE cpa.project_id = m.project_id AND cpa.account_id = $1 AND cpa.deleted_at IS NULL))'];
    const params: unknown[] = [account.id, account.company_id || null];
    if (query.status) {
      params.push(query.status);
      where.push(`m.status = $${params.length}`);
    }
    const rows = await this.dataSource.query(
      `SELECT m.*
       FROM "${schema}".client_material_requests m
       WHERE ${where.join(' AND ')}
       ORDER BY m.due_date ASC NULLS LAST, m.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, this.normalizeLimit(query.limit), this.normalizeOffset(query.offset)],
    );
    return { items: rows.map((row: any) => this.sanitizeMaterialForClient(row)) };
  }

  async submitClientMaterial(id: string, body: Record<string, any>) {
    const { schema, account } = await this.getClientContext();
    const material = await this.getVisibleMaterial(schema, account, id);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".client_material_requests
       SET status = 'submitted', submitted_at = now(), updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [material.id],
    );
    if (body.notes) {
      await this.insertRow(schema, 'client_portal_comments', {
        account_id: account.id,
        company_id: account.company_id || material.company_id || null,
        project_id: material.project_id || null,
        material_request_id: material.id,
        body: String(body.notes),
        visibility: 'client',
        created_by_account_id: account.id,
      });
    }
    await this.portalAudit(schema, { accountId: account.id, companyId: account.company_id || null, projectId: material.project_id || null, action: 'client_material_submitted', entityType: 'client_material_request', entityId: material.id });
    return this.sanitizeMaterialForClient(rows[0]);
  }

  async addClientMaterialFile(id: string, body: Record<string, any>) {
    const { schema, account } = await this.getClientContext();
    const material = await this.getVisibleMaterial(schema, account, id);
    const fileId = body.file_id ? this.requireUuid(String(body.file_id), 'file_id') : null;
    const row = await this.insertRow(schema, 'client_material_files', {
      material_request_id: material.id,
      project_id: material.project_id || null,
      account_id: account.id,
      file_id: fileId,
      original_filename: this.textOrNull(body.original_filename),
      notes: this.textOrNull(body.notes),
      status: this.enumValue(body.status, MATERIAL_FILE_STATUSES, 'submitted', 'Status file materiale non valido'),
    });
    await this.portalAudit(schema, { accountId: account.id, companyId: account.company_id || null, projectId: material.project_id || null, action: 'client_material_file_added', entityType: 'client_material_file', entityId: row.id });
    return row;
  }

  async listClientComments(query: Record<string, any>) {
    const { schema, account } = await this.getClientContext();
    const where = ['c.deleted_at IS NULL', "c.visibility IN ('client', 'internal_response')", this.clientCommentScopeSql(schema, account, 1)];
    const params: unknown[] = [account.id, account.company_id || null];
    for (const field of ['project_id', 'approval_request_id', 'material_request_id']) {
      if (!query[field]) continue;
      params.push(query[field]);
      where.push(`c.${field} = $${params.length}`);
    }
    const rows = await this.dataSource.query(
      `SELECT c.*
       FROM "${schema}".client_portal_comments c
       WHERE ${where.join(' AND ')}
       ORDER BY c.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, this.normalizeLimit(query.limit), this.normalizeOffset(query.offset)],
    );
    return { items: rows };
  }

  async createClientComment(body: Record<string, any>) {
    const { schema, account } = await this.getClientContext();
    const cleaned = this.cleanCommentBody(body, false, true);
    await this.assertClientCommentTargetAccess(schema, account, cleaned);
    const row = await this.insertRow(schema, 'client_portal_comments', {
      ...cleaned,
      account_id: account.id,
      company_id: cleaned.company_id || account.company_id || null,
      visibility: 'client',
      created_by_account_id: account.id,
    });
    await this.portalAudit(schema, { accountId: account.id, companyId: account.company_id || null, projectId: cleaned.project_id as string | null, action: 'client_comment_created', entityType: 'client_portal_comment', entityId: row.id });
    return row;
  }

  async clientSummary() {
    const { schema, account } = await this.getClientContext();
    const projectsRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".client_project_access WHERE account_id = $1 AND deleted_at IS NULL`,
      [account.id],
    );
    const [approvalsPending, approvalsChangesRequested, materialsRequested, materialsSubmitted, recentComments] = await Promise.all([
      this.countClientApprovals(schema, account, 'pending'),
      this.countClientApprovals(schema, account, 'changes_requested'),
      this.countClientMaterials(schema, account, 'requested'),
      this.countClientMaterials(schema, account, 'submitted'),
      this.countClientComments(schema, account),
    ]);
    return {
      projects_count: Number(projectsRows[0]?.count || 0),
      approvals_pending: approvalsPending,
      approvals_changes_requested: approvalsChangesRequested,
      materials_requested: materialsRequested,
      materials_submitted: materialsSubmitted,
      recent_comments_count: recentComments,
    };
  }

  private cleanAccountBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, ['company_id', 'contact_id', 'email', 'name', 'phone', 'status', 'accepted_terms_at', 'magic_login_enabled']);
    if (!partial || 'email' in cleaned) {
      const email = String(cleaned.email || '').trim().toLowerCase();
      if (!email) throw new BadRequestException('email obbligatoria');
      cleaned.email = email;
    }
    if (!partial || 'status' in cleaned) cleaned.status = this.enumValue(cleaned.status, ACCOUNT_STATUSES, 'invited', 'Status account cliente non valido');
    if ('magic_login_enabled' in cleaned) cleaned.magic_login_enabled = Boolean(cleaned.magic_login_enabled);
    this.validateUuidFields(cleaned, ['company_id', 'contact_id']);
    return cleaned;
  }

  private cleanProjectAccessBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, [
      'account_id', 'company_id', 'project_id', 'access_level',
      'can_view_milestones', 'can_view_tasks', 'can_comment', 'can_upload_files', 'can_approve',
    ]);
    if (!partial || 'account_id' in cleaned) this.requireUuid(String(cleaned.account_id || ''), 'account_id');
    if (!partial || 'project_id' in cleaned) this.requireUuid(String(cleaned.project_id || ''), 'project_id');
    if (!partial || 'access_level' in cleaned) cleaned.access_level = this.enumValue(cleaned.access_level, ACCESS_LEVELS, 'viewer', 'Livello accesso cliente non valido');
    for (const flag of ['can_view_milestones', 'can_view_tasks', 'can_comment', 'can_upload_files', 'can_approve']) {
      if (flag in cleaned) cleaned[flag] = Boolean(cleaned[flag]);
    }
    this.validateUuidFields(cleaned, ['account_id', 'company_id', 'project_id']);
    return cleaned;
  }

  private cleanApprovalBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, [
      'company_id', 'contact_id', 'account_id', 'project_id', 'quote_id', 'briefing_id',
      'milestone_id', 'task_id', 'file_link_id', 'type', 'title', 'description', 'status',
      'due_date', 'decision_note', 'internal_notes',
    ]);
    if (!partial || 'title' in cleaned) {
      const title = this.textOrNull(cleaned.title);
      if (!title) throw new BadRequestException('title obbligatorio');
      cleaned.title = title;
    }
    if (!partial || 'type' in cleaned) cleaned.type = this.enumValue(cleaned.type, APPROVAL_TYPES, 'general', 'Tipo approvazione non valido');
    if (!partial || 'status' in cleaned) cleaned.status = this.enumValue(cleaned.status, APPROVAL_STATUSES, 'pending', 'Status approvazione non valido');
    this.validateUuidFields(cleaned, ['company_id', 'contact_id', 'account_id', 'project_id', 'quote_id', 'briefing_id', 'milestone_id', 'task_id', 'file_link_id']);
    return cleaned;
  }

  private cleanMaterialBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, [
      'company_id', 'contact_id', 'account_id', 'project_id', 'briefing_id',
      'title', 'description', 'type', 'status', 'due_date', 'internal_notes',
    ]);
    if (!partial || 'title' in cleaned) {
      const title = this.textOrNull(cleaned.title);
      if (!title) throw new BadRequestException('title obbligatorio');
      cleaned.title = title;
    }
    if (!partial || 'type' in cleaned) cleaned.type = this.enumValue(cleaned.type, MATERIAL_TYPES, 'generic', 'Tipo materiale non valido');
    if (!partial || 'status' in cleaned) cleaned.status = this.enumValue(cleaned.status, MATERIAL_STATUSES, 'requested', 'Status materiale non valido');
    this.validateUuidFields(cleaned, ['company_id', 'contact_id', 'account_id', 'project_id', 'briefing_id']);
    return cleaned;
  }

  private cleanCommentBody(body: Record<string, any>, partial: boolean, client: boolean) {
    const cleaned = this.pick(body, [
      'account_id', 'company_id', 'project_id', 'approval_request_id', 'material_request_id',
      'task_id', 'milestone_id', 'file_link_id', 'body', 'visibility',
    ]);
    if (!partial || 'body' in cleaned) {
      const text = this.textOrNull(cleaned.body);
      if (!text) throw new BadRequestException('body obbligatorio');
      cleaned.body = text;
    }
    if (client) delete cleaned.visibility;
    if (!client && 'visibility' in cleaned) cleaned.visibility = this.enumValue(cleaned.visibility, COMMENT_VISIBILITIES, 'internal_response', 'Visibilita commento non valida');
    this.validateUuidFields(cleaned, ['account_id', 'company_id', 'project_id', 'approval_request_id', 'material_request_id', 'task_id', 'milestone_id', 'file_link_id']);
    return cleaned;
  }

  private async listGeneric(
    schema: string,
    table: string,
    query: Record<string, any>,
    config: {
      search: string[];
      filters: string[];
      select?: string;
      joins?: string;
      sanitize?: (row: Record<string, any>) => Record<string, any>;
    },
  ) {
    const where = ['t.deleted_at IS NULL'];
    const params: unknown[] = [];
    const search = String(query.search || '').trim();
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(${config.search.map((field) => `lower(coalesce(t.${field}::text, '')) LIKE $${params.length}`).join(' OR ')})`);
    }
    for (const field of config.filters) {
      if (query[field] === undefined || query[field] === null || query[field] === '') continue;
      params.push(query[field]);
      where.push(`t.${field} = $${params.length}`);
    }
    if (query.due_from) {
      params.push(query.due_from);
      where.push(`COALESCE(t.due_date, t.created_at::date) >= $${params.length}`);
    }
    if (query.due_to) {
      params.push(query.due_to);
      where.push(`COALESCE(t.due_date, t.created_at::date) <= $${params.length}`);
    }
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const countRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "${schema}".${table} t ${config.joins || ''} WHERE ${where.join(' AND ')}`,
      params,
    );
    const rows = await this.dataSource.query(
      `SELECT ${config.select || 't.*'}
       FROM "${schema}".${table} t
       ${config.joins || ''}
       WHERE ${where.join(' AND ')}
       ORDER BY t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return {
      items: rows.map((row: any) => config.sanitize ? config.sanitize(row) : row),
      total: Number(countRows[0]?.total || 0),
      limit,
      offset,
    };
  }

  private async insertRow(schema: string, table: string, values: Record<string, unknown>, conflictClause = '') {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined);
    const columns = entries.map(([field]) => field);
    const params = entries.map(([, value]) => value);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".${table} (${columns.join(', ')})
       VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
       ${conflictClause}
       RETURNING *`,
      params,
    );
    return rows[0];
  }

  private async updateRow(schema: string, table: string, id: string, values: Record<string, unknown>, updatedBy: string | null) {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return;
    const sets = entries.map(([field], index) => `${field} = $${index + 1}`);
    const params = entries.map(([, value]) => value);
    sets.push(`updated_by = $${params.length + 1}`);
    params.push(updatedBy);
    sets.push('updated_at = now()');
    params.push(id);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".${table}
       SET ${sets.join(', ')}
       WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING id`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Risorsa non trovata');
  }

  private async softDelete(schema: string, table: string, id: string, updatedBy: string | null, hasUpdatedBy: boolean) {
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".${table}
       SET deleted_at = now()${hasUpdatedBy ? ', updated_by = $2, updated_at = now()' : ''}
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      hasUpdatedBy ? [id, updatedBy] : [id],
    );
    if (!rows[0]) throw new NotFoundException('Risorsa non trovata');
  }

  private async count(schema: string, table: string, where = 'TRUE', params: unknown[] = []) {
    const rows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".${table} WHERE deleted_at IS NULL AND (${where})`,
      params,
    );
    return Number(rows[0]?.count || 0);
  }

  private async getAccountInternal(schema: string, accountId: string) {
    const rows = await this.dataSource.query(
      `SELECT id, company_id, contact_id, email, name, phone, status
       FROM "${schema}".client_portal_accounts
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [accountId],
    );
    if (!rows[0]) throw new NotFoundException('Account cliente non trovato');
    return rows[0];
  }

  private async requireProjectAccess(schema: string, account: ClientAccount, projectId: string) {
    this.requireUuid(projectId, 'ID progetto');
    const rows = await this.dataSource.query(
      `SELECT p.*, c.name AS company_name, cpa.access_level, cpa.can_view_milestones,
              cpa.can_view_tasks, cpa.can_comment, cpa.can_upload_files, cpa.can_approve
       FROM "${schema}".client_project_access cpa
       JOIN "${schema}".projects p ON p.id = cpa.project_id
       LEFT JOIN "${schema}".companies c ON c.id = p.company_id
       WHERE cpa.account_id = $1 AND cpa.project_id = $2
         AND cpa.deleted_at IS NULL AND p.deleted_at IS NULL
       LIMIT 1`,
      [account.id, projectId],
    );
    if (!rows[0]) throw new NotFoundException('Progetto non disponibile per questo account');
    return rows[0];
  }

  private clientApprovalWhere(schema: string, account: ClientAccount, query: Record<string, any>) {
    const params: unknown[] = [account.id, account.company_id || null];
    const where = [
      'ar.deleted_at IS NULL',
      `(ar.account_id = $1
        OR ar.company_id = $2
        OR EXISTS (
          SELECT 1 FROM "${schema}".client_project_access cpa
          WHERE cpa.project_id = ar.project_id AND cpa.account_id = $1 AND cpa.deleted_at IS NULL
        ))`,
    ];
    if (query.status) {
      params.push(query.status);
      where.push(`ar.status = $${params.length}`);
    }
    if (query.project_id) {
      params.push(query.project_id);
      where.push(`ar.project_id = $${params.length}`);
    }
    return { where: where.join(' AND '), params };
  }

  private async getVisibleApproval(schema: string, account: ClientAccount, id: string, requireApprove = false) {
    this.requireUuid(id, 'ID approvazione');
    const rows = await this.dataSource.query(
      `SELECT ar.*
       FROM "${schema}".client_approval_requests ar
       WHERE ar.id = $1
         AND ar.deleted_at IS NULL
         AND (
           ar.account_id = $2
           OR ar.company_id = $3
           OR EXISTS (
             SELECT 1 FROM "${schema}".client_project_access cpa
             WHERE cpa.project_id = ar.project_id
               AND cpa.account_id = $2
               AND cpa.deleted_at IS NULL
               ${requireApprove ? 'AND cpa.can_approve = true' : ''}
           )
         )
       LIMIT 1`,
      [id, account.id, account.company_id || null],
    );
    if (!rows[0]) throw new NotFoundException('Approvazione non disponibile');
    if (requireApprove && rows[0].account_id && rows[0].account_id !== account.id) {
      throw new ForbiddenException('Non puoi decidere questa approvazione');
    }
    return rows[0];
  }

  private async getVisibleMaterial(schema: string, account: ClientAccount, id: string) {
    this.requireUuid(id, 'ID richiesta materiale');
    const rows = await this.dataSource.query(
      `SELECT m.*
       FROM "${schema}".client_material_requests m
       WHERE m.id = $1
         AND m.deleted_at IS NULL
         AND (
           m.account_id = $2
           OR m.company_id = $3
           OR EXISTS (
             SELECT 1 FROM "${schema}".client_project_access cpa
             WHERE cpa.project_id = m.project_id AND cpa.account_id = $2 AND cpa.deleted_at IS NULL
           )
         )
       LIMIT 1`,
      [id, account.id, account.company_id || null],
    );
    if (!rows[0]) throw new NotFoundException('Richiesta materiale non disponibile');
    return rows[0];
  }

  private clientCommentScopeSql(schema: string, account: ClientAccount, accountParam: number) {
    const companyParam = accountParam + 1;
    return `(c.created_by_account_id = $${accountParam}
      OR c.account_id = $${accountParam}
      OR c.company_id = $${companyParam}
      OR EXISTS (
        SELECT 1 FROM "${schema}".client_project_access cpa
        WHERE cpa.project_id = c.project_id AND cpa.account_id = $${accountParam} AND cpa.deleted_at IS NULL
      ))`;
  }

  private async assertClientCommentTargetAccess(schema: string, account: ClientAccount, body: Record<string, any>) {
    if (body.project_id) {
      const access = await this.requireProjectAccess(schema, account, String(body.project_id));
      if (!access.can_comment) throw new ForbiddenException('Commenti non abilitati su questo progetto');
      return;
    }
    if (body.approval_request_id) {
      await this.getVisibleApproval(schema, account, String(body.approval_request_id));
      return;
    }
    if (body.material_request_id) {
      await this.getVisibleMaterial(schema, account, String(body.material_request_id));
      return;
    }
    throw new BadRequestException('Il commento deve essere collegato a progetto, approvazione o richiesta materiale');
  }

  private async countClientApprovals(schema: string, account: ClientAccount, status: string) {
    const rows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM "${schema}".client_approval_requests ar
       WHERE ar.deleted_at IS NULL
         AND ar.status = $3
         AND (
           ar.account_id = $1 OR ar.company_id = $2
           OR EXISTS (SELECT 1 FROM "${schema}".client_project_access cpa WHERE cpa.project_id = ar.project_id AND cpa.account_id = $1 AND cpa.deleted_at IS NULL)
         )`,
      [account.id, account.company_id || null, status],
    );
    return Number(rows[0]?.count || 0);
  }

  private async countClientMaterials(schema: string, account: ClientAccount, status: string) {
    const rows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM "${schema}".client_material_requests m
       WHERE m.deleted_at IS NULL
         AND m.status = $3
         AND (
           m.account_id = $1 OR m.company_id = $2
           OR EXISTS (SELECT 1 FROM "${schema}".client_project_access cpa WHERE cpa.project_id = m.project_id AND cpa.account_id = $1 AND cpa.deleted_at IS NULL)
         )`,
      [account.id, account.company_id || null, status],
    );
    return Number(rows[0]?.count || 0);
  }

  private async countClientComments(schema: string, account: ClientAccount) {
    const rows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM "${schema}".client_portal_comments c
       WHERE c.deleted_at IS NULL
         AND c.created_at >= now() - INTERVAL '14 days'
         AND c.visibility IN ('client', 'internal_response')
         AND ${this.clientCommentScopeSql(schema, account, 1)}`,
      [account.id, account.company_id || null],
    );
    return Number(rows[0]?.count || 0);
  }

  private async portalAudit(schema: string, values: {
    accountId?: string | null;
    userId?: string | null;
    companyId?: string | null;
    projectId?: string | null;
    action: string;
    entityType?: string;
    entityId?: string;
    metadata?: Record<string, unknown>;
  }) {
    try {
      await this.dataSource.query(
        `INSERT INTO "${schema}".client_portal_audit_log (
           account_id, user_id, company_id, project_id, action, entity_type,
           entity_id, metadata, ip_address, user_agent, created_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9, $10, now())`,
        [
          values.accountId || null,
          values.userId || null,
          values.companyId || null,
          values.projectId || null,
          values.action,
          values.entityType || null,
          values.entityId || null,
          JSON.stringify(values.metadata || {}),
          this.request.ip || this.request.headers?.['x-forwarded-for'] || null,
          this.request.headers?.['user-agent'] || null,
        ],
      );
    } catch {
      // Audit non bloccante per tenant legacy.
    }
  }
}
