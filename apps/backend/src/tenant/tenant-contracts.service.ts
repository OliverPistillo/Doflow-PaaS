import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, EntityManager } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import {
  ensureTenantContractsTables,
  seedDoflowContractTemplates,
  STANDARD_CONTRACT_CHECKLIST,
  STANDARD_PAPERWORK_ITEMS,
} from './tenant-contracts-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin']);
const CONTRACT_STATUSES = ['draft', 'preparing', 'sent', 'in_review', 'approved', 'signed', 'active', 'expired', 'cancelled', 'archived'];
const SIGNATURE_STATUSES = ['not_started', 'internal_pending', 'client_pending', 'partially_signed', 'completed', 'declined', 'not_required'];
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const CONTRACT_TYPES = ['website', 'ecommerce', 'maintenance', 'consulting', 'nda', 'privacy', 'generic'];
const TEMPLATE_CATEGORIES = ['website', 'ecommerce', 'maintenance', 'consulting', 'nda', 'privacy', 'generic', 'general'];
const CHECKLIST_CATEGORIES = ['document', 'approval', 'legal', 'finance', 'technical', 'content', 'access', 'other'];
const CHECKLIST_STATUSES = ['missing', 'requested', 'received', 'in_review', 'approved', 'rejected', 'not_applicable'];
const SIGNER_TYPES = ['internal', 'client', 'other'];
const SIGNER_STATUSES = ['pending', 'viewed', 'signed', 'declined', 'not_required'];
const VERSION_STATUSES = ['draft', 'review', 'final', 'signed_snapshot', 'archived'];
const DOSSIER_TYPES = ['onboarding', 'project_start', 'contract', 'billing', 'compliance', 'delivery', 'renewal', 'generic'];
const DOSSIER_STATUSES = ['open', 'in_progress', 'waiting', 'completed', 'blocked', 'archived'];
const PAPERWORK_CATEGORIES = ['document', 'data', 'approval', 'finance', 'legal', 'technical', 'access', 'content', 'privacy', 'other'];
const SORT_COLUMNS = ['created_at', 'updated_at', 'due_date', 'renewal_date', 'title', 'status', 'priority'];

type AuthUser = { id: string; email?: string; role: string };

