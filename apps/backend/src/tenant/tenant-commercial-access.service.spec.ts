import { ForbiddenException } from '@nestjs/common';
import { TenantCommercialAccessService } from './tenant-commercial-access.service';

jest.mock('./tenant-doflow-workspace.service', () => ({
  ensureDoflowWorkspaceTables: jest.fn().mockResolvedValue(undefined),
  DOFLOW_ROLE_CAPABILITIES: {
    commercial: ['canViewAssignedLeads', 'canEditAssignedLead'],
    web_developer: ['canViewCustomers'],
  },
}));

describe('TenantCommercialAccessService', () => {
  it('deriva il tenant dalla sessione e ignora tenant spoofing nella request', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ role: 'commercial' }])
      .mockResolvedValueOnce([]);
    const request = {
      tenantId: 'tenant_attaccante',
      headers: { 'x-doflow-tenant-id': 'tenant_attaccante' },
      body: { tenant: 'tenant_attaccante' },
      user: {
        sub: '11111111-1111-4111-8111-111111111111',
        email: 'commerciale@example.test',
        role: 'user',
        tenantId: 'doflow',
      },
    };
    const service = new TenantCommercialAccessService({ query } as any, request);

    const actor = await service.current();

    expect(actor.schema).toBe('doflow');
    expect(actor.capabilities.has('canEditAssignedLead')).toBe(true);
    expect(query.mock.calls.every(([sql]) => String(sql).includes('"doflow"'))).toBe(true);
  });

  it('non attribuisce capability commerciali a un tecnico', async () => {
    const query = jest.fn()
      .mockResolvedValueOnce([{ role: 'web_developer' }])
      .mockResolvedValueOnce([]);
    const service = new TenantCommercialAccessService({ query } as any, {
      user: { sub: '11111111-1111-4111-8111-111111111111', role: 'user', tenantId: 'doflow' },
    });
    const actor = await service.current();
    expect(() => service.require(actor, 'canCreateLeads')).toThrow(ForbiddenException);
  });

  it('mantiene owner distinto ma con tutte le capability del tenant', async () => {
    const query = jest.fn();
    const service = new TenantCommercialAccessService({ query } as any, {
      user: { sub: '11111111-1111-4111-8111-111111111111', role: 'owner', tenantId: 'doflow' },
    });
    const actor = await service.current();
    expect(actor.role).toBe('owner');
    expect(actor.capabilities.has('*')).toBe(true);
    expect(query).not.toHaveBeenCalled();
  });
});
