import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import {
  IMPORT_STATUSES,
  PROPOSAL_STATUSES,
  SITE_PROPOSALS_TENANT,
} from './tenant-site-proposals.constants';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';

const SITE_PROPOSALS_SCHEMA_LOCK = 'site-proposals-schema-v1';
const provisioningByDataSource = new WeakMap<DataSource, Map<string, Promise<void>>>();

export function ensureDoflowSiteProposalTables(ds: DataSource, schema: string): Promise<void> {
  const s = safeSchema(schema, 'ensureDoflowSiteProposalTables');
  if (s !== SITE_PROPOSALS_TENANT) {
    throw new Error('Site proposal tables are available only for doflow');
  }

  let provisioningBySchema = provisioningByDataSource.get(ds);
  if (!provisioningBySchema) {
    provisioningBySchema = new Map<string, Promise<void>>();
    provisioningByDataSource.set(ds, provisioningBySchema);
  }

  const existing = provisioningBySchema.get(s);
  if (existing) return existing;

  const provisioning = provisionDoflowSiteProposalTables(ds, s).catch((error) => {
    if (provisioningBySchema?.get(s) === provisioning) provisioningBySchema.delete(s);
    throw error;
  });
  provisioningBySchema.set(s, provisioning);
  return provisioning;
}

