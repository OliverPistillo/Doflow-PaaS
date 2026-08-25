type SqlExecutor = {
  query(sql: string, parameters?: unknown[]): Promise<unknown>;
};

/**
 * Additive schema contract for the Superadmin entities that previously relied
 * on TypeORM synchronize. The release candidate keeps DB_SYNC=false, so every
 * control-plane surface must have an explicit, idempotent PostgreSQL schema.
 */
export async function ensurePlatformOperationalTables(executor: SqlExecutor) {
  await executor.query(`
    CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

    CREATE TABLE IF NOT EXISTS public.invoice_templates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      "htmlContent" TEXT NOT NULL,
      "isDefault" BOOLEAN NOT NULL DEFAULT false,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.invoices (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      invoice_number TEXT,
      doc_type VARCHAR(20) DEFAULT 'fattura',
      client_name TEXT NOT NULL,
      client_address TEXT,
      client_city TEXT,
      client_zip TEXT,
      client_vat TEXT,
      client_fiscal_code TEXT,
      client_sdi TEXT,
      client_pec TEXT,
      amount NUMERIC(12,2) NOT NULL,
      issue_date DATE NOT NULL,
      due_date DATE NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      tax_regime TEXT NOT NULL DEFAULT 'ordinario',
      tax_rate NUMERIC(5,2) NOT NULL DEFAULT 22.00,
      inps_rate NUMERIC(5,2) DEFAULT 0,
      ritenuta_rate NUMERIC(5,2) DEFAULT 0,
      notes TEXT,
      template_id UUID REFERENCES public.invoice_templates(id) ON DELETE SET NULL,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_public_invoices_status ON public.invoices(status);
    CREATE INDEX IF NOT EXISTS idx_public_invoices_issue_date ON public.invoices(issue_date);

    CREATE TABLE IF NOT EXISTS public.invoice_line_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      description TEXT NOT NULL,
      quantity NUMERIC(10,2) NOT NULL,
      "unitPrice" NUMERIC(10,2) NOT NULL,
      total NUMERIC(10,2) NOT NULL,
      invoice_id UUID NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_public_invoice_lines_invoice ON public.invoice_line_items(invoice_id);

    CREATE TABLE IF NOT EXISTS public.invoice_service_presets (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      description TEXT NOT NULL,
      "unitPrice" NUMERIC(10,2) NOT NULL DEFAULT 0,
      quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.platform_deals (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT,
      client_name TEXT,
      value_cents INTEGER NOT NULL DEFAULT 0,
      probability_bps INTEGER NOT NULL DEFAULT 0,
      stage TEXT NOT NULL DEFAULT 'Lead qualificato',
      expected_close_date DATE,
      assigned_to_user_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_platform_deal_value CHECK (value_cents >= 0),
      CONSTRAINT chk_platform_deal_probability CHECK (probability_bps BETWEEN 0 AND 10000)
    );

    CREATE TABLE IF NOT EXISTS public.delivery_tasks (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      service_name TEXT NOT NULL,
      category TEXT NOT NULL,
      due_date DATE,
      priority VARCHAR NOT NULL DEFAULT 'Media',
      status VARCHAR NOT NULL DEFAULT 'todo',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.calendar_events (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      date DATE NOT NULL,
      type TEXT NOT NULL DEFAULT 'meeting',
      description TEXT,
      "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.leads (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      "fullName" TEXT NOT NULL,
      email TEXT,
      phone TEXT,
      company TEXT,
      source TEXT NOT NULL DEFAULT 'MANUAL',
      status TEXT NOT NULL DEFAULT 'NEW',
      notes TEXT,
      score INTEGER NOT NULL DEFAULT 0,
      external_id TEXT,
      raw_payload JSONB,
      converted_tenant_id TEXT,
      assigned_to TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      CONSTRAINT chk_public_lead_score CHECK (score BETWEEN 0 AND 100)
    );
    CREATE INDEX IF NOT EXISTS idx_public_leads_source ON public.leads(source);
    CREATE INDEX IF NOT EXISTS idx_public_leads_status ON public.leads(status);

    CREATE TABLE IF NOT EXISTS public.system_backups (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      tenant_id TEXT,
      tenant_slug TEXT,
      type TEXT NOT NULL DEFAULT 'FULL',
      status TEXT NOT NULL DEFAULT 'PENDING',
      size_mb DOUBLE PRECISION NOT NULL DEFAULT 0,
      storage_path TEXT,
      duration_seconds INTEGER NOT NULL DEFAULT 0,
      error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS public.platform_notifications (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'INFO',
      channel TEXT NOT NULL DEFAULT 'PLATFORM',
      target_tenant_id TEXT,
      target_user_email TEXT,
      sender TEXT NOT NULL DEFAULT 'SYSTEM',
      is_read BOOLEAN NOT NULL DEFAULT false,
      read_at TIMESTAMP,
      action_url TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_platform_notifications_tenant ON public.platform_notifications(target_tenant_id);
    CREATE INDEX IF NOT EXISTS idx_platform_notifications_read ON public.platform_notifications(is_read);
    CREATE INDEX IF NOT EXISTS idx_platform_notifications_created ON public.platform_notifications(created_at DESC);

    CREATE TABLE IF NOT EXISTS public.support_tickets (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      ticket_code TEXT NOT NULL UNIQUE,
      subject TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'GENERAL',
      priority TEXT NOT NULL DEFAULT 'MEDIUM',
      status TEXT NOT NULL DEFAULT 'OPEN',
      tenant_id TEXT NOT NULL,
      tenant_name TEXT,
      reporter_email TEXT NOT NULL,
      assigned_to TEXT,
      replies JSONB NOT NULL DEFAULT '[]'::jsonb,
      sla_hours INTEGER,
      resolved_at TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_support_tickets_status ON public.support_tickets(status);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_priority ON public.support_tickets(priority);
    CREATE INDEX IF NOT EXISTS idx_support_tickets_tenant ON public.support_tickets(tenant_id);

    CREATE TABLE IF NOT EXISTS public.email_templates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      subject TEXT NOT NULL,
      "htmlBody" TEXT NOT NULL,
      "textBody" TEXT,
      category TEXT NOT NULL DEFAULT 'CUSTOM',
      variables JSONB NOT NULL DEFAULT '[]'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT true,
      send_count INTEGER NOT NULL DEFAULT 0,
      last_sent_at TIMESTAMP,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS public.changelog_entries (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      version TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'MINOR',
      is_published BOOLEAN NOT NULL DEFAULT false,
      published_at TIMESTAMP,
      tags JSONB NOT NULL DEFAULT '[]'::jsonb,
      author TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_changelog_published ON public.changelog_entries(is_published, published_at DESC);

    CREATE TABLE IF NOT EXISTS public.automation_rules (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      description TEXT,
      "triggerEvent" TEXT NOT NULL,
      trigger_conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
      "actionType" TEXT NOT NULL,
      action_config JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_active BOOLEAN NOT NULL DEFAULT true,
      execution_count INTEGER NOT NULL DEFAULT 0,
      last_executed_at TIMESTAMP,
      cron_expression TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}
