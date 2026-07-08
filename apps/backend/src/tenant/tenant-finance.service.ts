import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, QueryRunner } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantFinanceTables } from './tenant-finance-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FINANCE_ROLES = ['owner', 'admin', 'superadmin', 'super_admin'];
const INVOICE_TYPES = ['standard', 'deposit', 'balance', 'recurring', 'renewal', 'credit_note', 'proforma'];
const INVOICE_STATUSES = ['draft', 'issued', 'sent', 'paid', 'partially_paid', 'overdue', 'cancelled', 'void'];
const PAYMENT_STATUSES = ['pending', 'recorded', 'confirmed', 'failed', 'refunded', 'cancelled'];
const PAYMENT_METHODS = ['bank_transfer', 'cash', 'card', 'paypal', 'stripe', 'other'];
const DEADLINE_TYPES = ['deposit', 'balance', 'invoice_due', 'renewal', 'recurring_fee', 'other', 'payment'];
const DEADLINE_STATUSES = ['open', 'completed', 'overdue', 'cancelled'];
const RECURRING_STATUSES = ['active', 'paused', 'cancelled', 'expired'];
const BILLING_CYCLES = ['monthly', 'quarterly', 'yearly', 'one_time'];
const RENEWAL_STATUSES = ['upcoming', 'reminded', 'invoiced', 'paid', 'cancelled', 'expired'];
const PROJECT_PAYMENT_STATUSES = ['not_started', 'deposit_due', 'deposit_paid', 'partially_paid', 'paid', 'overdue'];

type AuthUser = { id: string; email?: string; role: string };
type ListConfig = {
  table: string;
  searchable: string[];
  filters: string[];
  sort: string[];
  defaultSort: string;
  dateColumn?: string;
  joins?: string;
  select?: string;
};

