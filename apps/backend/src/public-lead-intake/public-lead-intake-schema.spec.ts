import { ensureLeadIntakeSubmissionsTable } from './public-lead-intake-schema';

describe('ensureLeadIntakeSubmissionsTable', () => {
  it('crea form_data sui nuovi database e aggiorna le tabelle esistenti in modo idempotente', async () => {
    const query = jest.fn().mockResolvedValue([]);

    await ensureLeadIntakeSubmissionsTable({ query } as any, 'doflow');

    const statements = query.mock.calls.map(([sql]) => String(sql).replace(/\s+/g, ' ').trim());
    const createTable = statements.find((sql) => sql.includes('CREATE TABLE IF NOT EXISTS "doflow".lead_intake_submissions'));
    const alterTable = statements.find((sql) => sql.includes('ALTER TABLE "doflow".lead_intake_submissions'));

    expect(createTable).toContain("form_data JSONB NOT NULL DEFAULT '{}'::jsonb");
    expect(alterTable).toContain("ADD COLUMN IF NOT EXISTS form_data JSONB NOT NULL DEFAULT '{}'::jsonb");
  });
});
