import { DataSource } from 'typeorm';
import { provisionSchemaOnce } from '../common/schema-provisioning-once';
import { safeSchema } from '../common/schema.utils';
import { isDoflowTenant } from './tenant-context';
import { ensureTenantAutomationsTables } from './tenant-automations-schema';
import { ensureDoflowWorkspaceTables } from './tenant-doflow-workspace.service';

const DEFAULT_POINT_POLICY = {
  on_time: 10,
  early_per_day: 2,
  early_maximum: 10,
  late_per_day: 2,
  late_maximum: 20,
  qa_first_pass: 8,
  qa_rejected: -5,
  reopened: -5,
  project_delivered: 25,
  collected_per_hundred_euro: 1,
};

const DEFAULT_RANKING_CONFIGS = [
  { role: 'commercial', metrics: [{ metric: 'gross_collected', weight: 0 }, { metric: 'net_collected', weight: 45 }, { metric: 'paid_sales', weight: 20 }, { metric: 'new_paying_customers', weight: 10 }, { metric: 'lead_to_payment_conversion', weight: 10 }, { metric: 'average_collected_ticket', weight: 5 }, { metric: 'completed_followups', weight: 10 }, { metric: 'refunds', weight: 15 }] },
  { role: 'developer', metrics: [{ metric: 'approved_technical_work', weight: 40 }, { metric: 'resolved_bugs', weight: 10 }, { metric: 'on_time_activities', weight: 15 }, { metric: 'qa_passed', weight: 15 }, { metric: 'estimate_accuracy', weight: 10 }, { metric: 'delivered_projects', weight: 10 }, { metric: 'reopened_work', weight: 15 }] },
  { role: 'project_manager', metrics: [{ metric: 'approved_projects', weight: 35 }, { metric: 'delivered_projects', weight: 20 }, { metric: 'on_time_projects', weight: 20 }, { metric: 'qa_passed', weight: 15 }, { metric: 'on_time_activities', weight: 10 }, { metric: 'project_delays', weight: 15 }, { metric: 'reopened_work', weight: 15 }] },
  { role: 'support', metrics: [{ metric: 'support_completed', weight: 65 }, { metric: 'renewals_completed', weight: 20 }, { metric: 'on_time_activities', weight: 15 }] },
];

