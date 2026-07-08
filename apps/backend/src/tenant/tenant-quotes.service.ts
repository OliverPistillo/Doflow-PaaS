import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, QueryRunner } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import { ensureTenantCrmCoreTables } from './tenant-crm-schema';
import { ensureTenantBriefingQuoteTables } from './tenant-briefing-quotes-schema';

type QuoteResource = 'serviceTemplates' | 'quotes';

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
  uuidFields?: string[];
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const QUOTE_STATUSES = ['draft', 'sent', 'viewed', 'accepted', 'rejected', 'expired'];
const BILLING_TYPES = ['one_time', 'monthly', 'yearly'];

const RESOURCES: Record<QuoteResource, ResourceConfig> = {
  serviceTemplates: {
    table: 'service_templates',
    required: ['name'],
    writable: [
      'name', 'category', 'description', 'default_unit_price', 'default_quantity',
      'billing_type', 'is_active',
    ],
    searchable: ['name', 'category', 'description'],
    filters: ['category', 'billing_type', 'is_active'],
    sort: ['created_at', 'updated_at', 'name'],
    defaultSort: 'updated_at',
  },
  quotes: {
    table: 'quotes',
    required: ['title'],
    writable: [
      'company_id', 'contact_id', 'opportunity_id', 'briefing_id', 'quote_number',
      'title', 'status', 'currency', 'valid_until', 'client_notes', 'internal_notes',
      'terms', 'accepted_by_contact_id',
    ],
    searchable: ['quote_number', 'title', 'currency', 'client_notes', 'internal_notes', 'terms'],
    filters: ['status', 'company_id', 'contact_id', 'opportunity_id', 'briefing_id'],
    sort: ['created_at', 'updated_at', 'valid_until'],
    defaultSort: 'updated_at',
    joins: `
      LEFT JOIN "{schema}".companies c ON c.id = t.company_id
      LEFT JOIN "{schema}".contacts ct ON ct.id = t.contact_id
      LEFT JOIN "{schema}".opportunities o ON o.id = t.opportunity_id
      LEFT JOIN "{schema}".briefings b ON b.id = t.briefing_id
    `,
    selectExtra: `, c.name AS company_name, concat_ws(' ', ct.first_name, ct.last_name) AS contact_name, o.title AS opportunity_title, b.title AS briefing_title`,
    uuidFields: ['company_id', 'contact_id', 'opportunity_id', 'briefing_id', 'accepted_by_contact_id'],
  },
};

