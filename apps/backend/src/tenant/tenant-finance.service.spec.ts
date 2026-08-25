import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantFinanceService } from './tenant-finance.service';

jest.mock('./tenant-finance-schema', () => ({ ensureTenantFinanceTables: jest.fn().mockResolvedValue(undefined) }));

const USER_ID = '11111111-1111-4111-8111-111111111111';
const INVOICE_ID = '22222222-2222-4222-8222-222222222222';
const PAYMENT_ID = '33333333-3333-4333-8333-333333333333';
const COMPANY_ID = '44444444-4444-4444-8444-444444444444';
const OTHER_COMPANY_ID = '55555555-5555-4555-8555-555555555555';
const IDEMPOTENCY_ID = '66666666-6666-4666-8666-666666666666';

describe('TenantFinanceService', () => {
  function createService(role = 'owner') {
    const dataSource = {
      query: jest.fn().mockResolvedValue([]),
      createQueryRunner: jest.fn(),
    };
    const request = {
      authUser: {
        id: USER_ID,
        email: `${role}@doflow.it`,
        role,
        tenantId: 'doflow',
      },
    };
    return new TenantFinanceService(dataSource as any, request);
  }

  it('allows finance access for owner/admin/superadmin only', () => {
    expect(() => (createService('owner') as any).assertFinanceAccess()).not.toThrow();
    expect(() => (createService('admin') as any).assertFinanceAccess()).not.toThrow();
    expect(() => (createService('superadmin') as any).assertFinanceAccess()).not.toThrow();
    expect(() => (createService('manager') as any).assertFinanceAccess()).toThrow(ForbiddenException);
    expect(() => (createService('user') as any).assertFinanceAccess()).toThrow(ForbiddenException);
  });

  it('calculates invoice item total with discount and tax', () => {
    const service = createService();
    const total = (service as any).itemTotal({
      quantity: 2,
      unit_price: 100,
      discount: 20,
      tax_rate: 22,
    });

    expect(total).toBe(219.6);
  });

  it.each([
    ['cleanInvoiceBody', { title: 'Fattura' }],
    ['cleanPaymentBody', { amount: 1200 }],
    ['cleanDeadlineBody', { title: 'Scadenza', due_date: '2026-09-01' }],
    ['cleanRecurringBody', { name: 'Servizio' }],
    ['cleanRenewalBody', { title: 'Rinnovo', due_date: '2026-09-01' }],
  ])('%s normalizza le currency valide e rifiuta quelle malformate', (method, body) => {
    const service = createService() as any;
    expect(service[method]({ ...body, currency: ' eur ' }, false).currency).toBe('EUR');
    expect(service[method]({ ...body, currency: 'USD' }, false).currency).toBe('USD');
    expect(() => service[method]({ ...body, currency: '1200€' }, false)).toThrow(BadRequestException);
  });

  it('rifiuta pagamenti Doflow con importo non positivo', async () => {
    await expect(createService().createPayment({ amount: 0, invoice_id: INVOICE_ID })).rejects.toBeInstanceOf(BadRequestException);
    await expect(createService().createPayment({ amount: -1, invoice_id: INVOICE_ID })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('restituisce il pagamento esistente per una chiave idempotente', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('idempotency_key = $1')) return [{ id: PAYMENT_ID }];
      if (sql.includes('WHERE p.id = $1')) return [{ id: PAYMENT_ID, invoice_id: INVOICE_ID, amount: 100 }];
      return [];
    });
    const service = new TenantFinanceService({ query, createQueryRunner: jest.fn() } as any, {
      authUser: { id: USER_ID, email: 'owner@doflow.it', role: 'owner', tenantId: 'doflow' },
    });
    await expect(service.createPayment({ amount: 100, invoice_id: INVOICE_ID, idempotency_key: IDEMPOTENCY_ID }))
      .resolves.toMatchObject({ id: PAYMENT_ID });
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO "doflow".payments'))).toBe(false);
  });

  it('risolve anche la race sulla chiave idempotente senza doppio audit', async () => {
    let idempotencyReads = 0;
    const unique = Object.assign(new Error('duplicate key'), { code: '23505' });
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('idempotency_key = $1')) return ++idempotencyReads === 1 ? [] : [{ id: PAYMENT_ID }];
      if (sql.includes('FROM "doflow".invoices')) return [{ id: INVOICE_ID, company_id: COMPANY_ID, project_id: null }];
      if (sql.includes('INSERT INTO "doflow".payments')) throw unique;
      if (sql.includes('WHERE p.id = $1')) return [{ id: PAYMENT_ID, invoice_id: INVOICE_ID, amount: 100 }];
      return [];
    });
    const service = new TenantFinanceService({ query, createQueryRunner: jest.fn() } as any, {
      authUser: { id: USER_ID, email: 'owner@doflow.it', role: 'owner', tenantId: 'doflow' },
    });
    await expect(service.createPayment({ amount: 100, invoice_id: INVOICE_ID, idempotency_key: IDEMPOTENCY_ID }))
      .resolves.toMatchObject({ id: PAYMENT_ID });
    expect(query.mock.calls.filter(([sql]) => String(sql).includes('audit_log'))).toHaveLength(0);
  });

  it('valida la coerenza company della fattura nel tenant', async () => {
    const query = jest.fn(async (sql: string) => sql.includes('FROM "doflow".invoices')
      ? [{ id: INVOICE_ID, company_id: COMPANY_ID, project_id: null }]
      : []);
    const service = new TenantFinanceService({ query, createQueryRunner: jest.fn() } as any, {
      authUser: { id: USER_ID, email: 'owner@doflow.it', role: 'owner', tenantId: 'doflow' },
    });
    await expect(service.createPayment({ amount: 100, invoice_id: INVOICE_ID, company_id: OTHER_COMPANY_ID }))
      .rejects.toThrow('company_id non coerente');
  });

  it('blocca server-side un rimborso superiore al residuo rimborsabile', async () => {
    const runner = {
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(), release: jest.fn(), isTransactionActive: true,
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FOR UPDATE')) {
          return [{ id: PAYMENT_ID, amount: 100, status: 'confirmed', payment_type: 'payment' }];
        }
        if (sql.includes('AS refunded')) return [{ refunded: 70 }];
        return [];
      }),
    };
    const dataSource = {
      query: jest.fn().mockResolvedValue([]),
      createQueryRunner: jest.fn().mockReturnValue(runner),
    };
    const service = new TenantFinanceService(dataSource as any, {
      authUser: { id: USER_ID, email: 'owner@doflow.it', role: 'owner', tenantId: 'doflow' },
    });
    await expect(service.createPayment({
      amount: 31,
      payment_type: 'refund',
      original_payment_id: PAYMENT_ID,
      refund_reason: 'Rettifica concordata',
    })).rejects.toThrow('residuo rimborsabile');
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('registra un rimborso valido nella stessa transazione del lock', async () => {
    const refundId = '77777777-7777-4777-8777-777777777777';
    const runner = {
      connect: jest.fn(), startTransaction: jest.fn(), commitTransaction: jest.fn(),
      rollbackTransaction: jest.fn(), release: jest.fn(), isTransactionActive: true,
      query: jest.fn(async (sql: string) => {
        if (sql.includes('FOR UPDATE')) {
          return [{ id: PAYMENT_ID, amount: 100, status: 'confirmed', payment_type: 'payment' }];
        }
        if (sql.includes('AS refunded')) return [{ refunded: 20 }];
        if (sql.includes('INSERT INTO "doflow".payments')) return [{ id: refundId }];
        return [];
      }),
    };
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('WHERE p.id = $1')) {
        return [{ id: refundId, amount: 30, payment_type: 'refund', original_payment_id: PAYMENT_ID }];
      }
      return [];
    });
    const service = new TenantFinanceService({
      query,
      createQueryRunner: jest.fn().mockReturnValue(runner),
    } as any, {
      authUser: { id: USER_ID, email: 'owner@doflow.it', role: 'owner', tenantId: 'doflow' },
    });
    await expect(service.createPayment({
      amount: 30,
      payment_type: 'refund',
      original_payment_id: PAYMENT_ID,
      refund_reason: 'Rettifica concordata',
    })).resolves.toMatchObject({ id: refundId, payment_type: 'refund' });
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
  });
});