async function addColumns(ds: DataSource, schema: string, table: string, columns: string[]) {
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

async function provisionDoflowAutomationPerformanceTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureDoflowAutomationPerformanceTables');
  if (!isDoflowTenant(s)) throw new Error('Automation & Performance authority is doflow-only');
  await ensureTenantAutomationsTables(ds, s);
  await ensureDoflowWorkspaceTables(ds, s);

  await addColumns(ds, s, 'automation_rules', [
    "lifecycle_status TEXT NOT NULL DEFAULT 'draft'",
    'optimistic_version INTEGER NOT NULL DEFAULT 1',
    'current_version INTEGER NOT NULL DEFAULT 1',
    'current_version_id UUID',
    'archived_at TIMESTAMPTZ',
  ]);
  await addColumns(ds, s, 'automation_runs', [
    "execution_key TEXT",
    'operation_id UUID',
    'correlation_id UUID',
    'rule_version_id UUID',
    'attempt INTEGER NOT NULL DEFAULT 1',
    'retry_of UUID',
    'root_run_id UUID',
    'queue_job_id TEXT',
    'worker_id TEXT',
    'dead_lettered_at TIMESTAMPTZ',
    'cancelled_at TIMESTAMPTZ',
  ]);
  await addColumns(ds, s, 'automation_action_logs', [
    'operation_id UUID',
    'correlation_id UUID',
    'attempt INTEGER NOT NULL DEFAULT 1',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".automation_rule_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rule_id UUID NOT NULL REFERENCES "${s}".automation_rules(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      config JSONB NOT NULL,
      change_reason TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(rule_id, version)
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".automation_execution_registry (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      execution_type TEXT NOT NULL,
      execution_key TEXT NOT NULL,
      rule_id UUID,
      run_id UUID,
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      status TEXT NOT NULL DEFAULT 'claimed',
      result JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ,
      UNIQUE(execution_type, execution_key)
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".automation_outbox (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID NOT NULL,
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      topic TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      enqueued_at TIMESTAMPTZ,
      processed_at TIMESTAMPTZ,
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(run_id, topic)
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".automation_dead_letters (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      run_id UUID NOT NULL,
      queue_job_id TEXT,
      error_class TEXT NOT NULL,
      error_message TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      attempts INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      retried_at TIMESTAMPTZ,
      retried_by UUID,
      UNIQUE(run_id)
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".automation_adapters (
      name TEXT PRIMARY KEY,
      enabled BOOLEAN NOT NULL DEFAULT false,
      configured BOOLEAN NOT NULL DEFAULT false,
      synthetic BOOLEAN NOT NULL DEFAULT false,
      required_secret_names TEXT[] NOT NULL DEFAULT '{}',
      timeout_ms INTEGER NOT NULL DEFAULT 10000,
      max_attempts INTEGER NOT NULL DEFAULT 3,
      health_state TEXT NOT NULL DEFAULT 'disabled',
      last_error TEXT,
      updated_by UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".point_policies (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      role_scope TEXT NOT NULL DEFAULT 'all',
      event_type TEXT NOT NULL DEFAULT 'default',
      status TEXT NOT NULL DEFAULT 'active',
      valid_from TIMESTAMPTZ NOT NULL DEFAULT now(),
      valid_to TIMESTAMPTZ,
      current_version INTEGER NOT NULL DEFAULT 1,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".point_policy_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      policy_id UUID NOT NULL REFERENCES "${s}".point_policies(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      formula JSONB NOT NULL,
      reason TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(policy_id, version)
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".point_ledger (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      policy_id UUID NOT NULL REFERENCES "${s}".point_policies(id),
      policy_version INTEGER NOT NULL,
      event_type TEXT NOT NULL,
      source_record_type TEXT NOT NULL,
      source_record_id UUID,
      operation_id UUID NOT NULL,
      amount NUMERIC(18,4) NOT NULL,
      state TEXT NOT NULL,
      effective_at TIMESTAMPTZ NOT NULL,
      actor_user_id UUID,
      reason TEXT NOT NULL,
      compensates_entry_id UUID REFERENCES "${s}".point_ledger(id),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(operation_id, event_type, user_id)
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".performance_event_registry (
      source_table TEXT NOT NULL,
      source_id UUID NOT NULL,
      operation_id UUID NOT NULL,
      processed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      result JSONB NOT NULL DEFAULT '{}'::jsonb,
      PRIMARY KEY(source_table, source_id)
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".ranking_configs (
      role TEXT PRIMARY KEY,
      metrics JSONB NOT NULL,
      formula_version INTEGER NOT NULL DEFAULT 1,
      optimistic_version INTEGER NOT NULL DEFAULT 1,
      updated_by UUID,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".ranking_config_versions (
      role TEXT NOT NULL,
      formula_version INTEGER NOT NULL,
      metrics JSONB NOT NULL,
      reason TEXT NOT NULL,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(role, formula_version)
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".ranking_snapshots (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      period TEXT NOT NULL,
      role TEXT NOT NULL,
      revision INTEGER NOT NULL,
      formula_version INTEGER NOT NULL,
      scores JSONB NOT NULL,
      winner_user_id UUID NOT NULL,
      tied_user_ids UUID[] NOT NULL DEFAULT '{}',
      consolidated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      consolidated_by UUID,
      supersedes_id UUID REFERENCES "${s}".ranking_snapshots(id),
      reason TEXT,
      UNIQUE(period, role, revision)
    )
  `);
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".ranking_revisions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      snapshot_id UUID NOT NULL REFERENCES "${s}".ranking_snapshots(id),
      action TEXT NOT NULL,
      reason TEXT NOT NULL,
      actor_user_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  const indexes = [
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_automation_runs_execution_key" ON "${s}".automation_runs(execution_key) WHERE execution_key IS NOT NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_automation_outbox_pending" ON "${s}".automation_outbox(available_at) WHERE processed_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_point_ledger_user_period" ON "${s}".point_ledger(user_id, effective_at DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_point_ledger_source" ON "${s}".point_ledger(source_record_type, source_record_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_ranking_snapshots_period" ON "${s}".ranking_snapshots(period, role, revision DESC)`,
  ];
  for (const sql of indexes) await ds.query(sql);

  const adapters = [
    ['email', ['AUTOMATION_EMAIL_PROVIDER']],
    ['whatsapp', ['AUTOMATION_WHATSAPP_PROVIDER']],
    ['google_calendar', ['AUTOMATION_GOOGLE_CALENDAR_PROVIDER']],
    ['meta_ads', ['AUTOMATION_META_ADS_PROVIDER']],
    ['google_ads', ['AUTOMATION_GOOGLE_ADS_PROVIDER']],
    ['payments', ['AUTOMATION_PAYMENT_PROVIDER']],
  ] as const;
  for (const [name, secrets] of adapters) {
    await ds.query(
      `INSERT INTO "${s}".automation_adapters (name, required_secret_names)
       VALUES ($1, $2::text[]) ON CONFLICT (name) DO NOTHING`,
      [name, [...secrets]],
    );
  }
  await ds.query(
    `INSERT INTO "${s}".automation_adapters
       (name, enabled, configured, synthetic, required_secret_names, health_state)
     VALUES ('acceptance_synthetic', false, true, true, '{}', 'disabled')
     ON CONFLICT (name) DO NOTHING`,
  );

  const policies = await ds.query(`SELECT id FROM "${s}".point_policies WHERE event_type = 'default' LIMIT 1`);
  if (!policies[0]) {
    const inserted = await ds.query(
      `INSERT INTO "${s}".point_policies (name, event_type, status)
       VALUES ('Policy operativa Doflow', 'default', 'active') RETURNING id`,
    );
    await ds.query(
      `INSERT INTO "${s}".point_policy_versions (policy_id, version, formula, reason)
       VALUES ($1, 1, $2::jsonb, 'Baseline verificata dalla reference Daniele')`,
      [inserted[0].id, JSON.stringify(DEFAULT_POINT_POLICY)],
    );
  }
  for (const config of DEFAULT_RANKING_CONFIGS) {
    await ds.query(
      `INSERT INTO "${s}".ranking_configs (role, metrics, formula_version)
       VALUES ($1, $2::jsonb, 2) ON CONFLICT (role) DO NOTHING`,
      [config.role, JSON.stringify(config.metrics)],
    );
    await ds.query(
      `INSERT INTO "${s}".ranking_config_versions (role, formula_version, metrics, reason)
       VALUES ($1, 2, $2::jsonb, 'Baseline verificata dalla reference Daniele')
       ON CONFLICT (role, formula_version) DO NOTHING`,
      [config.role, JSON.stringify(config.metrics)],
    );
  }
}

export function ensureDoflowAutomationPerformanceTables(
  ds: DataSource,
  schema: string,
): Promise<void> {
  const safe = safeSchema(schema, 'ensureDoflowAutomationPerformanceTables');
  return provisionSchemaOnce(
    ds,
    `doflow-automation-performance:${safe}`,
    () => provisionDoflowAutomationPerformanceTables(ds, safe),
  );
}
