import 'reflect-metadata';
import { createHash } from 'crypto';
import { writeFile } from 'fs/promises';
import { DataSource, MigrationInterface } from 'typeorm';
import { InitialPublicSchema1714752000000 } from '../migrations/1714752000000-InitialPublicSchema';
import { CreateTenantRegistry1750000000000 } from '../migrations/1750000000000-CreateTenantRegistry';
import { AddGoogleOAuthUsers1760000000000 } from '../migrations/1760000000000-AddGoogleOAuthUsers';
import { CreatePlatformAccessCatalog1770000000000 } from '../migrations/1770000000000-CreatePlatformAccessCatalog';
import { CreateBackupSchedules1780000000000 } from '../migrations/1780000000000-CreateBackupSchedules';
import { CreateCommercialCoreAuthority1790000000000 } from '../migrations/1790000000000-CreateCommercialCoreAuthority';
import { CreateDeliveryCoreAuthority1800000000000 } from '../migrations/1800000000000-CreateDeliveryCoreAuthority';
import { CreateCommerceCashCoreAuthority1810000000000 } from '../migrations/1810000000000-CreateCommerceCashCoreAuthority';
import { CreateDocumentRevenueCoreAuthority1820000000000 } from '../migrations/1820000000000-CreateDocumentRevenueCoreAuthority';
import { CreateCollaborationNotificationsRealtimeAuthority1830000000000 } from '../migrations/1830000000000-CreateCollaborationNotificationsRealtimeAuthority';
import { CreateAutomationPerformanceAuthority1840000000000 } from '../migrations/1840000000000-CreateAutomationPerformanceAuthority';
import { CreateUniversalTenantFeatures1850000000000 } from '../migrations/1850000000000-CreateUniversalTenantFeatures';

type MigrationConstructor = new () => MigrationInterface;

export const BASELINE_MIGRATIONS: MigrationConstructor[] = [
  InitialPublicSchema1714752000000,
  CreateTenantRegistry1750000000000,
  AddGoogleOAuthUsers1760000000000,
  CreatePlatformAccessCatalog1770000000000,
  CreateBackupSchedules1780000000000,
];

export const AUTHORITY_MIGRATIONS: MigrationConstructor[] = [
  CreateCommercialCoreAuthority1790000000000,
  CreateDeliveryCoreAuthority1800000000000,
  CreateCommerceCashCoreAuthority1810000000000,
  CreateDocumentRevenueCoreAuthority1820000000000,
  CreateCollaborationNotificationsRealtimeAuthority1830000000000,
  CreateAutomationPerformanceAuthority1840000000000,
];

export const PRE_186_MIGRATIONS: MigrationConstructor[] = [
  ...AUTHORITY_MIGRATIONS,
  CreateUniversalTenantFeatures1850000000000,
];

export const BASELINE_MAX = 1780000000000;
export const FINAL_MAX = 1840000000000;

/** Authority-only artifacts that must not exist in the frozen legacy fixture. */
export const POST_178_FORBIDDEN_TABLES = [
  'commercial_attributions',
  'commercial_communications',
  'commercial_duplicate_decisions',
  'commercial_history',
  'commercial_idempotency',
  'commercial_outbox',
  'delivery_idempotency',
  'delivery_outbox',
  'delivery_time_sessions',
  'project_publications',
  'project_qa_items',
  'project_workflow_events',
  'task_assignees',
  'task_dependencies',
  'task_due_date_history',
  'service_categories',
  'services',
  'service_promotions',
  'service_extras',
  'service_billing_plans',
  'sales',
  'sale_items',
  'orders',
  'order_items',
  'commerce_history',
  'commerce_idempotency',
  'commerce_outbox',
  'payment_allocations',
  'document_artifacts',
  'contract_send_events',
  'contract_signature_events',
  'record_comments',
  'record_comment_mentions',
  'record_comment_attachments',
  'record_comment_reactions',
  'collaboration_history',
  'collaboration_idempotency',
  'collaboration_outbox',
  'collaboration_attachment_tokens',
  'automation_adapters',
  'automation_dead_letters',
  'automation_execution_registry',
  'automation_outbox',
  'automation_rule_versions',
  'performance_event_registry',
  'point_ledger',
  'point_policies',
  'point_policy_versions',
  'ranking_config_versions',
  'ranking_configs',
  'ranking_revisions',
  'ranking_snapshots',
] as const;

export const POST_178_FORBIDDEN_COLUMNS: Array<[string, string]> = [
  ['companies', 'version'],
  ['contacts', 'version'],
  ['leads', 'version'],
  ['opportunities', 'version'],
  ['opportunities', 'pipeline_order'],
  ['commercial_activities', 'kanban_order'],
  ['projects', 'version'],
  ['projects', 'delivery_stage'],
  ['tasks', 'version'],
  ['payments', 'order_id'],
  ['payments', 'payment_type'],
  ['quotes', 'optimistic_version'],
  ['contracts', 'optimistic_version'],
  ['notifications', 'operation_id'],
  ['automation_rules', 'current_version_id'],
];

export const SENTINELS = {
  doflowTenant: '10000000-0000-4000-8000-000000000001',
  secondaryTenant: '10000000-0000-4000-8000-000000000002',
  oliver: '20000000-0000-4000-8000-000000000001',
  executiveTwo: '20000000-0000-4000-8000-000000000002',
  secondaryUser: '20000000-0000-4000-8000-000000000003',
  company: '30000000-0000-4000-8000-000000000001',
  archivedCompany: '30000000-0000-4000-8000-000000000002',
  contact: '31000000-0000-4000-8000-000000000001',
  lead: '32000000-0000-4000-8000-000000000001',
  opportunity: '33000000-0000-4000-8000-000000000001',
  activity: '34000000-0000-4000-8000-000000000001',
  serviceTemplate: '35000000-0000-4000-8000-000000000001',
  briefing: '36000000-0000-4000-8000-000000000001',
  quote: '37000000-0000-4000-8000-000000000001',
  quoteItem: '38000000-0000-4000-8000-000000000001',
  project: '40000000-0000-4000-8000-000000000001',
  ambiguousProject: '40000000-0000-4000-8000-000000000002',
  projectMember: '41000000-0000-4000-8000-000000000001',
  milestone: '42000000-0000-4000-8000-000000000001',
  task: '43000000-0000-4000-8000-000000000001',
  checklist: '44000000-0000-4000-8000-000000000001',
  comment: '45000000-0000-4000-8000-000000000001',
  fileLink: '46000000-0000-4000-8000-000000000001',
  invoice: '50000000-0000-4000-8000-000000000001',
  invoiceItem: '51000000-0000-4000-8000-000000000001',
  payment: '52000000-0000-4000-8000-000000000001',
  deadline: '53000000-0000-4000-8000-000000000001',
  recurring: '54000000-0000-4000-8000-000000000001',
  renewal: '55000000-0000-4000-8000-000000000001',
  financialStatus: '56000000-0000-4000-8000-000000000001',
  folder: '60000000-0000-4000-8000-000000000001',
  document: '61000000-0000-4000-8000-000000000001',
  documentLink: '62000000-0000-4000-8000-000000000001',
  contractTemplate: '63000000-0000-4000-8000-000000000001',
  contract: '64000000-0000-4000-8000-000000000001',
  notification: '65000000-0000-4000-8000-000000000001',
  automationTemplate: '66000000-0000-4000-8000-000000000001',
  automationRule: '67000000-0000-4000-8000-000000000001',
  teamOliver: '68000000-0000-4000-8000-000000000001',
  teamExecutiveTwo: '68000000-0000-4000-8000-000000000002',
  secondaryCompany: '70000000-0000-4000-8000-000000000001',
  secondaryProject: '71000000-0000-4000-8000-000000000001',
} as const;

const FIXED_CREATED_AT = '2025-01-15T10:00:00.000Z';

function sha256(value: unknown): string {
  return createHash('sha256')
    .update(typeof value === 'string' ? value : stableStringify(value))
    .digest('hex');
}

