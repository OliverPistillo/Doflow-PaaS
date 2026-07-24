import { ForbiddenException } from '@nestjs/common';
import { TenantFinanceService } from './tenant-finance.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';

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
});
