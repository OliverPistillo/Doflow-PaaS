import { seedTenantKpiTargets } from './tenant-reports-schema';
import { TenantReportsService } from './tenant-reports.service';

describe('Tenant reports KPI targets', () => {
  function makeKpiTargetQueryMock() {
    const targets = new Map<string, { id: string; label: string; targetValue: number; metadata?: string }>();
    let idCounter = 0;

    const keyFromParams = (params: unknown[]) => [params[0], params[1], params[2] ?? '', params[3] ?? ''].join(':');
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      const compact = sql.replace(/\s+/g, ' ').trim();

      if (compact.includes('SELECT id FROM "doflow".kpi_targets')) {
        const existing = targets.get(keyFromParams(params));
        return existing ? [{ id: existing.id }] : [];
      }

      if (compact.includes('INSERT INTO "doflow".kpi_targets')) {
        idCounter += 1;
        const key = [params[0], params[3], params[4] ?? '', params[5] ?? ''].join(':');
        targets.set(key, {
          id: `00000000-0000-4000-8000-${String(idCounter).padStart(12, '0')}`,
          label: String(params[1]),
          targetValue: Number(params[2]),
          metadata: String(params[6] || ''),
        });
        return [];
      }

      if (compact.includes('UPDATE "doflow".kpi_targets') && compact.includes('WHERE id = $1')) {
        const id = String(params[0]);
        const existingKey = [...targets.entries()].find(([, value]) => value.id === id)?.[0];
        if (existingKey) {
          targets.set(existingKey, {
            id,
            label: String(params[1]),
            targetValue: Number(params[2]),
            metadata: String(params[3] || ''),
          });
        }
        return [];
      }

      return [];
    });

    return { query, targets };
  }

  it('seedTenantKpiTargets crea i 6 target base senza INSERT fragile', async () => {
    const { query, targets } = makeKpiTargetQueryMock();

    const result = await seedTenantKpiTargets({ query } as any, 'doflow', '11111111-1111-4111-8111-111111111111');

    expect(result).toEqual({ created: 6, updated: 0, total: 6 });
    expect(targets.size).toBe(6);
    expect([...targets.keys()]).toEqual(expect.arrayContaining([
      'monthly_new_leads:monthly::',
      'quote_acceptance_rate:monthly::',
      'monthly_revenue:monthly::',
      'overdue_tasks_max:monthly::',
      'overdue_invoices_max:monthly::',
      'billable_hours_monthly:monthly::',
    ]));
    expect(query.mock.calls.some(([sql]) => String(sql).includes('WHERE NOT EXISTS'))).toBe(false);
  });

  it('seedTenantKpiTargets è idempotente alla seconda chiamata', async () => {
    const { query, targets } = makeKpiTargetQueryMock();

    await seedTenantKpiTargets({ query } as any, 'doflow');
    const secondRun = await seedTenantKpiTargets({ query } as any, 'doflow');

    expect(secondRun).toEqual({ created: 0, updated: 6, total: 6 });
    expect(targets.size).toBe(6);
  });

  it('summary espone il conteggio dei KPI target configurati', async () => {
    const service = new TenantReportsService(
      { query: jest.fn().mockResolvedValue([]) } as any,
      { user: { sub: '11111111-1111-4111-8111-111111111111', role: 'owner', tenantId: 'doflow' } },
    );

    jest.spyOn(service as any, 'ensureSchema').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'salesReport').mockResolvedValue({ newLeadsInPeriod: 0, acceptedQuotes: 0 });
    jest.spyOn(service as any, 'projectsReport').mockResolvedValue({ projectRisks: [], overdueTasks: 0 });
    jest.spyOn(service as any, 'operationsReport').mockResolvedValue({ openRisks: [] });
    jest.spyOn(service as any, 'financeReport').mockResolvedValue({ topUnpaidInvoices: [], paymentsInPeriod: 0 });
    jest.spyOn(service as any, 'baseEnvelope').mockResolvedValue({ tenant: { schema: 'doflow' } });
    jest.spyOn(service as any, 'logActivity').mockResolvedValue(undefined);
    jest.spyOn(service as any, 'lastSnapshotAt').mockResolvedValue(null);
    jest.spyOn(service as any, 'countRows').mockImplementation(async (...args: unknown[]) => (String(args[1]) === 'kpi_targets' ? 6 : 0));

    const summary = await service.summary({});

    expect(summary.kpiTargetsConfigured).toBe(6);
  });
});
