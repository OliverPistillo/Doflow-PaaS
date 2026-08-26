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

  it('returns the inherited read-only capability in the server identity payload', async () => {
    const query = jest.fn(async (sql: string) => {
      if (sql.includes('doflow_user_preferences') && sql.includes('WHERE user_id')) return [];
      if (sql.includes('doflow_user_roles') && sql.includes('WHERE user_id')) return [{ role: 'web_developer' }];
      if (sql.includes('doflow_user_capabilities') && sql.includes('WHERE user_id')) return [];
      if (sql.includes('SELECT id, role') && sql.includes('.users')) return [{ id: userId, role: 'editor' }];
      if (sql.includes('SELECT user_id, role')) return [{ user_id: userId, role: 'web_developer' }];
      if (sql.includes('SELECT user_id, capability')) return [];
      return [];
    });
    const service = new TenantDoflowWorkspaceService(
      { query } as any,
      { user: { sub: userId, email: 'synthetic@acceptance.invalid', role: 'editor', tenantId: 'doflow' } },
    );
    jest.spyOn(service as any, 'ensureIdentityTables').mockResolvedValue(undefined);

    const identity = await service.identity();

    expect(identity.capabilities).toContain('canViewAutomations');
    expect(identity.capabilities).not.toContain('canManageAutomations');
    expect(identity.capabilities).not.toContain('canRunAutomations');
    expect(identity.assignments).toContainEqual(expect.objectContaining({
      userId,
      roles: ['web_developer'],
      capabilities: expect.arrayContaining(['canViewAutomations']),
    }));
  });
});
