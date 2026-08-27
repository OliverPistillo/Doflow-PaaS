import 'reflect-metadata';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { createHash, randomUUID } from 'crypto';
import { DataSource, QueryRunner } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantAuthSupportTables } from '../auth/auth-schema';
import { ensureTenantCrmCoreTables } from '../tenant/tenant-crm-schema';
import { ensureTenantBriefingQuoteTables } from '../tenant/tenant-briefing-quotes-schema';
import { ensureTenantProjectsTables } from '../tenant/tenant-projects-schema';
import { ensureTenantFinanceTables } from '../tenant/tenant-finance-schema';
import { ensureTenantNotificationsTables } from '../tenant/tenant-notifications-schema';
import { ensureTenantDocumentsTables } from '../tenant/tenant-documents-schema';
import { ensureTenantTeamTables } from '../tenant/tenant-team-schema';
import { ensureTenantReportsTables } from '../tenant/tenant-reports-schema';
import { ensureTenantContractsTables } from '../tenant/tenant-contracts-schema';
import { ensureTenantAutomationsTables } from '../tenant/tenant-automations-schema';
import { ensureTenantCalendarTables } from '../tenant/tenant-calendar-schema';
import { ensureTenantKnowledgeTables } from '../tenant/tenant-knowledge-schema';
import { ensureTenantCredentialsTables } from '../tenant/tenant-credentials-schema';
import { ensureDoflowRecordOperationsTables } from '../tenant/tenant-record-operations-schema';
import { ensureDoflowTimelineSchema } from '../tenant/tenant-timeline-schema';
import { ensureDoflowWorkspaceTables } from '../tenant/tenant-doflow-workspace.service';
import { ensureDoflowCommerceTables } from '../tenant/tenant-doflow-commerce-schema';
import { ensureDoflowCollaborationTables } from '../tenant/tenant-doflow-collaboration-schema';

const TARGET_TENANT = 'doflow';
const MIGRATION_KEY = 'doflow-reference-canonical-v1';

const DOMAIN_TABLES = {
  users: 'users',
  team: 'team_members',
  companies: 'companies',
  contacts: 'contacts',
  leads: 'leads',
  opportunities: 'opportunities',
  clients: 'companies',
  activities: 'commercial_activities',
  projects: 'projects',
  tasks: 'tasks',
  milestones: 'milestones',
  quotes: 'quotes',
  contracts: 'contracts',
  invoices: 'invoices',
  payments: 'payments',
  renewals: 'renewals',
  documents: 'documents',
  timeline: 'commercial_activities',
  audit: 'audit_log',
  notifications: 'notifications',
  automations: 'automation_rules',
} as const;

const STATE_COLUMNS: Record<string, string> = {
  leads: 'status',
  opportunities: 'stage',
  projects: 'status',
  tasks: 'status',
  milestones: 'status',
  quotes: 'status',
  contracts: 'status',
  invoices: 'status',
  payments: 'status',
  renewals: 'status',
  documents: 'status',
};

export type MigrationOptions = {
  apply: boolean;
  confirm: string | null;
  target: string;
};

type TableSnapshot = {
  exists: boolean;
  count: number;
  checksum: string;
};

type MigrationReport = {
  migrationKey: string;
  runId: string;
  target: string;
  mode: 'dry-run' | 'apply';
  status: 'ok' | 'failed';
  startedAt: string;
  completedAt: string;
  schemaVerified: boolean;
  transactionRolledBack: boolean;
  identityMapping: Record<string, { sourceTable: string; targetTable: string }>;
  before: Record<string, TableSnapshot>;
  after: Record<string, TableSnapshot>;
  stateDistributions: Record<string, Record<string, number>>;
  ambiguousStates: Record<string, number>;
  ceoIdentityChecksumsPreserved: boolean;
  reconciliationChecksum: string;
  notes: string[];
  error?: string;
};

dotenv.config({ path: path.resolve(process.cwd(), '.env'), override: false });
dotenv.config({
  path: path.resolve(process.cwd(), '..', '..', '.env'),
  override: false,
});

export function parseMigrationOptions(args: string[]): MigrationOptions {
  const targetArg = args.find((arg) => arg.startsWith('--target='));
  const confirmArg = args.find((arg) => arg.startsWith('--confirm='));
  const target = (targetArg?.slice('--target='.length) || TARGET_TENANT)
    .trim()
    .toLowerCase();
  if (target !== TARGET_TENANT) {
    throw new Error('Migration target must be exactly doflow');
  }
  return {
    apply: args.includes('--apply'),
    confirm: confirmArg?.slice('--confirm='.length).trim().toLowerCase() || null,
    target,
  };
}

