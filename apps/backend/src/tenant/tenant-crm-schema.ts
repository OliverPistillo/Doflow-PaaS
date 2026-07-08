import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

export async function ensureTenantCrmCoreTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantCrmCoreTables');

  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".companies (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      legal_name TEXT,
      vat_number TEXT,
      fiscal_code TEXT,
      website TEXT,
      email TEXT,
      phone TEXT,
      industry TEXT,
      size TEXT,
      status TEXT NOT NULL DEFAULT 'prospect',
      source TEXT,
      address TEXT,
      city TEXT,
      province TEXT,
      country TEXT DEFAULT 'IT',
      notes TEXT,
      owner_user_id UUID,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_companies_status" ON "${s}".companies(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_companies_search" ON "${s}".companies(lower(name)) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".contacts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      first_name TEXT NOT NULL,
      last_name TEXT,
      role_title TEXT,
      email TEXT,
      phone TEXT,
      decision_level TEXT,
      preferred_channel TEXT,
      notes TEXT,
      is_primary BOOLEAN DEFAULT false,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_contacts_company" ON "${s}".contacts(company_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_contacts_email" ON "${s}".contacts(lower(email)) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".leads (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      source TEXT,
      interest TEXT,
      budget_estimate NUMERIC,
      urgency TEXT,
      quality TEXT,
      status TEXT NOT NULL DEFAULT 'new',
      assigned_to UUID,
      next_action TEXT,
      next_action_at TIMESTAMPTZ,
      lost_reason TEXT,
      notes TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_leads_status" ON "${s}".leads(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_leads_assigned" ON "${s}".leads(assigned_to) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_leads_next_action" ON "${s}".leads(next_action_at) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".opportunities (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      lead_id UUID REFERENCES "${s}".leads(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      service_type TEXT,
      value_estimate NUMERIC,
      probability INTEGER,
      stage TEXT NOT NULL DEFAULT 'new_lead',
      expected_close_date DATE,
      assigned_to UUID,
      next_action TEXT,
      next_action_at TIMESTAMPTZ,
      lost_reason TEXT,
      notes TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_opportunities_stage" ON "${s}".opportunities(stage) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_opportunities_assigned" ON "${s}".opportunities(assigned_to) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_opportunities_expected_close" ON "${s}".opportunities(expected_close_date) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".commercial_activities (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      lead_id UUID REFERENCES "${s}".leads(id) ON DELETE SET NULL,
      opportunity_id UUID REFERENCES "${s}".opportunities(id) ON DELETE SET NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      due_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      assigned_to UUID,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_activities_due" ON "${s}".commercial_activities(due_at) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_activities_assigned" ON "${s}".commercial_activities(assigned_to) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_activities_completed" ON "${s}".commercial_activities(completed_at) WHERE deleted_at IS NULL`);
}
