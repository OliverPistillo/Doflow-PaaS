import {
  assertDoflowCutoverSafety,
  DoflowCutoverError,
  parseDoflowCutoverOptions,
} from './doflow-production-cutover';

describe('Doflow production cutover CLI safety', () => {
  const productionConfig = {
    environment: 'production',
    hostClassification: 'service' as const,
    databaseClassification: 'configured' as const,
  };

  it('defaults to a Doflow-only dry-run', () => {
    expect(parseDoflowCutoverOptions([])).toEqual({
      mode: 'dry-run',
      tenant: 'doflow',
      tenantExplicit: false,
      confirm: undefined,
      backupRef: undefined,
    });
    expect(parseDoflowCutoverOptions(['status'])).toMatchObject({ mode: 'status', tenant: 'doflow' });
  });

  it('rejects every different tenant and federicanerone explicitly', () => {
    expect(() => parseDoflowCutoverOptions(['dry-run', '--tenant=other']))
      .toThrow('CUTOVER_TENANT_FORBIDDEN');
    expect(() => parseDoflowCutoverOptions(['apply', '--tenant=federicanerone']))
      .toThrow('CUTOVER_TENANT_FEDERICANERONE_FORBIDDEN');
  });

  it('requires explicit tenant, exact confirmation and a safe backup reference for apply', () => {
    const env = { NODE_ENV: 'production', DB_SYNC: 'false' };
    const base = parseDoflowCutoverOptions(['apply']);
    expect(() => assertDoflowCutoverSafety(base, env, productionConfig))
      .toThrow('CUTOVER_TENANT_EXPLICIT_REQUIRED');

    const tenant = parseDoflowCutoverOptions(['apply', '--tenant=doflow']);
    expect(() => assertDoflowCutoverSafety(tenant, env, productionConfig))
      .toThrow('CUTOVER_CONFIRMATION_REQUIRED');

    const confirmed = parseDoflowCutoverOptions([
      'apply', '--tenant=doflow', '--confirm=APPLY_DOFLOW_PRODUCTION_CUTOVER',
    ]);
    expect(() => assertDoflowCutoverSafety(confirmed, env, productionConfig))
      .toThrow('CUTOVER_BACKUP_REF_REQUIRED');

    const valid = parseDoflowCutoverOptions([
      'apply', '--tenant=doflow', '--confirm=APPLY_DOFLOW_PRODUCTION_CUTOVER', '--backup-ref=backup-2026-08-25',
    ]);
    expect(() => assertDoflowCutoverSafety(valid, env, productionConfig)).not.toThrow();
  });

  it('fails closed for DB_SYNC=true and unauthorized environments', () => {
    const options = parseDoflowCutoverOptions([
      'apply', '--tenant=doflow', '--confirm=APPLY_DOFLOW_PRODUCTION_CUTOVER', '--backup-ref=backup-safe',
    ]);
    expect(() => assertDoflowCutoverSafety(options, { NODE_ENV: 'production', DB_SYNC: 'true' }, productionConfig))
      .toThrow('CUTOVER_DB_SYNC_FORBIDDEN');
    expect(() => assertDoflowCutoverSafety(options, { NODE_ENV: 'development', DB_SYNC: 'false' }, productionConfig))
      .toThrow('CUTOVER_ENVIRONMENT_FORBIDDEN');
  });

  it('permits only explicitly authorized non-remote acceptance databases', () => {
    const options = parseDoflowCutoverOptions([
      'apply', '--tenant=doflow', '--confirm=APPLY_DOFLOW_PRODUCTION_CUTOVER', '--backup-ref=acceptance-backup',
    ]);
    const env = { NODE_ENV: 'test', DB_SYNC: 'false', DOFLOW_CUTOVER_ACCEPTANCE: '1' };
    expect(() => assertDoflowCutoverSafety(options, env, {
      environment: 'test', hostClassification: 'service', databaseClassification: 'acceptance',
    })).not.toThrow();
    expect(() => assertDoflowCutoverSafety(options, env, {
      environment: 'test', hostClassification: 'remote', databaseClassification: 'acceptance',
    })).toThrow('CUTOVER_ACCEPTANCE_DATABASE_FORBIDDEN');
    expect(() => assertDoflowCutoverSafety(options, env, {
      environment: 'test', hostClassification: 'local', databaseClassification: 'configured',
    })).toThrow('CUTOVER_ACCEPTANCE_DATABASE_FORBIDDEN');
  });

  it('uses stable machine-readable error codes', () => {
    expect(new DoflowCutoverError('CUTOVER_TEST').code).toBe('CUTOVER_TEST');
  });
});
