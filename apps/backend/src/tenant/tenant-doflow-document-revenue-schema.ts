import { DataSource } from 'typeorm';
import { provisionSchemaOnce } from '../common/schema-provisioning-once';
import { safeSchema } from '../common/schema.utils';
import { isDoflowTenant } from './tenant-context';
import { ensureTenantBriefingQuoteTables } from './tenant-briefing-quotes-schema';
import { ensureTenantContractsTables } from './tenant-contracts-schema';
import { ensureDoflowCommerceTables } from './tenant-doflow-commerce-schema';

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

/**
 * Conservative, additive closure of the tables already used by quotes,
 * contracts and finance. Commerce entities, payments and projects remain the
 * canonical Phase 3A/Delivery tables: this function never creates a parallel
 * order, payment or project model.
 */
async function provisionDoflowDocumentRevenueTables(
  dataSource: DataSource,
  schema: string,
) {
  const safe = safeSchema(schema, 'ensureDoflowDocumentRevenueTables');
  if (!isDoflowTenant(safe)) {
    throw new Error('Doflow document revenue schema is tenant-specific');
  }

  await ensureTenantBriefingQuoteTables(dataSource, safe);
  await ensureTenantContractsTables(dataSource, safe);
  await ensureDoflowCommerceTables(dataSource, safe);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".document_artifacts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      aggregate_type TEXT NOT NULL,
      aggregate_id UUID NOT NULL,
      version_number INTEGER NOT NULL DEFAULT 1,
      kind TEXT NOT NULL DEFAULT 'immutable_snapshot',
      status TEXT NOT NULL DEFAULT 'ready',
      content_type TEXT NOT NULL DEFAULT 'application/json',
      content_hash TEXT NOT NULL,
      snapshot JSONB NOT NULL,
      storage_file_id UUID,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(aggregate_type, aggregate_id, version_number, kind)
    )
  `);

  await addColumns(dataSource, safe, 'quotes', [
    'lead_id UUID',
    'sale_id UUID',
    'order_id UUID',
    'optimistic_version BIGINT NOT NULL DEFAULT 1',
    'artifact_id UUID',
    'archived_at TIMESTAMPTZ',
    'authority_managed BOOLEAN NOT NULL DEFAULT false',
  ]);
  await addColumns(dataSource, safe, 'quote_items', [
    'service_id UUID',
    'service_name_snapshot TEXT',
    'service_description_snapshot TEXT',
    "currency_snapshot TEXT NOT NULL DEFAULT 'EUR'",
    'catalog_version_snapshot BIGINT NOT NULL DEFAULT 1',
    'line_subtotal NUMERIC(18,2) NOT NULL DEFAULT 0',
    'tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0',
    'immutable_at TIMESTAMPTZ NOT NULL DEFAULT now()',
  ]);

  await addColumns(dataSource, safe, 'contracts', [
    'order_id UUID',
    'source_quote_version_id UUID',
    'current_version_id UUID',
    'parent_contract_id UUID',
    'replaced_by_id UUID',
    'optimistic_version BIGINT NOT NULL DEFAULT 1',
    'artifact_id UUID',
    'authority_managed BOOLEAN NOT NULL DEFAULT false',
  ]);
  await addColumns(dataSource, safe, 'contract_versions', [
    'previous_version_id UUID',
    'replaced_by_version_id UUID',
    "snapshot JSONB NOT NULL DEFAULT '{}'::jsonb",
    'artifact_id UUID',
    'artifact_hash TEXT',
    'replaced_at TIMESTAMPTZ',
  ]);
  await addColumns(dataSource, safe, 'contract_signers', [
    'contract_version_id UUID',
  ]);

  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".contract_send_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NOT NULL REFERENCES "${safe}".contracts(id) ON DELETE CASCADE,
      contract_version_id UUID NOT NULL REFERENCES "${safe}".contract_versions(id) ON DELETE RESTRICT,
      method TEXT NOT NULL,
      event_kind TEXT NOT NULL,
      note TEXT,
      provider_status TEXT NOT NULL DEFAULT 'not_configured',
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      actor_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(operation_id)
    )
  `);
  await dataSource.query(`
    CREATE TABLE IF NOT EXISTS "${safe}".contract_signature_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NOT NULL REFERENCES "${safe}".contracts(id) ON DELETE CASCADE,
      contract_version_id UUID NOT NULL REFERENCES "${safe}".contract_versions(id) ON DELETE RESTRICT,
      signer_id UUID NOT NULL REFERENCES "${safe}".contract_signers(id) ON DELETE RESTRICT,
      signer_type TEXT NOT NULL,
      method TEXT NOT NULL DEFAULT 'internal_record',
      external_reference TEXT,
      artifact_hash TEXT,
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      actor_id UUID,
      signed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(contract_version_id, signer_id),
      UNIQUE(operation_id)
    )
  `);

  await addColumns(dataSource, safe, 'invoices', [
    'parent_invoice_id UUID',
    'credit_reason TEXT',
    'optimistic_version BIGINT NOT NULL DEFAULT 1',
    'artifact_id UUID',
    'authority_managed BOOLEAN NOT NULL DEFAULT false',
    'archived_at TIMESTAMPTZ',
  ]);
  await addColumns(dataSource, safe, 'invoice_items', [
    'order_item_id UUID',
    'service_id UUID',
    'service_name_snapshot TEXT',
    'service_description_snapshot TEXT',
    "currency_snapshot TEXT NOT NULL DEFAULT 'EUR'",
    'catalog_version_snapshot BIGINT NOT NULL DEFAULT 1',
    'line_subtotal NUMERIC(18,2) NOT NULL DEFAULT 0',
    'tax_amount NUMERIC(18,2) NOT NULL DEFAULT 0',
    'immutable_at TIMESTAMPTZ NOT NULL DEFAULT now()',
  ]);

  await addColumns(dataSource, safe, 'recurring_services', [
    'source_order_id UUID',
    'source_order_item_id UUID',
    'source_contract_id UUID',
    'service_id UUID',
    'plan_id UUID',
    'plan_name_snapshot TEXT',
    'included_snapshot TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]',
    'renewal_required BOOLEAN NOT NULL DEFAULT false',
    'activated_at TIMESTAMPTZ',
    "management_mode TEXT NOT NULL DEFAULT 'manual'",
    'owner_user_id UUID',
    'salesperson_id UUID',
    'optimistic_version BIGINT NOT NULL DEFAULT 1',
    'authority_managed BOOLEAN NOT NULL DEFAULT false',
  ]);
  await addColumns(dataSource, safe, 'renewals', [
    'source_order_id UUID',
    'source_order_item_id UUID',
    'renewal_order_id UUID',
    'renewal_payment_id UUID',
    "recurrence TEXT NOT NULL DEFAULT 'annual'",
    'renewal_required BOOLEAN NOT NULL DEFAULT false',
    "included_snapshot TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]",
    'activated_at TIMESTAMPTZ',
    "management_mode TEXT NOT NULL DEFAULT 'manual'",
    'owner_user_id UUID',
    'salesperson_id UUID',
    'optimistic_version BIGINT NOT NULL DEFAULT 1',
    'authority_managed BOOLEAN NOT NULL DEFAULT false',
  ]);

  const indexes = [
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_document_artifacts_aggregate" ON "${safe}".document_artifacts(aggregate_type, aggregate_id, version_number DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_quotes_order" ON "${safe}".quotes(order_id) WHERE order_id IS NOT NULL AND deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_quote_items_service" ON "${safe}".quote_items(service_id) WHERE service_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${safe}_contracts_authority_order" ON "${safe}".contracts(order_id) WHERE authority_managed AND order_id IS NOT NULL AND deleted_at IS NULL AND replaced_by_id IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_contract_versions_previous" ON "${safe}".contract_versions(previous_version_id) WHERE previous_version_id IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_contract_send_contract" ON "${safe}".contract_send_events(contract_id, created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_contract_signature_contract" ON "${safe}".contract_signature_events(contract_id, signed_at DESC)`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${safe}_invoices_authority_number" ON "${safe}".invoices(lower(invoice_number)) WHERE authority_managed AND invoice_number IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${safe}_invoices_authority_order" ON "${safe}".invoices(order_id) WHERE authority_managed AND type <> 'credit_note' AND order_id IS NOT NULL AND deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${safe}_invoices_parent" ON "${safe}".invoices(parent_invoice_id) WHERE parent_invoice_id IS NOT NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${safe}_recurring_source_item" ON "${safe}".recurring_services(source_order_item_id) WHERE authority_managed AND source_order_item_id IS NOT NULL AND deleted_at IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${safe}_renewals_source_item" ON "${safe}".renewals(source_order_item_id) WHERE authority_managed AND source_order_item_id IS NOT NULL AND deleted_at IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${safe}_renewals_order" ON "${safe}".renewals(renewal_order_id) WHERE renewal_order_id IS NOT NULL AND deleted_at IS NULL`,
  ];
  for (const statement of indexes) await dataSource.query(statement);
}

export function ensureDoflowDocumentRevenueTables(
  dataSource: DataSource,
  schema: string,
): Promise<void> {
  const safe = safeSchema(schema, 'ensureDoflowDocumentRevenueTables');
  return provisionSchemaOnce(
    dataSource,
    `doflow-document-revenue:${safe}`,
    () => provisionDoflowDocumentRevenueTables(dataSource, safe),
  );
}
