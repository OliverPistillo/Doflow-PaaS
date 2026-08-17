import { BadRequestException } from '@nestjs/common';
import { ensureTenantCrmCoreTables } from './tenant-crm-schema';
import { ensureTenantBriefingQuoteTables } from './tenant-briefing-quotes-schema';
import { TenantQuotesService } from './tenant-quotes.service';

jest.mock('./tenant-crm-schema', () => ({ ensureTenantCrmCoreTables: jest.fn().mockResolvedValue(undefined) }));
jest.mock('./tenant-briefing-quotes-schema', () => ({ ensureTenantBriefingQuoteTables: jest.fn().mockResolvedValue(undefined) }));

describe('TenantQuotesService accept commercial stage', () => {
  const quoteId = '11111111-1111-4111-8111-111111111111';
  const opportunityId = '22222222-2222-4222-8222-222222222222';

  beforeEach(() => jest.clearAllMocks());

  function makeService(tenantId: string, query: jest.Mock) {
    const service = new TenantQuotesService({ query } as any, {
      user: {
        sub: '33333333-3333-4333-8333-333333333333',
        email: 'owner@example.test',
        role: 'owner',
        tenantId,
      },
    });
    jest.spyOn(service, 'findOne').mockResolvedValue({ id: quoteId, status: 'accepted' } as any);
    return service;
  }

  it('mantiene quote accepted e porta la opportunity doflow a closed_won con un solo audit fase', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ id: quoteId, opportunity_id: opportunityId }])
      .mockResolvedValueOnce([{ stage: 'quote_sent' }])
      .mockResolvedValueOnce([{ id: opportunityId }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    const service = makeService('doflow', query);

    const result = await service.accept(quoteId, {});

    expect(result.status).toBe('accepted');
    const opportunityUpdate = query.mock.calls.find(([sql]) => String(sql).includes('UPDATE "doflow".opportunities'));
    expect(opportunityUpdate?.[1]).toEqual(['closed_won', '33333333-3333-4333-8333-333333333333', opportunityId]);
    const stageAudits = query.mock.calls.filter(([, params]) => params?.[2] === 'crm_opportunity_stage_changed');
    expect(stageAudits).toHaveLength(1);
    expect(JSON.parse(String(stageAudits[0][1][4]))).toEqual({
      previous_stage: 'quote',
      previous_stage_raw: 'quote_sent',
      new_stage: 'closed_won',
    });
    expect(query.mock.calls.some(([, params]) => params?.[2] === 'quote_accepted')).toBe(true);
    expect(ensureTenantCrmCoreTables).toHaveBeenCalledWith(expect.anything(), 'doflow');
    expect(ensureTenantBriefingQuoteTables).toHaveBeenCalledWith(expect.anything(), 'doflow');
  });

  it('mantiene accepted come opportunity stage negli altri tenant', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ id: quoteId, opportunity_id: opportunityId }])
      .mockResolvedValueOnce([{ id: opportunityId }])
      .mockResolvedValueOnce([]);
    const service = makeService('tenantlegacy', query);

    await service.accept(quoteId, {});

    const opportunityUpdate = query.mock.calls.find(([sql]) => String(sql).includes('UPDATE "tenantlegacy".opportunities'));
    expect(opportunityUpdate?.[1]).toEqual(['accepted', '33333333-3333-4333-8333-333333333333', opportunityId]);
    expect(query.mock.calls.some(([, params]) => params?.[2] === 'crm_opportunity_stage_changed')).toBe(false);
  });

  it('normalizza la currency dei preventivi e rifiuta valori malformati', () => {
    const service = makeService('doflow', jest.fn());
    const config = {
      table: 'quotes', required: [], writable: ['currency'], searchable: [], filters: [], sort: [], defaultSort: 'updated_at',
    };

    expect((service as any).cleanBody(config, { currency: ' eur ' }, false).currency).toBe('EUR');
    expect((service as any).cleanBody(config, { currency: 'USD' }, false).currency).toBe('USD');
    expect(() => (service as any).cleanBody(config, { currency: 'EURO' }, false)).toThrow(BadRequestException);
  });
});
