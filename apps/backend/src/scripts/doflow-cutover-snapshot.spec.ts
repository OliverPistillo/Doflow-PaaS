import {
  compareCeoPreservation,
  compareSecondTenantPreservation,
  DoflowCeoFingerprint,
  shortCutoverFingerprint,
} from './doflow-cutover-snapshot';

function ceo(alias: 'ceo_1' | 'ceo_2', suffix = ''): DoflowCeoFingerprint {
  const fingerprint = (name: string) => shortCutoverFingerprint(`${alias}:${name}:${suffix}`);
  return {
    alias,
    tenantPresent: true,
    publicMirrorPresent: true,
    uuidMatches: true,
    ownerRole: true,
    publicOwnerRole: true,
    active: true,
    publicActive: true,
    mfaEnabled: true,
    publicMfaEnabled: true,
    emailVerified: true,
    publicEmailVerified: true,
    tenantBindingMatches: true,
    fingerprints: {
      uuid: fingerprint('uuid'),
      passwordHash: fingerprint('password'),
      authProvider: fingerprint('provider'),
      googleId: fingerprint('google'),
      mfaSecret: fingerprint('mfa'),
      avatar: fingerprint('avatar'),
      preferences: fingerprint('preferences'),
      tenant: fingerprint('tenant'),
      role: fingerprint('role'),
      membership: fingerprint('membership'),
      roles: fingerprint('roles'),
      capabilities: fingerprint('capabilities'),
      publicMirror: fingerprint('mirror'),
      references: fingerprint('references'),
    },
  };
}

describe('Doflow cutover snapshots', () => {
  it('creates deterministic abbreviated fingerprints without retaining raw values', () => {
    const raw = 'sensitive-synthetic-value';
    const fingerprint = shortCutoverFingerprint({ raw, nested: ['a', 1] });
    expect(fingerprint).toHaveLength(16);
    expect(fingerprint).not.toContain(raw);
    expect(fingerprint).toBe(shortCutoverFingerprint({ nested: ['a', 1], raw }));
  });

  it('compares every CEO property and reports only boolean preservation', () => {
    const before = [ceo('ceo_1'), ceo('ceo_2')];
    expect(compareCeoPreservation(before, before)).toEqual({
      preserved: true,
      accounts: [{ alias: 'ceo_1', preserved: true }, { alias: 'ceo_2', preserved: true }],
    });
    const changed = [ceo('ceo_1'), ceo('ceo_2', 'changed')];
    expect(compareCeoPreservation(before, changed)).toEqual({
      preserved: false,
      accounts: [{ alias: 'ceo_1', preserved: true }, { alias: 'ceo_2', preserved: false }],
    });
  });

  it('detects any second-tenant count or fingerprint change', () => {
    const before = { tenantCount: 1, fingerprint: '0123456789abcdef' };
    expect(compareSecondTenantPreservation(before, before).preserved).toBe(true);
    expect(compareSecondTenantPreservation(before, { ...before, tenantCount: 2 }).preserved).toBe(false);
    expect(compareSecondTenantPreservation(before, { ...before, fingerprint: 'fedcba9876543210' }).preserved).toBe(false);
  });
});
