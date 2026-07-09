import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

export const TEAM_BASE_SKILLS = [
  { name: 'Project Management', category: 'project_management' },
  { name: 'Sales', category: 'sales' },
  { name: 'UX/UI Design', category: 'design' },
  { name: 'Web Development', category: 'development' },
  { name: 'SEO', category: 'seo' },
  { name: 'Copywriting', category: 'copywriting' },
  { name: 'Amministrazione', category: 'administration' },
  { name: 'QA', category: 'generic' },
  { name: 'Hosting', category: 'hosting' },
  { name: 'Performance', category: 'analytics' },
  { name: 'Security', category: 'security' },
  { name: 'Analytics', category: 'analytics' },
] as const;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function addColumns(ds: DataSource, schema: string, table: string, columns: string[]) {
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

export async function ensureTenantTeamTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantTeamTables');
  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".team_members (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID,
      email TEXT NOT NULL,
      display_name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      phone TEXT,
      tenant_role TEXT,
      job_title TEXT,
      department TEXT,
      operational_role TEXT,
      employment_type TEXT NOT NULL DEFAULT 'employee',
      status TEXT NOT NULL DEFAULT 'active',
      skills TEXT[],
      capacity_hours_per_week NUMERIC(6,2),
      availability_status TEXT NOT NULL DEFAULT 'available',
      hourly_rate_cents INTEGER,
      daily_rate_cents INTEGER,
      currency TEXT NOT NULL DEFAULT 'EUR',
      start_date DATE,
      end_date DATE,
      notes TEXT,
      private_notes TEXT,
      metadata JSONB,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'team_members', [
    'user_id UUID',
    'email TEXT',
    'display_name TEXT',
    'first_name TEXT',
    'last_name TEXT',
    'phone TEXT',
    'tenant_role TEXT',
    'job_title TEXT',
    'department TEXT',
    'operational_role TEXT',
    "employment_type TEXT NOT NULL DEFAULT 'employee'",
    "status TEXT NOT NULL DEFAULT 'active'",
    'skills TEXT[]',
    'capacity_hours_per_week NUMERIC(6,2)',
    "availability_status TEXT NOT NULL DEFAULT 'available'",
    'hourly_rate_cents INTEGER',
    'daily_rate_cents INTEGER',
    "currency TEXT NOT NULL DEFAULT 'EUR'",
    'start_date DATE',
    'end_date DATE',
    'notes TEXT',
    'private_notes TEXT',
    'metadata JSONB',
    'created_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);
  await ds.query(`UPDATE "${s}".team_members SET display_name = COALESCE(NULLIF(display_name, ''), email) WHERE display_name IS NULL OR display_name = ''`);
  await ds.query(`UPDATE "${s}".team_members SET employment_type = 'employee' WHERE employment_type IS NULL OR employment_type = ''`);
  await ds.query(`UPDATE "${s}".team_members SET status = 'active' WHERE status IS NULL OR status = ''`);
  await ds.query(`UPDATE "${s}".team_members SET availability_status = 'available' WHERE availability_status IS NULL OR availability_status = ''`);
  await ds.query(`UPDATE "${s}".team_members SET currency = 'EUR' WHERE currency IS NULL OR currency = ''`);
  await ds.query(`ALTER TABLE "${s}".team_members ALTER COLUMN email SET NOT NULL`);
  await ds.query(`ALTER TABLE "${s}".team_members ALTER COLUMN display_name SET NOT NULL`);
  await ds.query(`ALTER TABLE "${s}".team_members ALTER COLUMN employment_type SET DEFAULT 'employee'`);
  await ds.query(`ALTER TABLE "${s}".team_members ALTER COLUMN employment_type SET NOT NULL`);
  await ds.query(`ALTER TABLE "${s}".team_members ALTER COLUMN status SET DEFAULT 'active'`);
  await ds.query(`ALTER TABLE "${s}".team_members ALTER COLUMN status SET NOT NULL`);
  await ds.query(`ALTER TABLE "${s}".team_members ALTER COLUMN availability_status SET DEFAULT 'available'`);
  await ds.query(`ALTER TABLE "${s}".team_members ALTER COLUMN availability_status SET NOT NULL`);
  await ds.query(`ALTER TABLE "${s}".team_members ALTER COLUMN currency SET DEFAULT 'EUR'`);
  await ds.query(`ALTER TABLE "${s}".team_members ALTER COLUMN currency SET NOT NULL`);

  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_team_members_email_unique" ON "${s}".team_members(lower(email)) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_team_members_user_unique" ON "${s}".team_members(user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_members_status" ON "${s}".team_members(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_members_tenant_role" ON "${s}".team_members(tenant_role) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_members_operational_role" ON "${s}".team_members(operational_role) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_members_employment_type" ON "${s}".team_members(employment_type) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_members_availability" ON "${s}".team_members(availability_status) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".team_skills (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      category TEXT,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_team_skills_slug_unique" ON "${s}".team_skills(slug) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".team_member_skills (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_member_id UUID NOT NULL REFERENCES "${s}".team_members(id) ON DELETE CASCADE,
      skill_id UUID NOT NULL REFERENCES "${s}".team_skills(id) ON DELETE CASCADE,
      level TEXT,
      years_experience NUMERIC(4,1),
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_team_member_skills_unique" ON "${s}".team_member_skills(team_member_id, skill_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_member_skills_member" ON "${s}".team_member_skills(team_member_id) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".team_availability (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_member_id UUID NOT NULL REFERENCES "${s}".team_members(id) ON DELETE CASCADE,
      type TEXT NOT NULL,
      title TEXT,
      starts_at TIMESTAMPTZ NOT NULL,
      ends_at TIMESTAMPTZ NOT NULL,
      capacity_hours NUMERIC(5,2),
      is_all_day BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'confirmed',
      notes TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_availability_member" ON "${s}".team_availability(team_member_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_availability_range" ON "${s}".team_availability(starts_at, ends_at) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_availability_type" ON "${s}".team_availability(type) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_availability_status" ON "${s}".team_availability(status) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".time_entries (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_member_id UUID NOT NULL REFERENCES "${s}".team_members(id) ON DELETE CASCADE,
      user_id UUID,
      project_id UUID,
      task_id UUID,
      company_id UUID,
      entry_date DATE NOT NULL,
      started_at TIMESTAMPTZ,
      ended_at TIMESTAMPTZ,
      duration_minutes INTEGER NOT NULL DEFAULT 0,
      activity_type TEXT NOT NULL DEFAULT 'work',
      description TEXT,
      is_billable BOOLEAN NOT NULL DEFAULT false,
      status TEXT NOT NULL DEFAULT 'draft',
      approved_by UUID,
      approved_at TIMESTAMPTZ,
      rejected_reason TEXT,
      metadata JSONB,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_time_entries_member" ON "${s}".time_entries(team_member_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_time_entries_user" ON "${s}".time_entries(user_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_time_entries_project" ON "${s}".time_entries(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_time_entries_task" ON "${s}".time_entries(task_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_time_entries_date" ON "${s}".time_entries(entry_date) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_time_entries_status" ON "${s}".time_entries(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_time_entries_activity" ON "${s}".time_entries(activity_type) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".team_activity (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_member_id UUID REFERENCES "${s}".team_members(id) ON DELETE SET NULL,
      actor_user_id UUID,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_activity_member" ON "${s}".team_activity(team_member_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_activity_actor" ON "${s}".team_activity(actor_user_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_activity_action" ON "${s}".team_activity(action)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_team_activity_created" ON "${s}".team_activity(created_at DESC)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".team_module_permissions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      team_member_id UUID NOT NULL REFERENCES "${s}".team_members(id) ON DELETE CASCADE,
      module_key TEXT NOT NULL,
      can_view BOOLEAN NOT NULL DEFAULT false,
      can_create BOOLEAN NOT NULL DEFAULT false,
      can_update BOOLEAN NOT NULL DEFAULT false,
      can_delete BOOLEAN NOT NULL DEFAULT false,
      can_manage BOOLEAN NOT NULL DEFAULT false,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_team_module_permissions_unique" ON "${s}".team_module_permissions(team_member_id, module_key) WHERE deleted_at IS NULL`);
}

export async function seedTenantTeamSkills(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'seedTenantTeamSkills');
  await ensureTenantTeamTables(ds, s);

  for (const skill of TEAM_BASE_SKILLS) {
    const slug = slugify(skill.name);
    await ds.query(
      `INSERT INTO "${s}".team_skills (name, slug, category, created_at, updated_at)
       VALUES ($1, $2, $3, now(), now())
       ON CONFLICT (slug) WHERE deleted_at IS NULL DO UPDATE
         SET name = EXCLUDED.name,
             category = EXCLUDED.category,
             updated_at = now()`,
      [skill.name, slug, skill.category],
    );
  }
}

export async function syncTenantUsersToTeamMembers(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'syncTenantUsersToTeamMembers');
  await ensureTenantTeamTables(ds, s);

  await ds.query(`
    UPDATE "${s}".team_members tm
    SET user_id = u.id,
        tenant_role = u.role,
        updated_at = now()
    FROM "${s}".users u
    WHERE tm.deleted_at IS NULL
      AND lower(tm.email) = lower(u.email)
      AND (tm.user_id IS NULL OR tm.user_id <> u.id)
  `);

  await ds.query(`
    INSERT INTO "${s}".team_members (
      user_id, email, display_name, tenant_role, operational_role,
      employment_type, status, availability_status, created_at, updated_at
    )
    SELECT
      u.id,
      lower(u.email),
      COALESCE(NULLIF(u.full_name, ''), split_part(u.email, '@', 1), u.email),
      u.role,
      CASE WHEN lower(COALESCE(u.role, '')) = 'owner' THEN 'ceo_label' ELSE 'generic' END,
      CASE WHEN lower(COALESCE(u.role, '')) IN ('owner', 'admin', 'superadmin', 'super_admin') THEN 'admin' ELSE 'employee' END,
      CASE WHEN COALESCE(u.is_active, true) THEN 'active' ELSE 'inactive' END,
      'available',
      now(),
      now()
    FROM "${s}".users u
    WHERE u.email IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM "${s}".team_members tm
        WHERE tm.deleted_at IS NULL
          AND (tm.user_id = u.id OR lower(tm.email) = lower(u.email))
      )
    ON CONFLICT (user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL DO UPDATE
      SET email = EXCLUDED.email,
          display_name = COALESCE(NULLIF("${s}".team_members.display_name, ''), EXCLUDED.display_name),
          tenant_role = EXCLUDED.tenant_role,
          operational_role = CASE
            WHEN lower(COALESCE(EXCLUDED.tenant_role, '')) = 'owner' THEN 'ceo_label'
            ELSE COALESCE("${s}".team_members.operational_role, EXCLUDED.operational_role)
          END,
          employment_type = CASE
            WHEN lower(COALESCE(EXCLUDED.tenant_role, '')) IN ('owner', 'admin', 'superadmin', 'super_admin') THEN 'admin'
            ELSE COALESCE("${s}".team_members.employment_type, EXCLUDED.employment_type)
          END,
          status = EXCLUDED.status,
          updated_at = now()
  `);
}
