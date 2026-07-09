import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

export type KpiTargetSeed = {
  kpiKey: string;
  label: string;
  targetValue: number;
  period?: 'weekly' | 'monthly' | 'quarterly' | 'yearly';
};

export const BASE_KPI_TARGETS: KpiTargetSeed[] = [
  { kpiKey: 'monthly_new_leads', label: 'Nuovi lead mensili', targetValue: 10, period: 'monthly' },
  { kpiKey: 'quote_acceptance_rate', label: 'Tasso accettazione preventivi', targetValue: 30, period: 'monthly' },
  { kpiKey: 'monthly_revenue', label: 'Ricavi mensili', targetValue: 5000, period: 'monthly' },
  { kpiKey: 'overdue_tasks_max', label: 'Task scaduti massimi', targetValue: 5, period: 'monthly' },
  { kpiKey: 'overdue_invoices_max', label: 'Fatture scadute massime', targetValue: 0, period: 'monthly' },
  { kpiKey: 'billable_hours_monthly', label: 'Ore fatturabili mensili', targetValue: 80, period: 'monthly' },
];

async function addColumns(ds: DataSource, schema: string, table: string, columns: string[]) {
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

export async function ensureTenantReportsTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantReportsTables');

  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".report_saved_views (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      description TEXT,
      report_key TEXT NOT NULL,
      filters JSONB,
      visibility TEXT NOT NULL DEFAULT 'private',
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'report_saved_views', [
    'name TEXT',
    'description TEXT',
    'report_key TEXT',
    'filters JSONB',
    "visibility TEXT NOT NULL DEFAULT 'private'",
    'created_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_saved_views_key" ON "${s}".report_saved_views(report_key) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_saved_views_visibility" ON "${s}".report_saved_views(visibility) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_saved_views_created_by" ON "${s}".report_saved_views(created_by) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_saved_views_deleted" ON "${s}".report_saved_views(deleted_at)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".report_snapshots (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      report_key TEXT NOT NULL,
      title TEXT NOT NULL,
      period_from DATE,
      period_to DATE,
      generated_by UUID,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'report_snapshots', [
    'report_key TEXT',
    'title TEXT',
    'period_from DATE',
    'period_to DATE',
    'generated_by UUID',
    "payload JSONB NOT NULL DEFAULT '{}'::jsonb",
    'created_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_snapshots_key" ON "${s}".report_snapshots(report_key) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_snapshots_generated_by" ON "${s}".report_snapshots(generated_by) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_snapshots_period" ON "${s}".report_snapshots(period_from, period_to) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_snapshots_created" ON "${s}".report_snapshots(created_at DESC) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".kpi_targets (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      kpi_key TEXT NOT NULL,
      label TEXT NOT NULL,
      target_value NUMERIC(14,2) NOT NULL DEFAULT 0,
      period TEXT NOT NULL DEFAULT 'monthly',
      applies_to_role TEXT,
      applies_to_user_id UUID,
      metadata JSONB,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'kpi_targets', [
    'kpi_key TEXT',
    'label TEXT',
    'target_value NUMERIC(14,2) NOT NULL DEFAULT 0',
    "period TEXT NOT NULL DEFAULT 'monthly'",
    'applies_to_role TEXT',
    'applies_to_user_id UUID',
    'metadata JSONB',
    'created_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);
  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_kpi_targets_scope_active"
    ON "${s}".kpi_targets(
      kpi_key,
      period,
      COALESCE(applies_to_role, ''),
      COALESCE(applies_to_user_id, '00000000-0000-0000-0000-000000000000'::uuid)
    )
    WHERE deleted_at IS NULL
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_kpi_targets_key" ON "${s}".kpi_targets(kpi_key) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_kpi_targets_period" ON "${s}".kpi_targets(period) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_kpi_targets_role" ON "${s}".kpi_targets(applies_to_role) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_kpi_targets_user" ON "${s}".kpi_targets(applies_to_user_id) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".report_activity (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      action TEXT NOT NULL,
      report_key TEXT,
      actor_user_id UUID,
      entity_type TEXT,
      entity_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_activity_action" ON "${s}".report_activity(action)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_activity_key" ON "${s}".report_activity(report_key)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_activity_actor" ON "${s}".report_activity(actor_user_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_report_activity_created" ON "${s}".report_activity(created_at DESC)`);
}

export async function seedTenantKpiTargets(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'seedTenantKpiTargets');
  await ensureTenantReportsTables(ds, s);

  for (const target of BASE_KPI_TARGETS) {
    await ds.query(
      `
      UPDATE "${s}".kpi_targets
      SET label = $2,
          target_value = $3,
          updated_at = now()
      WHERE kpi_key = $1
        AND period = $4
        AND applies_to_role IS NULL
        AND applies_to_user_id IS NULL
        AND deleted_at IS NULL
      `,
      [target.kpiKey, target.label, target.targetValue, target.period || 'monthly'],
    );

    await ds.query(
      `
      INSERT INTO "${s}".kpi_targets (
        kpi_key, label, target_value, period, created_at, updated_at
      )
      VALUES ($1, $2, $3, $4, now(), now())
      WHERE NOT EXISTS (
        SELECT 1
        FROM "${s}".kpi_targets
        WHERE kpi_key = $1
          AND period = $4
          AND applies_to_role IS NULL
          AND applies_to_user_id IS NULL
          AND deleted_at IS NULL
      )
      `,
      [target.kpiKey, target.label, target.targetValue, target.period || 'monthly'],
    );
  }
}
