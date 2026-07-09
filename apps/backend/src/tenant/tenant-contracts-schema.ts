import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

export type ContractTemplateSeed = {
  name: string;
  slug: string;
  category: string;
  description: string;
  bodyMarkdown: string;
};

const DEFAULT_TEMPLATE_VARIABLES = [
  'client_name',
  'company_name',
  'vat_number',
  'project_name',
  'quote_number',
  'amount',
  'payment_terms',
  'start_date',
  'end_date',
  'renewal_date',
  'legal_representative',
  'jurisdiction',
];

const DEFAULT_CONTRACT_CHECKLIST = [
  'Dati anagrafici cliente',
  'Codice fiscale / P.IVA',
  'PEC / SDI',
  'Referente operativo',
  'Preventivo approvato',
  'Contratto verificato',
  'Contratto firmato',
  'Documento identita se necessario',
  'Accessi dominio/hosting se necessari',
  'Privacy/Cookie se necessarie',
  'Materiali iniziali ricevuti',
];

export const BASE_CONTRACT_TEMPLATES: ContractTemplateSeed[] = [
  {
    name: 'Contratto sviluppo sito web',
    slug: 'website-development-contract',
    category: 'website',
    description: 'Template operativo per sviluppo sito web.',
    bodyMarkdown: '# Contratto sviluppo sito web\n\nTemplate operativo da verificare prima dell\'uso.\n\nCliente: {{client_name}}\nProgetto: {{project_name}}\nPreventivo: {{quote_number}}\nImporto: {{amount}}\nTermini pagamento: {{payment_terms}}\n',
  },
  {
    name: 'Contratto e-commerce',
    slug: 'ecommerce-development-contract',
    category: 'ecommerce',
    description: 'Template operativo per progetto e-commerce.',
    bodyMarkdown: '# Contratto e-commerce\n\nTemplate operativo da verificare prima dell\'uso.\n\nCliente: {{client_name}}\nAzienda: {{company_name}}\nProgetto: {{project_name}}\n',
  },
  {
    name: 'Contratto manutenzione annuale',
    slug: 'annual-maintenance-contract',
    category: 'maintenance',
    description: 'Template operativo per manutenzione annuale.',
    bodyMarkdown: '# Contratto manutenzione annuale\n\nTemplate operativo da verificare prima dell\'uso.\n\nCliente: {{client_name}}\nRinnovo: {{renewal_date}}\n',
  },
  {
    name: 'Lettera incarico consulenza',
    slug: 'consulting-engagement-letter',
    category: 'consulting',
    description: 'Template operativo per incarico di consulenza.',
    bodyMarkdown: '# Lettera incarico consulenza\n\nTemplate operativo da verificare prima dell\'uso.\n\nCliente: {{client_name}}\nPeriodo: {{start_date}} - {{end_date}}\n',
  },
  {
    name: 'NDA / Riservatezza',
    slug: 'nda-confidentiality',
    category: 'nda',
    description: 'Template operativo NDA/riservatezza.',
    bodyMarkdown: '# NDA / Riservatezza\n\nTemplate operativo da verificare prima dell\'uso.\n\nParti: {{company_name}} e doflow\nGiurisdizione: {{jurisdiction}}\n',
  },
];

