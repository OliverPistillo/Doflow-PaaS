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
import { ensureDoflowCommerceTables } from './tenant-doflow-commerce-schema';
import { TenantDeliveryCoreService } from './tenant-delivery-core.service';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SERVICE_CATEGORIES = [
  'Siti web',
  'E-commerce',
  'Software',
  'Gestionale SaaS',
  'Marketing',
  'Assistenza',
  'Altro',
];
const SERVICE_STATUSES = ['active', 'inactive'];
const SERVICE_AVAILABILITY = ['available', 'limited', 'unavailable'];
const SALE_STATUSES = ['Bozza', 'In trattativa', 'Vinta', 'Persa', 'Annullata'];
const SALE_ORIGINS = [
  'Commerciale',
  'Acquisto diretto DoFlow',
  'Demo commerciale',
  'Referral',
  'Campagna',
  'Altro',
];
const ORDER_STATUSES = [
  'Bozza',
  'Confermato',
  'Acconto richiesto',
  'Parzialmente pagato',
  'Pagato',
  'Annullato',
  'Rimborsato',
];
const CAMPAIGN_CHANNELS = ['Meta Ads', 'Google Ads', 'Organico', 'Referral', 'Evento', 'LinkedIn', 'Instagram', 'Manuale'];
const CAMPAIGN_STATUSES = ['draft', 'active', 'paused', 'completed', 'archived'];
const AD_STATUSES = ['active', 'paused', 'archived'];

type CommerceUser = { id: string; email: string; role: string; schema: string };
type OperationContext = {
  user: CommerceUser;
  manager: EntityManager;
  operationId: string;
  correlationId: string;
};

