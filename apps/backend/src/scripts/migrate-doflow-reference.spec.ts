import {
  assertApplySafety,
  parseMigrationOptions,
} from './migrate-doflow-reference';

describe('Doflow reference migration safety', () => {
  const original = { ...process.env };

  afterEach(() => {
    process.env = { ...original };
  });

  it('usa dry-run e target doflow come default', () => {
    expect(parseMigrationOptions([])).toEqual({
      apply: false,
      confirm: null,
      target: 'doflow',
    });
  });

  it('rifiuta ogni target cross-tenant', () => {
    expect(() => parseMigrationOptions(['--target=altro'])).toThrow(
      'exactly doflow',
    );
  });

  it('richiede conferma, DB_SYNC=false e allowlist staging per apply', () => {
    process.env.NODE_ENV = 'test';
    process.env.DB_SYNC = 'false';
    process.env.DOFLOW_MIGRATION_ALLOW_APPLY = 'doflow-staging';
    const options = parseMigrationOptions([
      '--apply',
      '--confirm=doflow',
    ]);
    expect(() => assertApplySafety(options)).not.toThrow();
    expect(() =>
      assertApplySafety({ ...options, confirm: null }),
    ).toThrow('--confirm=doflow');
  });

  it('impedisce apply in produzione', () => {
    process.env.NODE_ENV = 'production';
    process.env.DB_SYNC = 'false';
    process.env.DOFLOW_MIGRATION_ALLOW_APPLY = 'doflow-staging';
    expect(() =>
      assertApplySafety({ apply: true, confirm: 'doflow', target: 'doflow' }),
    ).toThrow('NODE_ENV=production');
  });
});
