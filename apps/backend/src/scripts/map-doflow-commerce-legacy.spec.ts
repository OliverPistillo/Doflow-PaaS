import {
  assertCommerceApplySafety,
  buildCommerceLegacyMapReport,
  parseCommerceLegacyMapOptions,
  returnedRowCount,
} from './map-doflow-commerce-legacy';

describe('Doflow Commerce legacy mapper', () => {
  const inventory = {
    services: 2, sales: 1, orders: 1, orderItems: 2, completeSnapshots: 1,
    incompleteSnapshots: 1, payments: 1, refunds: 0, allocations: 1,
    ambiguousOrderLinks: 0, orphanPayments: 0,
  };

  it('requires the exact tenant and an explicit apply', () => {
    expect(parseCommerceLegacyMapOptions(['--target=doflow'])).toEqual({ target: 'doflow', apply: false, confirm: undefined });
    expect(() => parseCommerceLegacyMapOptions(['--target=other'])).toThrow('exactly doflow');
  });

  it('reports ambiguous snapshots without inventing economic records', () => {
    expect(buildCommerceLegacyMapReport(inventory)).toMatchObject({
      ambiguousCount: 1, inventedPayments: false, inventedRefunds: false,
      inventedSnapshots: false, interpretedInvoicesAsOrders: false, accountChanges: false,
    });
  });

  it('guards apply behind isolated test confirmation', () => {
    const previousNodeEnv = process.env.NODE_ENV;
    const previousSync = process.env.DB_SYNC;
    process.env.NODE_ENV = 'test';
    process.env.DB_SYNC = 'false';
    expect(() => assertCommerceApplySafety({ target: 'doflow', apply: true })).toThrow('confirmation');
    expect(() => assertCommerceApplySafety({ target: 'doflow', apply: true, confirm: 'isolated-doflow-commerce-map' })).not.toThrow();
    process.env.NODE_ENV = previousNodeEnv;
    process.env.DB_SYNC = previousSync;
  });

  it('counts PostgreSQL UPDATE RETURNING rows without treating TypeORM metadata as changes', () => {
    expect(returnedRowCount([[], 0])).toBe(0);
    expect(returnedRowCount([[{ id: 'one' }], 1])).toBe(1);
  });
});
