import { DataSource, QueryRunner } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantCrmCoreTables } from './tenant-crm-schema';
import { ensureTenantBriefingQuoteTables } from './tenant-briefing-quotes-schema';

export const STANDARD_PROJECT_MILESTONES = [
  'Kick-off',
  'Raccolta materiali',
  'Architettura / Strategia',
  'UX/UI',
  'Sviluppo',
  'Revisione interna',
  'Revisione cliente',
  'SEO / Performance',
  'QA',
  'Pubblicazione',
  'Formazione cliente',
  'Consegna',
] as const;

export const INITIAL_PROJECT_TASKS = [
  'Preparare checklist kick-off',
  'Verificare materiali cliente',
  'Analizzare sito/brand attuale',
  'Definire struttura pagine',
  'Preparare ambiente progetto',
] as const;

async function columnType(ds: DataSource, schema: string, table: string, column: string): Promise<string> {
  const rows = await ds.query(
    `SELECT data_type, udt_name
     FROM information_schema.columns
     WHERE table_schema = $1 AND table_name = $2 AND column_name = $3
     LIMIT 1`,
    [schema, table, column],
  );
  return String(rows[0]?.udt_name || rows[0]?.data_type || '').toLowerCase();
}

async function hasUuidId(ds: DataSource, schema: string, table: string): Promise<boolean> {
  const type = await columnType(ds, schema, table, 'id');
  return type === 'uuid';
}

