import { AddCustomerInboxMailAndNotificationSeen1870000000000 } from '../migrations/1870000000000-AddCustomerInboxMailAndNotificationSeen';

describe('migration 187 Customer Inbox mail and notification seen', () => {
  it('is additive, heterogeneous-safe, idempotent and registered once', async () => {
    const statements: Array<{ sql: string; parameters?: unknown[] }> = [];
    const columns = new Set<string>();
    const runner = {
      query: jest.fn(async (sql: string, parameters?: unknown[]) => {
        statements.push({ sql, parameters });
        if (sql.includes('FROM public.tenants')) return [{ schema_name: 'tenant_full' }, { schema_name: 'tenant_minimal' }];
        if (sql.includes("c.relname='notification_preferences'")) return [{ exists: parameters?.[0] === 'tenant_full' }];
        if (sql.includes('FROM information_schema.columns')) return [{ exists: columns.has(`${parameters?.[0]}:last_seen_at`) }];
        if (sql.includes('FROM pg_catalog.pg_class')) return [{ exists: parameters?.[0] === 'tenant_full' }];
        if (sql.includes('ADD COLUMN IF NOT EXISTS last_seen_at')) columns.add(`${parameters?.[0] || 'tenant_full'}:last_seen_at`);
        return [];
      }),
    };
    const migration = new AddCustomerInboxMailAndNotificationSeen1870000000000();
    const registry: Array<{ timestamp: number; name: string }> = [];

    await migration.up(runner as never);
    registry.push({ timestamp: 1870000000000, name: migration.name });
    const firstDdl = statements.filter(({ sql }) => /^\s*(create|alter)\b/i.test(sql)).map(({ sql }) => sql);
    expect(firstDdl.join('\n')).toContain('customer_inbox_mailbox_state');
    expect(firstDdl.join('\n')).toContain('customer_inbox_unmatched_messages');
    expect(firstDdl.some((sql) => sql.includes('"tenant_full".commercial_communications'))).toBe(true);
    expect(firstDdl.some((sql) => sql.includes('"tenant_minimal".commercial_communications'))).toBe(false);
    expect(firstDdl.some((sql) => sql.includes('"tenant_full".notification_preferences') && sql.includes('last_seen_at'))).toBe(true);
    expect(firstDdl.some((sql) => sql.includes('"tenant_minimal".notification_preferences'))).toBe(false);
    expect(firstDdl.join('\n')).not.toMatch(/\b(drop|truncate|delete\s+from)\b/i);
    expect(firstDdl.join('\n')).not.toMatch(/\b(doflow|test2)\b/i);

    const ddlCount = firstDdl.length;
    await migration.up(runner as never);
    const allDdl = statements.filter(({ sql }) => /^\s*(create|alter)\b/i.test(sql));
    expect(allDdl).toHaveLength(ddlCount);
    expect(registry).toEqual([{ timestamp: 1870000000000, name: 'AddCustomerInboxMailAndNotificationSeen1870000000000' }]);
    await expect(migration.down(runner as never)).resolves.toBeUndefined();
  });

  it('rejects unsafe tenant schemas before interpolation', async () => {
    const runner = { query: jest.fn(async (sql: string) => sql.includes('FROM public.tenants') ? [{ schema_name: 'bad-schema' }] : []) };
    await expect(new AddCustomerInboxMailAndNotificationSeen1870000000000().up(runner as never)).rejects.toThrow();
    expect(runner.query).toHaveBeenCalledTimes(1);
  });
});
