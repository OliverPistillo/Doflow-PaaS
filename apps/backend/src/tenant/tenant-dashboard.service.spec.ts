import { TenantDashboardService } from './tenant-dashboard.service';

describe('TenantDashboardService pipelineStages', () => {
  function makeService(rows: any[]) {
    const dataSource = { query: jest.fn().mockResolvedValue(rows) };
    const service = new TenantDashboardService(dataSource as any, {} as any, { user: { sub: 'user-1', role: 'owner', tenantId: 'doflow' } } as any);
    jest.spyOn(service as any, 'tableExists').mockResolvedValue(true);
    jest.spyOn(service as any, 'columnExists').mockResolvedValue(true);
    jest.spyOn(service as any, 'isNumericColumn').mockResolvedValue(true);
    return { service, dataSource };
  }

  it('pipelineStages e coerente con opportunities', async () => {
    const { service } = makeService([
      { stage: 'new_lead', count: 2, totalValue: '1000' },
      { stage: 'to_contact', count: 1, totalValue: '500' },
      { stage: 'contacted', count: 3, totalValue: '3000' },
      { stage: 'quote_sent', count: 4, totalValue: '4000' },
      { stage: 'accepted', count: 5, totalValue: '5000' },
    ]);

    const summary = await (service as any).buildPipelineStagesSummary('doflow', true);

    expect(summary).toEqual({
      new: { count: 3, totalValue: 1500 },
      contacted: { count: 3, totalValue: 3000 },
      qualified: { count: 0, totalValue: 0 },
      appointment: { count: 0, totalValue: 0 },
      quote: { count: 4, totalValue: 4000 },
      closed_won: { count: 5, totalValue: 5000 },
    });
  });

  it('totalValue resta nascosto quando non autorizzato', async () => {
    const { service, dataSource } = makeService([
      { stage: 'new_lead', count: 2, totalValue: '0' },
    ]);

    const summary = await (service as any).buildPipelineStagesSummary('doflow', false);

    expect(summary.new).toEqual({ count: 2, totalValue: null });
    expect(dataSource.query).toHaveBeenCalledWith(expect.stringContaining('NULL::numeric AS "totalValue"'), expect.any(Array));
  });

  it('buildSalesSummary mantiene i campi legacy e aggiunge pipelineStages', async () => {
    const { service } = makeService([]);
    jest.spyOn(service as any, 'countByOptionalColumn').mockResolvedValue(1);
    jest.spyOn(service as any, 'countByOptionalStatus').mockResolvedValue(2);
    jest.spyOn(service as any, 'sumRows').mockResolvedValue(100);
    jest.spyOn(service as any, 'countDueFollowUps').mockResolvedValue(3);
    jest.spyOn(service as any, 'buildPipelineStagesSummary').mockResolvedValue({
      new: { count: 1, totalValue: 10 },
      contacted: { count: 2, totalValue: 20 },
      qualified: { count: 3, totalValue: 30 },
      appointment: { count: 4, totalValue: 40 },
      quote: { count: 5, totalValue: 50 },
      closed_won: { count: 6, totalValue: 60 },
    });
    jest.spyOn(service as any, 'countDoflowOpenCommercialLeads').mockResolvedValue(2);

    const summary = await (service as any).buildSalesSummary('doflow', true);

    expect(summary.openLeads).toBe(2);
    expect(summary.sentQuotes).toBe(2);
    expect(summary.acceptedQuotes).toBe(2);
    expect(summary.pipelineStages.closed_won).toEqual({ count: 6, totalValue: 60 });
  });

  it('mantiene i quattro macro-gruppi legacy negli altri tenant', async () => {
    const { service } = makeService([
      { stage: 'new_lead', count: 1, totalValue: '10' },
      { stage: 'accepted', count: 1, totalValue: '20' },
    ]);

    const summary = await (service as any).buildPipelineStagesSummary('tenantlegacy', true);

    expect(summary).toEqual({
      new: { count: 1, totalValue: 10 },
      contacted: { count: 0, totalValue: 0 },
      quote: { count: 0, totalValue: 0 },
      won: { count: 1, totalValue: 20 },
    });
  });
});