async function addColumns(ds: DataSource, schema: string, table: string, columns: string[]) {
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

export async function ensureTenantProjectsTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantProjectsTables');

  await ensureTenantCrmCoreTables(ds, s);
  await ensureTenantBriefingQuoteTables(ds, s);
  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".projects (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      opportunity_id UUID REFERENCES "${s}".opportunities(id) ON DELETE SET NULL,
      briefing_id UUID REFERENCES "${s}".briefings(id) ON DELETE SET NULL,
      quote_id UUID REFERENCES "${s}".quotes(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      type TEXT,
      status TEXT NOT NULL DEFAULT 'to_start',
      priority TEXT NOT NULL DEFAULT 'medium',
      current_phase TEXT,
      progress INTEGER NOT NULL DEFAULT 0,
      project_manager_id UUID,
      start_date DATE,
      due_date DATE,
      delivered_at TIMESTAMPTZ,
      closed_at TIMESTAMPTZ,
      internal_notes TEXT,
      client_notes TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'projects', [
    'company_id UUID',
    'contact_id UUID',
    'opportunity_id UUID',
    'briefing_id UUID',
    'quote_id UUID',
    'name TEXT',
    'description TEXT',
    'type TEXT',
    "status TEXT NOT NULL DEFAULT 'to_start'",
    "priority TEXT NOT NULL DEFAULT 'medium'",
    'current_phase TEXT',
    'progress INTEGER NOT NULL DEFAULT 0',
    'project_manager_id UUID',
    'start_date DATE',
    'due_date DATE',
    'delivered_at TIMESTAMPTZ',
    'closed_at TIMESTAMPTZ',
    'internal_notes TEXT',
    'client_notes TEXT',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);
  await ds.query(`UPDATE "${s}".projects SET status = 'to_start' WHERE status IS NULL`);
  await ds.query(`UPDATE "${s}".projects SET priority = 'medium' WHERE priority IS NULL`);
  await ds.query(`UPDATE "${s}".projects SET progress = 0 WHERE progress IS NULL`);
  await ds.query(`ALTER TABLE "${s}".projects ALTER COLUMN status SET DEFAULT 'to_start'`);
  await ds.query(`ALTER TABLE "${s}".projects ALTER COLUMN priority SET DEFAULT 'medium'`);
  await ds.query(`ALTER TABLE "${s}".projects ALTER COLUMN progress SET DEFAULT 0`);
  await ds.query(`ALTER TABLE "${s}".projects ALTER COLUMN status SET NOT NULL`);
  await ds.query(`ALTER TABLE "${s}".projects ALTER COLUMN priority SET NOT NULL`);
  await ds.query(`ALTER TABLE "${s}".projects ALTER COLUMN progress SET NOT NULL`);

  const projectRef = (await hasUuidId(ds, s, 'projects')) ? `REFERENCES "${s}".projects(id) ON DELETE CASCADE` : '';

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".project_members (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID NOT NULL ${projectRef},
      user_id UUID NOT NULL,
      role TEXT NOT NULL DEFAULT 'member',
      hourly_rate NUMERIC,
      allocation_percent INTEGER,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'project_members', [
    'project_id UUID',
    'user_id UUID',
    "role TEXT NOT NULL DEFAULT 'member'",
    'hourly_rate NUMERIC',
    'allocation_percent INTEGER',
    'created_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".milestones (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID NOT NULL ${projectRef},
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      due_date DATE,
      completed_at TIMESTAMPTZ,
      sort_order INTEGER DEFAULT 0,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'milestones', [
    'project_id UUID',
    'title TEXT',
    'description TEXT',
    "status TEXT NOT NULL DEFAULT 'pending'",
    'due_date DATE',
    'completed_at TIMESTAMPTZ',
    'sort_order INTEGER DEFAULT 0',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  const milestoneRef = (await hasUuidId(ds, s, 'milestones')) ? `REFERENCES "${s}".milestones(id) ON DELETE SET NULL` : '';
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".tasks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID ${projectRef},
      milestone_id UUID ${milestoneRef},
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'backlog',
      priority TEXT NOT NULL DEFAULT 'medium',
      assignee_id UUID,
      assigned_by UUID,
      due_at TIMESTAMPTZ,
      estimated_minutes INTEGER,
      actual_minutes INTEGER,
      tags TEXT[],
      blocked_reason TEXT,
      completed_at TIMESTAMPTZ,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'tasks', [
    'project_id UUID',
    'milestone_id UUID',
    'company_id UUID',
    'title TEXT',
    'description TEXT',
    "status TEXT NOT NULL DEFAULT 'backlog'",
    "priority TEXT NOT NULL DEFAULT 'medium'",
    'assignee_id UUID',
    'assigned_by UUID',
    'due_at TIMESTAMPTZ',
    'estimated_minutes INTEGER',
    'actual_minutes INTEGER',
    'tags TEXT[]',
    'blocked_reason TEXT',
    'completed_at TIMESTAMPTZ',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  const taskRef = (await hasUuidId(ds, s, 'tasks')) ? `REFERENCES "${s}".tasks(id) ON DELETE CASCADE` : '';
  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".task_checklist_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      task_id UUID NOT NULL ${taskRef},
      title TEXT NOT NULL,
      is_done BOOLEAN DEFAULT false,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'task_checklist_items', [
    'task_id UUID',
    'title TEXT',
    'is_done BOOLEAN DEFAULT false',
    'sort_order INTEGER DEFAULT 0',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".project_comments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID ${projectRef},
      task_id UUID ${taskRef},
      milestone_id UUID ${milestoneRef},
      body TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'internal',
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'project_comments', [
    'project_id UUID',
    'task_id UUID',
    'milestone_id UUID',
    'body TEXT',
    "visibility TEXT NOT NULL DEFAULT 'internal'",
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".project_file_links (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID ${projectRef},
      task_id UUID ${taskRef},
      file_id UUID NOT NULL,
      type TEXT,
      visibility TEXT NOT NULL DEFAULT 'internal',
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'project_file_links', [
    'project_id UUID',
    'task_id UUID',
    'file_id UUID',
    'type TEXT',
    "visibility TEXT NOT NULL DEFAULT 'internal'",
    'created_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_projects_company" ON "${s}".projects(company_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_projects_status" ON "${s}".projects(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_projects_pm" ON "${s}".projects(project_manager_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_projects_due_date" ON "${s}".projects(due_date) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_project_members_project" ON "${s}".project_members(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_project_members_user" ON "${s}".project_members(user_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_project_members_active" ON "${s}".project_members(project_id, user_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_milestones_project" ON "${s}".milestones(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_milestones_status" ON "${s}".milestones(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_milestones_due" ON "${s}".milestones(due_date) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_tasks_project" ON "${s}".tasks(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_tasks_status" ON "${s}".tasks(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_tasks_assignee" ON "${s}".tasks(assignee_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_tasks_due" ON "${s}".tasks(due_at) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_task_checklist_task" ON "${s}".task_checklist_items(task_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_project_comments_project" ON "${s}".project_comments(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_project_comments_task" ON "${s}".project_comments(task_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_project_file_links_project" ON "${s}".project_file_links(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_project_file_links_task" ON "${s}".project_file_links(task_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_project_file_links_file" ON "${s}".project_file_links(file_id) WHERE deleted_at IS NULL`);
}

export async function createStandardProjectPlan(
  runner: QueryRunner,
  schema: string,
  projectId: string,
  companyId: string | null,
  userId: string | null,
) {
  const s = safeSchema(schema, 'createStandardProjectPlan');

  for (const [index, title] of STANDARD_PROJECT_MILESTONES.entries()) {
    await runner.query(
      `INSERT INTO "${s}".milestones (project_id, title, status, sort_order, created_by, updated_by, created_at, updated_at)
       VALUES ($1, $2, 'pending', $3, $4, $4, now(), now())`,
      [projectId, title, index, userId],
    );
  }

  for (const [index, title] of INITIAL_PROJECT_TASKS.entries()) {
    await runner.query(
      `INSERT INTO "${s}".tasks (
         project_id, company_id, title, status, priority, assignee_id, assigned_by,
         created_by, updated_by, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, 'medium', $5, $5, $5, $5, now(), now())`,
      [projectId, companyId, title, index === 0 ? 'ready' : 'backlog', userId],
    );
  }
}
