import { DataSource } from 'typeorm';
import { ensureDoflowAutomationPerformanceTables } from '../tenant/tenant-automation-performance-schema';

export function parseAutomationPerformanceLegacyOptions(argv: string[]) {
  const apply = argv.includes('--apply');
  const tenant = (argv.find((arg) => arg.startsWith('--tenant='))?.slice(9) || 'doflow').toLowerCase();
  if (tenant !== 'doflow') throw new Error('Automation/performance mapping is restricted to tenant doflow');
  return { tenant, apply };
}

export function buildAutomationPerformanceLegacyReport(values: {
  rules: number; runs: number; goals: number; versionedRules: number; pointLedger: number; snapshots: number;
}) {
  return {
    tenant: 'doflow',
    sourceAutomationRules: values.rules,
    sourceAutomationRuns: values.runs,
    sourceGoals: values.goals,
    versionedRules: values.versionedRules,
    canonicalPointLedger: values.pointLedger,
    canonicalRankingSnapshots: values.snapshots,
    ambiguousPointEvents: 0,
    note: 'Nessun punto o snapshot viene inventato da fonti prive di una provenienza business verificabile.',
  };
}

export type AutomationPerformanceLegacyMapOptions = {
  tenant: 'doflow';
  apply: boolean;
};

async function tableCount(dataSource: DataSource, table: string) {
  const exists = await dataSource.query(`SELECT to_regclass($1) AS name`, [`doflow.${table}`]);
  if (!exists[0]?.name) return 0;
  return Number((await dataSource.query(`SELECT COUNT(*)::int AS count FROM "doflow"."${table}"`))[0]?.count || 0);
}

export async function mapDoflowAutomationPerformanceLegacy(
  dataSource: DataSource,
  options: AutomationPerformanceLegacyMapOptions,
) {
  if (options.apply) {
    await dataSource.transaction(async (manager) => {
      await manager.query(`
        INSERT INTO "doflow".automation_rule_versions (rule_id, version, config, change_reason, created_by)
        SELECT r.id, 1,
          jsonb_build_object('name', r.name, 'description', r.description, 'category', r.category,
            'trigger_type', r.trigger_type, 'trigger_config', r.trigger_config, 'conditions', r.conditions,
            'actions', r.actions, 'schedule_config', r.schedule_config, 'run_mode', r.run_mode,
            'priority', r.priority, 'cooldown_minutes', r.cooldown_minutes, 'max_runs_per_day', r.max_runs_per_day),
          'Baseline verificabile da automation_rules', r.created_by
        FROM "doflow".automation_rules r
        WHERE r.deleted_at IS NULL
          AND NOT EXISTS (SELECT 1 FROM "doflow".automation_rule_versions v WHERE v.rule_id = r.id)
        ON CONFLICT (rule_id, version) DO NOTHING
      `);
      await manager.query(`
        UPDATE "doflow".automation_rules r
        SET current_version_id = (SELECT v.id FROM "doflow".automation_rule_versions v WHERE v.rule_id=r.id ORDER BY v.version DESC LIMIT 1),
            current_version = (SELECT v.version FROM "doflow".automation_rule_versions v WHERE v.rule_id=r.id ORDER BY v.version DESC LIMIT 1),
            optimistic_version = GREATEST(r.optimistic_version, 1)
        WHERE r.current_version_id IS NULL
          AND EXISTS (SELECT 1 FROM "doflow".automation_rule_versions v WHERE v.rule_id=r.id)
      `);
    });
  }
  const values = {
    rules: await tableCount(dataSource, 'automation_rules'),
    runs: await tableCount(dataSource, 'automation_runs'),
    goals: await tableCount(dataSource, 'doflow_goals'),
    versionedRules: await tableCount(dataSource, 'automation_rule_versions'),
    pointLedger: await tableCount(dataSource, 'point_ledger'),
    snapshots: await tableCount(dataSource, 'ranking_snapshots'),
  };
  return {
    ...buildAutomationPerformanceLegacyReport(values),
    mode: options.apply ? 'apply' as const : 'dry-run' as const,
  };
}

async function run() {
  const options = parseAutomationPerformanceLegacyOptions(process.argv.slice(2));
  if (process.env.NODE_ENV === 'production') throw new Error('Legacy mapping cannot run in production');
  const host = String(process.env.DB_HOST || '');
  const database = String(process.env.DB_NAME || '');
  if (!['localhost', '127.0.0.1', 'doflow-acceptance-postgres'].includes(host) || !/acceptance/i.test(database)) {
    throw new Error('Legacy mapping requires an isolated acceptance database');
  }
  const dataSource = new DataSource({
    type: 'postgres', host, port: Number(process.env.DB_PORT || 5432), username: process.env.DB_USER,
    password: process.env.DB_PASSWORD, database, synchronize: false,
  });
  await dataSource.initialize();
  try {
    await ensureDoflowAutomationPerformanceTables(dataSource, options.tenant);
    const output = await mapDoflowAutomationPerformanceLegacy(dataSource, {
      tenant: 'doflow',
      apply: options.apply,
    });
    process.stdout.write(`${JSON.stringify(output)}\n`);
    return output;
  } finally {
    await dataSource.destroy();
  }
}

if (require.main === module) void run().catch((error) => {
  process.stderr.write(`[automation-performance:legacy-map] ${error instanceof Error ? error.message : 'failed'}\n`);
  process.exitCode = 1;
});
