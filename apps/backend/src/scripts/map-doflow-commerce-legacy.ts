import 'reflect-metadata';
import { DataSource } from 'typeorm';

export type CommerceLegacyMapOptions = { target: 'doflow'; apply: boolean; confirm?: string };
export type CommerceLegacyInventory = {
  services: number;
  sales: number;
  orders: number;
  orderItems: number;
  completeSnapshots: number;
  incompleteSnapshots: number;
  payments: number;
  refunds: number;
  allocations: number;
  ambiguousOrderLinks: number;
  orphanPayments: number;
};

export function parseCommerceLegacyMapOptions(args: string[]): CommerceLegacyMapOptions {
  const target = args.find((arg) => arg.startsWith('--target='))?.slice('--target='.length);
  if (target !== 'doflow') throw new Error('Legacy Commerce mapping target must be exactly doflow');
  return {
    target: 'doflow',
    apply: args.includes('--apply'),
    confirm: args.find((arg) => arg.startsWith('--confirm='))?.slice('--confirm='.length),
  };
}

export function buildCommerceLegacyMapReport(inventory: CommerceLegacyInventory) {
  return {
    target: 'doflow' as const,
    counts: inventory,
    eligibleSnapshotLocks: inventory.completeSnapshots,
    ambiguousCount: inventory.incompleteSnapshots + inventory.ambiguousOrderLinks + inventory.orphanPayments,
    preservation: ['service.id', 'sale.id', 'order.id', 'order.company_id', 'order.project_id', 'payment.id'],
    interpretedInvoicesAsOrders: false,
    inventedPayments: false,
    inventedRefunds: false,
    inventedSnapshots: false,
    accountChanges: false,
  };
}

function databaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required');
  const parsed = new URL(value);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('Commerce legacy mapping refuses a non-local PostgreSQL host');
  }
  return value;
}

export function assertCommerceApplySafety(options: CommerceLegacyMapOptions) {
  if (!options.apply) return;
  if (process.env.NODE_ENV !== 'test' || String(process.env.DB_SYNC).toLowerCase() !== 'false') {
    throw new Error('Apply is allowed only with NODE_ENV=test and DB_SYNC=false');
  }
  if (options.confirm !== 'isolated-doflow-commerce-map') throw new Error('Apply confirmation is missing');
}

export function returnedRowCount(result: unknown) {
  if (!Array.isArray(result)) return 0;
  if (result.length === 2 && Array.isArray(result[0]) && typeof result[1] === 'number') {
    return result[0].length;
  }
  return result.length;
}

export async function inventoryDoflowCommerceLegacy(dataSource: DataSource): Promise<CommerceLegacyInventory> {
  const rows = await dataSource.query(`
    SELECT
      (SELECT COUNT(*) FROM doflow.services WHERE deleted_at IS NULL)::int AS services,
      (SELECT COUNT(*) FROM doflow.sales WHERE deleted_at IS NULL)::int AS sales,
      (SELECT COUNT(*) FROM doflow.orders WHERE deleted_at IS NULL)::int AS orders,
      (SELECT COUNT(*) FROM doflow.order_items)::int AS order_items,
      (SELECT COUNT(*) FROM doflow.order_items
        WHERE service_name_snapshot IS NOT NULL AND currency_snapshot IS NOT NULL
          AND catalog_version_snapshot IS NOT NULL AND unit_price_snapshot IS NOT NULL
          AND tax_rate_snapshot IS NOT NULL AND line_total IS NOT NULL)::int AS complete_snapshots,
      (SELECT COUNT(*) FROM doflow.order_items
        WHERE service_name_snapshot IS NULL OR currency_snapshot IS NULL
          OR catalog_version_snapshot IS NULL OR unit_price_snapshot IS NULL
          OR tax_rate_snapshot IS NULL OR line_total IS NULL)::int AS incomplete_snapshots,
      (SELECT COUNT(*) FROM doflow.payments WHERE payment_type = 'payment' AND deleted_at IS NULL)::int AS payments,
      (SELECT COUNT(*) FROM doflow.payments WHERE payment_type = 'refund' AND deleted_at IS NULL)::int AS refunds,
      (SELECT COUNT(*) FROM doflow.payment_allocations WHERE deleted_at IS NULL)::int AS allocations,
      (SELECT COUNT(*) FROM doflow.orders o WHERE o.deleted_at IS NULL AND o.sale_id IS NOT NULL
        AND NOT EXISTS (SELECT 1 FROM doflow.sales s WHERE s.id = o.sale_id))::int AS ambiguous_order_links,
      (SELECT COUNT(*) FROM doflow.payments p WHERE p.deleted_at IS NULL
        AND NOT EXISTS (SELECT 1 FROM doflow.orders o WHERE o.id = p.order_id))::int AS orphan_payments
  `);
  const row = rows[0] || {};
  return {
    services: Number(row.services || 0), sales: Number(row.sales || 0), orders: Number(row.orders || 0),
    orderItems: Number(row.order_items || 0), completeSnapshots: Number(row.complete_snapshots || 0),
    incompleteSnapshots: Number(row.incomplete_snapshots || 0), payments: Number(row.payments || 0),
    refunds: Number(row.refunds || 0), allocations: Number(row.allocations || 0),
    ambiguousOrderLinks: Number(row.ambiguous_order_links || 0), orphanPayments: Number(row.orphan_payments || 0),
  };
}

export async function mapDoflowCommerceLegacy(
  dataSource: DataSource,
  options: CommerceLegacyMapOptions,
) {
  const before = await inventoryDoflowCommerceLegacy(dataSource);
  let appliedCount = 0;
  if (options.apply) {
    await dataSource.transaction(async (manager) => {
      const result = await manager.query(`
        UPDATE doflow.order_items
           SET immutable_at = created_at
         WHERE immutable_at IS NULL
           AND service_name_snapshot IS NOT NULL AND currency_snapshot IS NOT NULL
           AND catalog_version_snapshot IS NOT NULL AND unit_price_snapshot IS NOT NULL
           AND tax_rate_snapshot IS NOT NULL AND line_total IS NOT NULL
        RETURNING id
      `);
      appliedCount = returnedRowCount(result);
    });
  }
  return {
    ...buildCommerceLegacyMapReport(before),
    mode: options.apply ? 'apply' as const : 'dry-run' as const,
    appliedCount,
  };
}

export async function runCommerceLegacyMap(options: CommerceLegacyMapOptions) {
  assertCommerceApplySafety(options);
  const dataSource = new DataSource({ type: 'postgres', url: databaseUrl(), synchronize: false });
  await dataSource.initialize();
  try {
    const output = await mapDoflowCommerceLegacy(dataSource, options);
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
    return output;
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) {
  runCommerceLegacyMap(parseCommerceLegacyMapOptions(process.argv.slice(2))).catch((error) => {
    process.stderr.write(`[commerce:legacy-map] ${error instanceof Error ? error.message : 'failed'}\n`);
    process.exitCode = 1;
  });
}
