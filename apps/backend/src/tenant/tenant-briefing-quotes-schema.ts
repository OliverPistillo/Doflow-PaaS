import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

export async function ensureTenantBriefingQuoteTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantBriefingQuoteTables');

  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".briefing_templates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'website',
      description TEXT,
      schema_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      is_active BOOLEAN DEFAULT true,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".briefings (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      opportunity_id UUID REFERENCES "${s}".opportunities(id) ON DELETE SET NULL,
      template_id UUID REFERENCES "${s}".briefing_templates(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'website',
      status TEXT NOT NULL DEFAULT 'draft',
      objective TEXT,
      target TEXT,
      budget_estimate NUMERIC,
      deadline DATE,
      answers_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      missing_materials_json JSONB NOT NULL DEFAULT '[]'::jsonb,
      internal_notes TEXT,
      client_notes TEXT,
      created_by UUID,
      updated_by UUID,
      approved_by UUID,
      approved_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".briefing_material_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      briefing_id UUID NOT NULL REFERENCES "${s}".briefings(id) ON DELETE CASCADE,
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT,
      status TEXT NOT NULL DEFAULT 'missing',
      due_at TIMESTAMPTZ,
      received_at TIMESTAMPTZ,
      file_id UUID,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".service_templates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      category TEXT,
      description TEXT,
      default_unit_price NUMERIC NOT NULL DEFAULT 0,
      default_quantity NUMERIC NOT NULL DEFAULT 1,
      billing_type TEXT NOT NULL DEFAULT 'one_time',
      is_active BOOLEAN DEFAULT true,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".quotes (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      opportunity_id UUID REFERENCES "${s}".opportunities(id) ON DELETE SET NULL,
      briefing_id UUID REFERENCES "${s}".briefings(id) ON DELETE SET NULL,
      quote_number TEXT,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      currency TEXT NOT NULL DEFAULT 'EUR',
      subtotal NUMERIC NOT NULL DEFAULT 0,
      discount_total NUMERIC NOT NULL DEFAULT 0,
      tax_total NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      valid_until DATE,
      accepted_at TIMESTAMPTZ,
      rejected_at TIMESTAMPTZ,
      client_notes TEXT,
      internal_notes TEXT,
      terms TEXT,
      created_by UUID,
      updated_by UUID,
      accepted_by_contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".quote_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      quote_id UUID NOT NULL REFERENCES "${s}".quotes(id) ON DELETE CASCADE,
      service_template_id UUID REFERENCES "${s}".service_templates(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      description TEXT,
      quantity NUMERIC NOT NULL DEFAULT 1,
      unit_price NUMERIC NOT NULL DEFAULT 0,
      discount NUMERIC NOT NULL DEFAULT 0,
      tax_rate NUMERIC NOT NULL DEFAULT 0,
      total NUMERIC NOT NULL DEFAULT 0,
      billing_type TEXT NOT NULL DEFAULT 'one_time',
      sort_order INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_briefing_templates_active" ON "${s}".briefing_templates(is_active) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_briefings_company" ON "${s}".briefings(company_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_briefings_opportunity" ON "${s}".briefings(opportunity_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_briefings_status" ON "${s}".briefings(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_briefings_type" ON "${s}".briefings(type) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_briefing_materials_briefing" ON "${s}".briefing_material_requests(briefing_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_briefing_materials_status" ON "${s}".briefing_material_requests(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_service_templates_category" ON "${s}".service_templates(category) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_service_templates_active" ON "${s}".service_templates(is_active) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_quotes_company" ON "${s}".quotes(company_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_quotes_opportunity" ON "${s}".quotes(opportunity_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_quotes_briefing" ON "${s}".quotes(briefing_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_quotes_status" ON "${s}".quotes(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_quotes_valid_until" ON "${s}".quotes(valid_until) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_quote_items_quote" ON "${s}".quote_items(quote_id) WHERE deleted_at IS NULL`);
}

export async function seedDoflowBriefingQuoteTemplates(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'seedDoflowBriefingQuoteTemplates');
  await ensureTenantBriefingQuoteTables(ds, s);

  const briefingTemplates = [
    {
      name: 'Briefing sito web',
      type: 'website',
      description: 'Template base per raccogliere obiettivi, target, contenuti e materiali di un sito vetrina.',
    },
    {
      name: 'Briefing e-commerce',
      type: 'ecommerce',
      description: 'Template base per catalogo, pagamenti, spedizioni, contenuti prodotto e flussi e-commerce.',
    },
    {
      name: 'Briefing manutenzione',
      type: 'maintenance',
      description: 'Template base per audit, accessi, priorita tecniche e perimetro manutenzione.',
    },
  ];

  for (const tpl of briefingTemplates) {
    await ds.query(
      `INSERT INTO "${s}".briefing_templates (name, type, description, schema_json, is_active, created_at, updated_at)
       SELECT $1, $2, $3, '{}'::jsonb, true, now(), now()
       WHERE NOT EXISTS (
         SELECT 1 FROM "${s}".briefing_templates
         WHERE lower(name) = lower($1) AND deleted_at IS NULL
       )`,
      [tpl.name, tpl.type, tpl.description],
    );
  }

  const serviceTemplates = [
    ['Sito vetrina', 'website', 'Realizzazione sito vetrina aziendale'],
    ['Landing page', 'website', 'Landing page per campagne o lanci commerciali'],
    ['E-commerce', 'ecommerce', 'Realizzazione e-commerce'],
    ['Manutenzione WordPress', 'maintenance', 'Manutenzione tecnica WordPress'],
    ['Hosting annuale', 'hosting', 'Servizio hosting annuale'],
    ['SEO base', 'seo', 'Setup SEO tecnico e contenuti base'],
    ['Performance optimization', 'performance', 'Ottimizzazione performance sito'],
    ['Copy/contenuti', 'content', 'Supporto copywriting e contenuti'],
    ['Privacy/Cookie setup', 'legal', 'Setup privacy policy, cookie policy e banner'],
  ];

  for (const [name, category, description] of serviceTemplates) {
    await ds.query(
      `INSERT INTO "${s}".service_templates (
         name, category, description, default_unit_price, default_quantity,
         billing_type, is_active, created_at, updated_at
       )
       SELECT $1, $2, $3, 0, 1, 'one_time', true, now(), now()
       WHERE NOT EXISTS (
         SELECT 1 FROM "${s}".service_templates
         WHERE lower(name) = lower($1) AND deleted_at IS NULL
       )`,
      [name, category, description],
    );
  }
}