@Injectable()
export class TenantContractsService {
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
    const schema = safeSchema(tenantRef || 'public', 'TenantContractsService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Contratti tenant non disponibili nel contesto public');
    return schema;
  }

  private async ensureSchema(schema: string) {
    await ensureTenantContractsTables(this.dataSource, schema);
  }

  private canView(role: string): boolean {
    return ['owner', 'admin', 'superadmin', 'super_admin', 'manager', 'editor', 'user', 'viewer'].includes(role);
  }

  private canManage(role: string): boolean {
    return hasRoleAtLeast(role, 'manager');
  }

  private canAdmin(role: string): boolean {
    return ADMIN_ROLES.has(role);
  }

  private canViewFinance(role: string): boolean {
    return this.canAdmin(role);
  }

  private assertCanView(user = this.getUser()) {
    if (!this.canView(user.role)) throw new ForbiddenException('Non hai accesso a contratti e scartoffie.');
    return user;
  }

  private assertCanManage(user = this.getUser()) {
    if (!this.canManage(user.role)) throw new ForbiddenException('Non hai permessi per modificare contratti e scartoffie.');
    return user;
  }

  private assertAdmin(user = this.getUser()) {
    if (!this.canAdmin(user.role)) throw new ForbiddenException('Operazione disponibile solo per CEO/Admin.');
    return user;
  }

  private textOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private requireUuid(value: unknown, label = 'ID'): string {
    const text = String(value || '');
    if (!UUID_RE.test(text)) throw new BadRequestException(`${label} non valido`);
    return text;
  }

  private userIdOrNull(value: unknown): string | null {
    const text = String(value || '');
    return UUID_RE.test(text) ? text : null;
  }

  private normalizeEnum(value: unknown, allowed: string[], fallback: string, label: string): string {
    const text = String(value || fallback).trim();
    if (!allowed.includes(text)) throw new BadRequestException(`${label} non valido`);
    return text;
  }

  private normalizeOptionalEnum(value: unknown, allowed: string[], label: string): string | null {
    const text = this.textOrNull(value);
    if (!text) return null;
    if (!allowed.includes(text)) throw new BadRequestException(`${label} non valido`);
    return text;
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

  private normalizeDate(value: unknown, label: string): string | null {
    const text = this.textOrNull(value);
    if (!text) return null;
    const date = new Date(text);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} non valida`);
    return date.toISOString().slice(0, 10);
  }

  private normalizeAmount(value: unknown): number | null {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) throw new BadRequestException('amount non valido');
    return n;
  }

  private parseJson(value: unknown, fallback: unknown = null): unknown {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch {
      throw new BadRequestException('JSON non valido');
    }
  }

  private sanitizeContract(row: any, user: AuthUser) {
    if (!row) return row;
    const safe = { ...row };
    if (!this.canViewFinance(user.role)) {
      safe.amount = null;
      delete safe.payment_terms;
      delete safe.internal_notes;
    }
    return safe;
  }

  private sanitizeDossier(row: any, user: AuthUser) {
    if (!row) return row;
    const safe = { ...row };
    if (!this.canViewFinance(user.role) && safe.category === 'finance') delete safe.notes;
    return safe;
  }

  private async tableExists(schema: string, table: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1`,
      [schema, table],
    );
    return rows.length > 0;
  }

  private async logContractActivity(manager: EntityManager | DataSource, schema: string, contractId: string | null, user: AuthUser, action: string, metadata: Record<string, unknown> = {}, entityType?: string, entityId?: string | null) {
    await manager.query(
      `INSERT INTO "${schema}".contract_activity (contract_id, action, actor_user_id, entity_type, entity_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())`,
      [contractId, action, this.userIdOrNull(user.id), entityType || null, entityId || null, JSON.stringify(metadata)],
    );
  }

  private async logPaperworkActivity(manager: EntityManager | DataSource, schema: string, dossierId: string | null, user: AuthUser, action: string, metadata: Record<string, unknown> = {}, entityType?: string, entityId?: string | null) {
    await manager.query(
      `INSERT INTO "${schema}".paperwork_activity (dossier_id, action, actor_user_id, entity_type, entity_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())`,
      [dossierId, action, this.userIdOrNull(user.id), entityType || null, entityId || null, JSON.stringify(metadata)],
    );
  }

  private async nextContractNumber(manager: EntityManager | DataSource, schema: string): Promise<string> {
    const year = new Date().getUTCFullYear();
    const rows = await manager.query(
      `SELECT contract_number
       FROM "${schema}".contracts
       WHERE deleted_at IS NULL AND contract_number LIKE $1
       ORDER BY contract_number DESC
       LIMIT 1`,
      [`CTR-${year}-%`],
    );
    const last = String(rows[0]?.contract_number || '');
    const lastNumber = Number(last.split('-').pop() || 0);
    return `CTR-${year}-${String((Number.isFinite(lastNumber) ? lastNumber : 0) + 1).padStart(4, '0')}`;
  }

  private async getTemplate(manager: EntityManager | DataSource, schema: string, templateId?: string | null, contractType?: string | null) {
    if (templateId) {
      const rows = await manager.query(
        `SELECT id, name, body_markdown, variables, default_checklist
         FROM "${schema}".contract_templates
         WHERE id = $1 AND deleted_at IS NULL`,
        [this.requireUuid(templateId, 'template_id')],
      );
      return rows[0] || null;
    }
    const rows = await manager.query(
      `SELECT id, name, body_markdown, variables, default_checklist
       FROM "${schema}".contract_templates
       WHERE deleted_at IS NULL AND is_active = true AND category = $1
       ORDER BY created_at ASC
       LIMIT 1`,
      [contractType || 'generic'],
    );
    return rows[0] || null;
  }

  private checklistFromTemplate(template: any): string[] {
    if (Array.isArray(template?.default_checklist)) return template.default_checklist.map(String);
    return STANDARD_CONTRACT_CHECKLIST;
  }

  private async createInitialVersionAndChecklist(
    manager: EntityManager | DataSource,
    schema: string,
    contractId: string,
    user: AuthUser,
    title: string,
    template: any,
    bodyOverride?: string | null,
  ) {
    await manager.query(
      `INSERT INTO "${schema}".contract_versions (
         contract_id, version_number, title, body_markdown, variables, status, change_note, created_by, created_at
       ) VALUES ($1, 1, $2, $3, $4::jsonb, 'draft', 'Versione iniziale', $5, now())`,
      [
        contractId,
        title,
        bodyOverride || template?.body_markdown || '# Contratto\n\nBozza operativa interna.',
        JSON.stringify(template?.variables || {}),
        this.userIdOrNull(user.id),
      ],
    );
    for (const checklistTitle of this.checklistFromTemplate(template)) {
      await manager.query(
        `INSERT INTO "${schema}".contract_checklist_items (
           contract_id, title, category, is_required, status, created_by, created_at, updated_at
         ) VALUES ($1, $2, 'document', true, 'missing', $3, now(), now())`,
        [contractId, checklistTitle, this.userIdOrNull(user.id)],
      );
    }
  }

  async seedTemplates() {
    const user = this.assertAdmin();
    const schema = this.getSchema();
    await seedDoflowContractTemplates(this.dataSource, schema);
    return { success: true, seededBy: user.id };
  }

  async summary() {
    const user = this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const [contracts, paperwork] = await Promise.all([this.contractsSummary(schema), this.paperworkSummary(schema)]);
    return { contracts, paperwork };
  }

  async contractsSummary(schemaArg?: string) {
    const schema = schemaArg || this.getSchema();
    if (!(await this.tableExists(schema, 'contracts'))) {
      return { totalContracts: 0, draftContracts: 0, sentContracts: 0, waitingSignatureContracts: 0, signedContracts: 0, expiringContracts: 0, overdueContracts: 0, recentContracts: [] };
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
       FROM "${schema}".contracts
       WHERE deleted_at IS NULL`,
    );
    const recentContracts = await this.dataSource.query(
      `SELECT id, title, contract_number, status, due_date, created_at
       FROM "${schema}".contracts
       WHERE deleted_at IS NULL
       ORDER BY created_at DESC
       LIMIT 5`,
    );
    return { ...rows[0], recentContracts };
  }

  async paperworkSummary(schemaArg?: string) {
    const schema = schemaArg || this.getSchema();
    if (!(await this.tableExists(schema, 'paperwork_dossiers'))) {
      return { openDossiers: 0, blockedDossiers: 0, overdueDossiers: 0, missingItems: 0, dueSoonItems: 0, recentDossiers: [] };
    }
    const [dossierRows, itemRows, recentDossiers] = await Promise.all([
      this.dataSource.query(
        `SELECT
           COUNT(*) FILTER (WHERE status IN ('open', 'in_progress', 'waiting'))::int AS "openDossiers",
           COUNT(*) FILTER (WHERE status = 'blocked')::int AS "blockedDossiers",
           COUNT(*) FILTER (WHERE due_date < current_date AND status NOT IN ('completed', 'archived'))::int AS "overdueDossiers"
         FROM "${schema}".paperwork_dossiers
         WHERE deleted_at IS NULL`,
      ),
      this.dataSource.query(
        `SELECT
           COUNT(*) FILTER (WHERE status = 'missing' AND is_required = true)::int AS "missingItems",
           COUNT(*) FILTER (WHERE due_date BETWEEN current_date AND current_date + INTERVAL '7 days' AND status NOT IN ('approved', 'not_applicable'))::int AS "dueSoonItems"
         FROM "${schema}".paperwork_items
         WHERE deleted_at IS NULL`,
      ),
      this.dataSource.query(
        `SELECT id, title, dossier_type, status, due_date, created_at
         FROM "${schema}".paperwork_dossiers
         WHERE deleted_at IS NULL
         ORDER BY created_at DESC
         LIMIT 5`,
      ),
    ]);
    return { ...dossierRows[0], ...itemRows[0], recentDossiers };
  }

  async listTemplates(query: Record<string, any> = {}) {
    const user = this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const params: unknown[] = [];
    const where = ['deleted_at IS NULL'];
    if (query.category) {
      params.push(this.normalizeEnum(query.category, TEMPLATE_CATEGORIES, 'generic', 'category'));
      where.push(`category = $${params.length}`);
    }
    if (query.search) {
      params.push(`%${String(query.search).trim()}%`);
      where.push(`(name ILIKE $${params.length} OR slug ILIKE $${params.length})`);
    }
    const rows = await this.dataSource.query(
      `SELECT id, name, slug, category, description, body_markdown, variables, default_checklist, is_active, version_label, created_by, created_at, updated_at
       FROM "${schema}".contract_templates
       WHERE ${where.join(' AND ')}
       ORDER BY name ASC`,
      params,
    );
    return { items: rows, canManage: this.canAdmin(user.role) };
  }

  async createTemplate(body: Record<string, any>) {
    const user = this.assertAdmin();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const row = await this.dataSource.query(
      `INSERT INTO "${schema}".contract_templates (
         name, slug, category, description, body_markdown, variables, default_checklist,
         is_active, version_label, created_by, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10, now(), now())
       RETURNING id, name, slug, category, description, body_markdown, variables, default_checklist, is_active, version_label, created_at, updated_at`,
      [
        this.textOrNull(body.name) || (() => { throw new BadRequestException('name obbligatorio'); })(),
        this.textOrNull(body.slug) || String(body.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
        this.normalizeEnum(body.category, TEMPLATE_CATEGORIES, 'generic', 'category'),
        this.textOrNull(body.description),
        String(body.body_markdown ?? body.bodyMarkdown ?? ''),
        JSON.stringify(this.parseJson(body.variables, [])),
        JSON.stringify(this.parseJson(body.default_checklist ?? body.defaultChecklist, [])),
        body.is_active !== false,
        this.textOrNull(body.version_label),
        this.userIdOrNull(user.id),
      ],
    );
    return row[0];
  }

  async getTemplateById(id: string) {
    this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT id, name, slug, category, description, body_markdown, variables, default_checklist, is_active, version_label, created_by, created_at, updated_at
       FROM "${schema}".contract_templates WHERE id = $1 AND deleted_at IS NULL`,
      [this.requireUuid(id)],
    );
    if (!rows[0]) throw new NotFoundException('Template non trovato');
    return rows[0];
  }

  async updateTemplate(id: string, body: Record<string, any>) {
    this.assertAdmin();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const updates: string[] = [];
    const params: unknown[] = [];
    const map: Record<string, () => unknown> = {
      name: () => this.textOrNull(body.name),
      slug: () => this.textOrNull(body.slug),
      category: () => this.normalizeOptionalEnum(body.category, TEMPLATE_CATEGORIES, 'category'),
      description: () => this.textOrNull(body.description),
      body_markdown: () => String(body.body_markdown ?? body.bodyMarkdown ?? ''),
      variables: () => JSON.stringify(this.parseJson(body.variables, [])),
      default_checklist: () => JSON.stringify(this.parseJson(body.default_checklist ?? body.defaultChecklist, [])),
      is_active: () => Boolean(body.is_active),
      version_label: () => this.textOrNull(body.version_label),
    };
    for (const [key, getter] of Object.entries(map)) {
      if (body[key] !== undefined || (key === 'body_markdown' && body.bodyMarkdown !== undefined) || (key === 'default_checklist' && body.defaultChecklist !== undefined)) {
        params.push(getter());
        updates.push(`${key} = $${params.length}${['variables', 'default_checklist'].includes(key) ? '::jsonb' : ''}`);
      }
    }
    if (updates.length === 0) return this.getTemplateById(id);
    params.push(this.requireUuid(id));
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".contract_templates SET ${updates.join(', ')}, updated_at = now()
       WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING id, name, slug, category, description, body_markdown, variables, default_checklist, is_active, version_label, created_at, updated_at`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Template non trovato');
    return rows[0];
  }

  async deleteTemplate(id: string) {
    this.assertAdmin();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".contract_templates SET deleted_at = now(), updated_at = now() WHERE id = $1`, [this.requireUuid(id)]);
    return { success: true };
  }

  async listContracts(query: Record<string, any> = {}) {
    const user = this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const params: unknown[] = [];
    const where = ['deleted_at IS NULL'];
    if (query.status) {
      params.push(this.normalizeEnum(query.status, CONTRACT_STATUSES, 'draft', 'status'));
      where.push(`status = $${params.length}`);
    }
    if (query.signature_status) {
      params.push(this.normalizeEnum(query.signature_status, SIGNATURE_STATUSES, 'not_started', 'signature_status'));
      where.push(`signature_status = $${params.length}`);
    }
    for (const field of ['company_id', 'contact_id', 'quote_id', 'project_id', 'opportunity_id', 'assigned_to_user_id']) {
      if (query[field]) {
        params.push(this.requireUuid(query[field], field));
        where.push(`${field} = $${params.length}`);
      }
    }
    if (query.search) {
      params.push(`%${String(query.search).trim()}%`);
      where.push(`(title ILIKE $${params.length} OR contract_number ILIKE $${params.length})`);
    }
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sort = this.normalizeSort(query.sort);
    params.push(limit, offset);
    const rows = await this.dataSource.query(
      `SELECT id, contract_number, title, description, template_id, company_id, contact_id, quote_id, project_id,
              opportunity_id, owner_user_id, assigned_to_user_id, status, signature_status, priority, contract_type,
              amount, currency, payment_terms, start_date, end_date, renewal_date, due_date, sent_at, approved_at,
              signed_at, activated_at, cancelled_at, archived_at, internal_notes, public_notes, metadata, created_by,
              updated_by, created_at, updated_at
       FROM "${schema}".contracts
       WHERE ${where.join(' AND ')}
       ORDER BY ${sort} DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const totalRows = await this.dataSource.query(`SELECT COUNT(*)::int AS total FROM "${schema}".contracts WHERE ${where.join(' AND ')}`, params.slice(0, -2));
    return { items: rows.map((row: any) => this.sanitizeContract(row, user)), total: Number(totalRows[0]?.total || 0), limit, offset };
  }

  async getContract(id: string) {
    const user = this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT id, contract_number, title, description, template_id, company_id, contact_id, quote_id, project_id,
              opportunity_id, owner_user_id, assigned_to_user_id, status, signature_status, priority, contract_type,
              amount, currency, payment_terms, start_date, end_date, renewal_date, due_date, sent_at, approved_at,
              signed_at, activated_at, cancelled_at, archived_at, internal_notes, public_notes, metadata, created_by,
              updated_by, created_at, updated_at
       FROM "${schema}".contracts WHERE id = $1 AND deleted_at IS NULL`,
      [this.requireUuid(id)],
    );
    if (!rows[0]) throw new NotFoundException('Contratto non trovato');
    return this.sanitizeContract(rows[0], user);
  }

  async createContract(body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const createdId = await this.dataSource.transaction(async (manager) => {
      const contractNumber = this.textOrNull(body.contract_number) || await this.nextContractNumber(manager, schema);
      const contractType = this.normalizeEnum(body.contract_type, CONTRACT_TYPES, 'generic', 'contract_type');
      const template = await this.getTemplate(manager, schema, this.textOrNull(body.template_id), contractType);
      const rows = await manager.query(
        `INSERT INTO "${schema}".contracts (
           contract_number, title, description, template_id, company_id, contact_id, quote_id, project_id, opportunity_id,
           owner_user_id, assigned_to_user_id, status, signature_status, priority, contract_type, amount, currency,
           payment_terms, start_date, end_date, renewal_date, due_date, internal_notes, public_notes, metadata,
           created_by, updated_by, created_at, updated_at
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9,
           $10, $11, $12, $13, $14, $15, $16, $17,
           $18, $19, $20, $21, $22, $23, $24, $25::jsonb,
           $26, $26, now(), now()
         ) RETURNING id`,
        [
          contractNumber,
          this.textOrNull(body.title) || 'Nuovo contratto',
          this.textOrNull(body.description),
          template?.id || null,
          body.company_id ? this.requireUuid(body.company_id, 'company_id') : null,
          body.contact_id ? this.requireUuid(body.contact_id, 'contact_id') : null,
          body.quote_id ? this.requireUuid(body.quote_id, 'quote_id') : null,
          body.project_id ? this.requireUuid(body.project_id, 'project_id') : null,
          body.opportunity_id ? this.requireUuid(body.opportunity_id, 'opportunity_id') : null,
          body.owner_user_id ? this.requireUuid(body.owner_user_id, 'owner_user_id') : null,
          body.assigned_to_user_id ? this.requireUuid(body.assigned_to_user_id, 'assigned_to_user_id') : null,
          this.normalizeEnum(body.status, CONTRACT_STATUSES, 'draft', 'status'),
          this.normalizeEnum(body.signature_status, SIGNATURE_STATUSES, 'not_started', 'signature_status'),
          this.normalizeEnum(body.priority, PRIORITIES, 'medium', 'priority'),
          contractType,
          this.canViewFinance(user.role) ? this.normalizeAmount(body.amount) : null,
          this.textOrNull(body.currency) || 'EUR',
          this.canViewFinance(user.role) ? this.textOrNull(body.payment_terms) : null,
          this.normalizeDate(body.start_date, 'start_date'),
          this.normalizeDate(body.end_date, 'end_date'),
          this.normalizeDate(body.renewal_date, 'renewal_date'),
          this.normalizeDate(body.due_date, 'due_date'),
          this.canViewFinance(user.role) ? this.textOrNull(body.internal_notes) : null,
          this.textOrNull(body.public_notes),
          JSON.stringify(this.parseJson(body.metadata, {})),
          this.userIdOrNull(user.id),
        ],
      );
      const contractId = rows[0].id;
      await this.createInitialVersionAndChecklist(manager, schema, contractId, user, this.textOrNull(body.title) || 'Nuovo contratto', template, this.textOrNull(body.body_markdown));
      await this.logContractActivity(manager, schema, contractId, user, 'contract_created', { contractNumber });
      return contractId;
    });
    return this.getContract(createdId);
  }

  async updateContract(id: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const fields: Array<[string, unknown, string?]> = [];
    const add = (column: string, value: unknown, cast = '') => fields.push([column, value, cast]);
    if (body.title !== undefined) add('title', this.textOrNull(body.title) || 'Contratto');
    if (body.description !== undefined) add('description', this.textOrNull(body.description));
    if (body.status !== undefined) add('status', this.normalizeEnum(body.status, CONTRACT_STATUSES, 'draft', 'status'));
    if (body.signature_status !== undefined) add('signature_status', this.normalizeEnum(body.signature_status, SIGNATURE_STATUSES, 'not_started', 'signature_status'));
    if (body.priority !== undefined) add('priority', this.normalizeEnum(body.priority, PRIORITIES, 'medium', 'priority'));
    if (body.contract_type !== undefined) add('contract_type', this.normalizeEnum(body.contract_type, CONTRACT_TYPES, 'generic', 'contract_type'));
    for (const field of ['template_id', 'company_id', 'contact_id', 'quote_id', 'project_id', 'opportunity_id', 'owner_user_id', 'assigned_to_user_id']) {
      if (body[field] !== undefined) add(field, body[field] ? this.requireUuid(body[field], field) : null);
    }
    if (this.canViewFinance(user.role)) {
      if (body.amount !== undefined) add('amount', this.normalizeAmount(body.amount));
      if (body.payment_terms !== undefined) add('payment_terms', this.textOrNull(body.payment_terms));
      if (body.internal_notes !== undefined) add('internal_notes', this.textOrNull(body.internal_notes));
    }
    if (body.currency !== undefined) add('currency', this.textOrNull(body.currency) || 'EUR');
    for (const field of ['start_date', 'end_date', 'renewal_date', 'due_date']) {
      if (body[field] !== undefined) add(field, this.normalizeDate(body[field], field));
    }
    if (body.public_notes !== undefined) add('public_notes', this.textOrNull(body.public_notes));
    if (body.metadata !== undefined) add('metadata', JSON.stringify(this.parseJson(body.metadata, {})), '::jsonb');
    if (fields.length === 0) return this.getContract(id);
    const params: unknown[] = [];
    const sets = fields.map(([column, value, cast]) => {
      params.push(value);
      return `${column} = $${params.length}${cast || ''}`;
    });
    params.push(this.userIdOrNull(user.id), this.requireUuid(id));
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".contracts
       SET ${sets.join(', ')}, updated_by = $${params.length - 1}, updated_at = now()
       WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING id`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Contratto non trovato');
    await this.logContractActivity(this.dataSource, schema, id, user, 'contract_updated', { fields: fields.map(([column]) => column) });
    return this.getContract(id);
  }

  async deleteContract(id: string) {
    const user = this.assertAdmin();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".contracts SET deleted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1`, [this.requireUuid(id), this.userIdOrNull(user.id)]);
    await this.logContractActivity(this.dataSource, schema, id, user, 'contract_deleted');
    return { success: true };
  }

  async setContractStatus(id: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const status = this.normalizeEnum(body.status, CONTRACT_STATUSES, 'draft', 'status');
    const timestampColumn: Record<string, string> = {
      sent: 'sent_at',
      approved: 'approved_at',
      signed: 'signed_at',
      active: 'activated_at',
      cancelled: 'cancelled_at',
      archived: 'archived_at',
    };
    const extra = timestampColumn[status] ? `, ${timestampColumn[status]} = COALESCE(${timestampColumn[status]}, now())` : '';
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".contracts SET status = $2, updated_by = $3, updated_at = now()${extra} WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [this.requireUuid(id), status, this.userIdOrNull(user.id)],
    );
    if (!rows[0]) throw new NotFoundException('Contratto non trovato');
    await this.logContractActivity(this.dataSource, schema, id, user, 'contract_status_changed', { status });
    return this.getContract(id);
  }

  async archiveContract(id: string) {
    return this.setContractStatus(id, { status: 'archived' });
  }

  async restoreContract(id: string) {
    const user = this.assertAdmin();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".contracts SET deleted_at = NULL, archived_at = NULL, status = 'draft', updated_by = $2, updated_at = now() WHERE id = $1`, [this.requireUuid(id), this.userIdOrNull(user.id)]);
    await this.logContractActivity(this.dataSource, schema, id, user, 'contract_restored');
    return this.getContract(id);
  }

  async createContractFromQuote(quoteId: string, body: Record<string, any> = {}) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const contractId = await this.dataSource.transaction(async (manager) => {
      const quoteRows = await manager.query(
        `SELECT id, quote_number, title, company_id, contact_id, opportunity_id, briefing_id, total, currency
         FROM "${schema}".quotes WHERE id = $1 AND deleted_at IS NULL`,
        [this.requireUuid(quoteId, 'quoteId')],
      );
      const quote = quoteRows[0];
      if (!quote) throw new NotFoundException('Preventivo non trovato');
      const existing = await manager.query(
        `SELECT id FROM "${schema}".contracts WHERE quote_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [quote.id],
      );
      if (existing[0]?.id && !body.force) return existing[0].id;
      const contractType = this.normalizeEnum(body.contract_type || 'generic', CONTRACT_TYPES, 'generic', 'contract_type');
      const template = await this.getTemplate(manager, schema, this.textOrNull(body.template_id), contractType);
      const due = new Date();
      due.setUTCDate(due.getUTCDate() + 7);
      const number = await this.nextContractNumber(manager, schema);
      const title = this.textOrNull(body.title) || `Contratto - ${quote.quote_number || quote.title}`;
      const rows = await manager.query(
        `INSERT INTO "${schema}".contracts (
          contract_number, title, description, template_id, company_id, contact_id, quote_id, opportunity_id,
          status, signature_status, priority, contract_type, amount, currency, due_date, public_notes,
          metadata, created_by, updated_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 'not_started', 'medium', $9, $10, $11, $12, $13, $14::jsonb, $15, $15, now(), now())
        RETURNING id`,
        [
          number,
          title,
          this.textOrNull(body.description),
          template?.id || null,
          quote.company_id,
          quote.contact_id,
          quote.id,
          quote.opportunity_id,
          contractType,
          this.canViewFinance(user.role) ? Number(quote.total || 0) : null,
          quote.currency || 'EUR',
          due.toISOString().slice(0, 10),
          'Creato da preventivo.',
          JSON.stringify({ source: 'quote', quote_id: quote.id }),
          this.userIdOrNull(user.id),
        ],
      );
      const contractId = rows[0].id;
      await this.createInitialVersionAndChecklist(manager, schema, contractId, user, title, template);
      await this.logContractActivity(manager, schema, contractId, user, 'contract_created', { from: 'quote', quoteId: quote.id });
      if (body.create_paperwork !== false) await this.createPaperworkFromContractInternal(manager, schema, contractId, user, { skipExistingReturn: true });
      return contractId;
    });
    return this.getContract(contractId);
  }

  async createContractFromProject(projectId: string, body: Record<string, any> = {}) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const contractId = await this.dataSource.transaction(async (manager) => {
      const projectRows = await manager.query(
        `SELECT id, name, company_id, contact_id, quote_id, opportunity_id, type
         FROM "${schema}".projects WHERE id = $1 AND deleted_at IS NULL`,
        [this.requireUuid(projectId, 'projectId')],
      );
      const project = projectRows[0];
      if (!project) throw new NotFoundException('Progetto non trovato');
      const existing = await manager.query(`SELECT id FROM "${schema}".contracts WHERE project_id = $1 AND deleted_at IS NULL LIMIT 1`, [project.id]);
      if (existing[0]?.id && !body.force) return existing[0].id;
      const contractType = CONTRACT_TYPES.includes(project.type) ? project.type : 'generic';
      const template = await this.getTemplate(manager, schema, this.textOrNull(body.template_id), contractType);
      const due = new Date();
      due.setUTCDate(due.getUTCDate() + 7);
      const title = this.textOrNull(body.title) || `Contratto - ${project.name}`;
      const rows = await manager.query(
        `INSERT INTO "${schema}".contracts (
          contract_number, title, template_id, company_id, contact_id, quote_id, project_id, opportunity_id,
          status, signature_status, priority, contract_type, due_date, public_notes, metadata, created_by, updated_by, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'draft', 'not_started', 'medium', $9, $10, $11, $12::jsonb, $13, $13, now(), now())
        RETURNING id`,
        [
          await this.nextContractNumber(manager, schema),
          title,
          template?.id || null,
          project.company_id,
          project.contact_id,
          project.quote_id,
          project.id,
          project.opportunity_id,
          contractType,
          due.toISOString().slice(0, 10),
          'Creato da progetto.',
          JSON.stringify({ source: 'project', project_id: project.id }),
          this.userIdOrNull(user.id),
        ],
      );
      const contractId = rows[0].id;
      await this.createInitialVersionAndChecklist(manager, schema, contractId, user, title, template);
      await this.logContractActivity(manager, schema, contractId, user, 'contract_created', { from: 'project', projectId: project.id });
      return contractId;
    });
    return this.getContract(contractId);
  }

  async listVersions(contractId: string) {
    this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getContract(contractId);
    const rows = await this.dataSource.query(
      `SELECT id, contract_id, version_number, title, body_markdown, variables, status, change_note, created_by, created_at
       FROM "${schema}".contract_versions WHERE contract_id = $1 AND deleted_at IS NULL ORDER BY version_number DESC`,
      [this.requireUuid(contractId)],
    );
    return { items: rows };
  }

  async createVersion(contractId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getContract(contractId);
    const next = await this.dataSource.query(
      `SELECT COALESCE(MAX(version_number), 0)::int + 1 AS next FROM "${schema}".contract_versions WHERE contract_id = $1`,
      [this.requireUuid(contractId)],
    );
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".contract_versions (
        contract_id, version_number, title, body_markdown, variables, status, change_note, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, now())
      RETURNING id, contract_id, version_number, title, body_markdown, variables, status, change_note, created_at`,
      [
        contractId,
        Number(next[0]?.next || 1),
        this.textOrNull(body.title) || 'Nuova versione',
        String(body.body_markdown ?? body.bodyMarkdown ?? ''),
        JSON.stringify(this.parseJson(body.variables, {})),
        this.normalizeEnum(body.status, VERSION_STATUSES, 'draft', 'status'),
        this.textOrNull(body.change_note),
        this.userIdOrNull(user.id),
      ],
    );
    await this.logContractActivity(this.dataSource, schema, contractId, user, 'version_created', { versionId: rows[0].id });
    return rows[0];
  }

  async updateVersion(contractId: string, versionId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".contract_versions
       SET title = COALESCE($3, title),
           body_markdown = COALESCE($4, body_markdown),
           variables = COALESCE($5::jsonb, variables),
           status = COALESCE($6, status),
           change_note = COALESCE($7, change_note)
       WHERE contract_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id, contract_id, version_number, title, body_markdown, variables, status, change_note, created_at`,
      [
        this.requireUuid(contractId),
        this.requireUuid(versionId, 'versionId'),
        body.title === undefined ? null : this.textOrNull(body.title),
        body.body_markdown === undefined && body.bodyMarkdown === undefined ? null : String(body.body_markdown ?? body.bodyMarkdown ?? ''),
        body.variables === undefined ? null : JSON.stringify(this.parseJson(body.variables, {})),
        body.status === undefined ? null : this.normalizeEnum(body.status, VERSION_STATUSES, 'draft', 'status'),
        body.change_note === undefined ? null : this.textOrNull(body.change_note),
      ],
    );
    if (!rows[0]) throw new NotFoundException('Versione non trovata');
    await this.logContractActivity(this.dataSource, schema, contractId, user, 'version_updated', { versionId });
    return rows[0];
  }

  async deleteVersion(contractId: string, versionId: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".contract_versions SET deleted_at = now() WHERE contract_id = $1 AND id = $2`, [this.requireUuid(contractId), this.requireUuid(versionId, 'versionId')]);
    await this.logContractActivity(this.dataSource, schema, contractId, user, 'version_deleted', { versionId });
    return { success: true };
  }

  async listSigners(contractId: string) {
    this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getContract(contractId);
    const rows = await this.dataSource.query(
      `SELECT id, contract_id, signer_type, name, email, role_title, status, signed_at, declined_at, notes, metadata, created_at, updated_at
       FROM "${schema}".contract_signers WHERE contract_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
      [this.requireUuid(contractId)],
    );
    return { items: rows };
  }

  async createSigner(contractId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getContract(contractId);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".contract_signers (
        contract_id, signer_type, name, email, role_title, status, notes, metadata, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, now(), now())
      RETURNING id, contract_id, signer_type, name, email, role_title, status, notes, metadata, created_at, updated_at`,
      [
        this.requireUuid(contractId),
        this.normalizeEnum(body.signer_type, SIGNER_TYPES, 'client', 'signer_type'),
        this.textOrNull(body.name) || (() => { throw new BadRequestException('name obbligatorio'); })(),
        this.textOrNull(body.email),
        this.textOrNull(body.role_title),
        this.normalizeEnum(body.status, SIGNER_STATUSES, 'pending', 'status'),
        this.textOrNull(body.notes),
        JSON.stringify(this.parseJson(body.metadata, {})),
      ],
    );
    await this.logContractActivity(this.dataSource, schema, contractId, user, 'signer_added', { signerId: rows[0].id });
    return rows[0];
  }

  async updateSigner(contractId: string, signerId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const status = body.status === undefined ? null : this.normalizeEnum(body.status, SIGNER_STATUSES, 'pending', 'status');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".contract_signers
       SET signer_type = COALESCE($3, signer_type),
           name = COALESCE($4, name),
           email = COALESCE($5, email),
           role_title = COALESCE($6, role_title),
           status = COALESCE($7, status),
           signed_at = CASE WHEN $7 = 'signed' THEN COALESCE(signed_at, now()) ELSE signed_at END,
           declined_at = CASE WHEN $7 = 'declined' THEN COALESCE(declined_at, now()) ELSE declined_at END,
           notes = COALESCE($8, notes),
           metadata = COALESCE($9::jsonb, metadata),
           updated_at = now()
       WHERE contract_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id, contract_id, signer_type, name, email, role_title, status, signed_at, declined_at, notes, metadata, created_at, updated_at`,
      [
        this.requireUuid(contractId),
        this.requireUuid(signerId, 'signerId'),
        body.signer_type === undefined ? null : this.normalizeEnum(body.signer_type, SIGNER_TYPES, 'client', 'signer_type'),
        body.name === undefined ? null : this.textOrNull(body.name),
        body.email === undefined ? null : this.textOrNull(body.email),
        body.role_title === undefined ? null : this.textOrNull(body.role_title),
        status,
        body.notes === undefined ? null : this.textOrNull(body.notes),
        body.metadata === undefined ? null : JSON.stringify(this.parseJson(body.metadata, {})),
      ],
    );
    if (!rows[0]) throw new NotFoundException('Firmatario non trovato');
    await this.logContractActivity(this.dataSource, schema, contractId, user, 'signer_updated', { signerId, status });
    return rows[0];
  }

  async deleteSigner(contractId: string, signerId: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".contract_signers SET deleted_at = now(), updated_at = now() WHERE contract_id = $1 AND id = $2`, [this.requireUuid(contractId), this.requireUuid(signerId, 'signerId')]);
    await this.logContractActivity(this.dataSource, schema, contractId, user, 'signer_deleted', { signerId });
    return { success: true };
  }

  async listChecklist(contractId: string) {
    const user = this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getContract(contractId);
    const rows = await this.dataSource.query(
      `SELECT id, contract_id, title, description, category, is_required, status, assigned_to_user_id,
              due_date, linked_document_id, notes, metadata, completed_at, completed_by, created_by, created_at, updated_at
       FROM "${schema}".contract_checklist_items WHERE contract_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
      [this.requireUuid(contractId)],
    );
    return { items: rows.map((row: any) => this.canViewFinance(user.role) || row.category !== 'finance' ? row : { ...row, notes: null }) };
  }

  async createChecklistItem(contractId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getContract(contractId);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".contract_checklist_items (
        contract_id, title, description, category, is_required, status, assigned_to_user_id,
        due_date, linked_document_id, notes, metadata, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, now(), now())
      RETURNING id, contract_id, title, category, status, created_at`,
      [
        this.requireUuid(contractId),
        this.textOrNull(body.title) || (() => { throw new BadRequestException('title obbligatorio'); })(),
        this.textOrNull(body.description),
        this.normalizeEnum(body.category, CHECKLIST_CATEGORIES, 'document', 'category'),
        body.is_required !== false,
        this.normalizeEnum(body.status, CHECKLIST_STATUSES, 'missing', 'status'),
        body.assigned_to_user_id ? this.requireUuid(body.assigned_to_user_id, 'assigned_to_user_id') : null,
        this.normalizeDate(body.due_date, 'due_date'),
        body.linked_document_id ? this.requireUuid(body.linked_document_id, 'linked_document_id') : null,
        this.textOrNull(body.notes),
        JSON.stringify(this.parseJson(body.metadata, {})),
        this.userIdOrNull(user.id),
      ],
    );
    await this.logContractActivity(this.dataSource, schema, contractId, user, 'checklist_item_created', { itemId: rows[0].id });
    return rows[0];
  }

  async updateChecklistItem(contractId: string, itemId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".contract_checklist_items
       SET title = COALESCE($3, title),
           description = COALESCE($4, description),
           category = COALESCE($5, category),
           is_required = COALESCE($6, is_required),
           status = COALESCE($7, status),
           assigned_to_user_id = COALESCE($8, assigned_to_user_id),
           due_date = COALESCE($9, due_date),
           linked_document_id = COALESCE($10, linked_document_id),
           notes = COALESCE($11, notes),
           metadata = COALESCE($12::jsonb, metadata),
           updated_at = now()
       WHERE contract_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id, contract_id, title, category, status, updated_at`,
      [
        this.requireUuid(contractId),
        this.requireUuid(itemId, 'itemId'),
        body.title === undefined ? null : this.textOrNull(body.title),
        body.description === undefined ? null : this.textOrNull(body.description),
        body.category === undefined ? null : this.normalizeEnum(body.category, CHECKLIST_CATEGORIES, 'document', 'category'),
        body.is_required === undefined ? null : Boolean(body.is_required),
        body.status === undefined ? null : this.normalizeEnum(body.status, CHECKLIST_STATUSES, 'missing', 'status'),
        body.assigned_to_user_id === undefined ? null : this.requireUuid(body.assigned_to_user_id, 'assigned_to_user_id'),
        body.due_date === undefined ? null : this.normalizeDate(body.due_date, 'due_date'),
        body.linked_document_id === undefined ? null : this.requireUuid(body.linked_document_id, 'linked_document_id'),
        body.notes === undefined ? null : this.textOrNull(body.notes),
        body.metadata === undefined ? null : JSON.stringify(this.parseJson(body.metadata, {})),
      ],
    );
    if (!rows[0]) throw new NotFoundException('Checklist item non trovato');
    await this.logContractActivity(this.dataSource, schema, contractId, user, 'checklist_item_updated', { itemId });
    return rows[0];
  }

  async setChecklistStatus(contractId: string, itemId: string, status: 'approved' | 'rejected' | 'received') {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".contract_checklist_items
       SET status = $3,
           completed_at = CASE WHEN $3 IN ('approved', 'received') THEN COALESCE(completed_at, now()) ELSE completed_at END,
           completed_by = CASE WHEN $3 IN ('approved', 'received') THEN $4 ELSE completed_by END,
           updated_at = now()
       WHERE contract_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id, contract_id, title, category, status, completed_at, completed_by`,
      [this.requireUuid(contractId), this.requireUuid(itemId, 'itemId'), status, this.userIdOrNull(user.id)],
    );
    if (!rows[0]) throw new NotFoundException('Checklist item non trovato');
    await this.logContractActivity(this.dataSource, schema, contractId, user, status === 'received' ? 'checklist_item_completed' : `checklist_item_${status}`, { itemId });
    return rows[0];
  }

  async deleteChecklistItem(contractId: string, itemId: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".contract_checklist_items SET deleted_at = now(), updated_at = now() WHERE contract_id = $1 AND id = $2`, [this.requireUuid(contractId), this.requireUuid(itemId, 'itemId')]);
    await this.logContractActivity(this.dataSource, schema, contractId, user, 'checklist_item_deleted', { itemId });
    return { success: true };
  }

  async linkDocumentToContract(contractId: string, documentId: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getContract(contractId);
    const docId = this.requireUuid(documentId, 'documentId');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".document_links (document_id, entity_type, entity_id, relation_type, created_by, created_at)
       VALUES ($1, 'contract', $2, 'contract', $3, now())
       ON CONFLICT (document_id, entity_type, entity_id, relation_type) WHERE deleted_at IS NULL DO UPDATE SET deleted_at = NULL
       RETURNING id, document_id, entity_type, entity_id, relation_type`,
      [docId, this.requireUuid(contractId), this.userIdOrNull(user.id)],
    );
    await this.logContractActivity(this.dataSource, schema, contractId, user, 'document_linked', { documentId: docId }, 'document', docId);
    return rows[0];
  }

  async contractActivity(contractId: string) {
    this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getContract(contractId);
    const rows = await this.dataSource.query(
      `SELECT id, contract_id, action, actor_user_id, entity_type, entity_id, metadata, created_at
       FROM "${schema}".contract_activity WHERE contract_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [this.requireUuid(contractId)],
    );
    return { items: rows };
  }

  async exportContract(id: string) {
    const contract = await this.getContract(id);
    const [versions, signers, checklist, activity] = await Promise.all([
      this.listVersions(id),
      this.listSigners(id),
      this.listChecklist(id),
      this.contractActivity(id),
    ]);
    return { format: 'json', contract, versions: versions.items, signers: signers.items, checklist: checklist.items, activity: activity.items };
  }

  async listDossiers(query: Record<string, any> = {}) {
    const user = this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const params: unknown[] = [];
    const where = ['deleted_at IS NULL'];
    if (query.status) {
      params.push(this.normalizeEnum(query.status, DOSSIER_STATUSES, 'open', 'status'));
      where.push(`status = $${params.length}`);
    }
    if (query.dossier_type) {
      params.push(this.normalizeEnum(query.dossier_type, DOSSIER_TYPES, 'generic', 'dossier_type'));
      where.push(`dossier_type = $${params.length}`);
    }
    for (const field of ['company_id', 'contact_id', 'quote_id', 'project_id', 'contract_id', 'assigned_to_user_id']) {
      if (query[field]) {
        params.push(this.requireUuid(query[field], field));
        where.push(`${field} = $${params.length}`);
      }
    }
    if (query.search) {
      params.push(`%${String(query.search).trim()}%`);
      where.push(`title ILIKE $${params.length}`);
    }
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    params.push(limit, offset);
    const rows = await this.dataSource.query(
      `SELECT id, title, description, dossier_type, company_id, contact_id, quote_id, project_id, contract_id,
              owner_user_id, assigned_to_user_id, status, priority, due_date, completed_at, archived_at,
              metadata, created_by, updated_by, created_at, updated_at
       FROM "${schema}".paperwork_dossiers
       WHERE ${where.join(' AND ')}
       ORDER BY created_at DESC
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const totalRows = await this.dataSource.query(`SELECT COUNT(*)::int AS total FROM "${schema}".paperwork_dossiers WHERE ${where.join(' AND ')}`, params.slice(0, -2));
    return { items: rows.map((row: any) => this.sanitizeDossier(row, user)), total: Number(totalRows[0]?.total || 0), limit, offset };
  }

  async getDossier(id: string) {
    const user = this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT id, title, description, dossier_type, company_id, contact_id, quote_id, project_id, contract_id,
              owner_user_id, assigned_to_user_id, status, priority, due_date, completed_at, archived_at,
              metadata, created_by, updated_by, created_at, updated_at
       FROM "${schema}".paperwork_dossiers WHERE id = $1 AND deleted_at IS NULL`,
      [this.requireUuid(id)],
    );
    if (!rows[0]) throw new NotFoundException('Dossier non trovato');
    return this.sanitizeDossier(rows[0], user);
  }

  async createDossier(body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".paperwork_dossiers (
         title, description, dossier_type, company_id, contact_id, quote_id, project_id, contract_id,
         owner_user_id, assigned_to_user_id, status, priority, due_date, metadata, created_by, updated_by, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb, $15, $15, now(), now())
       RETURNING id`,
      [
        this.textOrNull(body.title) || (() => { throw new BadRequestException('title obbligatorio'); })(),
        this.textOrNull(body.description),
        this.normalizeEnum(body.dossier_type, DOSSIER_TYPES, 'generic', 'dossier_type'),
        body.company_id ? this.requireUuid(body.company_id, 'company_id') : null,
        body.contact_id ? this.requireUuid(body.contact_id, 'contact_id') : null,
        body.quote_id ? this.requireUuid(body.quote_id, 'quote_id') : null,
        body.project_id ? this.requireUuid(body.project_id, 'project_id') : null,
        body.contract_id ? this.requireUuid(body.contract_id, 'contract_id') : null,
        body.owner_user_id ? this.requireUuid(body.owner_user_id, 'owner_user_id') : null,
        body.assigned_to_user_id ? this.requireUuid(body.assigned_to_user_id, 'assigned_to_user_id') : null,
        this.normalizeEnum(body.status, DOSSIER_STATUSES, 'open', 'status'),
        this.normalizeEnum(body.priority, PRIORITIES, 'medium', 'priority'),
        this.normalizeDate(body.due_date, 'due_date'),
        JSON.stringify(this.parseJson(body.metadata, {})),
        this.userIdOrNull(user.id),
      ],
    );
    await this.logPaperworkActivity(this.dataSource, schema, rows[0].id, user, 'dossier_created');
    return this.getDossier(rows[0].id);
  }

  async updateDossier(id: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".paperwork_dossiers
       SET title = COALESCE($2, title),
           description = COALESCE($3, description),
           status = COALESCE($4, status),
           priority = COALESCE($5, priority),
           due_date = COALESCE($6, due_date),
           assigned_to_user_id = COALESCE($7, assigned_to_user_id),
           metadata = COALESCE($8::jsonb, metadata),
           updated_by = $9,
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id`,
      [
        this.requireUuid(id),
        body.title === undefined ? null : this.textOrNull(body.title),
        body.description === undefined ? null : this.textOrNull(body.description),
        body.status === undefined ? null : this.normalizeEnum(body.status, DOSSIER_STATUSES, 'open', 'status'),
        body.priority === undefined ? null : this.normalizeEnum(body.priority, PRIORITIES, 'medium', 'priority'),
        body.due_date === undefined ? null : this.normalizeDate(body.due_date, 'due_date'),
        body.assigned_to_user_id === undefined ? null : this.requireUuid(body.assigned_to_user_id, 'assigned_to_user_id'),
        body.metadata === undefined ? null : JSON.stringify(this.parseJson(body.metadata, {})),
        this.userIdOrNull(user.id),
      ],
    );
    if (!rows[0]) throw new NotFoundException('Dossier non trovato');
    await this.logPaperworkActivity(this.dataSource, schema, id, user, 'dossier_updated');
    return this.getDossier(id);
  }

  async setDossierStatus(id: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const status = this.normalizeEnum(body.status, DOSSIER_STATUSES, 'open', 'status');
    await this.dataSource.query(
      `UPDATE "${schema}".paperwork_dossiers
       SET status = $2,
           completed_at = CASE WHEN $2 = 'completed' THEN COALESCE(completed_at, now()) ELSE completed_at END,
           archived_at = CASE WHEN $2 = 'archived' THEN COALESCE(archived_at, now()) ELSE archived_at END,
           updated_by = $3,
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL`,
      [this.requireUuid(id), status, this.userIdOrNull(user.id)],
    );
    await this.logPaperworkActivity(this.dataSource, schema, id, user, 'dossier_status_changed', { status });
    return this.getDossier(id);
  }

  async archiveDossier(id: string) {
    return this.setDossierStatus(id, { status: 'archived' });
  }

  async restoreDossier(id: string) {
    const user = this.assertAdmin();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".paperwork_dossiers SET deleted_at = NULL, archived_at = NULL, status = 'open', updated_by = $2, updated_at = now() WHERE id = $1`, [this.requireUuid(id), this.userIdOrNull(user.id)]);
    await this.logPaperworkActivity(this.dataSource, schema, id, user, 'dossier_restored');
    return this.getDossier(id);
  }

  async deleteDossier(id: string) {
    const user = this.assertAdmin();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".paperwork_dossiers SET deleted_at = now(), updated_by = $2, updated_at = now() WHERE id = $1`, [this.requireUuid(id), this.userIdOrNull(user.id)]);
    await this.logPaperworkActivity(this.dataSource, schema, id, user, 'dossier_deleted');
    return { success: true };
  }

  private async createPaperworkFromContractInternal(manager: EntityManager | DataSource, schema: string, contractId: string, user: AuthUser, options: { skipExistingReturn?: boolean } = {}) {
    const contractRows = await manager.query(
      `SELECT id, title, company_id, contact_id, quote_id, project_id, due_date FROM "${schema}".contracts WHERE id = $1 AND deleted_at IS NULL`,
      [this.requireUuid(contractId, 'contractId')],
    );
    const contract = contractRows[0];
    if (!contract) throw new NotFoundException('Contratto non trovato');
    const existing = await manager.query(
      `SELECT id FROM "${schema}".paperwork_dossiers WHERE contract_id = $1 AND dossier_type IN ('contract', 'project_start') AND status <> 'archived' AND deleted_at IS NULL LIMIT 1`,
      [contract.id],
    );
    if (existing[0]?.id && !options.skipExistingReturn) return this.getDossier(existing[0].id);
    if (existing[0]?.id && options.skipExistingReturn) return existing[0];
    const due = contract.due_date || (() => {
      const d = new Date();
      d.setUTCDate(d.getUTCDate() + 7);
      return d.toISOString().slice(0, 10);
    })();
    const rows = await manager.query(
      `INSERT INTO "${schema}".paperwork_dossiers (
         title, description, dossier_type, company_id, contact_id, quote_id, project_id, contract_id,
         status, priority, due_date, created_by, updated_by, created_at, updated_at
       ) VALUES ($1, $2, 'contract', $3, $4, $5, $6, $7, 'open', 'medium', $8, $9, $9, now(), now())
       RETURNING id`,
      [
        `Scartoffie - ${contract.title}`,
        'Dossier amministrativo generato dal contratto.',
        contract.company_id,
        contract.contact_id,
        contract.quote_id,
        contract.project_id,
        contract.id,
        due,
        this.userIdOrNull(user.id),
      ],
    );
    const dossierId = rows[0].id;
    for (const title of STANDARD_PAPERWORK_ITEMS) {
      await manager.query(
        `INSERT INTO "${schema}".paperwork_items (
           dossier_id, title, category, is_required, status, created_by, created_at, updated_at
         ) VALUES ($1, $2, $3, true, 'missing', $4, now(), now())`,
        [dossierId, title, title.toLowerCase().includes('fatturazione') || title.includes('PEC') ? 'finance' : 'document', this.userIdOrNull(user.id)],
      );
    }
    await this.logPaperworkActivity(manager, schema, dossierId, user, 'dossier_created', { from: 'contract', contractId: contract.id });
    return { id: dossierId };
  }

  async createPaperworkFromContract(contractId: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const dossier = await this.dataSource.transaction(async (manager) => this.createPaperworkFromContractInternal(manager, schema, contractId, user));
    return this.getDossier(dossier.id);
  }

  async createPaperworkFromProject(projectId: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const projectRows = await this.dataSource.query(
      `SELECT id, name, company_id, contact_id, quote_id FROM "${schema}".projects WHERE id = $1 AND deleted_at IS NULL`,
      [this.requireUuid(projectId, 'projectId')],
    );
    const project = projectRows[0];
    if (!project) throw new NotFoundException('Progetto non trovato');
    return this.createDossier({
      title: `Scartoffie - ${project.name}`,
      dossier_type: 'project_start',
      company_id: project.company_id,
      contact_id: project.contact_id,
      quote_id: project.quote_id,
      project_id: project.id,
      status: 'open',
      priority: 'medium',
    });
  }

  async createPaperworkFromQuote(quoteId: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const quoteRows = await this.dataSource.query(
      `SELECT id, title, company_id, contact_id FROM "${schema}".quotes WHERE id = $1 AND deleted_at IS NULL`,
      [this.requireUuid(quoteId, 'quoteId')],
    );
    const quote = quoteRows[0];
    if (!quote) throw new NotFoundException('Preventivo non trovato');
    return this.createDossier({
      title: `Scartoffie - ${quote.title}`,
      dossier_type: 'onboarding',
      company_id: quote.company_id,
      contact_id: quote.contact_id,
      quote_id: quote.id,
      status: 'open',
      priority: 'medium',
      created_by: user.id,
    });
  }

  async listPaperworkItems(dossierId: string) {
    const user = this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getDossier(dossierId);
    const rows = await this.dataSource.query(
      `SELECT id, dossier_id, title, description, category, is_required, status, assigned_to_user_id,
              due_date, linked_document_id, notes, metadata, completed_at, completed_by, created_by, created_at, updated_at
       FROM "${schema}".paperwork_items WHERE dossier_id = $1 AND deleted_at IS NULL ORDER BY created_at ASC`,
      [this.requireUuid(dossierId)],
    );
    return { items: rows.map((row: any) => this.canViewFinance(user.role) || row.category !== 'finance' ? row : { ...row, notes: null }) };
  }

  async createPaperworkItem(dossierId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getDossier(dossierId);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".paperwork_items (
        dossier_id, title, description, category, is_required, status, assigned_to_user_id,
        due_date, linked_document_id, notes, metadata, created_by, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, now(), now())
      RETURNING id, dossier_id, title, category, status, created_at`,
      [
        this.requireUuid(dossierId),
        this.textOrNull(body.title) || (() => { throw new BadRequestException('title obbligatorio'); })(),
        this.textOrNull(body.description),
        this.normalizeEnum(body.category, PAPERWORK_CATEGORIES, 'document', 'category'),
        body.is_required !== false,
        this.normalizeEnum(body.status, CHECKLIST_STATUSES, 'missing', 'status'),
        body.assigned_to_user_id ? this.requireUuid(body.assigned_to_user_id, 'assigned_to_user_id') : null,
        this.normalizeDate(body.due_date, 'due_date'),
        body.linked_document_id ? this.requireUuid(body.linked_document_id, 'linked_document_id') : null,
        this.textOrNull(body.notes),
        JSON.stringify(this.parseJson(body.metadata, {})),
        this.userIdOrNull(user.id),
      ],
    );
    await this.logPaperworkActivity(this.dataSource, schema, dossierId, user, 'item_created', { itemId: rows[0].id });
    return rows[0];
  }

  async updatePaperworkItem(dossierId: string, itemId: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".paperwork_items
       SET title = COALESCE($3, title),
           description = COALESCE($4, description),
           category = COALESCE($5, category),
           is_required = COALESCE($6, is_required),
           status = COALESCE($7, status),
           assigned_to_user_id = COALESCE($8, assigned_to_user_id),
           due_date = COALESCE($9, due_date),
           linked_document_id = COALESCE($10, linked_document_id),
           notes = COALESCE($11, notes),
           metadata = COALESCE($12::jsonb, metadata),
           updated_at = now()
       WHERE dossier_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id, dossier_id, title, category, status, updated_at`,
      [
        this.requireUuid(dossierId),
        this.requireUuid(itemId, 'itemId'),
        body.title === undefined ? null : this.textOrNull(body.title),
        body.description === undefined ? null : this.textOrNull(body.description),
        body.category === undefined ? null : this.normalizeEnum(body.category, PAPERWORK_CATEGORIES, 'document', 'category'),
        body.is_required === undefined ? null : Boolean(body.is_required),
        body.status === undefined ? null : this.normalizeEnum(body.status, CHECKLIST_STATUSES, 'missing', 'status'),
        body.assigned_to_user_id === undefined ? null : this.requireUuid(body.assigned_to_user_id, 'assigned_to_user_id'),
        body.due_date === undefined ? null : this.normalizeDate(body.due_date, 'due_date'),
        body.linked_document_id === undefined ? null : this.requireUuid(body.linked_document_id, 'linked_document_id'),
        body.notes === undefined ? null : this.textOrNull(body.notes),
        body.metadata === undefined ? null : JSON.stringify(this.parseJson(body.metadata, {})),
      ],
    );
    if (!rows[0]) throw new NotFoundException('Paperwork item non trovato');
    await this.logPaperworkActivity(this.dataSource, schema, dossierId, user, 'item_updated', { itemId });
    return rows[0];
  }

  async setPaperworkItemStatus(dossierId: string, itemId: string, status: 'approved' | 'rejected' | 'received') {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".paperwork_items
       SET status = $3,
           completed_at = CASE WHEN $3 IN ('approved', 'received') THEN COALESCE(completed_at, now()) ELSE completed_at END,
           completed_by = CASE WHEN $3 IN ('approved', 'received') THEN $4 ELSE completed_by END,
           updated_at = now()
       WHERE dossier_id = $1 AND id = $2 AND deleted_at IS NULL
       RETURNING id, dossier_id, title, category, status, completed_at, completed_by`,
      [this.requireUuid(dossierId), this.requireUuid(itemId, 'itemId'), status, this.userIdOrNull(user.id)],
    );
    if (!rows[0]) throw new NotFoundException('Paperwork item non trovato');
    await this.logPaperworkActivity(this.dataSource, schema, dossierId, user, status === 'received' ? 'item_completed' : `item_${status}`, { itemId });
    return rows[0];
  }

  async deletePaperworkItem(dossierId: string, itemId: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.dataSource.query(`UPDATE "${schema}".paperwork_items SET deleted_at = now(), updated_at = now() WHERE dossier_id = $1 AND id = $2`, [this.requireUuid(dossierId), this.requireUuid(itemId, 'itemId')]);
    await this.logPaperworkActivity(this.dataSource, schema, dossierId, user, 'item_deleted', { itemId });
    return { success: true };
  }

  async linkDocumentToDossier(dossierId: string, documentId: string, itemId?: string) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getDossier(dossierId);
    const entityType = itemId ? 'paperwork_item' : 'paperwork_dossier';
    const entityId = itemId ? this.requireUuid(itemId, 'itemId') : this.requireUuid(dossierId);
    const docId = this.requireUuid(documentId, 'documentId');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".document_links (document_id, entity_type, entity_id, relation_type, created_by, created_at)
       VALUES ($1, $2, $3, 'attachment', $4, now())
       ON CONFLICT (document_id, entity_type, entity_id, relation_type) WHERE deleted_at IS NULL DO UPDATE SET deleted_at = NULL
       RETURNING id, document_id, entity_type, entity_id, relation_type`,
      [docId, entityType, entityId, this.userIdOrNull(user.id)],
    );
    await this.logPaperworkActivity(this.dataSource, schema, dossierId, user, 'document_linked', { documentId: docId, itemId: itemId || null }, 'document', docId);
    return rows[0];
  }

  async paperworkActivity(dossierId: string) {
    this.assertCanView();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.getDossier(dossierId);
    const rows = await this.dataSource.query(
      `SELECT id, dossier_id, action, actor_user_id, entity_type, entity_id, metadata, created_at
       FROM "${schema}".paperwork_activity WHERE dossier_id = $1 ORDER BY created_at DESC LIMIT 100`,
      [this.requireUuid(dossierId)],
    );
    return { items: rows };
  }

  async exportDossier(id: string) {
    const dossier = await this.getDossier(id);
    const [items, activity] = await Promise.all([this.listPaperworkItems(id), this.paperworkActivity(id)]);
    return { format: 'json', dossier, items: items.items, activity: activity.items };
  }
}
