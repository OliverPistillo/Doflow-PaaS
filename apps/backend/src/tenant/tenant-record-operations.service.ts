import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { isDoflowTenant } from './tenant-context';
import { TenantCrmService } from './tenant-crm.service';
import { TenantEffectivePermissionsService } from './tenant-effective-permissions.service';
import { TenantProjectsService } from './tenant-projects.service';
import { ensureDoflowRecordOperationsTables } from './tenant-record-operations-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECORD_KINDS = ['company', 'opportunity', 'project'] as const;
type RecordKind = typeof RECORD_KINDS[number];
type Target = {
  kind: RecordKind;
  id: string;
  company_id: string | null;
  opportunity_id: string | null;
  project_id: string | null;
  quote_id: string | null;
};

function text(value: unknown, max = 4000) {
  return String(value ?? '').trim().slice(0, max);
}

function optionalUuid(value: unknown) {
  const candidate = String(value || '');
  return UUID_RE.test(candidate) ? candidate : null;
}

function amount(value: unknown) {
  const parsed = Number(value || 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

@Injectable()
export class TenantRecordOperationsService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
    private readonly crm: TenantCrmService,
    private readonly projects: TenantProjectsService,
    private readonly permissions: TenantEffectivePermissionsService,
  ) {}

  private user() {
    const user = this.request.user || this.request.authUser;
    if (!user) throw new ForbiddenException('Utente non valido');
    return {
      id: optionalUuid(user.sub || user.id || user.userId),
      email: typeof user.email === 'string' ? user.email : null,
      role: String(user.role || 'user').toLowerCase(),
    };
  }

  private schema() {
    const user = this.request.user || this.request.authUser;
    const schema = safeSchema(user?.tenantId || user?.tenant_id || this.request.tenantId || 'public', 'TenantRecordOperationsService.schema');
    if (!isDoflowTenant(schema)) throw new ForbiddenException('Operazioni record disponibili soltanto per Doflow.');
    return schema;
  }

  private uuid(value: unknown, label: string) {
    const candidate = String(value || '').trim();
    if (!UUID_RE.test(candidate)) throw new BadRequestException(`${label} non valido`);
    return candidate;
  }

  private kind(value: unknown): RecordKind {
    const candidate = String(value || '') as RecordKind;
    if (!(RECORD_KINDS as readonly string[]).includes(candidate)) throw new BadRequestException('record_kind non valido');
    return candidate;
  }

  private date(value: unknown, label: string) {
    if (value === undefined || value === null || value === '') return null;
    const parsed = new Date(String(value));
    if (!Number.isFinite(parsed.getTime())) throw new BadRequestException(`${label} non valido`);
    return parsed.toISOString();
  }

  private async target(kind: RecordKind, id: string, write = false): Promise<Target> {
    const access = await this.permissions.getCurrentAccess();
    const capability = access.modules[kind === 'project' ? 'projects' : 'crm'];
    if (!capability?.can_view || (write && !(capability.can_create || capability.can_update))) {
      throw new ForbiddenException(write ? 'Permesso di modifica record richiesto.' : 'Permesso di lettura record richiesto.');
    }
    if (kind === 'company') {
      await this.crm.findOne('companies', id);
      return { kind, id, company_id: id, opportunity_id: null, project_id: null, quote_id: null };
    }
    if (kind === 'opportunity') {
      const row = await this.crm.findOne('opportunities', id);
      return { kind, id, company_id: optionalUuid(row.company_id), opportunity_id: id, project_id: null, quote_id: null };
    }
    const row = await this.projects.getProject(id);
    return {
      kind,
      id,
      company_id: optionalUuid(row.company_id),
      opportunity_id: optionalUuid(row.opportunity_id),
      project_id: id,
      quote_id: optionalUuid(row.quote_id),
    };
  }

  private async materialAccess(write = false) {
    const access = await this.permissions.getCurrentAccess();
    const documents = access.modules.documents;
    if (!documents?.can_view || (write && !(documents.can_create || documents.can_update))) {
      throw new ForbiddenException(write ? 'Permesso documenti in scrittura richiesto.' : 'Permesso documenti in lettura richiesto.');
    }
    return access;
  }

  private materialWhere(target: Target, alias = 'm') {
    if (target.kind === 'company') return `${alias}.company_id = $1`;
    if (target.kind === 'opportunity') return `${alias}.opportunity_id = $1`;
    return `${alias}.project_id = $1`;
  }

  private async ensureMaterials(schema: string) {
    await ensureDoflowRecordOperationsTables(this.dataSource, schema);
  }

  private async audit(schema: string, action: string, target: Target, metadata: Record<string, unknown>) {
    const user = this.user();
    await this.dataSource.query(
      `INSERT INTO "${schema}".audit_log (actor_email, actor_role, action, target, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
      [user.email, user.role, action, target.id, JSON.stringify(metadata)],
    );
  }

  private materialSelect(schema: string, where: string) {
    return `SELECT m.*, u.email AS requested_by_label,
                   d.title AS received_document_title, d.original_filename AS received_document_filename
            FROM "${schema}".material_requests m
            LEFT JOIN "${schema}".users u ON u.id = m.requested_by
            LEFT JOIN "${schema}".documents d ON d.id = m.received_document_id AND d.deleted_at IS NULL
            WHERE ${where}`;
  }

  async listMaterials(query: Record<string, any>) {
    const schema = this.schema();
    await this.materialAccess(false);
    const kind = this.kind(query.record_kind);
    const id = this.uuid(query.record_id, 'record_id');
    const target = await this.target(kind, id, false);
    await this.ensureMaterials(schema);
    const params: unknown[] = [target.id];
    const where = [this.materialWhere(target), `m.status IN ('requested', 'received', 'waived')`];
    if (query.status && query.status !== 'all') {
      const status = String(query.status);
      if (!['requested', 'received', 'waived'].includes(status)) throw new BadRequestException('status non valido');
      params.push(status);
      where.push(`m.status = $${params.length}`);
    }
    const rows = await this.dataSource.query(
      `${this.materialSelect(schema, where.join(' AND '))}
       ORDER BY CASE m.status WHEN 'requested' THEN 0 ELSE 1 END, m.due_at ASC NULLS LAST, m.created_at DESC`,
      params,
    );
    return { items: rows };
  }

  async createMaterial(body: Record<string, any>) {
    const schema = this.schema();
    await this.materialAccess(true);
    const kind = this.kind(body.record_kind);
    const id = this.uuid(body.record_id, 'record_id');
    const target = await this.target(kind, id, true);
    const title = text(body.title, 300);
    if (!title) throw new BadRequestException('title obbligatorio');
    const dueAt = this.date(body.due_at, 'due_at');
    await this.ensureMaterials(schema);
    const user = this.user();
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".material_requests (
         company_id, opportunity_id, project_id, title, description, status, due_at,
         requested_by, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, 'requested', $6, $7, now(), now())
       RETURNING *`,
      [target.company_id, target.opportunity_id, target.project_id, title, text(body.description, 4000) || null, dueAt, user.id],
    );
    const row = rows[0];
    await this.audit(schema, 'material_requested', target, { material_request_id: row.id, title, status: 'requested', due_at: dueAt });
    return row;
  }

  private async scopedMaterial(schema: string, materialId: string) {
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".material_requests WHERE id = $1 LIMIT 1`,
      [this.uuid(materialId, 'material_id')],
    );
    if (!rows[0]) throw new NotFoundException('Richiesta materiale non trovata');
    const row = rows[0];
    const kind: RecordKind = row.project_id ? 'project' : row.opportunity_id ? 'opportunity' : 'company';
    const id = row.project_id || row.opportunity_id || row.company_id;
    const target = await this.target(kind, this.uuid(id, 'record_id'), true);
    return { row, target };
  }

  private async linkDocument(schema: string, target: Target, documentId: string) {
    const rows = await this.dataSource.query(
      `SELECT id, category, visibility FROM "${schema}".documents
       WHERE id = $1 AND deleted_at IS NULL AND status = 'active' LIMIT 1`,
      [documentId],
    );
    const document = rows[0];
    if (!document) throw new NotFoundException('Documento non trovato');
    if (document.visibility === 'finance' || ['finance', 'invoice', 'receipt'].includes(String(document.category || ''))) {
      throw new ForbiddenException('Un documento finance non può essere usato come materiale operativo.');
    }
    await this.dataSource.query(
      `INSERT INTO "${schema}".document_links (document_id, entity_type, entity_id, relation_type, created_by, created_at)
       VALUES ($1, $2, $3, 'attachment', $4, now())
       ON CONFLICT (document_id, entity_type, entity_id, relation_type) WHERE deleted_at IS NULL
       DO UPDATE SET deleted_at = NULL`,
      [documentId, target.kind, target.id, this.user().id],
    );
    if (target.project_id) {
      await this.dataSource.query(
        `INSERT INTO "${schema}".project_file_links (project_id, file_id, type, visibility, created_by, created_at)
         SELECT $1, $2, 'material', 'internal', $3, now()
         WHERE NOT EXISTS (
           SELECT 1 FROM "${schema}".project_file_links
           WHERE project_id = $1 AND file_id = $2 AND deleted_at IS NULL
         )`,
        [target.project_id, documentId, this.user().id],
      );
    }
  }

  async receiveMaterial(id: string, body: Record<string, any>) {
    const schema = this.schema();
    await this.materialAccess(true);
    await this.ensureMaterials(schema);
    const { row, target } = await this.scopedMaterial(schema, id);
    const documentId = this.uuid(body.document_id, 'document_id');
    if (row.status === 'received' && row.received_document_id === documentId) return row;
    if (row.status !== 'requested') throw new BadRequestException('La richiesta non è più aperta');
    await this.linkDocument(schema, target, documentId);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".material_requests
       SET status = 'received', received_document_id = $2, completed_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'requested'
       RETURNING *`,
      [row.id, documentId],
    );
    if (!rows[0]) throw new BadRequestException('La richiesta è già stata aggiornata');
    await this.audit(schema, 'material_received', target, { material_request_id: row.id, document_id: documentId, title: row.title, status: 'received' });
    return rows[0];
  }

  async waiveMaterial(id: string) {
    const schema = this.schema();
    await this.materialAccess(true);
    await this.ensureMaterials(schema);
    const { row, target } = await this.scopedMaterial(schema, id);
    if (row.status === 'waived') return row;
    if (row.status !== 'requested') throw new BadRequestException('La richiesta non è più aperta');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".material_requests
       SET status = 'waived', completed_at = now(), updated_at = now()
       WHERE id = $1 AND status = 'requested'
       RETURNING *`,
      [row.id],
    );
    if (!rows[0]) throw new BadRequestException('La richiesta è già stata aggiornata');
    await this.audit(schema, 'material_waived', target, { material_request_id: row.id, title: row.title, status: 'waived' });
    return rows[0];
  }

  private recordCondition(schema: string, target: Target, alias: string, domain: 'quote' | 'contract' | 'invoice' | 'payment' | 'deadline' | 'recurring' | 'renewal') {
    if (target.kind === 'company') {
      if (domain === 'payment') return `(${alias}.company_id = $1 OR EXISTS (SELECT 1 FROM "${schema}".invoices i WHERE i.id = ${alias}.invoice_id AND i.company_id = $1 AND i.deleted_at IS NULL))`;
      return `${alias}.company_id = $1`;
    }
    if (target.kind === 'opportunity') {
      if (domain === 'payment') return `EXISTS (SELECT 1 FROM "${schema}".invoices i WHERE i.id = ${alias}.invoice_id AND i.opportunity_id = $2 AND i.deleted_at IS NULL)`;
      if (domain === 'deadline') return `(EXISTS (SELECT 1 FROM "${schema}".invoices i WHERE i.id = ${alias}.invoice_id AND i.opportunity_id = $2 AND i.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM "${schema}".quotes q WHERE q.id = ${alias}.quote_id AND q.opportunity_id = $2 AND q.deleted_at IS NULL))`;
      if (domain === 'recurring') return `(EXISTS (SELECT 1 FROM "${schema}".quotes q WHERE q.id = ${alias}.quote_id AND q.opportunity_id = $2 AND q.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM "${schema}".projects p WHERE p.id = ${alias}.project_id AND p.opportunity_id = $2 AND p.deleted_at IS NULL))`;
      if (domain === 'renewal') return `EXISTS (SELECT 1 FROM "${schema}".recurring_services rs WHERE rs.id = ${alias}.recurring_service_id AND (EXISTS (SELECT 1 FROM "${schema}".quotes q WHERE q.id = rs.quote_id AND q.opportunity_id = $2 AND q.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM "${schema}".projects p WHERE p.id = rs.project_id AND p.opportunity_id = $2 AND p.deleted_at IS NULL)) AND rs.deleted_at IS NULL)`;
      return `${alias}.opportunity_id = $2`;
    }
    if (domain === 'quote') return `(${alias}.id = $4 OR ($4::uuid IS NULL AND ${alias}.opportunity_id = $2))`;
    if (domain === 'payment') return `(${alias}.project_id = $3 OR EXISTS (SELECT 1 FROM "${schema}".invoices i WHERE i.id = ${alias}.invoice_id AND i.project_id = $3 AND i.deleted_at IS NULL))`;
    return `${alias}.project_id = $3`;
  }

  async administration(query: Record<string, any>) {
    const schema = this.schema();
    const kind = this.kind(query.record_kind);
    const id = this.uuid(query.record_id, 'record_id');
    const target = await this.target(kind, id, false);
    const access = await this.permissions.getCurrentAccess();
    if (!access.modules.finance?.can_view) throw new ForbiddenException('Permesso finance richiesto.');
    const params = target.kind === 'company'
      ? [target.company_id]
      : target.kind === 'opportunity'
        ? [target.company_id, target.opportunity_id]
        : [target.company_id, target.opportunity_id, target.project_id, target.quote_id];
    const [quotes, contracts, invoices, payments, deadlines, recurring, renewals, projectStatus] = await Promise.all([
      this.dataSource.query(
        `SELECT q.id, q.quote_number, q.title, q.status, q.total, q.currency, q.created_at, q.updated_at
         FROM "${schema}".quotes q WHERE q.deleted_at IS NULL AND ${this.recordCondition(schema, target, 'q', 'quote')}
         ORDER BY q.created_at DESC`, params),
      this.dataSource.query(
        `SELECT c.id, c.contract_number, c.title, c.status, c.signature_status, c.amount, c.currency,
                c.start_date, c.end_date, c.renewal_date, c.created_at, c.updated_at
         FROM "${schema}".contracts c WHERE c.deleted_at IS NULL AND ${this.recordCondition(schema, target, 'c', 'contract')}
         ORDER BY c.created_at DESC`, params),
      this.dataSource.query(
        `SELECT i.id, i.invoice_number, i.title, i.status, i.currency, i.total, i.paid_total,
                i.remaining_total, i.issue_date, i.due_date, i.paid_at
         FROM "${schema}".invoices i WHERE i.deleted_at IS NULL AND ${this.recordCondition(schema, target, 'i', 'invoice')}
         ORDER BY i.issue_date DESC NULLS LAST, i.created_at DESC`, params),
      this.dataSource.query(
        `SELECT p.id, p.invoice_id, p.amount, p.currency, p.status, p.payment_date, p.method, p.reference, p.notes, p.created_at
         FROM "${schema}".payments p WHERE p.deleted_at IS NULL AND ${this.recordCondition(schema, target, 'p', 'payment')}
         ORDER BY p.payment_date DESC NULLS LAST, p.created_at DESC`, params),
      this.dataSource.query(
        `SELECT d.id, d.invoice_id, d.title, d.type, d.status, d.amount, d.currency, d.due_date, d.completed_at
         FROM "${schema}".financial_deadlines d WHERE d.deleted_at IS NULL AND ${this.recordCondition(schema, target, 'd', 'deadline')}
         ORDER BY d.due_date ASC`, params),
      this.dataSource.query(
        `SELECT r.id, r.name, r.category, r.status, r.billing_cycle, r.amount, r.currency,
                r.start_date, r.next_due_date, r.end_date, r.auto_renew
         FROM "${schema}".recurring_services r WHERE r.deleted_at IS NULL AND ${this.recordCondition(schema, target, 'r', 'recurring')}
         ORDER BY r.next_due_date ASC NULLS LAST`, params),
      this.dataSource.query(
        `SELECT r.id, r.recurring_service_id, r.title, r.status, r.amount, r.currency,
                r.due_date, r.reminded_at, r.completed_at, r.invoice_id
         FROM "${schema}".renewals r WHERE r.deleted_at IS NULL AND ${this.recordCondition(schema, target, 'r', 'renewal')}
         ORDER BY r.due_date ASC`, params),
      target.project_id ? this.dataSource.query(
        `SELECT payment_status, total_expected, total_paid, deposit_due_date, balance_due_date
         FROM "${schema}".project_financial_status WHERE project_id = $1 AND deleted_at IS NULL LIMIT 1`,
        [target.project_id],
      ) : Promise.resolve([]),
    ]);

    const billable = invoices.filter((invoice: any) => !['cancelled', 'void'].includes(String(invoice.status)));
    const totalInvoiced = billable.reduce((sum: number, invoice: any) => sum + amount(invoice.total), 0);
    const totalPaid = billable.reduce((sum: number, invoice: any) => sum + amount(invoice.paid_total), 0);
    const totalRemaining = billable.reduce((sum: number, invoice: any) => sum + amount(invoice.remaining_total), 0);
    const today = new Date().toISOString().slice(0, 10);
    const totalOverdue = billable
      .filter((invoice: any) => invoice.status === 'overdue' || (invoice.due_date && invoice.due_date < today && !['paid'].includes(invoice.status)))
      .reduce((sum: number, invoice: any) => sum + amount(invoice.remaining_total), 0);
    const openDeadlines = deadlines.filter((item: any) => ['open', 'overdue'].includes(String(item.status)));
    const renewalDates = [
      ...contracts.filter((item: any) => item.renewal_date && !['cancelled', 'archived'].includes(String(item.status))).map((item: any) => item.renewal_date),
      ...recurring.filter((item: any) => item.next_due_date && item.status === 'active').map((item: any) => item.next_due_date),
      ...renewals.filter((item: any) => item.due_date && ['upcoming', 'reminded', 'invoiced'].includes(String(item.status))).map((item: any) => item.due_date),
    ].sort();
    const existingProjectStatus = projectStatus[0] || null;
    const totalExpected = amount(existingProjectStatus?.total_expected) || totalInvoiced || amount(quotes[0]?.total);
    const projectPaymentStatus = existingProjectStatus?.payment_status
      || (totalOverdue > 0 ? 'overdue' : totalExpected > 0 && totalPaid >= totalExpected ? 'paid' : totalPaid > 0 ? 'partially_paid' : 'not_started');

    return {
      summary: {
        total_invoiced: totalInvoiced,
        total_paid: totalPaid,
        total_remaining: totalRemaining,
        total_overdue: totalOverdue,
        next_deadline: openDeadlines.map((item: any) => item.due_date).filter(Boolean).sort()[0] || null,
        next_renewal: renewalDates[0] || null,
        total_expected: totalExpected,
        payment_status: projectPaymentStatus,
      },
      quotes: quotes.slice(0, 50),
      contracts: contracts.slice(0, 50),
      invoices: invoices.slice(0, 50),
      payments: payments.slice(0, 50),
      deadlines: deadlines.slice(0, 50),
      recurring_services: recurring.slice(0, 50),
      renewals: renewals.slice(0, 50),
    };
  }
}
