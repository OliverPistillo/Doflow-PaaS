import 'reflect-metadata';

import { randomUUID } from 'node:crypto';
import { isIP } from 'node:net';
import { resolve } from 'node:path';
import {
  DataSource,
  MigrationExecutor,
  type QueryRunner,
} from 'typeorm';
import {
  PRODUCTION_MIGRATION_LOCK,
  PRODUCTION_MIGRATION_MAX,
  PRODUCTION_MIGRATIONS,
  resolveCompiledProductionMigrations,
} from './production-migration-manifest';

export type ProductionMigrationMode = 'status' | 'run';

export type SafeMigrationLogRecord = Readonly<
  Record<string, string | number | boolean | null | readonly string[]>
>;

export type SafeMigrationLogger = (record: SafeMigrationLogRecord) => void;

export type AdvisoryLockSpec = Readonly<{
  namespace: string;
  key1: number;
  key2: number;
}>;

export type AdvisoryLockOptions = Readonly<{
  timeoutMs: number;
  retryMs: number;
  acceptanceHoldMs?: number;
  logger?: SafeMigrationLogger;
  runId?: string;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
}>;

export type ProductionMigrationConfig = Readonly<{
  databaseUrl: string;
  environment: string;
  hostClassification: 'local' | 'private' | 'service' | 'remote';
  databaseClassification: 'acceptance' | 'configured';
  migrationFiles: readonly string[];
  migrationsDirectory: string;
  lockTimeoutMs: number;
  lockRetryMs: number;
  connectionTimeoutMs: number;
  acceptanceHoldLockMs: number;
}>;

export type ProductionMigrationHistory = Readonly<{
  timestamp: number;
  name: string;
}>;

export type ProductionMigrationState = Readonly<{
  migrationMax: number;
  history: readonly ProductionMigrationHistory[];
  pending: readonly string[];
  ready: boolean;
}>;

export type ProductionMigrationResult = Readonly<{
  verdict:
    | 'PRODUCTION MIGRATIONS GO'
    | 'PRODUCTION MIGRATIONS READY'
    | 'PRODUCTION MIGRATIONS PENDING';
  runId: string;
  mode: ProductionMigrationMode;
  status: 'read-only' | 'no-op' | 'applied';
  migrationMaxBefore: number;
  migrationMaxAfter: number;
  pendingBefore: number;
  pendingAfter: number;
  applied: readonly string[];
  advisoryLock: boolean;
  ready: boolean;
  durationMs: number;
}>;

export type MigrationExecutorAdapter = Pick<
  MigrationExecutor,
  'getPendingMigrations' | 'executePendingMigrations'
> & {
  transaction: 'all' | 'none' | 'each';
  fake: boolean;
};

export type MigrationExecutorFactory = (
  dataSource: DataSource,
  queryRunner: QueryRunner,
) => MigrationExecutorAdapter;

type RuntimeDependencies = Readonly<{
  createDataSource?: (config: ProductionMigrationConfig) => DataSource;
  createExecutor?: MigrationExecutorFactory;
  logger?: SafeMigrationLogger;
  now?: () => number;
  sleep?: (milliseconds: number) => Promise<void>;
  runId?: () => string;
}>;

type RuntimeOptions = Readonly<{
  mode?: ProductionMigrationMode;
  env?: NodeJS.ProcessEnv;
  migrationsDirectory?: string;
  dependencies?: RuntimeDependencies;
}>;

type QueryableRunner = Pick<QueryRunner, 'query'>;

export class ProductionMigrationError extends Error {
  constructor(
    public readonly code: string,
    message = code,
  ) {
    super(message);
    this.name = 'ProductionMigrationError';
  }
}

export const consoleSafeMigrationLogger: SafeMigrationLogger = (record) => {
  process.stdout.write(`[production-migrations] ${JSON.stringify(record)}\n`);
};

export function productionMigrationErrorCode(error: unknown): string {
  return error instanceof ProductionMigrationError
    ? error.code
    : 'PRODUCTION_MIGRATION_FAILED';
}

