import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantProjectsTables } from './tenant-projects-schema';

async function addColumns(ds: DataSource, schema: string, table: string, columns: string[]) {
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

export async function ensureTenantClientPortalTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantClientPortalTables');

  await ensureTenantProjectsTables(ds, s);
  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".client_portal_accounts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      email TEXT NOT NULL,
      name TEXT,
      phone TEXT,
      status TEXT NOT NULL DEFAULT 'invited',
      last_login_at TIMESTAMPTZ,
      accepted_terms_at TIMESTAMPTZ,
      password_hash TEXT,
      magic_login_enabled BOOLEAN DEFAULT true,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'client_portal_accounts', [
    'company_id UUID',
    'contact_id UUID',
    'email TEXT',
    'name TEXT',
    'phone TEXT',
    "status TEXT NOT NULL DEFAULT 'invited'",
    'last_login_at TIMESTAMPTZ',
    'accepted_terms_at TIMESTAMPTZ',
    'password_hash TEXT',
    'magic_login_enabled BOOLEAN DEFAULT true',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".client_portal_invites (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      account_id UUID NOT NULL REFERENCES "${s}".client_portal_accounts(id) ON DELETE CASCADE,
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      token_hash TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      expires_at TIMESTAMPTZ NOT NULL,
      accepted_at TIMESTAMPTZ,
      revoked_at TIMESTAMPTZ,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'client_portal_invites', [
    'account_id UUID',
    'company_id UUID',
    'contact_id UUID',
    'token_hash TEXT',
    "status TEXT NOT NULL DEFAULT 'pending'",
    'expires_at TIMESTAMPTZ',
    'accepted_at TIMESTAMPTZ',
    'revoked_at TIMESTAMPTZ',
    'created_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".client_project_access (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      account_id UUID NOT NULL REFERENCES "${s}".client_portal_accounts(id) ON DELETE CASCADE,
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      access_level TEXT NOT NULL DEFAULT 'viewer',
      can_view_milestones BOOLEAN DEFAULT true,
      can_view_tasks BOOLEAN DEFAULT false,
      can_comment BOOLEAN DEFAULT true,
      can_upload_files BOOLEAN DEFAULT false,
      can_approve BOOLEAN DEFAULT true,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'client_project_access', [
    'account_id UUID',
    'company_id UUID',
    'project_id UUID',
    "access_level TEXT NOT NULL DEFAULT 'viewer'",
    'can_view_milestones BOOLEAN DEFAULT true',
    'can_view_tasks BOOLEAN DEFAULT false',
    'can_comment BOOLEAN DEFAULT true',
    'can_upload_files BOOLEAN DEFAULT false',
    'can_approve BOOLEAN DEFAULT true',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".client_approval_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      account_id UUID REFERENCES "${s}".client_portal_accounts(id) ON DELETE SET NULL,
      project_id UUID REFERENCES "${s}".projects(id) ON DELETE SET NULL,
      quote_id UUID REFERENCES "${s}".quotes(id) ON DELETE SET NULL,
      briefing_id UUID REFERENCES "${s}".briefings(id) ON DELETE SET NULL,
      milestone_id UUID REFERENCES "${s}".milestones(id) ON DELETE SET NULL,
      task_id UUID REFERENCES "${s}".tasks(id) ON DELETE SET NULL,
      file_link_id UUID REFERENCES "${s}".project_file_links(id) ON DELETE SET NULL,
      type TEXT NOT NULL DEFAULT 'general',
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      due_date DATE,
      approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      changes_requested_at TIMESTAMPTZ,
      decided_by_account_id UUID REFERENCES "${s}".client_portal_accounts(id) ON DELETE SET NULL,
      decision_note TEXT,
      internal_notes TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'client_approval_requests', [
    'company_id UUID',
    'contact_id UUID',
    'account_id UUID',
    'project_id UUID',
    'quote_id UUID',
    'briefing_id UUID',
    'milestone_id UUID',
    'task_id UUID',
    'file_link_id UUID',
    "type TEXT NOT NULL DEFAULT 'general'",
    'title TEXT',
    'description TEXT',
    "status TEXT NOT NULL DEFAULT 'pending'",
    'due_date DATE',
    'approved_at TIMESTAMPTZ',
    'rejected_at TIMESTAMPTZ',
    'changes_requested_at TIMESTAMPTZ',
    'decided_by_account_id UUID',
    'decision_note TEXT',
    'internal_notes TEXT',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".client_material_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      account_id UUID REFERENCES "${s}".client_portal_accounts(id) ON DELETE SET NULL,
      project_id UUID REFERENCES "${s}".projects(id) ON DELETE SET NULL,
      briefing_id UUID REFERENCES "${s}".briefings(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'generic',
      status TEXT NOT NULL DEFAULT 'requested',
      due_date DATE,
      submitted_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      internal_notes TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'client_material_requests', [
    'company_id UUID',
    'contact_id UUID',
    'account_id UUID',
    'project_id UUID',
    'briefing_id UUID',
    'title TEXT',
    'description TEXT',
    "type TEXT NOT NULL DEFAULT 'generic'",
    "status TEXT NOT NULL DEFAULT 'requested'",
    'due_date DATE',
    'submitted_at TIMESTAMPTZ',
    'approved_at TIMESTAMPTZ',
    'rejected_at TIMESTAMPTZ',
    'internal_notes TEXT',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".client_portal_comments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      account_id UUID REFERENCES "${s}".client_portal_accounts(id) ON DELETE SET NULL,
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      project_id UUID REFERENCES "${s}".projects(id) ON DELETE SET NULL,
      approval_request_id UUID REFERENCES "${s}".client_approval_requests(id) ON DELETE SET NULL,
      material_request_id UUID REFERENCES "${s}".client_material_requests(id) ON DELETE SET NULL,
      task_id UUID REFERENCES "${s}".tasks(id) ON DELETE SET NULL,
      milestone_id UUID REFERENCES "${s}".milestones(id) ON DELETE SET NULL,
      file_link_id UUID REFERENCES "${s}".project_file_links(id) ON DELETE SET NULL,
      body TEXT NOT NULL,
      visibility TEXT NOT NULL DEFAULT 'client',
      created_by_user_id UUID,
      created_by_account_id UUID REFERENCES "${s}".client_portal_accounts(id) ON DELETE SET NULL,
      updated_by_user_id UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'client_portal_comments', [
    'account_id UUID',
    'company_id UUID',
    'project_id UUID',
    'approval_request_id UUID',
    'material_request_id UUID',
    'task_id UUID',
    'milestone_id UUID',
    'file_link_id UUID',
    'body TEXT',
    "visibility TEXT NOT NULL DEFAULT 'client'",
    'created_by_user_id UUID',
    'created_by_account_id UUID',
    'updated_by_user_id UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".client_material_files (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      material_request_id UUID NOT NULL REFERENCES "${s}".client_material_requests(id) ON DELETE CASCADE,
      project_id UUID REFERENCES "${s}".projects(id) ON DELETE SET NULL,
      account_id UUID REFERENCES "${s}".client_portal_accounts(id) ON DELETE SET NULL,
      file_id UUID,
      original_filename TEXT,
      notes TEXT,
      status TEXT NOT NULL DEFAULT 'submitted',
      created_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'client_material_files', [
    'material_request_id UUID',
    'project_id UUID',
    'account_id UUID',
    'file_id UUID',
    'original_filename TEXT',
    'notes TEXT',
    "status TEXT NOT NULL DEFAULT 'submitted'",
    'created_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".client_portal_audit_log (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      account_id UUID REFERENCES "${s}".client_portal_accounts(id) ON DELETE SET NULL,
      user_id UUID,
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      project_id UUID REFERENCES "${s}".projects(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      entity_type TEXT,
      entity_id UUID,
      metadata JSONB,
      ip_address TEXT,
      user_agent TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_client_portal_accounts_email" ON "${s}".client_portal_accounts(lower(email)) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_portal_accounts_company" ON "${s}".client_portal_accounts(company_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_portal_invites_token" ON "${s}".client_portal_invites(token_hash) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_portal_invites_status" ON "${s}".client_portal_invites(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_project_access_account" ON "${s}".client_project_access(account_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_project_access_project" ON "${s}".client_project_access(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_client_project_access_active" ON "${s}".client_project_access(account_id, project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_approvals_project" ON "${s}".client_approval_requests(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_approvals_status" ON "${s}".client_approval_requests(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_approvals_due" ON "${s}".client_approval_requests(due_date) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_comments_project" ON "${s}".client_portal_comments(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_comments_approval" ON "${s}".client_portal_comments(approval_request_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_comments_material" ON "${s}".client_portal_comments(material_request_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_material_requests_project" ON "${s}".client_material_requests(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_material_requests_status" ON "${s}".client_material_requests(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_material_requests_due" ON "${s}".client_material_requests(due_date) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_material_files_request" ON "${s}".client_material_files(material_request_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_audit_account" ON "${s}".client_portal_audit_log(account_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_audit_project" ON "${s}".client_portal_audit_log(project_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_client_audit_action" ON "${s}".client_portal_audit_log(action)`);
}