export function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return `{${Object.keys(record)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function assertLocalAcceptanceUrl(raw: string) {
  const parsed = new URL(raw);
  if (!['localhost', '127.0.0.1'].includes(parsed.hostname)) {
    throw new Error('Pre-179 rehearsal refuses a non-local PostgreSQL host.');
  }
  if (!/acceptance/i.test(parsed.pathname)) {
    throw new Error('Pre-179 rehearsal requires an acceptance database name.');
  }
  if (process.env.NODE_ENV !== 'test' || String(process.env.DB_SYNC).toLowerCase() !== 'false') {
    throw new Error('Pre-179 rehearsal requires NODE_ENV=test and DB_SYNC=false.');
  }
}

function databaseUrl(): string {
  const raw = String(process.env.DATABASE_URL || '').trim();
  if (!raw) throw new Error('DATABASE_URL is required.');
  assertLocalAcceptanceUrl(raw);
  return raw;
}

function source(migrations: MigrationConstructor[]): DataSource {
  return new DataSource({
    type: 'postgres',
    url: databaseUrl(),
    entities: [],
    migrations,
    migrationsTableName: 'doflow_migrations',
    synchronize: false,
    logging: ['error', 'migration'],
  });
}

export async function runMigrationSet(migrations: MigrationConstructor[]) {
  const dataSource = source(migrations);
  await dataSource.initialize();
  try {
    const applied = await dataSource.runMigrations({ transaction: 'all' });
    return applied.map((migration) => migration.name);
  } finally {
    await dataSource.destroy();
  }
}

/**
 * Frozen representation of the unversioned tenant tables that existed before
 * migration 179. It deliberately contains no authority History/outbox,
 * idempotency, order, refund, QA, points, ranking or document artifact table.
 */
export async function createFrozenLegacySchema(dataSource: DataSource, schema: 'doflow' | 'acceptance_secondary') {
  if (!['doflow', 'acceptance_secondary'].includes(schema)) throw new Error('Unexpected legacy schema.');
  const s = schema;
  await dataSource.query(`CREATE SCHEMA "${s}"`);
  await dataSource.query(`
    CREATE TABLE "${s}".users (
      id UUID PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT, role TEXT NOT NULL DEFAULT 'user',
      full_name TEXT, auth_provider TEXT NOT NULL DEFAULT 'password', google_id TEXT, avatar_url TEXT,
      email_verified_at TIMESTAMP, mfa_enabled BOOLEAN DEFAULT false, mfa_secret TEXT,
      is_active BOOLEAN DEFAULT true, created_at TIMESTAMP DEFAULT now(), updated_at TIMESTAMP DEFAULT now()
    );
    CREATE UNIQUE INDEX "idx_${s}_users_google_id" ON "${s}".users(google_id) WHERE google_id IS NOT NULL;
    CREATE TABLE "${s}".audit_log (
      id BIGSERIAL PRIMARY KEY, actor_email TEXT, actor_role TEXT, action TEXT NOT NULL, target TEXT,
      target_email TEXT, ip TEXT, ip_address TEXT, user_agent TEXT, metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT now()
    );
    CREATE TABLE "${s}".files (
      id SERIAL PRIMARY KEY, key TEXT NOT NULL, original_name TEXT, content_type TEXT, size BIGINT,
      created_by TEXT, created_at TIMESTAMP DEFAULT now()
    );
    CREATE TABLE "${s}".companies (
      id UUID PRIMARY KEY, name TEXT NOT NULL, legal_name TEXT, vat_number TEXT, fiscal_code TEXT,
      website TEXT, email TEXT, phone TEXT, industry TEXT, size TEXT, status TEXT NOT NULL DEFAULT 'prospect',
      source TEXT, address TEXT, city TEXT, province TEXT, country TEXT DEFAULT 'IT', notes TEXT,
      owner_user_id UUID, created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".contacts (
      id UUID PRIMARY KEY, company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      first_name TEXT NOT NULL, last_name TEXT, role_title TEXT, email TEXT, phone TEXT,
      decision_level TEXT, preferred_channel TEXT, notes TEXT, is_primary BOOLEAN DEFAULT false,
      created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".leads (
      id UUID PRIMARY KEY, company_id UUID REFERENCES "${s}".companies(id), contact_id UUID REFERENCES "${s}".contacts(id),
      title TEXT NOT NULL, source TEXT, interest TEXT, budget_estimate NUMERIC, urgency TEXT, quality TEXT,
      status TEXT NOT NULL DEFAULT 'new', assigned_to UUID, next_action TEXT, next_action_at TIMESTAMPTZ,
      lost_reason TEXT, notes TEXT, created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".opportunities (
      id UUID PRIMARY KEY, company_id UUID REFERENCES "${s}".companies(id), contact_id UUID REFERENCES "${s}".contacts(id),
      lead_id UUID REFERENCES "${s}".leads(id), title TEXT NOT NULL, service_type TEXT, lead_source TEXT,
      lead_interest TEXT, lead_urgency TEXT, value_estimate NUMERIC, probability INTEGER,
      stage TEXT NOT NULL DEFAULT 'new_lead', expected_close_date DATE, assigned_to UUID,
      next_action TEXT, next_action_at TIMESTAMPTZ, lost_reason TEXT, notes TEXT, created_by UUID, updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".commercial_activities (
      id UUID PRIMARY KEY, company_id UUID REFERENCES "${s}".companies(id), contact_id UUID REFERENCES "${s}".contacts(id),
      lead_id UUID REFERENCES "${s}".leads(id), opportunity_id UUID REFERENCES "${s}".opportunities(id),
      type TEXT NOT NULL, title TEXT NOT NULL, description TEXT, due_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
      assigned_to UUID, created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".briefing_templates (
      id UUID PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'website', description TEXT,
      schema_json JSONB NOT NULL DEFAULT '{}'::jsonb, is_active BOOLEAN DEFAULT true, created_by UUID,
      updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".briefings (
      id UUID PRIMARY KEY, company_id UUID REFERENCES "${s}".companies(id), contact_id UUID REFERENCES "${s}".contacts(id),
      opportunity_id UUID REFERENCES "${s}".opportunities(id), template_id UUID REFERENCES "${s}".briefing_templates(id),
      title TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'website', status TEXT NOT NULL DEFAULT 'draft', objective TEXT,
      target TEXT, budget_estimate NUMERIC, deadline DATE, answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      missing_materials_json JSONB NOT NULL DEFAULT '[]'::jsonb, internal_notes TEXT, client_notes TEXT,
      created_by UUID, updated_by UUID, approved_by UUID, approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".briefing_material_requests (
      id UUID PRIMARY KEY, briefing_id UUID NOT NULL REFERENCES "${s}".briefings(id) ON DELETE CASCADE,
      company_id UUID REFERENCES "${s}".companies(id), title TEXT NOT NULL, description TEXT, type TEXT,
      status TEXT NOT NULL DEFAULT 'missing', due_at TIMESTAMPTZ, received_at TIMESTAMPTZ, file_id UUID,
      created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".service_templates (
      id UUID PRIMARY KEY, name TEXT NOT NULL, category TEXT, description TEXT,
      default_unit_price NUMERIC NOT NULL DEFAULT 0, default_quantity NUMERIC NOT NULL DEFAULT 1,
      billing_type TEXT NOT NULL DEFAULT 'one_time', is_active BOOLEAN DEFAULT true,
      created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".quotes (
      id UUID PRIMARY KEY, company_id UUID REFERENCES "${s}".companies(id), contact_id UUID REFERENCES "${s}".contacts(id),
      opportunity_id UUID REFERENCES "${s}".opportunities(id), briefing_id UUID REFERENCES "${s}".briefings(id),
      quote_number TEXT, title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'draft', currency TEXT NOT NULL DEFAULT 'EUR',
      subtotal NUMERIC NOT NULL DEFAULT 0, discount_total NUMERIC NOT NULL DEFAULT 0, tax_total NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0, valid_until DATE, accepted_at TIMESTAMPTZ, rejected_at TIMESTAMPTZ,
      client_notes TEXT, internal_notes TEXT, terms TEXT, created_by UUID, updated_by UUID,
      accepted_by_contact_id UUID REFERENCES "${s}".contacts(id), created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".quote_items (
      id UUID PRIMARY KEY, quote_id UUID NOT NULL REFERENCES "${s}".quotes(id) ON DELETE CASCADE,
      service_template_id UUID REFERENCES "${s}".service_templates(id), name TEXT NOT NULL, description TEXT,
      quantity NUMERIC NOT NULL DEFAULT 1, unit_price NUMERIC NOT NULL DEFAULT 0, discount NUMERIC NOT NULL DEFAULT 0,
      tax_rate NUMERIC NOT NULL DEFAULT 0, total NUMERIC NOT NULL DEFAULT 0,
      billing_type TEXT NOT NULL DEFAULT 'one_time', sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".projects (
      id UUID PRIMARY KEY, company_id UUID REFERENCES "${s}".companies(id), contact_id UUID REFERENCES "${s}".contacts(id),
      opportunity_id UUID REFERENCES "${s}".opportunities(id), briefing_id UUID REFERENCES "${s}".briefings(id),
      quote_id UUID REFERENCES "${s}".quotes(id), name TEXT NOT NULL, description TEXT, type TEXT,
      status TEXT NOT NULL DEFAULT 'to_start', priority TEXT NOT NULL DEFAULT 'medium', current_phase TEXT,
      progress INTEGER NOT NULL DEFAULT 0, project_manager_id UUID, start_date DATE, due_date DATE,
      delivered_at TIMESTAMPTZ, closed_at TIMESTAMPTZ, internal_notes TEXT, client_notes TEXT,
      created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".project_members (
      id UUID PRIMARY KEY, project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      user_id UUID NOT NULL, role TEXT NOT NULL DEFAULT 'member', hourly_rate NUMERIC, allocation_percent INTEGER,
      created_by UUID, created_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".milestones (
      id UUID PRIMARY KEY, project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'pending', due_date DATE,
      completed_at TIMESTAMPTZ, sort_order INTEGER DEFAULT 0, created_by UUID, updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".tasks (
      id UUID PRIMARY KEY, project_id UUID REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      milestone_id UUID REFERENCES "${s}".milestones(id) ON DELETE SET NULL, company_id UUID REFERENCES "${s}".companies(id),
      title TEXT NOT NULL, description TEXT, status TEXT NOT NULL DEFAULT 'backlog', priority TEXT NOT NULL DEFAULT 'medium',
      assignee_id UUID, assigned_by UUID, due_at TIMESTAMPTZ, estimated_minutes INTEGER, actual_minutes INTEGER,
      tags TEXT[], blocked_reason TEXT, completed_at TIMESTAMPTZ, created_by UUID, updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".task_checklist_items (
      id UUID PRIMARY KEY, task_id UUID NOT NULL REFERENCES "${s}".tasks(id) ON DELETE CASCADE,
      title TEXT NOT NULL, is_done BOOLEAN DEFAULT false, sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".project_comments (
      id UUID PRIMARY KEY, project_id UUID REFERENCES "${s}".projects(id), task_id UUID REFERENCES "${s}".tasks(id),
      milestone_id UUID REFERENCES "${s}".milestones(id), body TEXT NOT NULL, visibility TEXT NOT NULL DEFAULT 'internal',
      created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".project_file_links (
      id UUID PRIMARY KEY, project_id UUID REFERENCES "${s}".projects(id), task_id UUID REFERENCES "${s}".tasks(id),
      file_id UUID NOT NULL, type TEXT, visibility TEXT NOT NULL DEFAULT 'internal', created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".invoices (
      id UUID PRIMARY KEY, company_id UUID REFERENCES "${s}".companies(id), contact_id UUID REFERENCES "${s}".contacts(id),
      opportunity_id UUID REFERENCES "${s}".opportunities(id), briefing_id UUID REFERENCES "${s}".briefings(id),
      quote_id UUID REFERENCES "${s}".quotes(id), project_id UUID REFERENCES "${s}".projects(id), invoice_number TEXT,
      title TEXT NOT NULL, type TEXT NOT NULL DEFAULT 'standard', status TEXT NOT NULL DEFAULT 'draft',
      currency TEXT NOT NULL DEFAULT 'EUR', subtotal NUMERIC NOT NULL DEFAULT 0, discount_total NUMERIC NOT NULL DEFAULT 0,
      tax_total NUMERIC NOT NULL DEFAULT 0, total NUMERIC NOT NULL DEFAULT 0, paid_total NUMERIC NOT NULL DEFAULT 0,
      remaining_total NUMERIC NOT NULL DEFAULT 0, issue_date DATE, due_date DATE, paid_at TIMESTAMPTZ,
      payment_method TEXT, external_reference TEXT, pdf_file_id UUID, client_notes TEXT, internal_notes TEXT,
      created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".invoice_items (
      id UUID PRIMARY KEY, invoice_id UUID NOT NULL REFERENCES "${s}".invoices(id) ON DELETE CASCADE,
      quote_item_id UUID REFERENCES "${s}".quote_items(id), name TEXT NOT NULL, description TEXT,
      quantity NUMERIC NOT NULL DEFAULT 1, unit_price NUMERIC NOT NULL DEFAULT 0, discount NUMERIC NOT NULL DEFAULT 0,
      tax_rate NUMERIC NOT NULL DEFAULT 0, total NUMERIC NOT NULL DEFAULT 0, sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".payments (
      id UUID PRIMARY KEY, invoice_id UUID REFERENCES "${s}".invoices(id), company_id UUID REFERENCES "${s}".companies(id),
      project_id UUID REFERENCES "${s}".projects(id), amount NUMERIC NOT NULL, currency TEXT NOT NULL DEFAULT 'EUR',
      status TEXT NOT NULL DEFAULT 'recorded', payment_date DATE, method TEXT, reference TEXT, notes TEXT,
      created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".financial_deadlines (
      id UUID PRIMARY KEY, company_id UUID REFERENCES "${s}".companies(id), project_id UUID REFERENCES "${s}".projects(id),
      quote_id UUID REFERENCES "${s}".quotes(id), invoice_id UUID REFERENCES "${s}".invoices(id), title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'payment', status TEXT NOT NULL DEFAULT 'open', amount NUMERIC,
      currency TEXT NOT NULL DEFAULT 'EUR', due_date DATE NOT NULL, completed_at TIMESTAMPTZ, notes TEXT,
      created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".recurring_services (
      id UUID PRIMARY KEY, company_id UUID REFERENCES "${s}".companies(id), project_id UUID REFERENCES "${s}".projects(id),
      quote_id UUID REFERENCES "${s}".quotes(id), name TEXT NOT NULL, category TEXT, status TEXT NOT NULL DEFAULT 'active',
      billing_cycle TEXT NOT NULL DEFAULT 'yearly', amount NUMERIC NOT NULL DEFAULT 0, currency TEXT NOT NULL DEFAULT 'EUR',
      start_date DATE, next_due_date DATE, end_date DATE, auto_renew BOOLEAN DEFAULT false,
      internal_notes TEXT, client_notes TEXT, created_by UUID, updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".renewals (
      id UUID PRIMARY KEY, recurring_service_id UUID REFERENCES "${s}".recurring_services(id),
      company_id UUID REFERENCES "${s}".companies(id), project_id UUID REFERENCES "${s}".projects(id),
      title TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'upcoming', amount NUMERIC, currency TEXT NOT NULL DEFAULT 'EUR',
      due_date DATE NOT NULL, reminded_at TIMESTAMPTZ, completed_at TIMESTAMPTZ,
      invoice_id UUID REFERENCES "${s}".invoices(id), notes TEXT, created_by UUID, updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".project_financial_status (
      id UUID PRIMARY KEY, project_id UUID NOT NULL REFERENCES "${s}".projects(id), quote_id UUID REFERENCES "${s}".quotes(id),
      company_id UUID REFERENCES "${s}".companies(id), deposit_required NUMERIC NOT NULL DEFAULT 0,
      deposit_paid NUMERIC NOT NULL DEFAULT 0, balance_required NUMERIC NOT NULL DEFAULT 0,
      balance_paid NUMERIC NOT NULL DEFAULT 0, total_expected NUMERIC NOT NULL DEFAULT 0,
      total_paid NUMERIC NOT NULL DEFAULT 0, payment_status TEXT NOT NULL DEFAULT 'not_started',
      deposit_due_date DATE, balance_due_date DATE, last_payment_at TIMESTAMPTZ, internal_notes TEXT,
      created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".document_folders (
      id UUID PRIMARY KEY, parent_id UUID REFERENCES "${s}".document_folders(id), name TEXT NOT NULL, slug TEXT,
      description TEXT, entity_type TEXT, entity_id UUID, visibility TEXT NOT NULL DEFAULT 'internal',
      created_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".documents (
      id UUID PRIMARY KEY, folder_id UUID REFERENCES "${s}".document_folders(id), title TEXT NOT NULL,
      description TEXT, original_filename TEXT NOT NULL, stored_filename TEXT, mime_type TEXT, size_bytes BIGINT,
      storage_provider TEXT NOT NULL DEFAULT 'minio', storage_bucket TEXT, storage_key TEXT NOT NULL, checksum TEXT,
      category TEXT NOT NULL DEFAULT 'generic', visibility TEXT NOT NULL DEFAULT 'internal', status TEXT NOT NULL DEFAULT 'active',
      entity_type TEXT, entity_id UUID, uploaded_by UUID, metadata JSONB, version_group_id UUID,
      version_number INTEGER NOT NULL DEFAULT 1, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".document_links (
      id UUID PRIMARY KEY, document_id UUID NOT NULL REFERENCES "${s}".documents(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL, entity_id UUID NOT NULL, relation_type TEXT NOT NULL DEFAULT 'attachment',
      created_by UUID, created_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".contract_templates (
      id UUID PRIMARY KEY, name TEXT NOT NULL, slug TEXT NOT NULL, category TEXT NOT NULL DEFAULT 'general',
      description TEXT, body_markdown TEXT NOT NULL DEFAULT '', variables JSONB, default_checklist JSONB,
      is_active BOOLEAN NOT NULL DEFAULT true, version_label TEXT, created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".contracts (
      id UUID PRIMARY KEY, contract_number TEXT NOT NULL, title TEXT NOT NULL, description TEXT,
      template_id UUID REFERENCES "${s}".contract_templates(id), company_id UUID, contact_id UUID, quote_id UUID,
      project_id UUID, opportunity_id UUID, owner_user_id UUID, assigned_to_user_id UUID,
      status TEXT NOT NULL DEFAULT 'draft', signature_status TEXT NOT NULL DEFAULT 'not_started',
      priority TEXT NOT NULL DEFAULT 'medium', contract_type TEXT NOT NULL DEFAULT 'generic', amount NUMERIC(14,2),
      currency TEXT NOT NULL DEFAULT 'EUR', payment_terms TEXT, start_date DATE, end_date DATE, renewal_date DATE,
      due_date DATE, sent_at TIMESTAMPTZ, approved_at TIMESTAMPTZ, signed_at TIMESTAMPTZ,
      activated_at TIMESTAMPTZ, cancelled_at TIMESTAMPTZ, archived_at TIMESTAMPTZ, internal_notes TEXT,
      public_notes TEXT, metadata JSONB, created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".notifications (
      id UUID PRIMARY KEY, recipient_user_id UUID, recipient_role TEXT, title TEXT NOT NULL, body TEXT, type TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'medium', status TEXT NOT NULL DEFAULT 'unread', entity_type TEXT, entity_id UUID,
      link_url TEXT, fingerprint TEXT, metadata JSONB, read_at TIMESTAMPTZ, archived_at TIMESTAMPTZ,
      created_by UUID, created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".automation_templates (
      id UUID PRIMARY KEY, key TEXT NOT NULL, name TEXT NOT NULL, description TEXT, category TEXT NOT NULL DEFAULT 'general',
      trigger_type TEXT NOT NULL, default_conditions JSONB, default_actions JSONB NOT NULL DEFAULT '[]'::jsonb,
      default_schedule JSONB, is_active BOOLEAN NOT NULL DEFAULT true, is_system BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".automation_rules (
      id UUID PRIMARY KEY, template_id UUID REFERENCES "${s}".automation_templates(id), name TEXT NOT NULL,
      description TEXT, category TEXT NOT NULL DEFAULT 'general', trigger_type TEXT NOT NULL, trigger_config JSONB,
      conditions JSONB, actions JSONB NOT NULL DEFAULT '[]'::jsonb, schedule_config JSONB,
      is_enabled BOOLEAN NOT NULL DEFAULT false, run_mode TEXT NOT NULL DEFAULT 'manual', priority TEXT NOT NULL DEFAULT 'medium',
      cooldown_minutes INTEGER NOT NULL DEFAULT 60, max_runs_per_day INTEGER NOT NULL DEFAULT 50,
      last_run_at TIMESTAMPTZ, next_run_at TIMESTAMPTZ, last_success_at TIMESTAMPTZ, last_error_at TIMESTAMPTZ,
      last_error_message TEXT, created_by UUID, updated_by UUID, created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE TABLE "${s}".team_members (
      id UUID PRIMARY KEY, user_id UUID, email TEXT NOT NULL, display_name TEXT NOT NULL, first_name TEXT, last_name TEXT,
      phone TEXT, tenant_role TEXT, job_title TEXT, department TEXT, operational_role TEXT,
      employment_type TEXT NOT NULL DEFAULT 'employee', status TEXT NOT NULL DEFAULT 'active', skills TEXT[],
      capacity_hours_per_week NUMERIC(6,2), availability_status TEXT NOT NULL DEFAULT 'available',
      hourly_rate_cents INTEGER, daily_rate_cents INTEGER, currency TEXT NOT NULL DEFAULT 'EUR', start_date DATE,
      end_date DATE, notes TEXT, private_notes TEXT, metadata JSONB, created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(), updated_at TIMESTAMPTZ DEFAULT now(), deleted_at TIMESTAMPTZ
    );
    CREATE UNIQUE INDEX "idx_${s}_team_members_email_unique" ON "${s}".team_members(lower(email)) WHERE deleted_at IS NULL;
    CREATE UNIQUE INDEX "idx_${s}_team_members_user_unique" ON "${s}".team_members(user_id) WHERE user_id IS NOT NULL AND deleted_at IS NULL;
  `);
  // The historical runtime provisioners assigned uuid_generate_v4() to every
  // UUID primary key. Keep that legacy behavior explicit so later idempotent
  // seeds can insert rows without manufacturing identifiers in the browser.
  for (const table of [
    'users',
    'companies',
    'contacts',
    'leads',
    'opportunities',
    'commercial_activities',
    'briefing_templates',
    'briefings',
    'briefing_material_requests',
    'service_templates',
    'quotes',
    'quote_items',
    'projects',
    'project_members',
    'milestones',
    'tasks',
    'task_checklist_items',
    'project_comments',
    'project_file_links',
    'invoices',
    'invoice_items',
    'payments',
    'financial_deadlines',
    'recurring_services',
    'renewals',
    'project_financial_status',
    'document_folders',
    'documents',
    'document_links',
    'contract_templates',
    'contracts',
    'notifications',
    'automation_templates',
    'automation_rules',
    'team_members',
  ]) {
    await dataSource.query(
      `ALTER TABLE "${s}"."${table}" ALTER COLUMN id SET DEFAULT uuid_generate_v4()`,
    );
  }
}

async function insertPlatformFixture(dataSource: DataSource) {
  await dataSource.query(
    `INSERT INTO public.tenants (id, slug, name, schema_name, contact_email, admin_email, plan_tier, is_active, max_users, storage_limit_gb, created_at, updated_at)
     VALUES ($1, 'doflow', 'Doflow synthetic rehearsal', 'doflow', 'synthetic-owner@example.invalid', 'synthetic-admin@example.invalid', 'ENTERPRISE', true, 50, 10, $3, $3),
            ($2, 'acceptance-secondary', 'Secondary synthetic tenant', 'acceptance_secondary', 'secondary@example.invalid', 'secondary@example.invalid', 'STARTER', true, 5, 1, $3, $3)`,
    [SENTINELS.doflowTenant, SENTINELS.secondaryTenant, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO public.platform_modules (id, key, name, category, "minTier", "priceMonthly", "isBeta", "createdAt", "updatedAt")
     VALUES ('11000000-0000-4000-8000-000000000001', 'crm', 'CRM synthetic', 'COMMERCIAL', 'STARTER', 0, false, $1, $1),
            ('11000000-0000-4000-8000-000000000002', 'projects', 'Projects synthetic', 'DELIVERY', 'STARTER', 0, false, $1, $1)`,
    [FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO public.tenant_subscriptions (id, "tenantId", "moduleKey", status, "assignedAt") VALUES
      ('12000000-0000-4000-8000-000000000001', $1, 'crm', 'ACTIVE', $3),
      ('12000000-0000-4000-8000-000000000002', $1, 'projects', 'ACTIVE', $3),
      ('12000000-0000-4000-8000-000000000003', $2, 'crm', 'ACTIVE', $3)`,
    [SENTINELS.doflowTenant, SENTINELS.secondaryTenant, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO public.tenant_onboarding (tenant_id, sector, completed_at, selected_modules, dashboard_layout, created_at, updated_at)
     VALUES ($1, 'synthetic_agency', $3, '["crm","projects"]', '[]', $3, $3),
            ($2, 'synthetic_services', $3, '["crm"]', '[]', $3, $3)`,
    [SENTINELS.doflowTenant, SENTINELS.secondaryTenant, FIXED_CREATED_AT],
  );
  const publicUsers = [
    [SENTINELS.oliver, 'oliver@doflow.it', 'synthetic-hash-oliver', 'owner', SENTINELS.doflowTenant, 'Oliver Synthetic', 'google', 'synthetic-google-oliver', 'https://example.invalid/avatar/oliver', true, 'synthetic-mfa-oliver'],
    [SENTINELS.executiveTwo, 'executive-two@acceptance.invalid', 'synthetic-hash-executive-two', 'owner', SENTINELS.doflowTenant, 'Executive Two Synthetic', 'google', 'synthetic-google-executive-two', 'https://example.invalid/avatar/executive-two', true, 'synthetic-mfa-executive-two'],
    [SENTINELS.secondaryUser, 'secondary-owner@example.invalid', 'synthetic-hash-secondary', 'owner', SENTINELS.secondaryTenant, 'Secondary Synthetic', 'password', null, null, false, null],
  ];
  for (const row of publicUsers) {
    await dataSource.query(
      `INSERT INTO public.users (id,email,password_hash,role,tenant_id,full_name,auth_provider,google_id,avatar_url,email_verified_at,mfa_enabled,mfa_secret,is_active,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$13,$10,$11,true,$12,$12)`,
      [...row.slice(0, 11), FIXED_CREATED_AT, FIXED_CREATED_AT],
    );
  }
  await dataSource.query(
    `INSERT INTO public.audit_log (id, actor_email, actor_id, actor_role, action, target_id, metadata, created_at)
     VALUES ('13000000-0000-4000-8000-000000000001', 'synthetic-system@example.invalid', 'acceptance', 'system', 'legacy.fixture.created', $1, '{"synthetic":true}', $2)`,
    [SENTINELS.doflowTenant, FIXED_CREATED_AT],
  );
}

async function insertDoflowFixture(dataSource: DataSource) {
  const s = 'doflow';
  for (const row of [
    [SENTINELS.oliver, 'oliver@doflow.it', 'synthetic-hash-oliver', 'owner', 'Oliver Synthetic', 'google', 'synthetic-google-oliver', 'https://example.invalid/avatar/oliver', true, 'synthetic-mfa-oliver'],
    [SENTINELS.executiveTwo, 'executive-two@acceptance.invalid', 'synthetic-hash-executive-two', 'owner', 'Executive Two Synthetic', 'google', 'synthetic-google-executive-two', 'https://example.invalid/avatar/executive-two', true, 'synthetic-mfa-executive-two'],
  ]) {
    await dataSource.query(
      `INSERT INTO "${s}".users (id,email,password_hash,role,full_name,auth_provider,google_id,avatar_url,email_verified_at,mfa_enabled,mfa_secret,is_active,created_at,updated_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$12,$9,$10,true,$11,$11)`,
      [...row, FIXED_CREATED_AT, FIXED_CREATED_AT],
    );
  }
  await dataSource.query(
    `INSERT INTO "${s}".companies (id,name,legal_name,email,status,source,owner_user_id,created_by,updated_by,created_at,updated_at,deleted_at) VALUES
      ($1,'Synthetic Active Company','Synthetic Active Company SRL','company@example.invalid','client','legacy',$3,$3,$3,$5,$5,NULL),
      ($2,'Synthetic Archived Company',NULL,NULL,'inactive','legacy',$3,$3,$3,$5,$5,$4)`,
    [SENTINELS.company, SENTINELS.archivedCompany, SENTINELS.oliver, '2025-02-01T00:00:00.000Z', FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".contacts (id,company_id,first_name,last_name,email,is_primary,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,'Synthetic','Contact','contact@example.invalid',true,$3,$3,$4,$4)`,
    [SENTINELS.contact, SENTINELS.company, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".leads (id,company_id,contact_id,title,source,interest,budget_estimate,urgency,quality,status,assigned_to,next_action,next_action_at,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,'Synthetic legacy lead','referral','website',1234.56,'medium','qualified','qualified',$4,'Follow up','2025-02-15T09:00:00Z',$4,$4,$5,$5)`,
    [SENTINELS.lead, SENTINELS.company, SENTINELS.contact, SENTINELS.executiveTwo, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".opportunities (id,company_id,contact_id,lead_id,title,service_type,lead_source,lead_interest,lead_urgency,value_estimate,probability,stage,expected_close_date,assigned_to,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,'Synthetic legacy opportunity','website','referral','website','medium',9876.54,60,'proposal','2025-03-31',$5,$5,$5,$6,$6)`,
    [SENTINELS.opportunity, SENTINELS.company, SENTINELS.contact, SENTINELS.lead, SENTINELS.executiveTwo, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".commercial_activities (id,company_id,contact_id,lead_id,opportunity_id,type,title,description,due_at,assigned_to,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,'call','Synthetic legacy activity','Acceptance-only activity','2025-02-20T10:00:00Z',$6,$6,$6,$7,$7)`,
    [SENTINELS.activity, SENTINELS.company, SENTINELS.contact, SENTINELS.lead, SENTINELS.opportunity, SENTINELS.executiveTwo, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".service_templates (id,name,category,description,default_unit_price,default_quantity,billing_type,is_active,created_by,updated_by,created_at,updated_at)
     VALUES ($1,'Synthetic legacy website','website','Legacy service template',1250.75,1,'one_time',true,$2,$2,$3,$3)`,
    [SENTINELS.serviceTemplate, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".briefings (id,company_id,contact_id,opportunity_id,title,type,status,objective,budget_estimate,deadline,answers_json,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,'Synthetic legacy briefing','website','approved','Acceptance rehearsal',1250.75,'2025-04-30','{"synthetic":true}',$5,$5,$6,$6)`,
    [SENTINELS.briefing, SENTINELS.company, SENTINELS.contact, SENTINELS.opportunity, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".quotes (id,company_id,contact_id,opportunity_id,briefing_id,quote_number,title,status,currency,subtotal,discount_total,tax_total,total,valid_until,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,'LEGACY-Q-001','Synthetic legacy quote','accepted','EUR',1250.75,50.25,264.11,1464.61,'2025-04-30',$6,$6,$7,$7)`,
    [SENTINELS.quote, SENTINELS.company, SENTINELS.contact, SENTINELS.opportunity, SENTINELS.briefing, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".quote_items (id,quote_id,service_template_id,name,description,quantity,unit_price,discount,tax_rate,total,billing_type,sort_order,created_at,updated_at)
     VALUES ($1,$2,$3,'Synthetic legacy website','Line snapshot did not yet exist',1,1250.75,50.25,22,1464.61,'one_time',0,$4,$4)`,
    [SENTINELS.quoteItem, SENTINELS.quote, SENTINELS.serviceTemplate, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".projects (id,company_id,contact_id,opportunity_id,briefing_id,quote_id,name,description,type,status,priority,current_phase,progress,project_manager_id,start_date,due_date,created_by,updated_by,created_at,updated_at) VALUES
      ($1,$3,$4,$5,$6,$7,'Synthetic mapped project','Legacy project','website','development','high','development',40,$8,'2025-02-01','2025-05-30',$8,$8,$9,$9),
      ($2,$3,NULL,$5,NULL,$7,'Synthetic ambiguous project','Ambiguous legacy state','website','kickoff','medium','kickoff',10,$8,'2025-02-10','2025-06-30',$8,$8,$9,$9)`,
    [SENTINELS.project, SENTINELS.ambiguousProject, SENTINELS.company, SENTINELS.contact, SENTINELS.opportunity, SENTINELS.briefing, SENTINELS.quote, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".project_members (id,project_id,user_id,role,hourly_rate,allocation_percent,created_by,created_at)
     VALUES ($1,$2,$3,'manager',75.50,60,$3,$4)`,
    [SENTINELS.projectMember, SENTINELS.project, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".milestones (id,project_id,title,status,due_date,sort_order,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,'Synthetic legacy milestone','in_progress','2025-04-15',1,$3,$3,$4,$4)`,
    [SENTINELS.milestone, SENTINELS.project, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".tasks (id,project_id,milestone_id,company_id,title,status,priority,assignee_id,assigned_by,due_at,estimated_minutes,actual_minutes,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,'Synthetic legacy task','in_progress','high',$5,$6,'2025-04-10T12:00:00Z',180,45,$6,$6,$7,$7)`,
    [SENTINELS.task, SENTINELS.project, SENTINELS.milestone, SENTINELS.company, SENTINELS.executiveTwo, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".task_checklist_items (id,task_id,title,is_done,sort_order,created_at,updated_at)
     VALUES ($1,$2,'Synthetic legacy checklist',false,1,$3,$3)`,
    [SENTINELS.checklist, SENTINELS.task, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".project_comments (id,project_id,task_id,milestone_id,body,visibility,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,'Synthetic legacy project comment','internal',$5,$5,$6,$6)`,
    [SENTINELS.comment, SENTINELS.project, SENTINELS.task, SENTINELS.milestone, SENTINELS.executiveTwo, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".project_file_links (id,project_id,task_id,file_id,type,visibility,created_by,created_at)
     VALUES ($1,$2,$3,'47000000-0000-4000-8000-000000000001','brief','internal',$4,$5)`,
    [SENTINELS.fileLink, SENTINELS.project, SENTINELS.task, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".invoices (id,company_id,contact_id,opportunity_id,briefing_id,quote_id,project_id,invoice_number,title,type,status,currency,subtotal,discount_total,tax_total,total,paid_total,remaining_total,issue_date,due_date,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,'LEGACY-I-001','Synthetic legacy invoice','standard','partial','EUR',1250.75,50.25,264.11,1464.61,500.25,964.36,'2025-02-01','2025-03-01',$8,$8,$9,$9)`,
    [SENTINELS.invoice, SENTINELS.company, SENTINELS.contact, SENTINELS.opportunity, SENTINELS.briefing, SENTINELS.quote, SENTINELS.project, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".invoice_items (id,invoice_id,quote_item_id,name,description,quantity,unit_price,discount,tax_rate,total,sort_order,created_at,updated_at)
     VALUES ($1,$2,$3,'Synthetic invoice line','Legacy invoice line',1,1250.75,50.25,22,1464.61,0,$4,$4)`,
    [SENTINELS.invoiceItem, SENTINELS.invoice, SENTINELS.quoteItem, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".payments (id,invoice_id,company_id,project_id,amount,currency,status,payment_date,method,reference,notes,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,500.25,'EUR','recorded','2025-02-15','bank_transfer','LEGACY-PAY-001','Synthetic legacy payment',$5,$5,$6,$6)`,
    [SENTINELS.payment, SENTINELS.invoice, SENTINELS.company, SENTINELS.project, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".financial_deadlines (id,company_id,project_id,quote_id,invoice_id,title,type,status,amount,currency,due_date,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,$5,'Synthetic balance deadline','payment','open',964.36,'EUR','2025-03-01',$6,$6,$7,$7)`,
    [SENTINELS.deadline, SENTINELS.company, SENTINELS.project, SENTINELS.quote, SENTINELS.invoice, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".recurring_services (id,company_id,project_id,quote_id,name,category,status,billing_cycle,amount,currency,start_date,next_due_date,auto_renew,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,'Synthetic annual hosting','hosting','active','yearly',199.99,'EUR','2025-01-01','2026-01-01',true,$5,$5,$6,$6)`,
    [SENTINELS.recurring, SENTINELS.company, SENTINELS.project, SENTINELS.quote, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".renewals (id,recurring_service_id,company_id,project_id,title,status,amount,currency,due_date,invoice_id,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,'Synthetic hosting renewal','upcoming',199.99,'EUR','2026-01-01',$5,$6,$6,$7,$7)`,
    [SENTINELS.renewal, SENTINELS.recurring, SENTINELS.company, SENTINELS.project, SENTINELS.invoice, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".project_financial_status (id,project_id,quote_id,company_id,deposit_required,deposit_paid,balance_required,balance_paid,total_expected,total_paid,payment_status,deposit_due_date,balance_due_date,last_payment_at,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,$3,$4,500.25,500.25,964.36,0,1464.61,500.25,'partial','2025-02-15','2025-03-01','2025-02-15T12:00:00Z',$5,$5,$6,$6)`,
    [SENTINELS.financialStatus, SENTINELS.project, SENTINELS.quote, SENTINELS.company, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".document_folders (id,name,slug,entity_type,entity_id,visibility,created_by,created_at,updated_at)
     VALUES ($1,'Synthetic legacy folder','synthetic-legacy','project',$2,'internal',$3,$4,$4)`,
    [SENTINELS.folder, SENTINELS.project, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".documents (id,folder_id,title,description,original_filename,mime_type,size_bytes,storage_provider,storage_bucket,storage_key,checksum,category,visibility,status,entity_type,entity_id,uploaded_by,metadata,version_number,created_at,updated_at)
     VALUES ($1,$2,'Synthetic legacy document','Metadata only fixture','synthetic.pdf','application/pdf',1024,'minio','acceptance','synthetic/legacy.pdf','synthetic-document-checksum','contract','internal','active','project',$3,$4,'{"synthetic":true}',1,$5,$5)`,
    [SENTINELS.document, SENTINELS.folder, SENTINELS.project, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".document_links (id,document_id,entity_type,entity_id,relation_type,created_by,created_at)
     VALUES ($1,$2,'project',$3,'attachment',$4,$5)`,
    [SENTINELS.documentLink, SENTINELS.document, SENTINELS.project, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".contract_templates (id,name,slug,category,description,body_markdown,variables,is_active,version_label,created_by,created_at,updated_at)
     VALUES ($1,'Synthetic legacy contract template','synthetic-legacy-contract','website','Acceptance-only template','# Synthetic contract','["client_name"]',true,'legacy-v1',$2,$3,$3)`,
    [SENTINELS.contractTemplate, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".contracts (id,contract_number,title,description,template_id,company_id,contact_id,quote_id,project_id,opportunity_id,owner_user_id,assigned_to_user_id,status,signature_status,priority,contract_type,amount,currency,start_date,end_date,due_date,created_by,updated_by,created_at,updated_at)
     VALUES ($1,'LEGACY-C-001','Synthetic legacy contract','Unsigned legacy contract',$2,$3,$4,$5,$6,$7,$8,$9,'draft','not_started','medium','website',1464.61,'EUR','2025-02-01','2025-06-30','2025-02-28',$8,$8,$10,$10)`,
    [SENTINELS.contract, SENTINELS.contractTemplate, SENTINELS.company, SENTINELS.contact, SENTINELS.quote, SENTINELS.project, SENTINELS.opportunity, SENTINELS.oliver, SENTINELS.executiveTwo, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".notifications (id,recipient_user_id,recipient_role,title,body,type,priority,status,entity_type,entity_id,fingerprint,metadata,created_by,created_at,updated_at)
     VALUES ($1,$2,'owner','Synthetic legacy notification','Acceptance-only notification','legacy_project','medium','unread','project',$3,'synthetic-legacy-notification','{"synthetic":true}',$4,$5,$5)`,
    [SENTINELS.notification, SENTINELS.executiveTwo, SENTINELS.project, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".automation_templates (id,key,name,description,category,trigger_type,default_conditions,default_actions,is_active,is_system,created_at,updated_at)
     VALUES ($1,'synthetic_legacy_template','Synthetic legacy automation','Acceptance-only template','projects','project_status','{}','[{"type":"notify"}]',true,false,$2,$2)`,
    [SENTINELS.automationTemplate, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".automation_rules (id,template_id,name,description,category,trigger_type,trigger_config,conditions,actions,is_enabled,run_mode,priority,cooldown_minutes,max_runs_per_day,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,'Synthetic legacy rule','Acceptance-only rule','projects','project_status','{}','{}','[{"type":"notify"}]',true,'event','medium',60,10,$3,$3,$4,$4)`,
    [SENTINELS.automationRule, SENTINELS.automationTemplate, SENTINELS.oliver, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".team_members (id,user_id,email,display_name,tenant_role,operational_role,employment_type,status,availability_status,currency,created_by,created_at,updated_at) VALUES
      ($1,$3,'oliver@doflow.it','Oliver Synthetic','owner','ceo_label','admin','active','available','EUR',$3,$5,$5),
      ($2,$4,'executive-two@acceptance.invalid','Executive Two Synthetic','owner','ceo_label','admin','active','available','EUR',$3,$5,$5)`,
    [SENTINELS.teamOliver, SENTINELS.teamExecutiveTwo, SENTINELS.oliver, SENTINELS.executiveTwo, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".audit_log (actor_email,actor_role,action,target,metadata,created_at)
     VALUES ('synthetic-system@example.invalid','system','legacy.business.fixture','doflow','{"synthetic":true}',$1)`,
    [FIXED_CREATED_AT],
  );
}

async function insertSecondaryFixture(dataSource: DataSource) {
  const s = 'acceptance_secondary';
  await dataSource.query(
    `INSERT INTO "${s}".users (id,email,password_hash,role,full_name,auth_provider,is_active,created_at,updated_at)
     VALUES ($1,'secondary-owner@example.invalid','synthetic-hash-secondary','owner','Secondary Synthetic','password',true,$2,$2)`,
    [SENTINELS.secondaryUser, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".companies (id,name,status,source,owner_user_id,created_by,updated_by,created_at,updated_at)
     VALUES ($1,'Secondary isolated company','client','legacy',$2,$2,$2,$3,$3)`,
    [SENTINELS.secondaryCompany, SENTINELS.secondaryUser, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".opportunities (id,company_id,title,value_estimate,stage,assigned_to,created_by,updated_by,created_at,updated_at)
     VALUES ('70000000-0000-4000-8000-000000000002',$1,'Secondary isolated opportunity',10.50,'new_lead',$2,$2,$2,$3,$3)`,
    [SENTINELS.secondaryCompany, SENTINELS.secondaryUser, FIXED_CREATED_AT],
  );
  await dataSource.query(
    `INSERT INTO "${s}".projects (id,company_id,opportunity_id,name,status,priority,progress,project_manager_id,created_by,updated_by,created_at,updated_at)
     VALUES ($1,$2,'70000000-0000-4000-8000-000000000002','Secondary isolated project','to_start','medium',0,$3,$3,$3,$4,$4)`,
    [SENTINELS.secondaryProject, SENTINELS.secondaryCompany, SENTINELS.secondaryUser, FIXED_CREATED_AT],
  );
}

export async function buildFrozenLegacyFixture() {
  const dataSource = source([]);
  await dataSource.initialize();
  try {
    await dataSource.transaction(async (manager) => {
      await createFrozenLegacySchema(manager as never, 'doflow');
      await createFrozenLegacySchema(manager as never, 'acceptance_secondary');
      await insertPlatformFixture(manager as never);
      await insertDoflowFixture(manager as never);
      await insertSecondaryFixture(manager as never);
    });
  } finally {
    await dataSource.destroy();
  }
}

async function migrationHistory(dataSource: DataSource) {
  const exists = await dataSource.query(`SELECT to_regclass('public.doflow_migrations') AS name`);
  if (!exists[0]?.name) return [];
  return dataSource.query(`SELECT timestamp::bigint AS timestamp, name FROM public.doflow_migrations ORDER BY timestamp`);
}

async function schemaFingerprint(dataSource: DataSource) {
  const schemas = ['public', 'doflow', 'acceptance_secondary'];
  const [tables, columns, indexes, constraints, migrations] = await Promise.all([
    dataSource.query(
      `SELECT table_schema, table_name, table_type FROM information_schema.tables
       WHERE table_schema = ANY($1::text[]) ORDER BY table_schema, table_name`,
      [schemas],
    ),
    dataSource.query(
      `SELECT table_schema, table_name, column_name, ordinal_position, data_type, udt_name,
              is_nullable, column_default
       FROM information_schema.columns WHERE table_schema = ANY($1::text[])
       ORDER BY table_schema, table_name, ordinal_position`,
      [schemas],
    ),
    dataSource.query(
      `SELECT schemaname, tablename, indexname, indexdef FROM pg_indexes
       WHERE schemaname = ANY($1::text[]) ORDER BY schemaname, tablename, indexname`,
      [schemas],
    ),
    dataSource.query(
      `SELECT n.nspname AS table_schema, c.relname AS table_name, con.conname,
              con.contype, pg_get_constraintdef(con.oid, true) AS definition
       FROM pg_constraint con JOIN pg_class c ON c.oid=con.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
       WHERE n.nspname = ANY($1::text[]) ORDER BY n.nspname,c.relname,con.conname`,
      [schemas],
    ),
    migrationHistory(dataSource),
  ]);
  const detail = { tables, columns, indexes, constraints, migrations };
  return { hash: sha256(detail), ...detail };
}

async function safeTableCounts(dataSource: DataSource, schema: string) {
  const rows: Array<{ table_name: string }> = await dataSource.query(
    `SELECT table_name FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY table_name`,
    [schema],
  );
  const counts: Record<string, number> = {};
  for (const { table_name: table } of rows) {
    const count = await dataSource.query(`SELECT COUNT(*)::int AS count FROM "${schema}"."${table}"`);
    counts[table] = Number(count[0]?.count || 0);
  }
  return counts;
}

async function ceoEvidence(dataSource: DataSource) {
  const rows = await dataSource.query(
    `SELECT t.id::text, lower(t.email) AS email, t.role, t.is_active, t.auth_provider,
            t.password_hash, t.google_id, t.mfa_enabled, t.mfa_secret, t.email_verified_at, t.avatar_url,
            p.id::text AS public_id, p.tenant_id, p.role AS public_role, p.is_active AS public_active,
            tm.id::text AS membership_id, tm.tenant_role, tm.status AS membership_status
     FROM doflow.users t
     JOIN public.users p ON p.id=t.id
     LEFT JOIN doflow.team_members tm ON tm.user_id=t.id AND tm.deleted_at IS NULL
     WHERE lower(t.email)=ANY($1::text[]) ORDER BY lower(t.email)`,
    [['oliver@doflow.it', 'executive-two@acceptance.invalid']],
  );
  const safe = rows.map((row: Record<string, unknown>) => ({
    id: row.id,
    email: row.email,
    role: row.role,
    active: row.is_active,
    authProviderGoogleIdChecksum: sha256(`${row.auth_provider || ''}:${row.google_id || ''}`),
    passwordChecksum: sha256(row.password_hash || ''),
    mfaEnabled: row.mfa_enabled,
    mfaSecretChecksum: sha256(row.mfa_secret || ''),
    emailVerified: Boolean(row.email_verified_at),
    avatarChecksum: sha256(row.avatar_url || ''),
    publicId: row.public_id,
    tenant: row.tenant_id,
    publicRole: row.public_role,
    publicActive: row.public_active,
    membershipId: row.membership_id,
    membershipRole: row.tenant_role,
    membershipStatus: row.membership_status,
  }));
  return { preserved: safe.length, hash: sha256(safe), accounts: safe };
}

async function relationEvidence(dataSource: DataSource) {
  const rows = await dataSource.query(
    `SELECT c.id::text AS company, ct.id::text AS contact, l.id::text AS lead, o.id::text AS opportunity,
            p.id::text AS project, p.quote_id::text AS project_quote, t.id::text AS task,
            i.id::text AS invoice, i.quote_id::text AS invoice_quote, pay.id::text AS payment,
            rs.id::text AS recurring, r.id::text AS renewal, con.id::text AS contract,
            d.id::text AS document, dl.entity_id::text AS document_record
     FROM doflow.companies c
     JOIN doflow.contacts ct ON ct.company_id=c.id
     JOIN doflow.leads l ON l.company_id=c.id AND l.contact_id=ct.id
     JOIN doflow.opportunities o ON o.lead_id=l.id AND o.company_id=c.id
     JOIN doflow.projects p ON p.opportunity_id=o.id AND p.company_id=c.id AND p.id=$1
     JOIN doflow.tasks t ON t.project_id=p.id
     JOIN doflow.invoices i ON i.project_id=p.id AND i.company_id=c.id
     JOIN doflow.payments pay ON pay.invoice_id=i.id AND pay.project_id=p.id
     JOIN doflow.recurring_services rs ON rs.project_id=p.id
     JOIN doflow.renewals r ON r.recurring_service_id=rs.id
     JOIN doflow.contracts con ON con.project_id=p.id AND con.company_id=c.id
     JOIN doflow.documents d ON d.entity_id=p.id
     JOIN doflow.document_links dl ON dl.document_id=d.id AND dl.entity_id=p.id`,
    [SENTINELS.project],
  );
  return { complete: rows.length === 1, hash: sha256(rows), rows };
}

async function economicEvidence(dataSource: DataSource) {
  const [row] = await dataSource.query(`
    SELECT
      (SELECT COALESCE(SUM(total),0)::text FROM doflow.quotes WHERE deleted_at IS NULL) AS quotes_total,
      (SELECT COALESCE(SUM(total),0)::text FROM doflow.invoices WHERE deleted_at IS NULL) AS invoices_total,
      (SELECT COALESCE(SUM(amount),0)::text FROM doflow.payments WHERE deleted_at IS NULL) AS payments_total,
      (SELECT COALESCE(SUM(remaining_total),0)::text FROM doflow.invoices WHERE deleted_at IS NULL) AS invoice_residual,
      (SELECT COALESCE(SUM(amount),0)::text FROM doflow.recurring_services WHERE deleted_at IS NULL) AS recurring_total,
      (SELECT COALESCE(SUM(amount),0)::text FROM doflow.renewals WHERE deleted_at IS NULL) AS renewals_total,
      (SELECT jsonb_build_object('expected',total_expected::text,'paid',total_paid::text,'status',payment_status)
         FROM doflow.project_financial_status WHERE id=$1) AS project_financial
  `, [SENTINELS.financialStatus]);
  return { ...row, hash: sha256(row) };
}

async function secondaryEvidence(dataSource: DataSource) {
  const rows = await dataSource.query(
    `SELECT c.id::text AS company_id,c.name,o.id::text AS opportunity_id,o.stage,
            p.id::text AS project_id,p.status,u.id::text AS user_id,u.role
       FROM acceptance_secondary.companies c
       JOIN acceptance_secondary.opportunities o ON o.company_id=c.id
       JOIN acceptance_secondary.projects p ON p.company_id=c.id AND p.opportunity_id=o.id
       JOIN acceptance_secondary.users u ON u.id=p.project_manager_id
       ORDER BY c.id`,
  );
  const crossTenant = await dataSource.query(
    `SELECT
       (SELECT COUNT(*)::int FROM doflow.users WHERE id=$1) AS secondary_in_doflow,
       (SELECT COUNT(*)::int FROM acceptance_secondary.users WHERE id=ANY($2::uuid[])) AS doflow_in_secondary`,
    [SENTINELS.secondaryUser, [SENTINELS.oliver, SENTINELS.executiveTwo]],
  );
  return { hash: sha256(rows), rows, crossTenant: crossTenant[0] };
}

async function selectedBusinessHash(dataSource: DataSource) {
  const selections: Record<string, string[]> = {
    companies: ['id', 'name', 'status', 'owner_user_id', 'deleted_at'],
    contacts: ['id', 'company_id', 'first_name', 'last_name', 'email', 'is_primary'],
    leads: ['id', 'company_id', 'contact_id', 'status', 'assigned_to', 'budget_estimate'],
    opportunities: ['id', 'company_id', 'contact_id', 'lead_id', 'stage', 'assigned_to', 'value_estimate'],
    commercial_activities: ['id', 'company_id', 'contact_id', 'lead_id', 'opportunity_id', 'type', 'assigned_to'],
    service_templates: ['id', 'name', 'category', 'default_unit_price', 'default_quantity', 'is_active'],
    quotes: ['id', 'company_id', 'contact_id', 'opportunity_id', 'quote_number', 'status', 'currency', 'total'],
    quote_items: ['id', 'quote_id', 'service_template_id', 'quantity', 'unit_price', 'discount', 'tax_rate', 'total'],
    projects: ['id', 'company_id', 'opportunity_id', 'quote_id', 'status', 'progress', 'project_manager_id'],
    project_members: ['id', 'project_id', 'user_id', 'role', 'allocation_percent'],
    tasks: ['id', 'project_id', 'milestone_id', 'status', 'assignee_id', 'estimated_minutes', 'actual_minutes'],
    invoices: ['id', 'company_id', 'project_id', 'quote_id', 'status', 'currency', 'total', 'paid_total', 'remaining_total'],
    payments: ['id', 'invoice_id', 'company_id', 'project_id', 'amount', 'currency', 'status', 'reference'],
    recurring_services: ['id', 'company_id', 'project_id', 'quote_id', 'amount', 'currency', 'status'],
    renewals: ['id', 'recurring_service_id', 'company_id', 'project_id', 'amount', 'currency', 'status'],
    contracts: ['id', 'company_id', 'project_id', 'quote_id', 'status', 'signature_status', 'amount', 'currency'],
    documents: ['id', 'folder_id', 'entity_type', 'entity_id', 'checksum', 'status'],
    notifications: ['id', 'recipient_user_id', 'type', 'status', 'entity_type', 'entity_id'],
    automation_rules: ['id', 'template_id', 'name', 'trigger_type', 'is_enabled', 'run_mode'],
  };
  const fixtureIds: Record<string, string[]> = {
    companies: [SENTINELS.company, SENTINELS.archivedCompany],
    contacts: [SENTINELS.contact],
    leads: [SENTINELS.lead],
    opportunities: [SENTINELS.opportunity],
    commercial_activities: [SENTINELS.activity],
    service_templates: [SENTINELS.serviceTemplate],
    quotes: [SENTINELS.quote],
    quote_items: [SENTINELS.quoteItem],
    projects: [SENTINELS.project, SENTINELS.ambiguousProject],
    project_members: [SENTINELS.projectMember],
    tasks: [SENTINELS.task],
    invoices: [SENTINELS.invoice],
    payments: [SENTINELS.payment],
    recurring_services: [SENTINELS.recurring],
    renewals: [SENTINELS.renewal],
    contracts: [SENTINELS.contract],
    documents: [SENTINELS.document],
    notifications: [SENTINELS.notification],
    automation_rules: [SENTINELS.automationRule],
  };
  const result: Record<string, unknown[]> = {};
  for (const [table, columns] of Object.entries(selections)) {
    result[table] = await dataSource.query(
      `SELECT ${columns.map((column) => `"${column}"`).join(',')} FROM doflow."${table}"
       WHERE id=ANY($1::uuid[]) ORDER BY id`,
      [fixtureIds[table]],
    );
  }
  return { hash: sha256(result), tables: result };
}

async function forbiddenArtifacts(dataSource: DataSource) {
  const tables = await dataSource.query(
    `SELECT table_schema,table_name FROM information_schema.tables
     WHERE table_schema IN ('doflow','acceptance_secondary') AND table_name=ANY($1::text[])
     ORDER BY table_schema,table_name`,
    [[...POST_178_FORBIDDEN_TABLES]],
  );
  const columns = [];
  for (const [table, column] of POST_178_FORBIDDEN_COLUMNS) {
    const rows = await dataSource.query(
      `SELECT table_schema,table_name,column_name FROM information_schema.columns
       WHERE table_schema IN ('doflow','acceptance_secondary') AND table_name=$1 AND column_name=$2`,
      [table, column],
    );
    columns.push(...rows);
  }
  const indexes = await dataSource.query(
    `SELECT schemaname,indexname FROM pg_indexes WHERE schemaname IN ('doflow','acceptance_secondary')
       AND (indexname LIKE '%_history_%' OR indexname LIKE '%_outbox_%' OR indexname LIKE '%_idempotency%')
     ORDER BY schemaname,indexname`,
  );
  return { tables, columns, indexes, absent: tables.length === 0 && columns.length === 0 && indexes.length === 0 };
}

export async function captureEvidence() {
  const dataSource = source([]);
  await dataSource.initialize();
  try {
    const migrations = await migrationHistory(dataSource);
    const maxMigration = Math.max(0, ...migrations.map((row: { timestamp: string }) => Number(row.timestamp)));
    const [schema, counts, ceo, relations, economics, secondary, business, forbidden] = await Promise.all([
      schemaFingerprint(dataSource),
      Promise.all(['public', 'doflow', 'acceptance_secondary'].map(async (name) => [name, await safeTableCounts(dataSource, name)])),
      ceoEvidence(dataSource),
      relationEvidence(dataSource),
      economicEvidence(dataSource),
      secondaryEvidence(dataSource),
      selectedBusinessHash(dataSource),
      forbiddenArtifacts(dataSource),
    ]);
    return {
      maxMigration,
      migrationHistory: migrations,
      schema,
      counts: Object.fromEntries(counts),
      ceo,
      relations,
      economics,
      secondary,
      business,
      forbidden,
      dbSync: false,
    };
  } finally {
    await dataSource.destroy();
  }
}

export async function injectTransactionalFault() {
  const dataSource = source([]);
  await dataSource.initialize();
  const sentinel = 'fault-injection-pre179-rehearsal';
  const before = await dataSource.query(`SELECT COUNT(*)::int AS count FROM doflow.commercial_history`);
  let errorRedacted = '';
  try {
    await dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO doflow.commercial_history
          (operation_id,correlation_id,entity_type,entity_id,event_type,actor_user_id,metadata)
         VALUES ('79000000-0000-4000-8000-000000000001','79000000-0000-4000-8000-000000000002',
                 'project',$1,$2,$3,'{"synthetic":true}')`,
        [SENTINELS.project, sentinel, SENTINELS.oliver],
      );
      throw new Error('controlled-acceptance-fault');
    });
  } catch (error) {
    errorRedacted = error instanceof Error ? error.message : 'controlled-acceptance-fault';
  }
  try {
    const after = await dataSource.query(`SELECT COUNT(*)::int AS count FROM doflow.commercial_history`);
    const leaked = await dataSource.query(`SELECT COUNT(*)::int AS count FROM doflow.commercial_history WHERE event_type=$1`, [sentinel]);
    return {
      error: errorRedacted,
      before: Number(before[0]?.count || 0),
      after: Number(after[0]?.count || 0),
      partialRows: Number(leaked[0]?.count || 0),
      rollback: Number(before[0]?.count || 0) === Number(after[0]?.count || 0) && Number(leaked[0]?.count || 0) === 0,
    };
  } finally {
    await dataSource.destroy();
  }
}

async function writeOutput(payload: unknown) {
  const output = process.env.PRE179_STEP_OUTPUT;
  if (output) {
    await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    const record = payload as { command?: string; applied?: unknown[]; evidence?: { maxMigration?: number } };
    process.stdout.write(`${JSON.stringify({
      command: record.command,
      applied: record.applied?.length,
      maxMigration: record.evidence?.maxMigration,
      evidenceStored: true,
    })}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

async function main() {
  const command = process.argv[2];
  if (command === 'baseline') {
    const applied = await runMigrationSet(BASELINE_MIGRATIONS);
    await buildFrozenLegacyFixture();
    await writeOutput({ command, applied, evidence: await captureEvidence() });
  } else if (command === 'migrate') {
    await writeOutput({ command, applied: await runMigrationSet(AUTHORITY_MIGRATIONS), evidence: await captureEvidence() });
  } else if (command === 'migrate-to-185') {
    await writeOutput({ command, applied: await runMigrationSet(PRE_186_MIGRATIONS), evidence: await captureEvidence() });
  } else if (command === 'migrate-again') {
    await writeOutput({ command, applied: await runMigrationSet([...BASELINE_MIGRATIONS, ...AUTHORITY_MIGRATIONS]), evidence: await captureEvidence() });
  } else if (command === 'capture') {
    await writeOutput({ command, evidence: await captureEvidence() });
  } else if (command === 'fault') {
    await writeOutput({ command, result: await injectTransactionalFault() });
  } else {
    throw new Error(`Unknown pre-179 rehearsal command: ${command || '(missing)'}`);
  }
}

if (require.main === module) {
  void main().catch((error) => {
    process.stderr.write(`[acceptance:migration-pre179] ${error instanceof Error ? error.message : 'failed'}\n`);
    process.exitCode = 1;
  });
}