export function assertApplySafety(options: MigrationOptions) {
  if (!options.apply) return;
  if (options.confirm !== TARGET_TENANT) {
    throw new Error('Apply requires --confirm=doflow');
  }
  if (String(process.env.DB_SYNC || '').toLowerCase() !== 'false') {
    throw new Error('Apply requires DB_SYNC=false');
  }
  if (String(process.env.NODE_ENV || '').toLowerCase() === 'production') {
    throw new Error('Apply is disabled when NODE_ENV=production');
  }
  if (process.env.DOFLOW_MIGRATION_ALLOW_APPLY !== 'doflow-staging') {
    throw new Error(
      'Apply requires DOFLOW_MIGRATION_ALLOW_APPLY=doflow-staging',
    );
  }
}

function requireDatabaseUrl() {
  const value = process.env.DATABASE_URL?.trim();
  if (!value) throw new Error('DATABASE_URL is required');
  return value;
}

function safeError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Migration failed';
  return message
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[redacted-database-url]')
    .replace(/(password|token|secret)=([^&\s]+)/gi, '$1=[redacted]');
}

async function tableExists(runner: QueryRunner, schema: string, table: string) {
  const rows = await runner.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2
     ) AS present`,
    [schema, table],
  );
  return rows[0]?.present === true;
}

async function columnExists(
  runner: QueryRunner,
  schema: string,
  table: string,
  column: string,
) {
  const rows = await runner.query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
     ) AS present`,
    [schema, table, column],
  );
  return rows[0]?.present === true;
}

async function snapshotTable(
  runner: QueryRunner,
  schema: string,
  table: string,
): Promise<TableSnapshot> {
  if (!(await tableExists(runner, schema, table))) {
    return { exists: false, count: 0, checksum: '' };
  }
  const hasId = await columnExists(runner, schema, table, 'id');
  const rows = await runner.query(
    hasId
      ? `SELECT COUNT(*)::int AS count,
                md5(COUNT(*)::text || ':' || COALESCE(MIN(id::text), '') || ':' || COALESCE(MAX(id::text), '')) AS checksum
           FROM "${schema}"."${table}"`
      : `SELECT COUNT(*)::int AS count, md5(COUNT(*)::text) AS checksum
           FROM "${schema}"."${table}"`,
  );
  return {
    exists: true,
    count: Number(rows[0]?.count || 0),
    checksum: String(rows[0]?.checksum || ''),
  };
}

async function snapshotDomains(runner: QueryRunner, schema: string) {
  // A QueryRunner owns a single pg client: keep its queries sequential so the
  // acceptance migration never issues concurrent work on that connection.
  const entries: Array<[string, TableSnapshot]> = [];
  for (const [domain, table] of Object.entries(DOMAIN_TABLES)) {
    entries.push([domain, await snapshotTable(runner, schema, table)]);
  }
  return Object.fromEntries(entries) as Record<string, TableSnapshot>;
}

async function snapshotStates(runner: QueryRunner, schema: string) {
  const distributions: Record<string, Record<string, number>> = {};
  const ambiguous: Record<string, number> = {};
  for (const [table, column] of Object.entries(STATE_COLUMNS)) {
    if (
      !(await tableExists(runner, schema, table)) ||
      !(await columnExists(runner, schema, table, column))
    ) {
      continue;
    }
    const rows = await runner.query(
      `SELECT COALESCE(NULLIF(TRIM(${column}::text), ''), '__ambiguous__') AS state,
              COUNT(*)::int AS count
         FROM "${schema}"."${table}"
        GROUP BY 1
        ORDER BY 1`,
    );
    distributions[table] = Object.fromEntries(
      rows.map((row: any) => [String(row.state), Number(row.count || 0)]),
    );
    ambiguous[table] = Number(distributions[table].__ambiguous__ || 0);
  }
  return { distributions, ambiguous };
}