async function provisionDoflowSiteProposalTables(ds: DataSource, s: string): Promise<void> {
  const runner = ds.createQueryRunner();
  let provisioningFailed = false;

  try {
    await runner.connect();
    await runner.startTransaction();
    await runner.query(
      'SELECT pg_advisory_xact_lock(hashtext($1), hashtext($2))',
      [SITE_PROPOSALS_TENANT, SITE_PROPOSALS_SCHEMA_LOCK],
    );

    await runner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

    await runner.query(`
    CREATE TABLE IF NOT EXISTS "${s}".site_proposal_templates (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      slug TEXT NOT NULL,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      schema_version TEXT NOT NULL,
      category_tags TEXT[] NOT NULL DEFAULT '{}'::text[],
      manifest JSONB NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (slug, version)
    )
  `);

    await runner.query(`
    CREATE TABLE IF NOT EXISTS "${s}".site_proposal_import_batches (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      template_slug TEXT NOT NULL,
      template_version TEXT NOT NULL,
      original_filename TEXT NOT NULL,
      content_type TEXT,
      source_sha256 TEXT NOT NULL,
      status TEXT NOT NULL,
      row_count INTEGER NOT NULL DEFAULT 0,
      valid_count INTEGER NOT NULL DEFAULT 0,
      invalid_count INTEGER NOT NULL DEFAULT 0,
      rows JSONB NOT NULL DEFAULT '[]'::jsonb,
      errors JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      confirmed_at TIMESTAMPTZ,
      generated_at TIMESTAMPTZ,
      CONSTRAINT site_proposal_import_batches_status_chk CHECK (status = ANY ('{${IMPORT_STATUSES.join(',')}}'::text[]))
    )
  `);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_import_batches_status" ON "${s}".site_proposal_import_batches(status)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_import_batches_created_at" ON "${s}".site_proposal_import_batches(created_at)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_import_batches_source_sha256" ON "${s}".site_proposal_import_batches(source_sha256)`);

    await runner.query(`
    CREATE TABLE IF NOT EXISTS "${s}".site_proposals (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      import_batch_id UUID REFERENCES "${s}".site_proposal_import_batches(id) ON DELETE SET NULL,
      source_row_index INTEGER,
      source_row_hash TEXT,
      fingerprint TEXT,
      template_slug TEXT NOT NULL,
      template_version TEXT NOT NULL,
      status TEXT NOT NULL,
      display_name TEXT NOT NULL,
      company_id UUID REFERENCES "${s}".companies(id) ON DELETE SET NULL,
      contact_id UUID REFERENCES "${s}".contacts(id) ON DELETE SET NULL,
      lead_id UUID REFERENCES "${s}".leads(id) ON DELETE SET NULL,
      opportunity_id UUID REFERENCES "${s}".opportunities(id) ON DELETE SET NULL,
      source_data JSONB NOT NULL,
      site_config JSONB NOT NULL,
      validation_warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
      commercial_analysis JSONB NOT NULL DEFAULT '{}'::jsonb,
      email_subject TEXT,
      email_body TEXT,
      current_version INTEGER NOT NULL DEFAULT 1,
      last_generated_at TIMESTAMPTZ,
      created_by UUID,
      updated_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT site_proposals_status_chk CHECK (status = ANY ('{${PROPOSAL_STATUSES.join(',')}}'::text[]))
    )
  `);
    await runner.query(`CREATE UNIQUE INDEX IF NOT EXISTS "uidx_${s}_site_proposals_import_row" ON "${s}".site_proposals(import_batch_id, source_row_index) WHERE import_batch_id IS NOT NULL AND source_row_index IS NOT NULL`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposals_status" ON "${s}".site_proposals(status)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposals_import_batch" ON "${s}".site_proposals(import_batch_id)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposals_company" ON "${s}".site_proposals(company_id)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposals_fingerprint" ON "${s}".site_proposals(fingerprint)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposals_updated_at" ON "${s}".site_proposals(updated_at)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposals_deleted_at" ON "${s}".site_proposals(deleted_at)`);
    await runner.query(`ALTER TABLE "${s}".site_proposals ADD COLUMN IF NOT EXISTS archived_from_status TEXT`);

    await runner.query(`
    CREATE TABLE IF NOT EXISTS "${s}".site_proposal_versions (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      proposal_id UUID NOT NULL REFERENCES "${s}".site_proposals(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      site_config JSONB NOT NULL,
      commercial_analysis JSONB NOT NULL,
      email_subject TEXT,
      email_body TEXT,
      reason TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE (proposal_id, version)
    )
  `);

    await runner.query(`
    CREATE TABLE IF NOT EXISTS "${s}".site_proposal_generations (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      proposal_id UUID NOT NULL REFERENCES "${s}".site_proposals(id) ON DELETE CASCADE,
      proposal_version INTEGER NOT NULL,
      template_slug TEXT NOT NULL,
      template_version TEXT NOT NULL,
      status TEXT NOT NULL,
      html_key TEXT,
      zip_key TEXT,
      html_sha256 TEXT,
      zip_sha256 TEXT,
      html_size BIGINT,
      zip_size BIGINT,
      error_message TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      CONSTRAINT site_proposal_generations_status_chk CHECK (status = ANY ('{running,completed,failed}'::text[]))
    )
  `);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_generations_proposal" ON "${s}".site_proposal_generations(proposal_id)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_generations_status" ON "${s}".site_proposal_generations(status)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_generations_created_at" ON "${s}".site_proposal_generations(created_at)`);

    await runner.query(`
    CREATE TABLE IF NOT EXISTS "${s}".site_proposal_activity (
      id BIGSERIAL PRIMARY KEY,
      proposal_id UUID NOT NULL REFERENCES "${s}".site_proposals(id) ON DELETE CASCADE,
      action TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      actor_user_id UUID,
      actor_email TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_activity_proposal" ON "${s}".site_proposal_activity(proposal_id)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_activity_created_at" ON "${s}".site_proposal_activity(created_at)`);

    await runner.query(`ALTER TABLE "${s}".site_proposals ADD COLUMN IF NOT EXISTS personalization_status TEXT`);
    await runner.query(`ALTER TABLE "${s}".site_proposals ADD COLUMN IF NOT EXISTS latest_personalization_id UUID`);
    await runner.query(`ALTER TABLE "${s}".site_proposals ADD COLUMN IF NOT EXISTS last_personalized_at TIMESTAMPTZ`);
    await runner.query(`
      CREATE TABLE IF NOT EXISTS "${s}".site_proposal_personalizations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(), proposal_id UUID NOT NULL REFERENCES "${s}".site_proposals(id) ON DELETE CASCADE,
        status TEXT NOT NULL, provider TEXT, model TEXT, source_url TEXT, final_url TEXT, snapshot_hash TEXT,
        extracted_data JSONB, website_analysis JSONB, generated_content JSONB, brand_assets JSONB, warnings JSONB NOT NULL DEFAULT '[]'::jsonb,
        error_message TEXT, created_by UUID, started_at TIMESTAMPTZ, completed_at TIMESTAMPTZ, created_at TIMESTAMPTZ DEFAULT now()
      )`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_personalizations_proposal" ON "${s}".site_proposal_personalizations(proposal_id)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_personalizations_status" ON "${s}".site_proposal_personalizations(status)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_personalizations_snapshot" ON "${s}".site_proposal_personalizations(snapshot_hash)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_personalizations_created" ON "${s}".site_proposal_personalizations(created_at)`);

    await runner.query(`ALTER TABLE "${s}".site_proposals ADD COLUMN IF NOT EXISTS preparation_status TEXT DEFAULT 'idle'`);
    await runner.query(`ALTER TABLE "${s}".site_proposals ADD COLUMN IF NOT EXISTS preparation_error TEXT`);
    await runner.query(`ALTER TABLE "${s}".site_proposals ADD COLUMN IF NOT EXISTS preparation_queued_at TIMESTAMPTZ`);
    await runner.query(`ALTER TABLE "${s}".site_proposals ADD COLUMN IF NOT EXISTS preparation_started_at TIMESTAMPTZ`);
    await runner.query(`ALTER TABLE "${s}".site_proposals ADD COLUMN IF NOT EXISTS preparation_completed_at TIMESTAMPTZ`);
    await runner.query(`ALTER TABLE "${s}".site_proposals ADD COLUMN IF NOT EXISTS latest_preparation_job_id TEXT`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposals_preparation" ON "${s}".site_proposals(preparation_status)`);
    await runner.query(`
      UPDATE "${s}".site_proposals p
      SET preparation_status = CASE
        WHEN p.status = 'generated'
          AND length(trim(coalesce(p.email_subject,''))) >= 8
          AND length(trim(coalesce(p.email_body,''))) >= 250
          AND position('[LINK_DEMO]' in coalesce(p.email_body,'')) > 0
          AND length(trim(coalesce(p.commercial_analysis->>'summary',''))) >= 40
          AND EXISTS (SELECT 1 FROM "${s}".site_proposal_generations g WHERE g.proposal_id=p.id AND g.status='completed')
        THEN 'ready'
        ELSE 'idle'
      END
      WHERE p.preparation_status IS NULL
    `);

    await runner.query(`
      CREATE TABLE IF NOT EXISTS "${s}".site_proposal_themes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        slug TEXT UNIQUE NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        source_kind TEXT NOT NULL CHECK (source_kind IN ('builtin','uploaded')),
        is_active BOOLEAN NOT NULL DEFAULT true,
        default_version TEXT,
        categories JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_by UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_themes_slug" ON "${s}".site_proposal_themes(slug)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_themes_source" ON "${s}".site_proposal_themes(source_kind)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_themes_created" ON "${s}".site_proposal_themes(created_at)`);
    await runner.query(`
      CREATE TABLE IF NOT EXISTS "${s}".site_proposal_theme_versions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        theme_id UUID NOT NULL REFERENCES "${s}".site_proposal_themes(id) ON DELETE RESTRICT,
        version TEXT NOT NULL,
        schema_version TEXT NOT NULL,
        contract_version TEXT NOT NULL,
        content_profile TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('draft','active','disabled')),
        is_builtin BOOLEAN NOT NULL DEFAULT false,
        is_immutable BOOLEAN NOT NULL DEFAULT true,
        template_sha256 TEXT NOT NULL,
        template_size BIGINT NOT NULL,
        zip_sha256 TEXT,
        zip_size BIGINT,
        manifest JSONB NOT NULL,
        default_config JSONB NOT NULL,
        template_storage_key TEXT,
        zip_storage_key TEXT,
        validation_report JSONB,
        created_by UUID,
        activated_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE(theme_id, version)
      )
    `);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_theme_versions_status" ON "${s}".site_proposal_theme_versions(status)`);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_theme_versions_created" ON "${s}".site_proposal_theme_versions(created_at)`);
    await runner.query(`
      CREATE TABLE IF NOT EXISTS "${s}".site_proposal_theme_activity (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        theme_id UUID NOT NULL REFERENCES "${s}".site_proposal_themes(id) ON DELETE CASCADE,
        version_id UUID REFERENCES "${s}".site_proposal_theme_versions(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        actor_user_id UUID,
        actor_email TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )
    `);
    await runner.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_site_proposal_theme_activity_created" ON "${s}".site_proposal_theme_activity(created_at)`);

    const templateService = new TenantSiteProposalsTemplateService();
    const manifests = await templateService.getAllManifests();
    for (const { registration, manifest } of manifests) await runner.query(
      `
    INSERT INTO "${s}".site_proposal_templates
      (slug, name, version, schema_version, category_tags, manifest, is_active, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5::text[], $6::jsonb, true, now(), now())
    ON CONFLICT (slug, version) DO UPDATE
    SET name = EXCLUDED.name,
        schema_version = EXCLUDED.schema_version,
        category_tags = EXCLUDED.category_tags,
        manifest = "${s}".site_proposal_templates.manifest || EXCLUDED.manifest,
        is_active = true,
        updated_at = now()
      `,
      [
        registration.slug,
        registration.name,
        registration.version,
        registration.schemaVersion,
        registration.categoryTags,
        JSON.stringify(manifest),
      ],
    );

    for (const { registration, manifest } of manifests) {
      const defaultConfig = await templateService.getDefaultConfig(registration.slug, registration.version);
      const insertedThemes = await runner.query(`
        INSERT INTO "${s}".site_proposal_themes (slug,name,description,source_kind,is_active,default_version,categories)
        VALUES ($1,$2,'Tema integrato e versionato','builtin',true,$3,$4::jsonb)
        ON CONFLICT (slug) DO UPDATE SET name=EXCLUDED.name, categories=EXCLUDED.categories, updated_at=now()
        RETURNING id
      `, [registration.slug, registration.name, registration.slug === 'colsova' ? '2.4.1' : (registration.isLatest ? registration.version : null), JSON.stringify(registration.categoryTags)]);
      const themeId = insertedThemes[0]?.id || (await runner.query(`SELECT id FROM "${s}".site_proposal_themes WHERE slug=$1`, [registration.slug]))[0]?.id;
      await runner.query(`
        INSERT INTO "${s}".site_proposal_theme_versions
          (theme_id,version,schema_version,contract_version,content_profile,status,is_builtin,is_immutable,template_sha256,template_size,zip_sha256,zip_size,manifest,default_config,validation_report,activated_at)
        VALUES ($1,$2,$3,$4,$5,'active',true,true,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,now())
        ON CONFLICT (theme_id,version) DO UPDATE SET
          status='active', content_profile=EXCLUDED.content_profile, manifest=EXCLUDED.manifest,
          default_config=EXCLUDED.default_config, validation_report=EXCLUDED.validation_report
      `, [themeId, registration.version, registration.schemaVersion, registration.contractVersion, registration.contentProfile, registration.sourceSha256, registration.templateSize,
        registration.version === '2.4.1' ? 'bc9be4d9249e06ee113331b0890b8d3c4efc8140bbadcd237a1cd68040549ad6' : null,
        registration.version === '2.4.1' ? 1673508 : null,
        JSON.stringify(manifest), JSON.stringify(defaultConfig), JSON.stringify({ valid: true, builtin: true, contentProfile: registration.contentProfile })]);
    }

    await runner.commitTransaction();
  } catch (error) {
    provisioningFailed = true;
    if (runner.isTransactionActive) {
      try {
        await runner.rollbackTransaction();
      } catch {
        // Preserve the provisioning failure; rollback errors are secondary.
      }
    }
    throw error;
  } finally {
    try {
      await runner.release();
    } catch (error) {
      if (!provisioningFailed) throw error;
    }
  }
}
