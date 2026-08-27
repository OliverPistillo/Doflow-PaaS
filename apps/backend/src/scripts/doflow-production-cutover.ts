import 'reflect-metadata';

import { randomUUID } from 'crypto';
import { mkdir, rename, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { dirname, join } from 'path';
import type { DataSource, QueryRunner } from 'typeorm';
import { mapDoflowAutomationPerformanceLegacy } from './map-doflow-automation-performance-legacy';
import { mapDoflowCollaborationLegacy } from './map-doflow-collaboration-legacy';
import { mapDoflowCommerceLegacy } from './map-doflow-commerce-legacy';
import { mapDoflowDeliveryLegacy } from './map-doflow-delivery-legacy';
import {
  captureDoflowCutoverSnapshot,
  compareCeoPreservation,
  compareSecondTenantPreservation,
  DoflowCutoverSnapshot,
  shortCutoverFingerprint,
} from './doflow-cutover-snapshot';
import { PRODUCTION_MIGRATION_MAX } from './production-migration-manifest';
import {
  createProductionMigrationDataSource,
  inspectProductionMigrationState,
  ProductionMigrationConfig,
  ProductionMigrationState,
  redactSensitiveText,
  resolveProductionMigrationConfig,
  withPostgresAdvisoryLock,
} from './production-migration-runtime';
import { runDoflowTenantSeed } from './seed-doflow-tenant';

export type DoflowCutoverMode = 'status' | 'dry-run' | 'apply' | 'verify';

export type DoflowCutoverOptions = {
  mode: DoflowCutoverMode;
  tenant: 'doflow';
  tenantExplicit: boolean;
  confirm?: string;
  backupRef?: string;
};

type SafeMapperPass = {
  commercial: { mode: 'not-required'; reason: string };
  delivery: Record<string, unknown>;
  commerce: Record<string, unknown>;
  documentRevenue: { mode: 'not-required'; reason: string };
  collaboration: Record<string, unknown>;
  automationPerformance: Record<string, unknown>;
};

const CUTOVER_LOCK = Object.freeze({
  namespace: 'doflow-production-cutover-v1',
  key1: 1149461538,
  key2: 1121973940,
});

const APPLY_CONFIRMATION = 'APPLY_DOFLOW_PRODUCTION_CUTOVER';
const BACKUP_REF_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:-]{5,127}$/;

export class DoflowCutoverError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = 'DoflowCutoverError';
  }
}

export function parseDoflowCutoverOptions(argv: string[]): DoflowCutoverOptions {
  const positional = argv.filter((arg) => !arg.startsWith('--'));
  if (positional.length > 1) throw new DoflowCutoverError('CUTOVER_MODE_INVALID');
  const mode = (positional[0] || 'dry-run') as DoflowCutoverMode;
  if (!['status', 'dry-run', 'apply', 'verify'].includes(mode)) {
    throw new DoflowCutoverError('CUTOVER_MODE_INVALID');
  }
  const tenantArg = argv.find((arg) => arg.startsWith('--tenant='));
  const tenantValue = (tenantArg?.slice('--tenant='.length) || 'doflow').trim().toLowerCase();
  if (tenantValue !== 'doflow') throw new DoflowCutoverError('CUTOVER_TENANT_FORBIDDEN');
  return {
    mode,
    tenant: 'doflow',
    tenantExplicit: Boolean(tenantArg),
    confirm: argv.find((arg) => arg.startsWith('--confirm='))?.slice('--confirm='.length),
    backupRef: argv.find((arg) => arg.startsWith('--backup-ref='))?.slice('--backup-ref='.length),
  };
}

export function assertDoflowCutoverSafety(
  options: DoflowCutoverOptions,
  env: NodeJS.ProcessEnv,
  config?: Pick<ProductionMigrationConfig, 'environment' | 'hostClassification' | 'databaseClassification'>,
) {
  if (String(env.DB_SYNC || '').trim().toLowerCase() === 'true') {
    throw new DoflowCutoverError('CUTOVER_DB_SYNC_FORBIDDEN');
  }
  if (options.mode !== 'apply') return;
  if (!options.tenantExplicit) throw new DoflowCutoverError('CUTOVER_TENANT_EXPLICIT_REQUIRED');
  if (options.confirm !== APPLY_CONFIRMATION) throw new DoflowCutoverError('CUTOVER_CONFIRMATION_REQUIRED');
  if (!options.backupRef || !BACKUP_REF_PATTERN.test(options.backupRef)) {
    throw new DoflowCutoverError('CUTOVER_BACKUP_REF_REQUIRED');
  }

  const nodeEnv = String(env.NODE_ENV || '').trim().toLowerCase();
  const acceptance = nodeEnv === 'test' && env.DOFLOW_CUTOVER_ACCEPTANCE === '1';
  if (nodeEnv !== 'production' && !acceptance) {
    throw new DoflowCutoverError('CUTOVER_ENVIRONMENT_FORBIDDEN');
  }
  if (acceptance && config) {
    if (config.databaseClassification !== 'acceptance' || config.hostClassification === 'remote') {
      throw new DoflowCutoverError('CUTOVER_ACCEPTANCE_DATABASE_FORBIDDEN');
    }
  }
}

