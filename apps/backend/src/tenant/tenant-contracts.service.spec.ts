import { seedDoflowContractTemplates } from './tenant-contracts-schema';
import { TenantContractsService } from './tenant-contracts.service';

describe('TenantContractsService', () => {
  const ownerRequest = {
    user: {
      sub: '11111111-1111-4111-8111-111111111111',
      role: 'owner',
      tenantId: 'doflow',
    },
  };

  it('seeda i template contratto base in modo idempotente', async () => {
    const templates = new Map<string, string>();
    let insertCount = 0;
    let updateCount = 0;
    const query = jest.fn(async (sql: string, params: unknown[] = []) => {
      const compact = sql.replace(/\s+/g, ' ').trim();
      if (compact.includes('SELECT id FROM "doflow".contract_templates')) {
        const id = templates.get(String(params[0]));
        return id ? [{ id }] : [];
      }
      if (compact.includes('INSERT INTO "doflow".contract_templates')) {
        insertCount += 1;
        templates.set(String(params[1]), `template-${insertCount}`);
        return [];
      }
      if (compact.includes('UPDATE "doflow".contract_templates')) {
        updateCount += 1;
        return [];
      }
      return [];
    });

    await seedDoflowContractTemplates({ query } as any, 'doflow');
    await seedDoflowContractTemplates({ query } as any, 'doflow');

    expect(templates.size).toBe(5);
    expect(insertCount).toBe(5);
    expect(updateCount).toBe(5);
  });

  it('genera contract_number tenant-scoped progressivo per anno', async () => {
    const service = new TenantContractsService({ query: jest.fn() } as any, ownerRequest);
    const year = new Date().getUTCFullYear();
    const query = jest.fn().mockResolvedValue([{ contract_number: `CTR-${year}-0007` }]);

    const next = await (service as any).nextContractNumber({ query }, 'doflow');

    expect(next).toBe(`CTR-${year}-0008`);
    expect(query).toHaveBeenCalledWith(expect.stringContaining('FROM "doflow".contracts'), [`CTR-${year}-%`]);
  });

  it('nasconde amount, payment_terms e internal_notes ai manager', () => {
    const service = new TenantContractsService({ query: jest.fn() } as any, ownerRequest);
    const contract = {
      id: 'c1',
      amount: 5000,
      payment_terms: '50/50',
      internal_notes: 'nota economica interna',
    };

    const managerView = (service as any).sanitizeContract(contract, { id: 'u1', role: 'manager' });
    const ownerView = (service as any).sanitizeContract(contract, { id: 'u1', role: 'owner' });

    expect(managerView.amount).toBeNull();
    expect(managerView.payment_terms).toBeUndefined();
    expect(managerView.internal_notes).toBeUndefined();
    expect(ownerView.amount).toBe(5000);
    expect(ownerView.payment_terms).toBe('50/50');
  });

  it('createContractFromQuote restituisce il contratto esistente senza duplicare', async () => {
    const manager = {
      query: jest.fn()
        .mockResolvedValueOnce([{
          id: '22222222-2222-4222-8222-222222222222',
          quote_number: 'Q-2026-0001',
          title: 'Preventivo sito',
          company_id: null,
          contact_id: null,
          opportunity_id: null,
          briefing_id: null,
          total: 1000,
          currency: 'EUR',
        }])
        .mockResolvedValueOnce([{ id: '33333333-3333-4333-8333-333333333333' }]),
    };
    const dataSource = {
      query: jest.fn(),
      transaction: jest.fn(async (callback: any) => callback(manager)),
    };
    const service = new TenantContractsService(dataSource as any, ownerRequest);
    jest.spyOn(service as any, 'ensureSchema').mockResolvedValue(undefined);
    jest.spyOn(service, 'getContract').mockResolvedValue({ id: '33333333-3333-4333-8333-333333333333' } as any);

    const result = await service.createContractFromQuote('22222222-2222-4222-8222-222222222222');

    expect(result).toEqual({ id: '33333333-3333-4333-8333-333333333333' });
    expect(manager.query.mock.calls.some(([sql]: [string]) => sql.includes('INSERT INTO "doflow".contracts'))).toBe(false);
  });
});
