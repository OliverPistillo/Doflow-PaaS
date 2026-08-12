import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

export async function ensureLeadIntakeSubmissionsTable(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureLeadIntakeSubmissionsTable');

  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".lead_intake_submissions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      submission_id UUID UNIQUE NOT NULL,
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      lead_id UUID NOT NULL REFERENCES "${s}".leads(id) ON DELETE RESTRICT,
      opportunity_id UUID NOT NULL REFERENCES "${s}".opportunities(id) ON DELETE RESTRICT,
      activity_id UUID REFERENCES "${s}".commercial_activities(id) ON DELETE SET NULL,
      source_origin TEXT,
      landing_url TEXT,
      attribution JSONB DEFAULT '{}'::jsonb,
      form_data JSONB NOT NULL DEFAULT '{}'::jsonb,
      privacy_accepted_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await ds.query(`
    ALTER TABLE "${s}".lead_intake_submissions
    ADD COLUMN IF NOT EXISTS form_data JSONB NOT NULL DEFAULT '{}'::jsonb
  `);

  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_lead_intake_submission_id" ON "${s}".lead_intake_submissions(submission_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_lead_intake_lead" ON "${s}".lead_intake_submissions(lead_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_lead_intake_opportunity" ON "${s}".lead_intake_submissions(opportunity_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_lead_intake_created" ON "${s}".lead_intake_submissions(created_at)`);
}