function assertMigrationReady(state: ProductionMigrationState) {
  if (!state.ready || state.migrationMax !== PRODUCTION_MIGRATION_MAX || state.pending.length > 0) {
    throw new DoflowCutoverError('CUTOVER_MIGRATIONS_NOT_READY');
  }
}

function safeDeliveryReport(report: Awaited<ReturnType<typeof mapDoflowDeliveryLegacy>>) {
  return {
    mode: report.mode,
    total: report.total,
    statusCounts: report.statusCounts,
    mappings: report.mappings,
    applicableCount: report.applicableCount,
    ambiguousCount: report.ambiguousCount,
    unknownCount: report.unknownCount,
    appliedCount: report.appliedCount,
    preservation: report.preservation,
    inventedHistory: report.inventedHistory,
    inventedQa: report.inventedQa,
    inventedTimers: report.inventedTimers,
  };
}

async function runMapperPass(dataSource: DataSource, apply: boolean): Promise<SafeMapperPass> {
  const delivery = await mapDoflowDeliveryLegacy(dataSource, { target: 'doflow', apply });
  const commerce = await mapDoflowCommerceLegacy(dataSource, { target: 'doflow', apply });
  const collaboration = await mapDoflowCollaborationLegacy(dataSource, { tenant: 'doflow', apply });
  const automationPerformance = await mapDoflowAutomationPerformanceLegacy(dataSource, { tenant: 'doflow', apply });
  return {
    commercial: {
      mode: 'not-required',
      reason: 'Migration 179 is additive and preserves legacy Commercial UUIDs and relations.',
    },
    delivery: safeDeliveryReport(delivery),
    commerce,
    documentRevenue: {
      mode: 'not-required',
      reason: 'Migration 182 is additive and does not reinterpret quotes, invoices or contracts.',
    },
    collaboration,
    automationPerformance,
  };
}

async function withReadOnlyCutoverTransaction<T>(
  dataSource: DataSource,
  operation: (runner: QueryRunner) => Promise<T>,
) {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    await runner.startTransaction('REPEATABLE READ');
    await runner.query('SET TRANSACTION READ ONLY');
    const value = await operation(runner);
    await runner.rollbackTransaction();
    return value;
  } catch (error) {
    if (runner.isTransactionActive) await runner.rollbackTransaction().catch(() => undefined);
    throw error;
  } finally {
    await runner.release();
  }
}

async function inspectMigrationState(dataSource: DataSource) {
  const runner = dataSource.createQueryRunner();
  await runner.connect();
  try {
    return await inspectProductionMigrationState(dataSource, runner);
  } finally {
    await runner.release();
  }
}

function safeMigrationState(state: ProductionMigrationState) {
  return {
    migrationMax: state.migrationMax,
    pending: [...state.pending],
    pendingCount: state.pending.length,
    ready: state.ready,
  };
}

async function readOnlyMode(
  dataSource: DataSource,
  mode: Exclude<DoflowCutoverMode, 'apply'>,
  migrationState: ProductionMigrationState,
) {
  return withReadOnlyCutoverTransaction(dataSource, async (runner) => {
    const snapshot = await captureDoflowCutoverSnapshot(runner);
    const mappers = snapshot.tenant.schemaPresent
      ? await runMapperPass(runner as unknown as DataSource, false)
      : { available: false, reason: 'Doflow schema is missing.' };
    const ready = migrationState.ready
      && migrationState.migrationMax === PRODUCTION_MIGRATION_MAX
      && migrationState.pending.length === 0
      && snapshot.reconciliation.ready;
    return {
      verdict: ready ? `DOFLOW CUTOVER ${mode.toUpperCase()} GO` : `DOFLOW CUTOVER ${mode.toUpperCase()} BLOCKED`,
      mode,
      readOnly: true,
      migration: safeMigrationState(migrationState),
      mappers,
      snapshot,
      seed: { ready: snapshot.tenant.bindingValid && snapshot.reconciliation.ceoPresent },
      reconciliation: snapshot.reconciliation,
    };
  });
}

