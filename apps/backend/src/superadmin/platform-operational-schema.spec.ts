import { ensurePlatformOperationalTables } from './platform-operational-schema';

describe('platform operational schema', () => {
  it('crea in modo additivo tutte le tabelle control-plane richieste con DB_SYNC=false', async () => {
    const executor = { query: jest.fn().mockResolvedValue(undefined) };

    await ensurePlatformOperationalTables(executor);

    const sql = executor.query.mock.calls.map(([statement]) => statement).join('\n');
    for (const table of [
      'invoices', 'invoice_line_items', 'platform_deals', 'support_tickets',
      'system_backups', 'platform_notifications', 'changelog_entries', 'automation_rules',
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
    }
    expect(sql).not.toMatch(/\b(?:DROP|TRUNCATE)\b/i);
  });
});