async function addColumns(ds: DataSource, schema: string, table: string, columns: string[]) {
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

export async function ensureTenantContractsTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantContractsTables');
  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".contract_templates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'general',
      description TEXT,
      body_markdown TEXT NOT NULL DEFAULT '',
      variables JSONB,
      default_checklist JSONB,
      is_active BOOLEAN NOT NULL DEFAULT true,
      version_label TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'contract_templates', [
    'name TEXT',
    'slug TEXT',
    "category TEXT NOT NULL DEFAULT 'general'",
    'description TEXT',
    "body_markdown TEXT NOT NULL DEFAULT ''",
    'variables JSONB',
    'default_checklist JSONB',
    'is_active BOOLEAN NOT NULL DEFAULT true',
    'version_label TEXT',
    'created_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".contracts (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_number TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      template_id UUID REFERENCES "${s}".contract_templates(id) ON DELETE SET NULL,
      company_id UUID,
      contact_id UUID,
      quote_id UUID,
      project_id UUID,
      opportunity_id UUID,
      owner_user_id UUID,
      assigned_to_user_id UUID,
      status TEXT NOT NULL DEFAULT 'draft',
      signature_status TEXT NOT NULL DEFAULT 'not_started',
      priority TEXT NOT NULL DEFAULT 'medium',
      contract_type TEXT NOT NULL DEFAULT 'generic',
      amount NUMERIC(14,2),
      currency TEXT NOT NULL DEFAULT 'EUR',
      payment_terms TEXT,
      start_date DATE,
      end_date DATE,
      renewal_date DATE,
      due_date DATE,
      sent_at TIMESTAMPTZ,
      approved_at TIMESTAMPTZ,
      signed_at TIMESTAMPTZ,
      activated_at TIMESTAMPTZ,
      cancelled_at TIMESTAMPTZ,
      archived_at TIMESTAMPTZ,
      internal_notes TEXT,
      public_notes TEXT,
      metadata JSONB,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'contracts', [
    'contract_number TEXT',
    'title TEXT',
    'description TEXT',
    'template_id UUID',
    'company_id UUID',
    'contact_id UUID',
    'quote_id UUID',
    'project_id UUID',
    'opportunity_id UUID',
    'owner_user_id UUID',
    'assigned_to_user_id UUID',
    "status TEXT NOT NULL DEFAULT 'draft'",
    "signature_status TEXT NOT NULL DEFAULT 'not_started'",
    "priority TEXT NOT NULL DEFAULT 'medium'",
    "contract_type TEXT NOT NULL DEFAULT 'generic'",
    'amount NUMERIC(14,2)',
    "currency TEXT NOT NULL DEFAULT 'EUR'",
    'payment_terms TEXT',
    'start_date DATE',
    'end_date DATE',
    'renewal_date DATE',
    'due_date DATE',
    'sent_at TIMESTAMPTZ',
    'approved_at TIMESTAMPTZ',
    'signed_at TIMESTAMPTZ',
    'activated_at TIMESTAMPTZ',
    'cancelled_at TIMESTAMPTZ',
    'archived_at TIMESTAMPTZ',
    'internal_notes TEXT',
    'public_notes TEXT',
    'metadata JSONB',
    'created_by UUID',
    'updated_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);
  await ds.query(`ALTER TABLE "${s}".contracts ALTER COLUMN status SET DEFAULT 'draft'`);
  await ds.query(`ALTER TABLE "${s}".contracts ALTER COLUMN signature_status SET DEFAULT 'not_started'`);
  await ds.query(`ALTER TABLE "${s}".contracts ALTER COLUMN priority SET DEFAULT 'medium'`);
  await ds.query(`ALTER TABLE "${s}".contracts ALTER COLUMN contract_type SET DEFAULT 'generic'`);
  await ds.query(`ALTER TABLE "${s}".contracts ALTER COLUMN currency SET DEFAULT 'EUR'`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".contract_versions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NOT NULL REFERENCES "${s}".contracts(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      body_markdown TEXT NOT NULL DEFAULT '',
      variables JSONB,
      status TEXT NOT NULL DEFAULT 'draft',
      change_note TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      UNIQUE(contract_id, version_number)
    )
  `);
  await addColumns(ds, s, 'contract_versions', [
    'contract_id UUID',
    'version_number INTEGER',
    'title TEXT',
    "body_markdown TEXT NOT NULL DEFAULT ''",
    'variables JSONB',
    "status TEXT NOT NULL DEFAULT 'draft'",
    'change_note TEXT',
    'created_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".contract_signers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NOT NULL REFERENCES "${s}".contracts(id) ON DELETE CASCADE,
      signer_type TEXT NOT NULL DEFAULT 'client',
      name TEXT NOT NULL,
      email TEXT,
      role_title TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      signed_at TIMESTAMPTZ,
      declined_at TIMESTAMPTZ,
      notes TEXT,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".contract_checklist_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID NOT NULL REFERENCES "${s}".contracts(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'document',
      is_required BOOLEAN NOT NULL DEFAULT true,
      status TEXT NOT NULL DEFAULT 'missing',
      assigned_to_user_id UUID,
      due_date DATE,
      linked_document_id UUID,
      notes TEXT,
      metadata JSONB,
      completed_at TIMESTAMPTZ,
      completed_by UUID,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".contract_activity (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      contract_id UUID REFERENCES "${s}".contracts(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      actor_user_id UUID,
      entity_type TEXT,
      entity_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".paperwork_dossiers (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      title TEXT NOT NULL,
      description TEXT,
      dossier_type TEXT NOT NULL DEFAULT 'generic',
      company_id UUID,
      contact_id UUID,
      quote_id UUID,
      project_id UUID,
      contract_id UUID REFERENCES "${s}".contracts(id) ON DELETE SET NULL,
      owner_user_id UUID,
      assigned_to_user_id UUID,
      status TEXT NOT NULL DEFAULT 'open',
      priority TEXT NOT NULL DEFAULT 'medium',
      due_date DATE,
      completed_at TIMESTAMPTZ,
      archived_at TIMESTAMPTZ,
      metadata JSONB,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".paperwork_items (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      dossier_id UUID NOT NULL REFERENCES "${s}".paperwork_dossiers(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'document',
      is_required BOOLEAN NOT NULL DEFAULT true,
      status TEXT NOT NULL DEFAULT 'missing',
      assigned_to_user_id UUID,
      due_date DATE,
      linked_document_id UUID,
      notes TEXT,
      metadata JSONB,
      completed_at TIMESTAMPTZ,
      completed_by UUID,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".paperwork_activity (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      dossier_id UUID REFERENCES "${s}".paperwork_dossiers(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      actor_user_id UUID,
      entity_type TEXT,
      entity_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_contract_templates_slug_active" ON "${s}".contract_templates(slug) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_contracts_number_active" ON "${s}".contracts(contract_number) WHERE deleted_at IS NULL`);

  const indexStatements = [
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_templates_category" ON "${s}".contract_templates(category) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_templates_active" ON "${s}".contract_templates(is_active) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_company" ON "${s}".contracts(company_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_contact" ON "${s}".contracts(contact_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_quote" ON "${s}".contracts(quote_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_project" ON "${s}".contracts(project_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_opportunity" ON "${s}".contracts(opportunity_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_owner" ON "${s}".contracts(owner_user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_assigned" ON "${s}".contracts(assigned_to_user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_status" ON "${s}".contracts(status) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_signature" ON "${s}".contracts(signature_status) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_type" ON "${s}".contracts(contract_type) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_due" ON "${s}".contracts(due_date) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contracts_renewal" ON "${s}".contracts(renewal_date) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_versions_contract" ON "${s}".contract_versions(contract_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_versions_status" ON "${s}".contract_versions(status) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_signers_contract" ON "${s}".contract_signers(contract_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_signers_type" ON "${s}".contract_signers(signer_type) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_signers_status" ON "${s}".contract_signers(status) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_signers_email" ON "${s}".contract_signers(lower(email)) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_checklist_contract" ON "${s}".contract_checklist_items(contract_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_checklist_category" ON "${s}".contract_checklist_items(category) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_checklist_status" ON "${s}".contract_checklist_items(status) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_checklist_assigned" ON "${s}".contract_checklist_items(assigned_to_user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_checklist_due" ON "${s}".contract_checklist_items(due_date) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_checklist_document" ON "${s}".contract_checklist_items(linked_document_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_activity_contract" ON "${s}".contract_activity(contract_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_activity_action" ON "${s}".contract_activity(action)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_activity_actor" ON "${s}".contract_activity(actor_user_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_contract_activity_created" ON "${s}".contract_activity(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_dossiers_type" ON "${s}".paperwork_dossiers(dossier_type) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_dossiers_company" ON "${s}".paperwork_dossiers(company_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_dossiers_quote" ON "${s}".paperwork_dossiers(quote_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_dossiers_project" ON "${s}".paperwork_dossiers(project_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_dossiers_contract" ON "${s}".paperwork_dossiers(contract_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_dossiers_owner" ON "${s}".paperwork_dossiers(owner_user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_dossiers_assigned" ON "${s}".paperwork_dossiers(assigned_to_user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_dossiers_status" ON "${s}".paperwork_dossiers(status) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_dossiers_due" ON "${s}".paperwork_dossiers(due_date) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_items_dossier" ON "${s}".paperwork_items(dossier_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_items_category" ON "${s}".paperwork_items(category) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_items_status" ON "${s}".paperwork_items(status) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_items_assigned" ON "${s}".paperwork_items(assigned_to_user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_items_due" ON "${s}".paperwork_items(due_date) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_items_document" ON "${s}".paperwork_items(linked_document_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_activity_dossier" ON "${s}".paperwork_activity(dossier_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_activity_action" ON "${s}".paperwork_activity(action)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_activity_actor" ON "${s}".paperwork_activity(actor_user_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_paperwork_activity_created" ON "${s}".paperwork_activity(created_at DESC)`,
  ];
  for (const statement of indexStatements) await ds.query(statement);
}

export async function seedDoflowContractTemplates(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'seedDoflowContractTemplates');
  await ensureTenantContractsTables(ds, s);

  for (const template of BASE_CONTRACT_TEMPLATES) {
    const existing = await ds.query(
      `SELECT id FROM "${s}".contract_templates WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
      [template.slug],
    );
    const params = [
      template.name,
      template.slug,
      template.category,
      template.description,
      template.bodyMarkdown,
      JSON.stringify(DEFAULT_TEMPLATE_VARIABLES),
      JSON.stringify(DEFAULT_CONTRACT_CHECKLIST),
      'v1 operativo',
    ];
    if (existing[0]?.id) {
      await ds.query(
        `UPDATE "${s}".contract_templates
         SET name = $1,
             category = $3,
             description = $4,
             body_markdown = $5,
             variables = $6::jsonb,
             default_checklist = $7::jsonb,
             is_active = true,
             version_label = $8,
             updated_at = now()
         WHERE id = $9`,
        [...params, existing[0].id],
      );
    } else {
      await ds.query(
        `INSERT INTO "${s}".contract_templates (
           name, slug, category, description, body_markdown, variables, default_checklist,
           is_active, version_label, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, true, $8, now(), now())`,
        params,
      );
    }
  }
}

export const STANDARD_PAPERWORK_ITEMS = [
  'Dati fatturazione',
  'PEC / SDI',
  'Contratto firmato',
  'Preventivo approvato',
  'Materiali iniziali',
  'Accessi tecnici se necessari',
  'Privacy/Cookie',
];

export const STANDARD_CONTRACT_CHECKLIST = DEFAULT_CONTRACT_CHECKLIST;