function stableBusinessFingerprint(snapshot: DoflowCutoverSnapshot) {
  return shortCutoverFingerprint({
    tenant: snapshot.tenant,
    ceo: snapshot.ceo,
    counts: snapshot.counts,
    economics: snapshot.economics,
    relations: snapshot.relations,
    duplicates: snapshot.duplicates,
    registries: snapshot.registries,
    secondTenant: snapshot.secondTenant,
  });
}

async function applyCutover(
  dataSource: DataSource,
  config: ProductionMigrationConfig,
  options: DoflowCutoverOptions,
  runId: string,
) {
  const lockRunner = dataSource.createQueryRunner();
  await lockRunner.connect();
  const lockEvents: Array<Record<string, unknown>> = [];
  try {
    return await withPostgresAdvisoryLock(
      lockRunner,
      CUTOVER_LOCK,
      {
        timeoutMs: config.lockTimeoutMs,
        retryMs: config.lockRetryMs,
        runId,
        logger: (record) => lockEvents.push({ ...record }),
      },
      async () => {
        const migrationBefore = await inspectProductionMigrationState(dataSource, lockRunner);
        assertMigrationReady(migrationBefore);
        const before = await captureDoflowCutoverSnapshot(dataSource);
        if (!before.reconciliation.ceoPresent) throw new DoflowCutoverError('CUTOVER_CEO_PRECONDITION_FAILED');

        const mapperFirst = await runMapperPass(dataSource, true);
        const afterMapperFirst = await captureDoflowCutoverSnapshot(dataSource);
        const mapperSecond = await runMapperPass(dataSource, true);
        const afterMapperSecond = await captureDoflowCutoverSnapshot(dataSource);
        const mapperIdempotent = stableBusinessFingerprint(afterMapperFirst) === stableBusinessFingerprint(afterMapperSecond);
        if (!mapperIdempotent) throw new DoflowCutoverError('CUTOVER_MAPPER_NOT_IDEMPOTENT');

        const seedFirst = await runDoflowTenantSeed(dataSource, {
          ceoPolicy: 'require-existing-preserve',
          updateRedis: false,
        });
        const afterSeedFirst = await captureDoflowCutoverSnapshot(dataSource);
        const seedSecond = await runDoflowTenantSeed(dataSource, {
          ceoPolicy: 'require-existing-preserve',
          updateRedis: false,
        });
        const after = await captureDoflowCutoverSnapshot(dataSource);
        const seedIdempotent = stableBusinessFingerprint(afterSeedFirst) === stableBusinessFingerprint(after);
        if (!seedIdempotent) throw new DoflowCutoverError('CUTOVER_SEED_NOT_IDEMPOTENT');

        // The canonical seed may create records that are themselves eligible for
        // an accepted legacy adapter (for example automation rule versions).
        // Reconcile those records before declaring the one-shot cutover complete,
        // then prove that the reconciliation pass is itself a no-op.
        const mapperPostSeedFirst = await runMapperPass(dataSource, true);
        const afterMapperPostSeedFirst = await captureDoflowCutoverSnapshot(dataSource);
        const mapperPostSeedSecond = await runMapperPass(dataSource, true);
        const afterMapperPostSeedSecond = await captureDoflowCutoverSnapshot(dataSource);
        const mapperPostSeedIdempotent = stableBusinessFingerprint(afterMapperPostSeedFirst)
          === stableBusinessFingerprint(afterMapperPostSeedSecond);
        if (!mapperPostSeedIdempotent) {
          throw new DoflowCutoverError('CUTOVER_POST_SEED_MAPPER_NOT_IDEMPOTENT');
        }

        const ceoPreservation = compareCeoPreservation(before.ceo, afterMapperPostSeedSecond.ceo);
        if (!ceoPreservation.preserved) throw new DoflowCutoverError('CUTOVER_CEO_PRESERVATION_FAILED');
        const secondTenant = compareSecondTenantPreservation(before.secondTenant, afterMapperPostSeedSecond.secondTenant);
        if (!secondTenant.preserved) throw new DoflowCutoverError('CUTOVER_SECOND_TENANT_CHANGED');
        if (!afterMapperPostSeedSecond.reconciliation.ready) {
          throw new DoflowCutoverError('CUTOVER_RECONCILIATION_FAILED');
        }

        const migrationAfter = await inspectProductionMigrationState(dataSource, lockRunner);
        assertMigrationReady(migrationAfter);
        return {
          verdict: 'DOFLOW CUTOVER APPLY GO',
          mode: 'apply' as const,
          readOnly: false,
          runId,
          backupRef: { present: true, fingerprint: shortCutoverFingerprint(options.backupRef) },
          migration: {
            before: safeMigrationState(migrationBefore),
            after: safeMigrationState(migrationAfter),
          },
          advisoryLock: { acquired: true, namespace: CUTOVER_LOCK.namespace, events: lockEvents },
          mappers: {
            first: mapperFirst,
            second: mapperSecond,
            idempotent: mapperIdempotent,
            postSeedFirst: mapperPostSeedFirst,
            postSeedSecond: mapperPostSeedSecond,
            postSeedIdempotent: mapperPostSeedIdempotent,
          },
          seed: { first: seedFirst, second: seedSecond, idempotent: seedIdempotent },
          ceoPreservation,
          secondTenant,
          reconciliation: afterMapperPostSeedSecond.reconciliation,
          snapshot: {
            before: before.fingerprint,
            afterSeed: after.fingerprint,
            after: afterMapperPostSeedSecond.fingerprint,
            final: afterMapperPostSeedSecond,
          },
        };
      },
    );
  } finally {
    await lockRunner.release();
  }
}

