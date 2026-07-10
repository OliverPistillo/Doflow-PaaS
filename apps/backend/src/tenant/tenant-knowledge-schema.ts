import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { BASE_ASSET_COLLECTIONS, BASE_KNOWLEDGE_CATEGORIES, BASE_OPERATIONAL_TEMPLATES } from './tenant-knowledge.types';

function slugify(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120) || 'item';
}

async function addColumns(ds: DataSource, schema: string, table: string, columns: string[]) {
  for (const column of columns) {
    await ds.query(`ALTER TABLE "${schema}"."${table}" ADD COLUMN IF NOT EXISTS ${column}`);
  }
}

export async function ensureTenantKnowledgeTables(ds: DataSource, schema: string) {
  const s = safeSchema(schema, 'ensureTenantKnowledgeTables');

  await ds.query(`CREATE EXTENSION IF NOT EXISTS "pgcrypto"`);
  await ds.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".knowledge_categories (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      parent_id UUID REFERENCES "${s}".knowledge_categories(id) ON DELETE SET NULL,
      icon TEXT,
      color TEXT,
      sort_order INTEGER NOT NULL DEFAULT 0,
      visibility TEXT NOT NULL DEFAULT 'team',
      is_system BOOLEAN NOT NULL DEFAULT false,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);
  await addColumns(ds, s, 'knowledge_categories', [
    'name TEXT',
    'slug TEXT',
    'description TEXT',
    'parent_id UUID',
    'icon TEXT',
    'color TEXT',
    'sort_order INTEGER NOT NULL DEFAULT 0',
    "visibility TEXT NOT NULL DEFAULT 'team'",
    'is_system BOOLEAN NOT NULL DEFAULT false',
    'created_by UUID',
    'created_at TIMESTAMPTZ DEFAULT now()',
    'updated_at TIMESTAMPTZ DEFAULT now()',
    'deleted_at TIMESTAMPTZ',
  ]);
  await ds.query(`ALTER TABLE "${s}".knowledge_categories ALTER COLUMN name SET NOT NULL`);
  await ds.query(`ALTER TABLE "${s}".knowledge_categories ALTER COLUMN slug SET NOT NULL`);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".knowledge_tags (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      color TEXT,
      description TEXT,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".knowledge_articles (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      category_id UUID REFERENCES "${s}".knowledge_categories(id) ON DELETE SET NULL,
      title TEXT NOT NULL,
      slug TEXT NOT NULL,
      excerpt TEXT,
      content TEXT NOT NULL DEFAULT '',
      content_format TEXT NOT NULL DEFAULT 'markdown',
      article_type TEXT NOT NULL DEFAULT 'article',
      status TEXT NOT NULL DEFAULT 'draft',
      visibility TEXT NOT NULL DEFAULT 'team',
      priority TEXT NOT NULL DEFAULT 'medium',
      owner_user_id UUID,
      created_by UUID,
      updated_by UUID,
      published_at TIMESTAMPTZ,
      archived_at TIMESTAMPTZ,
      review_due_at TIMESTAMPTZ,
      last_reviewed_at TIMESTAMPTZ,
      last_reviewed_by UUID,
      view_count INTEGER NOT NULL DEFAULT 0,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".knowledge_article_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id UUID NOT NULL REFERENCES "${s}".knowledge_articles(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT,
      content TEXT NOT NULL DEFAULT '',
      content_format TEXT NOT NULL DEFAULT 'markdown',
      change_summary TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(article_id, version_number)
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".knowledge_article_tags (
      article_id UUID NOT NULL REFERENCES "${s}".knowledge_articles(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES "${s}".knowledge_tags(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY(article_id, tag_id)
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".knowledge_article_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      article_id UUID NOT NULL REFERENCES "${s}".knowledge_articles(id) ON DELETE CASCADE,
      entity_type TEXT NOT NULL,
      entity_id UUID NOT NULL,
      relation_type TEXT NOT NULL DEFAULT 'related',
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(article_id, entity_type, entity_id, relation_type)
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".knowledge_favorites (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      target_type TEXT NOT NULL,
      target_id UUID NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(user_id, target_type, target_id)
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".asset_collections (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      visibility TEXT NOT NULL DEFAULT 'team',
      sort_order INTEGER NOT NULL DEFAULT 0,
      is_system BOOLEAN NOT NULL DEFAULT false,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".asset_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      collection_id UUID REFERENCES "${s}".asset_collections(id) ON DELETE SET NULL,
      document_id UUID,
      name TEXT NOT NULL,
      description TEXT,
      asset_type TEXT NOT NULL DEFAULT 'document',
      status TEXT NOT NULL DEFAULT 'active',
      visibility TEXT NOT NULL DEFAULT 'team',
      external_url TEXT,
      mime_type TEXT,
      file_size_bytes BIGINT,
      version TEXT,
      owner_user_id UUID,
      created_by UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      archived_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".asset_item_tags (
      asset_id UUID NOT NULL REFERENCES "${s}".asset_items(id) ON DELETE CASCADE,
      tag_id UUID NOT NULL REFERENCES "${s}".knowledge_tags(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY(asset_id, tag_id)
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".operational_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name TEXT NOT NULL,
      slug TEXT NOT NULL,
      description TEXT,
      template_type TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'operations',
      status TEXT NOT NULL DEFAULT 'draft',
      visibility TEXT NOT NULL DEFAULT 'team',
      content JSONB NOT NULL DEFAULT '{}'::jsonb,
      variables JSONB,
      instructions TEXT,
      owner_user_id UUID,
      created_by UUID,
      updated_by UUID,
      usage_count INTEGER NOT NULL DEFAULT 0,
      last_used_at TIMESTAMPTZ,
      is_system BOOLEAN NOT NULL DEFAULT false,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now(),
      updated_at TIMESTAMPTZ DEFAULT now(),
      archived_at TIMESTAMPTZ,
      deleted_at TIMESTAMPTZ
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".operational_template_versions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL REFERENCES "${s}".operational_templates(id) ON DELETE CASCADE,
      version_number INTEGER NOT NULL,
      content JSONB NOT NULL DEFAULT '{}'::jsonb,
      variables JSONB,
      instructions TEXT,
      change_summary TEXT,
      created_by UUID,
      created_at TIMESTAMPTZ DEFAULT now(),
      UNIQUE(template_id, version_number)
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".operational_template_usage (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      template_id UUID NOT NULL REFERENCES "${s}".operational_templates(id) ON DELETE CASCADE,
      target_entity_type TEXT,
      target_entity_id UUID,
      action TEXT NOT NULL DEFAULT 'used',
      actor_user_id UUID,
      result_payload JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await ds.query(`
    CREATE TABLE IF NOT EXISTS "${s}".knowledge_activity (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      action TEXT NOT NULL,
      target_type TEXT,
      target_id UUID,
      actor_user_id UUID,
      entity_type TEXT,
      entity_id UUID,
      metadata JSONB,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  const indexes = [
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_categories_slug" ON "${s}".knowledge_categories(slug) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_categories_parent" ON "${s}".knowledge_categories(parent_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_categories_visibility" ON "${s}".knowledge_categories(visibility) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_categories_sort" ON "${s}".knowledge_categories(sort_order) WHERE deleted_at IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_knowledge_categories_slug" ON "${s}".knowledge_categories(slug) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_tags_slug" ON "${s}".knowledge_tags(slug) WHERE deleted_at IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_knowledge_tags_slug" ON "${s}".knowledge_tags(slug) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_articles_category" ON "${s}".knowledge_articles(category_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_articles_slug" ON "${s}".knowledge_articles(slug) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_articles_type" ON "${s}".knowledge_articles(article_type) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_articles_status" ON "${s}".knowledge_articles(status) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_articles_visibility" ON "${s}".knowledge_articles(visibility) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_articles_priority" ON "${s}".knowledge_articles(priority) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_articles_owner" ON "${s}".knowledge_articles(owner_user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_articles_published" ON "${s}".knowledge_articles(published_at) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_articles_review_due" ON "${s}".knowledge_articles(review_due_at) WHERE deleted_at IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_knowledge_articles_slug" ON "${s}".knowledge_articles(slug) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_article_versions_article" ON "${s}".knowledge_article_versions(article_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_article_versions_version" ON "${s}".knowledge_article_versions(version_number)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_article_versions_created" ON "${s}".knowledge_article_versions(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_article_tags_tag" ON "${s}".knowledge_article_tags(tag_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_article_links_article" ON "${s}".knowledge_article_links(article_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_article_links_entity" ON "${s}".knowledge_article_links(entity_type, entity_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_article_links_relation" ON "${s}".knowledge_article_links(relation_type)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_favorites_user" ON "${s}".knowledge_favorites(user_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_favorites_target" ON "${s}".knowledge_favorites(target_type, target_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_asset_collections_slug" ON "${s}".asset_collections(slug) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_asset_collections_visibility" ON "${s}".asset_collections(visibility) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_asset_collections_sort" ON "${s}".asset_collections(sort_order) WHERE deleted_at IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_asset_collections_slug" ON "${s}".asset_collections(slug) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_asset_items_collection" ON "${s}".asset_items(collection_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_asset_items_document" ON "${s}".asset_items(document_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_asset_items_type" ON "${s}".asset_items(asset_type) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_asset_items_status" ON "${s}".asset_items(status) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_asset_items_visibility" ON "${s}".asset_items(visibility) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_asset_items_owner" ON "${s}".asset_items(owner_user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_asset_items_created" ON "${s}".asset_items(created_at DESC) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_asset_item_tags_tag" ON "${s}".asset_item_tags(tag_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_templates_slug" ON "${s}".operational_templates(slug) WHERE deleted_at IS NULL`,
    `CREATE UNIQUE INDEX IF NOT EXISTS "uq_${s}_operational_templates_slug" ON "${s}".operational_templates(slug) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_templates_type" ON "${s}".operational_templates(template_type) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_templates_category" ON "${s}".operational_templates(category) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_templates_status" ON "${s}".operational_templates(status) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_templates_visibility" ON "${s}".operational_templates(visibility) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_templates_owner" ON "${s}".operational_templates(owner_user_id) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_templates_system" ON "${s}".operational_templates(is_system) WHERE deleted_at IS NULL`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_template_versions_template" ON "${s}".operational_template_versions(template_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_template_versions_created" ON "${s}".operational_template_versions(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_template_usage_template" ON "${s}".operational_template_usage(template_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_template_usage_target" ON "${s}".operational_template_usage(target_entity_type, target_entity_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_template_usage_action" ON "${s}".operational_template_usage(action)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_template_usage_actor" ON "${s}".operational_template_usage(actor_user_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_operational_template_usage_created" ON "${s}".operational_template_usage(created_at DESC)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_activity_action" ON "${s}".knowledge_activity(action)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_activity_target" ON "${s}".knowledge_activity(target_type, target_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_activity_actor" ON "${s}".knowledge_activity(actor_user_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_activity_entity" ON "${s}".knowledge_activity(entity_type, entity_id)`,
    `CREATE INDEX IF NOT EXISTS "idx_${s}_knowledge_activity_created" ON "${s}".knowledge_activity(created_at DESC)`,
  ];
  for (const sql of indexes) await ds.query(sql);
}

export async function seedTenantKnowledgeBase(ds: DataSource, schema: string, createdBy?: string | null) {
  const s = safeSchema(schema, 'seedTenantKnowledgeBase');
  await ensureTenantKnowledgeTables(ds, s);
  const actor = createdBy || null;

  let sort = 0;
  for (const name of BASE_KNOWLEDGE_CATEGORIES) {
    const slug = slugify(name);
    const existing = await ds.query(`SELECT id FROM "${s}".knowledge_categories WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [slug]);
    if (existing[0]) {
      await ds.query(
        `UPDATE "${s}".knowledge_categories
         SET name = $1, visibility = 'team', is_system = true, sort_order = $2, updated_at = now()
         WHERE id = $3`,
        [name, sort, existing[0].id],
      );
    } else {
      await ds.query(
        `INSERT INTO "${s}".knowledge_categories (name, slug, visibility, is_system, sort_order, created_by, created_at, updated_at)
         VALUES ($1, $2, 'team', true, $3, $4, now(), now())`,
        [name, slug, sort, actor],
      );
    }
    sort += 10;
  }

  sort = 0;
  for (const name of BASE_ASSET_COLLECTIONS) {
    const slug = slugify(name);
    const existing = await ds.query(`SELECT id FROM "${s}".asset_collections WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [slug]);
    if (existing[0]) {
      await ds.query(
        `UPDATE "${s}".asset_collections
         SET name = $1, visibility = 'team', is_system = true, sort_order = $2, updated_at = now()
         WHERE id = $3`,
        [name, sort, existing[0].id],
      );
    } else {
      await ds.query(
        `INSERT INTO "${s}".asset_collections (name, slug, visibility, is_system, sort_order, created_by, created_at, updated_at)
         VALUES ($1, $2, 'team', true, $3, $4, now(), now())`,
        [name, slug, sort, actor],
      );
    }
    sort += 10;
  }

  for (const template of BASE_OPERATIONAL_TEMPLATES) {
    const existing = await ds.query(`SELECT id FROM "${s}".operational_templates WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`, [template.slug]);
    if (existing[0]) {
      await ds.query(
        `UPDATE "${s}".operational_templates
         SET name = $1,
             template_type = $2,
             category = $3,
             status = 'active',
             visibility = 'team',
             content = $4::jsonb,
             is_system = true,
             updated_at = now()
         WHERE id = $5`,
        [template.name, template.template_type, template.category, JSON.stringify(template.content), existing[0].id],
      );
    } else {
      await ds.query(
        `INSERT INTO "${s}".operational_templates (
           name, slug, template_type, category, status, visibility, content, is_system, created_by, created_at, updated_at
         ) VALUES ($1, $2, $3, $4, 'active', 'team', $5::jsonb, true, $6, now(), now())`,
        [template.name, template.slug, template.template_type, template.category, JSON.stringify(template.content), actor],
      );
    }
  }
}