@Injectable()
export class TenantQuotesService {
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
    const schema = safeSchema(tenantRef || 'public', 'TenantQuotesService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Preventivi non disponibili nel contesto public');
    return schema;
  }

  private assertAccess(write = false) {
    const user = this.getUser();
    if (!hasRoleAtLeast(user.role, 'manager')) {
      throw new ForbiddenException(write ? 'Manager o superiore richiesto per modificare i preventivi.' : 'Manager o superiore richiesto per leggere i preventivi.');
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

  private buildWhere(config: ResourceConfig, query: Record<string, any>) {
    const where = ['t.deleted_at IS NULL'];
    const params: unknown[] = [];
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
      cleaned[field] = value === '' ? null : value;
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
    if (cleaned.status && !QUOTE_STATUSES.includes(String(cleaned.status))) throw new BadRequestException('Status preventivo non valido');
    if (cleaned.billing_type && !BILLING_TYPES.includes(String(cleaned.billing_type))) throw new BadRequestException('billing_type non valido');
    for (const numeric of ['default_unit_price', 'default_quantity']) {
      if (cleaned[numeric] !== undefined && cleaned[numeric] !== null) cleaned[numeric] = this.toNumber(cleaned[numeric], numeric);
    }
    return cleaned;
  }

  private cleanItemBody(body: Record<string, any>, partial: boolean) {
    const fields = [
      'service_template_id', 'name', 'description', 'quantity', 'unit_price',
      'discount', 'tax_rate', 'billing_type', 'sort_order',
    ];
    const cleaned: Record<string, unknown> = {};
    for (const field of fields) {
      if (!(field in body)) continue;
      const value = body[field];
      cleaned[field] = value === '' ? null : value;
    }
    if (!partial && !String(cleaned.name ?? body.name ?? '').trim()) throw new BadRequestException('name obbligatorio');
    if (cleaned.service_template_id && !UUID_RE.test(String(cleaned.service_template_id))) throw new BadRequestException('service_template_id non valido');
    if (cleaned.billing_type && !BILLING_TYPES.includes(String(cleaned.billing_type))) throw new BadRequestException('billing_type non valido');
    for (const numeric of ['quantity', 'unit_price', 'discount', 'tax_rate']) {
      if (cleaned[numeric] !== undefined && cleaned[numeric] !== null) cleaned[numeric] = this.toNumber(cleaned[numeric], numeric);
    }
    if (cleaned.sort_order !== undefined && cleaned.sort_order !== null) {
      const n = Number(cleaned.sort_order);
      if (!Number.isFinite(n)) throw new BadRequestException('sort_order non valido');
      cleaned.sort_order = Math.trunc(n);
    }
    return cleaned;
  }

  private toNumber(value: unknown, field: string): number {
    const n = Number(value);
    if (!Number.isFinite(n)) throw new BadRequestException(`${field} non valido`);
    return n;
  }

  private itemTotal(values: Record<string, unknown>) {
    const quantity = Number(values.quantity ?? 1);
    const unitPrice = Number(values.unit_price ?? 0);
    const discount = Number(values.discount ?? 0);
    const taxRate = Number(values.tax_rate ?? 0);
    const net = quantity * unitPrice - discount;
    const tax = net * (taxRate / 100);
    return Number((net + tax).toFixed(2));
  }

  async list(resource: QuoteResource, query: Record<string, any>) {
    this.assertAccess(false);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = RESOURCES[resource];
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const { column, direction } = this.normalizeSort(config, query.sortBy, query.sortOrder);
    const { where, params } = this.buildWhere(config, query);
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

  async findOne(resource: QuoteResource, id: string) {
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
    if (!rows[0]) throw new NotFoundException('Preventivo non trovato');
    if (resource === 'quotes') {
      rows[0].items = await this.listItems(schema, id);
    }
    return rows[0];
  }

  async create(resource: QuoteResource, body: Record<string, any>) {
    const user = this.assertAccess(true);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const config = RESOURCES[resource];
    const cleaned = this.cleanBody(config, body, false);
    const userId = this.userIdOrNull(user.id);

    if (resource === 'quotes') {
      return this.createQuote(schema, user, cleaned, userId);
    }

    const columns = [...Object.keys(cleaned), 'created_by', 'updated_by'];
    const values = [...Object.values(cleaned), userId, userId];
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".${config.table} (${columns.join(', ')})
       VALUES (${placeholders})
       RETURNING id`,
      values,
    );
    await this.audit(schema, user, `quotes_${resource}_created`, rows[0].id, cleaned);
    return this.findOne(resource, rows[0].id);
  }

  private async createQuote(schema: string, user: { email?: string; role: string }, cleaned: Record<string, unknown>, userId: string | null) {
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const values = { ...cleaned };
      if (!values.quote_number) values.quote_number = await this.nextQuoteNumber(runner, schema);
      const columns = [...Object.keys(values), 'created_by', 'updated_by'];
      const params = [...Object.values(values), userId, userId];
      const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
      const rows = await runner.query(
        `INSERT INTO "${schema}".quotes (${columns.join(', ')})
         VALUES (${placeholders})
         RETURNING id`,
        params,
      );
      await runner.commitTransaction();
      await this.audit(schema, user, 'quotes_quotes_created', rows[0].id, values);
      return this.findOne('quotes', rows[0].id);
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
  }

  private async nextQuoteNumber(runner: QueryRunner, schema: string): Promise<string> {
    const year = new Date().getFullYear();
    await runner.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${schema}:quotes:${year}`]);
    const rows = await runner.query(
      `SELECT quote_number
       FROM "${schema}".quotes
       WHERE quote_number LIKE $1 AND deleted_at IS NULL
       ORDER BY quote_number DESC
       LIMIT 1`,
      [`Q-${year}-%`],
    );
    const last = String(rows[0]?.quote_number || '');
    const lastSeq = Number(last.match(/-(\d+)$/)?.[1] || 0);
    return `Q-${year}-${String(lastSeq + 1).padStart(4, '0')}`;
  }

  async update(resource: QuoteResource, id: string, body: Record<string, any>) {
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
    if (!rows[0]) throw new NotFoundException('Preventivo non trovato');
    await this.audit(schema, user, `quotes_${resource}_updated`, id, cleaned);
    return this.findOne(resource, id);
  }

  async remove(resource: QuoteResource, id: string) {
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
    if (!rows[0]) throw new NotFoundException('Preventivo non trovato');
    await this.audit(schema, user, `quotes_${resource}_deleted`, id, {});
    return { success: true };
  }

  async updateQuoteStatus(id: string, status: string) {
    if (!QUOTE_STATUSES.includes(status)) throw new BadRequestException('Status preventivo non valido');
    return this.update('quotes', id, { status });
  }

  async addItem(quoteId: string, body: Record<string, any>) {
    const user = this.assertAccess(true);
    if (!UUID_RE.test(quoteId)) throw new BadRequestException('ID preventivo non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.ensureQuoteExists(schema, quoteId);
    const cleaned = this.cleanItemBody(body, false);
    cleaned.total = this.itemTotal(cleaned);
    const columns = ['quote_id', ...Object.keys(cleaned)];
    const values = [quoteId, ...Object.values(cleaned)];
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".quote_items (${columns.join(', ')})
       VALUES (${placeholders})
       RETURNING id`,
      values,
    );
    await this.recalculateQuoteTotals(schema, quoteId);
    await this.audit(schema, user, 'quote_item_created', rows[0].id, { quoteId });
    return this.findOne('quotes', quoteId);
  }

  async updateItem(quoteId: string, itemId: string, body: Record<string, any>) {
    const user = this.assertAccess(true);
    if (!UUID_RE.test(quoteId) || !UUID_RE.test(itemId)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.ensureQuoteExists(schema, quoteId);
    const currentRows = await this.dataSource.query(
      `SELECT * FROM "${schema}".quote_items WHERE id = $1 AND quote_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [itemId, quoteId],
    );
    if (!currentRows[0]) throw new NotFoundException('Riga preventivo non trovata');
    const cleaned = this.cleanItemBody(body, true);
    const merged = { ...currentRows[0], ...cleaned };
    cleaned.total = this.itemTotal(merged);
    const entries = Object.entries(cleaned);
    if (entries.length > 0) {
      const sets = entries.map(([field], i) => `${field} = $${i + 1}`);
      await this.dataSource.query(
        `UPDATE "${schema}".quote_items
         SET ${sets.join(', ')}, updated_at = now()
         WHERE id = $${entries.length + 1} AND quote_id = $${entries.length + 2} AND deleted_at IS NULL`,
        [...entries.map(([, value]) => value), itemId, quoteId],
      );
    }
    await this.recalculateQuoteTotals(schema, quoteId);
    await this.audit(schema, user, 'quote_item_updated', itemId, { quoteId });
    return this.findOne('quotes', quoteId);
  }

  async deleteItem(quoteId: string, itemId: string) {
    const user = this.assertAccess(true);
    if (!UUID_RE.test(quoteId) || !UUID_RE.test(itemId)) throw new BadRequestException('ID non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".quote_items
       SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND quote_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [itemId, quoteId],
    );
    if (!rows[0]) throw new NotFoundException('Riga preventivo non trovata');
    await this.recalculateQuoteTotals(schema, quoteId);
    await this.audit(schema, user, 'quote_item_deleted', itemId, { quoteId });
    return this.findOne('quotes', quoteId);
  }

  async recalculate(id: string) {
    this.assertAccess(true);
    if (!UUID_RE.test(id)) throw new BadRequestException('ID preventivo non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.ensureQuoteExists(schema, id);
    await this.recalculateQuoteTotals(schema, id);
    return this.findOne('quotes', id);
  }

  async accept(id: string, body: Record<string, any>) {
    const user = this.assertAccess(true);
    if (!UUID_RE.test(id)) throw new BadRequestException('ID preventivo non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const acceptedByContactId = body.accepted_by_contact_id || body.acceptedByContactId || null;
    if (acceptedByContactId && !UUID_RE.test(String(acceptedByContactId))) throw new BadRequestException('accepted_by_contact_id non valido');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".quotes
       SET status = 'accepted',
           accepted_at = now(),
           rejected_at = NULL,
           accepted_by_contact_id = COALESCE($1, accepted_by_contact_id),
           updated_by = $2,
           updated_at = now()
       WHERE id = $3 AND deleted_at IS NULL
       RETURNING id, opportunity_id`,
      [acceptedByContactId, this.userIdOrNull(user.id), id],
    );
    if (!rows[0]) throw new NotFoundException('Preventivo non trovato');
    if (rows[0].opportunity_id) {
      await this.dataSource.query(
        `UPDATE "${schema}".opportunities
         SET stage = 'accepted', updated_by = $1, updated_at = now()
         WHERE id = $2 AND deleted_at IS NULL`,
        [this.userIdOrNull(user.id), rows[0].opportunity_id],
      );
    }
    await this.audit(schema, user, 'quote_accepted', id, { opportunityId: rows[0].opportunity_id || null });
    return this.findOne('quotes', id);
  }

  async reject(id: string) {
    const user = this.assertAccess(true);
    if (!UUID_RE.test(id)) throw new BadRequestException('ID preventivo non valido');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".quotes
       SET status = 'rejected',
           rejected_at = now(),
           updated_by = $1,
           updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [this.userIdOrNull(user.id), id],
    );
    if (!rows[0]) throw new NotFoundException('Preventivo non trovato');
    await this.audit(schema, user, 'quote_rejected', id, {});
    return this.findOne('quotes', id);
  }

  private async listItems(schema: string, quoteId: string) {
    return this.dataSource.query(
      `SELECT qi.*, st.name AS service_template_name
       FROM "${schema}".quote_items qi
       LEFT JOIN "${schema}".service_templates st ON st.id = qi.service_template_id
       WHERE qi.quote_id = $1 AND qi.deleted_at IS NULL
       ORDER BY qi.sort_order ASC, qi.created_at ASC`,
      [quoteId],
    );
  }

  private async ensureQuoteExists(schema: string, quoteId: string) {
    const rows = await this.dataSource.query(
      `SELECT id FROM "${schema}".quotes WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [quoteId],
    );
    if (!rows[0]) throw new NotFoundException('Preventivo non trovato');
  }

  private async recalculateQuoteTotals(schema: string, quoteId: string) {
    const rows = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(quantity * unit_price), 0)::numeric AS subtotal,
         COALESCE(SUM(discount), 0)::numeric AS discount_total,
         COALESCE(SUM((quantity * unit_price - discount) * tax_rate / 100), 0)::numeric AS tax_total,
         COALESCE(SUM(total), 0)::numeric AS total
       FROM "${schema}".quote_items
       WHERE quote_id = $1 AND deleted_at IS NULL`,
      [quoteId],
    );
    const totals = rows[0] || {};
    await this.dataSource.query(
      `UPDATE "${schema}".quotes
       SET subtotal = $1,
           discount_total = $2,
           tax_total = $3,
           total = $4,
           updated_at = now()
       WHERE id = $5 AND deleted_at IS NULL`,
      [
        Number(totals.subtotal || 0),
        Number(totals.discount_total || 0),
        Number(totals.tax_total || 0),
        Number(totals.total || 0),
        quoteId,
      ],
    );
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