async function ceoIdentityChecksums(runner: QueryRunner, schema: string) {
  if (!(await tableExists(runner, schema, 'users'))) return [];
  const rows = await runner.query(
    `SELECT id::text AS id,
            md5(COALESCE(password_hash, '') || ':' || COALESCE(auth_provider, '') || ':' ||
                COALESCE(google_id, '') || ':' || COALESCE(mfa_enabled::text, '') || ':' ||
                COALESCE(mfa_secret, '') || ':' || COALESCE(email_verified_at::text, '') || ':' ||
                COALESCE(is_active::text, '') || ':' || COALESCE(role, '')) AS identity_checksum
       FROM "${schema}".users
      WHERE lower(role) = 'owner' AND is_active = true
      ORDER BY lower(email)`,
  );
  return rows.map((row: any) => ({
    id: String(row.id),
    identityChecksum: String(row.identity_checksum),
  }));
}

async function verifyTarget(runner: QueryRunner) {
  const schema = safeSchema(TARGET_TENANT, 'migrateDoflowReference');
  const schemas = await runner.query(
    `SELECT EXISTS (SELECT 1 FROM information_schema.schemata WHERE schema_name = $1) AS present`,
    [schema],
  );
  if (!schemas[0]?.present) throw new Error('Target schema doflow is missing');
  const tenants = await runner.query(
    `SELECT slug, schema_name FROM public.tenants
      WHERE slug = $1 AND schema_name = $1 AND is_active = true
      LIMIT 1`,
    [TARGET_TENANT],
  );
  if (!tenants[0]) throw new Error('Active doflow tenant binding is missing');
  return schema;
}

