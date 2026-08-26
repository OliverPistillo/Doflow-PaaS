import { ForbiddenException } from '@nestjs/common';
import { TenantDoflowWorkspaceService, DOFLOW_ROLE_CAPABILITIES } from './tenant-doflow-workspace.service';

describe('Doflow automation capability payload', () => {
  const userId = '11111111-1111-4111-8111-111111111111';

  it('keeps web_developer read-only for Automation', () => {
    const capabilities = DOFLOW_ROLE_CAPABILITIES.web_developer;
    expect(capabilities).toContain('canViewAutomations');
    expect(capabilities).not.toContain('canManageAutomations');
    expect(capabilities).not.toContain('canRunAutomations');
    expect(capabilities).not.toContain('canRetryAutomations');
    expect(capabilities).not.toContain('canViewAutomationErrors');
    expect(capabilities).not.toContain('canManagePointPolicies');
    expect(capabilities).not.toContain('canManageRankings');
    expect(capabilities).not.toContain('canManageGoals');
  });

  it('keeps explicit capability assignments separate from the effective union', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('doflow_user_preferences') && sql.includes('WHERE user_id')) return [];
      if (sql.includes('doflow_user_roles') && sql.includes('WHERE user_id')) return [{ role: 'web_developer' }];
      if (sql.includes('doflow_user_capabilities') && sql.includes('WHERE user_id')) return [{ capability: 'canUseBuilder' }];
      if (sql.includes('SELECT id, role') && sql.includes('.users')) return [{ id: userId, role: 'editor' }];
      if (sql.includes('SELECT user_id, role')) return [{ user_id: userId, role: 'web_developer' }];
      if (sql.includes('SELECT user_id, capability')) return [{ user_id: userId, capability: 'canUseBuilder' }];
      return [];
    });
    const service = new TenantDoflowWorkspaceService(
      { query } as any,
      { user: { sub: userId, email: 'synthetic@acceptance.invalid', role: 'editor', tenantId: 'doflow' } },
    );
    jest.spyOn(service as any, 'ensureIdentityTables').mockResolvedValue(undefined);

    const identity = await service.identity();

    expect(identity.capabilities).toContain('canViewAutomations');
    expect(identity.capabilities).toContain('canUseBuilder');
    expect(identity.capabilities).not.toContain('canManageAutomations');
    expect(identity.capabilities).not.toContain('canRunAutomations');
    expect(identity.explicitCapabilities).toEqual(['canUseBuilder']);
    expect(identity.assignments).toContainEqual(expect.objectContaining({
      userId,
      roles: ['web_developer'],
      capabilities: expect.arrayContaining(['canViewAutomations', 'canUseBuilder']),
      explicitCapabilities: ['canUseBuilder'],
    }));
  });

  it.each(['roles', 'capabilities'])('protegge un owner dagli override ordinari di %s', async (kind) => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT id, role') && sql.includes('.users')) return [{ id: userId, role: 'owner' }];
      return [];
    });
    const dataSource = {
      query: jest.fn(),
      transaction: jest.fn(async (work: (manager: { query: typeof query }) => Promise<unknown>) => work({ query })),
    };
    const service = new TenantDoflowWorkspaceService(
      dataSource as any,
      { user: { sub: userId, email: 'owner@acceptance.invalid', role: 'owner', tenantId: 'doflow' } },
    );
    jest.spyOn(service as any, 'ensureIdentityTables').mockResolvedValue(undefined);

    const operation = kind === 'roles'
      ? service.updateRoles(userId, { roles: ['web_developer'] })
      : service.updateCapabilities(userId, { capabilities: ['canUseBuilder'] });
    await expect(operation).rejects.toBeInstanceOf(ForbiddenException);
    expect(query.mock.calls.some(([sql]) => String(sql).startsWith('DELETE'))).toBe(false);
  });

  it('keeps identity roles separate from the Team operational role', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('SELECT id, role') && sql.includes('.users')) return [{ id: userId, role: 'editor' }];
      return [];
    });
    const dataSource = {
      query: jest.fn(),
      transaction: jest.fn(async (work: (manager: { query: typeof query }) => Promise<unknown>) => work({ query })),
    };
    const service = new TenantDoflowWorkspaceService(
      dataSource as any,
      { user: { sub: '22222222-2222-4222-8222-222222222222', email: 'owner@acceptance.invalid', role: 'owner', tenantId: 'doflow' } },
    );
    jest.spyOn(service as any, 'ensureIdentityTables').mockResolvedValue(undefined);

    await service.updateRoles(userId, { roles: ['web_developer'] });

    expect(query.mock.calls.some(([sql]) => String(sql).includes('doflow_user_roles'))).toBe(true);
    expect(query.mock.calls.some(([sql]) => String(sql).includes('team_members'))).toBe(false);
  });
});
