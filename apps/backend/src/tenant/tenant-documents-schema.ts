import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

const BASE_FOLDERS = [
  'Clienti',
  'Preventivi',
  'Progetti',
  'Briefing',
  'Finance',
  'Contratti',
  'Asset Brand',
  'Legale',
  'Archivio',
];

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export async function ensureTenantDocumentsTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantDocumentsTables');

  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".document_folders (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      parent_id UUID,
      name TEXT NOT NULL,
      slug TEXT,
      description TEXT,
      entity_type TEXT,
      entity_id UUID,
      visibility TEXT NOT NULL DEFAULT 'internal',
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ,
      CONSTRAINT fk_document_folders_parent
        FOREIGN KEY (parent_id) REFERENCES "${s}".document_folders(id) ON DELETE SET NULL
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_folders_parent" ON "${s}".document_folders(parent_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_folders_entity" ON "${s}".document_folders(entity_type, entity_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_folders_visibility" ON "${s}".document_folders(visibility) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_folders_deleted" ON "${s}".document_folders(deleted_at)`);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_document_folders_root_slug_unique" ON "${s}".document_folders(slug) WHERE parent_id IS NULL AND slug IS NOT NULL AND deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".documents (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      folder_id UUID REFERENCES "${s}".document_folders(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      description TEXT,
      original_filename TEXT NOT NULL,
      stored_filename TEXT,
      mime_type TEXT,
      size_bytes BIGINT,
      storage_provider TEXT NOT NULL DEFAULT 'minio',
      storage_bucket TEXT,
      storage_key TEXT NOT NULL,
      checksum TEXT,
      category TEXT NOT NULL DEFAULT 'generic',
      visibility TEXT NOT NULL DEFAULT 'internal',
      status TEXT NOT NULL DEFAULT 'active',
      entity_type TEXT,
      entity_id UUID,
      uploaded_by UUID,
      metadata JSONB,
      version_group_id UUID,
      version_number INTEGER NOT NULL DEFAULT 1,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_documents_folder" ON "${s}".documents(folder_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_documents_entity" ON "${s}".documents(entity_type, entity_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_documents_category" ON "${s}".documents(category) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_documents_visibility" ON "${s}".documents(visibility) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_documents_status" ON "${s}".documents(status) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_documents_uploaded_by" ON "${s}".documents(uploaded_by) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_documents_version_group" ON "${s}".documents(version_group_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_documents_created" ON "${s}".documents(created_at DESC) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_documents_deleted" ON "${s}".documents(deleted_at)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".document_links (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      document_id UUID NOT NULL REFERENCES "${s}".documents(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'attachment',
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE UNIQUE INDEX IF NOT EXISTS "idx_${s}_document_links_unique_active" ON "${s}".document_links(document_id, entity_type, entity_id, relation_type) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_links_document" ON "${s}".document_links(document_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_links_entity" ON "${s}".document_links(entity_type, entity_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_links_relation" ON "${s}".document_links(relation_type) WHERE deleted_at IS NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".document_activity (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      document_id UUID REFERENCES "${s}".documents(id) ON DELETE SET NULL,
      action TEXT NOT NULL,
      actor_user_id UUID,
      entity_type TEXT,
      entity_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_activity_document" ON "${s}".document_activity(document_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_activity_actor" ON "${s}".document_activity(actor_user_id)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_activity_action" ON "${s}".document_activity(action)`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_activity_created" ON "${s}".document_activity(created_at DESC)`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".document_shares (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      document_id UUID NOT NULL REFERENCES "${s}".documents(id) ON DELETE CASCADE,
      share_type TEXT NOT NULL DEFAULT 'internal_link',
      token_hash TEXT,
      expires_at TIMESTAMPTZ,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      revoked_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    )
  `);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_shares_document" ON "${s}".document_shares(document_id) WHERE deleted_at IS NULL`);
  await ds.query(`CREATE INDEX IF NOT EXISTS "idx_${s}_document_shares_token" ON "${s}".document_shares(token_hash) WHERE token_hash IS NOT NULL AND deleted_at IS NULL`);
}

export async function seedDoflowDocumentFolders(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'seedDoflowDocumentFolders');
  await ensureTenantDocumentsTables(ds, s);

  for (const name of BASE_FOLDERS) {
    await ds.query(
      `INSERT INTO "${s}".document_folders (name, slug, visibility, created_at, updated_at)
       SELECT $1, $2, $3, now(), now()
       WHERE NOT EXISTS (
         SELECT 1 FROM "${s}".document_folders
         WHERE parent_id IS NULL AND slug = $2 AND deleted_at IS NULL
       )`,
      [name, slugify(name), name === 'Finance' ? 'finance' : 'internal'],
    );
  }
}
