import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { createHash, randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { NotificationsService } from '../realtime/notifications.service';
import { isDoflowTenant } from './tenant-context';
import {
  DOFLOW_ROLE_CAPABILITIES,
  ensureDoflowWorkspaceTables,
} from './tenant-doflow-workspace.service';
import { ensureDoflowDocumentRevenueTables } from './tenant-doflow-document-revenue-schema';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type RevenueUser = { id: string; email: string; role: string; schema: string };
type OperationContext = {
  user: RevenueUser;
  manager: EntityManager;
  operationId: string;
  correlationId: string;
};

const QUOTE_TRANSITIONS: Record<string, string[]> = {
  draft: ['sent'],
  sent: ['viewed', 'accepted', 'rejected'],
  viewed: ['accepted', 'rejected'],
  accepted: [],
  rejected: [],
  expired: [],
  replaced: [],
};
const CONTRACT_STATUSES = [
  'draft',
  'prepared',
  'sent',
  'waiting_signature',
  'signed',
  'rejected',
  'expired',
  'cancelled',
  'archived',
];
const INVOICE_TRANSITIONS: Record<string, string[]> = {
  draft: ['proforma', 'issued', 'cancelled'],
  proforma: ['issued', 'cancelled'],
  issued: ['cancelled'],
  partially_paid: ['cancelled'],
  paid: [],
  overdue: ['cancelled'],
  cancelled: [],
  void: [],
};
const RENEWAL_STATUSES = [
  'active',
  'upcoming',
  'due',
  'reminded',
  'invoiced',
  'paid',
  'expired',
  'suspended',
  'cancelled',
];

@Injectable()
export class TenantDoflowDocumentRevenueService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
    private readonly realtime: NotificationsService,
  ) {}

  private user(): RevenueUser {
    const source = this.request.user || this.request.authUser;
    const schema = String(
      source?.tenantId || source?.tenant_id || this.request.tenantId || '',
    ).toLowerCase();
    const id = String(source?.sub || source?.id || '');
    if (!UUID_RE.test(id) || !isDoflowTenant(schema)) {
      throw new ForbiddenException(
        'Document & Revenue disponibile soltanto nel tenant doflow',
      );
    }
    return {
      id,
      email: String(source.email || ''),
      role: String(source.role || '').toLowerCase(),
      schema,
    };
  }

  private async ensure() {
    const user = this.user();
    await ensureDoflowWorkspaceTables(this.dataSource, user.schema);
    await ensureDoflowDocumentRevenueTables(this.dataSource, user.schema);
    return user.schema;
  }

  private async hasCapability(user: RevenueUser, capability: string) {
    if (['owner', 'admin'].includes(user.role)) return true;
    await ensureDoflowWorkspaceTables(this.dataSource, user.schema);
    const [roles, explicit] = await Promise.all([
      this.dataSource.query(
        `SELECT role FROM "${user.schema}".doflow_user_roles WHERE user_id = $1`,
        [user.id],
      ),
      this.dataSource.query(
        `SELECT 1 FROM "${user.schema}".doflow_user_capabilities
          WHERE user_id = $1 AND capability = $2 LIMIT 1`,
        [user.id, capability],
      ),
    ]);
    return Boolean(
      explicit[0] ||
        roles.some((row: any) =>
          (DOFLOW_ROLE_CAPABILITIES[String(row.role)] || []).includes(capability),
        ),
    );
  }

  private async assertCapability(...capabilities: string[]) {
    const user = this.user();
    for (const capability of capabilities) {
      if (await this.hasCapability(user, capability)) return user;
    }
    throw new ForbiddenException('Capability Document & Revenue insufficiente');
  }

  private async canViewAll(user: RevenueUser) {
    return (
      ['owner', 'admin'].includes(user.role) ||
      (await this.hasCapability(user, 'canViewAllLeads'))
    );
  }

  private async canViewMoney(user: RevenueUser) {
    return (
      (await this.hasCapability(user, 'canViewAdministration')) ||
      (await this.hasCapability(user, 'canViewCommercialValues')) ||
      (await this.hasCapability(user, 'canViewGlobalCommerceValues'))
    );
  }

  private uuid(value: unknown, label: string) {
    const id = String(value || '');
    if (!UUID_RE.test(id)) throw new BadRequestException(`${label} non valido`);
    return id;
  }

  private optionalUuid(value: unknown, label: string) {
    return value ? this.uuid(value, label) : null;
  }

  private text(value: unknown, label: string, required = false) {
    const result = String(value ?? '').trim();
    if (required && !result) {
      throw new BadRequestException(`${label} obbligatorio`);
    }
    return result || null;
  }

  private positive(value: unknown, label: string) {
    const result = Number(value);
    if (!Number.isFinite(result) || result <= 0) {
      throw new BadRequestException(`${label} deve essere maggiore di zero`);
    }
    return result;
  }

  private nonNegative(value: unknown, label: string, fallback = 0) {
    if (value === undefined || value === null || value === '') return fallback;
    const result = Number(value);
    if (!Number.isFinite(result) || result < 0) {
      throw new BadRequestException(`${label} non valido`);
    }
    return result;
  }

  private version(value: unknown) {
    const result = Number(value);
    if (!Number.isInteger(result) || result < 1) {
      throw new BadRequestException('Versione record obbligatoria');
    }
    return result;
  }

  private cents(value: unknown, label: string) {
    return Math.round(this.nonNegative(value, label) * 100);
  }

  private money(cents: number) {
    return Number((cents / 100).toFixed(2));
  }

  private currency(value: unknown, fallback = 'EUR') {
    const result = String(value || fallback).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(result)) {
      throw new BadRequestException('Valuta non valida');
    }
    return result;
  }

  private idempotencyKey(value: unknown) {
    const key = String(value || '').trim();
    if (!/^[A-Za-z0-9_.:@/-]{8,200}$/.test(key)) {
      throw new BadRequestException('Idempotency-Key non valida');
    }
    return key;
  }

  private requestHash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private async withOperation<T>(
    operation: string,
    keyValue: unknown,
    requestValue: unknown,
    work: (context: OperationContext) => Promise<T>,
  ): Promise<T> {
    const user = this.user();
    await this.ensure();
    const key = this.idempotencyKey(keyValue);
    const requestHash = this.requestHash(requestValue);
    const response = await this.dataSource.transaction(async (manager) => {
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `${user.id}:${operation}:${key}`,
      ]);
      const existing = await manager.query(
        `SELECT request_hash, status, response_payload
           FROM "${user.schema}".commerce_idempotency
          WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3
          FOR UPDATE`,
        [user.id, operation, key],
      );
      if (existing[0]) {
        if (String(existing[0].request_hash) !== requestHash) {
          throw new ConflictException(
            'Idempotency-Key già usata con dati differenti',
          );
        }
        if (existing[0].status === 'completed') {
          return existing[0].response_payload as T;
        }
        throw new ConflictException('Operazione identica già in corso');
      }
      const operationId = randomUUID();
      const correlationId = randomUUID();
      await manager.query(
        `INSERT INTO "${user.schema}".commerce_idempotency
          (actor_id, operation, idempotency_key, request_hash, status,
           operation_id, correlation_id)
         VALUES ($1,$2,$3,$4,'processing',$5,$6)`,
        [user.id, operation, key, requestHash, operationId, correlationId],
      );
      const result = await work({ user, manager, operationId, correlationId });
      await manager.query(
        `UPDATE "${user.schema}".commerce_idempotency
            SET status = 'completed', response_payload = $4::jsonb,
                completed_at = now()
          WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3`,
        [user.id, operation, key, JSON.stringify(result)],
      );
      return result;
    });
    try {
      await this.realtime.notifyTenant(user.schema, {
        kind: 'document_revenue_changed',
        operation,
      });
    } catch {
      // Realtime is a non-authoritative projection.
    }
    return response;
  }

  private async event(
    context: OperationContext,
    input: {
      aggregateType: string;
      aggregateId: string;
      eventType: string;
      before?: unknown;
      after?: unknown;
      metadata?: Record<string, unknown>;
      notify?: boolean;
    },
  ) {
    const metadata = input.metadata || {};
    await context.manager.query(
      `INSERT INTO "${context.user.schema}".commerce_history
        (aggregate_type, aggregate_id, event_type, operation_id, correlation_id,
         actor_id, before_state, after_state, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb)`,
      [
        input.aggregateType,
        input.aggregateId,
        input.eventType,
        context.operationId,
        context.correlationId,
        context.user.id,
        input.before == null ? null : JSON.stringify(input.before),
        input.after == null ? null : JSON.stringify(input.after),
        JSON.stringify(metadata),
      ],
    );
    await context.manager.query(
      `INSERT INTO "${context.user.schema}".audit_log
        (actor_email, actor_role, action, target, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,now())`,
      [
        context.user.email || null,
        context.user.role,
        input.eventType,
        input.aggregateId,
        JSON.stringify({
          operation_id: context.operationId,
          correlation_id: context.correlationId,
          ...metadata,
        }),
      ],
    );
    await context.manager.query(
      `INSERT INTO "${context.user.schema}".commerce_outbox
        (aggregate_type, aggregate_id, event_type, operation_id, correlation_id,
         payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        input.aggregateType,
        input.aggregateId,
        input.eventType,
        context.operationId,
        context.correlationId,
        JSON.stringify(metadata),
      ],
    );
    if (input.notify) {
      const route =
        input.aggregateType === 'quote'
          ? '/dashboard/preventivi'
          : input.aggregateType === 'contract'
            ? '/dashboard/contratti'
            : input.aggregateType === 'renewal'
              ? '/dashboard/rinnovi'
              : '/dashboard/fatture';
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".notifications
          (recipient_user_id, title, body, type, priority, entity_type,
           entity_id, link_url, fingerprint, metadata, created_by,
           created_at, updated_at)
         VALUES ($1,$2,$3,'document_revenue','normal',$4,$5,$6,$7,$8::jsonb,
                 $1,now(),now())
         ON CONFLICT DO NOTHING`,
        [
          context.user.id,
          input.eventType.replace(/_/g, ' '),
          String(metadata.message || input.eventType),
          input.aggregateType,
          input.aggregateId,
          route,
          `document-revenue:${context.operationId}:${context.user.id}`,
          JSON.stringify({
            operation_id: context.operationId,
            correlation_id: context.correlationId,
          }),
        ],
      );
    }
  }

  private async artifact(
    context: OperationContext,
    aggregateType: string,
    aggregateId: string,
    versionNumber: number,
    snapshot: unknown,
  ) {
    const serialized = JSON.stringify(snapshot);
    const hash = createHash('sha256').update(serialized).digest('hex');
    const rows = await context.manager.query(
      `INSERT INTO "${context.user.schema}".document_artifacts
        (aggregate_type, aggregate_id, version_number, kind, content_hash,
         snapshot, created_by)
       VALUES ($1,$2,$3,'immutable_snapshot',$4,$5::jsonb,$6)
       ON CONFLICT (aggregate_type, aggregate_id, version_number, kind)
       DO UPDATE SET content_hash = EXCLUDED.content_hash
       RETURNING id, content_hash`,
      [
        aggregateType,
        aggregateId,
        versionNumber,
        hash,
        serialized,
        context.user.id,
      ],
    );
    return { id: String(rows[0].id), hash: String(rows[0].content_hash) };
  }

  private async nextNumber(
    manager: EntityManager,
    schema: string,
    table: 'quotes' | 'invoices',
    column: 'quote_number' | 'invoice_number',
    prefix: string,
  ) {
    await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${schema}:${table}:${prefix}`,
    ]);
    const rows = await manager.query(
      `SELECT COALESCE(MAX((regexp_match(${column}, '([0-9]+)$'))[1]::bigint), 1000) + 1 AS next
         FROM "${schema}".${table}
        WHERE ${column} LIKE $1`,
      [`${prefix}%`],
    );
    return `${prefix}${String(rows[0].next)}`;
  }

  private redactMoney(record: Record<string, any>, fields: string[]) {
    const redacted = { ...record };
    for (const field of fields) delete redacted[field];
    return redacted;
  }

  async state() {
    const user = this.user();
    const schema = await this.ensure();
    const all = await this.canViewAll(user);
    const moneyVisible = await this.canViewMoney(user);
    const [canQuotes, canContracts, canInvoices, canRenewals] = await Promise.all([
      this.hasCapability(user, 'canViewQuotes'),
      this.hasCapability(user, 'canViewContracts'),
      this.hasCapability(user, 'canViewInvoices'),
      this.hasCapability(user, 'canViewRenewals'),
    ]);

    const [quotes, quoteItems, contracts, versions, signers, sends, signatures,
      invoices, invoiceItems, payments, renewals, recurring, histories,
      customerFinance] =
      await Promise.all([
        canQuotes
          ? this.dataSource.query(
              `SELECT * FROM "${schema}".quotes
                WHERE deleted_at IS NULL ${all ? '' : 'AND created_by = $1'}
                ORDER BY created_at DESC`,
              all ? [] : [user.id],
            )
          : [],
        canQuotes
          ? this.dataSource.query(
              `SELECT qi.* FROM "${schema}".quote_items qi
                JOIN "${schema}".quotes q ON q.id = qi.quote_id
               WHERE qi.deleted_at IS NULL AND q.deleted_at IS NULL
                 ${all ? '' : 'AND q.created_by = $1'}
               ORDER BY qi.sort_order, qi.created_at`,
              all ? [] : [user.id],
            )
          : [],
        canContracts
          ? this.dataSource.query(
              `SELECT * FROM "${schema}".contracts
                WHERE deleted_at IS NULL ${all ? '' : 'AND (owner_user_id = $1 OR assigned_to_user_id = $1)'}
                ORDER BY created_at DESC`,
              all ? [] : [user.id],
            )
          : [],
        canContracts
          ? this.dataSource.query(
              `SELECT cv.* FROM "${schema}".contract_versions cv
                JOIN "${schema}".contracts c ON c.id = cv.contract_id
               WHERE cv.deleted_at IS NULL AND c.deleted_at IS NULL
                 ${all ? '' : 'AND (c.owner_user_id = $1 OR c.assigned_to_user_id = $1)'}
               ORDER BY cv.version_number`,
              all ? [] : [user.id],
            )
          : [],
        canContracts
          ? this.dataSource.query(
              `SELECT cs.* FROM "${schema}".contract_signers cs
                JOIN "${schema}".contracts c ON c.id = cs.contract_id
               WHERE cs.deleted_at IS NULL AND c.deleted_at IS NULL
                 ${all ? '' : 'AND (c.owner_user_id = $1 OR c.assigned_to_user_id = $1)'}
               ORDER BY cs.created_at`,
              all ? [] : [user.id],
            )
          : [],
        canContracts
          ? this.dataSource.query(
              `SELECT se.* FROM "${schema}".contract_send_events se
                JOIN "${schema}".contracts c ON c.id = se.contract_id
               WHERE c.deleted_at IS NULL
                 ${all ? '' : 'AND (c.owner_user_id = $1 OR c.assigned_to_user_id = $1)'}
               ORDER BY se.created_at`,
              all ? [] : [user.id],
            )
          : [],
        canContracts
          ? this.dataSource.query(
              `SELECT se.* FROM "${schema}".contract_signature_events se
                JOIN "${schema}".contracts c ON c.id = se.contract_id
               WHERE c.deleted_at IS NULL
                 ${all ? '' : 'AND (c.owner_user_id = $1 OR c.assigned_to_user_id = $1)'}
               ORDER BY se.signed_at`,
              all ? [] : [user.id],
            )
          : [],
        canInvoices
          ? this.dataSource.query(
              `SELECT i.* FROM "${schema}".invoices i
                LEFT JOIN "${schema}".orders o ON o.id = i.order_id
               WHERE i.deleted_at IS NULL
                 ${all ? '' : 'AND o.salesperson_id = $1'}
               ORDER BY i.created_at DESC`,
              all ? [] : [user.id],
            )
          : [],
        canInvoices
          ? this.dataSource.query(
              `SELECT ii.* FROM "${schema}".invoice_items ii
                JOIN "${schema}".invoices i ON i.id = ii.invoice_id
                LEFT JOIN "${schema}".orders o ON o.id = i.order_id
               WHERE ii.deleted_at IS NULL AND i.deleted_at IS NULL
                 ${all ? '' : 'AND o.salesperson_id = $1'}
               ORDER BY ii.sort_order, ii.created_at`,
              all ? [] : [user.id],
            )
          : [],
        canInvoices
          ? this.dataSource.query(
              `SELECT p.* FROM "${schema}".payments p
                JOIN "${schema}".orders o ON o.id = p.order_id
               WHERE p.deleted_at IS NULL ${all ? '' : 'AND o.salesperson_id = $1'}`,
              all ? [] : [user.id],
            )
          : [],
        canRenewals
          ? this.dataSource.query(
              `SELECT * FROM "${schema}".renewals
                WHERE deleted_at IS NULL ${all ? '' : 'AND salesperson_id = $1'}
                ORDER BY due_date, created_at DESC`,
              all ? [] : [user.id],
            )
          : [],
        canRenewals
          ? this.dataSource.query(
              `SELECT * FROM "${schema}".recurring_services
                WHERE deleted_at IS NULL ${all ? '' : 'AND salesperson_id = $1'}`,
              all ? [] : [user.id],
            )
          : [],
        this.dataSource.query(
          `SELECT * FROM "${schema}".commerce_history
            WHERE aggregate_type IN ('quote','contract','invoice','credit_note','renewal')
              ${all ? '' : 'AND actor_id = $1'}
            ORDER BY created_at`,
          all ? [] : [user.id],
        ),
        moneyVisible && canInvoices
          ? this.dataSource.query(
              `WITH invoice_totals AS (
                 SELECT i.company_id,
                        COALESCE(SUM(i.total) FILTER (
                          WHERE i.type <> 'credit_note'
                            AND i.status IN ('issued','partially_paid','paid','overdue')
                        ), 0)::numeric AS gross_invoiced,
                        COALESCE(SUM(i.total) FILTER (
                          WHERE i.type = 'credit_note'
                            AND i.status NOT IN ('cancelled','void')
                        ), 0)::numeric AS credits
                   FROM "${schema}".invoices i
                   LEFT JOIN "${schema}".orders o ON o.id = i.order_id
                  WHERE i.deleted_at IS NULL
                    ${all ? '' : 'AND o.salesperson_id = $1'}
                  GROUP BY i.company_id
               ), payment_totals AS (
                 SELECT o.company_id,
                        COALESCE(SUM(p.amount) FILTER (
                          WHERE p.payment_type = 'payment' AND p.status = 'confirmed'
                        ), 0)::numeric AS gross_paid,
                        COALESCE(SUM(p.amount) FILTER (
                          WHERE p.payment_type = 'refund' AND p.status = 'confirmed'
                        ), 0)::numeric AS refunded
                   FROM "${schema}".payments p
                   JOIN "${schema}".orders o ON o.id = p.order_id
                  WHERE p.deleted_at IS NULL
                    ${all ? '' : 'AND o.salesperson_id = $1'}
                  GROUP BY o.company_id
               )
               SELECT COALESCE(i.company_id, p.company_id) AS company_id,
                      COALESCE(i.gross_invoiced, 0)::numeric AS gross_invoiced,
                      COALESCE(i.credits, 0)::numeric AS credits,
                      GREATEST(COALESCE(i.gross_invoiced, 0) - COALESCE(i.credits, 0), 0)::numeric AS net_invoiced,
                      GREATEST(COALESCE(p.gross_paid, 0) - COALESCE(p.refunded, 0), 0)::numeric AS net_paid
                 FROM invoice_totals i
                 FULL OUTER JOIN payment_totals p ON p.company_id = i.company_id`,
              all ? [] : [user.id],
            )
          : [],
      ]);

    const quoteResult = quotes.map((quote: any) => ({
      ...quote,
      items: quoteItems.filter((item: any) => item.quote_id === quote.id),
    }));
    const contractResult = contracts.map((contract: any) => ({
      ...contract,
      versions: versions.filter((item: any) => item.contract_id === contract.id),
      signers: signers.filter((item: any) => item.contract_id === contract.id),
      send_events: sends.filter((item: any) => item.contract_id === contract.id),
      signature_events: signatures.filter(
        (item: any) => item.contract_id === contract.id,
      ),
    }));
    const invoiceResult = invoices.map((invoice: any) => {
      const invoicePayments = payments.filter(
        (payment: any) => payment.order_id && payment.order_id === invoice.order_id,
      );
      const gross = invoicePayments
        .filter(
          (payment: any) =>
            payment.payment_type === 'payment' && payment.status === 'confirmed',
        )
        .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
      const refunds = invoicePayments
        .filter(
          (payment: any) =>
            payment.payment_type === 'refund' && payment.status === 'confirmed',
        )
        .reduce((sum: number, payment: any) => sum + Number(payment.amount || 0), 0);
      const net = Math.max(gross - refunds, 0);
      const paid = invoice.type === 'credit_note'
        ? 0
        : Math.min(Number(invoice.total || 0), net);
      const remaining = Math.max(Number(invoice.total || 0) - paid, 0);
      const credited = invoices
        .filter(
          (candidate: any) =>
            candidate.parent_invoice_id === invoice.id &&
            candidate.type === 'credit_note' &&
            !['cancelled', 'void'].includes(candidate.status),
        )
        .reduce((sum: number, item: any) => sum + Number(item.total || 0), 0);
      let status = String(invoice.status);
      if (
        invoice.type !== 'credit_note' &&
        !['draft', 'proforma', 'cancelled', 'void'].includes(status)
      ) {
        status = remaining === 0
          ? 'paid'
          : paid > 0
            ? 'partially_paid'
            : invoice.due_date && new Date(invoice.due_date) < new Date()
              ? 'overdue'
              : 'issued';
      }
      return {
        ...invoice,
        status,
        paid_total: paid,
        remaining_total: remaining,
        creditable_remaining: Math.max(Number(invoice.total || 0) - credited, 0),
        items: invoiceItems.filter((item: any) => item.invoice_id === invoice.id),
        payment_ids: invoicePayments
          .filter((item: any) => item.payment_type === 'payment')
          .map((item: any) => item.id),
        refund_ids: invoicePayments
          .filter((item: any) => item.payment_type === 'refund')
          .map((item: any) => item.id),
      };
    });
    const renewalResult = renewals.map((renewal: any) => ({
      ...renewal,
      recurring_service: recurring.find(
        (item: any) => item.id === renewal.recurring_service_id,
      ),
      history: histories.filter(
        (item: any) =>
          item.aggregate_type === 'renewal' && item.aggregate_id === renewal.id,
      ),
    }));

    if (!moneyVisible) {
      return {
        quotes: quoteResult.map((quote: any) => ({
          ...this.redactMoney(quote, [
            'currency', 'subtotal', 'discount_total', 'tax_total', 'total',
            'document_discount', 'tax_rate',
          ]),
          items: quote.items.map((item: any) =>
            this.redactMoney(item, [
              'unit_price', 'discount', 'tax_rate', 'total', 'line_subtotal',
              'tax_amount', 'currency_snapshot',
            ]),
          ),
        })),
        contracts: contractResult.map((contract: any) => ({
          ...this.redactMoney(contract, ['amount', 'currency']),
          versions: contract.versions.map((version: any) =>
            this.redactMoney(version, ['amount', 'currency', 'snapshot']),
          ),
        })),
        invoices: invoiceResult.map((invoice: any) => ({
          ...this.redactMoney(invoice, [
            'currency', 'subtotal', 'discount_total', 'tax_total', 'total',
            'paid_total', 'remaining_total', 'creditable_remaining',
          ]),
          items: invoice.items.map((item: any) =>
            this.redactMoney(item, [
              'unit_price', 'discount', 'tax_rate', 'total', 'line_subtotal',
              'tax_amount', 'currency_snapshot',
            ]),
          ),
          payment_ids: [],
          refund_ids: [],
        })),
        renewals: renewalResult.map((renewal: any) => ({
          ...this.redactMoney(renewal, ['amount', 'currency']),
          recurring_service: renewal.recurring_service
            ? this.redactMoney(renewal.recurring_service, [
                'amount', 'price', 'currency', 'price_snapshot',
              ])
            : null,
          history: renewal.history.map((entry: any) => ({
            id: entry.id,
            aggregate_type: entry.aggregate_type,
            aggregate_id: entry.aggregate_id,
            event_type: entry.event_type,
            actor_id: entry.actor_id,
            created_at: entry.created_at,
          })),
        })),
        customer_finance: [],
        redacted: true,
      };
    }
    return {
      quotes: quoteResult,
      contracts: contractResult,
      invoices: invoiceResult,
      renewals: renewalResult,
      customer_finance: customerFinance,
      redacted: false,
    };
  }

  private async quoteItems(
    manager: EntityManager,
    schema: string,
    inputs: Record<string, any>[],
    allowDiscount: boolean,
  ) {
    if (!inputs.length) throw new BadRequestException('Righe preventivo obbligatorie');
    const snapshots: Record<string, any>[] = [];
    let subtotalCents = 0;
    let taxCents = 0;
    let documentCurrency = '';
    for (const [index, input] of inputs.entries()) {
      const serviceId = this.uuid(input.serviceId, `items[${index}].serviceId`);
      const services = await manager.query(
        `SELECT * FROM "${schema}".services
          WHERE id = $1 AND status = 'active' AND deleted_at IS NULL FOR SHARE`,
        [serviceId],
      );
      const service = services[0];
      if (!service) throw new BadRequestException('Servizio preventivo non disponibile');
      const quantity = this.positive(input.quantity, 'quantity');
      const discountCents = this.cents(input.discount || 0, 'discount');
      if (discountCents > 0 && !allowDiscount) {
        throw new ForbiddenException('Sconto preventivo non autorizzato');
      }
      const currency = this.currency(service.currency);
      if (documentCurrency && documentCurrency !== currency) {
        throw new BadRequestException('Le righe devono avere la stessa valuta');
      }
      documentCurrency = currency;
      const grossCents = Math.round(this.cents(service.price, 'price') * quantity);
      if (discountCents > grossCents) {
        throw new BadRequestException('Sconto riga superiore al valore della riga');
      }
      const taxableCents = grossCents - discountCents;
      const lineTaxCents = Math.round(
        (taxableCents * this.nonNegative(service.tax_rate, 'tax_rate')) / 100,
      );
      const totalCents = taxableCents + lineTaxCents;
      subtotalCents += taxableCents;
      taxCents += lineTaxCents;
      snapshots.push({
        serviceId,
        name: String(service.name),
        description: String(service.description || ''),
        quantity,
        unitPrice: this.money(this.cents(service.price, 'price')),
        discount: this.money(discountCents),
        taxRate: Number(service.tax_rate || 0),
        lineSubtotal: this.money(taxableCents),
        taxAmount: this.money(lineTaxCents),
        total: this.money(totalCents),
        currency,
        catalogVersion: Number(service.version || 1),
        billingType: String(service.billing_type || 'one_time'),
        sortOrder: index,
      });
    }
    return {
      snapshots,
      subtotal: this.money(subtotalCents),
      taxTotal: this.money(taxCents),
      total: this.money(subtotalCents + taxCents),
      currency: documentCurrency || 'EUR',
    };
  }

  private async insertQuoteItems(
    context: OperationContext,
    quoteId: string,
    items: Record<string, any>[],
  ) {
    for (const item of items) {
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".quote_items
          (quote_id, service_id, name, description, quantity, unit_price,
           discount, tax_rate, total, billing_type, sort_order,
           service_name_snapshot, service_description_snapshot,
           currency_snapshot, catalog_version_snapshot, line_subtotal,
           tax_amount, immutable_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$3,$4,$12,$13,$14,$15,now())`,
        [
          quoteId,
          item.serviceId,
          item.name,
          item.description,
          item.quantity,
          item.unitPrice,
          item.discount,
          item.taxRate,
          item.total,
          item.billingType,
          item.sortOrder,
          item.currency,
          item.catalogVersion,
          item.lineSubtotal,
          item.taxAmount,
        ],
      );
    }
  }

  async createQuote(body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnQuotes');
    const allowDiscount = await this.hasCapability(user, 'canManageCommerceRules');
    return this.withOperation('quote.create', keyValue, body, async (context) => {
      const companyId = this.optionalUuid(body.customerId, 'customerId');
      const leadId = this.optionalUuid(body.leadId, 'leadId');
      if (!companyId && !leadId) {
        throw new BadRequestException('Cliente o lead obbligatorio');
      }
      if (companyId) {
        const company = await context.manager.query(
          `SELECT 1 FROM "${context.user.schema}".companies
            WHERE id = $1 AND deleted_at IS NULL FOR SHARE`,
          [companyId],
        );
        if (!company[0]) throw new NotFoundException('Cliente non trovato');
      }
      let opportunityId = this.optionalUuid(body.opportunityId, 'opportunityId');
      if (leadId) {
        const lead = await context.manager.query(
          `SELECT id, company_id FROM "${context.user.schema}".opportunities
            WHERE id = $1 AND deleted_at IS NULL FOR SHARE`,
          [leadId],
        );
        if (!lead[0]) throw new NotFoundException('Lead non trovato');
        if (companyId && lead[0].company_id && lead[0].company_id !== companyId) {
          throw new BadRequestException('Lead e cliente non coerenti');
        }
        opportunityId ||= leadId;
      }
      const calculated = await this.quoteItems(
        context.manager,
        context.user.schema,
        Array.isArray(body.lines) ? body.lines : [],
        allowDiscount,
      );
      const quoteNumber = await this.nextNumber(
        context.manager,
        context.user.schema,
        'quotes',
        'quote_number',
        'PREV-',
      );
      const id = randomUUID();
      const validUntil = this.text(body.validUntil, 'validUntil', true);
      const rows = await context.manager.query(
        `INSERT INTO "${context.user.schema}".quotes
          (id, company_id, lead_id, opportunity_id, quote_number, title, status,
           currency, subtotal, discount_total, tax_total, total, valid_until,
           client_notes, internal_notes, terms, version, document_discount,
           tax_rate, optimistic_version, authority_managed, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,'draft',$7,$8,0,$9,$10,$11,NULL,$12,$13,
                 1,0,0,1,true,$14,$14)
         RETURNING *`,
        [
          id,
          companyId,
          leadId,
          opportunityId,
          quoteNumber,
          this.text(body.title, 'title') || `Preventivo ${quoteNumber}`,
          calculated.currency,
          calculated.subtotal,
          calculated.taxTotal,
          calculated.total,
          validUntil,
          this.text(body.notes, 'notes'),
          this.text(body.conditions, 'conditions'),
          context.user.id,
        ],
      );
      await this.insertQuoteItems(context, id, calculated.snapshots);
      const artifact = await this.artifact(context, 'quote', id, 1, {
        quote: rows[0],
        items: calculated.snapshots,
      });
      await context.manager.query(
        `UPDATE "${context.user.schema}".quotes SET artifact_id = $2 WHERE id = $1`,
        [id, artifact.id],
      );
      await this.event(context, {
        aggregateType: 'quote',
        aggregateId: id,
        eventType: 'document_quote_created',
        after: { ...rows[0], artifact_id: artifact.id },
        metadata: { quote_number: quoteNumber, message: `Preventivo ${quoteNumber} creato` },
        notify: true,
      });
      return { id, quoteNumber, version: 1 };
    });
  }

  async updateQuote(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnQuotes');
    const id = this.uuid(idValue, 'quoteId');
    if (body.status) return this.transitionQuote(id, body.status, body, keyValue);
    return this.withOperation('quote.update', keyValue, { id, ...body }, async (context) => {
      const rows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".quotes
          WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      );
      const current = rows[0];
      if (!current) throw new NotFoundException('Preventivo non trovato');
      if (!(await this.canViewAll(user)) && current.created_by !== user.id) {
        throw new ForbiddenException('Preventivo non autorizzato');
      }
      if (current.status !== 'draft') {
        throw new BadRequestException('Solo una bozza è modificabile');
      }
      const version = this.version(body.version ?? current.optimistic_version);
      if (Number(current.optimistic_version) !== version) {
        throw new ConflictException('Conflitto di versione preventivo');
      }
      const updated = await context.manager.query(
        `UPDATE "${context.user.schema}".quotes SET
           title = COALESCE($2,title), valid_until = COALESCE($3,valid_until),
           terms = CASE WHEN $4::boolean THEN $5 ELSE terms END,
           internal_notes = CASE WHEN $6::boolean THEN $7 ELSE internal_notes END,
           optimistic_version = optimistic_version + 1, updated_by = $8,
           updated_at = now()
         WHERE id = $1 AND optimistic_version = $9 RETURNING *`,
        [
          id,
          this.text(body.title, 'title'),
          this.text(body.validUntil, 'validUntil'),
          body.conditions !== undefined,
          this.text(body.conditions, 'conditions'),
          body.notes !== undefined,
          this.text(body.notes, 'notes'),
          context.user.id,
          version,
        ],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione preventivo');
      await this.event(context, {
        aggregateType: 'quote', aggregateId: id,
        eventType: 'document_quote_updated', before: current, after: updated[0],
      });
      return { id, version: Number(updated[0].optimistic_version) };
    });
  }

  private async acceptQuote(context: OperationContext, quote: any) {
    if (quote.order_id) return { saleId: quote.sale_id, orderId: quote.order_id };
    if (!quote.company_id) {
      throw new BadRequestException(
        'Il preventivo deve essere collegato a un cliente prima dell’accettazione',
      );
    }
    const items = await context.manager.query(
      `SELECT * FROM "${context.user.schema}".quote_items
        WHERE quote_id = $1 AND deleted_at IS NULL ORDER BY sort_order FOR SHARE`,
      [quote.id],
    );
    if (!items.length || !items[0].service_id) {
      throw new BadRequestException('Righe preventivo non convertibili in ordine');
    }
    const saleId = randomUUID();
    await context.manager.query(
      `INSERT INTO "${context.user.schema}".sales
        (id, company_id, lead_id, opportunity_id, service_id, salesperson_id,
         origin, value, currency, sale_date, status, deal_id, notes,
         created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,'Commerciale',$7,$8,current_date,'Vinta',$9,$10,$6,$6)`,
      [
        saleId,
        quote.company_id,
        quote.lead_id,
        quote.opportunity_id,
        items[0].service_id,
        context.user.id,
        Number(quote.total),
        quote.currency,
        `quote:${quote.id}`,
        `Vendita generata dal preventivo ${quote.quote_number}`,
      ],
    );
    for (const item of items) {
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".sale_items
          (sale_id, service_id, quantity) VALUES ($1,$2,$3)`,
        [saleId, item.service_id, item.quantity],
      );
    }
    await context.manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
      `${context.user.schema}:order-number`,
    ]);
    const numberRows = await context.manager.query(
      `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '')::int), 1000) + 1 AS next
         FROM "${context.user.schema}".orders`,
    );
    const orderId = randomUUID();
    const orderCode = `DF-${numberRows[0].next}`;
    await context.manager.query(
      `INSERT INTO "${context.user.schema}".orders
        (id, code, company_id, sale_id, lead_id, opportunity_id, deal_id,
         salesperson_id, currency, discount, subtotal, tax_total, total,
         deposit, balance, gross_collected, refunded_total, net_collected,
         residual, payment_status, installments, administrative_status,
         order_date, notes, confirmed_at, created_by, updated_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,0,$10,$11,$12,0,$12,0,0,0,$12,
               'not_started',1,'Confermato',current_date,$13,now(),$8,$8)`,
      [
        orderId,
        orderCode,
        quote.company_id,
        saleId,
        quote.lead_id,
        quote.opportunity_id,
        `quote:${quote.id}`,
        context.user.id,
        quote.currency,
        quote.subtotal,
        quote.tax_total,
        quote.total,
        `Ordine generato dal preventivo ${quote.quote_number} v${quote.version}`,
      ],
    );
    for (const item of items) {
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".order_items
          (order_id, service_id, service_name_snapshot,
           service_description_snapshot, service_category_snapshot,
           quantity, unit_price_snapshot, discount, tax_rate_snapshot,
           tax_amount, currency_snapshot, catalog_version_snapshot,
           line_subtotal, line_total, immutable_at)
         VALUES ($1,$2,$3,$4,'',$5,$6,$7,$8,$9,$10,$11,$12,$13,now())`,
        [
          orderId,
          item.service_id,
          item.service_name_snapshot || item.name,
          item.service_description_snapshot || item.description || '',
          item.quantity,
          item.unit_price,
          item.discount,
          item.tax_rate,
          item.tax_amount,
          item.currency_snapshot || quote.currency,
          item.catalog_version_snapshot || 1,
          item.line_subtotal,
          item.total,
        ],
      );
    }
    await context.manager.query(
      `UPDATE "${context.user.schema}".sales SET order_id = $2 WHERE id = $1`,
      [saleId, orderId],
    );
    await context.manager.query(
      `UPDATE "${context.user.schema}".quotes
          SET sale_id = $2, order_id = $3 WHERE id = $1`,
      [quote.id, saleId, orderId],
    );
    return { saleId, orderId, orderCode };
  }

  async transitionQuote(
    idValue: string,
    statusValue: unknown,
    body: Record<string, any>,
    keyValue: unknown,
  ) {
    const user = await this.assertCapability('canManageOwnQuotes');
    const id = this.uuid(idValue, 'quoteId');
    const aliases: Record<string, string> = {
      Bozza: 'draft',
      Inviato: 'sent',
      Visualizzato: 'viewed',
      Accettato: 'accepted',
      Rifiutato: 'rejected',
      Scaduto: 'expired',
      Sostituito: 'replaced',
    };
    const next = aliases[String(statusValue)] || String(statusValue).toLowerCase();
    return this.withOperation(
      `quote.transition.${next}`,
      keyValue,
      { id, status: next },
      async (context) => {
        const rows = await context.manager.query(
          `SELECT * FROM "${context.user.schema}".quotes
            WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [id],
        );
        const current = rows[0];
        if (!current) throw new NotFoundException('Preventivo non trovato');
        if (!(await this.canViewAll(user)) && current.created_by !== user.id) {
          throw new ForbiddenException('Preventivo non autorizzato');
        }
        if (current.status === next) {
          return { id, status: next, saleId: current.sale_id, orderId: current.order_id };
        }
        if (next === 'expired') {
          if (!current.valid_until || new Date(current.valid_until) >= new Date()) {
            throw new BadRequestException('Preventivo non ancora scaduto');
          }
        } else if (!(QUOTE_TRANSITIONS[current.status] || []).includes(next)) {
          throw new BadRequestException(
            `Transizione preventivo ${current.status} → ${next} non valida`,
          );
        }
        if (
          next === 'accepted' &&
          (current.replaced_by_id || current.status === 'replaced' ||
            (current.valid_until && new Date(current.valid_until) < new Date()))
        ) {
          throw new BadRequestException('Versione sostituita o scaduta non accettabile');
        }
        const links = next === 'accepted'
          ? await this.acceptQuote(context, current)
          : { saleId: current.sale_id, orderId: current.order_id };
        const updated = await context.manager.query(
          `UPDATE "${context.user.schema}".quotes SET
             status = $2,
             sent_at = CASE WHEN $2 = 'sent' THEN COALESCE(sent_at,now()) ELSE sent_at END,
             viewed_at = CASE WHEN $2 = 'viewed' THEN COALESCE(viewed_at,now()) ELSE viewed_at END,
             accepted_at = CASE WHEN $2 = 'accepted' THEN COALESCE(accepted_at,now()) ELSE accepted_at END,
             rejected_at = CASE WHEN $2 = 'rejected' THEN COALESCE(rejected_at,now()) ELSE rejected_at END,
             optimistic_version = optimistic_version + 1,
             updated_by = $3, updated_at = now()
           WHERE id = $1 RETURNING *`,
          [id, next, context.user.id],
        );
        await this.event(context, {
          aggregateType: 'quote', aggregateId: id,
          eventType: `document_quote_${next}`,
          before: current, after: updated[0],
          metadata: { ...links, message: `Preventivo ${current.quote_number}: ${next}` },
          notify: ['sent', 'accepted', 'rejected'].includes(next),
        });
        return { id, status: next, ...links };
      },
    );
  }

  async createQuoteVersion(idValue: string, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnQuotes');
    const id = this.uuid(idValue, 'quoteId');
    return this.withOperation('quote.version', keyValue, { id }, async (context) => {
      const rows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".quotes
          WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      );
      const current = rows[0];
      if (!current) throw new NotFoundException('Preventivo non trovato');
      if (!(await this.canViewAll(user)) && current.created_by !== user.id) {
        throw new ForbiddenException('Preventivo non autorizzato');
      }
      if (current.replaced_by_id) {
        return { id: current.replaced_by_id, existing: true };
      }
      const rootId = current.parent_quote_id || current.id;
      await context.manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `${context.user.schema}:quote-version:${rootId}`,
      ]);
      const existingAfterLock = await context.manager.query(
        `SELECT replaced_by_id FROM "${context.user.schema}".quotes WHERE id = $1`,
        [id],
      );
      if (existingAfterLock[0]?.replaced_by_id) {
        return { id: existingAfterLock[0].replaced_by_id, existing: true };
      }
      const versionRows = await context.manager.query(
        `SELECT COALESCE(MAX(version),0) + 1 AS next FROM "${context.user.schema}".quotes
          WHERE (id = $1 OR parent_quote_id = $1) AND deleted_at IS NULL`,
        [rootId],
      );
      const nextVersion = Number(versionRows[0].next);
      const nextId = randomUUID();
      const inserted = await context.manager.query(
        `INSERT INTO "${context.user.schema}".quotes
          (id, company_id, lead_id, opportunity_id, briefing_id, quote_number,
           title, status, currency, subtotal, discount_total, tax_total, total,
           valid_until, client_notes, internal_notes, terms, version,
           parent_quote_id, document_discount, tax_rate, optimistic_version,
           authority_managed, created_by, updated_by)
         SELECT $2, company_id, lead_id, opportunity_id, briefing_id, quote_number,
           title, 'draft', currency, subtotal, discount_total, tax_total, total,
           valid_until, client_notes, internal_notes, terms, $3, $4,
           document_discount, tax_rate, 1, authority_managed, $5, $5
         FROM "${context.user.schema}".quotes WHERE id = $1
         RETURNING *`,
        [id, nextId, nextVersion, rootId, context.user.id],
      );
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".quote_items
          (quote_id, service_template_id, service_id, name, description, quantity,
           unit_price, discount, tax_rate, total, billing_type, sort_order,
           service_name_snapshot, service_description_snapshot,
           currency_snapshot, catalog_version_snapshot, line_subtotal,
           tax_amount, immutable_at)
         SELECT $2, service_template_id, service_id, name, description, quantity,
           unit_price, discount, tax_rate, total, billing_type, sort_order,
           service_name_snapshot, service_description_snapshot,
           currency_snapshot, catalog_version_snapshot, line_subtotal,
           tax_amount, now()
         FROM "${context.user.schema}".quote_items
         WHERE quote_id = $1 AND deleted_at IS NULL`,
        [id, nextId],
      );
      await context.manager.query(
        `UPDATE "${context.user.schema}".quotes SET status = 'replaced',
           replaced_by_id = $2, optimistic_version = optimistic_version + 1,
           updated_by = $3, updated_at = now() WHERE id = $1`,
        [id, nextId, context.user.id],
      );
      const items = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".quote_items
          WHERE quote_id = $1 AND deleted_at IS NULL ORDER BY sort_order`,
        [nextId],
      );
      const artifact = await this.artifact(context, 'quote', nextId, nextVersion, {
        quote: inserted[0], items,
      });
      await context.manager.query(
        `UPDATE "${context.user.schema}".quotes SET artifact_id = $2 WHERE id = $1`,
        [nextId, artifact.id],
      );
      await this.event(context, {
        aggregateType: 'quote', aggregateId: nextId,
        eventType: 'document_quote_version_created',
        before: { id, version: current.version },
        after: { id: nextId, version: nextVersion },
        metadata: { previous_quote_id: id, message: `Versione ${nextVersion} creata` },
        notify: true,
      });
      return { id: nextId, version: nextVersion, existing: false };
    });
  }

  async archiveQuote(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnQuotes');
    const id = this.uuid(idValue, 'quoteId');
    return this.withOperation('quote.archive', keyValue, { id, ...body }, async (context) => {
      const currentRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".quotes WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      );
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Preventivo non trovato');
      if (!(await this.canViewAll(user)) && current.created_by !== user.id) {
        throw new ForbiddenException('Preventivo non autorizzato');
      }
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".quotes SET deleted_at = now(),
           archived_at = now(), optimistic_version = optimistic_version + 1,
           updated_by = $2, updated_at = now()
         WHERE id = $1 AND optimistic_version = $3 RETURNING *`,
        [id, context.user.id, this.version(body.version)],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione preventivo');
      await this.event(context, {
        aggregateType: 'quote', aggregateId: id,
        eventType: 'document_quote_archived', before: current, after: rows[0],
      });
      return { id, version: Number(rows[0].optimistic_version) };
    });
  }

  async generateContract(body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnContracts');
    const orderId = this.uuid(body.orderId, 'orderId');
    return this.withOperation('contract.generate', keyValue, { orderId }, async (context) => {
      const orderRows = await context.manager.query(
        `SELECT o.*, c.name AS company_name FROM "${context.user.schema}".orders o
          JOIN "${context.user.schema}".companies c ON c.id = o.company_id
         WHERE o.id = $1 AND o.deleted_at IS NULL FOR UPDATE OF o`,
        [orderId],
      );
      const order = orderRows[0];
      if (!order) throw new NotFoundException('Ordine non trovato');
      if (!(await this.canViewAll(user)) && order.salesperson_id !== user.id) {
        throw new ForbiddenException('Ordine non autorizzato');
      }
      const existing = await context.manager.query(
        `SELECT id FROM "${context.user.schema}".contracts
          WHERE order_id = $1 AND authority_managed AND deleted_at IS NULL
            AND replaced_by_id IS NULL LIMIT 1 FOR UPDATE`,
        [orderId],
      );
      if (existing[0]) return { id: existing[0].id, existing: true };
      const items = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".order_items
          WHERE order_id = $1 AND archived_at IS NULL ORDER BY created_at FOR SHARE`,
        [orderId],
      );
      const id = randomUUID();
      const versionId = randomUUID();
      const contractNumber = `CT-${String(order.code).replace(/^DF-/, '')}`;
      const title = this.text(body.title, 'title') ||
        `Contratto ${order.code} · ${order.company_name}`;
      const snapshot = {
        order: {
          id: order.id,
          code: order.code,
          companyId: order.company_id,
          quoteId: body.quoteId || null,
          projectId: order.project_id,
          currency: order.currency,
          total: Number(order.total),
        },
        items: items.map((item: any) => ({
          id: item.id,
          serviceId: item.service_id,
          name: item.service_name_snapshot,
          description: item.service_description_snapshot,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unit_price_snapshot),
          discount: Number(item.discount),
          taxRate: Number(item.tax_rate_snapshot),
          total: Number(item.line_total),
          currency: item.currency_snapshot,
        })),
      };
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".contracts
          (id, contract_number, title, company_id, quote_id, project_id,
           order_id, owner_user_id, assigned_to_user_id, status,
           signature_status, contract_type, amount, currency, due_date,
           internal_notes, metadata, current_version_id, optimistic_version,
           authority_managed, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$8,'prepared','not_started','commercial',
                 $9,$10,$11,$12,$13::jsonb,$14,1,true,$8,$8)`,
        [
          id,
          contractNumber,
          title,
          order.company_id,
          this.optionalUuid(body.quoteId, 'quoteId'),
          order.project_id,
          orderId,
          context.user.id,
          order.total,
          order.currency,
          this.text(body.signatureDueAt, 'signatureDueAt'),
          this.text(body.notes, 'notes'),
          JSON.stringify({
            order_id: orderId,
            sale_id: order.sale_id,
            service_ids: Array.from(new Set(items.map((item: any) => item.service_id))),
            visibility: 'internal',
            signatory_name: this.text(body.signatoryName, 'signatoryName'),
          }),
          versionId,
        ],
      );
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".contract_versions
          (id, contract_id, version_number, title, body_markdown, variables,
           status, change_note, snapshot, created_by)
         VALUES ($1,$2,1,$3,'',$4::jsonb,'prepared','Versione iniziale',$5::jsonb,$6)`,
        [versionId, id, title, JSON.stringify({}), JSON.stringify(snapshot), context.user.id],
      );
      const artifact = await this.artifact(context, 'contract', id, 1, snapshot);
      await context.manager.query(
        `UPDATE "${context.user.schema}".contracts SET artifact_id = $2 WHERE id = $1`,
        [id, artifact.id],
      );
      await context.manager.query(
        `UPDATE "${context.user.schema}".contract_versions
            SET artifact_id = $2, artifact_hash = $3 WHERE id = $1`,
        [versionId, artifact.id, artifact.hash],
      );
      const signatoryName = this.text(body.signatoryName, 'signatoryName');
      if (signatoryName) {
        await context.manager.query(
          `INSERT INTO "${context.user.schema}".contract_signers
            (contract_id, contract_version_id, signer_type, name, status, metadata)
           VALUES ($1,$2,'client',$3,'pending',$4::jsonb)`,
          [id, versionId, signatoryName, JSON.stringify({ internal_only: true })],
        );
      }
      await this.event(context, {
        aggregateType: 'contract', aggregateId: id,
        eventType: 'document_contract_prepared', after: { id, versionId, orderId },
        metadata: { order_id: orderId, message: `Contratto ${contractNumber}-V1 preparato` },
        notify: true,
      });
      return { id, versionId, existing: false };
    });
  }

  private async lockedContract(
    context: OperationContext,
    user: RevenueUser,
    id: string,
  ) {
    const rows = await context.manager.query(
      `SELECT * FROM "${context.user.schema}".contracts
        WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    const contract = rows[0];
    if (!contract) throw new NotFoundException('Contratto non trovato');
    if (
      !(await this.canViewAll(user)) &&
      contract.owner_user_id !== user.id &&
      contract.assigned_to_user_id !== user.id
    ) {
      throw new ForbiddenException('Contratto non autorizzato');
    }
    return contract;
  }

  async updateContract(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnContracts');
    const id = this.uuid(idValue, 'contractId');
    return this.withOperation('contract.update', keyValue, { id, ...body }, async (context) => {
      const current = await this.lockedContract(context, user, id);
      if (['signed', 'archived', 'cancelled'].includes(current.status)) {
        throw new BadRequestException('Contratto non modificabile nello stato corrente');
      }
      const version = this.version(body.version ?? current.optimistic_version);
      if (Number(current.optimistic_version) !== version) {
        throw new ConflictException('Conflitto di versione contratto');
      }
      const metadata = {
        ...(current.metadata || {}),
        ...(body.signatoryName !== undefined
          ? { signatory_name: this.text(body.signatoryName, 'signatoryName') }
          : {}),
        ...(body.documentName !== undefined
          ? { document_name: this.text(body.documentName, 'documentName') }
          : {}),
        ...(body.documentReference !== undefined
          ? { document_reference: this.text(body.documentReference, 'documentReference') }
          : {}),
        ...(body.visibility !== undefined
          ? { visibility: ['internal', 'client'].includes(String(body.visibility)) ? body.visibility : 'internal' }
          : {}),
      };
      const updated = await context.manager.query(
        `UPDATE "${context.user.schema}".contracts SET
           title = COALESCE($2,title), due_date = $3,
           internal_notes = $4, metadata = $5::jsonb,
           optimistic_version = optimistic_version + 1,
           updated_by = $6, updated_at = now()
         WHERE id = $1 AND optimistic_version = $7 RETURNING *`,
        [
          id,
          this.text(body.title, 'title'),
          body.signatureDueAt === undefined ? current.due_date : this.text(body.signatureDueAt, 'signatureDueAt'),
          body.notes === undefined ? current.internal_notes : this.text(body.notes, 'notes'),
          JSON.stringify(metadata),
          context.user.id,
          version,
        ],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione contratto');
      if (body.signatoryName) {
        const signer = await context.manager.query(
          `SELECT id FROM "${context.user.schema}".contract_signers
            WHERE contract_id = $1 AND contract_version_id = $2
              AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
          [id, current.current_version_id],
        );
        if (signer[0]) {
          await context.manager.query(
            `UPDATE "${context.user.schema}".contract_signers
                SET name = $2, updated_at = now() WHERE id = $1`,
            [signer[0].id, this.text(body.signatoryName, 'signatoryName', true)],
          );
        } else {
          await context.manager.query(
            `INSERT INTO "${context.user.schema}".contract_signers
              (contract_id, contract_version_id, signer_type, name, status, metadata)
             VALUES ($1,$2,'client',$3,'pending',$4::jsonb)`,
            [id, current.current_version_id, this.text(body.signatoryName, 'signatoryName', true), JSON.stringify({ internal_only: true })],
          );
        }
      }
      await this.event(context, {
        aggregateType: 'contract', aggregateId: id,
        eventType: 'document_contract_updated', before: current, after: updated[0],
      });
      return { id, version: Number(updated[0].optimistic_version) };
    });
  }

  async sendContract(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnContracts');
    const id = this.uuid(idValue, 'contractId');
    return this.withOperation('contract.send', keyValue, { id, ...body }, async (context) => {
      const current = await this.lockedContract(context, user, id);
      if (['signed', 'archived', 'cancelled'].includes(current.status) || current.replaced_by_id) {
        throw new BadRequestException('Contratto non inviabile nello stato corrente');
      }
      const method = String(body.method || 'Email');
      if (!['Email', 'WhatsApp', 'Consegna manuale', 'Altro'].includes(method)) {
        throw new BadRequestException('Metodo invio non valido');
      }
      const kind = String(body.kind || 'invio');
      if (!['invio', 'reinvio', 'promemoria'].includes(kind)) {
        throw new BadRequestException('Tipo invio non valido');
      }
      const rows = await context.manager.query(
        `INSERT INTO "${context.user.schema}".contract_send_events
          (contract_id, contract_version_id, method, event_kind, note,
           provider_status, operation_id, correlation_id, actor_id)
         VALUES ($1,$2,$3,$4,$5,'not_configured',$6,$7,$8) RETURNING *`,
        [
          id,
          current.current_version_id,
          method,
          kind,
          this.text(body.note, 'note'),
          context.operationId,
          context.correlationId,
          context.user.id,
        ],
      );
      await context.manager.query(
        `UPDATE "${context.user.schema}".contracts SET
           status = 'waiting_signature', sent_at = COALESCE(sent_at,now()),
           optimistic_version = optimistic_version + 1, updated_by = $2,
           updated_at = now(), metadata = COALESCE(metadata,'{}'::jsonb) ||
             '{"visibility":"client"}'::jsonb
         WHERE id = $1`,
        [id, context.user.id],
      );
      await this.event(context, {
        aggregateType: 'contract', aggregateId: id,
        eventType: kind === 'promemoria' ? 'document_contract_reminder_recorded' : 'document_contract_send_recorded',
        before: current,
        after: rows[0],
        metadata: {
          method,
          provider_status: 'not_configured',
          message: 'Tentativo registrato; nessun invio esterno eseguito',
        },
        notify: true,
      });
      return { attemptId: rows[0].id, providerStatus: 'not_configured' };
    });
  }

  async signContract(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnContracts');
    const id = this.uuid(idValue, 'contractId');
    return this.withOperation('contract.sign.internal', keyValue, { id, ...body }, async (context) => {
      const current = await this.lockedContract(context, user, id);
      if (current.replaced_by_id || ['archived', 'cancelled'].includes(current.status)) {
        throw new BadRequestException('Versione contratto sostituita o non firmabile');
      }
      const versionRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".contract_versions
          WHERE id = $1 AND contract_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [current.current_version_id, id],
      );
      const version = versionRows[0];
      if (!version || version.replaced_by_version_id || version.status === 'replaced') {
        throw new BadRequestException('Versione contratto sostituita');
      }
      let signerId = body.signerId ? this.uuid(body.signerId, 'signerId') : null;
      let signer: any;
      if (signerId) {
        const rows = await context.manager.query(
          `SELECT * FROM "${context.user.schema}".contract_signers
            WHERE id = $1 AND contract_id = $2 AND contract_version_id = $3
              AND deleted_at IS NULL FOR UPDATE`,
          [signerId, id, version.id],
        );
        signer = rows[0];
      } else {
        const rows = await context.manager.query(
          `SELECT * FROM "${context.user.schema}".contract_signers
            WHERE contract_id = $1 AND contract_version_id = $2
              AND deleted_at IS NULL ORDER BY created_at LIMIT 1 FOR UPDATE`,
          [id, version.id],
        );
        signer = rows[0];
        if (!signer) {
          const name = this.text(
            body.signatoryName || current.metadata?.signatory_name,
            'signatoryName',
            true,
          );
          const inserted = await context.manager.query(
            `INSERT INTO "${context.user.schema}".contract_signers
              (contract_id, contract_version_id, signer_type, name, status, metadata)
             VALUES ($1,$2,'client',$3,'pending',$4::jsonb) RETURNING *`,
            [id, version.id, name, JSON.stringify({ internal_only: true })],
          );
          signer = inserted[0];
        }
        signerId = signer.id;
      }
      if (!signer) throw new NotFoundException('Firmatario non trovato');
      const existing = await context.manager.query(
        `SELECT id FROM "${context.user.schema}".contract_signature_events
          WHERE contract_version_id = $1 AND signer_id = $2 LIMIT 1`,
        [version.id, signerId],
      );
      if (existing[0]) return { eventId: existing[0].id, existing: true };
      const method = String(body.method || 'internal_record');
      if (method !== 'internal_record') {
        throw new BadRequestException('Provider firma esterno non configurato');
      }
      const events = await context.manager.query(
        `INSERT INTO "${context.user.schema}".contract_signature_events
          (contract_id, contract_version_id, signer_id, signer_type, method,
           external_reference, artifact_hash, operation_id, correlation_id,
           actor_id, signed_at)
         VALUES ($1,$2,$3,$4,'internal_record',$5,$6,$7,$8,$9,now()) RETURNING *`,
        [
          id,
          version.id,
          signerId,
          signer.signer_type,
          this.text(body.externalReference, 'externalReference'),
          version.artifact_hash,
          context.operationId,
          context.correlationId,
          context.user.id,
        ],
      );
      await context.manager.query(
        `UPDATE "${context.user.schema}".contract_signers
            SET status = 'signed', signed_at = now(), updated_at = now()
          WHERE id = $1`,
        [signerId],
      );
      await context.manager.query(
        `UPDATE "${context.user.schema}".contract_versions
            SET status = 'signed' WHERE id = $1`,
        [version.id],
      );
      await context.manager.query(
        `UPDATE "${context.user.schema}".contracts
            SET status = 'signed', signature_status = 'signed', signed_at = now(),
                optimistic_version = optimistic_version + 1, updated_by = $2,
                updated_at = now(), metadata = COALESCE(metadata,'{}'::jsonb) ||
                  '{"visibility":"client","signature_claim":"firma registrata internamente"}'::jsonb
          WHERE id = $1`,
        [id, context.user.id],
      );
      await this.event(context, {
        aggregateType: 'contract', aggregateId: id,
        eventType: 'document_contract_signature_recorded_internal',
        before: current,
        after: events[0],
        metadata: {
          contract_version_id: version.id,
          signer_id: signerId,
          method: 'internal_record',
          message: 'Firma registrata internamente',
        },
        notify: true,
      });
      return { eventId: events[0].id, existing: false };
    });
  }

  async createContractVersion(idValue: string, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnContracts');
    const id = this.uuid(idValue, 'contractId');
    return this.withOperation('contract.version', keyValue, { id }, async (context) => {
      const current = await this.lockedContract(context, user, id);
      if (current.replaced_by_id || current.status === 'archived') {
        throw new BadRequestException('Contratto sostituito o archiviato');
      }
      await context.manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `${context.user.schema}:contract-version:${id}`,
      ]);
      const previousRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".contract_versions
          WHERE id = $1 AND contract_id = $2 AND deleted_at IS NULL FOR UPDATE`,
        [current.current_version_id, id],
      );
      const previous = previousRows[0];
      if (!previous) throw new NotFoundException('Versione contratto non trovata');
      if (previous.replaced_by_version_id) {
        return { id, versionId: previous.replaced_by_version_id, existing: true };
      }
      const nextVersion = Number(previous.version_number) + 1;
      const versionId = randomUUID();
      const snapshot = {
        ...(previous.snapshot || {}),
        version: nextVersion,
        previousVersionId: previous.id,
      };
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".contract_versions
          (id, contract_id, version_number, title, body_markdown, variables,
           status, change_note, previous_version_id, snapshot, created_by)
         VALUES ($1,$2,$3,$4,$5,$6::jsonb,'prepared',$7,$8,$9::jsonb,$10)`,
        [
          versionId,
          id,
          nextVersion,
          current.title,
          previous.body_markdown,
          JSON.stringify(previous.variables || {}),
          `Versione ${nextVersion}`,
          previous.id,
          JSON.stringify(snapshot),
          context.user.id,
        ],
      );
      await context.manager.query(
        `UPDATE "${context.user.schema}".contract_versions
            SET status = 'replaced', replaced_by_version_id = $2,
                replaced_at = now() WHERE id = $1`,
        [previous.id, versionId],
      );
      await context.manager.query(
        `UPDATE "${context.user.schema}".contracts
            SET current_version_id = $2, status = 'prepared',
                signature_status = 'not_started', sent_at = NULL,
                signed_at = NULL, optimistic_version = optimistic_version + 1,
                updated_by = $3, updated_at = now()
          WHERE id = $1`,
        [id, versionId, context.user.id],
      );
      const previousSigners = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".contract_signers
          WHERE contract_id = $1 AND contract_version_id = $2 AND deleted_at IS NULL`,
        [id, previous.id],
      );
      for (const signer of previousSigners) {
        await context.manager.query(
          `INSERT INTO "${context.user.schema}".contract_signers
            (contract_id, contract_version_id, signer_type, name, email,
             role_title, status, notes, metadata)
           VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,$8::jsonb)`,
          [id, versionId, signer.signer_type, signer.name, signer.email,
            signer.role_title, signer.notes, JSON.stringify(signer.metadata || {})],
        );
      }
      const artifact = await this.artifact(context, 'contract', id, nextVersion, snapshot);
      await context.manager.query(
        `UPDATE "${context.user.schema}".contract_versions
            SET artifact_id = $2, artifact_hash = $3 WHERE id = $1`,
        [versionId, artifact.id, artifact.hash],
      );
      await context.manager.query(
        `UPDATE "${context.user.schema}".contracts SET artifact_id = $2 WHERE id = $1`,
        [id, artifact.id],
      );
      await this.event(context, {
        aggregateType: 'contract', aggregateId: id,
        eventType: 'document_contract_version_created',
        before: { versionId: previous.id, version: previous.version_number },
        after: { versionId, version: nextVersion },
        metadata: { message: `Versione contratto ${nextVersion} preparata` },
        notify: true,
      });
      return { id, versionId, version: nextVersion, existing: false };
    });
  }

  async archiveContract(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnContracts');
    const id = this.uuid(idValue, 'contractId');
    return this.withOperation('contract.archive', keyValue, { id, ...body }, async (context) => {
      const current = await this.lockedContract(context, user, id);
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".contracts SET status = 'archived',
           archived_at = now(), optimistic_version = optimistic_version + 1,
           updated_by = $2, updated_at = now()
         WHERE id = $1 AND optimistic_version = $3 RETURNING *`,
        [id, context.user.id, this.version(body.version ?? current.optimistic_version)],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione contratto');
      await this.event(context, {
        aggregateType: 'contract', aggregateId: id,
        eventType: 'document_contract_archived', before: current, after: rows[0],
      });
      return { id, version: Number(rows[0].optimistic_version) };
    });
  }

  async createInvoiceFromOrder(body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageInvoices');
    const orderId = this.uuid(body.orderId, 'orderId');
    return this.withOperation('invoice.from_order', keyValue, { orderId, ...body }, async (context) => {
      const orderRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".orders
          WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [orderId],
      );
      const order = orderRows[0];
      if (!order) throw new NotFoundException('Ordine non trovato');
      if (!(await this.canViewAll(user)) && order.salesperson_id !== user.id) {
        throw new ForbiddenException('Ordine non autorizzato');
      }
      if (order.administrative_status === 'Annullato') {
        throw new BadRequestException('Ordine annullato non fatturabile');
      }
      const existing = await context.manager.query(
        `SELECT id FROM "${context.user.schema}".invoices
          WHERE order_id = $1 AND type <> 'credit_note' AND authority_managed
            AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
        [orderId],
      );
      if (existing[0]) return { id: existing[0].id, existing: true };
      const items = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".order_items
          WHERE order_id = $1 AND archived_at IS NULL ORDER BY created_at FOR SHARE`,
        [orderId],
      );
      if (!items.length) throw new BadRequestException('Ordine senza righe');
      const invoiceNumber = await this.nextNumber(
        context.manager,
        context.user.schema,
        'invoices',
        'invoice_number',
        'FAT-LOCAL-',
      );
      const id = randomUUID();
      const issueDate = new Date().toISOString().slice(0, 10);
      const dueDate = this.text(body.dueAt || body.dueDate, 'dueAt', true);
      const rows = await context.manager.query(
        `INSERT INTO "${context.user.schema}".invoices
          (id, company_id, project_id, order_id, invoice_number, title, type,
           status, currency, subtotal, discount_total, tax_total, total,
           paid_total, remaining_total, issue_date, due_date, internal_notes,
           optimistic_version, authority_managed, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,'standard','draft',$7,$8,$9,$10,$11,0,$11,
                 $12,$13,$14,1,true,$15,$15) RETURNING *`,
        [
          id,
          order.company_id,
          order.project_id,
          orderId,
          invoiceNumber,
          `Fattura locale ${order.code}`,
          order.currency,
          order.subtotal,
          order.discount,
          order.tax_total,
          order.total,
          issueDate,
          dueDate,
          this.text(body.notes, 'notes'),
          context.user.id,
        ],
      );
      for (const [index, item] of items.entries()) {
        await context.manager.query(
          `INSERT INTO "${context.user.schema}".invoice_items
            (invoice_id, order_item_id, service_id, name, description, quantity,
             unit_price, discount, tax_rate, total, sort_order,
             service_name_snapshot, service_description_snapshot,
             currency_snapshot, catalog_version_snapshot, line_subtotal,
             tax_amount, immutable_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$4,$5,$12,$13,$14,$15,now())`,
          [
            id,
            item.id,
            item.service_id,
            item.service_name_snapshot,
            item.service_description_snapshot,
            item.quantity,
            item.unit_price_snapshot,
            item.discount,
            item.tax_rate_snapshot,
            item.line_total,
            index,
            item.currency_snapshot,
            item.catalog_version_snapshot,
            item.line_subtotal,
            item.tax_amount,
          ],
        );
      }
      const artifact = await this.artifact(context, 'invoice', id, 1, {
        invoice: rows[0], items,
        disclaimer: 'Documento amministrativo locale non trasmesso allo SDI',
      });
      await context.manager.query(
        `UPDATE "${context.user.schema}".invoices SET artifact_id = $2 WHERE id = $1`,
        [id, artifact.id],
      );
      await this.event(context, {
        aggregateType: 'invoice', aggregateId: id,
        eventType: 'document_local_invoice_created', after: { id, orderId, invoiceNumber },
        metadata: {
          order_id: orderId,
          fiscal_provider: 'disabled',
          message: `Fattura locale ${invoiceNumber} creata; nessun invio SDI`,
        },
        notify: true,
      });
      return { id, invoiceNumber, existing: false };
    });
  }

  async transitionInvoice(
    idValue: string,
    statusValue: unknown,
    body: Record<string, any>,
    keyValue: unknown,
  ) {
    const user = await this.assertCapability('canManageInvoices');
    const id = this.uuid(idValue, 'invoiceId');
    const aliases: Record<string, string> = {
      Bozza: 'draft',
      Proforma: 'proforma',
      'Emessa esternamente': 'issued',
      'Parzialmente pagata': 'partially_paid',
      Pagata: 'paid',
      Scaduta: 'overdue',
      Annullata: 'cancelled',
      Stornata: 'void',
    };
    const next = aliases[String(statusValue)] || String(statusValue).toLowerCase();
    return this.withOperation(`invoice.transition.${next}`, keyValue, { id, next }, async (context) => {
      const rows = await context.manager.query(
        `SELECT i.*, o.salesperson_id FROM "${context.user.schema}".invoices i
          LEFT JOIN "${context.user.schema}".orders o ON o.id = i.order_id
         WHERE i.id = $1 AND i.deleted_at IS NULL FOR UPDATE OF i`,
        [id],
      );
      const current = rows[0];
      if (!current) throw new NotFoundException('Fattura locale non trovata');
      if (!(await this.canViewAll(user)) && current.salesperson_id !== user.id) {
        throw new ForbiddenException('Fattura non autorizzata');
      }
      if (['paid', 'partially_paid', 'overdue', 'void'].includes(next)) {
        throw new BadRequestException('Lo stato economico è derivato lato server');
      }
      if (current.status === next) return { id, status: next };
      if (!(INVOICE_TRANSITIONS[current.status] || []).includes(next)) {
        throw new BadRequestException(`Transizione fattura ${current.status} → ${next} non valida`);
      }
      const updated = await context.manager.query(
        `UPDATE "${context.user.schema}".invoices SET status = $2,
           issue_date = CASE WHEN $2 = 'issued' THEN COALESCE(issue_date,current_date) ELSE issue_date END,
           optimistic_version = optimistic_version + 1, updated_by = $3,
           updated_at = now() WHERE id = $1 RETURNING *`,
        [id, next, context.user.id],
      );
      await this.event(context, {
        aggregateType: current.type === 'credit_note' ? 'credit_note' : 'invoice',
        aggregateId: id, eventType: `document_local_invoice_${next}`,
        before: current, after: updated[0],
        metadata: { fiscal_provider: 'disabled' },
      });
      return { id, status: next };
    });
  }

  async createCreditNote(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageInvoices');
    const invoiceId = this.uuid(idValue, 'invoiceId');
    return this.withOperation('credit_note.create', keyValue, { invoiceId, ...body }, async (context) => {
      const rows = await context.manager.query(
        `SELECT i.*, o.salesperson_id FROM "${context.user.schema}".invoices i
          LEFT JOIN "${context.user.schema}".orders o ON o.id = i.order_id
         WHERE i.id = $1 AND i.type <> 'credit_note' AND i.deleted_at IS NULL
         FOR UPDATE OF i`,
        [invoiceId],
      );
      const invoice = rows[0];
      if (!invoice) throw new NotFoundException('Fattura originaria non trovata');
      if (!(await this.canViewAll(user)) && invoice.salesperson_id !== user.id) {
        throw new ForbiddenException('Fattura non autorizzata');
      }
      if (!['issued', 'partially_paid', 'paid', 'overdue'].includes(invoice.status)) {
        throw new BadRequestException('Nota non consentita sulla fattura nello stato corrente');
      }
      const requestedCents = this.cents(this.positive(body.amount, 'amount'), 'amount');
      const credits = await context.manager.query(
        `SELECT COALESCE(SUM(total),0)::numeric AS total
           FROM "${context.user.schema}".invoices
          WHERE parent_invoice_id = $1 AND type = 'credit_note'
            AND status NOT IN ('cancelled','void') AND deleted_at IS NULL`,
        [invoiceId],
      );
      const residualCents = Math.max(
        this.cents(invoice.total, 'invoice.total') - this.cents(credits[0].total, 'credits'),
        0,
      );
      if (requestedCents > residualCents) {
        throw new BadRequestException('Nota superiore al residuo stornabile');
      }
      const reason = this.text(body.notes || body.reason, 'reason', true);
      const ratio = requestedCents / this.cents(invoice.total, 'invoice.total');
      const taxCents = Math.min(
        requestedCents,
        Math.round(this.cents(invoice.tax_total, 'invoice.tax_total') * ratio),
      );
      const subtotalCents = requestedCents - taxCents;
      const number = await this.nextNumber(
        context.manager,
        context.user.schema,
        'invoices',
        'invoice_number',
        'NC-LOCAL-',
      );
      const id = randomUUID();
      const inserted = await context.manager.query(
        `INSERT INTO "${context.user.schema}".invoices
          (id, company_id, project_id, order_id, parent_invoice_id,
           invoice_number, title, type, status, currency, subtotal,
           discount_total, tax_total, total, paid_total, remaining_total,
           issue_date, due_date, credit_reason, internal_notes,
           optimistic_version, authority_managed, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'credit_note','issued',$8,$9,0,$10,$11,
                 0,0,current_date,current_date,$12,$12,1,true,$13,$13)
         RETURNING *`,
        [
          id,
          invoice.company_id,
          invoice.project_id,
          invoice.order_id,
          invoiceId,
          number,
          `Nota di credito locale ${invoice.invoice_number}`,
          invoice.currency,
          this.money(subtotalCents),
          this.money(taxCents),
          this.money(requestedCents),
          reason,
          context.user.id,
        ],
      );
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".invoice_items
          (invoice_id, name, description, quantity, unit_price, discount,
           tax_rate, total, sort_order, service_name_snapshot,
           service_description_snapshot, currency_snapshot,
           catalog_version_snapshot, line_subtotal, tax_amount, immutable_at)
         VALUES ($1,$2,$3,1,$4,0,$5,$6,0,$2,$3,$7,1,$4,$8,now())`,
        [
          id,
          `Storno ${invoice.invoice_number}`,
          reason,
          this.money(subtotalCents),
          subtotalCents > 0 ? Number(((taxCents / subtotalCents) * 100).toFixed(4)) : 0,
          this.money(requestedCents),
          invoice.currency,
          this.money(taxCents),
        ],
      );
      const artifact = await this.artifact(context, 'credit_note', id, 1, {
        creditNote: inserted[0],
        parentInvoiceId: invoiceId,
        reason,
        disclaimer: 'Documento amministrativo locale non trasmesso allo SDI',
      });
      await context.manager.query(
        `UPDATE "${context.user.schema}".invoices SET artifact_id = $2 WHERE id = $1`,
        [id, artifact.id],
      );
      await this.event(context, {
        aggregateType: 'credit_note', aggregateId: id,
        eventType: 'document_local_credit_note_created', after: inserted[0],
        metadata: {
          parent_invoice_id: invoiceId,
          residual_creditable: this.money(residualCents - requestedCents),
          fiscal_provider: 'disabled',
          message: `Nota locale ${number} creata`,
        },
        notify: true,
      });
      return { id, invoiceNumber: number, residual: this.money(residualCents - requestedCents) };
    });
  }

  async archiveInvoice(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageInvoices');
    const id = this.uuid(idValue, 'invoiceId');
    return this.withOperation('invoice.archive', keyValue, { id, ...body }, async (context) => {
      const rows = await context.manager.query(
        `SELECT i.*, o.salesperson_id FROM "${context.user.schema}".invoices i
          LEFT JOIN "${context.user.schema}".orders o ON o.id = i.order_id
         WHERE i.id = $1 AND i.deleted_at IS NULL FOR UPDATE OF i`,
        [id],
      );
      const current = rows[0];
      if (!current) throw new NotFoundException('Documento locale non trovato');
      if (!(await this.canViewAll(user)) && current.salesperson_id !== user.id) {
        throw new ForbiddenException('Documento non autorizzato');
      }
      const updated = await context.manager.query(
        `UPDATE "${context.user.schema}".invoices SET archived_at = now(),
           deleted_at = now(), optimistic_version = optimistic_version + 1,
           updated_by = $2, updated_at = now()
         WHERE id = $1 AND optimistic_version = $3 RETURNING *`,
        [id, context.user.id, this.version(body.version ?? current.optimistic_version)],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione documento');
      await this.event(context, {
        aggregateType: current.type === 'credit_note' ? 'credit_note' : 'invoice',
        aggregateId: id, eventType: 'document_local_invoice_archived',
        before: current, after: updated[0],
      });
      return { id, version: Number(updated[0].optimistic_version) };
    });
  }

  async activateRenewal(body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnRenewals');
    const orderId = this.uuid(body.orderId, 'orderId');
    const itemId = this.uuid(body.itemId, 'itemId');
    return this.withOperation('renewal.activate', keyValue, { orderId, itemId }, async (context) => {
      const rows = await context.manager.query(
        `SELECT o.*, oi.*, o.id AS source_order_id, oi.id AS source_item_id
           FROM "${context.user.schema}".orders o
           JOIN "${context.user.schema}".order_items oi ON oi.order_id = o.id
          WHERE o.id = $1 AND oi.id = $2 AND oi.archived_at IS NULL AND o.deleted_at IS NULL
          FOR UPDATE OF o`,
        [orderId, itemId],
      );
      const item = rows[0];
      if (!item) throw new NotFoundException('Riga ordine non trovata');
      if (!(await this.canViewAll(user)) && item.salesperson_id !== user.id) {
        throw new ForbiddenException('Rinnovo non autorizzato');
      }
      if (!item.plan_id || !item.recurrence || Number(item.renewal_price_snapshot || 0) <= 0) {
        throw new BadRequestException('Riga priva di piano ricorrente');
      }
      const existing = await context.manager.query(
        `SELECT id FROM "${context.user.schema}".renewals
          WHERE source_order_item_id = $1 AND authority_managed
            AND deleted_at IS NULL LIMIT 1 FOR UPDATE`,
        [itemId],
      );
      if (existing[0]) return { id: existing[0].id, existing: true };
      const sourceOrderDate = new Date(item.order_date);
      if (Number.isNaN(sourceOrderDate.getTime())) {
        throw new BadRequestException('Data ordine sorgente non valida');
      }
      const start = new Date(
        Date.UTC(
          sourceOrderDate.getUTCFullYear(),
          sourceOrderDate.getUTCMonth(),
          sourceOrderDate.getUTCDate(),
          12,
        ),
      );
      if (item.recurrence === 'monthly') start.setUTCMonth(start.getUTCMonth() + 1);
      else start.setUTCFullYear(start.getUTCFullYear() + 1);
      const due = String(item.next_due_at || start.toISOString().slice(0, 10)).slice(0, 10);
      const contract = await context.manager.query(
        `SELECT id FROM "${context.user.schema}".contracts
          WHERE order_id = $1 AND status = 'signed' AND deleted_at IS NULL
            AND replaced_by_id IS NULL LIMIT 1`,
        [orderId],
      );
      const recurringId = randomUUID();
      const renewalId = randomUUID();
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".recurring_services
          (id, company_id, project_id, name, category, status, billing_cycle,
           amount, currency, start_date, next_due_date, auto_renew,
           source_order_id, source_order_item_id, source_contract_id,
           service_id, plan_id, plan_name_snapshot, included_snapshot,
           renewal_required, activated_at, management_mode, owner_user_id,
           salesperson_id, optimistic_version, authority_managed,
           created_by, updated_by)
         VALUES ($1,$2,$3,$4,'commercial','active',$5,$6,$7,current_date,$8,false,
                 $9,$10,$11,$12,$13,$14,$15,$16,now(),'manual',$17,$17,1,true,$18,$18)`,
        [
          recurringId,
          item.company_id,
          item.project_id,
          item.plan_name_snapshot || item.service_name_snapshot,
          item.recurrence === 'monthly' ? 'monthly' : 'yearly',
          item.renewal_price_snapshot,
          item.currency_snapshot,
          due,
          orderId,
          itemId,
          contract[0]?.id || null,
          item.service_id,
          item.plan_id,
          item.plan_name_snapshot,
          item.included_snapshot || [],
          Boolean(item.renewal_required),
          item.salesperson_id,
          context.user.id,
        ],
      );
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".renewals
          (id, recurring_service_id, company_id, project_id, title, status,
           amount, currency, due_date, source_order_id, source_order_item_id,
           recurrence, renewal_required, included_snapshot, activated_at,
           management_mode, owner_user_id, salesperson_id,
           optimistic_version, authority_managed, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,'active',$6,$7,$8,$9,$10,$11,$12,$13,now(),
                 'manual',$14,$14,1,true,$15,$15)`,
        [
          renewalId,
          recurringId,
          item.company_id,
          item.project_id,
          item.plan_name_snapshot || item.service_name_snapshot,
          item.renewal_price_snapshot,
          item.currency_snapshot,
          due,
          orderId,
          itemId,
          item.recurrence,
          Boolean(item.renewal_required),
          item.included_snapshot || [],
          item.salesperson_id,
          context.user.id,
        ],
      );
      await this.event(context, {
        aggregateType: 'renewal', aggregateId: renewalId,
        eventType: 'document_renewal_activated',
        after: { renewalId, recurringId, orderId, itemId, due },
        metadata: { order_id: orderId, message: 'Servizio ricorrente attivato' },
        notify: true,
      });
      return { id: renewalId, recurringServiceId: recurringId, existing: false };
    });
  }

  private async lockedRenewal(
    context: OperationContext,
    user: RevenueUser,
    id: string,
  ) {
    const rows = await context.manager.query(
      `SELECT * FROM "${context.user.schema}".renewals
        WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [id],
    );
    const renewal = rows[0];
    if (!renewal) throw new NotFoundException('Rinnovo non trovato');
    if (!(await this.canViewAll(user)) && renewal.salesperson_id !== user.id) {
      throw new ForbiddenException('Rinnovo non autorizzato');
    }
    return renewal;
  }

  async updateRenewal(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnRenewals');
    const id = this.uuid(idValue, 'renewalId');
    return this.withOperation('renewal.update', keyValue, { id, ...body }, async (context) => {
      const current = await this.lockedRenewal(context, user, id);
      const statusAliases: Record<string, string> = {
        Attivo: 'active',
        'In scadenza': 'upcoming',
        'Da rinnovare': 'due',
        'Promemoria inviato': 'reminded',
        Pagato: 'paid',
        Scaduto: 'expired',
        Sospeso: 'suspended',
        Annullato: 'cancelled',
      };
      const status = body.status === undefined
        ? current.status
        : statusAliases[String(body.status)] || String(body.status).toLowerCase();
      if (!RENEWAL_STATUSES.includes(status)) {
        throw new BadRequestException('Stato rinnovo non valido');
      }
      if (status === 'paid') {
        throw new BadRequestException('Lo stato pagato deriva dai pagamenti confermati');
      }
      const mode = body.mode === undefined ? current.management_mode : String(body.mode);
      if (!['manual', 'automatic'].includes(mode)) {
        throw new BadRequestException('Modalità rinnovo non valida');
      }
      const owner = body.ownerId
        ? this.uuid(body.ownerId, 'ownerId')
        : current.owner_user_id;
      const version = this.version(body.version ?? current.optimistic_version);
      const updated = await context.manager.query(
        `UPDATE "${context.user.schema}".renewals SET
           due_date = COALESCE($2,due_date), status = $3,
           management_mode = $4, owner_user_id = $5,
           optimistic_version = optimistic_version + 1,
           updated_by = $6, updated_at = now()
         WHERE id = $1 AND optimistic_version = $7 RETURNING *`,
        [
          id,
          body.nextDueAt ? String(body.nextDueAt).slice(0, 10) : null,
          status,
          mode,
          owner,
          context.user.id,
          version,
        ],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione rinnovo');
      await context.manager.query(
        `UPDATE "${context.user.schema}".recurring_services SET
           next_due_date = $2, status = CASE WHEN $3 = 'cancelled' THEN 'cancelled' ELSE status END,
           management_mode = $4, owner_user_id = $5,
           optimistic_version = optimistic_version + 1,
           updated_by = $6, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL`,
        [current.recurring_service_id, updated[0].due_date, status, mode, owner, context.user.id],
      );
      await this.event(context, {
        aggregateType: 'renewal', aggregateId: id,
        eventType: 'document_renewal_updated', before: current, after: updated[0],
      });
      return { id, version: Number(updated[0].optimistic_version) };
    });
  }

  async remindRenewal(idValue: string, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnRenewals');
    const id = this.uuid(idValue, 'renewalId');
    return this.withOperation('renewal.reminder', keyValue, { id }, async (context) => {
      const current = await this.lockedRenewal(context, user, id);
      if (['cancelled', 'expired', 'paid'].includes(current.status)) {
        throw new BadRequestException('Rinnovo non promemorizzabile');
      }
      await context.manager.query(
        `UPDATE "${context.user.schema}".renewals SET status = 'reminded',
           reminded_at = now(), optimistic_version = optimistic_version + 1,
           updated_by = $2, updated_at = now() WHERE id = $1`,
        [id, context.user.id],
      );
      await this.event(context, {
        aggregateType: 'renewal', aggregateId: id,
        eventType: 'document_renewal_reminder_created', before: current,
        after: { status: 'reminded' },
        metadata: {
          external_provider: 'not_configured',
          message: 'Promemoria operativo registrato; nessun invio esterno eseguito',
        },
        notify: true,
      });
      return { activityId: context.operationId, existing: false };
    });
  }

  async generateRenewalOrder(idValue: string, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnRenewals');
    const id = this.uuid(idValue, 'renewalId');
    return this.withOperation('renewal.order', keyValue, { id }, async (context) => {
      const renewal = await this.lockedRenewal(context, user, id);
      if (renewal.renewal_order_id) {
        return { orderId: renewal.renewal_order_id, activityId: context.operationId, existing: true };
      }
      const recurringRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".recurring_services
          WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [renewal.recurring_service_id],
      );
      const recurring = recurringRows[0];
      if (!recurring || ['cancelled', 'suspended'].includes(recurring.status)) {
        throw new BadRequestException('Servizio ricorrente non disponibile');
      }
      const sourceItemRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".order_items
          WHERE id = $1 AND archived_at IS NULL FOR SHARE`,
        [renewal.source_order_item_id],
      );
      const sourceItem = sourceItemRows[0];
      if (!sourceItem) throw new NotFoundException('Snapshot ordine sorgente non trovato');
      await context.manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `${context.user.schema}:order-number`,
      ]);
      const numberRows = await context.manager.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '')::int), 1000) + 1 AS next
           FROM "${context.user.schema}".orders`,
      );
      const orderId = randomUUID();
      const code = `DF-${numberRows[0].next}`;
      const subtotalCents = this.cents(renewal.amount, 'renewal.amount');
      const taxCents = Math.round(
        (subtotalCents * this.nonNegative(sourceItem.tax_rate_snapshot, 'tax_rate')) / 100,
      );
      const totalCents = subtotalCents + taxCents;
      const renewalKey = `renewal:${id}:${String(renewal.due_date).slice(0, 10)}`;
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".orders
          (id, idempotency_key, code, company_id, salesperson_id, currency,
           discount, subtotal, tax_total, total, deposit, balance,
           gross_collected, refunded_total, net_collected, residual,
           payment_status, installments, project_id, administrative_status,
           order_date, due_date, notes, confirmed_at, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,0,$7,$8,$9,0,$9,0,0,0,$9,'not_started',1,
                 $10,'Confermato',current_date,$11,$12,now(),$13,$13)`,
        [
          orderId,
          renewalKey,
          code,
          renewal.company_id,
          renewal.salesperson_id,
          renewal.currency,
          this.money(subtotalCents),
          this.money(taxCents),
          this.money(totalCents),
          renewal.project_id,
          renewal.due_date,
          `Ordine rinnovo ${renewal.title}`,
          context.user.id,
        ],
      );
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".order_items
          (order_id, service_id, service_name_snapshot,
           service_description_snapshot, service_category_snapshot, quantity,
           unit_price_snapshot, discount, tax_rate_snapshot, tax_amount,
           currency_snapshot, catalog_version_snapshot, plan_id,
           plan_name_snapshot, one_time_price_snapshot,
           recurring_price_snapshot, first_period_total,
           renewal_price_snapshot, recurrence, renewal_required,
           included_snapshot, next_due_at, line_subtotal, line_total,
           immutable_at)
         VALUES ($1,$2,$3,$4,$5,1,$6,0,$7,$8,$9,$10,$11,$12,0,$6,$13,$6,$14,
                 $15,$16,$17,$6,$13,now())`,
        [
          orderId,
          sourceItem.service_id,
          `Rinnovo ${renewal.title}`,
          sourceItem.service_description_snapshot,
          sourceItem.service_category_snapshot,
          this.money(subtotalCents),
          sourceItem.tax_rate_snapshot,
          this.money(taxCents),
          renewal.currency,
          sourceItem.catalog_version_snapshot,
          recurring.plan_id,
          recurring.plan_name_snapshot,
          this.money(totalCents),
          renewal.recurrence,
          renewal.renewal_required,
          renewal.included_snapshot || [],
          renewal.due_date,
        ],
      );
      await context.manager.query(
        `UPDATE "${context.user.schema}".renewals SET renewal_order_id = $2,
           status = 'invoiced', optimistic_version = optimistic_version + 1,
           updated_by = $3, updated_at = now() WHERE id = $1`,
        [id, orderId, context.user.id],
      );
      await this.event(context, {
        aggregateType: 'renewal', aggregateId: id,
        eventType: 'document_renewal_order_created',
        after: { orderId, code, total: this.money(totalCents) },
        metadata: { order_id: orderId, message: `Ordine rinnovo ${code} creato` },
        notify: true,
      });
      return { orderId, activityId: context.operationId, existing: false };
    });
  }

  async archiveRenewal(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnRenewals');
    const id = this.uuid(idValue, 'renewalId');
    return this.withOperation('renewal.archive', keyValue, { id, ...body }, async (context) => {
      const current = await this.lockedRenewal(context, user, id);
      const updated = await context.manager.query(
        `UPDATE "${context.user.schema}".renewals SET status = 'cancelled',
           deleted_at = now(), optimistic_version = optimistic_version + 1,
           updated_by = $2, updated_at = now()
         WHERE id = $1 AND optimistic_version = $3 RETURNING *`,
        [id, context.user.id, this.version(body.version ?? current.optimistic_version)],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione rinnovo');
      await context.manager.query(
        `UPDATE "${context.user.schema}".recurring_services SET status = 'cancelled',
           deleted_at = now(), optimistic_version = optimistic_version + 1,
           updated_by = $2, updated_at = now()
         WHERE id = $1 AND deleted_at IS NULL`,
        [current.recurring_service_id, context.user.id],
      );
      await this.event(context, {
        aggregateType: 'renewal', aggregateId: id,
        eventType: 'document_renewal_archived', before: current, after: updated[0],
      });
      return { id, version: Number(updated[0].optimistic_version) };
    });
  }

  async summary() {
    const user = await this.assertCapability(
      'canViewInvoices',
      'canViewAdministration',
    );
    if (!(await this.canViewMoney(user))) {
      return { redacted: true };
    }
    const schema = await this.ensure();
    const all = await this.canViewAll(user);
    const rows = await this.dataSource.query(
      `SELECT
         COALESCE(SUM(i.total) FILTER (
           WHERE i.type <> 'credit_note' AND i.status IN ('issued','partially_paid','paid','overdue')
         ),0)::numeric AS gross_revenue,
         COALESCE(SUM(i.total) FILTER (
           WHERE i.type = 'credit_note' AND i.status NOT IN ('cancelled','void')
         ),0)::numeric AS credit_notes,
         COUNT(*) FILTER (WHERE i.type <> 'credit_note')::int AS invoice_count
       FROM "${schema}".invoices i
       LEFT JOIN "${schema}".orders o ON o.id = i.order_id
       WHERE i.deleted_at IS NULL ${all ? '' : 'AND o.salesperson_id = $1'}`,
      all ? [] : [user.id],
    );
    const gross = Number(rows[0].gross_revenue || 0);
    const credits = Number(rows[0].credit_notes || 0);
    return {
      grossRevenue: gross,
      creditNotes: credits,
      netRevenue: Math.max(gross - credits, 0),
      invoiceCount: Number(rows[0].invoice_count || 0),
      redacted: false,
    };
  }
}
