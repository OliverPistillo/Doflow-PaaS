import { DataSource, QueryRunner } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantProjectsTables } from './tenant-projects-schema';

async function addColumns(ds: DataSource, schema: string, table: string, columns: string[]) {
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

export async function ensureTenantFinanceTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantFinanceTables');

  await ensureTenantProjectsTables(ds, s);
  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".invoices (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      opportunity_id UUID REFERENCES "${s}".opportunities(id) ON DELETE SET NULL,
      briefing_id UUID REFERENCES "${s}".briefings(id) ON DELETE SET NULL,
      quote_id UUID REFERENCES "${s}".quotes(id) ON DELETE SET NULL,
      project_id UUID REFERENCES "${s}".projects(id) ON DELETE SET NULL,
      invoice_number TEXT,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'standard',
      status TEXT NOT NULL DEFAULT 'draft',
      currency TEXT NOT NULL DEFAULT 'EUR',
      subtotal NUMERIC NOT NULL DEFAULT 0,
      discount_total NUMERIC NOT NULL DEFAULT 0,
      tax_total NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      paid_total NUMERIC NOT NULL DEFAULT 0,
      remaining_total NUMERIC NOT NULL DEFAULT 0,
      issue_date DATE,
      due_date DATE,
      paid_at TIMESTAMPTZ,
      payment_method TEXT,
      external_reference TEXT,
      pdf_file_id UUID,
      client_notes TEXT,
      internal_notes TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'invoices', [
    'company_id UUID',
    'contact_id UUID',
    'opportunity_id UUID',
    'briefing_id UUID',
    'quote_id UUID',
    'project_id UUID',
    'invoice_number TEXT',
    'title TEXT',
    "type TEXT NOT NULL DEFAULT 'standard'",
    "status TEXT NOT NULL DEFAULT 'draft'",
    "currency TEXT NOT NULL DEFAULT 'EUR'",
    'subtotal NUMERIC NOT NULL DEFAULT 0',
    'discount_total NUMERIC NOT NULL DEFAULT 0',
    'tax_total NUMERIC NOT NULL DEFAULT 0',
    'total NUMERIC NOT NULL DEFAULT 0',
    'paid_total NUMERIC NOT NULL DEFAULT 0',
    'remaining_total NUMERIC NOT NULL DEFAULT 0',
    'issue_date DATE',
    'due_date DATE',
    'paid_at TIMESTAMPTZ',
    'payment_method TEXT',
    'external_reference TEXT',
    'pdf_file_id UUID',
    'client_notes TEXT',
    'internal_notes TEXT',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".invoice_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id UUID NOT NULL REFERENCES "${s}".invoices(id) ON DELETE CASCADE,
      quote_item_id UUID REFERENCES "${s}".quote_items(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      quantity NUMERIC NOT NULL DEFAULT 1,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      discount NUMERIC NOT NULL DEFAULT 0,
      tax_rate NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'invoice_items', [
    'invoice_id UUID',
    'quote_item_id UUID',
    'name TEXT',
    'description TEXT',
    'quantity NUMERIC NOT NULL DEFAULT 1',
    'unit_price NUMERIC NOT NULL DEFAULT 0',
    'discount NUMERIC NOT NULL DEFAULT 0',
    'tax_rate NUMERIC NOT NULL DEFAULT 0',
    'total NUMERIC NOT NULL DEFAULT 0',
    'sort_order INTEGER DEFAULT 0',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".payments (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_id UUID REFERENCES "${s}".invoices(id) ON DELETE SET NULL,
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      project_id UUID REFERENCES "${s}".projects(id) ON DELETE SET NULL,
      amount NUMERIC NOT NULL,
      currency TEXT NOT NULL DEFAULT 'EUR',
      status TEXT NOT NULL DEFAULT 'recorded',
      payment_date DATE,
      method TEXT,
      reference TEXT,
      notes TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'payments', [
    'invoice_id UUID',
    'company_id UUID',
    'project_id UUID',
    'amount NUMERIC',
    "currency TEXT NOT NULL DEFAULT 'EUR'",
    "status TEXT NOT NULL DEFAULT 'recorded'",
    'payment_date DATE',
    'method TEXT',
    'reference TEXT',
    'notes TEXT',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".financial_deadlines (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      project_id UUID REFERENCES "${s}".projects(id) ON DELETE SET NULL,
      quote_id UUID REFERENCES "${s}".quotes(id) ON DELETE SET NULL,
      invoice_id UUID REFERENCES "${s}".invoices(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'payment',
      status TEXT NOT NULL DEFAULT 'open',
      amount NUMERIC,
      currency TEXT NOT NULL DEFAULT 'EUR',
      due_date DATE NOT NULL,
      completed_at TIMESTAMPTZ,
      notes TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'financial_deadlines', [
    'company_id UUID',
    'project_id UUID',
    'quote_id UUID',
    'invoice_id UUID',
    'title TEXT',
    "type TEXT NOT NULL DEFAULT 'payment'",
    "status TEXT NOT NULL DEFAULT 'open'",
    'amount NUMERIC',
    "currency TEXT NOT NULL DEFAULT 'EUR'",
    'due_date DATE',
    'completed_at TIMESTAMPTZ',
    'notes TEXT',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".recurring_services (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      project_id UUID REFERENCES "${s}".projects(id) ON DELETE SET NULL,
      quote_id UUID REFERENCES "${s}".quotes(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      category TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      billing_cycle TEXT NOT NULL DEFAULT 'yearly',
      amount NUMERIC NOT NULL DEFAULT 0,
      currency TEXT NOT NULL DEFAULT 'EUR',
      start_date DATE,
      next_due_date DATE,
      end_date DATE,
      auto_renew BOOLEAN DEFAULT false,
      internal_notes TEXT,
      client_notes TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'recurring_services', [
    'company_id UUID',
    'project_id UUID',
    'quote_id UUID',
    'name TEXT',
    'category TEXT',
    "status TEXT NOT NULL DEFAULT 'active'",
    "billing_cycle TEXT NOT NULL DEFAULT 'yearly'",
    'amount NUMERIC NOT NULL DEFAULT 0',
    "currency TEXT NOT NULL DEFAULT 'EUR'",
    'start_date DATE',
    'next_due_date DATE',
    'end_date DATE',
    'auto_renew BOOLEAN DEFAULT false',
    'internal_notes TEXT',
    'client_notes TEXT',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".renewals (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      recurring_service_id UUID REFERENCES "${s}".recurring_services(id) ON DELETE SET NULL,
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      project_id UUID REFERENCES "${s}".projects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'upcoming',
      amount NUMERIC,
      currency TEXT NOT NULL DEFAULT 'EUR',
      due_date DATE NOT NULL,
      reminded_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      invoice_id UUID REFERENCES "${s}".invoices(id) ON DELETE SET NULL,
      notes TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'renewals', [
    'recurring_service_id UUID',
    'company_id UUID',
    'project_id UUID',
    'title TEXT',
    "status TEXT NOT NULL DEFAULT 'upcoming'",
    'amount NUMERIC',
    "currency TEXT NOT NULL DEFAULT 'EUR'",
    'due_date DATE',
    'reminded_at TIMESTAMPTZ',
    'completed_at TIMESTAMPTZ',
    'invoice_id UUID',
    'notes TEXT',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".project_financial_status (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      project_id UUID NOT NULL REFERENCES "${s}".projects(id) ON DELETE CASCADE,
      quote_id UUID REFERENCES "${s}".quotes(id) ON DELETE SET NULL,
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      deposit_required NUMERIC NOT NULL DEFAULT 0,
      deposit_paid NUMERIC NOT NULL DEFAULT 0,
      balance_required NUMERIC NOT NULL DEFAULT 0,
      balance_paid NUMERIC NOT NULL DEFAULT 0,
      total_expected NUMERIC NOT NULL DEFAULT 0,
      total_paid NUMERIC NOT NULL DEFAULT 0,
      payment_status TEXT NOT NULL DEFAULT 'not_started',
      deposit_due_date DATE,
      balance_due_date DATE,
      last_payment_at TIMESTAMPTZ,
      internal_notes TEXT,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'project_financial_status', [
    'project_id UUID',
    'quote_id UUID',
    'company_id UUID',
    'deposit_required NUMERIC NOT NULL DEFAULT 0',
    'deposit_paid NUMERIC NOT NULL DEFAULT 0',
    'balance_required NUMERIC NOT NULL DEFAULT 0',
    'balance_paid NUMERIC NOT NULL DEFAULT 0',
    'total_expected NUMERIC NOT NULL DEFAULT 0',
    'total_paid NUMERIC NOT NULL DEFAULT 0',
    "payment_status TEXT NOT NULL DEFAULT 'not_started'",
    'deposit_due_date DATE',
    'balance_due_date DATE',
    'last_payment_at TIMESTAMPTZ',
    'internal_notes TEXT',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await backfillFinanceDefaults(ds, s);
  await createFinanceIndexes(ds, s);
}

export async function ensureProjectFinancialStatusFromQuote(
  runner: QueryRunner,
  schema: string,
  projectId: string,
  quoteId: string,
  companyId: string | null,
  userId: string | null,
) {
  const s = safeSchema(schema, 'ensureProjectFinancialStatusFromQuote');
  const quoteRows = await runner.query(
    `SELECT total FROM "${s}".quotes WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [quoteId],
  );
  const totalExpected = Number(quoteRows[0]?.total || 0);
  await runner.query(
    `INSERT INTO "${s}".project_financial_status (
       project_id, quote_id, company_id, total_expected, total_paid, payment_status,
       created_by, updated_by, created_at, updated_at
     )
     VALUES ($1, $2, $3, $4, 0, 'not_started', $5, $5, now(), now())
     ON CONFLICT (project_id) WHERE deleted_at IS NULL DO UPDATE
       SET quote_id = COALESCE(EXCLUDED.quote_id, "${s}".project_financial_status.quote_id),
           company_id = COALESCE(EXCLUDED.company_id, "${s}".project_financial_status.company_id),
           total_expected = GREATEST(COALESCE("${s}".project_financial_status.total_expected, 0), EXCLUDED.total_expected),
           updated_by = EXCLUDED.updated_by,
           updated_at = now()`,
    [projectId, quoteId, companyId, totalExpected, userId],
  );
}

async function backfillFinanceDefaults(ds: DataSource, schema: string) {
  await ds.query(`UPDATE "${schema}".invoices SET title = COALESCE(NULLIF(title, ''), invoice_number, 'Fattura') WHERE title IS NULL OR title = ''`);
  await ds.query(`UPDATE "${schema}".invoices SET type = 'standard' WHERE type IS NULL OR type = ''`);
  await ds.query(`UPDATE "${schema}".invoices SET status = 'draft' WHERE status IS NULL OR status = ''`);
  await ds.query(`UPDATE "${schema}".invoices SET currency = 'EUR' WHERE currency IS NULL OR currency = ''`);
  for (const column of ['subtotal', 'discount_total', 'tax_total', 'total', 'paid_total', 'remaining_total']) {
    await ds.query(`UPDATE "${schema}".invoices SET ${column} = 0 WHERE ${column} IS NULL`);
    await ds.query(`ALTER TABLE "${schema}".invoices ALTER COLUMN ${column} SET DEFAULT 0`);
    await ds.query(`ALTER TABLE "${schema}".invoices ALTER COLUMN ${column} SET NOT NULL`);
  }
  await ds.query(`ALTER TABLE "${schema}".invoices ALTER COLUMN title SET NOT NULL`);
  await ds.query(`ALTER TABLE "${schema}".invoices ALTER COLUMN type SET DEFAULT 'standard'`);
  await ds.query(`ALTER TABLE "${schema}".invoices ALTER COLUMN type SET NOT NULL`);
  await ds.query(`ALTER TABLE "${schema}".invoices ALTER COLUMN status SET DEFAULT 'draft'`);
  await ds.query(`ALTER TABLE "${schema}".invoices ALTER COLUMN status SET NOT NULL`);
  await ds.query(`ALTER TABLE "${schema}".invoices ALTER COLUMN currency SET DEFAULT 'EUR'`);
  await ds.query(`ALTER TABLE "${schema}".invoices ALTER COLUMN currency SET NOT NULL`);

  await ds.query(`UPDATE "${schema}".payments SET status = 'recorded' WHERE status IS NULL OR status = ''`);
  await ds.query(`UPDATE "${schema}".payments SET currency = 'EUR' WHERE currency IS NULL OR currency = ''`);
  await ds.query(`ALTER TABLE "${schema}".payments ALTER COLUMN status SET DEFAULT 'recorded'`);
  await ds.query(`ALTER TABLE "${schema}".payments ALTER COLUMN status SET NOT NULL`);
  await ds.query(`ALTER TABLE "${schema}".payments ALTER COLUMN currency SET DEFAULT 'EUR'`);
  await ds.query(`ALTER TABLE "${schema}".payments ALTER COLUMN currency SET NOT NULL`);

  await ds.query(`UPDATE "${schema}".project_financial_status SET payment_status = 'not_started' WHERE payment_status IS NULL OR payment_status = ''`);
  for (const column of ['deposit_required', 'deposit_paid', 'balance_required', 'balance_paid', 'total_expected', 'total_paid']) {
    await ds.query(`UPDATE "${schema}".project_financial_status SET ${column} = 0 WHERE ${column} IS NULL`);
    await ds.query(`ALTER TABLE "${schema}".project_financial_status ALTER COLUMN ${column} SET DEFAULT 0`);
    await ds.query(`ALTER TABLE "${schema}".project_financial_status ALTER COLUMN ${column} SET NOT NULL`);
  }
  await ds.query(`ALTER TABLE "${schema}".project_financial_status ALTER COLUMN payment_status SET DEFAULT 'not_started'`);
  await ds.query(`ALTER TABLE "${schema}".project_financial_status ALTER COLUMN payment_status SET NOT NULL`);
}

async function createFinanceIndexes(ds: DataSource, s: string) {
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_invoices_company" ON "${s}".invoices(company_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_invoices_project" ON "${s}".invoices(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_invoices_quote" ON "${s}".invoices(quote_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_invoices_status" ON "${s}".invoices(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_invoices_due" ON "${s}".invoices(due_date) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_invoice_items_invoice" ON "${s}".invoice_items(invoice_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_payments_invoice" ON "${s}".payments(invoice_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_payments_project" ON "${s}".payments(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_payments_date" ON "${s}".payments(payment_date) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_financial_deadlines_due" ON "${s}".financial_deadlines(due_date) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_financial_deadlines_status" ON "${s}".financial_deadlines(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_recurring_services_company" ON "${s}".recurring_services(company_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_recurring_services_project" ON "${s}".recurring_services(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_recurring_services_next_due" ON "${s}".recurring_services(next_due_date) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_renewals_due" ON "${s}".renewals(due_date) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_renewals_status" ON "${s}".renewals(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_pfs_project" ON "${s}".project_financial_status(project_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_pfs_payment_status" ON "${s}".project_financial_status(payment_status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_pfs_active_project" ON "${s}".project_financial_status(project_id) WHERE deleted_at IS NULL`);
}
