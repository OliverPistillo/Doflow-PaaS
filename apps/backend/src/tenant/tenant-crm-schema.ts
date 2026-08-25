import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { provisionSchemaOnce } from '../common/schema-provisioning-once';

async function provisionTenantCrmCoreTables(ds: DataSource, schema: string) {
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
      lead_source TEXT,
      lead_interest TEXT,
      lead_urgency TEXT,
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
  await ds.query(`ALTER TABLE "${s}".opportunities ADD COLUMN IF NOT EXISTS lead_source TEXT`);
  await ds.query(`ALTER TABLE "${s}".opportunities ADD COLUMN IF NOT EXISTS lead_interest TEXT`);
  await ds.query(`ALTER TABLE "${s}".opportunities ADD COLUMN IF NOT EXISTS lead_urgency TEXT`);
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
  await ds.query(`ALTER TABLE "${s}".commercial_activities ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'todo'`);
  await ds.query(`ALTER TABLE "${s}".commercial_activities ADD COLUMN IF NOT EXISTS priority TEXT NOT NULL DEFAULT 'medium'`);
  await ds.query(`ALTER TABLE "${s}".commercial_activities ADD COLUMN IF NOT EXISTS kanban_order BIGINT NOT NULL DEFAULT 0`);
  await ds.query(`ALTER TABLE "${s}".commercial_activities ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_activities_kanban" ON "${s}".commercial_activities(status, kanban_order, updated_at DESC) WHERE deleted_at IS NULL`);

  // Commercial Core v2 is additive: existing tenants keep their current CRM rows,
  // while every mutable aggregate gains concurrency/archive metadata.
  for (const table of ['companies', 'contacts', 'leads', 'opportunities', 'commercial_activities']) {
    await ds.query(`ALTER TABLE "${s}"."${table}" ADD COLUMN IF NOT EXISTS version INTEGER NOT NULL DEFAULT 1`);
    await ds.query(`ALTER TABLE "${s}"."${table}" ADD COLUMN IF NOT EXISTS archived_by UUID`);
    await ds.query(`ALTER TABLE "${s}"."${table}" ADD COLUMN IF NOT EXISTS archive_reason TEXT`);
  }

  for (const table of ['companies', 'contacts', 'leads', 'opportunities']) {
    await ds.query(`ALTER TABLE "${s}"."${table}" ADD COLUMN IF NOT EXISTS merged_into_id UUID`);
  }
  await ds.query(`ALTER TABLE "${s}".companies ADD COLUMN IF NOT EXISTS logo_url TEXT`);
  await ds.query(`ALTER TABLE "${s}".companies ADD COLUMN IF NOT EXISTS logo_updated_at TIMESTAMPTZ`);
  await ds.query(`ALTER TABLE "${s}".companies ADD COLUMN IF NOT EXISTS logo_updated_by UUID`);

  await ds.query(`ALTER TABLE "${s}".opportunities ADD COLUMN IF NOT EXISTS pipeline_order BIGINT NOT NULL DEFAULT 0`);
  await ds.query(`ALTER TABLE "${s}".opportunities ADD COLUMN IF NOT EXISTS ui_stage TEXT`);
  await ds.query(`ALTER TABLE "${s}".opportunities ADD COLUMN IF NOT EXISTS converted_company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL`);
  await ds.query(`ALTER TABLE "${s}".opportunities ADD COLUMN IF NOT EXISTS converted_contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL`);
  await ds.query(`ALTER TABLE "${s}".opportunities ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_opportunities_pipeline_order" ON "${s}".opportunities(stage, pipeline_order, updated_at DESC) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_opportunities_converted_company" ON "${s}".opportunities(converted_company_id) WHERE converted_company_id IS NOT NULL`);

  await ds.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_contacts_one_primary"
    ON "${s}".contacts(company_id)
    WHERE company_id IS NOT NULL AND is_primary = true AND deleted_at IS NULL AND merged_into_id IS NULL
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".commercial_attributions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      lead_id UUID REFERENCES "${s}".leads(id) ON DELETE SET NULL,
      opportunity_id UUID REFERENCES "${s}".opportunities(id) ON DELETE SET NULL,
      campaign_id UUID,
      source TEXT,
      medium TEXT,
      campaign_name TEXT,
      content TEXT,
      term TEXT,
      gclid TEXT,
      fbclid TEXT,
      ttclid TEXT,
      landing_url TEXT,
      referrer TEXT,
      attribution_model TEXT NOT NULL DEFAULT 'last_non_direct',
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_attribution_opportunity" ON "${s}".commercial_attributions(opportunity_id, occurred_at DESC)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_attribution_company" ON "${s}".commercial_attributions(company_id, occurred_at DESC)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_attribution_campaign" ON "${s}".commercial_attributions(campaign_id, occurred_at DESC) WHERE campaign_id IS NOT NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".commercial_communications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID NOT NULL REFERENCES "${s}".companies(id) ON DELETE CASCADE,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      lead_id UUID REFERENCES "${s}".leads(id) ON DELETE SET NULL,
      opportunity_id UUID REFERENCES "${s}".opportunities(id) ON DELETE SET NULL,
      channel TEXT NOT NULL,
      direction TEXT,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'recorded',
      occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      version INTEGER NOT NULL DEFAULT 1,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      archived_by UUID,
      archive_reason TEXT
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_communications_company" ON "${s}".commercial_communications(company_id, occurred_at DESC) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".commercial_duplicate_decisions (
      pair_key TEXT PRIMARY KEY,
      left_id UUID NOT NULL,
      right_id UUID NOT NULL,
      record_type TEXT NOT NULL,
      decision TEXT NOT NULL,
      primary_id UUID,
      secondary_id UUID,
      decided_by UUID,
      reason TEXT,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_duplicate_decisions_records" ON "${s}".commercial_duplicate_decisions(left_id, right_id)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".commercial_idempotency (
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

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".commercial_history (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      event_type TEXT NOT NULL,
      actor_user_id UUID,
      before_state JSONB,
      after_state JSONB,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE(operation_id, event_type, entity_id)
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_history_entity" ON "${s}".commercial_history(entity_type, entity_id, created_at DESC)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".commercial_outbox (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      operation_id UUID NOT NULL,
      correlation_id UUID NOT NULL,
      topic TEXT NOT NULL,
      aggregate_type TEXT NOT NULL,
      aggregate_id UUID NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      processed_at TIMESTAMPTZ,
      UNIQUE(operation_id, topic, aggregate_id)
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_commercial_outbox_pending" ON "${s}".commercial_outbox(created_at) WHERE processed_at IS NULL`);
}

export function ensureTenantCrmCoreTables(ds: DataSource, schema: string) {
  const safe = safeSchema(schema, 'ensureTenantCrmCoreTables');
  return provisionSchemaOnce(ds, `tenant-crm:${safe}`, () =>
    provisionTenantCrmCoreTables(ds, safe),
  );
}
