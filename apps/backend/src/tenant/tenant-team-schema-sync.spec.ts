import { syncTenantUsersToTeamMembers } from './tenant-team-schema';

describe('syncTenantUsersToTeamMembers removal contract', () => {
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
