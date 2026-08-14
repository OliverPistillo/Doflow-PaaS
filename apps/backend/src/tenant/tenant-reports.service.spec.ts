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

  it('salesReport aggrega alias commerciali doflow senza mescolare quote accepted', async () => {
    const service = new TenantReportsService(
      { query: jest.fn().mockResolvedValue([]) } as any,
      { user: { sub: '11111111-1111-4111-8111-111111111111', role: 'owner', tenantId: 'doflow' } },
    );
    jest.spyOn(service as any, 'doflowLeadCommercialStageCounts').mockResolvedValue({ new: 2, lost: 1 });
    jest.spyOn(service as any, 'tableExists').mockResolvedValue(true);
    const countRows = jest.spyOn(service as any, 'countRows') as jest.Mock;
    countRows.mockImplementation(async (...args: unknown[]) => {
      const table = String(args[1]);
      const where = String(args[2]);
      if (table === 'opportunities' && where.includes("= 'lost'")) return 1;
      if (table === 'opportunities' && where.includes('= ANY') && where.includes('stage')) return where.includes('updated_at') ? 0 : 1;
      if (table === 'quotes' && where.includes("= 'accepted'")) return 7;
      if (table === 'quotes' && where.includes("= 'rejected'")) return 3;
      return 0;
    });
    jest.spyOn(service as any, 'sumRows').mockResolvedValue(0);
    (jest.spyOn(service as any, 'groupCount') as jest.Mock).mockImplementation(async (...args: unknown[]) => {
      const table = String(args[1]);
      const column = String(args[2]);
      if (table === 'opportunities' && column === 'stage') {
        return { new_lead: 2, to_contact: 1, briefing_sent: 3, accepted: 4 };
      }
      return {};
    });
    (jest.spyOn(service as any, 'groupSum') as jest.Mock).mockImplementation(async (...args: unknown[]) => (
      String(args[1]) === 'opportunities' ? { quote_sent: 100, follow_up: 50 } : {}
    ));
    jest.spyOn(service as any, 'recentRows').mockResolvedValue([{ id: 'opportunity-1', stage: 'quote_sent' }]);

    const result = await (service as any).salesReport(
      'doflow',
      { id: '11111111-1111-4111-8111-111111111111', role: 'owner' },
      { dateFrom: '2026-08-01', dateTo: '2026-08-31', groupBy: 'month', comparePrevious: false },
      {},
    );

    expect(result.openLeads).toBe(2);
    expect(result.opportunitiesByStage).toEqual({ new: 3, qualified: 3, closed_won: 4 });
    expect(result.pipelineValueByStage).toEqual({ quote: 150 });
    expect(result.topOpportunities[0].stage).toBe('quote');
    expect(result.acceptedQuotes).toBe(7);
    const activeCall = countRows.mock.calls.find(([, table, where]) => table === 'opportunities' && String(where).includes('= ANY'));
    expect((activeCall?.[3] as unknown[])?.[0]).toEqual(expect.arrayContaining(['new', 'new_lead', 'briefing_sent', 'appointment', 'quote']));
  });
});