@Injectable()
export class TenantDoflowCommerceService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
    private readonly delivery: TenantDeliveryCoreService,
    private readonly realtime: NotificationsService,
  ) {}

  private user(): CommerceUser {
    const source = this.request.user || this.request.authUser;
    const schema = String(
      source?.tenantId || source?.tenant_id || this.request.tenantId || '',
    ).toLowerCase();
    const id = String(source?.sub || source?.id || '');
    if (!UUID_RE.test(id) || !isDoflowTenant(schema)) {
      throw new ForbiddenException('Commerce disponibile soltanto nel tenant doflow');
    }
    return {
      id,
      email: String(source.email || ''),
      role: String(source.role || '').toLowerCase(),
      schema,
    };
  }

  private async assertCapability(capability: string) {
    const user = this.user();
    if (['owner', 'admin'].includes(user.role)) return user;
    await ensureDoflowWorkspaceTables(this.dataSource, user.schema);
    const rows = await this.dataSource.query(
      `SELECT role FROM "${user.schema}".doflow_user_roles WHERE user_id = $1`,
      [user.id],
    );
    const explicit = await this.dataSource.query(
      `SELECT 1 FROM "${user.schema}".doflow_user_capabilities
        WHERE user_id = $1 AND capability = $2 LIMIT 1`,
      [user.id, capability],
    );
    const inherited = rows.some((row: any) =>
      (DOFLOW_ROLE_CAPABILITIES[String(row.role)] || []).includes(capability),
    );
    if (!inherited && !explicit[0]) {
      throw new ForbiddenException('Capability commerce insufficiente');
    }
    return user;
  }

  private async hasCapability(user: CommerceUser, capability: string) {
    if (['owner', 'admin'].includes(user.role)) return true;
    await ensureDoflowWorkspaceTables(this.dataSource, user.schema);
    const rows = await this.dataSource.query(
      `SELECT role FROM "${user.schema}".doflow_user_roles WHERE user_id = $1`,
      [user.id],
    );
    if (
      rows.some((row: any) =>
        (DOFLOW_ROLE_CAPABILITIES[String(row.role)] || []).includes(capability),
      )
    ) return true;
    const explicit = await this.dataSource.query(
      `SELECT 1 FROM "${user.schema}".doflow_user_capabilities
        WHERE user_id = $1 AND capability = $2 LIMIT 1`,
      [user.id, capability],
    );
    return Boolean(explicit[0]);
  }

  private async canViewMoney(user: CommerceUser) {
    return (
      (await this.hasCapability(user, 'canViewAdministration')) ||
      (await this.hasCapability(user, 'canViewCommercialValues'))
    );
  }

  private async canViewGlobalMoney(user: CommerceUser) {
    return (
      ['owner', 'admin'].includes(user.role) ||
      (await this.hasCapability(user, 'canViewGlobalCommerceValues'))
    );
  }

  private async assertAnyCapability(...capabilities: string[]) {
    const user = this.user();
    for (const capability of capabilities) {
      if (await this.hasCapability(user, capability)) return user;
    }
    throw new ForbiddenException('Capability Commerce & Cash insufficiente');
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
    if (required && !result) throw new BadRequestException(`${label} obbligatorio`);
    return result || null;
  }

  private number(value: unknown, label: string, fallback?: number) {
    if ((value === undefined || value === null || value === '') && fallback !== undefined) {
      return fallback;
    }
    const result = Number(value);
    if (!Number.isFinite(result) || result < 0) {
      throw new BadRequestException(`${label} non valido`);
    }
    return Number(result.toFixed(2));
  }

  private positiveNumber(value: unknown, label: string, fallback?: number) {
    const result = this.number(value, label, fallback);
    if (result <= 0) throw new BadRequestException(`${label} deve essere maggiore di zero`);
    return result;
  }

  private currency(value: unknown, fallback = 'EUR') {
    const result = String(value || fallback).trim().toUpperCase();
    if (!/^[A-Z]{3}$/.test(result)) throw new BadRequestException('currency non valida');
    return result;
  }

  private cents(value: unknown, label: string, fallback = 0) {
    const amount = this.number(value, label, fallback);
    return Math.round(amount * 100);
  }

  private money(cents: number) {
    return Number((cents / 100).toFixed(2));
  }

  private version(value: unknown) {
    const result = Number(value);
    if (!Number.isInteger(result) || result < 1) {
      throw new BadRequestException('Versione record obbligatoria');
    }
    return result;
  }

  private idempotencyKey(value: unknown) {
    const result = String(value || '').trim();
    if (!/^[A-Za-z0-9_.:@/-]{8,200}$/.test(result)) {
      throw new BadRequestException('Idempotency-Key non valida');
    }
    return result;
  }

  private requestHash(value: unknown) {
    return createHash('sha256').update(JSON.stringify(value)).digest('hex');
  }

  private enum(value: unknown, allowed: string[], label: string, fallback: string) {
    const result = String(value || fallback);
    if (!allowed.includes(result)) throw new BadRequestException(`${label} non valido`);
    return result;
  }

  private async ensure() {
    const user = this.user();
    await ensureDoflowWorkspaceTables(this.dataSource, user.schema);
    await ensureDoflowCommerceTables(this.dataSource, user.schema);
    return user.schema;
  }

  private async withOperation<T>(
    operation: string,
    keyValue: unknown,
    requestValue: unknown,
    work: (context: OperationContext) => Promise<T>,
  ): Promise<T> {
    const user = this.user();
    const schema = await this.ensure();
    const key = this.idempotencyKey(keyValue);
    const hash = this.requestHash(requestValue);
    const response = await this.dataSource.transaction(async (manager) => {
      await manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [
        `${user.id}:${operation}:${key}`,
      ]);
      const existing = await manager.query(
        `SELECT request_hash, status, response_payload
           FROM "${schema}".commerce_idempotency
          WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3
          FOR UPDATE`,
        [user.id, operation, key],
      );
      if (existing[0]) {
        if (String(existing[0].request_hash) !== hash) {
          throw new ConflictException('Idempotency-Key già usata con dati differenti');
        }
        if (existing[0].status === 'completed') return existing[0].response_payload as T;
        throw new ConflictException('Operazione identica già in corso');
      }
      const operationId = randomUUID();
      const correlationId = randomUUID();
      await manager.query(
        `INSERT INTO "${schema}".commerce_idempotency
          (actor_id, operation, idempotency_key, request_hash, status, operation_id, correlation_id)
         VALUES ($1,$2,$3,$4,'processing',$5,$6)`,
        [user.id, operation, key, hash, operationId, correlationId],
      );
      const result = await work({ user, manager, operationId, correlationId });
      await manager.query(
        `UPDATE "${schema}".commerce_idempotency
            SET status = 'completed', response_payload = $4::jsonb, completed_at = now()
          WHERE actor_id = $1 AND operation = $2 AND idempotency_key = $3`,
        [user.id, operation, key, JSON.stringify(result)],
      );
      return result;
    });
    try {
      await this.realtime.notifyTenant(user.schema, {
        kind: 'commerce_cash_changed',
        operation,
      });
    } catch {
      // Realtime is a non-authoritative projection and cannot roll back money.
    }
    return response;
  }

  private async businessEvent(
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
    const { user, manager, operationId, correlationId } = context;
    const metadata = input.metadata || {};
    await manager.query(
      `INSERT INTO "${user.schema}".commerce_history
        (aggregate_type, aggregate_id, event_type, operation_id, correlation_id,
         actor_id, before_state, after_state, metadata)
       VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8::jsonb,$9::jsonb)`,
      [
        input.aggregateType,
        input.aggregateId,
        input.eventType,
        operationId,
        correlationId,
        user.id,
        input.before == null ? null : JSON.stringify(input.before),
        input.after == null ? null : JSON.stringify(input.after),
        JSON.stringify(metadata),
      ],
    );
    await this.audit(manager, user, input.eventType, input.aggregateId, {
      operation_id: operationId,
      correlation_id: correlationId,
      ...metadata,
    });
    await manager.query(
      `INSERT INTO "${user.schema}".commerce_outbox
        (aggregate_type, aggregate_id, event_type, operation_id, correlation_id, payload)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [
        input.aggregateType,
        input.aggregateId,
        input.eventType,
        operationId,
        correlationId,
        JSON.stringify(metadata),
      ],
    );
    if (input.notify) {
      await manager.query(
        `INSERT INTO "${user.schema}".notifications
          (recipient_user_id, title, body, type, priority, entity_type, entity_id,
           link_url, fingerprint, metadata, created_by, created_at, updated_at)
         VALUES ($1,$2,$3,'commerce','normal',$4,$5,$6,$7,$8::jsonb,$1,now(),now())
         ON CONFLICT DO NOTHING`,
        [
          user.id,
          input.eventType.replace(/_/g, ' '),
          String(metadata.message || input.eventType),
          input.aggregateType,
          input.aggregateId,
          `/dashboard/${input.aggregateType === 'payment' ? 'pagamenti' : 'ordini'}`,
          `commerce:${operationId}:${user.id}`,
          JSON.stringify({ operation_id: operationId, correlation_id: correlationId }),
        ],
      );
    }
  }

  private async audit(
    manager: EntityManager | DataSource,
    user: CommerceUser,
    action: string,
    target: string,
    metadata: Record<string, unknown> = {},
  ) {
    await manager.query(
      `INSERT INTO "${user.schema}".audit_log
        (actor_email, actor_role, action, target, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, now())`,
      [user.email || null, user.role, action, target, JSON.stringify(metadata)],
    );
  }

  async listCategories() {
    await this.assertCapability('canViewSales');
    const schema = await this.ensure();
    const items = await this.dataSource.query(
      `SELECT * FROM "${schema}".service_categories
        WHERE deleted_at IS NULL ORDER BY sort_order, name`,
    );
    return { items };
  }

  async createCategory(body: Record<string, any>, keyValue: unknown) {
    await this.assertCapability('canManageCatalog');
    return this.withOperation('category.create', keyValue, body, async (context) => {
      const rows = await context.manager.query(
        `INSERT INTO "${context.user.schema}".service_categories
          (name, description, sort_order, active, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$5) RETURNING *`,
        [
          this.text(body.name, 'name', true),
          String(body.description || ''),
          Math.max(0, Math.trunc(this.number(body.sortOrder, 'sortOrder', 0))),
          body.active !== false,
          context.user.id,
        ],
      );
      await this.businessEvent(context, {
        aggregateType: 'service_category',
        aggregateId: rows[0].id,
        eventType: 'commerce_category_created',
        after: rows[0],
      });
      return rows[0];
    });
  }

  async updateCategory(idValue: string, body: Record<string, any>, keyValue: unknown) {
    await this.assertCapability('canManageCatalog');
    const id = this.uuid(idValue, 'id');
    return this.withOperation('category.update', keyValue, { id, ...body }, async (context) => {
      const currentRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".service_categories
          WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      );
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Categoria non trovata');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione categoria');
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".service_categories SET
           name = COALESCE($2, name), description = COALESCE($3, description),
           sort_order = COALESCE($4, sort_order), active = COALESCE($5, active),
           version = version + 1, updated_by = $6, updated_at = now()
         WHERE id = $1 AND version = $7 AND deleted_at IS NULL RETURNING *`,
        [
          id,
          body.name === undefined ? null : this.text(body.name, 'name', true),
          body.description === undefined ? null : String(body.description || ''),
          body.sortOrder === undefined ? null : Math.max(0, Math.trunc(this.number(body.sortOrder, 'sortOrder'))),
          body.active === undefined ? null : body.active === true,
          context.user.id,
          version,
        ],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione categoria');
      await this.businessEvent(context, {
        aggregateType: 'service_category', aggregateId: id,
        eventType: 'commerce_category_updated', before: current, after: rows[0],
      });
      return rows[0];
    });
  }

  async archiveCategory(idValue: string, body: Record<string, any>, keyValue: unknown) {
    await this.assertCapability('canManageCatalog');
    const id = this.uuid(idValue, 'id');
    return this.withOperation('category.archive', keyValue, { id, ...body }, async (context) => {
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".service_categories
            SET active = false, deleted_at = now(), version = version + 1,
                updated_by = $2, updated_at = now()
          WHERE id = $1 AND version = $3 AND deleted_at IS NULL RETURNING *`,
        [id, context.user.id, this.version(body.version)],
      );
      if (!rows[0]) throw new ConflictException('Categoria non trovata o versione non aggiornata');
      await this.businessEvent(context, {
        aggregateType: 'service_category', aggregateId: id,
        eventType: 'commerce_category_archived', after: rows[0],
      });
      return { success: true, version: Number(rows[0].version) };
    });
  }

  async restoreCategory(idValue: string, keyValue: unknown) {
    await this.assertCapability('canManageCatalog');
    const id = this.uuid(idValue, 'id');
    return this.withOperation('category.restore', keyValue, { id }, async (context) => {
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".service_categories
            SET active = true, deleted_at = NULL, version = version + 1,
                updated_by = $2, updated_at = now()
          WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
        [id, context.user.id],
      );
      if (!rows[0]) throw new NotFoundException('Categoria archiviata non trovata');
      await this.businessEvent(context, {
        aggregateType: 'service_category', aggregateId: id,
        eventType: 'commerce_category_restored', after: rows[0],
      });
      return rows[0];
    });
  }

  async listServices() {
    const user = await this.assertCapability('canViewSales');
    const schema = await this.ensure();
    const moneyVisible = await this.canViewMoney(user);
    const [services, promotions, extras, plans] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM "${schema}".services WHERE deleted_at IS NULL ORDER BY name`,
      ),
      this.dataSource.query(
        `SELECT * FROM "${schema}".service_promotions WHERE deleted_at IS NULL ORDER BY created_at`,
      ),
      this.dataSource.query(
        `SELECT * FROM "${schema}".service_extras WHERE deleted_at IS NULL ORDER BY created_at`,
      ),
      this.dataSource.query(
        `SELECT * FROM "${schema}".service_billing_plans WHERE deleted_at IS NULL ORDER BY created_at`,
      ),
    ]);
    return {
      items: services.map((service: any) => {
        const item = {
          ...service,
          promotions: promotions.filter((child: any) => child.service_id === service.id),
          extras: extras.filter((child: any) => child.service_id === service.id),
          billing_plans: plans.filter((child: any) => child.service_id === service.id),
        };
        if (moneyVisible) return item;
        for (const field of ['price', 'deposit', 'balance', 'renewal_price']) delete item[field];
        item.promotions = item.promotions.map(({ value: _value, maximum_discount: _max, ...promotion }: any) => promotion);
        item.extras = item.extras.map(({ price: _price, ...extra }: any) => extra);
        item.billing_plans = item.billing_plans.map(({ one_time_price: _one, recurring_price: _recurring, ...plan }: any) => plan);
        return item;
      }),
    };
  }

  private serviceValues(body: Record<string, any>, partial: boolean) {
    const values: Record<string, unknown> = {};
    const add = (key: string, value: unknown, source = key) => {
      if (!partial || body[source] !== undefined) values[key] = value;
    };
    add('name', this.text(body.name, 'name', !partial));
    add(
      'category',
      this.enum(body.category, SERVICE_CATEGORIES, 'category', 'Altro'),
    );
    add('description', String(body.description || ''));
    add('price', this.number(body.price, 'price', 0));
    add('currency', this.currency(body.currency, 'EUR'));
    add('unit', this.text(body.unit, 'unit') || 'unit');
    add('tax_rate', this.number(body.taxRate, 'taxRate', 0), 'taxRate');
    add(
      'billing_type',
      this.enum(body.billingType, ['one_time', 'recurring', 'mixed'], 'billingType', 'one_time'),
      'billingType',
    );
    add('sort_order', Math.max(0, Math.trunc(this.number(body.sortOrder, 'sortOrder', 0))), 'sortOrder');
    add('category_id', this.optionalUuid(body.categoryId, 'categoryId'), 'categoryId');
    add('status', this.enum(body.status, SERVICE_STATUSES, 'status', 'active'));
    add(
      'availability',
      this.enum(
        body.availability,
        SERVICE_AVAILABILITY,
        'availability',
        'available',
      ),
    );
    add('deposit', this.number(body.deposit, 'deposit', 0));
    add('balance', this.number(body.balance, 'balance', 0));
    add('installments', Math.max(1, Math.trunc(this.number(body.installments, 'installments', 1))));
    if (!partial || body.renewal !== undefined) {
      const renewal = body.renewal || {};
      values.renewal_enabled = renewal.enabled === true;
      values.renewal_interval = this.enum(
        renewal.interval,
        ['monthly', 'quarterly', 'annual'],
        'renewal.interval',
        'annual',
      );
      values.renewal_price = this.number(renewal.price, 'renewal.price', 0);
    }
    if (!partial || body.projectTemplate !== undefined) {
      const template = body.projectTemplate || {};
      values.project_template_name = this.text(template.name, 'projectTemplate.name');
      values.project_template_type = this.text(template.projectType, 'projectTemplate.projectType');
      values.project_template_phases = Array.isArray(template.phases)
        ? template.phases.map((item: unknown) => String(item).trim()).filter(Boolean)
        : [];
    }
    return values;
  }

  private async replaceServiceChildren(
    manager: EntityManager,
    schema: string,
    serviceId: string,
    body: Record<string, any>,
  ) {
    if (body.promotions !== undefined) {
      await manager.query(`UPDATE "${schema}".service_promotions SET deleted_at = now(), updated_at = now() WHERE service_id = $1 AND deleted_at IS NULL`, [serviceId]);
      for (const promotion of Array.isArray(body.promotions) ? body.promotions : []) {
        await manager.query(
          `INSERT INTO "${schema}".service_promotions
            (id, service_id, name, kind, value, active, valid_from, valid_until,
             minimum_quantity, maximum_quantity, maximum_discount, combinable)
           VALUES (COALESCE($1::uuid, uuid_generate_v4()), $2, $3, $4, $5, $6,
                   $7,$8,$9,$10,$11,$12)`,
          [
            null,
            serviceId,
            this.text(promotion.name, 'promotion.name', true),
            this.enum(promotion.kind, ['percentage', 'fixed'], 'promotion.kind', 'fixed'),
            this.number(promotion.value, 'promotion.value'),
            promotion.active !== false,
            promotion.validFrom || null,
            promotion.validUntil || null,
            promotion.minimumQuantity == null ? null : this.positiveNumber(promotion.minimumQuantity, 'promotion.minimumQuantity'),
            promotion.maximumQuantity == null ? null : this.positiveNumber(promotion.maximumQuantity, 'promotion.maximumQuantity'),
            promotion.maximumDiscount == null ? null : this.number(promotion.maximumDiscount, 'promotion.maximumDiscount'),
            promotion.combinable === true,
          ],
        );
      }
    }
    if (body.extras !== undefined) {
      await manager.query(`UPDATE "${schema}".service_extras SET deleted_at = now(), updated_at = now() WHERE service_id = $1 AND deleted_at IS NULL`, [serviceId]);
      for (const extra of Array.isArray(body.extras) ? body.extras : []) {
        await manager.query(
          `INSERT INTO "${schema}".service_extras (id, service_id, name, price, active)
           VALUES (COALESCE($1::uuid, uuid_generate_v4()), $2, $3, $4, $5)`,
          [
            null,
            serviceId,
            this.text(extra.name, 'extra.name', true),
            this.number(extra.price, 'extra.price'),
            extra.active !== false,
          ],
        );
      }
    }
    if (body.billingPlans !== undefined) {
      await manager.query(`UPDATE "${schema}".service_billing_plans SET deleted_at = now(), updated_at = now() WHERE service_id = $1 AND deleted_at IS NULL`, [serviceId]);
      for (const plan of Array.isArray(body.billingPlans) ? body.billingPlans : []) {
        await manager.query(
          `INSERT INTO "${schema}".service_billing_plans
            (id, service_id, name, description, one_time_price, recurring_price, recurrence, renewal, included, active)
           VALUES (COALESCE($1::uuid, uuid_generate_v4()), $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            null,
            serviceId,
            this.text(plan.name, 'plan.name', true),
            String(plan.description || ''),
            this.number(plan.oneTimePrice, 'plan.oneTimePrice', 0),
            this.number(plan.recurringPrice, 'plan.recurringPrice', 0),
            this.enum(plan.recurrence, ['monthly', 'annual'], 'plan.recurrence', 'annual'),
            this.enum(plan.renewal, ['required', 'optional'], 'plan.renewal', 'optional'),
            Array.isArray(plan.included) ? plan.included.map(String) : [],
            plan.active !== false,
          ],
        );
      }
    }
  }

  async createService(body: Record<string, any>, keyValue: unknown) {
    await this.assertCapability('canManageCatalog');
    const serviceId = await this.withOperation('service.create', keyValue, body, async (context) => {
      const values = this.serviceValues(body, false);
      const fields = Object.keys(values);
      const params = Object.values(values);
      const inserted = await context.manager.query(
        `INSERT INTO "${context.user.schema}".services
          (id, ${fields.join(', ')}, created_by, updated_by)
         VALUES (uuid_generate_v4(), ${fields.map((_, index) => `$${index + 1}`).join(', ')}, $${fields.length + 1}, $${fields.length + 1})
         RETURNING id`,
        [...params, context.user.id],
      );
      const savedId = String(inserted[0].id);
      await this.replaceServiceChildren(context.manager, context.user.schema, savedId, body);
      await this.businessEvent(context, {
        aggregateType: 'service', aggregateId: savedId,
        eventType: 'commerce_service_created', after: values,
      });
      return savedId;
    });
    return this.findService(serviceId);
  }

  private async findService(id: string | null) {
    const page = await this.listServices();
    const item = id ? page.items.find((row: any) => row.id === id) : page.items.at(-1);
    if (!item) throw new NotFoundException('Servizio non trovato');
    return item;
  }

  async updateService(idValue: string, body: Record<string, any>, keyValue: unknown) {
    await this.assertCapability('canManageCatalog');
    const id = this.uuid(idValue, 'id');
    await this.withOperation('service.update', keyValue, { id, ...body }, async (context) => {
      const currentRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".services WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      );
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Servizio non trovato');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione servizio');
      const values = this.serviceValues(body, true);
      const entries = Object.entries(values).filter(([, value]) => value !== undefined);
      if (entries.length) {
        const rows = await context.manager.query(
          `UPDATE "${context.user.schema}".services SET
             ${entries.map(([field], index) => `${field} = $${index + 1}`).join(', ')},
             version = version + 1, updated_by = $${entries.length + 1}, updated_at = now()
           WHERE id = $${entries.length + 2} AND version = $${entries.length + 3}
             AND deleted_at IS NULL RETURNING id`,
          [...entries.map(([, value]) => value), context.user.id, id, version],
        );
        if (!rows[0]) throw new ConflictException('Conflitto di versione servizio');
      } else {
        await context.manager.query(
          `UPDATE "${context.user.schema}".services SET version = version + 1,
             updated_by = $2, updated_at = now()
           WHERE id = $1 AND version = $3 AND deleted_at IS NULL`,
          [id, context.user.id, version],
        );
      }
      await this.replaceServiceChildren(context.manager, context.user.schema, id, body);
      await this.businessEvent(context, {
        aggregateType: 'service', aggregateId: id,
        eventType: 'commerce_service_updated', before: current, after: values,
      });
      return { id };
    });
    return this.findService(id);
  }

  async archiveService(idValue: string, body: Record<string, any>, keyValue: unknown) {
    await this.assertCapability('canManageCatalog');
    const id = this.uuid(idValue, 'id');
    return this.withOperation('service.archive', keyValue, { id, ...body }, async (context) => {
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".services SET status = 'inactive', deleted_at = now(),
            version = version + 1, updated_by = $2, updated_at = now()
          WHERE id = $1 AND version = $3 AND deleted_at IS NULL RETURNING *`,
        [id, context.user.id, this.version(body.version)],
      );
      if (!rows[0]) throw new ConflictException('Servizio non trovato o versione non aggiornata');
      await this.businessEvent(context, {
        aggregateType: 'service', aggregateId: id,
        eventType: 'commerce_service_archived', after: rows[0],
      });
      return { success: true, version: Number(rows[0].version) };
    });
  }

  async restoreService(idValue: string, keyValue: unknown) {
    await this.assertCapability('canManageCatalog');
    const id = this.uuid(idValue, 'id');
    return this.withOperation('service.restore', keyValue, { id }, async (context) => {
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".services SET status = 'active', deleted_at = NULL,
            version = version + 1, updated_by = $2, updated_at = now()
          WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
        [id, context.user.id],
      );
      if (!rows[0]) throw new NotFoundException('Servizio archiviato non trovato');
      await this.businessEvent(context, {
        aggregateType: 'service', aggregateId: id,
        eventType: 'commerce_service_restored', after: rows[0],
      });
      return rows[0];
    });
  }

  async listSales() {
    const user = await this.assertCapability('canViewSales');
    const schema = await this.ensure();
    const all = ['owner', 'admin'].includes(user.role) ||
      await this.assertCanViewAll(user);
    const ownMoneyVisible = await this.canViewMoney(user);
    const globalMoneyVisible = await this.canViewGlobalMoney(user);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".sales
       WHERE deleted_at IS NULL ${all ? '' : 'AND salesperson_id = $1'}
       ORDER BY sale_date DESC, created_at DESC`,
      all ? [] : [user.id],
    );
    return {
      items: await Promise.all(rows.map(async (row: any) => {
        const moneyVisible = ownMoneyVisible &&
          (globalMoneyVisible || row.salesperson_id === user.id);
        if (moneyVisible) return row;
        const { value: _value, cost: _cost, currency: _currency, ...redacted } = row;
        return redacted;
      })),
    };
  }

  private async assertCanViewAll(user: CommerceUser) {
    const rows = await this.dataSource.query(
      `SELECT role FROM "${user.schema}".doflow_user_roles WHERE user_id = $1`,
      [user.id],
    );
    if (rows.some((row: any) => (DOFLOW_ROLE_CAPABILITIES[String(row.role)] || []).includes('canViewAllLeads'))) return true;
    const explicit = await this.dataSource.query(
      `SELECT 1 FROM "${user.schema}".doflow_user_capabilities WHERE user_id = $1 AND capability = 'canViewAllLeads' LIMIT 1`,
      [user.id],
    );
    return Boolean(explicit[0]);
  }

  private saleValues(body: Record<string, any>, user: CommerceUser, partial: boolean) {
    const values: Record<string, unknown> = {};
    const add = (key: string, value: unknown, source = key) => {
      if (!partial || body[source] !== undefined) values[key] = value;
    };
    add('company_id', this.optionalUuid(body.customerId, 'customerId'), 'customerId');
    add('lead_id', this.optionalUuid(body.leadId, 'leadId'), 'leadId');
    add('opportunity_id', this.optionalUuid(body.opportunityId, 'opportunityId'), 'opportunityId');
    add('service_id', body.serviceId ? this.uuid(body.serviceId, 'serviceId') : null, 'serviceId');
    add('salesperson_id', body.salespersonId ? this.uuid(body.salespersonId, 'salespersonId') : user.id, 'salespersonId');
    add('origin', this.enum(body.origin, SALE_ORIGINS, 'origin', 'Commerciale'));
    add('value', this.number(body.value, 'value', 0));
    add('cost', body.cost == null ? null : this.number(body.cost, 'cost'));
    add('currency', this.currency(body.currency, 'EUR'));
    add('sale_date', this.text(body.date, 'date', !partial), 'date');
    add('status', this.enum(body.status, SALE_STATUSES, 'status', 'Bozza'));
    add('deal_id', this.text(body.dealId, 'dealId', !partial), 'dealId');
    add('project_id', this.optionalUuid(body.projectId, 'projectId'), 'projectId');
    add('notes', this.text(body.notes, 'notes'));
    return values;
  }

  private async assertSaleLinks(manager: EntityManager, schema: string, values: Record<string, unknown>) {
    if (values.service_id) {
      const service = await manager.query(
        `SELECT 1 FROM "${schema}".services WHERE id = $1 AND status = 'active' AND deleted_at IS NULL`,
        [values.service_id],
      );
      if (!service[0]) throw new BadRequestException('Servizio vendita non disponibile');
    }
    if (values.company_id) {
      const company = await manager.query(
        `SELECT 1 FROM "${schema}".companies WHERE id = $1 AND deleted_at IS NULL`,
        [values.company_id],
      );
      if (!company[0]) throw new BadRequestException('Cliente vendita non disponibile');
    }
    for (const field of ['lead_id', 'opportunity_id'] as const) {
      if (!values[field]) continue;
      const opportunity = await manager.query(
        `SELECT 1 FROM "${schema}".opportunities
          WHERE id = $1 AND deleted_at IS NULL
            AND ($2::uuid IS NULL OR company_id IS NULL OR company_id = $2)`,
        [values[field], values.company_id || null],
      );
      if (!opportunity[0]) throw new BadRequestException(`${field} vendita non disponibile`);
    }
    if (values.project_id) {
      const project = await manager.query(
        `SELECT 1 FROM "${schema}".projects WHERE id = $1 AND deleted_at IS NULL`,
        [values.project_id],
      );
      if (!project[0]) throw new BadRequestException('Progetto vendita non disponibile');
    }
  }

  async createSale(body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnSales');
    const canAssign = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
    const values = this.saleValues(
      canAssign ? body : { ...body, salespersonId: user.id },
      user,
      false,
    );
    return this.withOperation('sale.create', keyValue, values, async (context) => {
      await this.assertSaleLinks(context.manager, context.user.schema, values);
      const entries = Object.entries(values);
      const rows = await context.manager.query(
        `INSERT INTO "${context.user.schema}".sales
          (${entries.map(([field]) => field).join(', ')}, created_by, updated_by)
         VALUES (${entries.map((_, index) => `$${index + 1}`).join(', ')}, $${entries.length + 1}, $${entries.length + 1})
         RETURNING *`,
        [...entries.map(([, value]) => value), context.user.id],
      );
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".sale_items
          (sale_id, service_id, quantity) VALUES ($1,$2,1)`,
        [rows[0].id, rows[0].service_id],
      );
      await this.businessEvent(context, {
        aggregateType: 'sale', aggregateId: rows[0].id,
        eventType: 'commerce_sale_created', after: rows[0], notify: true,
      });
      return rows[0];
    });
  }

  async updateSale(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnSales');
    const id = this.uuid(idValue, 'id');
    const canAssign = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
    return this.withOperation('sale.update', keyValue, { id, ...body }, async (context) => {
      const currentRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".sales WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      );
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Vendita non trovata');
      if (!(await this.assertCanViewAll(user)) && current.salesperson_id !== user.id) throw new ForbiddenException('Vendita non autorizzata');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione vendita');
      const entries = Object.entries(
        this.saleValues(
          canAssign ? body : { ...body, salespersonId: current.salesperson_id },
          user,
          true,
        ),
      ).filter(([, value]) => value !== undefined);
      if (!entries.length) return current;
      await this.assertSaleLinks(context.manager, context.user.schema, { ...current, ...Object.fromEntries(entries) });
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".sales SET
           ${entries.map(([field], index) => `${field} = $${index + 1}`).join(', ')},
           version = version + 1, updated_by = $${entries.length + 1}, updated_at = now()
         WHERE id = $${entries.length + 2} AND version = $${entries.length + 3}
           AND deleted_at IS NULL RETURNING *`,
        [...entries.map(([, value]) => value), user.id, id, version],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione vendita');
      if (rows[0].service_id !== current.service_id) {
        await context.manager.query(
          `UPDATE "${context.user.schema}".sale_items SET deleted_at = now()
            WHERE sale_id = $1 AND deleted_at IS NULL`,
          [id],
        );
        await context.manager.query(
          `INSERT INTO "${context.user.schema}".sale_items (sale_id, service_id, quantity)
           VALUES ($1,$2,1)`,
          [id, rows[0].service_id],
        );
      }
      await this.businessEvent(context, {
        aggregateType: 'sale', aggregateId: id,
        eventType: 'commerce_sale_updated', before: current, after: rows[0],
      });
      return rows[0];
    });
  }

  async archiveSale(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnSales');
    const id = this.uuid(idValue, 'id');
    const all = await this.assertCanViewAll(user);
    return this.withOperation('sale.archive', keyValue, { id, ...body }, async (context) => {
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".sales SET deleted_at = now(),
            version = version + 1, updated_by = $2, updated_at = now()
          WHERE id = $1 AND version = $3 AND deleted_at IS NULL
          ${all ? '' : 'AND salesperson_id = $2'} RETURNING *`,
        [id, user.id, this.version(body.version)],
      );
      if (!rows[0]) throw new ConflictException('Vendita non trovata o versione non aggiornata');
      await this.businessEvent(context, {
        aggregateType: 'sale', aggregateId: id,
        eventType: 'commerce_sale_archived', after: rows[0],
      });
      return { success: true, version: Number(rows[0].version) };
    });
  }

  async listOrders() {
    const user = await this.assertCapability('canViewOrders');
    const schema = await this.ensure();
    const all = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
    const ownMoneyVisible = await this.canViewMoney(user);
    const globalMoneyVisible = await this.canViewGlobalMoney(user);
    const [orders, items] = await Promise.all([
      this.dataSource.query(
        `SELECT * FROM "${schema}".orders WHERE deleted_at IS NULL ${all ? '' : 'AND salesperson_id = $1'} ORDER BY order_date DESC, created_at DESC`,
        all ? [] : [user.id],
      ),
      this.dataSource.query(`SELECT * FROM "${schema}".order_items WHERE archived_at IS NULL ORDER BY created_at`),
    ]);
    return {
      items: orders.map((order: any) => {
        const row = { ...order, items: items.filter((item: any) => item.order_id === order.id) };
        if (ownMoneyVisible && (globalMoneyVisible || order.salesperson_id === user.id)) return row;
        for (const field of [
          'discount', 'subtotal', 'tax_total', 'total', 'deposit', 'balance',
          'gross_collected', 'refunded_total', 'net_collected', 'residual',
          'currency', 'payment_status',
        ]) delete row[field];
        row.items = row.items.map((item: any) => {
          const redacted = { ...item };
          for (const field of [
            'unit_price_snapshot', 'discount', 'tax_rate_snapshot', 'tax_amount',
            'line_subtotal', 'line_total', 'one_time_price_snapshot',
            'recurring_price_snapshot', 'first_period_total', 'renewal_price_snapshot',
            'promotion_snapshot', 'extras_snapshot', 'currency_snapshot',
          ]) delete redacted[field];
          return redacted;
        });
        return row;
      }),
    };
  }

  private async orderItems(
    manager: EntityManager,
    schema: string,
    orderId: string,
    inputs: any[],
    allowManualDiscount = false,
  ) {
    let subtotalCents = 0;
    let taxCents = 0;
    let totalCents = 0;
    let orderCurrency: string | null = null;
    for (const input of inputs) {
      const serviceId = this.uuid(input.serviceId, 'serviceId');
      const services = await manager.query(
        `SELECT * FROM "${schema}".services WHERE id = $1 AND status = 'active'
          AND availability <> 'unavailable' AND deleted_at IS NULL FOR SHARE`,
        [serviceId],
      );
      const service = services[0];
      if (!service) throw new BadRequestException('Servizio ordine non disponibile');
      let plan: any = null;
      if (input.planId) {
        const plans = await manager.query(
          `SELECT * FROM "${schema}".service_billing_plans WHERE id = $1 AND service_id = $2
            AND active = true AND deleted_at IS NULL`,
          [this.uuid(input.planId, 'planId'), serviceId],
        );
        plan = plans[0];
        if (!plan) throw new BadRequestException('Piano servizio non disponibile');
      }
      const quantity = this.positiveNumber(input.quantity, 'quantity', 1);
      const currency = this.currency(service.currency, 'EUR');
      if (orderCurrency && orderCurrency !== currency) throw new BadRequestException('Valute miste non consentite nello stesso ordine');
      orderCurrency = currency;
      let unitPriceCents = plan
        ? this.cents(plan.one_time_price, 'plan.one_time_price') + this.cents(plan.recurring_price, 'plan.recurring_price')
        : this.cents(service.price, 'service.price');
      const extraIds = Array.isArray(input.extraIds) ? [...new Set(input.extraIds.map(String))] : [];
      const extras = extraIds.length
        ? await manager.query(
          `SELECT * FROM "${schema}".service_extras
            WHERE service_id = $1 AND id = ANY($2::uuid[]) AND active = true AND deleted_at IS NULL`,
          [serviceId, extraIds.map((id) => this.uuid(id, 'extraId'))],
        )
        : [];
      if (extras.length !== extraIds.length) throw new BadRequestException('Extra servizio non disponibile');
      unitPriceCents += extras.reduce((sum: number, extra: any) => sum + this.cents(extra.price, 'extra.price'), 0);
      const grossCents = Math.round(quantity * unitPriceCents);
      let promotion: any = null;
      let discountCents = 0;
      if (input.promotionId) {
        const promotionRows = await manager.query(
          `SELECT * FROM "${schema}".service_promotions
            WHERE id = $1 AND service_id = $2 AND active = true AND deleted_at IS NULL
              AND (valid_from IS NULL OR valid_from <= now())
              AND (valid_until IS NULL OR valid_until >= now()) FOR SHARE`,
          [this.uuid(input.promotionId, 'promotionId'), serviceId],
        );
        promotion = promotionRows[0];
        if (!promotion) throw new BadRequestException('Promozione non disponibile');
        if (promotion.minimum_quantity != null && quantity < Number(promotion.minimum_quantity)) throw new BadRequestException('Quantità inferiore al minimo promozione');
        if (promotion.maximum_quantity != null && quantity > Number(promotion.maximum_quantity)) throw new BadRequestException('Quantità superiore al massimo promozione');
        discountCents = promotion.kind === 'percentage'
          ? Math.round(grossCents * Math.min(Number(promotion.value), 100) / 100)
          : this.cents(promotion.value, 'promotion.value');
        if (promotion.maximum_discount != null) discountCents = Math.min(discountCents, this.cents(promotion.maximum_discount, 'promotion.maximum_discount'));
      } else if (input.discount != null && this.number(input.discount, 'discount', 0) > 0) {
        if (!allowManualDiscount) throw new ForbiddenException('Sconto manuale non autorizzato');
        discountCents = this.cents(input.discount, 'discount');
      }
      discountCents = Math.min(discountCents, grossCents);
      const lineSubtotalCents = grossCents - discountCents;
      const taxRate = this.number(service.tax_rate, 'service.tax_rate', 0);
      if (taxRate < 0 || taxRate > 100) throw new BadRequestException('Aliquota servizio non valida');
      const lineTaxCents = Math.round(lineSubtotalCents * taxRate / 100);
      const lineTotalCents = lineSubtotalCents + lineTaxCents;
      subtotalCents += lineSubtotalCents;
      taxCents += lineTaxCents;
      totalCents += lineTotalCents;
      await manager.query(
        `INSERT INTO "${schema}".order_items
          (id, order_id, service_id, service_name_snapshot, service_description_snapshot,
           service_category_snapshot, quantity, unit_price_snapshot, discount,
           tax_rate_snapshot, tax_amount, currency_snapshot, catalog_version_snapshot,
           promotion_snapshot, extras_snapshot, line_subtotal,
           plan_id, plan_name_snapshot, one_time_price_snapshot, recurring_price_snapshot,
           first_period_total, renewal_price_snapshot, recurrence, renewal_required,
           included_snapshot, next_due_at, line_total)
         VALUES (uuid_generate_v4(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15,
                 $16,$17,$18,$19,$20,$21,$22,$23,$24,$25,$26)`,
        [
          orderId,
          serviceId,
          plan ? `${service.name} · ${plan.name}` : service.name,
          String(service.description || ''),
          String(service.category || 'Altro'),
          quantity,
          this.money(unitPriceCents),
          this.money(discountCents),
          taxRate,
          this.money(lineTaxCents),
          currency,
          Number(service.version || 1),
          promotion ? JSON.stringify({
            id: promotion.id, name: promotion.name, kind: promotion.kind,
            value: Number(promotion.value), appliedAmount: this.money(discountCents),
          }) : null,
          JSON.stringify(extras.map((extra: any) => ({ id: extra.id, name: extra.name, price: Number(extra.price) }))),
          this.money(lineSubtotalCents),
          plan?.id || null,
          plan?.name || null,
          plan ? Number(plan.one_time_price) : null,
          plan ? Number(plan.recurring_price) : null,
          this.money(unitPriceCents),
          plan ? Number(plan.recurring_price) : null,
          plan?.recurrence || null,
          plan ? plan.renewal === 'required' : null,
          plan?.included || [],
          input.nextDueAt || null,
          this.money(lineTotalCents),
        ],
      );
    }
    return {
      subtotal: this.money(subtotalCents),
      taxTotal: this.money(taxCents),
      total: this.money(totalCents),
      currency: orderCurrency || 'EUR',
    };
  }

  async createOrder(body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnOrders');
    if (!Array.isArray(body.items) || body.items.length === 0) throw new BadRequestException('items obbligatori');
    const canAssign = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
    const allowManualDiscount = await this.hasCapability(user, 'canManageCommerceRules');
    const key = this.idempotencyKey(keyValue || body.idempotencyKey);
    const created = await this.withOperation('order.create', key, body, async (context) => {
      const companyId = this.uuid(body.customerId, 'customerId');
      const companies = await context.manager.query(
        `SELECT id FROM "${context.user.schema}".companies WHERE id = $1 AND deleted_at IS NULL FOR SHARE`,
        [companyId],
      );
      if (!companies[0]) throw new BadRequestException('Cliente non disponibile nel tenant');
      for (const [field, value] of [
        ['leadId', body.leadId], ['opportunityId', body.opportunityId],
      ] as const) {
        if (!value) continue;
        const related = await context.manager.query(
          `SELECT 1 FROM "${context.user.schema}".opportunities
            WHERE id = $1 AND deleted_at IS NULL
              AND (company_id IS NULL OR company_id = $2)`,
          [this.uuid(value, field), companyId],
        );
        if (!related[0]) throw new BadRequestException(`${field} non disponibile nel tenant`);
      }
      const saleId = this.optionalUuid(body.saleId, 'saleId');
      let sale: any = null;
      if (saleId) {
        const rows = await context.manager.query(
          `SELECT * FROM "${context.user.schema}".sales WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [saleId],
        );
        sale = rows[0];
        if (!sale || (sale.company_id && sale.company_id !== companyId)) {
          throw new BadRequestException('Vendita sorgente non coerente con il cliente');
        }
      }
      await context.manager.query(`SELECT pg_advisory_xact_lock(hashtext($1))`, [`${context.user.schema}:order-number`]);
      const numberRows = await context.manager.query(
        `SELECT COALESCE(MAX(NULLIF(regexp_replace(code, '[^0-9]', '', 'g'), '')::int), 1000) + 1 AS next FROM "${context.user.schema}".orders`,
      );
      const id = String((await context.manager.query(`SELECT uuid_generate_v4() AS id`))[0].id);
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".orders
          (id, idempotency_key, code, company_id, sale_id, lead_id, opportunity_id,
           deal_id, salesperson_id, currency, discount, subtotal, tax_total, total,
           deposit, balance, gross_collected, refunded_total, net_collected, residual,
           payment_status, installments, project_id,
           administrative_status, order_date, due_date, notes, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'EUR',0,0,0,0,0,0,0,0,0,0,
                 'not_started',$10,$11,$12,$13,$14,$15,$16,$16)`,
        [
          id,
          key,
          `DF-${numberRows[0].next}`,
          companyId,
          saleId,
          this.optionalUuid(body.leadId || sale?.lead_id, 'leadId'),
          this.optionalUuid(body.opportunityId || sale?.opportunity_id, 'opportunityId'),
          this.text(body.dealId, 'dealId'),
          canAssign && body.salespersonId
            ? this.uuid(body.salespersonId, 'salespersonId')
            : user.id,
          Math.max(1, Math.trunc(this.number(body.installments, 'installments', 1))),
          null,
          this.enum(body.administrativeStatus, ['Bozza', 'Confermato', 'Acconto richiesto'], 'administrativeStatus', 'Bozza'),
          this.text(body.orderDate, 'orderDate', true),
          this.text(body.dueDate, 'dueDate'),
          this.text(body.notes, 'notes'),
          context.user.id,
        ],
      );
      const calculated = await this.orderItems(
        context.manager,
        context.user.schema,
        id,
        body.items,
        allowManualDiscount,
      );
      const orderDiscountCents = this.cents(body.discount, 'discount', 0);
      if (orderDiscountCents > 0 && !allowManualDiscount) throw new ForbiddenException('Sconto ordine non autorizzato');
      const subtotalWithTaxCents = this.cents(calculated.total, 'calculated.total');
      if (orderDiscountCents > subtotalWithTaxCents) throw new BadRequestException('Sconto ordine superiore al totale');
      const total = this.money(subtotalWithTaxCents - orderDiscountCents);
      const deposit = Math.min(this.number(body.deposit, 'deposit', 0), total);
      const balance = this.money(this.cents(total, 'total') - this.cents(deposit, 'deposit'));
      await context.manager.query(
        `UPDATE "${context.user.schema}".orders SET currency = $2, discount = $3,
          subtotal = $4, tax_total = $5, total = $6, deposit = $7, balance = $8,
          residual = $6, confirmed_at = CASE WHEN administrative_status <> 'Bozza' THEN now() ELSE NULL END
         WHERE id = $1`,
        [id, calculated.currency, this.money(orderDiscountCents), calculated.subtotal,
          calculated.taxTotal, total, deposit, balance],
      );
      if (saleId) {
        await context.manager.query(
          `UPDATE "${context.user.schema}".sales SET order_id = $1, company_id = $2,
             version = version + 1, updated_by = $3, updated_at = now() WHERE id = $4`,
          [id, companyId, context.user.id, saleId],
        );
      }
      await this.businessEvent(context, {
        aggregateType: 'order', aggregateId: id,
        eventType: 'commerce_order_created',
        after: { code: `DF-${numberRows[0].next}`, total, currency: calculated.currency },
        metadata: { message: `Ordine ${`DF-${numberRows[0].next}`} creato` },
        notify: true,
      });
      return { id };
    });
    return this.findOrder(created.id);
  }

  async findOrder(idValue: string) {
    const user = await this.assertCapability('canViewOrders');
    const schema = await this.ensure();
    const id = this.uuid(idValue, 'id');
    const orders = await this.dataSource.query(`SELECT * FROM "${schema}".orders WHERE id = $1 AND deleted_at IS NULL`, [id]);
    if (!orders[0]) throw new NotFoundException('Ordine non trovato');
    const all = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
    if (!all && orders[0].salesperson_id !== user.id) throw new ForbiddenException('Ordine non autorizzato');
    const items = await this.dataSource.query(`SELECT * FROM "${schema}".order_items WHERE order_id = $1 AND archived_at IS NULL ORDER BY created_at`, [id]);
    const result: any = { ...orders[0], items };
    if ((await this.canViewMoney(user)) &&
      ((await this.canViewGlobalMoney(user)) || orders[0].salesperson_id === user.id)) return result;
    for (const field of [
      'discount', 'subtotal', 'tax_total', 'total', 'deposit', 'balance',
      'gross_collected', 'refunded_total', 'net_collected', 'residual',
      'currency', 'payment_status',
    ]) delete result[field];
    result.items = items.map((item: any) => {
      const redacted = { ...item };
      for (const field of [
        'unit_price_snapshot', 'discount', 'tax_rate_snapshot', 'tax_amount',
        'line_subtotal', 'line_total', 'promotion_snapshot', 'extras_snapshot',
        'currency_snapshot', 'one_time_price_snapshot', 'recurring_price_snapshot',
        'first_period_total', 'renewal_price_snapshot',
      ]) delete redacted[field];
      return redacted;
    });
    return result;
  }

  async updateOrder(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnOrders');
    const id = this.uuid(idValue, 'id');
    await this.withOperation('order.update', keyValue, { id, ...body }, async (context) => {
      const rows = await context.manager.query(`SELECT * FROM "${context.user.schema}".orders WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`, [id]);
      const current = rows[0];
      if (!current) throw new NotFoundException('Ordine non trovato');
      const canAssign = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
      if (!canAssign && current.salesperson_id !== user.id) throw new ForbiddenException('Ordine non autorizzato');
      for (const forbidden of ['total', 'subtotal', 'taxTotal', 'balance', 'paymentStatus', 'code', 'currency', 'projectId']) {
        if (body[forbidden] !== undefined) throw new BadRequestException(`${forbidden} è server-authoritative`);
      }
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione ordine');
      const commercialFields = ['items', 'customerId', 'saleId', 'leadId', 'opportunityId', 'dealId', 'salespersonId', 'discount', 'deposit', 'installments', 'orderDate'];
      const recalculating = commercialFields.some((field) => Object.prototype.hasOwnProperty.call(body, field));
      if (recalculating && current.administrative_status !== 'Bozza') {
        throw new ConflictException('Le condizioni economiche sono modificabili soltanto in Bozza');
      }
      if (recalculating && current.project_id) throw new ConflictException('Ordine già collegato a un progetto');
      if (recalculating) {
        const payments = await context.manager.query(
          `SELECT 1 FROM "${context.user.schema}".payments WHERE order_id=$1 AND deleted_at IS NULL LIMIT 1`,
          [id],
        );
        if (payments[0]) throw new ConflictException('Ordine con pagamenti registrati non ricalcolabile');
      }

      const companyId = body.customerId === undefined ? current.company_id : this.uuid(body.customerId, 'customerId');
      const companies = await context.manager.query(
        `SELECT id FROM "${context.user.schema}".companies WHERE id=$1 AND deleted_at IS NULL FOR SHARE`,
        [companyId],
      );
      if (!companies[0]) throw new BadRequestException('Cliente non disponibile nel tenant');
      const saleId = body.saleId === undefined ? current.sale_id : this.optionalUuid(body.saleId, 'saleId');
      let sale: any = null;
      if (saleId) {
        const sales = await context.manager.query(
          `SELECT * FROM "${context.user.schema}".sales WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
          [saleId],
        );
        sale = sales[0];
        if (!sale || (sale.company_id && sale.company_id !== companyId)) throw new BadRequestException('Vendita sorgente non coerente con il cliente');
        if (sale.order_id && sale.order_id !== id) throw new ConflictException('Vendita già collegata a un altro ordine');
      }
      const leadId = body.leadId === undefined ? (sale?.lead_id || current.lead_id) : this.optionalUuid(body.leadId, 'leadId');
      if (leadId) {
        const leads = await context.manager.query(
          `SELECT 1 FROM "${context.user.schema}".leads WHERE id=$1 AND deleted_at IS NULL`,
          [leadId],
        );
        if (!leads[0]) throw new BadRequestException('Lead non disponibile nel tenant');
      }
      const opportunityId = body.opportunityId === undefined
        ? (sale?.opportunity_id || current.opportunity_id)
        : this.optionalUuid(body.opportunityId, 'opportunityId');
      if (opportunityId) {
        const opportunities = await context.manager.query(
          `SELECT 1 FROM "${context.user.schema}".opportunities
           WHERE id=$1 AND deleted_at IS NULL AND (company_id IS NULL OR company_id=$2)`,
          [opportunityId, companyId],
        );
        if (!opportunities[0]) throw new BadRequestException('Opportunità non coerente con il cliente');
      }
      const salespersonId = body.salespersonId === undefined
        ? current.salesperson_id
        : canAssign ? this.uuid(body.salespersonId, 'salespersonId') : user.id;
      const salesperson = await context.manager.query(
        `SELECT 1 FROM "${context.user.schema}".users WHERE id=$1 AND COALESCE(is_active,true)=true`,
        [salespersonId],
      );
      if (!salesperson[0]) throw new BadRequestException('Commerciale non disponibile nel tenant');

      let calculated = {
        subtotal: Number(current.subtotal || 0),
        taxTotal: Number(current.tax_total || 0),
        total: Number(current.total || 0) + Number(current.discount || 0),
        currency: String(current.currency || 'EUR'),
      };
      const allowManualDiscount = await this.hasCapability(user, 'canManageCommerceRules');
      if (body.items !== undefined) {
        if (!Array.isArray(body.items) || !body.items.length) throw new BadRequestException('items obbligatori');
        await context.manager.query(`UPDATE "${context.user.schema}".order_items SET archived_at=COALESCE(archived_at,now()) WHERE order_id=$1 AND archived_at IS NULL`, [id]);
        calculated = await this.orderItems(context.manager, context.user.schema, id, body.items, allowManualDiscount);
      }
      const orderDiscountCents = this.cents(body.discount === undefined ? current.discount : body.discount, 'discount', 0);
      if (orderDiscountCents > 0 && !allowManualDiscount) throw new ForbiddenException('Sconto ordine non autorizzato');
      const grossTotalCents = this.cents(calculated.total, 'calculated.total');
      if (orderDiscountCents > grossTotalCents) throw new BadRequestException('Sconto ordine superiore al totale');
      const total = this.money(grossTotalCents - orderDiscountCents);
      const deposit = this.number(body.deposit === undefined ? current.deposit : body.deposit, 'deposit', 0);
      if (deposit > total) throw new BadRequestException('Acconto superiore al totale ordine');
      const balance = this.money(this.cents(total, 'total') - this.cents(deposit, 'deposit'));
      const status = body.administrativeStatus === undefined
        ? current.administrative_status
        : this.enum(body.administrativeStatus, ['Bozza', 'Confermato', 'Acconto richiesto', 'Annullato'], 'administrativeStatus', 'Bozza');
      if (status === 'Annullato' && !String(body.cancellationReason || '').trim()) {
        throw new BadRequestException('Motivo annullamento obbligatorio');
      }
      const updated = await context.manager.query(
        `UPDATE "${context.user.schema}".orders SET
          company_id=$2,sale_id=$3,lead_id=$4,opportunity_id=$5,deal_id=$6,salesperson_id=$7,
          currency=$8,discount=$9,subtotal=$10,tax_total=$11,total=$12,deposit=$13,balance=$14,residual=$15,
          installments=$16,order_date=$17,administrative_status=$18,due_date=$19,notes=$20,
          confirmed_at = CASE WHEN $18 <> 'Bozza' THEN COALESCE(confirmed_at, now()) ELSE confirmed_at END,
          cancelled_at = CASE WHEN $18 = 'Annullato' THEN now() ELSE cancelled_at END,
          cancellation_reason = CASE WHEN $18 = 'Annullato' THEN $21 ELSE cancellation_reason END,
          version = version + 1, updated_by = $22, updated_at = now()
         WHERE id = $1 AND version = $23 AND deleted_at IS NULL RETURNING *`,
        [id, companyId, saleId, leadId, opportunityId,
          body.dealId === undefined ? current.deal_id : this.text(body.dealId, 'dealId'), salespersonId,
          calculated.currency, this.money(orderDiscountCents), calculated.subtotal, calculated.taxTotal, total,
          deposit, balance, total,
          body.installments === undefined ? current.installments : Math.max(1, Math.trunc(this.number(body.installments, 'installments', 1))),
          body.orderDate === undefined ? current.order_date : this.text(body.orderDate, 'orderDate', true),
          status, body.dueDate === undefined ? current.due_date : body.dueDate || null,
          body.notes === undefined ? current.notes : body.notes || null,
          body.cancellationReason || null, user.id, version],
      );
      if (!updated[0]) throw new ConflictException('Conflitto di versione ordine');
      if (current.sale_id && current.sale_id !== saleId) {
        await context.manager.query(
          `UPDATE "${context.user.schema}".sales SET order_id=NULL,version=version+1,updated_by=$2,updated_at=now()
           WHERE id=$1 AND order_id=$3`,
          [current.sale_id, user.id, id],
        );
      }
      if (saleId) {
        await context.manager.query(
          `UPDATE "${context.user.schema}".sales SET order_id=$1,company_id=$2,version=version+1,updated_by=$3,updated_at=now()
           WHERE id=$4`,
          [id, companyId, user.id, saleId],
        );
      }
      await this.businessEvent(context, {
        aggregateType: 'order', aggregateId: id,
        eventType: status === 'Annullato' ? 'commerce_order_cancelled' : 'commerce_order_updated',
        before: current, after: updated[0],
        metadata: { status, recalculated: recalculating, reason: body.cancellationReason || null },
      });
      return { id };
    });
    return this.findOrder(id);
  }

  async archiveOrder(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManageOwnOrders');
    const id = this.uuid(idValue, 'id');
    const all = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
    return this.withOperation('order.archive', keyValue, { id, ...body }, async (context) => {
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".orders SET deleted_at = now(),
            version = version + 1, updated_by = $2, updated_at = now()
          WHERE id = $1 AND version = $3 AND deleted_at IS NULL
          ${all ? '' : 'AND salesperson_id = $2'} RETURNING *`,
        [id, user.id, this.version(body.version)],
      );
      if (!rows[0]) throw new ConflictException('Ordine non trovato o versione non aggiornata');
      await this.businessEvent(context, {
        aggregateType: 'order', aggregateId: id,
        eventType: 'commerce_order_archived', after: rows[0],
      });
      return { success: true, version: Number(rows[0].version) };
    });
  }

  async restoreOrder(idValue: string, keyValue: unknown) {
    await this.assertCapability('canManageOwnOrders');
    const id = this.uuid(idValue, 'id');
    return this.withOperation('order.restore', keyValue, { id }, async (context) => {
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".orders SET deleted_at = NULL,
            version = version + 1, updated_by = $2, updated_at = now()
          WHERE id = $1 AND deleted_at IS NOT NULL RETURNING *`,
        [id, context.user.id],
      );
      if (!rows[0]) throw new NotFoundException('Ordine archiviato non trovato');
      await this.businessEvent(context, {
        aggregateType: 'order', aggregateId: id,
        eventType: 'commerce_order_restored', after: rows[0],
      });
      return rows[0];
    });
  }

  private paymentStatus(value: unknown, fallback = 'pending') {
    const normalized = String(value || fallback).trim().toLowerCase();
    const aliases: Record<string, string> = {
      'da confermare': 'pending',
      pending: 'pending',
      recorded: 'recorded',
      confermato: 'confirmed',
      confirmed: 'confirmed',
      fallito: 'failed',
      failed: 'failed',
      annullato: 'cancelled',
      cancelled: 'cancelled',
    };
    const result = aliases[normalized];
    if (!result) throw new BadRequestException('status pagamento non valido');
    return result;
  }

  private paymentMethod(value: unknown) {
    const normalized = String(value || 'other').trim().toLowerCase();
    const aliases: Record<string, string> = {
      bonifico: 'bank_transfer',
      bank_transfer: 'bank_transfer',
      contanti: 'cash',
      cash: 'cash',
      carta: 'card',
      card: 'card',
      paypal: 'paypal',
      stripe: 'stripe',
      altro: 'other',
      other: 'other',
    };
    const result = aliases[normalized];
    if (!result) throw new BadRequestException('metodo pagamento non valido');
    return result;
  }

  private async recalculateOrderEconomics(
    context: OperationContext,
    orderId: string,
  ) {
    const orders = await context.manager.query(
      `SELECT * FROM "${context.user.schema}".orders
        WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [orderId],
    );
    const order = orders[0];
    if (!order) throw new NotFoundException('Ordine non trovato');
    const totals = await context.manager.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (
           WHERE payment_type = 'payment' AND status = 'confirmed' AND deleted_at IS NULL
         ), 0)::numeric AS gross_collected,
         COALESCE(SUM(amount) FILTER (
           WHERE payment_type = 'refund' AND status = 'confirmed' AND deleted_at IS NULL
         ), 0)::numeric AS refunded
       FROM "${context.user.schema}".payments WHERE order_id = $1`,
      [orderId],
    );
    const totalCents = this.cents(order.total, 'order.total');
    const grossCents = this.cents(totals[0].gross_collected, 'gross_collected');
    const refundedCents = this.cents(totals[0].refunded, 'refunded');
    if (refundedCents > grossCents) throw new ConflictException('Il rimborsato supera l’incassato lordo');
    const netCents = Math.max(grossCents - refundedCents, 0);
    const residualCents = Math.max(totalCents - netCents, 0);
    let paymentStatus = 'not_started';
    if (refundedCents > 0 && netCents === 0) paymentStatus = 'refunded';
    else if (refundedCents > 0) paymentStatus = 'refunded_partial';
    else if (totalCents > 0 && residualCents === 0) paymentStatus = 'paid';
    else if (netCents > 0) paymentStatus = 'partial';
    else if (order.due_date && new Date(order.due_date) < new Date()) paymentStatus = 'overdue';
    let administrativeStatus = String(order.administrative_status || 'Bozza');
    if (administrativeStatus !== 'Annullato') {
      administrativeStatus = paymentStatus === 'paid'
        ? 'Pagato'
        : paymentStatus === 'refunded'
          ? 'Rimborsato'
          : ['partial', 'refunded_partial'].includes(paymentStatus)
            ? 'Parzialmente pagato'
            : ['Pagato', 'Rimborsato', 'Parzialmente pagato'].includes(administrativeStatus)
              ? 'Confermato'
              : administrativeStatus;
    }
    const updated = await context.manager.query(
      `UPDATE "${context.user.schema}".orders SET
         gross_collected = $2, refunded_total = $3, net_collected = $4,
         residual = $5, payment_status = $6, administrative_status = $7,
         version = version + 1, updated_by = $8, updated_at = now()
       WHERE id = $1 RETURNING *`,
      [
        orderId,
        this.money(grossCents),
        this.money(refundedCents),
        this.money(netCents),
        this.money(residualCents),
        paymentStatus,
        administrativeStatus,
        context.user.id,
      ],
    );
    if (order.project_id) {
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".project_financial_status
          (project_id, company_id, deposit_required, deposit_paid, balance_required,
           balance_paid, total_expected, total_paid, payment_status, last_payment_at,
           created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,now(),$10,$10)
         ON CONFLICT (project_id) WHERE deleted_at IS NULL DO UPDATE SET
           company_id = EXCLUDED.company_id,
           deposit_required = EXCLUDED.deposit_required,
           deposit_paid = EXCLUDED.deposit_paid,
           balance_required = EXCLUDED.balance_required,
           balance_paid = EXCLUDED.balance_paid,
           total_expected = EXCLUDED.total_expected,
           total_paid = EXCLUDED.total_paid,
           payment_status = EXCLUDED.payment_status,
           last_payment_at = EXCLUDED.last_payment_at,
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
        [
          order.project_id,
          order.company_id,
          Number(order.deposit || 0),
          Math.min(this.money(netCents), Number(order.deposit || 0)),
          Number(order.balance || 0),
          Math.max(this.money(netCents) - Number(order.deposit || 0), 0),
          Number(order.total || 0),
          this.money(netCents),
          paymentStatus === 'partial' || paymentStatus === 'refunded_partial'
            ? 'partially_paid'
            : paymentStatus,
          context.user.id,
        ],
      );
    }
    if (paymentStatus === 'paid' && order.payment_status !== 'paid') {
      await this.businessEvent(context, {
        aggregateType: 'order', aggregateId: orderId,
        eventType: 'commerce_order_paid', before: order, after: updated[0],
        metadata: { message: `Ordine ${order.code} saldato` }, notify: true,
      });
    }
    return updated[0];
  }

  async listPayments() {
    const user = await this.assertAnyCapability('canViewAdministration', 'canManagePayments');
    const schema = await this.ensure();
    const moneyVisible = await this.canViewMoney(user);
    const all = await this.canViewGlobalMoney(user);
    const rows = await this.dataSource.query(
      `SELECT p.* FROM "${schema}".payments p
        JOIN "${schema}".orders o ON o.id = p.order_id
        WHERE p.order_id IS NOT NULL AND p.deleted_at IS NULL
          ${all ? '' : 'AND o.salesperson_id = $1'}
        ORDER BY p.payment_date DESC NULLS LAST, p.created_at DESC`,
      all ? [] : [user.id],
    );
    if (moneyVisible) return { items: rows };
    return {
      items: rows.map(({ amount: _amount, currency: _currency, reference: _reference,
        refund_reason: _reason, notes: _notes, ...row }: any) => row),
      redacted: true,
    };
  }

  async createPayment(body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertAnyCapability('canRecordPayments', 'canManagePayments');
    const all = await this.canViewGlobalMoney(user);
    const key = this.idempotencyKey(keyValue);
    return this.withOperation('payment.create', key, body, async (context) => {
      const orderId = this.uuid(body.orderId, 'orderId');
      const orders = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".orders
          WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [orderId],
      );
      const order = orders[0];
      if (!order) throw new NotFoundException('Ordine non trovato');
      if (!all && order.salesperson_id !== user.id) throw new ForbiddenException('Ordine non autorizzato');
      if (order.administrative_status === 'Annullato') throw new BadRequestException('Ordine annullato non pagabile');
      const amount = this.positiveNumber(body.amount, 'amount');
      const status = this.paymentStatus(body.status, 'pending');
      if (status === 'confirmed' && this.cents(amount, 'amount') > this.cents(order.residual, 'residual')) {
        throw new BadRequestException('Pagamento superiore al residuo ordine');
      }
      const reference = this.text(body.reference, 'reference', true);
      const duplicateReference = await context.manager.query(
        `SELECT 1 FROM "${context.user.schema}".payments
          WHERE order_id = $1 AND lower(reference) = lower($2) AND deleted_at IS NULL LIMIT 1`,
        [orderId, reference],
      );
      if (duplicateReference[0]) throw new ConflictException('Riferimento pagamento già utilizzato per l’ordine');
      const rows = await context.manager.query(
        `INSERT INTO "${context.user.schema}".payments
          (order_id, company_id, project_id, amount, currency, status, payment_type,
           idempotency_key, payment_date, method, reference, notes, version,
           operation_id, correlation_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,'payment',$7,$8,$9,$10,$11,1,$12,$13,$14,$14)
         RETURNING *`,
        [
          orderId, order.company_id, order.project_id || null, amount,
          order.currency, status, key,
          body.effectiveDate || body.date || new Date().toISOString().slice(0, 10),
          this.paymentMethod(body.method), reference, this.text(body.notes, 'notes'),
          context.operationId, context.correlationId, context.user.id,
        ],
      );
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".payment_allocations
          (payment_id, order_id, amount, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$4)`,
        [rows[0].id, orderId, amount, context.user.id],
      );
      const recalculated = await this.recalculateOrderEconomics(context, orderId);
      await this.businessEvent(context, {
        aggregateType: 'payment', aggregateId: rows[0].id,
        eventType: 'commerce_payment_recorded', after: rows[0],
        metadata: { order_id: orderId, order_code: order.code, status,
          message: `Pagamento registrato per ${order.code}` },
        notify: true,
      });
      return { payment: rows[0], order: recalculated };
    });
  }

  async createRefund(body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertAnyCapability('canRecordRefunds', 'canManagePayments');
    const all = await this.canViewGlobalMoney(user);
    const key = this.idempotencyKey(keyValue);
    return this.withOperation('refund.create', key, body, async (context) => {
      const originalPaymentId = this.uuid(body.originalPaymentId, 'originalPaymentId');
      const originalRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".payments
          WHERE id = $1 AND payment_type = 'payment' AND deleted_at IS NULL FOR UPDATE`,
        [originalPaymentId],
      );
      const original = originalRows[0];
      if (!original || original.status !== 'confirmed') {
        throw new BadRequestException('Il pagamento originale deve essere confermato');
      }
      const orderId = this.uuid(original.order_id, 'orderId');
      const orders = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".orders
          WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [orderId],
      );
      const order = orders[0];
      if (!order) throw new NotFoundException('Ordine del pagamento non trovato');
      if (!all && order.salesperson_id !== user.id) throw new ForbiddenException('Ordine non autorizzato');
      const amount = this.positiveNumber(body.amount, 'amount');
      const reserved = await context.manager.query(
        `SELECT COALESCE(SUM(amount),0)::numeric AS total
           FROM "${context.user.schema}".payments
          WHERE original_payment_id = $1 AND payment_type = 'refund'
            AND status NOT IN ('failed','cancelled') AND deleted_at IS NULL`,
        [originalPaymentId],
      );
      if (this.cents(reserved[0].total, 'reserved') + this.cents(amount, 'amount') > this.cents(original.amount, 'original.amount')) {
        throw new BadRequestException('Importo rimborso superiore al residuo rimborsabile');
      }
      const reason = this.text(body.refundReason || body.reason, 'refundReason', true);
      const status = this.paymentStatus(body.status, 'pending');
      const reference = this.text(body.reference, 'reference', true);
      const duplicateReference = await context.manager.query(
        `SELECT 1 FROM "${context.user.schema}".payments
          WHERE order_id = $1 AND lower(reference) = lower($2) AND deleted_at IS NULL LIMIT 1`,
        [orderId, reference],
      );
      if (duplicateReference[0]) throw new ConflictException('Riferimento rimborso già utilizzato per l’ordine');
      const rows = await context.manager.query(
        `INSERT INTO "${context.user.schema}".payments
          (order_id, company_id, project_id, amount, currency, status, payment_type,
           original_payment_id, idempotency_key, refund_reason, payment_date, method,
           reference, notes, version, operation_id, correlation_id, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$5,$6,'refund',$7,$8,$9,$10,$11,$12,$13,1,$14,$15,$16,$16)
         RETURNING *`,
        [
          orderId, original.company_id, original.project_id, amount, original.currency,
          status, originalPaymentId, key, reason,
          body.effectiveDate || body.date || new Date().toISOString().slice(0, 10),
          this.paymentMethod(body.method || original.method), reference,
          this.text(body.notes, 'notes'), context.operationId, context.correlationId,
          context.user.id,
        ],
      );
      await context.manager.query(
        `INSERT INTO "${context.user.schema}".payment_allocations
          (payment_id, order_id, amount, created_by, updated_by)
         VALUES ($1,$2,$3,$4,$4)`,
        [rows[0].id, orderId, amount, context.user.id],
      );
      const recalculated = await this.recalculateOrderEconomics(context, orderId);
      await this.businessEvent(context, {
        aggregateType: 'refund', aggregateId: rows[0].id,
        eventType: 'commerce_refund_recorded', after: rows[0],
        metadata: { order_id: orderId, original_payment_id: originalPaymentId,
          status, message: `Rimborso registrato per ${order.code}` },
        notify: true,
      });
      return { refund: rows[0], order: recalculated };
    });
  }

  async updatePayment(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManagePayments');
    const all = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
    const id = this.uuid(idValue, 'id');
    return this.withOperation('payment.update', keyValue, { id, ...body }, async (context) => {
      const currentRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".payments
          WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      );
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Movimento economico non trovato');
      const authorizedOrder = await context.manager.query(
        `SELECT salesperson_id FROM "${context.user.schema}".orders WHERE id = $1 AND deleted_at IS NULL`,
        [current.order_id],
      );
      if (!authorizedOrder[0] || (!all && authorizedOrder[0].salesperson_id !== user.id)) {
        throw new ForbiddenException('Movimento economico non autorizzato');
      }
      if (current.status === 'confirmed') throw new BadRequestException('Un movimento confermato è immutabile');
      const version = this.version(body.version);
      if (Number(current.version) !== version) throw new ConflictException('Conflitto di versione pagamento');
      if (body.amount !== undefined && this.number(body.amount, 'amount') !== Number(current.amount)) {
        throw new BadRequestException('L’importo del movimento è immutabile');
      }
      const status = body.status === undefined ? current.status : this.paymentStatus(body.status);
      if (status === 'confirmed') {
        const orderRows = await context.manager.query(
          `SELECT residual FROM "${context.user.schema}".orders WHERE id = $1 FOR UPDATE`,
          [current.order_id],
        );
        if (current.payment_type === 'payment' && this.cents(current.amount, 'amount') > this.cents(orderRows[0]?.residual, 'residual')) {
          throw new BadRequestException('Pagamento superiore al residuo ordine');
        }
      }
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".payments SET
           status = $2, payment_date = COALESCE($3, payment_date),
           method = COALESCE($4, method), notes = COALESCE($5, notes),
           version = version + 1, operation_id = $6, correlation_id = $7,
           updated_by = $8, updated_at = now()
         WHERE id = $1 AND version = $9 AND deleted_at IS NULL RETURNING *`,
        [id, status, body.effectiveDate || body.date || null,
          body.method ? this.paymentMethod(body.method) : null,
          body.notes === undefined ? null : this.text(body.notes, 'notes'),
          context.operationId, context.correlationId, context.user.id, version],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione pagamento');
      const order = await this.recalculateOrderEconomics(context, current.order_id);
      await this.businessEvent(context, {
        aggregateType: current.payment_type === 'refund' ? 'refund' : 'payment',
        aggregateId: id, eventType: 'commerce_payment_updated',
        before: current, after: rows[0], metadata: { order_id: current.order_id, status },
      });
      return { payment: rows[0], order };
    });
  }

  async archivePayment(idValue: string, body: Record<string, any>, keyValue: unknown) {
    const user = await this.assertCapability('canManagePayments');
    const all = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
    const id = this.uuid(idValue, 'id');
    return this.withOperation('payment.archive', keyValue, { id, ...body }, async (context) => {
      const currentRows = await context.manager.query(
        `SELECT * FROM "${context.user.schema}".payments WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
        [id],
      );
      const current = currentRows[0];
      if (!current) throw new NotFoundException('Movimento economico non trovato');
      const authorizedOrder = await context.manager.query(
        `SELECT salesperson_id FROM "${context.user.schema}".orders WHERE id = $1 AND deleted_at IS NULL`,
        [current.order_id],
      );
      if (!authorizedOrder[0] || (!all && authorizedOrder[0].salesperson_id !== user.id)) {
        throw new ForbiddenException('Movimento economico non autorizzato');
      }
      if (current.status === 'confirmed') throw new BadRequestException('Un movimento confermato non può essere archiviato');
      const rows = await context.manager.query(
        `UPDATE "${context.user.schema}".payments SET deleted_at = now(),
           version = version + 1, updated_by = $2, updated_at = now()
         WHERE id = $1 AND version = $3 AND deleted_at IS NULL RETURNING *`,
        [id, context.user.id, this.version(body.version)],
      );
      if (!rows[0]) throw new ConflictException('Conflitto di versione pagamento');
      await context.manager.query(
        `UPDATE "${context.user.schema}".payment_allocations SET deleted_at = now(),
           version = version + 1, updated_by = $2, updated_at = now()
         WHERE payment_id = $1 AND deleted_at IS NULL`,
        [id, context.user.id],
      );
      const order = await this.recalculateOrderEconomics(context, current.order_id);
      await this.businessEvent(context, {
        aggregateType: current.payment_type === 'refund' ? 'refund' : 'payment',
        aggregateId: id, eventType: 'commerce_payment_archived',
        before: current, after: rows[0], metadata: { order_id: current.order_id },
      });
      return { success: true, order };
    });
  }

  async economicsSummary(query: Record<string, any> = {}) {
    const user = await this.assertAnyCapability('canViewAdministration', 'canViewCommercialValues');
    if (!(await this.canViewMoney(user))) throw new ForbiddenException('Valori economici non autorizzati');
    const schema = await this.ensure();
    const all = await this.canViewGlobalMoney(user);
    const salespersonId = all && query.salespersonId
      ? this.uuid(query.salespersonId, 'salespersonId')
      : all ? null : user.id;
    const start = query.start ? String(query.start) : null;
    const end = query.end ? String(query.end) : null;
    const rows = await this.dataSource.query(
      `SELECT
         COALESCE((SELECT SUM(value) FROM "${schema}".sales
           WHERE status = 'Vinta' AND deleted_at IS NULL
             AND ($1::date IS NULL OR sale_date >= $1::date)
             AND ($2::date IS NULL OR sale_date <= $2::date)
             ${salespersonId ? 'AND salesperson_id = $3' : ''}),0)::numeric AS sold,
         COUNT(*)::int AS order_count,
         COALESCE(SUM(total),0)::numeric AS ordered,
         COALESCE(SUM(gross_collected),0)::numeric AS gross_collected,
         COALESCE(SUM(refunded_total),0)::numeric AS refunded,
         COALESCE(SUM(net_collected),0)::numeric AS net_collected,
         COALESCE(SUM(residual),0)::numeric AS residual,
         COUNT(*) FILTER (WHERE residual > 0 AND administrative_status <> 'Annullato')::int AS open_orders,
         COUNT(DISTINCT company_id) FILTER (WHERE net_collected > 0)::int AS paying_customers
       FROM "${schema}".orders
       WHERE deleted_at IS NULL
         AND ($1::date IS NULL OR order_date >= $1::date)
         AND ($2::date IS NULL OR order_date <= $2::date)
         ${salespersonId ? 'AND salesperson_id = $3' : ''}`,
      salespersonId ? [start, end, salespersonId] : [start, end],
    );
    const trend = await this.dataSource.query(
      `SELECT to_char(date_trunc('month', order_date), 'YYYY-MM') AS period,
              COALESCE(SUM(total),0)::numeric AS ordered,
              COALESCE(SUM(net_collected),0)::numeric AS net_collected,
              COALESCE(SUM(refunded_total),0)::numeric AS refunded
         FROM "${schema}".orders
        WHERE deleted_at IS NULL
          AND ($1::date IS NULL OR order_date >= $1::date)
          AND ($2::date IS NULL OR order_date <= $2::date)
          ${salespersonId ? 'AND salesperson_id = $3' : ''}
        GROUP BY date_trunc('month', order_date)
        ORDER BY date_trunc('month', order_date)`,
      salespersonId ? [start, end, salespersonId] : [start, end],
    );
    return { ...rows[0], trend };
  }

  async customerEconomics(companyIdValue: string) {
    const user = await this.assertAnyCapability('canViewAdministration', 'canViewCommercialValues');
    if (!(await this.canViewMoney(user))) throw new ForbiddenException('Valori economici non autorizzati');
    const schema = await this.ensure();
    const companyId = this.uuid(companyIdValue, 'companyId');
    const canViewAllRecords = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
    const globalMoney = await this.canViewGlobalMoney(user);
    if (!canViewAllRecords) {
      const visible = await this.dataSource.query(
        `SELECT 1 FROM "${schema}".companies c
          WHERE c.id = $1 AND c.deleted_at IS NULL
            AND (c.owner_user_id = $2
              OR EXISTS (SELECT 1 FROM "${schema}".orders o WHERE o.company_id = c.id AND o.salesperson_id = $2 AND o.deleted_at IS NULL)
              OR EXISTS (SELECT 1 FROM "${schema}".sales s WHERE s.company_id = c.id AND s.salesperson_id = $2 AND s.deleted_at IS NULL))
          LIMIT 1`,
        [companyId, user.id],
      );
      if (!visible[0]) throw new ForbiddenException('Cliente non autorizzato');
    }
    const summary = await this.dataSource.query(
      `SELECT COUNT(*)::int AS order_count, COALESCE(SUM(total),0)::numeric AS ordered,
              COALESCE(SUM(gross_collected),0)::numeric AS gross_collected,
              COALESCE(SUM(refunded_total),0)::numeric AS refunded,
              COALESCE(SUM(net_collected),0)::numeric AS net_collected,
              COALESCE(SUM(residual),0)::numeric AS residual
         FROM "${schema}".orders WHERE company_id = $1 AND deleted_at IS NULL
            ${globalMoney ? '' : 'AND salesperson_id = $2'}`,
      globalMoney ? [companyId] : [companyId, user.id],
    );
    const [sales, orders, payments, projects] = await Promise.all([
      this.dataSource.query(`SELECT * FROM "${schema}".sales WHERE company_id = $1 AND deleted_at IS NULL ${globalMoney ? '' : 'AND salesperson_id = $2'} ORDER BY created_at DESC`, globalMoney ? [companyId] : [companyId, user.id]),
      this.dataSource.query(`SELECT * FROM "${schema}".orders WHERE company_id = $1 AND deleted_at IS NULL ${globalMoney ? '' : 'AND salesperson_id = $2'} ORDER BY created_at DESC`, globalMoney ? [companyId] : [companyId, user.id]),
      this.dataSource.query(`SELECT p.* FROM "${schema}".payments p JOIN "${schema}".orders o ON o.id = p.order_id WHERE p.company_id = $1 AND p.deleted_at IS NULL ${globalMoney ? '' : 'AND o.salesperson_id = $2'} ORDER BY p.created_at DESC`, globalMoney ? [companyId] : [companyId, user.id]),
      this.dataSource.query(`SELECT DISTINCT p.id, p.name, p.status, p.order_id FROM "${schema}".projects p LEFT JOIN "${schema}".orders o ON o.project_id = p.id AND o.deleted_at IS NULL WHERE p.company_id = $1 AND p.deleted_at IS NULL ${globalMoney ? '' : `AND (p.owner_id = $2 OR o.salesperson_id = $2 OR EXISTS (SELECT 1 FROM "${schema}".project_members m WHERE m.project_id = p.id AND m.user_id = $2))`} ORDER BY p.name`, globalMoney ? [companyId] : [companyId, user.id]),
    ]);
    return { summary: summary[0], sales, orders, payments, projects };
  }

  async projectEconomics(projectIdValue: string) {
    const user = await this.assertAnyCapability('canViewAdministration', 'canViewCommercialValues');
    if (!(await this.canViewMoney(user))) throw new ForbiddenException('Valori economici non autorizzati');
    const schema = await this.ensure();
    const projectId = this.uuid(projectIdValue, 'projectId');
    const canViewAllRecords = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
    const globalMoney = await this.canViewGlobalMoney(user);
    if (!canViewAllRecords) {
      const visible = await this.dataSource.query(
        `SELECT 1 FROM "${schema}".projects p
          WHERE p.id = $1 AND p.deleted_at IS NULL
            AND (p.owner_id = $2 OR EXISTS (SELECT 1 FROM "${schema}".project_members m WHERE m.project_id = p.id AND m.user_id = $2)
              OR EXISTS (SELECT 1 FROM "${schema}".orders o WHERE o.project_id = p.id AND o.salesperson_id = $2 AND o.deleted_at IS NULL))
          LIMIT 1`,
        [projectId, user.id],
      );
      if (!visible[0]) throw new ForbiddenException('Progetto non autorizzato');
    }
    const orders = await this.dataSource.query(
      `SELECT * FROM "${schema}".orders WHERE project_id = $1 AND deleted_at IS NULL ${globalMoney ? '' : 'AND salesperson_id = $2'} ORDER BY created_at DESC`,
      globalMoney ? [projectId] : [projectId, user.id],
    );
    const payments = await this.dataSource.query(
      `SELECT p.* FROM "${schema}".payments p JOIN "${schema}".orders o ON o.id = p.order_id WHERE p.project_id = $1 AND p.deleted_at IS NULL ${globalMoney ? '' : 'AND o.salesperson_id = $2'} ORDER BY p.created_at DESC`,
      globalMoney ? [projectId] : [projectId, user.id],
    );
    const deadlines = globalMoney || orders.length > 0 ? await this.dataSource.query(
      `SELECT id, title, type, status, amount, currency, due_date
         FROM "${schema}".financial_deadlines WHERE project_id = $1 AND deleted_at IS NULL
         ORDER BY due_date`,
      [projectId],
    ) : [];
    const totalCents = orders.reduce((sum: number, order: any) => sum + this.cents(order.total, 'total'), 0);
    const grossCents = orders.reduce((sum: number, order: any) => sum + this.cents(order.gross_collected, 'gross'), 0);
    const refundCents = orders.reduce((sum: number, order: any) => sum + this.cents(order.refunded_total, 'refund'), 0);
    const netCents = Math.max(grossCents - refundCents, 0);
    return {
      summary: {
        total: this.money(totalCents), grossCollected: this.money(grossCents),
        refunded: this.money(refundCents), netCollected: this.money(netCents),
        residual: this.money(Math.max(totalCents - netCents, 0)),
        status: orders.length === 0 ? 'not_started' : orders.every((order: any) => order.payment_status === 'paid') ? 'paid' : orders.some((order: any) => Number(order.net_collected) > 0) ? 'partial' : 'not_started',
      },
      orders, payments, deadlines,
    };
  }

  async history(aggregateType: string, aggregateIdValue: string) {
    await this.assertAnyCapability('canViewSales', 'canViewOrders', 'canViewAdministration');
    const schema = await this.ensure();
    const aggregateId = this.uuid(aggregateIdValue, 'aggregateId');
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".commerce_history
        WHERE aggregate_type = $1 AND aggregate_id = $2 ORDER BY created_at DESC LIMIT 500`,
      [String(aggregateType || '').trim(), aggregateId],
    );
    return { items: rows };
  }

  async generateOrderProject(idValue: string, keyValue: unknown) {
    const user = await this.assertAnyCapability('canGenerateProjectFromOrder', 'canManageOwnOrders');
    const id = this.uuid(idValue, 'id');
    const key = this.idempotencyKey(keyValue);
    const all = ['owner', 'admin'].includes(user.role) || await this.assertCanViewAll(user);
    const response = await this.withOperation('order.generate_project', key, { id }, async (context) => {
      const rows = await context.manager.query(
        `SELECT o.*, oi.service_name_snapshot AS service_name, s.project_template_type,
                s.project_template_phases, c.name AS company_name
           FROM "${context.user.schema}".orders o
           JOIN "${context.user.schema}".order_items oi ON oi.order_id = o.id AND oi.archived_at IS NULL
           JOIN "${context.user.schema}".services s ON s.id = oi.service_id
           JOIN "${context.user.schema}".companies c ON c.id = o.company_id
          WHERE o.id = $1 AND o.deleted_at IS NULL
            ${all ? '' : 'AND o.salesperson_id = $2'}
          ORDER BY oi.created_at LIMIT 1 FOR UPDATE OF o`,
        all ? [id] : [id, user.id],
      );
      const order = rows[0];
      if (!order) throw new NotFoundException('Ordine non trovato o non autorizzato');
      if (order.administrative_status === 'Annullato') throw new BadRequestException('Ordine annullato');
      if (order.project_id) {
        return { ok: true, projectId: String(order.project_id), existing: true };
      }
      const workspace = await this.delivery.createProject(
        {
          company_id: order.company_id,
          lead_id: order.lead_id || undefined,
          opportunity_id: order.opportunity_id || undefined,
          order_id: id,
          source_event_id: `order:${id}`,
          name: `${order.service_name} · ${order.company_name}`,
          description: `Progetto generato esplicitamente dall’ordine ${order.code}.`,
          type: order.project_template_type || 'other',
          status: 'onboarding',
          priority: 'medium',
          phases: (Array.isArray(order.project_template_phases) ? order.project_template_phases : [])
            .map((title: string, index: number) => ({ key: `phase-${index}`, title, sort_order: index, weight: 1 })),
        },
        `commerce:${key}`,
      );
      const projectId = String((workspace as any)?.project?.id || (workspace as any)?.id || '');
      if (!UUID_RE.test(projectId)) throw new ConflictException('Delivery Core non ha restituito un progetto valido');
      await context.manager.query(
        `UPDATE "${context.user.schema}".orders SET project_id = $2,
           version = version + 1, updated_by = $3, updated_at = now() WHERE id = $1`,
        [id, projectId, context.user.id],
      );
      await context.manager.query(
        `UPDATE "${context.user.schema}".sales SET project_id = $2,
           version = version + 1, updated_by = $3, updated_at = now()
         WHERE order_id = $1 AND deleted_at IS NULL`,
        [id, projectId, context.user.id],
      );
      await this.recalculateOrderEconomics(context, id);
      await this.businessEvent(context, {
        aggregateType: 'order', aggregateId: id,
        eventType: 'commerce_order_project_generated',
        after: { project_id: projectId },
        metadata: { project_id: projectId, message: `Progetto generato da ${order.code}` },
        notify: true,
      });
      return { ok: true, projectId, existing: (workspace as any)?.unchanged === true };
    });
    return response;
  }

  async listCampaigns() {
    await this.assertCapability('canViewCampaigns');
    const schema = await this.ensure();
    const [campaigns, groups, ads] = await Promise.all([
      this.dataSource.query(`SELECT * FROM "${schema}".campaigns WHERE deleted_at IS NULL ORDER BY starts_at DESC, created_at DESC`),
      this.dataSource.query(`SELECT * FROM "${schema}".campaign_ad_groups ORDER BY created_at`),
      this.dataSource.query(`SELECT * FROM "${schema}".campaign_ads ORDER BY created_at`),
    ]);
    return {
      items: campaigns.map((campaign: any) => ({
        ...campaign,
        ad_groups: groups
          .filter((group: any) => group.campaign_id === campaign.id)
          .map((group: any) => ({
            ...group,
            ads: ads.filter((ad: any) => ad.ad_group_id === group.id),
          })),
      })),
      attributionModel: 'last_non_direct',
      adapters: [
        { provider: 'Meta Lead Ads', enabled: false, reason: 'Credenziali provider non configurate' },
        { provider: 'Google Ads', enabled: false, reason: 'Credenziali provider non configurate' },
      ],
    };
  }

  private campaignValues(body: Record<string, any>, partial: boolean) {
    const values: Record<string, unknown> = {};
    const add = (field: string, value: unknown, source = field) => {
      if (!partial || body[source] !== undefined) values[field] = value;
    };
    add('name', this.text(body.name, 'name', !partial));
    add('channel', this.enum(body.channel, CAMPAIGN_CHANNELS, 'channel', 'Manuale'));
    add('account', this.text(body.account, 'account', !partial));
    add('status', this.enum(body.status, CAMPAIGN_STATUSES, 'status', 'draft'));
    add('starts_at', this.text(body.startsAt, 'startsAt', !partial), 'startsAt');
    add('ends_at', this.text(body.endsAt, 'endsAt'), 'endsAt');
    add('spend', this.number(body.spend, 'spend', 0));
    add('impressions', Math.trunc(this.number(body.impressions, 'impressions', 0)));
    add('clicks', Math.trunc(this.number(body.clicks, 'clicks', 0)));
    const impressions = Number(values.impressions ?? body.impressions ?? 0);
    const clicks = Number(values.clicks ?? body.clicks ?? 0);
    if (clicks > impressions) throw new BadRequestException('clicks non può superare impressions');
    return values;
  }

  private async replaceCampaignGroups(manager: EntityManager, schema: string, campaignId: string, adGroups: unknown) {
    if (adGroups === undefined) return;
    await manager.query(`DELETE FROM "${schema}".campaign_ad_groups WHERE campaign_id = $1`, [campaignId]);
    for (const group of Array.isArray(adGroups) ? adGroups : []) {
      const groupId = group.id ? this.uuid(group.id, 'adGroup.id') : String((await manager.query(`SELECT uuid_generate_v4() AS id`))[0].id);
      await manager.query(
        `INSERT INTO "${schema}".campaign_ad_groups (id, campaign_id, name, status) VALUES ($1, $2, $3, $4)`,
        [groupId, campaignId, this.text(group.name, 'adGroup.name', true), this.enum(group.status, AD_STATUSES, 'adGroup.status', 'active')],
      );
      for (const ad of Array.isArray(group.ads) ? group.ads : []) {
        await manager.query(
          `INSERT INTO "${schema}".campaign_ads (id, ad_group_id, name, status)
           VALUES (COALESCE($1::uuid, uuid_generate_v4()), $2, $3, $4)`,
          [ad.id ? this.uuid(ad.id, 'ad.id') : null, groupId, this.text(ad.name, 'ad.name', true), this.enum(ad.status, AD_STATUSES, 'ad.status', 'active')],
        );
      }
    }
  }

  async createCampaign(body: Record<string, any>) {
    const user = await this.assertCapability('canManageCampaigns');
    const schema = await this.ensure();
    const id = body.id ? this.uuid(body.id, 'id') : null;
    const campaignId = await this.dataSource.transaction(async (manager) => {
      const values = this.campaignValues(body, false);
      const entries = Object.entries(values);
      const rows = await manager.query(
        `INSERT INTO "${schema}".campaigns (id, ${entries.map(([field]) => field).join(', ')}, created_by, updated_by)
         VALUES (COALESCE($1::uuid, uuid_generate_v4()), ${entries.map((_, index) => `$${index + 2}`).join(', ')}, $${entries.length + 2}, $${entries.length + 2}) RETURNING id`,
        [id, ...entries.map(([, value]) => value), user.id],
      );
      const savedId = String(rows[0].id);
      await this.replaceCampaignGroups(manager, schema, savedId, body.adGroups);
      await this.audit(manager, user, 'commerce_campaign_created', savedId, { attributionModel: 'last_non_direct' });
      return savedId;
    });
    return (await this.listCampaigns()).items.find((item: any) => item.id === campaignId);
  }

  async updateCampaign(idValue: string, body: Record<string, any>) {
    const user = await this.assertCapability('canManageCampaigns');
    const schema = await this.ensure();
    const id = this.uuid(idValue, 'id');
    await this.dataSource.transaction(async (manager) => {
      const values = this.campaignValues(body, true);
      const entries = Object.entries(values).filter(([, value]) => value !== undefined);
      if (entries.length) {
        const rows = await manager.query(
          `UPDATE "${schema}".campaigns SET ${entries.map(([field], index) => `${field} = $${index + 1}`).join(', ')}, updated_by = $${entries.length + 1}, updated_at = now()
           WHERE id = $${entries.length + 2} AND deleted_at IS NULL RETURNING id`,
          [...entries.map(([, value]) => value), user.id, id],
        );
        if (!rows[0]) throw new NotFoundException('Campagna non trovata');
      }
      await this.replaceCampaignGroups(manager, schema, id, body.adGroups);
      await this.audit(manager, user, 'commerce_campaign_updated', id);
    });
    return (await this.listCampaigns()).items.find((item: any) => item.id === id);
  }

  async archiveCampaign(idValue: string) {
    const user = await this.assertCapability('canManageCampaigns');
    const schema = await this.ensure();
    const id = this.uuid(idValue, 'id');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".campaigns SET status = 'archived', deleted_at = now(), updated_by = $2, updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL RETURNING id`,
      [id, user.id],
    );
    if (!rows[0]) throw new NotFoundException('Campagna non trovata');
    await this.audit(this.dataSource, user, 'commerce_campaign_archived', id);
    return { success: true };
  }
}