export async function runDoflowProductionCutover(
  options: DoflowCutoverOptions,
  env: NodeJS.ProcessEnv = process.env,
) {
  const runId = randomUUID();
  const startedAt = Date.now();
  assertDoflowCutoverSafety(options, env);
  const config = resolveProductionMigrationConfig(env);
  assertDoflowCutoverSafety(options, env, config);
  const dataSource = createProductionMigrationDataSource(config);
  await dataSource.initialize();
  try {
    const migrationState = await inspectMigrationState(dataSource);
    const result = options.mode === 'apply'
      ? await applyCutover(dataSource, config, options, runId)
      : await readOnlyMode(dataSource, options.mode, migrationState);
    return {
      ...result,
      runId,
      tenant: 'doflow',
      environment: config.environment,
      host: config.hostClassification,
      database: config.databaseClassification,
      dbSync: false,
      durationMs: Date.now() - startedAt,
    };
  } finally {
    await dataSource.destroy();
  }
}

function safeCutoverError(error: unknown) {
  const code = error instanceof DoflowCutoverError
    ? error.code
    : error && typeof error === 'object' && 'code' in error
      ? String((error as { code?: unknown }).code || 'DOFLOW_CUTOVER_FAILED')
      : 'DOFLOW_CUTOVER_FAILED';
  return redactSensitiveText(code).slice(0, 160);
}

export async function writeDoflowCutoverReport(
  result: Record<string, unknown>,
  env: NodeJS.ProcessEnv = process.env,
) {
  const configuredPath = String(env.DOFLOW_CUTOVER_REPORT_PATH || '').trim();
  const runId = String(result.runId || randomUUID()).replace(/[^A-Za-z0-9-]/g, '');
  const reportPath = configuredPath || join(tmpdir(), `doflow-production-cutover-${runId}.json`);
  const temporaryPath = `${reportPath}.${process.pid}.${Date.now()}.tmp`;
  await mkdir(dirname(reportPath), { recursive: true });
  await writeFile(temporaryPath, `${JSON.stringify(result, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
    flag: 'wx',
  });
  await rename(temporaryPath, reportPath);
  return { stored: true, location: configuredPath ? 'configured' : 'temporary' } as const;
}

if (require.main === module) {
  const options = (() => {
    try {
      return parseDoflowCutoverOptions(process.argv.slice(2));
    } catch (error) {
      process.stdout.write(`${JSON.stringify({ verdict: 'DOFLOW PRODUCTION CUTOVER BLOCKED', error: safeCutoverError(error) })}\n`);
      process.exitCode = 1;
      return null;
    }
  })();
  if (options) {
    void runDoflowProductionCutover(options).then(async (result) => {
      const report = await writeDoflowCutoverReport(result as unknown as Record<string, unknown>);
      process.stdout.write(`${JSON.stringify({ ...result, report })}\n`);
      if (String(result.verdict).endsWith('BLOCKED')) process.exitCode = 1;
    }).catch((error) => {
      process.stdout.write(`${JSON.stringify({ verdict: 'DOFLOW PRODUCTION CUTOVER BLOCKED', error: safeCutoverError(error) })}\n`);
      process.exitCode = 1;
    });
  }
}
