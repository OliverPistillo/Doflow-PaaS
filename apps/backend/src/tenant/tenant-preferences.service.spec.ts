import { TenantPreferencesService } from './tenant-preferences.service';

jest.mock('./tenant-universal-features-schema', () => ({
  ensureTenantUniversalFeatureTables: jest.fn().mockResolvedValue(undefined),
}));

describe('TenantPreferencesService onboarding lifecycle', () => {
  it('persists dismissed/completed/reset per authenticated user without cross-user state', async () => {
    const rows = new Map<string, Record<string, unknown>>();
    const query = jest.fn(async (sql: string, parameters: unknown[]) => {
      const userId = String(parameters[0]);
      if (sql.includes('INSERT INTO')) {
        const defaults = JSON.parse(String(parameters[1])) as Record<string, unknown>;
        if (!rows.has(userId)) rows.set(userId, defaults);
        return [{ user_id: userId, preferences: rows.get(userId), updated_at: '2026-08-28T08:00:00.000Z' }];
      }
      if (sql.includes('UPDATE')) {
        const next = JSON.parse(String(parameters[1])) as Record<string, unknown>;
        rows.set(userId, next);
        return [{ user_id: userId, preferences: next, updated_at: '2026-08-28T08:01:00.000Z' }];
      }
      return [];
    });
    const serviceFor = (id: string) => new TenantPreferencesService({ query } as never, { user: { sub: id, tenantId: 'tenant_preferences', role: 'user' } });
    const userA = serviceFor('11111111-1111-4111-8111-111111111111');
    const userB = serviceFor('22222222-2222-4222-8222-222222222222');

    await expect(userA.get()).resolves.toMatchObject({ preferences: { onboardingStatus: 'not_started' } });
    await expect(userA.update({ onboardingStatus: 'dismissed' })).resolves.toMatchObject({ after: { onboardingStatus: 'dismissed' } });
    await expect(userA.get()).resolves.toMatchObject({ preferences: { onboardingStatus: 'dismissed' } });
    await expect(userB.get()).resolves.toMatchObject({ preferences: { onboardingStatus: 'not_started' } });
    await expect(userA.update({ onboardingStatus: 'completed', completedTours: ['full-flow'] })).resolves.toMatchObject({ after: { onboardingStatus: 'completed', completedTours: ['full-flow'] } });
    await expect(userA.update({ onboardingStatus: 'not_started', completedTours: [], tourStep: 0, activeTourId: 'full-flow' })).resolves.toMatchObject({ after: { onboardingStatus: 'not_started', completedTours: [] } });
    await expect(userB.get()).resolves.toMatchObject({ preferences: { onboardingStatus: 'not_started', completedTours: [] } });
  });
});