export function redactSensitiveText(value: unknown): string {
  return String(value ?? '')
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted-database-url]')
    .replace(/\b(password|token|secret|cookie|authorization)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]');
}

function parseBoundedInteger(
  value: string | undefined,
  fallback: number,
  minimum: number,
  maximum: number,
  code: string,
): number {
  if (value === undefined || value.trim() === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < minimum || parsed > maximum) {
    throw new ProductionMigrationError(code);
  }
  return parsed;
}

function normalizedEnvironment(env: NodeJS.ProcessEnv): string {
  const value = String(env.NODE_ENV || 'unspecified').trim().toLowerCase();
  return ['production', 'test', 'development'].includes(value) ? value : 'other';
}

function classifyHost(hostname: string): ProductionMigrationConfig['hostClassification'] {
  const normalized = hostname.trim().toLowerCase();
  if (normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1') {
    return 'local';
  }
  if (isIP(normalized) === 4) {
    const octets = normalized.split('.').map(Number);
    if (
      octets[0] === 10
      || octets[0] === 127
      || (octets[0] === 192 && octets[1] === 168)
      || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    ) {
      return 'private';
    }
    return 'remote';
  }
  if (isIP(normalized) === 6) {
    return normalized.startsWith('fc') || normalized.startsWith('fd') ? 'private' : 'remote';
  }
  return normalized.includes('.') ? 'remote' : 'service';
}

export function resolveRuntimeDatabaseSynchronize(
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const requested = String(env.DB_SYNC || '').trim().toLowerCase() === 'true';
  if (requested) throw new ProductionMigrationError('DB_SYNC_FORBIDDEN');
  return false;
}

export function resolveProductionMigrationConfig(
  env: NodeJS.ProcessEnv = process.env,
  options: { migrationsDirectory?: string } = {},
): ProductionMigrationConfig {
  if (String(env.DB_SYNC || '').trim().toLowerCase() === 'true') {
    throw new ProductionMigrationError('DB_SYNC_FORBIDDEN');
  }

  const databaseUrl = String(env.DATABASE_URL || '').trim();
  if (!databaseUrl) throw new ProductionMigrationError('DATABASE_URL_MISSING');

  let parsed: URL;
  try {
    parsed = new URL(databaseUrl);
  } catch {
    throw new ProductionMigrationError('DATABASE_URL_INVALID');
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol) || !parsed.hostname) {
    throw new ProductionMigrationError('DATABASE_URL_INVALID');
  }

  const migrationsDirectory = resolve(
    options.migrationsDirectory ?? resolve(__dirname, '..', 'migrations'),
  );
  let migrationFiles: string[];
  try {
    migrationFiles = resolveCompiledProductionMigrations(migrationsDirectory);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const code = message.startsWith('MIGRATION_ARTIFACTS_DIRECTORY_UNAVAILABLE')
      ? 'MIGRATION_ARTIFACTS_DIRECTORY_UNAVAILABLE'
      : 'MIGRATION_ARTIFACTS_INVALID';
    throw new ProductionMigrationError(code);
  }

  const environment = normalizedEnvironment(env);
  const databaseName = parsed.pathname.replace(/^\//, '').toLowerCase();
  const databaseClassification = databaseName.includes('acceptance')
    ? 'acceptance'
    : 'configured';
  const acceptanceHoldLockMs = parseBoundedInteger(
    env.DOFLOW_MIGRATION_ACCEPTANCE_HOLD_LOCK_MS,
    0,
    0,
    10_000,
    'ACCEPTANCE_LOCK_HOLD_INVALID',
  );
  if (
    acceptanceHoldLockMs > 0
    && (
      env.DOFLOW_PRODUCTION_STARTUP_ACCEPTANCE !== '1'
      || environment !== 'test'
      || databaseClassification !== 'acceptance'
    )
  ) {
    throw new ProductionMigrationError('ACCEPTANCE_LOCK_HOLD_FORBIDDEN');
  }

  return {
    databaseUrl,
    environment,
    hostClassification: classifyHost(parsed.hostname),
    databaseClassification,
    migrationFiles,
    migrationsDirectory,
    lockTimeoutMs: parseBoundedInteger(
      env.DOFLOW_MIGRATION_LOCK_TIMEOUT_MS,
      60_000,
      100,
      300_000,
      'MIGRATION_LOCK_TIMEOUT_INVALID',
    ),
    lockRetryMs: parseBoundedInteger(
      env.DOFLOW_MIGRATION_LOCK_RETRY_MS,
      250,
      25,
      5_000,
      'MIGRATION_LOCK_RETRY_INVALID',
    ),
    connectionTimeoutMs: parseBoundedInteger(
      env.DOFLOW_DATABASE_CONNECT_TIMEOUT_MS,
      10_000,
      100,
      60_000,
      'DATABASE_CONNECT_TIMEOUT_INVALID',
    ),
    acceptanceHoldLockMs,
  };
}