async function applyCanonicalSchema(runner: QueryRunner, schema: string) {
  const transactionalDataSource = runner as unknown as DataSource;
  await ensureTenantAuthSupportTables(transactionalDataSource, schema);
  await ensureTenantCrmCoreTables(transactionalDataSource, schema);
  await ensureTenantBriefingQuoteTables(transactionalDataSource, schema);
  await ensureTenantProjectsTables(transactionalDataSource, schema);
  await ensureTenantFinanceTables(transactionalDataSource, schema);
  await ensureTenantNotificationsTables(transactionalDataSource, schema);
  await ensureTenantDocumentsTables(transactionalDataSource, schema);
  await ensureTenantTeamTables(transactionalDataSource, schema);
  await ensureTenantReportsTables(transactionalDataSource, schema);
  await ensureTenantContractsTables(transactionalDataSource, schema);
  await ensureTenantAutomationsTables(transactionalDataSource, schema);
  await ensureTenantCalendarTables(transactionalDataSource, schema);
  await ensureTenantKnowledgeTables(transactionalDataSource, schema);
  await ensureTenantCredentialsTables(transactionalDataSource, schema);
  await ensureDoflowRecordOperationsTables(transactionalDataSource, schema);
  await ensureDoflowTimelineSchema(transactionalDataSource, schema);
  await ensureDoflowWorkspaceTables(transactionalDataSource, schema);
  await ensureDoflowCommerceTables(transactionalDataSource, schema);
  await ensureDoflowCollaborationTables(transactionalDataSource, schema);

  await runner.query(`
    CREATE TABLE IF NOT EXISTS "${schema}".doflow_migration_runs (
      migration_key TEXT PRIMARY KEY,
      last_run_id UUID NOT NULL,
      run_count INTEGER NOT NULL DEFAULT 1,
      reconciliation JSONB NOT NULL DEFAULT '{}'::jsonb,
      completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

function reconciliationChecksum(snapshot: Record<string, TableSnapshot>) {
  const canonical = Object.entries(snapshot)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([domain, value]) => `${domain}:${value.exists}:${value.count}:${value.checksum}`)
    .join('|');
  return createHash('sha256').update(canonical).digest('hex');
}

function identityMapping() {
  return Object.fromEntries(
    Object.entries(DOMAIN_TABLES).map(([domain, table]) => [
      domain,
      { sourceTable: table, targetTable: table },
    ]),
  );
}

function printHuman(report: MigrationReport) {
  const changedDomains = Object.keys(report.after).filter(
    (domain) =>
      report.before[domain]?.count !== report.after[domain]?.count ||
      report.before[domain]?.checksum !== report.after[domain]?.checksum,
  );
  process.stdout.write(
    [
      `[migrate:doflow] ${report.mode} ${report.status}`,
      `[migrate:doflow] target=${report.target} schemaVerified=${report.schemaVerified}`,
      `[migrate:doflow] identity mappings=${Object.keys(report.identityMapping).length}`,
      `[migrate:doflow] changed domains=${changedDomains.length ? changedDomains.join(',') : 'none'}`,
      `[migrate:doflow] CEO identity preserved=${report.ceoIdentityChecksumsPreserved}`,
      `[migrate:doflow] reconciliation=${report.reconciliationChecksum}`,
    ].join('\n') + '\n',
  );
  process.stdout.write(`${JSON.stringify(report)}\n`);
}

export async function runMigration(options: MigrationOptions) {
  assertApplySafety(options);
  const startedAt = new Date().toISOString();
  const runId = randomUUID();
  const dataSource = new DataSource({
    type: 'postgres',
    url: requireDatabaseUrl(),
    synchronize: false,
    logging: false,
  });
  await dataSource.initialize();
  const runner = dataSource.createQueryRunner();
  let rolledBack = false;
  let report: MigrationReport | null = null;
  try {
    await runner.connect();
    await runner.startTransaction(options.apply ? 'SERIALIZABLE' : 'REPEATABLE READ');
    if (!options.apply) {
      await runner.query('SET TRANSACTION READ ONLY');
    }
    const schema = await verifyTarget(runner);
    const before = await snapshotDomains(runner, schema);
    const beforeCeo = await ceoIdentityChecksums(runner, schema);
    if (options.apply) {
      await applyCanonicalSchema(runner, schema);
      if (
        process.env.NODE_ENV === 'test' &&
        process.env.DOFLOW_MIGRATION_TEST_FAIL_AFTER_SCHEMA === '1'
      ) {
        throw new Error('Injected migration rollback test');
      }
    }
    const after = await snapshotDomains(runner, schema);
    const afterCeo = await ceoIdentityChecksums(runner, schema);
    const ceoPreserved = JSON.stringify(beforeCeo) === JSON.stringify(afterCeo);
    if (!ceoPreserved) throw new Error('CEO identity reconciliation failed');
    const stateSnapshot = await snapshotStates(runner, schema);
    const checksum = reconciliationChecksum(after);

    if (options.apply) {
      await runner.query(
        `INSERT INTO "${schema}".doflow_migration_runs
          (migration_key, last_run_id, run_count, reconciliation, completed_at)
         VALUES ($1, $2, 1, $3::jsonb, now())
         ON CONFLICT (migration_key) DO UPDATE
           SET last_run_id = excluded.last_run_id,
               run_count = "${schema}".doflow_migration_runs.run_count + 1,
               reconciliation = excluded.reconciliation,
               completed_at = now()`,
        [MIGRATION_KEY, runId, JSON.stringify({ checksum, domains: after })],
      );
      await runner.commitTransaction();
    } else {
      await runner.rollbackTransaction();
      rolledBack = true;
    }

    report = {
      migrationKey: MIGRATION_KEY,
      runId,
      target: schema,
      mode: options.apply ? 'apply' : 'dry-run',
      status: 'ok',
      startedAt,
      completedAt: new Date().toISOString(),
      schemaVerified: true,
      transactionRolledBack: rolledBack,
      identityMapping: identityMapping(),
      before,
      after,
      stateDistributions: stateSnapshot.distributions,
      ambiguousStates: stateSnapshot.ambiguous,
      ceoIdentityChecksumsPreserved: ceoPreserved,
      reconciliationChecksum: checksum,
      notes: [
        'Existing canonical IDs are mapped by identity; no parallel CRM tables are created.',
        'Dry-run uses a read-only transaction and always rolls it back.',
        'Historical events are never synthesized from ambiguous source data.',
      ],
    };
    printHuman(report);
    return report;
  } catch (error) {
    if (runner.isTransactionActive) {
      await runner.rollbackTransaction();
      rolledBack = true;
    }
    report = {
      migrationKey: MIGRATION_KEY,
      runId,
      target: TARGET_TENANT,
      mode: options.apply ? 'apply' : 'dry-run',
      status: 'failed',
      startedAt,
      completedAt: new Date().toISOString(),
      schemaVerified: false,
      transactionRolledBack: rolledBack,
      identityMapping: identityMapping(),
      before: {},
      after: {},
      stateDistributions: {},
      ambiguousStates: {},
      ceoIdentityChecksumsPreserved: false,
      reconciliationChecksum: '',
      notes: ['No transaction was committed.'],
      error: safeError(error),
    };
    printHuman(report);
    throw error;
  } finally {
    await runner.release();
    await dataSource.destroy();
  }
}

if (require.main === module) {
  runMigration(parseMigrationOptions(process.argv.slice(2))).catch(() => {
    process.exitCode = 1;
  });
}
