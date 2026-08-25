import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { TenantDoflowCommerceService } from './tenant-doflow-commerce.service';

jest.mock('./tenant-doflow-commerce-schema', () => ({
  ensureDoflowCommerceTables: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('./tenant-doflow-workspace.service', () => ({
  DOFLOW_ROLE_CAPABILITIES: {},
  ensureDoflowWorkspaceTables: jest.fn().mockResolvedValue(undefined),
}));

describe('TenantDoflowCommerceService', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const serviceId = '22222222-2222-4222-8222-222222222222';
  const orderId = '33333333-3333-4333-8333-333333333333';

  function service(tenantId = 'doflow') {
    return new TenantDoflowCommerceService({ query: jest.fn() } as any, {
      user: { sub: userId, email: 'owner@example.test', role: 'owner', tenantId },
    }, { createProject: jest.fn() } as any, { createNotification: jest.fn() } as any);
  }

  it('nega il bounded context a tenant diversi da doflow', async () => {
    await expect(service('altro').listServices()).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('crea lo snapshot riga usando il prezzo server e ignora il prezzo del browser', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => {
      if (sql.includes('FROM "doflow".services')) return [{ id: serviceId, name: 'Servizio reale', description: 'Snapshot', category: 'Software', price: 250, currency: 'EUR', tax_rate: 22, version: 4 }];
      if (sql.includes('INSERT INTO "doflow".order_items')) return [];
      return [];
    });
    const totals = await (service() as any).orderItems(
      { query } as any,
      'doflow',
      orderId,
      [{ serviceId, quantity: 2, unitPrice: 1, discount: 0 }],
    );

    expect(totals).toEqual({ subtotal: 500, taxTotal: 110, total: 610, currency: 'EUR' });
    const insert = query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO "doflow".order_items'));
    const insertParams = insert?.[1] as unknown[];
    expect(insertParams[2]).toBe('Servizio reale');
    expect(insertParams[3]).toBe('Snapshot');
    expect(insertParams[4]).toBe('Software');
    expect(insertParams[6]).toBe(250);
    expect(insertParams[8]).toBe(22);
    expect(insertParams[11]).toBe(4);
    expect(insertParams[14]).toBe(500);
    expect(insertParams[25]).toBe(610);
  });

  it('rifiuta quantità non positive prima di inserire la riga', async () => {
    const query = jest.fn(async (sql: string, _params?: unknown[]) => sql.includes('.services')
      ? [{ id: serviceId, name: 'Servizio', price: 100 }]
      : []);
    await expect((service() as any).orderItems(
      { query } as any,
      'doflow',
      orderId,
      [{ serviceId, quantity: 0 }],
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('INSERT INTO'))).toBe(false);
  });

  it('mantiene lo snapshot già scritto quando il catalogo cambia o viene archiviato', async () => {
    let catalog = { id: serviceId, name: 'Nome iniziale', description: 'Descrizione iniziale', category: 'Software', price: 100, currency: 'EUR', tax_rate: 10, version: 1 };
    const inserts: unknown[][] = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM "doflow".services')) return [catalog];
      if (sql.includes('INSERT INTO "doflow".order_items')) inserts.push([...(params || [])]);
      return [];
    });
    await (service() as any).orderItems({ query } as any, 'doflow', orderId, [{ serviceId, quantity: 1 }]);
    catalog = { ...catalog, name: 'Nome nuovo', description: 'Descrizione nuova', price: 999, tax_rate: 22, version: 2 };
    await (service() as any).orderItems({ query } as any, 'doflow', orderId, [{ serviceId, quantity: 1 }]);

    expect(inserts[0][2]).toBe('Nome iniziale');
    expect(inserts[0][3]).toBe('Descrizione iniziale');
    expect(inserts[0][6]).toBe(100);
    expect(inserts[0][8]).toBe(10);
    expect(inserts[0][11]).toBe(1);
    expect(inserts[1][2]).toBe('Nome nuovo');
    expect(inserts[0]).not.toEqual(inserts[1]);
  });

  it('rifiuta valuta non valida e sconto client non autorizzato', async () => {
    const query = jest.fn(async (sql: string) => sql.includes('.services')
      ? [{ id: serviceId, name: 'Servizio', price: 100, currency: 'NOT_A_CURRENCY', tax_rate: 0 }]
      : []);
    await expect((service() as any).orderItems(
      { query } as any, 'doflow', orderId, [{ serviceId, quantity: 1, discount: 100 }],
    )).rejects.toBeInstanceOf(BadRequestException);
  });
});
