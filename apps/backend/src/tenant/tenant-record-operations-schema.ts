import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantDocumentsTables } from './tenant-documents-schema';
import { ensureTenantProjectsTables } from './tenant-projects-schema';

export async function ensureDoflowRecordOperationsTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureDoflowRecordOperationsTables');
  await ensureTenantProjectsTables(ds, s);
  await ensureTenantDocumentsTables(ds, s);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".material_requests (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      opportunity_id UUID REFERENCES "${s}".opportunities(id) ON DELETE SET NULL,
      project_id UUID REFERENCES "${s}".projects(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT NOT NULL DEFAULT 'requested' CHECK (status IN ('requested', 'received', 'waived')),
      due_at TIMESTAMPTZ,
      requested_by UUID,
      received_document_id UUID REFERENCES "${s}".documents(id) ON DELETE SET NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ,
      CONSTRAINT material_requests_target_required CHECK (num_nonnulls(company_id, opportunity_id, project_id) >= 1)
    )
  `);

  const columns = [
    'company_id UUID',
    'opportunity_id UUID',
    'project_id UUID',
    'title TEXT',
    'description TEXT',
    "status TEXT NOT NULL DEFAULT 'requested'",
    'due_at TIMESTAMPTZ',
    'requested_by UUID',
    'received_document_id UUID',
    'created_at TIMESTAMPTZ NOT NULL DEFAULT now()',
    'updated_at TIMESTAMPTZ NOT NULL DEFAULT now()',
    'completed_at TIMESTAMPTZ',
  ];
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${s}".material_requests ADD COLUMN IF NOT EXISTS ${column}`);
  }

  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_material_requests_company" ON "${s}".material_requests(company_id, created_at DESC)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_material_requests_opportunity" ON "${s}".material_requests(opportunity_id, created_at DESC)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_material_requests_project" ON "${s}".material_requests(project_id, created_at DESC)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_material_requests_status" ON "${s}".material_requests(status, due_at)`);
}
