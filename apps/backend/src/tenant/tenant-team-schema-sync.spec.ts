import { syncTenantUsersToTeamMembers } from './tenant-team-schema';

describe('syncTenantUsersToTeamMembers removal contract', () => {
  it('riallinea il ruolo tecnico autorevole anche quando user_id e gia collegato', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) };

    await syncTenantUsersToTeamMembers(dataSource as any, 'doflow');

    const syncUpdate = dataSource.query.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => sql.includes('UPDATE "doflow".team_members tm'));
    expect(syncUpdate).toBeDefined();
    expect(syncUpdate).toContain('tm.user_id IS DISTINCT FROM u.id');
    expect(syncUpdate).toContain('tm.tenant_role IS DISTINCT FROM u.role');
    expect(syncUpdate).toContain('tm.deleted_at IS NULL');
  });

  it('non ricrea una membership che possiede già una tombstone archiviata', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue([]) };

    await syncTenantUsersToTeamMembers(dataSource as any, 'doflow');

    const syncInsert = dataSource.query.mock.calls
      .map(([sql]) => String(sql))
      .find((sql) => sql.includes('INSERT INTO "doflow".team_members'));
    expect(syncInsert).toBeDefined();
    expect(syncInsert).toContain('WHERE tm.user_id = u.id OR lower(tm.email) = lower(u.email)');
    expect(syncInsert).not.toMatch(/WHERE tm\.deleted_at IS NULL\s+AND \(tm\.user_id = u\.id/);
  });
});
