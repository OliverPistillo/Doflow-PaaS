import { DataSource } from 'typeorm';
import { provisionSchemaOnce } from '../common/schema-provisioning-once';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantNotificationsTables } from './tenant-notifications-schema';
import { ensureTenantProjectsTables } from './tenant-projects-schema';

type SchemaConnection = Pick<DataSource, 'query'>;

async function addColumns(
  connection: SchemaConnection,
  schema: string,
  table: string,
  columns: readonly string[],
) {
  for (const column of columns) {
    await connection.query(
      `ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${column}`,
    );
  }
}

/**
 * Additive, idempotent Delivery Core provisioner.
 *
 * Existing project, milestone and task UUIDs are deliberately retained. The
 * former milestone aggregate becomes the persisted production phase aggregate;
 * no destructive rename or data rewrite happens here.
 */
async function provisionTenantDeliveryCoreTables(
  connection: SchemaConnection,
  schema: string,
) {
  const s = safeSchema(schema, 'ensureTenantDeliveryCoreTables');
  await ensureTenantProjectsTables(connection as DataSource, s);
  await ensureTenantNotificationsTables(connection as DataSource, s);
  await connection.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await addColumns(connection, s, 'projects', [
    'version INTEGER NOT NULL DEFAULT 1',
    'lead_id UUID',
    'order_id UUID',
    'source_event_id TEXT',
    'published_at TIMESTAMPTZ',
    'published_by UUID',
    'delivered_by UUID',
    'support_started_at TIMESTAMPTZ',
    'suspended_from_status TEXT',
    'archive_reason TEXT',
  ]);
  await connection.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_projects_order_active"
     ON "${s}".projects(order_id) WHERE order_id IS NOT NULL AND deleted_at IS NULL`,
  );
  await connection.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_projects_source_event_active"
     ON "${s}".projects(source_event_id) WHERE source_event_id IS NOT NULL AND deleted_at IS NULL`,
  );

  await addColumns(connection, s, 'project_members', [
    'version INTEGER NOT NULL DEFAULT 1',
    'capacity_minutes_week INTEGER',
    'updated_by UUID',
    'updated_at TIMESTAMPTZ NOT NULL DEFAULT now()',
  ]);
  await connection.query(
    `CREATE INDEX IF NOT EXISTS "idx_${s}_project_supervisors"
     ON "${s}".project_members(project_id, user_id)
     WHERE role = 'supervisor' AND deleted_at IS NULL`,
  );

  await addColumns(connection, s, 'milestones', [
    'version INTEGER NOT NULL DEFAULT 1',
    'weight NUMERIC(7,3) NOT NULL DEFAULT 1',
    'responsible_user_id UUID',
    'planned_start_at TIMESTAMPTZ',
    'planned_due_at TIMESTAMPTZ',
    'actual_start_at TIMESTAMPTZ',
    'actual_end_at TIMESTAMPTZ',
    'blocked_reason TEXT',
    'reopened_at TIMESTAMPTZ',
  ]);

  await addColumns(connection, s, 'tasks', [
    'version INTEGER NOT NULL DEFAULT 1',
    'original_due_at TIMESTAMPTZ',
    'recurrence_rule JSONB',
    'recurrence_origin_id UUID',
    'next_recurrence_id UUID',
    'recurrence_key TEXT',
    'kanban_order INTEGER NOT NULL DEFAULT 0',
    'work_status TEXT NOT NULL DEFAULT \'draft\'',
    'work_version INTEGER NOT NULL DEFAULT 1',
    'submitted_at TIMESTAMPTZ',
    'submitted_by UUID',
    'approved_at TIMESTAMPTZ',
    'approved_by UUID',
    'approval_note TEXT',
    'changes_requested_at TIMESTAMPTZ',
    'changes_requested_by UUID',
    'changes_request_note TEXT',
    'reopened_at TIMESTAMPTZ',
    'reopened_by UUID',
    'reopen_reason TEXT',
    'archived_by UUID',
    'archive_reason TEXT',
  ]);
  await connection.query(
    `UPDATE "${s}".tasks SET original_due_at = due_at
     WHERE original_due_at IS NULL AND due_at IS NOT NULL`,
  );
  await connection.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_tasks_recurrence_key"
     ON "${s}".tasks(recurrence_key) WHERE recurrence_key IS NOT NULL`,
  );

  await addColumns(connection, s, 'task_checklist_items', [
    'required BOOLEAN NOT NULL DEFAULT true',
    'version INTEGER NOT NULL DEFAULT 1',
    'completed_at TIMESTAMPTZ',
    'completed_by UUID',
  ]);

  await addColumns(connection, s, 'commercial_activities', [
    'project_id UUID',
    'project_phase_id UUID',
    'original_due_at TIMESTAMPTZ',
    'estimated_minutes INTEGER',
    'actual_minutes INTEGER',
    'blocked_reason TEXT',
    'recurrence_rule JSONB',
  ]);
  await connection.query(
    `CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_activities_project"
     ON "${s}".commercial_activities(project_id, project_phase_id)
     WHERE deleted_at IS NULL`,
  );

  await connection.query(`
    CREATE TABLE IF NOT EXISTS "${s}".task_assignees (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      task_id UUID NOT NULL REFERENCES "${s}".tasks(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      role TEXT NOT NULL DEFAULT 'collaborator',
      allocation_percent INTEGER,
      version INTEGER NOT NULL DEFAULT 1,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await connection.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_task_assignees_active"
     ON "${s}".task_assignees(task_id, user_id) WHERE deleted_at IS NULL`,
  );

  await connection.query(`
    CREATE TABLE IF NOT EXISTS "${s}".task_dependencies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      predecessor_task_id UUID NOT NULL REFERENCES "${s}".tasks(id) ON DELETE CASCADE,
      successor_task_id UUID NOT NULL REFERENCES "${s}".tasks(id) ON DELETE CASCADE,
      dependency_type TEXT NOT NULL DEFAULT 'finish_to_start',
      version INTEGER NOT NULL DEFAULT 1,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      CHECK (predecessor_task_id <> successor_task_id)
    )
  `);
  await connection.query(`ALTER TABLE "${s}".task_dependencies ADD COLUMN IF NOT EXISTS project_id UUID`);
  await connection.query(`ALTER TABLE "${s}".task_dependencies ADD COLUMN IF NOT EXISTS updated_by UUID`);
  await connection.query(`
    UPDATE "${s}".task_dependencies d SET project_id = t.project_id
    FROM "${s}".tasks t WHERE d.project_id IS NULL AND t.id = d.successor_task_id
  `);
  await connection.query(`ALTER TABLE "${s}".task_dependencies ALTER COLUMN project_id SET NOT NULL`);
  await connection.query(`DO $$ BEGIN
    ALTER TABLE "${s}".task_dependencies ADD CONSTRAINT "fk_${s}_task_dependencies_project"
      FOREIGN KEY (project_id) REFERENCES "${s}".projects(id) ON DELETE CASCADE;
  EXCEPTION WHEN duplicate_object THEN NULL; END $$`);
  await connection.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_task_dependencies_active"
     ON "${s}".task_dependencies(predecessor_task_id, successor_task_id)
     WHERE deleted_at IS NULL`,
  );
  await connection.query(
    `CREATE INDEX IF NOT EXISTS "idx_${s}_task_dependencies_successor"
     ON "${s}".task_dependencies(successor_task_id) WHERE deleted_at IS NULL`,
  );

  await connection.query(`
    CREATE TABLE IF NOT EXISTS "${s}".task_due_date_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      task_id UUID NOT NULL REFERENCES "${s}".tasks(id) ON DELETE CASCADE,
      previous_due_at TIMESTAMPTZ,
      new_due_at TIMESTAMPTZ,
      reason TEXT NOT NULL,
      changed_by UUID,
      correlation_id UUID NOT NULL,
      changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await connection.query(`ALTER TABLE "${s}".task_due_date_history ADD COLUMN IF NOT EXISTS changed_at TIMESTAMPTZ NOT NULL DEFAULT now()`);
  await connection.query(
    `CREATE INDEX IF NOT EXISTS "idx_${s}_task_due_history_task"
     ON "${s}".task_due_date_history(task_id, created_at DESC)`,
  );

  await connection.query(`
    CREATE TABLE IF NOT EXISTS "${s}".delivery_time_sessions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      task_id UUID REFERENCES "${s}".tasks(id) ON DELETE SET NULL,
      user_id UUID NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      ended_at TIMESTAMPTZ,
      duration_seconds INTEGER,
      description TEXT,
      stop_key TEXT,
      corrected_at TIMESTAMPTZ,
      corrected_by UUID,
      correction_reason TEXT,
      archive_reason TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await connection.query(`ALTER TABLE "${s}".delivery_time_sessions ADD COLUMN IF NOT EXISTS corrected_at TIMESTAMPTZ`);
  await connection.query(`ALTER TABLE "${s}".delivery_time_sessions ADD COLUMN IF NOT EXISTS corrected_by UUID`);
  await connection.query(`ALTER TABLE "${s}".delivery_time_sessions ADD COLUMN IF NOT EXISTS correction_reason TEXT`);
  await connection.query(`ALTER TABLE "${s}".delivery_time_sessions ADD COLUMN IF NOT EXISTS archive_reason TEXT`);
  await connection.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_delivery_timer_user_active"
     ON "${s}".delivery_time_sessions(user_id)
     WHERE status = 'active' AND deleted_at IS NULL`,
  );
  await connection.query(
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_delivery_timer_stop_key"
     ON "${s}".delivery_time_sessions(stop_key) WHERE stop_key IS NOT NULL`,
  );

  await connection.query(`
    CREATE TABLE IF NOT EXISTS "${s}".project_qa_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      phase_id UUID REFERENCES "${s}".milestones(id) ON DELETE CASCADE,
      label TEXT NOT NULL,
      required BOOLEAN NOT NULL DEFAULT true,
      sort_order INTEGER NOT NULL DEFAULT 0,
      completed_at TIMESTAMPTZ,
      completed_by UUID,
      comment TEXT,
      version INTEGER NOT NULL DEFAULT 1,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await connection.query(
    `CREATE INDEX IF NOT EXISTS "idx_${s}_project_qa_project"
     ON "${s}".project_qa_items(project_id, sort_order) WHERE deleted_at IS NULL`,
  );

  await connection.query(`
    CREATE TABLE IF NOT EXISTS "${s}".project_workflow_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      task_id UUID REFERENCES "${s}".tasks(id) ON DELETE SET NULL,
      phase_id UUID REFERENCES "${s}".milestones(id) ON DELETE SET NULL,
      event_type TEXT NOT NULL,
      actor_user_id UUID,
      previous_state JSONB,
      next_state JSONB,
      reason TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(operation_id, event_type, project_id)
    )
  `);
  await connection.query(
    `CREATE INDEX IF NOT EXISTS "idx_${s}_project_workflow_timeline"
     ON "${s}".project_workflow_events(project_id, created_at DESC)`,
  );

  await connection.query(`
    CREATE TABLE IF NOT EXISTS "${s}".project_publications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      publication_version INTEGER NOT NULL,
      artifact_url TEXT,
      notes TEXT,
      published_by UUID,
      correlation_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(project_id, publication_version)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS "${s}".delivery_idempotency (
      operation TEXT NOT NULL,
      idempotency_key TEXT NOT NULL,
      actor_user_id UUID,
      request_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'processing',
      response JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ,
      PRIMARY KEY (operation, idempotency_key)
    )
  `);

  await connection.query(`
    CREATE TABLE IF NOT EXISTS "${s}".delivery_outbox (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      topic TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id UUID NOT NULL,
      recipient_user_id UUID,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      processed_at TIMESTAMPTZ,
      UNIQUE(operation_id, topic, aggregate_id, recipient_user_id)
    )
  `);
  await connection.query(
    `CREATE INDEX IF NOT EXISTS "idx_${s}_delivery_outbox_pending"
     ON "${s}".delivery_outbox(created_at) WHERE processed_at IS NULL`,
  );

  // Only the Doflow production model changes. Legacy tenant defaults are kept.
  if (s === 'doflow') {
    await connection.query(
      `ALTER TABLE "${s}".projects ALTER COLUMN status SET DEFAULT 'not_started'`,
    );
  }
}

export function ensureTenantDeliveryCoreTables(
  connection: SchemaConnection,
  schema: string,
): Promise<void> {
  const safe = safeSchema(schema, 'ensureTenantDeliveryCoreTables');
  return provisionSchemaOnce(connection, `tenant-delivery-core:${safe}`, () =>
    provisionTenantDeliveryCoreTables(connection, safe),
  );
}
