import { ensureTenantCallTables } from './tenant-calls-schema';

describe('tenant calls additive schema', () => {
  it('is tenant-qualified, idempotent and contains no destructive operation', async () => {
    const statements: string[] = [];
    const source = { query: jest.fn(async (sql: string) => { statements.push(sql); return []; }) };
    await ensureTenantCallTables(source as never, 'tenant_a');
    const sql = statements.join('\n');
    expect(sql).toContain('"tenant_a".tenant_call_sessions');
    expect(sql).toContain('desktop_call_room_index');
    expect(sql).toContain('desktop_call_guest_invite_index');
    expect(sql).toContain('tenant_call_user_locks');
    expect(sql).toContain('idx_tenant_call_user_locks_call');
    expect(sql).not.toMatch(/tenant_call_user_locks\s*\([^)]*call_id UUID NOT NULL UNIQUE/s);
    expect(sql).toContain('tenant_call_activities');
    expect(sql).toContain('to_regclass');
    expect(sql).toContain('CREATE UNIQUE INDEX IF NOT EXISTS');
    expect(sql).not.toContain('CREATE TABLE IF NOT EXISTS "tenant_a".commercial_activities');
    expect(sql).not.toMatch(/\bDROP\s+(TABLE|SCHEMA)\b|\bTRUNCATE\b/i);
    expect(sql).not.toContain('tenant_b');
  });
});