@Injectable()
export class TenantFinanceService {
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
    const schema = safeSchema(tenantRef || 'public', 'TenantFinanceService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Finance V2 non disponibile nel contesto public');
    return schema;
  }

  private assertFinanceAccess() {
    const user = this.getUser();
    if (!FINANCE_ROLES.includes(user.role)) {
      throw new ForbiddenException('Finance disponibile solo per CEO/Admin.');
    }
    return user;
  }

  private async ensureSchema(schema: string) {
    await ensureTenantFinanceTables(this.dataSource, schema);
  }

  private userIdOrNull(userId: string): string | null {
    return UUID_RE.test(userId) ? userId : null;
  }

  private requireUuid(value: string, label = 'ID'): string {
    if (!UUID_RE.test(String(value))) throw new BadRequestException(`${label} non valido`);
    return String(value);
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

  private toNumber(value: unknown, field: string, fallback?: number): number {
    if (value === undefined || value === null || value === '') {
      if (fallback !== undefined) return fallback;
      throw new BadRequestException(`${field} obbligatorio`);
    }
    const n = Number(value);
    if (!Number.isFinite(n)) throw new BadRequestException(`${field} non valido`);
    return n;
  }

  private numberOrNull(value: unknown, field: string): number | null {
    if (value === undefined || value === null || value === '') return null;
    return this.toNumber(value, field);
  }

  private textOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private itemTotal(values: Record<string, unknown>) {
    const quantity = Number(values.quantity ?? 1);
    const unitPrice = Number(values.unit_price ?? 0);
    const discount = Number(values.discount ?? 0);
    const taxRate = Number(values.tax_rate ?? 0);
    const net = Math.max(quantity * unitPrice - discount, 0);
    const tax = net * (taxRate / 100);
    return Number((net + tax).toFixed(2));
  }

  private listConfig(table: string): ListConfig {
    const configs: Record<string, ListConfig> = {
      invoices: {
        table: 'invoices',
        searchable: ['invoice_number', 'title', 'external_reference', 'client_notes', 'internal_notes'],
        filters: ['status', 'type', 'company_id', 'project_id', 'quote_id'],
        sort: ['created_at', 'updated_at', 'issue_date', 'due_date', 'total'],
        defaultSort: 'updated_at',
        dateColumn: 'issue_date',
        select: `t.*, c.name AS company_name, p.name AS project_name, q.quote_number, q.title AS quote_title`,
        joins: `
          LEFT JOIN "{schema}".companies c ON c.id = t.company_id
          LEFT JOIN "{schema}".projects p ON p.id = t.project_id
          LEFT JOIN "{schema}".quotes q ON q.id = t.quote_id
        `,
      },
      payments: {
        table: 'payments',
        searchable: ['reference', 'notes', 'method'],
        filters: ['status', 'company_id', 'project_id', 'invoice_id'],
        sort: ['created_at', 'updated_at', 'payment_date', 'amount'],
        defaultSort: 'payment_date',
        dateColumn: 'payment_date',
        select: `t.*, i.invoice_number, i.title AS invoice_title, c.name AS company_name, p.name AS project_name`,
        joins: `
          LEFT JOIN "{schema}".invoices i ON i.id = t.invoice_id
          LEFT JOIN "{schema}".companies c ON c.id = t.company_id
          LEFT JOIN "{schema}".projects p ON p.id = t.project_id
        `,
      },
      financial_deadlines: {
        table: 'financial_deadlines',
        searchable: ['title', 'notes'],
        filters: ['status', 'type', 'company_id', 'project_id', 'quote_id', 'invoice_id'],
        sort: ['created_at', 'updated_at', 'due_date', 'amount'],
        defaultSort: 'due_date',
        dateColumn: 'due_date',
      },
      recurring_services: {
        table: 'recurring_services',
        searchable: ['name', 'category', 'internal_notes', 'client_notes'],
        filters: ['status', 'category', 'billing_cycle', 'company_id', 'project_id', 'quote_id'],
        sort: ['created_at', 'updated_at', 'next_due_date', 'amount', 'name'],
        defaultSort: 'next_due_date',
        dateColumn: 'next_due_date',
      },
      renewals: {
        table: 'renewals',
        searchable: ['title', 'notes'],
        filters: ['status', 'company_id', 'project_id', 'recurring_service_id', 'invoice_id'],
        sort: ['created_at', 'updated_at', 'due_date', 'amount'],
        defaultSort: 'due_date',
        dateColumn: 'due_date',
      },
    };
    return configs[table];
  }

  private buildListWhere(config: ListConfig, query: Record<string, any>) {
    const where = ['t.deleted_at IS NULL'];
    const params: unknown[] = [];
    const search = String(query.search || '').trim();
    if (search && config.searchable.length > 0) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(${config.searchable.map((field) => `lower(coalesce(t.${field}::text, '')) LIKE $${params.length}`).join(' OR ')})`);
    }
    for (const filter of config.filters) {
      const value = query[filter];
      if (value === undefined || value === null || value === '') continue;
      params.push(value);
      where.push(`t.${filter} = $${params.length}`);
    }
    if (query.due_from && config.dateColumn) {
      params.push(query.due_from);
      where.push(`COALESCE(t.${config.dateColumn}, t.created_at::date) >= $${params.length}`);
    }
    if (query.due_to && config.dateColumn) {
      params.push(query.due_to);
      where.push(`COALESCE(t.${config.dateColumn}, t.created_at::date) <= $${params.length}`);
    }
    if (query.date_from && config.dateColumn) {
      params.push(query.date_from);
      where.push(`COALESCE(t.${config.dateColumn}, t.created_at::date) >= $${params.length}`);
    }
    if (query.date_to && config.dateColumn) {
      params.push(query.date_to);
      where.push(`COALESCE(t.${config.dateColumn}, t.created_at::date) <= $${params.length}`);
    }
    return { where: where.join(' AND '), params };
  }

  async list(table: 'invoices' | 'payments' | 'financial_deadlines' | 'recurring_services' | 'renewals', query: Record<string, any>) {
    this.assertFinanceAccess();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    if (table === 'financial_deadlines') await this.refreshOverdueDeadlines(schema);
    const config = this.listConfig(table);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sortBy = config.sort.includes(String(query.sortBy || '')) ? String(query.sortBy) : config.defaultSort;
    const sortOrder = String(query.sortOrder || 'desc').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    const { where, params } = this.buildListWhere(config, query);
    const joins = (config.joins || '').replace(/\{schema\}/g, schema);
    const select = config.select || 't.*';
    const countRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS total FROM "${schema}".${config.table} t ${joins} WHERE ${where}`,
      params,
    );
    const rows = await this.dataSource.query(
      `SELECT ${select}
       FROM "${schema}".${config.table} t
       ${joins}
       WHERE ${where}
       ORDER BY t.${sortBy} ${sortOrder} NULLS LAST, t.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return { items: rows, total: Number(countRows[0]?.total || 0), limit, offset };
  }

  async findInvoice(id: string) {
    this.assertFinanceAccess();
    this.requireUuid(id, 'ID fattura');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT i.*, c.name AS company_name, p.name AS project_name, q.quote_number, q.title AS quote_title
       FROM "${schema}".invoices i
       LEFT JOIN "${schema}".companies c ON c.id = i.company_id
       LEFT JOIN "${schema}".projects p ON p.id = i.project_id
       LEFT JOIN "${schema}".quotes q ON q.id = i.quote_id
       WHERE i.id = $1 AND i.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Fattura non trovata');
    rows[0].items = await this.listInvoiceItems(schema, id);
    rows[0].payments = await this.dataSource.query(
      `SELECT * FROM "${schema}".payments WHERE invoice_id = $1 AND deleted_at IS NULL ORDER BY payment_date DESC NULLS LAST, created_at DESC`,
      [id],
    );
    return rows[0];
  }

  async createInvoice(body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanInvoiceBody(body, false);
    const row = await this.insertRow(schema, 'invoices', {
      ...cleaned,
      created_by: this.userIdOrNull(user.id),
      updated_by: this.userIdOrNull(user.id),
    });
    await this.audit(schema, user, 'finance_invoice_created', row.id, cleaned);
    return this.findInvoice(row.id);
  }

  async updateInvoice(id: string, body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    this.requireUuid(id, 'ID fattura');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanInvoiceBody(body, true);
    await this.updateRow(schema, 'invoices', id, cleaned, this.userIdOrNull(user.id));
    await this.audit(schema, user, 'finance_invoice_updated', id, cleaned);
    return this.findInvoice(id);
  }

  async deleteInvoice(id: string) {
    const user = this.assertFinanceAccess();
    this.requireUuid(id, 'ID fattura');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".invoices
       SET deleted_at = now(), updated_by = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, project_id`,
      [this.userIdOrNull(user.id), id],
    );
    if (!rows[0]) throw new NotFoundException('Fattura non trovata');
    if (rows[0].project_id) await this.recalculateProjectFinancialStatusInternal(schema, rows[0].project_id, user);
    await this.audit(schema, user, 'finance_invoice_deleted', id, {});
    return { success: true };
  }

  async updateInvoiceStatus(id: string, status: string) {
    if (!INVOICE_STATUSES.includes(status)) throw new BadRequestException('Status fattura non valido');
    const invoice = await this.updateInvoice(id, {
      status,
      paid_at: status === 'paid' ? new Date().toISOString() : null,
    });
    return invoice;
  }

  async createInvoiceFromQuote(quoteId: string, body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    this.requireUuid(quoteId, 'ID preventivo');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const existing = await runner.query(
        `SELECT id FROM "${schema}".invoices WHERE quote_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [quoteId],
      );
      if (existing[0]) {
        await runner.commitTransaction();
        return { existing: true, invoice: await this.findInvoice(existing[0].id) };
      }
      const quoteRows = await runner.query(
        `SELECT * FROM "${schema}".quotes WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [quoteId],
      );
      const quote = quoteRows[0];
      if (!quote) throw new NotFoundException('Preventivo non trovato');
      const invoiceId = await this.insertInvoiceFromSource(runner, schema, {
        company_id: quote.company_id || null,
        contact_id: quote.contact_id || null,
        opportunity_id: quote.opportunity_id || null,
        briefing_id: quote.briefing_id || null,
        quote_id: quote.id,
        project_id: body.project_id ? this.requireUuid(String(body.project_id), 'project_id') : null,
        title: this.textOrNull(body.title) || quote.title || 'Fattura da preventivo',
        type: this.normalizeEnum(body.type, INVOICE_TYPES, 'standard', 'type fattura non valido'),
        status: 'draft',
        currency: quote.currency || 'EUR',
        issue_date: body.issue_date || null,
        due_date: body.due_date || null,
        client_notes: body.client_notes ?? quote.client_notes ?? null,
        internal_notes: body.internal_notes ?? quote.internal_notes ?? null,
        created_by: this.userIdOrNull(user.id),
        updated_by: this.userIdOrNull(user.id),
      });
      await this.copyQuoteItemsToInvoice(runner, schema, quote.id, invoiceId);
      await this.recalculateInvoiceTotalsInternal(runner, schema, invoiceId);
      await runner.commitTransaction();
      await this.audit(schema, user, 'finance_invoice_created_from_quote', invoiceId, { quoteId });
      return { existing: false, invoice: await this.findInvoice(invoiceId) };
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
  }

  async createInvoiceFromProject(projectId: string, body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    this.requireUuid(projectId, 'ID progetto');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const projectRows = await runner.query(
        `SELECT p.*, q.currency AS quote_currency, q.title AS quote_title
         FROM "${schema}".projects p
         LEFT JOIN "${schema}".quotes q ON q.id = p.quote_id
         WHERE p.id = $1 AND p.deleted_at IS NULL
         LIMIT 1`,
        [projectId],
      );
      const project = projectRows[0];
      if (!project) throw new NotFoundException('Progetto non trovato');
      const type = this.normalizeEnum(body.type, INVOICE_TYPES, 'standard', 'type fattura non valido');
      const existing = await runner.query(
        `SELECT id FROM "${schema}".invoices
         WHERE project_id = $1 AND type = $2 AND status = 'draft' AND deleted_at IS NULL
         LIMIT 1`,
        [projectId, type],
      );
      if (existing[0]) {
        await runner.commitTransaction();
        return { existing: true, invoice: await this.findInvoice(existing[0].id) };
      }
      const invoiceId = await this.insertInvoiceFromSource(runner, schema, {
        company_id: project.company_id || null,
        contact_id: project.contact_id || null,
        opportunity_id: project.opportunity_id || null,
        briefing_id: project.briefing_id || null,
        quote_id: project.quote_id || null,
        project_id: project.id,
        title: this.textOrNull(body.title) || project.name || project.quote_title || 'Fattura da progetto',
        type,
        status: 'draft',
        currency: body.currency || project.quote_currency || 'EUR',
        issue_date: body.issue_date || null,
        due_date: body.due_date || null,
        client_notes: body.client_notes ?? project.client_notes ?? null,
        internal_notes: body.internal_notes ?? project.internal_notes ?? null,
        created_by: this.userIdOrNull(user.id),
        updated_by: this.userIdOrNull(user.id),
      });
      if (project.quote_id) await this.copyQuoteItemsToInvoice(runner, schema, project.quote_id, invoiceId);
      await this.recalculateInvoiceTotalsInternal(runner, schema, invoiceId);
      await runner.commitTransaction();
      await this.recalculateProjectFinancialStatusInternal(schema, projectId, user);
      await this.audit(schema, user, 'finance_invoice_created_from_project', invoiceId, { projectId });
      return { existing: false, invoice: await this.findInvoice(invoiceId) };
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
  }

  async recalculateInvoice(id: string) {
    this.assertFinanceAccess();
    this.requireUuid(id, 'ID fattura');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      await this.recalculateInvoiceTotalsInternal(runner, schema, id);
      await runner.commitTransaction();
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
    return this.findInvoice(id);
  }

  async addInvoiceItem(invoiceId: string, body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    this.requireUuid(invoiceId, 'ID fattura');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.ensureInvoiceExists(schema, invoiceId);
    const cleaned = this.cleanInvoiceItemBody(body, false);
    cleaned.total = this.itemTotal(cleaned);
    await this.insertRow(schema, 'invoice_items', { invoice_id: invoiceId, ...cleaned });
    await this.recalculateInvoice(invoiceId);
    await this.audit(schema, user, 'finance_invoice_item_created', invoiceId, {});
    return this.findInvoice(invoiceId);
  }

  async updateInvoiceItem(invoiceId: string, itemId: string, body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    this.requireUuid(invoiceId, 'ID fattura');
    this.requireUuid(itemId, 'ID riga fattura');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const currentRows = await this.dataSource.query(
      `SELECT * FROM "${schema}".invoice_items WHERE id = $1 AND invoice_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [itemId, invoiceId],
    );
    if (!currentRows[0]) throw new NotFoundException('Riga fattura non trovata');
    const cleaned = this.cleanInvoiceItemBody(body, true);
    cleaned.total = this.itemTotal({ ...currentRows[0], ...cleaned });
    await this.updateRow(schema, 'invoice_items', itemId, cleaned, null, `invoice_id = $${Object.keys(cleaned).length + 2}`, [invoiceId], false);
    await this.recalculateInvoice(invoiceId);
    await this.audit(schema, user, 'finance_invoice_item_updated', itemId, { invoiceId });
    return this.findInvoice(invoiceId);
  }

  async deleteInvoiceItem(invoiceId: string, itemId: string) {
    const user = this.assertFinanceAccess();
    this.requireUuid(invoiceId, 'ID fattura');
    this.requireUuid(itemId, 'ID riga fattura');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".invoice_items SET deleted_at = now(), updated_at = now()
       WHERE id = $1 AND invoice_id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [itemId, invoiceId],
    );
    if (!rows[0]) throw new NotFoundException('Riga fattura non trovata');
    await this.recalculateInvoice(invoiceId);
    await this.audit(schema, user, 'finance_invoice_item_deleted', itemId, { invoiceId });
    return this.findInvoice(invoiceId);
  }

  async findPayment(id: string) {
    this.assertFinanceAccess();
    this.requireUuid(id, 'ID pagamento');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT p.*, i.invoice_number, i.title AS invoice_title
       FROM "${schema}".payments p
       LEFT JOIN "${schema}".invoices i ON i.id = p.invoice_id
       WHERE p.id = $1 AND p.deleted_at IS NULL
       LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Pagamento non trovato');
    return rows[0];
  }

  async createPayment(body: Record<string, any>, invoiceId?: string) {
    const user = this.assertFinanceAccess();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanPaymentBody({ ...body, invoice_id: invoiceId || body.invoice_id }, false);
    if (cleaned.invoice_id) {
      const invoice = await this.ensureInvoiceExists(schema, String(cleaned.invoice_id));
      cleaned.company_id = cleaned.company_id || invoice.company_id || null;
      cleaned.project_id = cleaned.project_id || invoice.project_id || null;
    }
    const row = await this.insertRow(schema, 'payments', {
      ...cleaned,
      created_by: this.userIdOrNull(user.id),
      updated_by: this.userIdOrNull(user.id),
    });
    await this.afterPaymentMutation(schema, cleaned.invoice_id as string | null, cleaned.project_id as string | null, user);
    await this.audit(schema, user, 'finance_payment_created', row.id, cleaned);
    return this.findPayment(row.id);
  }

  async updatePayment(id: string, body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    this.requireUuid(id, 'ID pagamento');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const before = await this.findPayment(id);
    const cleaned = this.cleanPaymentBody(body, true);
    await this.updateRow(schema, 'payments', id, cleaned, this.userIdOrNull(user.id));
    await this.afterPaymentMutation(
      schema,
      (before.invoice_id || cleaned.invoice_id || null) as string | null,
      (before.project_id || cleaned.project_id || null) as string | null,
      user,
    );
    await this.audit(schema, user, 'finance_payment_updated', id, cleaned);
    return this.findPayment(id);
  }

  async deletePayment(id: string) {
    const user = this.assertFinanceAccess();
    this.requireUuid(id, 'ID pagamento');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".payments
       SET deleted_at = now(), updated_by = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id, invoice_id, project_id`,
      [this.userIdOrNull(user.id), id],
    );
    if (!rows[0]) throw new NotFoundException('Pagamento non trovato');
    await this.afterPaymentMutation(schema, rows[0].invoice_id || null, rows[0].project_id || null, user);
    await this.audit(schema, user, 'finance_payment_deleted', id, {});
    return { success: true };
  }

  async createDeadline(body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanDeadlineBody(body, false);
    const row = await this.insertRow(schema, 'financial_deadlines', {
      ...cleaned,
      created_by: this.userIdOrNull(user.id),
      updated_by: this.userIdOrNull(user.id),
    });
    await this.audit(schema, user, 'finance_deadline_created', row.id, cleaned);
    return row;
  }

  async updateDeadline(id: string, body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    this.requireUuid(id, 'ID scadenza');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanDeadlineBody(body, true);
    await this.updateRow(schema, 'financial_deadlines', id, cleaned, this.userIdOrNull(user.id));
    await this.audit(schema, user, 'finance_deadline_updated', id, cleaned);
    return { success: true };
  }

  async deleteDeadline(id: string) {
    return this.softDeleteSimple('financial_deadlines', id, 'Scadenza non trovata', 'finance_deadline_deleted');
  }

  async completeDeadline(id: string) {
    return this.updateDeadline(id, { status: 'completed', completed_at: new Date().toISOString() });
  }

  async createRecurringService(body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanRecurringBody(body, false);
    const row = await this.insertRow(schema, 'recurring_services', {
      ...cleaned,
      created_by: this.userIdOrNull(user.id),
      updated_by: this.userIdOrNull(user.id),
    });
    await this.audit(schema, user, 'finance_recurring_service_created', row.id, cleaned);
    return this.findSimple('recurring_services', row.id, 'Servizio ricorrente non trovato');
  }

  async findRecurringService(id: string) {
    this.assertFinanceAccess();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    return this.findSimple('recurring_services', this.requireUuid(id, 'ID servizio ricorrente'), 'Servizio ricorrente non trovato');
  }

  async updateRecurringService(id: string, body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanRecurringBody(body, true);
    await this.updateRow(schema, 'recurring_services', this.requireUuid(id, 'ID servizio ricorrente'), cleaned, this.userIdOrNull(user.id));
    await this.audit(schema, user, 'finance_recurring_service_updated', id, cleaned);
    return this.findRecurringService(id);
  }

  async deleteRecurringService(id: string) {
    return this.softDeleteSimple('recurring_services', id, 'Servizio ricorrente non trovato', 'finance_recurring_service_deleted');
  }

  async createRenewal(body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanRenewalBody(body, false);
    const row = await this.insertRow(schema, 'renewals', {
      ...cleaned,
      created_by: this.userIdOrNull(user.id),
      updated_by: this.userIdOrNull(user.id),
    });
    await this.audit(schema, user, 'finance_renewal_created', row.id, cleaned);
    return row;
  }

  async updateRenewal(id: string, body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanRenewalBody(body, true);
    await this.updateRow(schema, 'renewals', this.requireUuid(id, 'ID rinnovo'), cleaned, this.userIdOrNull(user.id));
    await this.audit(schema, user, 'finance_renewal_updated', id, cleaned);
    return { success: true };
  }

  async deleteRenewal(id: string) {
    return this.softDeleteSimple('renewals', id, 'Rinnovo non trovato', 'finance_renewal_deleted');
  }

  async updateRenewalStatus(id: string, status: string) {
    if (!RENEWAL_STATUSES.includes(status)) throw new BadRequestException('Status rinnovo non valido');
    return this.updateRenewal(id, {
      status,
      completed_at: status === 'paid' ? new Date().toISOString() : undefined,
    });
  }

  async getProjectFinancialStatus(projectId: string): Promise<any> {
    this.assertFinanceAccess();
    this.requireUuid(projectId, 'ID progetto');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT pfs.*, p.name AS project_name, q.quote_number
       FROM "${schema}".project_financial_status pfs
       LEFT JOIN "${schema}".projects p ON p.id = pfs.project_id
       LEFT JOIN "${schema}".quotes q ON q.id = pfs.quote_id
       WHERE pfs.project_id = $1 AND pfs.deleted_at IS NULL
       LIMIT 1`,
      [projectId],
    );
    if (rows[0]) return rows[0];
    return this.recalculateProjectFinancialStatus(projectId);
  }

  async updateProjectFinancialStatus(projectId: string, body: Record<string, any>) {
    const user = this.assertFinanceAccess();
    this.requireUuid(projectId, 'ID progetto');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const cleaned = this.cleanProjectFinancialStatusBody(body, true);
    await this.upsertProjectFinancialStatus(schema, projectId, cleaned, user);
    await this.audit(schema, user, 'finance_project_status_updated', projectId, cleaned);
    return this.getProjectFinancialStatus(projectId);
  }

  async recalculateProjectFinancialStatus(projectId: string): Promise<any> {
    const user = this.assertFinanceAccess();
    this.requireUuid(projectId, 'ID progetto');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.recalculateProjectFinancialStatusInternal(schema, projectId, user);
    return this.getProjectFinancialStatus(projectId);
  }

  async summary() {
    this.assertFinanceAccess();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    await this.refreshOverdueDeadlines(schema);
    const rows = await this.dataSource.query(
      `SELECT
         COUNT(*)::int AS invoices_total_count,
         COUNT(*) FILTER (WHERE status = 'draft')::int AS invoices_draft_count,
         COUNT(*) FILTER (WHERE status IN ('issued', 'sent'))::int AS invoices_issued_count,
         COUNT(*) FILTER (WHERE status = 'paid')::int AS invoices_paid_count,
         COUNT(*) FILTER (WHERE status = 'overdue' OR (due_date < current_date AND status NOT IN ('paid', 'cancelled', 'void')))::int AS invoices_overdue_count,
         COALESCE(SUM(total), 0)::numeric AS total_invoiced,
         COALESCE(SUM(paid_total), 0)::numeric AS total_paid,
         COALESCE(SUM(remaining_total), 0)::numeric AS total_outstanding
       FROM "${schema}".invoices
       WHERE deleted_at IS NULL`,
    );
    const payments = await this.dataSource.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS payments_this_month
       FROM "${schema}".payments
       WHERE deleted_at IS NULL
         AND status IN ('recorded', 'confirmed')
         AND date_trunc('month', COALESCE(payment_date, created_at::date)::timestamp) = date_trunc('month', current_date::timestamp)`,
    );
    const misc = await this.dataSource.query(
      `SELECT
         (SELECT COUNT(*)::int FROM "${schema}".financial_deadlines WHERE deleted_at IS NULL AND status = 'open') AS deadlines_open,
         (SELECT COUNT(*)::int FROM "${schema}".financial_deadlines WHERE deleted_at IS NULL AND (status = 'overdue' OR (status = 'open' AND due_date < current_date))) AS deadlines_overdue,
         (SELECT COUNT(*)::int FROM "${schema}".renewals WHERE deleted_at IS NULL AND status IN ('upcoming', 'reminded') AND due_date BETWEEN current_date AND current_date + INTERVAL '30 days') AS renewals_upcoming_30d,
         (SELECT COUNT(*)::int FROM "${schema}".recurring_services WHERE deleted_at IS NULL AND status = 'active') AS recurring_active_count`,
    );
    return {
      ...this.numericObject(rows[0] || {}),
      payments_this_month: Number(payments[0]?.payments_this_month || 0),
      deadlines_open: Number(misc[0]?.deadlines_open || 0),
      deadlines_overdue: Number(misc[0]?.deadlines_overdue || 0),
      renewals_upcoming_30d: Number(misc[0]?.renewals_upcoming_30d || 0),
      recurring_active_count: Number(misc[0]?.recurring_active_count || 0),
    };
  }

  private cleanInvoiceBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, [
      'company_id', 'contact_id', 'opportunity_id', 'briefing_id', 'quote_id', 'project_id',
      'invoice_number', 'title', 'type', 'status', 'currency', 'issue_date', 'due_date',
      'paid_at', 'payment_method', 'external_reference', 'pdf_file_id', 'client_notes', 'internal_notes',
    ]);
    if (!partial || 'title' in cleaned) {
      const title = this.textOrNull(cleaned.title);
      if (!title) throw new BadRequestException('title obbligatorio');
      cleaned.title = title;
    }
    if (!partial || 'type' in cleaned) cleaned.type = this.normalizeEnum(cleaned.type, INVOICE_TYPES, 'standard', 'type fattura non valido');
    if (!partial || 'status' in cleaned) cleaned.status = this.normalizeEnum(cleaned.status, INVOICE_STATUSES, 'draft', 'status fattura non valido');
    if (!partial || 'currency' in cleaned) cleaned.currency = String(cleaned.currency || 'EUR').trim() || 'EUR';
    this.validateUuidFields(cleaned, ['company_id', 'contact_id', 'opportunity_id', 'briefing_id', 'quote_id', 'project_id', 'pdf_file_id']);
    return cleaned;
  }

  private cleanInvoiceItemBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, ['quote_item_id', 'name', 'description', 'quantity', 'unit_price', 'discount', 'tax_rate', 'sort_order']);
    if (!partial || 'name' in cleaned) {
      const name = this.textOrNull(cleaned.name);
      if (!name) throw new BadRequestException('name obbligatorio');
      cleaned.name = name;
    }
    this.validateUuidFields(cleaned, ['quote_item_id']);
    for (const numeric of ['quantity', 'unit_price', 'discount', 'tax_rate']) {
      if (!partial || numeric in cleaned) cleaned[numeric] = this.toNumber(cleaned[numeric], numeric, numeric === 'quantity' ? 1 : 0);
    }
    if ('sort_order' in cleaned) cleaned.sort_order = Math.trunc(this.toNumber(cleaned.sort_order, 'sort_order', 0));
    return cleaned;
  }

  private cleanPaymentBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, ['invoice_id', 'company_id', 'project_id', 'amount', 'currency', 'status', 'payment_date', 'method', 'reference', 'notes']);
    if (!partial || 'amount' in cleaned) cleaned.amount = this.toNumber(cleaned.amount, 'amount');
    if (!partial || 'currency' in cleaned) cleaned.currency = String(cleaned.currency || 'EUR').trim() || 'EUR';
    if (!partial || 'status' in cleaned) cleaned.status = this.normalizeEnum(cleaned.status, PAYMENT_STATUSES, 'recorded', 'status pagamento non valido');
    if (cleaned.method) cleaned.method = this.normalizeEnum(cleaned.method, PAYMENT_METHODS, 'other', 'metodo pagamento non valido');
    this.validateUuidFields(cleaned, ['invoice_id', 'company_id', 'project_id']);
    return cleaned;
  }

  private cleanDeadlineBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, ['company_id', 'project_id', 'quote_id', 'invoice_id', 'title', 'type', 'status', 'amount', 'currency', 'due_date', 'completed_at', 'notes']);
    if (!partial || 'title' in cleaned) {
      const title = this.textOrNull(cleaned.title);
      if (!title) throw new BadRequestException('title obbligatorio');
      cleaned.title = title;
    }
    if (!partial || 'due_date' in cleaned) {
      if (!cleaned.due_date) throw new BadRequestException('due_date obbligatorio');
    }
    if (!partial || 'type' in cleaned) cleaned.type = this.normalizeEnum(cleaned.type, DEADLINE_TYPES, 'payment', 'type scadenza non valido');
    if (!partial || 'status' in cleaned) cleaned.status = this.normalizeEnum(cleaned.status, DEADLINE_STATUSES, 'open', 'status scadenza non valido');
    if (!partial || 'currency' in cleaned) cleaned.currency = String(cleaned.currency || 'EUR').trim() || 'EUR';
    if ('amount' in cleaned) cleaned.amount = this.numberOrNull(cleaned.amount, 'amount');
    this.validateUuidFields(cleaned, ['company_id', 'project_id', 'quote_id', 'invoice_id']);
    return cleaned;
  }

  private cleanRecurringBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, [
      'company_id', 'project_id', 'quote_id', 'name', 'category', 'status', 'billing_cycle',
      'amount', 'currency', 'start_date', 'next_due_date', 'end_date', 'auto_renew',
      'internal_notes', 'client_notes',
    ]);
    if (!partial || 'name' in cleaned) {
      const name = this.textOrNull(cleaned.name);
      if (!name) throw new BadRequestException('name obbligatorio');
      cleaned.name = name;
    }
    if (!partial || 'status' in cleaned) cleaned.status = this.normalizeEnum(cleaned.status, RECURRING_STATUSES, 'active', 'status servizio non valido');
    if (!partial || 'billing_cycle' in cleaned) cleaned.billing_cycle = this.normalizeEnum(cleaned.billing_cycle, BILLING_CYCLES, 'yearly', 'billing_cycle non valido');
    if (!partial || 'amount' in cleaned) cleaned.amount = this.toNumber(cleaned.amount, 'amount', 0);
    if (!partial || 'currency' in cleaned) cleaned.currency = String(cleaned.currency || 'EUR').trim() || 'EUR';
    if ('auto_renew' in cleaned) cleaned.auto_renew = Boolean(cleaned.auto_renew);
    this.validateUuidFields(cleaned, ['company_id', 'project_id', 'quote_id']);
    return cleaned;
  }

  private cleanRenewalBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, [
      'recurring_service_id', 'company_id', 'project_id', 'title', 'status', 'amount',
      'currency', 'due_date', 'reminded_at', 'completed_at', 'invoice_id', 'notes',
    ]);
    if (!partial || 'title' in cleaned) {
      const title = this.textOrNull(cleaned.title);
      if (!title) throw new BadRequestException('title obbligatorio');
      cleaned.title = title;
    }
    if (!partial || 'due_date' in cleaned) {
      if (!cleaned.due_date) throw new BadRequestException('due_date obbligatorio');
    }
    if (!partial || 'status' in cleaned) cleaned.status = this.normalizeEnum(cleaned.status, RENEWAL_STATUSES, 'upcoming', 'status rinnovo non valido');
    if ('amount' in cleaned) cleaned.amount = this.numberOrNull(cleaned.amount, 'amount');
    if (!partial || 'currency' in cleaned) cleaned.currency = String(cleaned.currency || 'EUR').trim() || 'EUR';
    this.validateUuidFields(cleaned, ['recurring_service_id', 'company_id', 'project_id', 'invoice_id']);
    return cleaned;
  }

  private cleanProjectFinancialStatusBody(body: Record<string, any>, partial: boolean) {
    const cleaned = this.pick(body, [
      'quote_id', 'company_id', 'deposit_required', 'deposit_paid', 'balance_required', 'balance_paid',
      'total_expected', 'total_paid', 'payment_status', 'deposit_due_date', 'balance_due_date',
      'last_payment_at', 'internal_notes',
    ]);
    for (const field of ['deposit_required', 'deposit_paid', 'balance_required', 'balance_paid', 'total_expected', 'total_paid']) {
      if (!partial || field in cleaned) cleaned[field] = this.toNumber(cleaned[field], field, 0);
    }
    if (!partial || 'payment_status' in cleaned) {
      cleaned.payment_status = this.normalizeEnum(cleaned.payment_status, PROJECT_PAYMENT_STATUSES, 'not_started', 'status pagamento progetto non valido');
    }
    this.validateUuidFields(cleaned, ['quote_id', 'company_id']);
    return cleaned;
  }

  private validateUuidFields(cleaned: Record<string, unknown>, fields: string[]) {
    for (const field of fields) {
      if (cleaned[field] === '') cleaned[field] = null;
      if (cleaned[field] && !UUID_RE.test(String(cleaned[field]))) throw new BadRequestException(`${field} non valido`);
    }
  }

  private normalizeEnum(value: unknown, allowed: string[], fallback: string, message: string): string {
    const text = String(value ?? '').trim();
    if (!text) return fallback;
    if (!allowed.includes(text)) throw new BadRequestException(message);
    return text;
  }

  private async insertInvoiceFromSource(runner: QueryRunner, schema: string, values: Record<string, unknown>) {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined);
    const columns = entries.map(([field]) => field);
    const params = entries.map(([, value]) => value);
    const rows = await runner.query(
      `INSERT INTO "${schema}".invoices (${columns.join(', ')})
       VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING id`,
      params,
    );
    return rows[0].id;
  }

  private async copyQuoteItemsToInvoice(runner: QueryRunner, schema: string, quoteId: string, invoiceId: string) {
    await runner.query(
      `INSERT INTO "${schema}".invoice_items (
         invoice_id, quote_item_id, name, description, quantity, unit_price,
         discount, tax_rate, total, sort_order, created_at, updated_at
       )
       SELECT $1, id, name, description, quantity, unit_price,
              discount, tax_rate, total, sort_order, now(), now()
       FROM "${schema}".quote_items
       WHERE quote_id = $2 AND deleted_at IS NULL
       ORDER BY sort_order ASC, created_at ASC`,
      [invoiceId, quoteId],
    );
  }

  private async recalculateInvoiceTotalsInternal(runner: QueryRunner, schema: string, invoiceId: string) {
    const currentRows = await runner.query(
      `SELECT id, status, due_date, project_id FROM "${schema}".invoices WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [invoiceId],
    );
    const invoice = currentRows[0];
    if (!invoice) throw new NotFoundException('Fattura non trovata');
    const totalsRows = await runner.query(
      `SELECT
         COALESCE(SUM(quantity * unit_price), 0)::numeric AS subtotal,
         COALESCE(SUM(discount), 0)::numeric AS discount_total,
         COALESCE(SUM((GREATEST(quantity * unit_price - discount, 0)) * tax_rate / 100), 0)::numeric AS tax_total,
         COALESCE(SUM(total), 0)::numeric AS total
       FROM "${schema}".invoice_items
       WHERE invoice_id = $1 AND deleted_at IS NULL`,
      [invoiceId],
    );
    const paymentRows = await runner.query(
      `SELECT COALESCE(SUM(amount), 0)::numeric AS paid_total
       FROM "${schema}".payments
       WHERE invoice_id = $1
         AND deleted_at IS NULL
         AND status IN ('recorded', 'confirmed')`,
      [invoiceId],
    );
    const subtotal = Number(totalsRows[0]?.subtotal || 0);
    const discountTotal = Number(totalsRows[0]?.discount_total || 0);
    const taxTotal = Number(totalsRows[0]?.tax_total || 0);
    const total = Number(totalsRows[0]?.total || 0);
    const paidTotal = Number(paymentRows[0]?.paid_total || 0);
    const remainingTotal = Math.max(total - paidTotal, 0);
    let status = String(invoice.status || 'draft');
    let paidAt: string | null = null;
    if (total > 0 && paidTotal >= total) {
      status = 'paid';
      paidAt = new Date().toISOString();
    } else if (paidTotal > 0 && paidTotal < total) {
      status = 'partially_paid';
    } else if (invoice.due_date && new Date(invoice.due_date) < new Date() && ['issued', 'sent', 'overdue'].includes(status)) {
      status = 'overdue';
    } else if (status === 'paid' || status === 'partially_paid') {
      status = 'issued';
    }
    await runner.query(
      `UPDATE "${schema}".invoices
       SET subtotal = $1,
           discount_total = $2,
           tax_total = $3,
           total = $4,
           paid_total = $5,
           remaining_total = $6,
           status = $7,
           paid_at = $8,
           updated_at = now()
       WHERE id = $9 AND deleted_at IS NULL`,
      [subtotal, discountTotal, taxTotal, total, paidTotal, remainingTotal, status, paidAt, invoiceId],
    );
  }

  private async afterPaymentMutation(schema: string, invoiceId: string | null, projectId: string | null, user: AuthUser) {
    if (invoiceId) {
      const runner = this.dataSource.createQueryRunner();
      await runner.connect();
      await runner.startTransaction();
      try {
        await this.recalculateInvoiceTotalsInternal(runner, schema, invoiceId);
        await runner.commitTransaction();
      } catch (err) {
        await runner.rollbackTransaction();
        throw err;
      } finally {
        await runner.release();
      }
      const invoice = await this.ensureInvoiceExists(schema, invoiceId);
      await this.refreshInvoiceDeadlines(schema, invoiceId);
      projectId = projectId || invoice.project_id || null;
    }
    if (projectId) await this.recalculateProjectFinancialStatusInternal(schema, projectId, user);
  }

  private async ensureInvoiceExists(schema: string, invoiceId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".invoices WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [invoiceId],
    );
    if (!rows[0]) throw new NotFoundException('Fattura non trovata');
    return rows[0];
  }

  private async listInvoiceItems(schema: string, invoiceId: string) {
    return this.dataSource.query(
      `SELECT * FROM "${schema}".invoice_items
       WHERE invoice_id = $1 AND deleted_at IS NULL
       ORDER BY sort_order ASC, created_at ASC`,
      [invoiceId],
    );
  }

  private async refreshOverdueDeadlines(schema: string) {
    await this.dataSource.query(
      `UPDATE "${schema}".financial_deadlines
       SET status = 'overdue', updated_at = now()
       WHERE deleted_at IS NULL AND status = 'open' AND due_date < current_date`,
    );
  }

  private async refreshInvoiceDeadlines(schema: string, invoiceId: string) {
    const invoice = await this.ensureInvoiceExists(schema, invoiceId);
    if (Number(invoice.remaining_total || 0) <= 0) {
      await this.dataSource.query(
        `UPDATE "${schema}".financial_deadlines
         SET status = 'completed', completed_at = COALESCE(completed_at, now()), updated_at = now()
         WHERE invoice_id = $1 AND deleted_at IS NULL AND status IN ('open', 'overdue')`,
        [invoiceId],
      );
    } else {
      await this.refreshOverdueDeadlines(schema);
    }
  }

  private async recalculateProjectFinancialStatusInternal(schema: string, projectId: string, user: AuthUser) {
    const projectRows = await this.dataSource.query(
      `SELECT p.*, q.total AS quote_total
       FROM "${schema}".projects p
       LEFT JOIN "${schema}".quotes q ON q.id = p.quote_id
       WHERE p.id = $1 AND p.deleted_at IS NULL
       LIMIT 1`,
      [projectId],
    );
    const project = projectRows[0];
    if (!project) throw new NotFoundException('Progetto non trovato');
    const currentRows = await this.dataSource.query(
      `SELECT * FROM "${schema}".project_financial_status WHERE project_id = $1 AND deleted_at IS NULL LIMIT 1`,
      [projectId],
    );
    const current = currentRows[0] || {};
    const invoiceTotals = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(total), 0)::numeric AS total_expected,
         COALESCE(SUM(paid_total), 0)::numeric AS total_paid
       FROM "${schema}".invoices
       WHERE project_id = $1 AND deleted_at IS NULL AND status NOT IN ('cancelled', 'void')`,
      [projectId],
    );
    const typePaid = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(CASE WHEN i.type = 'deposit' THEN p.amount ELSE 0 END), 0)::numeric AS deposit_paid,
         COALESCE(SUM(CASE WHEN i.type = 'balance' THEN p.amount ELSE 0 END), 0)::numeric AS balance_paid,
         MAX(p.created_at) AS last_payment_at
       FROM "${schema}".payments p
       LEFT JOIN "${schema}".invoices i ON i.id = p.invoice_id
       WHERE COALESCE(p.project_id, i.project_id) = $1
         AND p.deleted_at IS NULL
         AND p.status IN ('recorded', 'confirmed')`,
      [projectId],
    );
    const overdueRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count
       FROM "${schema}".financial_deadlines
       WHERE project_id = $1 AND deleted_at IS NULL AND status IN ('open', 'overdue') AND due_date < current_date`,
      [projectId],
    );
    const quoteExpected = Number(project.quote_total || 0);
    const invoicesExpected = Number(invoiceTotals[0]?.total_expected || 0);
    const totalExpected = quoteExpected > 0 ? quoteExpected : invoicesExpected > 0 ? invoicesExpected : Number(current.total_expected || 0);
    const totalPaid = Number(invoiceTotals[0]?.total_paid || 0);
    const depositRequired = Number(current.deposit_required || 0);
    const balanceRequired = Number(current.balance_required || Math.max(totalExpected - depositRequired, 0));
    const depositPaid = Number(typePaid[0]?.deposit_paid || current.deposit_paid || 0);
    const balancePaid = Number(typePaid[0]?.balance_paid || current.balance_paid || 0);
    const paymentStatus = this.calculateProjectPaymentStatus({
      totalExpected,
      totalPaid,
      depositRequired,
      depositPaid,
      overdueCount: Number(overdueRows[0]?.count || 0),
    });
    await this.upsertProjectFinancialStatus(schema, projectId, {
      quote_id: project.quote_id || current.quote_id || null,
      company_id: project.company_id || current.company_id || null,
      deposit_required: depositRequired,
      deposit_paid: depositPaid,
      balance_required: balanceRequired,
      balance_paid: balancePaid,
      total_expected: totalExpected,
      total_paid: totalPaid,
      payment_status: paymentStatus,
      last_payment_at: typePaid[0]?.last_payment_at || current.last_payment_at || null,
    }, user);
  }

  private calculateProjectPaymentStatus(values: {
    totalExpected: number;
    totalPaid: number;
    depositRequired: number;
    depositPaid: number;
    overdueCount: number;
  }) {
    if (values.overdueCount > 0) return 'overdue';
    if (values.totalExpected > 0 && values.totalPaid >= values.totalExpected) return 'paid';
    if (values.totalPaid > 0) return 'partially_paid';
    if (values.depositRequired > 0 && values.depositPaid >= values.depositRequired) return 'deposit_paid';
    if (values.depositRequired > 0 && values.depositPaid === 0) return 'deposit_due';
    return 'not_started';
  }

  private async upsertProjectFinancialStatus(schema: string, projectId: string, values: Record<string, unknown>, user: AuthUser) {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined);
    const columns = ['project_id', ...entries.map(([field]) => field), 'created_by', 'updated_by'];
    const params = [projectId, ...entries.map(([, value]) => value), this.userIdOrNull(user.id), this.userIdOrNull(user.id)];
    const setParts = entries.map(([field]) => `${field} = EXCLUDED.${field}`);
    setParts.push('updated_by = EXCLUDED.updated_by', 'updated_at = now()');
    await this.dataSource.query(
      `INSERT INTO "${schema}".project_financial_status (${columns.join(', ')})
       VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
       ON CONFLICT (project_id) WHERE deleted_at IS NULL DO UPDATE
         SET ${setParts.join(', ')}`,
      params,
    );
  }

  private async insertRow(schema: string, table: string, values: Record<string, unknown>) {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined);
    const columns = entries.map(([field]) => field);
    const params = entries.map(([, value]) => value);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".${table} (${columns.join(', ')})
       VALUES (${columns.map((_, i) => `$${i + 1}`).join(', ')})
       RETURNING *`,
      params,
    );
    return rows[0];
  }

  private async updateRow(
    schema: string,
    table: string,
    id: string,
    values: Record<string, unknown>,
    updatedBy: string | null,
    extraWhere = '',
    extraParams: unknown[] = [],
    touchUpdatedBy = true,
  ) {
    const entries = Object.entries(values).filter(([, value]) => value !== undefined);
    if (entries.length === 0) return;
    const sets = entries.map(([field], i) => `${field} = $${i + 1}`);
    const params = entries.map(([, value]) => value);
    if (touchUpdatedBy) {
      sets.push(`updated_by = $${params.length + 1}`);
      params.push(updatedBy);
    }
    sets.push('updated_at = now()');
    params.push(id, ...extraParams);
    const idParam = params.length - extraParams.length;
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".${table}
       SET ${sets.join(', ')}
       WHERE id = $${idParam} AND deleted_at IS NULL ${extraWhere ? `AND ${extraWhere}` : ''}
       RETURNING id`,
      params,
    );
    if (!rows[0]) throw new NotFoundException('Risorsa non trovata');
  }

  private async findSimple(table: string, id: string, notFoundMessage: string) {
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".${table} WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException(notFoundMessage);
    return rows[0];
  }

  private async softDeleteSimple(table: string, id: string, notFoundMessage: string, auditAction: string) {
    const user = this.assertFinanceAccess();
    this.requireUuid(id);
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".${table}
       SET deleted_at = now(), updated_by = $1, updated_at = now()
       WHERE id = $2 AND deleted_at IS NULL
       RETURNING id`,
      [this.userIdOrNull(user.id), id],
    );
    if (!rows[0]) throw new NotFoundException(notFoundMessage);
    await this.audit(schema, user, auditAction, id, {});
    return { success: true };
  }

  private pick(body: Record<string, any>, fields: string[]) {
    const cleaned: Record<string, any> = {};
    for (const field of fields) {
      if (!(field in body)) continue;
      cleaned[field] = body[field] === '' ? null : body[field];
    }
    return cleaned;
  }

  private numericObject(row: Record<string, unknown>) {
    const out: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(row)) {
      out[key] = typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : value;
    }
    return out;
  }

  private async audit(schema: string, user: AuthUser, action: string, target: string, metadata: Record<string, unknown>) {
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
