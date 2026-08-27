import {
  AUTHORITY_MIGRATIONS,
  BASELINE_MAX,
  BASELINE_MIGRATIONS,
  FINAL_MAX,
  PRE_186_MIGRATIONS,
  POST_178_FORBIDDEN_TABLES,
  createFrozenLegacySchema,
  stableStringify,
} from './pre179-migration-rehearsal';

describe('true pre-179 migration rehearsal contract', () => {
  it('loads a baseline that stops exactly at migration 178', () => {
    const names = BASELINE_MIGRATIONS.map((Migration) => String(new Migration().name));
    expect(names).toEqual([
      'InitialPublicSchema1714752000000',
      'CreateTenantRegistry1750000000000',
      'AddGoogleOAuthUsers1760000000000',
      'CreatePlatformAccessCatalog1770000000000',
      'CreateBackupSchedules1780000000000',
    ]);
    expect(BASELINE_MAX).toBe(1780000000000);
    expect(names.some((name) => /179|180|181|182|183|184/.test(name))).toBe(false);
  });

  it('loads the authority chain 179 through 184 in order', () => {
    expect(AUTHORITY_MIGRATIONS.map((Migration) => String(new Migration().name))).toEqual([
      'CreateCommercialCoreAuthority1790000000000',
      'CreateDeliveryCoreAuthority1800000000000',
      'CreateCommerceCashCoreAuthority1810000000000',
      'CreateDocumentRevenueCoreAuthority1820000000000',
      'CreateCollaborationNotificationsRealtimeAuthority1830000000000',
      'CreateAutomationPerformanceAuthority1840000000000',
    ]);
    expect(FINAL_MAX).toBe(1840000000000);
  });

  it('exposes an exact populated 185 baseline for the migration 186 rehearsal', () => {
    expect(PRE_186_MIGRATIONS.map((Migration) => String(new Migration().name))).toEqual([
      'CreateCommercialCoreAuthority1790000000000',
      'CreateDeliveryCoreAuthority1800000000000',
      'CreateCommerceCashCoreAuthority1810000000000',
      'CreateDocumentRevenueCoreAuthority1820000000000',
      'CreateCollaborationNotificationsRealtimeAuthority1830000000000',
      'CreateAutomationPerformanceAuthority1840000000000',
      'CreateUniversalTenantFeatures1850000000000',
    ]);
  });

  it('keeps authority-only table DDL out of the frozen fixture', () => {
    const fixtureSource = createFrozenLegacySchema.toString();
    for (const table of POST_178_FORBIDDEN_TABLES) {
      expect(fixtureSource).not.toContain(`.${table}`);
    }
  });

  it('normalizes object ordering for deterministic replay checksums', () => {
    expect(stableStringify({ z: 1, a: { d: 2, b: 3 } })).toBe(
      stableStringify({ a: { b: 3, d: 2 }, z: 1 }),
    );
  });
});
