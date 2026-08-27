import { provisionSchemaOnce } from '../common/schema-provisioning-once';
import { safeSchema } from '../common/schema.utils';

type Queryable = { query(sql: string, parameters?: unknown[]): Promise<any> };

async function provision(target: Queryable, schemaValue: string) {
  const s = safeSchema(schemaValue, 'ensureTenantBackendContractTables');
  if (s === 'public') throw new Error('Backend contract tables cannot be provisioned in public');
  await target.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
  const statements = [
    `CREATE TABLE IF NOT EXISTS "${s}".calendar_integration_preferences (
      user_id UUID PRIMARY KEY, enabled_categories TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      ics_token_hash TEXT, ics_token_suffix TEXT, token_created_at TIMESTAMPTZ,
      last_successful_sync_at TIMESTAMPTZ, optimistic_version INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".calendar_integration_events (
      user_id UUID NOT NULL, event_key TEXT NOT NULL, title TEXT NOT NULL,
      starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ, category TEXT NOT NULL
        CHECK (category IN ('activity','appointment','project','contract','quote','payment','renewal','support')),
      status TEXT, description TEXT, archived_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(user_id,event_key))`,
    `CREATE INDEX IF NOT EXISTS idx_calendar_integration_events_active ON "${s}".calendar_integration_events(user_id,starts_at) WHERE archived_at IS NULL`,
    `CREATE TABLE IF NOT EXISTS "${s}".company_intelligence_report_shares (
      report_id UUID NOT NULL, user_id UUID NOT NULL, permission TEXT NOT NULL DEFAULT 'view'
        CHECK (permission IN ('view','edit')), shared_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), revoked_at TIMESTAMPTZ, PRIMARY KEY(report_id,user_id))`,
    `CREATE TABLE IF NOT EXISTS "${s}".company_intelligence_competitors (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), report_id UUID NOT NULL, domain TEXT NOT NULL,
      company_name TEXT, status TEXT NOT NULL DEFAULT 'pending', report JSONB NOT NULL DEFAULT '{}'::jsonb,
      error_code TEXT, created_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), deleted_at TIMESTAMPTZ, UNIQUE(report_id,domain))`,
    `ALTER TABLE "${s}".company_intelligence_report_shares ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ`,
    `ALTER TABLE "${s}".company_intelligence_competitors ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ`,
    `CREATE TABLE IF NOT EXISTS "${s}".company_intelligence_exports (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), report_id UUID NOT NULL, actor_user_id UUID NOT NULL,
      format TEXT NOT NULL CHECK (format IN ('json','csv')), created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `ALTER TABLE "${s}".company_intelligence_reports ADD COLUMN IF NOT EXISTS optimistic_version INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE "${s}".flowboards ADD COLUMN IF NOT EXISTS project_id UUID`,
    `ALTER TABLE "${s}".flowboards ADD COLUMN IF NOT EXISTS is_template BOOLEAN NOT NULL DEFAULT false`,
    `ALTER TABLE "${s}".flowboards ADD COLUMN IF NOT EXISTS template_key TEXT`,
    `CREATE INDEX IF NOT EXISTS idx_flowboards_project ON "${s}".flowboards(project_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS idx_flowboards_template ON "${s}".flowboards(is_template) WHERE deleted_at IS NULL`,
    `CREATE TABLE IF NOT EXISTS "${s}".customer_inbox_conversations (
      company_id UUID PRIMARY KEY, status TEXT NOT NULL DEFAULT 'open', priority TEXT NOT NULL DEFAULT 'normal',
      assigned_to_id UUID, supervisor_id UUID, due_at TIMESTAMPTZ, category TEXT,
      tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], linked_records JSONB NOT NULL DEFAULT '[]'::jsonb,
      candidate_matches JSONB NOT NULL DEFAULT '[]'::jsonb, optimistic_version INTEGER NOT NULL DEFAULT 1,
      updated_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".customer_inbox_user_state (
      user_id UUID PRIMARY KEY, filters JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".customer_inbox_drafts (
      company_id UUID NOT NULL, user_id UUID NOT NULL, body TEXT NOT NULL DEFAULT '',
      optimistic_version INTEGER NOT NULL DEFAULT 1, updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(company_id,user_id))`,
    `CREATE TABLE IF NOT EXISTS "${s}".customer_inbox_receipts (
      company_id UUID NOT NULL, user_id UUID NOT NULL, read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY(company_id,user_id))`,
    `ALTER TABLE "${s}".commercial_communications ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ`,
    `ALTER TABLE "${s}".commercial_communications ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ`,
    `ALTER TABLE "${s}".commercial_communications ADD COLUMN IF NOT EXISTS idempotency_key TEXT`,
    `ALTER TABLE IF EXISTS "${s}".order_items ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_commercial_communications_idempotency ON "${s}".commercial_communications(idempotency_key) WHERE idempotency_key IS NOT NULL`,
    `CREATE TABLE IF NOT EXISTS "${s}".commerce_settings (
      singleton BOOLEAN PRIMARY KEY DEFAULT true CHECK (singleton), auto_number_orders BOOLEAN NOT NULL DEFAULT true,
      require_deposit BOOLEAN NOT NULL DEFAULT false, require_signed_contract BOOLEAN NOT NULL DEFAULT true,
      default_deposit_percent NUMERIC(5,2) NOT NULL DEFAULT 0, default_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 22,
      default_payment_terms_days INTEGER NOT NULL DEFAULT 30, default_currency CHAR(3) NOT NULL DEFAULT 'EUR',
      supplier_name TEXT, supplier_brand_name TEXT, supplier_legal_holder TEXT, supplier_vat_number TEXT,
      supplier_tax_code TEXT, supplier_address TEXT, supplier_email TEXT, supplier_phone TEXT,
      supplier_postal_code TEXT, supplier_city TEXT, supplier_province TEXT, supplier_country TEXT,
      supplier_certified_email TEXT, supplier_sdi_code TEXT, supplier_website TEXT, supplier_logo_url TEXT,
      order_prefix TEXT NOT NULL DEFAULT 'ORD', contract_prefix TEXT NOT NULL DEFAULT 'CTR',
      quote_validity_days INTEGER NOT NULL DEFAULT 30, payment_terms TEXT, bank_details TEXT, default_notes TEXT,
      enabled_sales_channels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[], enabled_payment_methods TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      renewal_reminder_days INTEGER NOT NULL DEFAULT 30, optimistic_version INTEGER NOT NULL DEFAULT 1,
      updated_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS require_signed_contract BOOLEAN NOT NULL DEFAULT true`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS default_vat_rate NUMERIC(5,2) NOT NULL DEFAULT 22`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_brand_name TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_legal_holder TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_email TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_phone TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_postal_code TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_city TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_province TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_country TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_certified_email TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_sdi_code TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_website TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS supplier_logo_url TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS quote_validity_days INTEGER NOT NULL DEFAULT 30`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS payment_terms TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS bank_details TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS default_notes TEXT`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS enabled_payment_methods TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]`,
    `ALTER TABLE "${s}".commerce_settings ADD COLUMN IF NOT EXISTS renewal_reminder_days INTEGER NOT NULL DEFAULT 30`,
    `CREATE TABLE IF NOT EXISTS "${s}".commerce_settings_audit (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), actor_user_id UUID NOT NULL,
      from_version INTEGER NOT NULL, to_version INTEGER NOT NULL, changed_fields TEXT[] NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".customer_care_settings (
      company_id UUID PRIMARY KEY, mode TEXT NOT NULL DEFAULT 'Nessuna', cadence_days INTEGER,
      owner_user_id UUID, next_due_at TIMESTAMPTZ, notifications_enabled BOOLEAN NOT NULL DEFAULT true,
      notes TEXT, optimistic_version INTEGER NOT NULL DEFAULT 1, updated_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".customer_finance_snapshots (
      company_id UUID PRIMARY KEY, revenue_cents BIGINT NOT NULL DEFAULT 0, cost_cents BIGINT NOT NULL DEFAULT 0,
      paid_cents BIGINT NOT NULL DEFAULT 0, refunded_cents BIGINT NOT NULL DEFAULT 0, currency CHAR(3) NOT NULL DEFAULT 'EUR',
      total_cents BIGINT NOT NULL DEFAULT 0, deposit_cents BIGINT NOT NULL DEFAULT 0, invoiced_cents BIGINT NOT NULL DEFAULT 0,
      note TEXT, optimistic_version INTEGER NOT NULL DEFAULT 1, updated_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `ALTER TABLE "${s}".customer_finance_snapshots ADD COLUMN IF NOT EXISTS total_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE "${s}".customer_finance_snapshots ADD COLUMN IF NOT EXISTS deposit_cents BIGINT NOT NULL DEFAULT 0`,
    `ALTER TABLE "${s}".customer_finance_snapshots ADD COLUMN IF NOT EXISTS invoiced_cents BIGINT NOT NULL DEFAULT 0`,
    `CREATE TABLE IF NOT EXISTS "${s}".customer_finance_audit (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), company_id UUID NOT NULL, actor_user_id UUID NOT NULL,
      from_version INTEGER NOT NULL, to_version INTEGER NOT NULL, changed_fields TEXT[] NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".customer_document_metadata (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), company_id UUID NOT NULL, title TEXT NOT NULL,
      category TEXT, description TEXT, relation_type TEXT, relation_id UUID, tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
      visibility TEXT NOT NULL DEFAULT 'internal' CHECK (visibility IN ('internal','shared')),
      sort_order INTEGER NOT NULL DEFAULT 0, optimistic_version INTEGER NOT NULL DEFAULT 1,
      created_by UUID NOT NULL, updated_by UUID NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), archived_at TIMESTAMPTZ)`,
    `CREATE INDEX IF NOT EXISTS idx_customer_document_metadata_company ON "${s}".customer_document_metadata(company_id,sort_order) WHERE archived_at IS NULL`,
    `CREATE TABLE IF NOT EXISTS "${s}".guided_calls (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), company_id UUID, lead_id UUID,
      status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','active','completed','cancelled')),
      title TEXT NOT NULL, script_answers JSONB NOT NULL DEFAULT '{}'::jsonb,
      workflow JSONB NOT NULL DEFAULT '{}'::jsonb, completion JSONB NOT NULL DEFAULT '{}'::jsonb,
      outcome TEXT, notes TEXT,
      optimistic_version INTEGER NOT NULL DEFAULT 1, created_by UUID NOT NULL, updated_by UUID NOT NULL,
      started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `ALTER TABLE "${s}".guided_calls ADD COLUMN IF NOT EXISTS workflow JSONB NOT NULL DEFAULT '{}'::jsonb`,
    `ALTER TABLE "${s}".guided_calls ADD COLUMN IF NOT EXISTS completion JSONB NOT NULL DEFAULT '{}'::jsonb`,
    `CREATE UNIQUE INDEX IF NOT EXISTS uq_guided_calls_active_lead ON "${s}".guided_calls(lead_id) WHERE status IN ('draft','active')`,
    `CREATE TABLE IF NOT EXISTS "${s}".guided_call_messages (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), call_id UUID NOT NULL REFERENCES "${s}".guided_calls(id),
      channel TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'prepared'
        CHECK (status IN ('prepared','external_opened','manually_confirmed','not_sent','sent','replied','no_reply','follow_up')),
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb, created_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `ALTER TABLE "${s}".guided_call_messages ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb`,
    `CREATE TABLE IF NOT EXISTS "${s}".guided_call_audit (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), call_id UUID NOT NULL, actor_user_id UUID NOT NULL,
      action TEXT NOT NULL, from_version INTEGER, to_version INTEGER, created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
    `CREATE TABLE IF NOT EXISTS "${s}".team_duties (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), duty_key TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      current_version INTEGER NOT NULL DEFAULT 1, updated_by UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), archived_at TIMESTAMPTZ)`,
    `CREATE TABLE IF NOT EXISTS "${s}".team_duty_versions (
      duty_id UUID NOT NULL REFERENCES "${s}".team_duties(id), version INTEGER NOT NULL,
      content JSONB NOT NULL, reason TEXT NOT NULL, author_user_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(duty_id,version))`,
    `CREATE TABLE IF NOT EXISTS "${s}".team_duty_reads (
      duty_id UUID NOT NULL, user_id UUID NOT NULL, version INTEGER NOT NULL,
      read_at TIMESTAMPTZ NOT NULL DEFAULT now(), PRIMARY KEY(duty_id,user_id,version))`,
  ];
  for (const statement of statements) await target.query(statement);
}

export async function ensureTenantBackendContractTables(target: Queryable, schema: string) {
  const safe = safeSchema(schema, 'ensureTenantBackendContractTables');
  return provisionSchemaOnce(target, `${safe}:backend-contracts-v186`, () => provision(target, safe));
}
