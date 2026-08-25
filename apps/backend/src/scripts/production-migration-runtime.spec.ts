import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { QueryRunner } from 'typeorm';
import {
  PRODUCTION_MIGRATIONS,
} from './production-migration-manifest';
import {
  ProductionMigrationError,
  createProductionMigrationDataSource,
  redactSensitiveText,
  resolveProductionMigrationConfig,
  resolveRuntimeDatabaseSynchronize,
  validateProductionMigrationHistory,
  validateProductionMigrationTableShape,
  withPostgresAdvisoryLock,
} from './production-migration-runtime';

describe('production migration runtime', () => {
  let migrationsDirectory: string;

  beforeEach(() => {
    migrationsDirectory = mkdtempSync(join(tmpdir(), 'doflow-migrations-'));
    for (const migration of PRODUCTION_MIGRATIONS) {
      writeFileSync(join(migrationsDirectory, migration.compiledFile), 'module.exports = {};\n');
    }
  });

  afterEach(() => {
    rmSync(migrationsDirectory, { recursive: true, force: true });
  });

  function environment(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
    return {
      NODE_ENV: 'production',
      DB_SYNC: 'false',
      DATABASE_URL: 'postgresql://synthetic:synthetic@localhost:55432/doflow',
      ...overrides,
    };
  }

  it('builds a compiled-JavaScript, transaction-all, synchronize-false DataSource', () => {
    const config = resolveProductionMigrationConfig(environment(), { migrationsDirectory });
    const dataSource = createProductionMigrationDataSource(config);

    expect(dataSource.options).toMatchObject({
      type: 'postgres',
      schema: 'public',
      migrationsTableName: 'doflow_migrations',
      migrationsTransactionMode: 'all',
      migrationsRun: false,
      synchronize: false,
      logging: false,
    });
    expect(dataSource.options.migrations).toHaveLength(11);
    expect((dataSource.options.migrations as string[]).every((file) => file.endsWith('.js'))).toBe(true);
  });

  it.each([
    [{ DATABASE_URL: '' }, 'DATABASE_URL_MISSING'],
    [{ DATABASE_URL: 'not-a-url' }, 'DATABASE_URL_INVALID'],
    [{ DATABASE_URL: 'https://database.invalid/doflow' }, 'DATABASE_URL_INVALID'],
    [{ DB_SYNC: 'TRUE' }, 'DB_SYNC_FORBIDDEN'],
  ])('rejects unsafe production configuration %p', (override, code) => {
    expect(() => resolveProductionMigrationConfig(environment(override), { migrationsDirectory }))
      .toThrow(expect.objectContaining({ code }));
  });

  it('allows the deterministic lock hold only in an explicitly authorized acceptance database', () => {
    expect(() => resolveProductionMigrationConfig(environment({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://synthetic:synthetic@postgres:5432/doflow_acceptance',
      DOFLOW_MIGRATION_ACCEPTANCE_HOLD_LOCK_MS: '250',
    }), { migrationsDirectory })).toThrow(expect.objectContaining({
      code: 'ACCEPTANCE_LOCK_HOLD_FORBIDDEN',
    }));

    const config = resolveProductionMigrationConfig(environment({
      NODE_ENV: 'test',
      DATABASE_URL: 'postgresql://synthetic:synthetic@postgres:5432/doflow_acceptance',
      DOFLOW_PRODUCTION_STARTUP_ACCEPTANCE: '1',
      DOFLOW_MIGRATION_ACCEPTANCE_HOLD_LOCK_MS: '250',
    }), { migrationsDirectory });
    expect(config.acceptanceHoldLockMs).toBe(250);
  });

  it('keeps DB_SYNC disabled in every runtime', () => {
    expect(resolveRuntimeDatabaseSynchronize({ NODE_ENV: 'production', DB_SYNC: 'false' })).toBe(false);
    expect(() => resolveRuntimeDatabaseSynchronize({ NODE_ENV: 'test', DB_SYNC: 'true' }))
      .toThrow(expect.objectContaining({ code: 'DB_SYNC_FORBIDDEN' }));
    expect(() => resolveRuntimeDatabaseSynchronize({ NODE_ENV: 'production', DB_SYNC: 'true' }))
      .toThrow(expect.objectContaining({ code: 'DB_SYNC_FORBIDDEN' }));
    expect(() => resolveRuntimeDatabaseSynchronize({ DB_SYNC: 'true' }))
      .toThrow(expect.objectContaining({ code: 'DB_SYNC_FORBIDDEN' }));
  });

  it('accepts only an exact migration-history prefix', () => {
    const prefix = PRODUCTION_MIGRATIONS.slice(0, 5).map(({ timestamp, name }) => ({ timestamp, name }));
    expect(validateProductionMigrationHistory(prefix)).toEqual(prefix);

    expect(() => validateProductionMigrationHistory([
      prefix[0],
      PRODUCTION_MIGRATIONS[2],
    ])).toThrow(expect.objectContaining({ code: 'MIGRATION_HISTORY_INCOMPATIBLE' }));
    expect(() => validateProductionMigrationHistory([
      ...prefix,
      { timestamp: 1850000000000, name: 'UnknownFuture1850000000000' },
    ])).toThrow(expect.objectContaining({ code: 'MIGRATION_HISTORY_FUTURE' }));
    expect(() => validateProductionMigrationHistory([
      { timestamp: prefix[0].timestamp, name: 'WrongName1714752000000' },
    ])).toThrow(expect.objectContaining({ code: 'MIGRATION_HISTORY_INCOMPATIBLE' }));
  });

  it('accepts only the canonical non-null serial migration table with id primary key', () => {
    const columns = [
      { column_name: 'id', udt_name: 'int4', is_nullable: 'NO', column_default: "nextval('doflow_migrations_id_seq'::regclass)" },
      { column_name: 'timestamp', udt_name: 'int8', is_nullable: 'NO', column_default: null },
      { column_name: 'name', udt_name: 'varchar', is_nullable: 'NO', column_default: null },
    ];
    expect(validateProductionMigrationTableShape(columns, ['id'])).toBe(true);
    expect(validateProductionMigrationTableShape(columns, [])).toBe(false);
    expect(validateProductionMigrationTableShape(
      columns.map((column) => column.column_name === 'timestamp' ? { ...column, is_nullable: 'YES' } : column),
      ['id'],
    )).toBe(false);
    expect(validateProductionMigrationTableShape(
      columns.map((column) => column.column_name === 'id' ? { ...column, column_default: null } : column),
      ['id'],
    )).toBe(false);
  });

  it('waits with bounded backoff, acquires and releases the same advisory lock', async () => {
    const queries: string[] = [];
    let attempts = 0;
    let time = 0;
    const runner = {
      query: jest.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.includes('pg_try_advisory_lock')) {
          attempts += 1;
          return [{ acquired: attempts >= 2 }];
        }
        return [{ released: true }];
      }),
    } as unknown as QueryRunner;

    const value = await withPostgresAdvisoryLock(
      runner,
      { namespace: 'test-lock', key1: 1, key2: 2 },
      {
        timeoutMs: 1_000,
        retryMs: 100,
        now: () => time,
        sleep: async (milliseconds) => { time += milliseconds; },
      },
      async () => 'done',
    );

    expect(value).toBe('done');
    expect(attempts).toBe(2);
    expect(queries.filter((sql) => sql.includes('pg_advisory_unlock'))).toHaveLength(1);
  });

  it('times out without waiting indefinitely', async () => {
    let time = 0;
    const runner = {
      query: jest.fn(async () => [{ acquired: false }]),
    } as unknown as QueryRunner;

    await expect(withPostgresAdvisoryLock(
      runner,
      { namespace: 'test-lock', key1: 1, key2: 2 },
      {
        timeoutMs: 100,
        retryMs: 100,
        now: () => time,
        sleep: async (milliseconds) => { time += milliseconds; },
      },
      async () => undefined,
    )).rejects.toMatchObject({ code: 'MIGRATION_LOCK_TIMEOUT' });
  });

  it('releases the advisory lock and preserves the migration failure', async () => {
    const runner = {
      query: jest.fn(async (sql: string) => sql.includes('unlock')
        ? [{ released: true }]
        : [{ acquired: true }]),
    } as unknown as QueryRunner;
    const fault = new ProductionMigrationError('MIGRATION_EXECUTION_FAILED');

    await expect(withPostgresAdvisoryLock(
      runner,
      { namespace: 'test-lock', key1: 1, key2: 2 },
      { timeoutMs: 100, retryMs: 25 },
      async () => { throw fault; },
    )).rejects.toBe(fault);
    expect(runner.query).toHaveBeenCalledWith(
      expect.stringContaining('pg_advisory_unlock'),
      [1, 2],
    );
  });

  it('redacts connection strings and credential-like diagnostics', () => {
    const redacted = redactSensitiveText(
      'postgresql://alice:secret@example.invalid/db password=hunter2 token=abc',
    );
    expect(redacted).not.toContain('alice');
    expect(redacted).not.toContain('hunter2');
    expect(redacted).not.toContain('abc');
    expect(redacted).toContain('[redacted-database-url]');
  });
});
