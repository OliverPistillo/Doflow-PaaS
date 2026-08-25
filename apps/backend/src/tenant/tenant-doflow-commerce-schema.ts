import { DataSource } from 'typeorm';
import { provisionSchemaOnce } from '../common/schema-provisioning-once';
import { safeSchema } from '../common/schema.utils';
import { isDoflowTenant } from './tenant-context';
import { ensureTenantFinanceTables } from './tenant-finance-schema';

async function addColumns(
  dataSource: DataSource,
  schema: string,
  table: string,
  columns: string[],
) {
  for (const column of columns) {
    await dataSource.query(
      `ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${column}`,
    );
  }
}

async function provisionDoflowCommerceTables(
  dataSource: DataSource,
  schema: string,
) {
  const safe = safeSchema(schema, 'ensureDoflowCommerceTables');
  if (!isDoflowTenant(safe)) {
    throw new Error('Doflow commerce schema is tenant-specific');
  }
  await dataSource.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".service_categories (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      sort_order INTEGER NOT NULL DEFAULT 0,
      active BOOLEAN NOT NULL DEFAULT true,
      version BIGINT NOT NULL DEFAULT 1,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".services (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      category_id UUID REFERENCES "${safe}".service_categories(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      price NUMERIC(18,2) NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EUR',
      unit TEXT NOT NULL DEFAULT 'unit',
      tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0,
      billing_type TEXT NOT NULL DEFAULT 'one_time',
      sort_order INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      availability TEXT NOT NULL DEFAULT 'available',
      deposit NUMERIC NOT NULL DEFAULT 0,
      balance NUMERIC NOT NULL DEFAULT 0,
      installments INTEGER NOT NULL DEFAULT 1,
      renewal_enabled BOOLEAN NOT NULL DEFAULT false,
      renewal_interval TEXT NOT NULL DEFAULT 'annual',
      renewal_price NUMERIC NOT NULL DEFAULT 0,
      project_template_name TEXT,
      project_template_type TEXT,
      project_template_phases TEXT[] NOT NULL DEFAULT '{}',
      version BIGINT NOT NULL DEFAULT 1,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(dataSource, safe, 'services', [
    'category_id UUID',
    "currency TEXT NOT NULL DEFAULT 'EUR'",
    "unit TEXT NOT NULL DEFAULT 'unit'",
    'tax_rate NUMERIC(7,4) NOT NULL DEFAULT 0',
    "billing_type TEXT NOT NULL DEFAULT 'one_time'",
    'sort_order INTEGER NOT NULL DEFAULT 0',
    'version BIGINT NOT NULL DEFAULT 1',
  ]);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".service_promotions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      service_id UUID NOT NULL REFERENCES "${safe}".services(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      kind TEXT NOT NULL,
      value NUMERIC(18,2) NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      valid_from TIMESTAMPTZ,
      valid_until TIMESTAMPTZ,
      minimum_quantity NUMERIC(18,4),
      maximum_quantity NUMERIC(18,4),
      maximum_discount NUMERIC(18,2),
      combinable BOOLEAN NOT NULL DEFAULT false,
      version BIGINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(dataSource, safe, 'service_promotions', [
    'valid_from TIMESTAMPTZ',
    'valid_until TIMESTAMPTZ',
    'minimum_quantity NUMERIC(18,4)',
    'maximum_quantity NUMERIC(18,4)',
    'maximum_discount NUMERIC(18,2)',
    'combinable BOOLEAN NOT NULL DEFAULT false',
    'version BIGINT NOT NULL DEFAULT 1',
    'updated_at TIMESTAMPTZ NOT NULL DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".service_extras (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      service_id UUID NOT NULL REFERENCES "${safe}".services(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      price NUMERIC(18,2) NOT NULL,
      active BOOLEAN NOT NULL DEFAULT true,
      version BIGINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(dataSource, safe, 'service_extras', [
    'version BIGINT NOT NULL DEFAULT 1',
    'updated_at TIMESTAMPTZ NOT NULL DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".service_billing_plans (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      service_id UUID NOT NULL REFERENCES "${safe}".services(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      one_time_price NUMERIC NOT NULL DEFAULT 0,
      recurring_price NUMERIC NOT NULL DEFAULT 0,
      recurrence TEXT NOT NULL DEFAULT 'annual',
      renewal TEXT NOT NULL DEFAULT 'optional',
      included TEXT[] NOT NULL DEFAULT '{}',
      active BOOLEAN NOT NULL DEFAULT true,
      version BIGINT NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(dataSource, safe, 'service_billing_plans', [
    'version BIGINT NOT NULL DEFAULT 1',
    'deleted_at TIMESTAMPTZ',
  ]);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".sales (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID,
      lead_id UUID,
      opportunity_id UUID,
      service_id UUID NOT NULL REFERENCES "${safe}".services(id),
      salesperson_id UUID NOT NULL,
      origin TEXT NOT NULL,
      value NUMERIC NOT NULL,
      cost NUMERIC,
      currency TEXT NOT NULL DEFAULT 'EUR',
      sale_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'Bozza',
      deal_id TEXT NOT NULL,
      order_id UUID,
      project_id UUID,
      notes TEXT,
      version BIGINT NOT NULL DEFAULT 1,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(dataSource, safe, 'sales', [
    'opportunity_id UUID',
    "currency TEXT NOT NULL DEFAULT 'EUR'",
    'version BIGINT NOT NULL DEFAULT 1',
  ]);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".sale_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      sale_id UUID NOT NULL REFERENCES "${safe}".sales(id) ON DELETE CASCADE,
      service_id UUID NOT NULL REFERENCES "${safe}".services(id),
      plan_id UUID,
      quantity NUMERIC(18,4) NOT NULL DEFAULT 1,
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".orders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      idempotency_key TEXT,
      code TEXT NOT NULL UNIQUE,
      company_id UUID NOT NULL,
      sale_id UUID REFERENCES "${safe}".sales(id) ON DELETE SET NULL,
      lead_id UUID,
      opportunity_id UUID,
      deal_id TEXT,
      salesperson_id UUID NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      discount NUMERIC(18,2) NOT NULL DEFAULT 0,
      subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
      tax_total NUMERIC(18,2) NOT NULL DEFAULT 0,
      total NUMERIC(18,2) NOT NULL DEFAULT 0,
      deposit NUMERIC(18,2) NOT NULL DEFAULT 0,
      balance NUMERIC(18,2) NOT NULL DEFAULT 0,
      gross_collected NUMERIC(18,2) NOT NULL DEFAULT 0,
      refunded_total NUMERIC(18,2) NOT NULL DEFAULT 0,
      net_collected NUMERIC(18,2) NOT NULL DEFAULT 0,
      residual NUMERIC(18,2) NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'not_started',
      installments INTEGER NOT NULL DEFAULT 1,
      project_id UUID,
      administrative_status TEXT NOT NULL DEFAULT 'Bozza',
      version BIGINT NOT NULL DEFAULT 1,
      order_date DATE NOT NULL,
      due_date DATE,
      notes TEXT,
      confirmed_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      cancellation_reason TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(dataSource, safe, 'orders', [
    'lead_id UUID',
    'opportunity_id UUID',
    "currency TEXT NOT NULL DEFAULT 'EUR'",
    'tax_total NUMERIC(18,2) NOT NULL DEFAULT 0',
    'gross_collected NUMERIC(18,2) NOT NULL DEFAULT 0',
    'refunded_total NUMERIC(18,2) NOT NULL DEFAULT 0',
    'net_collected NUMERIC(18,2) NOT NULL DEFAULT 0',
    'residual NUMERIC(18,2) NOT NULL DEFAULT 0',
    "payment_status TEXT NOT NULL DEFAULT 'not_started'",
    'version BIGINT NOT NULL DEFAULT 1',
    'confirmed_at TIMESTAMPTZ',
    'cancelled_at TIMESTAMPTZ',
    'cancellation_reason TEXT',
  ]);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".order_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      order_id UUID NOT NULL REFERENCES "${safe}".orders(id) ON DELETE CASCADE,
      service_id UUID NOT NULL REFERENCES "${safe}".services(id),
      service_name_snapshot TEXT NOT NULL,
      service_description_snapshot TEXT NOT NULL DEFAULT '',
      service_category_snapshot TEXT NOT NULL DEFAULT '',
      variant_name_snapshot TEXT,
      quantity NUMERIC NOT NULL,
      unit_price_snapshot NUMERIC NOT NULL,
      discount NUMERIC NOT NULL DEFAULT 0,
      tax_rate_snapshot NUMERIC(7,4) NOT NULL DEFAULT 0,
      tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0,
      currency_snapshot TEXT NOT NULL DEFAULT 'EUR',
      catalog_version_snapshot BIGINT NOT NULL DEFAULT 1,
      promotion_snapshot JSONB,
      extras_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb,
      plan_id UUID,
      plan_name_snapshot TEXT,
      one_time_price_snapshot NUMERIC,
      recurring_price_snapshot NUMERIC,
      first_period_total NUMERIC,
      renewal_price_snapshot NUMERIC,
      recurrence TEXT,
      renewal_required BOOLEAN,
      included_snapshot TEXT[] NOT NULL DEFAULT '{}',
      next_due_at DATE,
      line_subtotal NUMERIC(18,2) NOT NULL DEFAULT 0,
      line_total NUMERIC NOT NULL,
      immutable_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await addColumns(dataSource, safe, 'order_items', [
    "service_description_snapshot TEXT NOT NULL DEFAULT ''",
    "service_category_snapshot TEXT NOT NULL DEFAULT ''",
    'variant_name_snapshot TEXT',
    'tax_rate_snapshot NUMERIC(7,4) NOT NULL DEFAULT 0',
    'tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0',
    "currency_snapshot TEXT NOT NULL DEFAULT 'EUR'",
    'catalog_version_snapshot BIGINT NOT NULL DEFAULT 1',
    'promotion_snapshot JSONB',
    "extras_snapshot JSONB NOT NULL DEFAULT '[]'::jsonb",
    'line_subtotal NUMERIC(18,2) NOT NULL DEFAULT 0',
    'immutable_at TIMESTAMPTZ NOT NULL DEFAULT now()',
  ]);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".commerce_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      aggregate_type TEXT NOT NULL,
      aggregate_id UUID NOT NULL,
      event_type TEXT NOT NULL,
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      actor_id UUID,
      before_state JSONB,
      after_state JSONB,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".commerce_idempotency (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      actor_id UUID NOT NULL,
      operation TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      request_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      response_payload JSONB,
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    )
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".commerce_outbox (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      aggregate_type TEXT NOT NULL,
      aggregate_id UUID NOT NULL,
      event_type TEXT NOT NULL,
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      processed_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".campaigns (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      channel TEXT NOT NULL,
      account TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      starts_at DATE NOT NULL,
      ends_at DATE,
      spend NUMERIC NOT NULL DEFAULT 0,
      impressions BIGINT NOT NULL DEFAULT 0,
      clicks BIGINT NOT NULL DEFAULT 0,
      attribution_model TEXT NOT NULL DEFAULT 'last_non_direct',
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".campaign_ad_groups (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      campaign_id UUID NOT NULL REFERENCES "${safe}".campaigns(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".campaign_ads (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ad_group_id UUID NOT NULL REFERENCES "${safe}".campaign_ad_groups(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await dataSource.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${safe}_orders_idempotency" ON "${safe}".orders(idempotency_key) WHERE idempotency_key IS NOT NULL AND deleted_at IS NULL`,
  );
  await dataSource.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${safe}_service_categories_name" ON "${safe}".service_categories(lower(name)) WHERE deleted_at IS NULL`,
  );
  await dataSource.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${safe}_commerce_idempotency" ON "${safe}".commerce_idempotency(actor_id, operation, idempotency_key)`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_commerce_history_aggregate" ON "${safe}".commerce_history(aggregate_type, aggregate_id, created_at DESC)`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_commerce_outbox_pending" ON "${safe}".commerce_outbox(status, available_at)`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_sales_company" ON "${safe}".sales(company_id, sale_date DESC) WHERE deleted_at IS NULL`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_sales_owner" ON "${safe}".sales(salesperson_id, sale_date DESC) WHERE deleted_at IS NULL`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_orders_company" ON "${safe}".orders(company_id, order_date DESC) WHERE deleted_at IS NULL`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_orders_owner" ON "${safe}".orders(salesperson_id, order_date DESC) WHERE deleted_at IS NULL`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_order_items_order" ON "${safe}".order_items(order_id)`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_campaigns_dates" ON "${safe}".campaigns(starts_at, ends_at) WHERE deleted_at IS NULL`,
  );
  await dataSource.query(
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_campaign_groups" ON "${safe}".campaign_ad_groups(campaign_id)`,
  );

  await ensureTenantFinanceTables(dataSource, safe);
  await addColumns(dataSource, safe, 'payments', [
    'version BIGINT NOT NULL DEFAULT 1',
    'provider TEXT',
    'provider_reference TEXT',
    'operation_id UUID',
    'correlation_id UUID',
  ]);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".payment_allocations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      payment_id UUID NOT NULL REFERENCES "${safe}".payments(id),
      order_id UUID NOT NULL REFERENCES "${safe}".orders(id),
      amount NUMERIC(18,2) NOT NULL,
      version BIGINT NOT NULL DEFAULT 1,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await dataSource.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${safe}_payment_allocation" ON "${safe}".payment_allocations(payment_id, order_id) WHERE deleted_at IS NULL`,
  );
}

export function ensureDoflowCommerceTables(
  dataSource: DataSource,
  schema: string,
): Promise<void> {
  const safe = safeSchema(schema, 'ensureDoflowCommerceTables');
  return provisionSchemaOnce(dataSource, `doflow-commerce:${safe}`, () =>
    provisionDoflowCommerceTables(dataSource, safe),
  );
}