export function createProductionMigrationDataSource(
  config: ProductionMigrationConfig,
): DataSource {
  return new DataSource({
    type: 'postgres',
    url: config.databaseUrl,
    schema: 'public',
    entities: [],
    migrations: [...config.migrationFiles],
    migrationsTableName: 'doflow_migrations',
    migrationsTransactionMode: 'all',
    migrationsRun: false,
    synchronize: false,
    logging: false,
    extra: {
      application_name: 'doflow-production-migrations',
      connectionTimeoutMillis: config.connectionTimeoutMs,
    },
  });
}

function asBoolean(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't' || value === 'true';
}

async function defaultSleep(milliseconds: number): Promise<void> {
  await new Promise<void>((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

export async function withPostgresAdvisoryLock<T>(
  queryRunner: QueryableRunner,
  spec: AdvisoryLockSpec,
  options: AdvisoryLockOptions,
  operation: () => Promise<T>,
): Promise<T> {
  const now = options.now ?? Date.now;
  const sleep = options.sleep ?? defaultSleep;
  const logger = options.logger ?? (() => undefined);
  const startedAt = now();
  const deadline = startedAt + options.timeoutMs;
  let attempt = 0;
  let acquired = false;

  while (!acquired) {
    attempt += 1;
    let rows: Array<{ acquired?: unknown }>;
    try {
      rows = await queryRunner.query(
        'SELECT pg_try_advisory_lock($1::integer, $2::integer) AS acquired',
        [spec.key1, spec.key2],
      ) as Array<{ acquired?: unknown }>;
    } catch {
      throw new ProductionMigrationError('MIGRATION_LOCK_QUERY_FAILED');
    }
    acquired = asBoolean(rows[0]?.acquired);
    if (acquired) break;

    const current = now();
    if (current >= deadline) {
      throw new ProductionMigrationError('MIGRATION_LOCK_TIMEOUT');
    }
    const backoff = Math.min(options.retryMs * (2 ** Math.min(attempt - 1, 3)), 2_000);
    const waitMs = Math.max(1, Math.min(backoff, deadline - current));
    logger({
      event: 'lock_wait',
      runId: options.runId ?? 'unassigned',
      namespace: spec.namespace,
      attempt,
      acquired: false,
      waitedMs: current - startedAt,
    });
    await sleep(waitMs);
  }

  logger({
    event: 'lock_acquired',
    runId: options.runId ?? 'unassigned',
    namespace: spec.namespace,
    attempts: attempt,
    acquired: true,
    waitedMs: now() - startedAt,
  });

  let value: T | undefined;
  let operationFailure: unknown;
  try {
    if ((options.acceptanceHoldMs ?? 0) > 0) {
      logger({
        event: 'acceptance_lock_hold',
        runId: options.runId ?? 'unassigned',
        durationMs: options.acceptanceHoldMs ?? 0,
      });
      await sleep(options.acceptanceHoldMs ?? 0);
    }
    value = await operation();
  } catch (error) {
    operationFailure = error;
  }

  let releaseFailure = false;
  try {
    const rows = await queryRunner.query(
      'SELECT pg_advisory_unlock($1::integer, $2::integer) AS released',
      [spec.key1, spec.key2],
    ) as Array<{ released?: unknown }>;
    releaseFailure = !asBoolean(rows[0]?.released);
  } catch {
    releaseFailure = true;
  }
  logger({
    event: releaseFailure ? 'lock_release_failed' : 'lock_released',
    runId: options.runId ?? 'unassigned',
    namespace: spec.namespace,
    released: !releaseFailure,
  });

  if (operationFailure) throw operationFailure;
  if (releaseFailure) throw new ProductionMigrationError('MIGRATION_LOCK_RELEASE_FAILED');
  return value as T;
}

export function validateProductionMigrationHistory(
  rows: readonly { timestamp: unknown; name: unknown }[],
): ProductionMigrationHistory[] {
  if (rows.length > PRODUCTION_MIGRATIONS.length) {
    throw new ProductionMigrationError('MIGRATION_HISTORY_UNKNOWN');
  }

  return rows.map((row, index) => {
    const timestamp = Number(row.timestamp);
    const name = String(row.name || '');
    if (!Number.isSafeInteger(timestamp) || timestamp > PRODUCTION_MIGRATION_MAX) {
      throw new ProductionMigrationError('MIGRATION_HISTORY_FUTURE');
    }
    const expected = PRODUCTION_MIGRATIONS[index];
    if (!expected || expected.timestamp !== timestamp || expected.name !== name) {
      throw new ProductionMigrationError('MIGRATION_HISTORY_INCOMPATIBLE');
    }
    return { timestamp, name };
  });
}

async function readProductionMigrationHistory(
  queryRunner: QueryableRunner,
): Promise<ProductionMigrationHistory[]> {
  let registration: Array<{ table_name?: unknown }>;
  try {
    registration = await queryRunner.query(
      "SELECT to_regclass('public.doflow_migrations')::text AS table_name",
    ) as Array<{ table_name?: unknown }>;
  } catch {
    throw new ProductionMigrationError('MIGRATION_HISTORY_UNREADABLE');
  }
  if (!registration[0]?.table_name) return [];

  let columns: Array<{
    column_name?: unknown;
    udt_name?: unknown;
    is_nullable?: unknown;
    column_default?: unknown;
  }>;
  try {
    columns = await queryRunner.query(`
      SELECT column_name, udt_name, is_nullable, column_default
        FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'doflow_migrations'
       ORDER BY ordinal_position
    `) as Array<{
      column_name?: unknown;
      udt_name?: unknown;
      is_nullable?: unknown;
      column_default?: unknown;
    }>;
  } catch {
    throw new ProductionMigrationError('MIGRATION_HISTORY_UNREADABLE');
  }

  let primaryKeyColumns: Array<{ column_name?: unknown }>;
  try {
    primaryKeyColumns = await queryRunner.query(`
      SELECT kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON kcu.constraint_catalog = tc.constraint_catalog
         AND kcu.constraint_schema = tc.constraint_schema
         AND kcu.constraint_name = tc.constraint_name
       WHERE tc.table_schema = 'public'
         AND tc.table_name = 'doflow_migrations'
         AND tc.constraint_type = 'PRIMARY KEY'
       ORDER BY kcu.ordinal_position
    `) as Array<{ column_name?: unknown }>;
  } catch {
    throw new ProductionMigrationError('MIGRATION_HISTORY_UNREADABLE');
  }
  if (!validateProductionMigrationTableShape(
    columns,
    primaryKeyColumns.map((column) => String(column.column_name || '')),
  )) {
    throw new ProductionMigrationError('MIGRATION_HISTORY_SCHEMA_INCOMPATIBLE');
  }

  let rows: Array<{ timestamp: unknown; name: unknown }>;
  try {
    rows = await queryRunner.query(
      'SELECT timestamp, name FROM public.doflow_migrations ORDER BY id ASC',
    ) as Array<{ timestamp: unknown; name: unknown }>;
  } catch {
    throw new ProductionMigrationError('MIGRATION_HISTORY_UNREADABLE');
  }
  return validateProductionMigrationHistory(rows);
}

export function validateProductionMigrationTableShape(
  columns: readonly {
    column_name?: unknown;
    udt_name?: unknown;
    is_nullable?: unknown;
    column_default?: unknown;
  }[],
  primaryKeyColumns: readonly string[],
): boolean {
  if (columns.length !== 3 || primaryKeyColumns.length !== 1 || primaryKeyColumns[0] !== 'id') {
    return false;
  }
  const byName = new Map(columns.map((column) => [String(column.column_name || ''), column]));
  const id = byName.get('id');
  const timestamp = byName.get('timestamp');
  const name = byName.get('name');
  if (!id || !timestamp || !name) return false;
  const idDefault = String(id.column_default || '');
  return id.udt_name === 'int4'
    && id.is_nullable === 'NO'
    && /^nextval\(.+doflow_migrations_id_seq.+\)$/.test(idDefault)
    && timestamp.udt_name === 'int8'
    && timestamp.is_nullable === 'NO'
    && (timestamp.column_default === null || timestamp.column_default === undefined)
    && name.udt_name === 'varchar'
    && name.is_nullable === 'NO'
    && (name.column_default === null || name.column_default === undefined);
}

function defaultMigrationExecutorFactory(
  dataSource: DataSource,
  queryRunner: QueryRunner,
): MigrationExecutorAdapter {
  const executor = new MigrationExecutor(dataSource, queryRunner);
  executor.transaction = 'all';
  executor.fake = false;
  return executor;
}

export async function inspectProductionMigrationState(
  dataSource: DataSource,
  queryRunner: QueryRunner,
  createExecutor: MigrationExecutorFactory = defaultMigrationExecutorFactory,
): Promise<ProductionMigrationState> {
  const history = await readProductionMigrationHistory(queryRunner);
  const executor = createExecutor(dataSource, queryRunner);
  executor.transaction = 'all';
  executor.fake = false;
  let pending: readonly string[];
  try {
    pending = (await executor.getPendingMigrations()).map((migration) => migration.name);
  } catch {
    throw new ProductionMigrationError('MIGRATION_PENDING_INSPECTION_FAILED');
  }
  const expectedPending = PRODUCTION_MIGRATIONS.slice(history.length).map((migration) => migration.name);
  if (
    pending.length !== expectedPending.length
    || pending.some((name, index) => name !== expectedPending[index])
  ) {
    throw new ProductionMigrationError('MIGRATION_SOURCE_HISTORY_MISMATCH');
  }
  return {
    migrationMax: history.length > 0 ? history[history.length - 1].timestamp : 0,
    history,
    pending,
    ready: pending.length === 0 && history.length === PRODUCTION_MIGRATIONS.length,
  };
}

async function releaseRuntimeResources(
  dataSource: DataSource | undefined,
  queryRunner: QueryRunner | undefined,
): Promise<boolean> {
  let failed = false;
  if (queryRunner && !queryRunner.isReleased) {
    try {
      await queryRunner.release();
    } catch {
      failed = true;
    }
  }
  if (dataSource?.isInitialized) {
    try {
      await dataSource.destroy();
    } catch {
      failed = true;
    }
  }
  return failed;
}

export async function runProductionMigrationCommand(
  options: RuntimeOptions = {},
): Promise<ProductionMigrationResult> {
  const mode = options.mode ?? 'run';
  if (mode !== 'run' && mode !== 'status') {
    throw new ProductionMigrationError('MIGRATION_MODE_INVALID');
  }
  const dependencies = options.dependencies ?? {};
  const logger = dependencies.logger ?? consoleSafeMigrationLogger;
  const now = dependencies.now ?? Date.now;
  const sleep = dependencies.sleep ?? defaultSleep;
  const runId = dependencies.runId?.() ?? randomUUID();
  const startedAt = now();
  const config = resolveProductionMigrationConfig(options.env, {
    migrationsDirectory: options.migrationsDirectory,
  });
  logger({
    event: 'config_validated',
    runId,
    mode,
    environment: config.environment,
    host: config.hostClassification,
    database: config.databaseClassification,
    compiledMigrations: config.migrationFiles.length,
    migrationMax: PRODUCTION_MIGRATION_MAX,
    dbSync: false,
  });

  const createDataSource = dependencies.createDataSource ?? createProductionMigrationDataSource;
  const createExecutor = dependencies.createExecutor ?? defaultMigrationExecutorFactory;
  let dataSource: DataSource | undefined;
  let queryRunner: QueryRunner | undefined;
  let result: ProductionMigrationResult | undefined;
  let failure: unknown;

  try {
    dataSource = createDataSource(config);
    try {
      await dataSource.initialize();
      queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
    } catch {
      throw new ProductionMigrationError('DATASOURCE_INITIALIZATION_FAILED');
    }
    logger({ event: 'database_connected', runId });

    if (mode === 'status') {
      const state = await inspectProductionMigrationState(dataSource, queryRunner, createExecutor);
      result = {
        verdict: state.ready ? 'PRODUCTION MIGRATIONS READY' : 'PRODUCTION MIGRATIONS PENDING',
        runId,
        mode,
        status: 'read-only',
        migrationMaxBefore: state.migrationMax,
        migrationMaxAfter: state.migrationMax,
        pendingBefore: state.pending.length,
        pendingAfter: state.pending.length,
        applied: [],
        advisoryLock: false,
        ready: state.ready,
        durationMs: now() - startedAt,
      };
    } else {
      result = await withPostgresAdvisoryLock(
        queryRunner,
        PRODUCTION_MIGRATION_LOCK,
        {
          timeoutMs: config.lockTimeoutMs,
          retryMs: config.lockRetryMs,
          acceptanceHoldMs: config.acceptanceHoldLockMs,
          logger,
          runId,
          now,
          sleep,
        },
        async () => {
          const before = await inspectProductionMigrationState(dataSource as DataSource, queryRunner as QueryRunner, createExecutor);
          logger({
            event: 'migration_plan',
            runId,
            migrationMaxBefore: before.migrationMax,
            pending: before.pending,
          });
          const executor = createExecutor(dataSource as DataSource, queryRunner as QueryRunner);
          executor.transaction = 'all';
          executor.fake = false;
          let applied: readonly string[];
          try {
            applied = (await executor.executePendingMigrations()).map((migration) => migration.name);
          } catch {
            throw new ProductionMigrationError('MIGRATION_EXECUTION_FAILED');
          }
          const after = await inspectProductionMigrationState(dataSource as DataSource, queryRunner as QueryRunner, createExecutor);
          if (!after.ready || after.pending.length > 0 || after.migrationMax !== PRODUCTION_MIGRATION_MAX) {
            throw new ProductionMigrationError('MIGRATION_POST_RUN_VERIFICATION_FAILED');
          }
          return {
            verdict: 'PRODUCTION MIGRATIONS GO' as const,
            runId,
            mode,
            status: applied.length === 0 ? 'no-op' as const : 'applied' as const,
            migrationMaxBefore: before.migrationMax,
            migrationMaxAfter: after.migrationMax,
            pendingBefore: before.pending.length,
            pendingAfter: after.pending.length,
            applied,
            advisoryLock: true,
            ready: true,
            durationMs: now() - startedAt,
          };
        },
      );
    }
  } catch (error) {
    failure = error instanceof ProductionMigrationError
      ? error
      : new ProductionMigrationError('PRODUCTION_MIGRATION_FAILED');
  }

  const cleanupFailed = await releaseRuntimeResources(dataSource, queryRunner);
  if (cleanupFailed) {
    logger({ event: 'cleanup_failed', runId });
    if (!failure) failure = new ProductionMigrationError('MIGRATION_RESOURCE_CLEANUP_FAILED');
  }
  if (failure) throw failure;

  logger({
    event: 'complete',
    runId,
    verdict: result?.verdict ?? 'PRODUCTION MIGRATIONS GO',
    mode,
    status: result?.status ?? 'no-op',
    migrationMaxBefore: result?.migrationMaxBefore ?? 0,
    migrationMaxAfter: result?.migrationMaxAfter ?? 0,
    pendingBefore: result?.pendingBefore ?? 0,
    pendingAfter: result?.pendingAfter ?? 0,
    ready: result?.ready ?? false,
    applied: result?.applied ?? [],
    durationMs: result?.durationMs ?? now() - startedAt,
  });
  return result as ProductionMigrationResult;
}
