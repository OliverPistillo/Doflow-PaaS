import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import { ensureTenantCrmCoreTables } from './tenant-crm-schema';
import { ensureTenantBriefingQuoteTables } from './tenant-briefing-quotes-schema';

type BriefingResource = 'templates' | 'briefings' | 'materials';

type ResourceConfig = {
  table: string;
  required: string[];
  writable: string[];
  searchable: string[];
  filters: string[];
  sort: string[];
  defaultSort: string;
  joins?: string;
  selectExtra?: string;
  jsonFields?: string[];
  uuidFields?: string[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const BRIEFING_STATUSES = [
  'draft',
  'sent',
  'partially_completed',
  'completed',
  'internal_reviewed',
  'approved',
  'converted_to_project',
];

const MATERIAL_STATUSES = ['missing', 'requested', 'received', 'approved', 'rejected'];

const RESOURCES: Record<BriefingResource, ResourceConfig> = {
  templates: {
    table: 'briefing_templates',
    required: ['name'],
    writable: ['name', 'type', 'description', 'schema_json', 'is_active'],
    searchable: ['name', 'type', 'description'],
    filters: ['type', 'is_active'],
    sort: ['created_at', 'updated_at', 'name'],
    defaultSort: 'updated_at',
    jsonFields: ['schema_json'],
  },
  briefings: {
    table: 'briefings',
    required: ['title'],
    writable: [
      'company_id', 'contact_id', 'opportunity_id', 'template_id', 'title', 'type',
      'status', 'objective', 'target', 'budget_estimate', 'deadline', 'answers_json',
      'missing_materials_json', 'internal_notes', 'client_notes',
    ],
    searchable: ['title', 'type', 'objective', 'target', 'internal_notes', 'client_notes'],
    filters: ['status', 'type', 'company_id', 'opportunity_id', 'template_id'],
    sort: ['created_at', 'updated_at', 'deadline'],
    defaultSort: 'updated_at',
    joins: `
      LEFT JOIN "{schema}".companies c ON c.id = t.company_id
      LEFT JOIN "{schema}".contacts ct ON ct.id = t.contact_id
      LEFT JOIN "{schema}".opportunities o ON o.id = t.opportunity_id
      LEFT JOIN "{schema}".briefing_templates bt ON bt.id = t.template_id
    `,
    selectExtra: `, c.name AS company_name, concat_ws(' ', ct.first_name, ct.last_name) AS contact_name, o.title AS opportunity_title, bt.name AS template_name`,
    jsonFields: ['answers_json', 'missing_materials_json'],
    uuidFields: ['company_id', 'contact_id', 'opportunity_id', 'template_id'],
  },
  materials: {
    table: 'briefing_material_requests',
    required: ['briefing_id', 'title'],
    writable: ['briefing_id', 'company_id', 'title', 'description', 'type', 'status', 'due_at', 'received_at', 'file_id'],
    searchable: ['title', 'description', 'type'],
    filters: ['briefing_id', 'company_id', 'status', 'type'],
    sort: ['created_at', 'updated_at', 'due_at'],
    defaultSort: 'updated_at',
    joins: `
      LEFT JOIN "{schema}".briefings b ON b.id = t.briefing_id
      LEFT JOIN "{schema}".companies c ON c.id = t.company_id
    `,
    selectExtra: `, b.title AS briefing_title, c.name AS company_name`,
    uuidFields: ['briefing_id', 'company_id', 'file_id'],
  },
};

@Injectable()
export class TenantBriefingService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getUser() {
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
    const schema = safeSchema(tenantRef || 'public', 'TenantBriefingService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Briefing non disponibile nel contesto public');
    return schema;
  }

  private assertAccess(write = false) {
    const user = this.getUser();
    if (!hasRoleAtLeast(user.role, 'manager')) {
      throw new ForbiddenException(write ? 'Manager o superiore richiesto per modificare i briefing.' : 'Manager o superiore richiesto per leggere i briefing.');
    }
    return user;
  }

  private async ensureSchema(schema: string) {
    await ensureTenantCrmCoreTables(this.dataSource, schema);
    await ensureTenantBriefingQuoteTables(this.dataSource, schema);
  }

  private userIdOrNull(userId: string): string | null {
    return UUID_RE.test(userId) ? userId : null;
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

  private normalizeSort(config: ResourceConfig, sortBy?: string, sortOrder?: string) {
    const column = config.sort.includes(String(sortBy || '')) ? String(sortBy) : config.defaultSort;
    const direction = String(sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    return { column, direction };
  }

  private buildWhere(config: ResourceConfig, query: Record<string, any>, extra: string[] = [], params: unknown[] = []) {
    const where = ['t.deleted_at IS NULL', ...extra];
    const search = String(query.search || '').trim();
    if (search && config.searchable.length > 0) {
      params.push(`%${search.toLowerCase()}%`);
      const idx = params.length;
      where.push(`(${config.searchable.map((field) => `lower(coalesce(t.${field}::text, '')) LIKE $${idx}`).join(' OR ')})`);
    }

    for (const filter of config.filters) {
      const value = query[filter];
      if (value === undefined || value === null || value === '') continue;
      params.push(value);
      where.push(`t.${filter} = $${params.length}`);
    }

    return { where: where.join(' AND '), params };
  }

  private joins(config: ResourceConfig, schema: string): string {
    return (config.joins || '').replace(/\{schema\}/g, schema);
  }

  private select(config: ResourceConfig): string {
    return `t.*${config.selectExtra || ''}`;
  }

  private cleanBody(config: ResourceConfig, body: Record<string, any>, partial: boolean) {
    const cleaned: Record<string, unknown> = {};
    for (const field of config.writable) {
      if (!(field in body)) continue;
      const value = body[field];
      if (value === '') cleaned[field] = null;
      else if (config.jsonFields?.includes(field) && value !== null) cleaned[field] = JSON.stringify(value);
      else cleaned[field] = value;
    }

    if (!partial) {
      for (const field of config.required) {
        const value = cleaned[field] ?? body[field];
        if (value === undefined || value === null || String(value).trim() === '') {
          throw new BadRequestException(`${field} obbligatorio`);
        }
      }
    }

    for (const key of config.uuidFields || []) {
      if (cleaned[key] && !UUID_RE.test(String(cleaned[key]))) throw new BadRequestException(`${key} non valido`);
    }

    if (cleaned.status && config.table === 'briefings' && !BRIEFING_STATUSES.includes(String(cleaned.status))) {
      throw new BadRequestException('Status briefing non valido');
    }
    if (cleaned.status && config.table === 'briefing_material_requests' && !MATERIAL_STATUSES.includes(String(cleaned.status))) {
      throw new BadRequestException('Status materiale non valido');
    }

    return cleaned;
  }

  async list(resource: BriefingResource, query: Record<string, any>, extraWhere: string[] = [], extraParams: unknown[] = []) {
    this.assertAccess(false);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = RESOURCES[resource];
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const { column, direction } = this.normalizeSort(config, query.sortBy, query.sortOrder);
    const { where, params } = this.buildWhere(config, query, extraWhere, extraParams);

    const countRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "${schema}".${config.table} t ${this.joins(config, schema)} WHERE ${where}`,
      params,
    );
    const rows = await this.dataSource.query(
      `SELECT ${this.select(config)}
       FROM "${schema}".${config.table} t
       ${this.joins(config, schema)}
       WHERE ${where}
       ORDER BY t.${column} ${direction} NULLS LAST, t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return { items: rows, total: Number(countRows[0]?.total || 0), limit, offset };
  }

  async findOne(resource: BriefingResource, id: string) {
    this.assertAccess(false);
    if (!UUID_RE.test(id)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = RESOURCES[resource];
    const rows = await this.dataSource.query(
      `SELECT ${this.select(config)}
       FROM "${schema}".${config.table} t
       ${this.joins(config, schema)}
       WHERE t.id = $1 AND t.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Record briefing non trovato');
    return rows[0];
  }

  async create(resource: BriefingResource, body: Record<string, any>) {
    const user = this.assertAccess(true);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = RESOURCES[resource];
    const cleaned = this.cleanBody(config, body, false);
    const userId = this.userIdOrNull(user.id);
    const columns = [...Object.keys(cleaned), 'created_by', 'updated_by'];
    const values = [...Object.values(cleaned), userId, userId];
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".${config.table} (${columns.join(', ')})
       VALUES (${placeholders})
       RETURNING id`,
      values,
    );
    await this.audit(schema, user, `briefing_${resource}_created`, rows[0].id, cleaned);
    return this.findOne(resource, rows[0].id);
  }

  async update(resource: BriefingResource, id: string, body: Record<string, any>) {
    const user = this.assertAccess(true);
    if (!UUID_RE.test(id)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = RESOURCES[resource];
    const cleaned = this.cleanBody(config, body, true);
    const entries = Object.entries(cleaned);
    if (entries.length === 0) return this.findOne(resource, id);
    const sets = entries.map(([field], i) => `${field} = $${i + 1}`);
    const params = entries.map(([, value]) => value);
    params.push(this.userIdOrNull(user.id), id);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".${config.table}
       SET ${sets.join(', ')}, updated_by = $${params.length - 1}, updated_at = now()
       WHERE id = $${params.length} AND deleted_at IS NULL
       RETURNING id`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Record briefing non trovato');
    await this.audit(schema, user, `briefing_${resource}_updated`, id, cleaned);
    return this.findOne(resource, id);
  }

  async remove(resource: BriefingResource, id: string) {
    const user = this.assertAccess(true);
    if (!UUID_RE.test(id)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = RESOURCES[resource];
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".${config.table}
       SET deleted_at = now(), updated_by = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [this.userIdOrNull(user.id), id],
    );
    if (!rows[0]) throw new NotFoundException('Record briefing non trovato');
    await this.audit(schema, user, `briefing_${resource}_deleted`, id, {});
    return { success: true };
  }

  async updateStatus(id: string, status: string) {
    if (!BRIEFING_STATUSES.includes(status)) throw new BadRequestException('Status briefing non valido');
    return this.update('briefings', id, { status });
  }

  async approve(id: string) {
    const user = this.assertAccess(true);
    if (!UUID_RE.test(id)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".briefings
       SET status = 'approved',
           approved_by = $1,
           approved_at = now(),
           updated_by = $1,
           updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [this.userIdOrNull(user.id), id],
    );
    if (!rows[0]) throw new NotFoundException('Briefing non trovato');
    await this.audit(schema, user, 'briefing_approved', id, {});
    return this.findOne('briefings', id);
  }

  async listMaterials(briefingId: string, query: Record<string, any>) {
    if (!UUID_RE.test(briefingId)) throw new BadRequestException('ID briefing non valido');
    return this.list('materials', { ...query, briefing_id: briefingId });
  }

  async createMaterial(briefingId: string, body: Record<string, any>) {
    if (!UUID_RE.test(briefingId)) throw new BadRequestException('ID briefing non valido');
    await this.findOne('briefings', briefingId);
    return this.create('materials', { ...body, briefing_id: briefingId });
  }

  private async audit(schema: string, user: { email?: string; role: string }, action: string, target: string, metadata: Record<string, unknown>) {
    try {
      await this.dataSource.query(
        `INSERT INTO "${schema}".audit_log (actor_email, actor_role, action, target, metadata, created_at)
         VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
        [user.email || null, user.role, action, target, JSON.stringify(metadata || {})],
      );
    } catch {
      // Audit non bloccante per tenant legacy.
    }
  }
}
