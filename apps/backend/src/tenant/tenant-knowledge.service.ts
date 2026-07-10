import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantKnowledgeTables, seedTenantKnowledgeBase } from './tenant-knowledge-schema';
import {
  FINANCE_KNOWLEDGE_CATEGORIES,
  FINANCE_KNOWLEDGE_ENTITIES,
  KNOWLEDGE_ACTIVITY_ACTIONS,
  KNOWLEDGE_ARTICLE_STATUSES,
  KNOWLEDGE_ARTICLE_TYPES,
  KNOWLEDGE_ASSET_STATUSES,
  KNOWLEDGE_ASSET_TYPES,
  KNOWLEDGE_CONTENT_FORMATS,
  KNOWLEDGE_ENTITY_TYPES,
  KNOWLEDGE_FAVORITE_TARGET_TYPES,
  KNOWLEDGE_PRIORITIES,
  KNOWLEDGE_RELATION_TYPES,
  KNOWLEDGE_VISIBILITIES,
  OPERATIONAL_TEMPLATE_CATEGORIES,
  OPERATIONAL_TEMPLATE_STATUSES,
  OPERATIONAL_TEMPLATE_TYPES,
  OPERATIONAL_TEMPLATE_USAGE_ACTIONS,
} from './tenant-knowledge.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ADMIN_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin']);
const READ_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin', 'manager', 'editor', 'user', 'viewer']);

type AuthUser = { id: string; email?: string; role: string };
type VisibilityFilter = { sql: string; params: unknown[] };

@Injectable()
export class TenantKnowledgeService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getUser(): AuthUser {
    const user = this.request?.user || this.request?.authUser;
    if (!user) throw new ForbiddenException('Utente non valido');
    return {
      id: String(user.sub || user.id || user.userId || ''),
      email: typeof user.email === 'string' ? user.email : undefined,
      role: String(user.role || 'user').toLowerCase().trim(),
    };
  }

  private getSchema(): string {
    const user = this.request?.user || this.request?.authUser;
    const tenantRef = user?.tenantId || user?.tenant_id || this.request?.tenantId;
    const schema = safeSchema(tenantRef || 'public', 'TenantKnowledgeService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Knowledge Base tenant non disponibile nel contesto public');
    return schema;
  }

  private async ensureSchema(schema: string) {
    await ensureTenantKnowledgeTables(this.dataSource, schema);
  }

  private isAdmin(role: string): boolean {
    return ADMIN_ROLES.has(String(role || '').toLowerCase());
  }

  private canRead(role: string): boolean {
    return READ_ROLES.has(String(role || '').toLowerCase());
  }

  private canManage(role: string): boolean {
    return this.isAdmin(role) || ['manager', 'editor', 'user'].includes(String(role || '').toLowerCase());
  }

  private canPublish(role: string): boolean {
    return this.isAdmin(role) || String(role || '').toLowerCase() === 'manager';
  }

  private canViewFinance(role: string): boolean {
    return this.isAdmin(role);
  }

  private assertRead(user = this.getUser()) {
    if (!this.canRead(user.role)) throw new ForbiddenException('Non hai accesso alla Knowledge Base.');
    return user;
  }

  private assertManage(user = this.getUser()) {
    if (!this.canManage(user.role)) throw new ForbiddenException('Non hai permessi per modificare la Knowledge Base.');
    return user;
  }

  private assertAdmin(user = this.getUser()) {
    if (!this.isAdmin(user.role)) throw new ForbiddenException('Operazione disponibile solo per owner/admin.');
    return user;
  }

  private requireUuid(value: unknown, label = 'ID'): string {
    const text = String(value || '');
    if (!UUID_RE.test(text)) throw new BadRequestException(`${label} non valido`);
    return text;
  }

  private requireEntityUuid(value: unknown, label = 'ID'): string {
    const id = this.requireUuid(value, label);
    if (id === '00000000-0000-0000-0000-000000000000') throw new BadRequestException(`${label} non valido`);
    return id;
  }

  private uuidOrNull(value: unknown): string | null {
    const text = String(value || '');
    return UUID_RE.test(text) ? text : null;
  }

  private textOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private slugify(value: unknown): string {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || 'item';
  }

  private normalizeLimit(value: unknown, fallback = 50): number {
    const n = Number(value || fallback);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(1, Math.min(200, Math.trunc(n)));
  }

  private normalizeOffset(value: unknown): number {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.trunc(n));
  }

  private normalizeEnum(value: unknown, allowed: readonly string[], fallback: string, label: string): string {
    const text = String(value || fallback).trim();
    if (!allowed.includes(text)) throw new BadRequestException(`${label} non valido`);
    return text;
  }

  private parseBool(value: unknown): boolean {
    return value === true || value === 'true' || value === '1' || value === 1;
  }

  private parseJsonObject(value: unknown, fallback: Record<string, unknown> | null = null): Record<string, unknown> | null {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    try {
      const parsed = JSON.parse(String(value));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      throw new BadRequestException('JSON non valido');
    }
    throw new BadRequestException('JSON deve essere un oggetto');
  }

  private parseJsonValue(value: unknown, fallback: unknown = null): unknown {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'object') return value;
    try {
      return JSON.parse(String(value));
    } catch {
      throw new BadRequestException('JSON non valido');
    }
  }

  private normalizeUrl(value: unknown): string | null {
    const text = this.textOrNull(value);
    if (!text) return null;
    try {
      const url = new URL(text);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocol');
      return url.toString();
    } catch {
      throw new BadRequestException('external_url non valida');
    }
  }

  private visibilityFilter(user: AuthUser, alias: string, startParam: number, ownerColumns: string[] = []): VisibilityFilter {
    const params: unknown[] = [];
    const privateChecks: string[] = [];
    if (this.isAdmin(user.role)) {
      return { sql: 'TRUE', params };
    }
    if (user.id && UUID_RE.test(user.id)) {
      params.push(user.id);
      for (const column of ownerColumns) privateChecks.push(`${alias}.${column} = $${startParam}`);
    }
    const privateSql = privateChecks.length > 0
      ? `(${alias}.visibility = 'private' AND (${privateChecks.join(' OR ')}))`
      : 'FALSE';
    return { sql: `(${alias}.visibility = 'team' OR ${privateSql})`, params };
  }

  private financeSql(user: AuthUser, alias: string, table: 'article' | 'asset' | 'template' | 'category' | 'collection') {
    if (this.canViewFinance(user.role)) return 'TRUE';
    if (table === 'template') return `${alias}.category <> 'finance'`;
    if (table === 'asset') return `COALESCE(${alias}.asset_type, '') NOT IN ('legal_document')`;
    if (table === 'article') return `NOT EXISTS (
      SELECT 1 FROM "${this.getSchema()}".knowledge_categories kc
      WHERE kc.id = ${alias}.category_id AND lower(kc.name) LIKE '%finance%' AND kc.deleted_at IS NULL
    )`;
    return `lower(COALESCE(${alias}.name, '')) NOT LIKE '%finance%'`;
  }

  private assertFinanceAllowed(user: AuthUser, payload: Record<string, any>) {
    if (this.canViewFinance(user.role)) return;
    const category = String(payload.category || '').toLowerCase();
    const entityType = String(payload.entity_type || payload.target_entity_type || '').toLowerCase();
    const collectionName = String(payload.collection_name || payload.name || '').toLowerCase();
    if (FINANCE_KNOWLEDGE_CATEGORIES.has(category) || FINANCE_KNOWLEDGE_ENTITIES.has(entityType) || collectionName.includes('finance')) {
      throw new ForbiddenException('Contenuti finance disponibili solo per owner/admin.');
    }
  }

  private async tableExists(schema: string, table: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1`,
      [schema, table],
    );
    return rows.length > 0;
  }

  private async logActivity(schema: string, action: string, payload: {
    targetType?: string | null;
    targetId?: string | null;
    actorUserId?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    metadata?: Record<string, unknown> | null;
  }) {
    await this.dataSource.query(
      `INSERT INTO "${schema}".knowledge_activity (
         action, target_type, target_id, actor_user_id, entity_type, entity_id, metadata, created_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, now())`,
      [
        action,
        payload.targetType || null,
        payload.targetId || null,
        payload.actorUserId || null,
        payload.entityType || null,
        payload.entityId || null,
        JSON.stringify(payload.metadata || {}),
      ],
    );
  }

  options() {
    return {
      article_types: KNOWLEDGE_ARTICLE_TYPES,
      article_statuses: KNOWLEDGE_ARTICLE_STATUSES,
      content_formats: KNOWLEDGE_CONTENT_FORMATS,
      visibilities: KNOWLEDGE_VISIBILITIES,
      priorities: KNOWLEDGE_PRIORITIES,
      entity_types: KNOWLEDGE_ENTITY_TYPES,
      relation_types: KNOWLEDGE_RELATION_TYPES,
      asset_types: KNOWLEDGE_ASSET_TYPES,
      asset_statuses: KNOWLEDGE_ASSET_STATUSES,
      template_types: OPERATIONAL_TEMPLATE_TYPES,
      template_categories: OPERATIONAL_TEMPLATE_CATEGORIES,
      template_statuses: OPERATIONAL_TEMPLATE_STATUSES,
      usage_actions: OPERATIONAL_TEMPLATE_USAGE_ACTIONS,
      activity_actions: KNOWLEDGE_ACTIVITY_ACTIONS,
    };
  }

  async summary() {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const articleVisibility = this.visibilityFilter(user, 'a', 1, ['owner_user_id', 'created_by']);
    const assetVisibility = this.visibilityFilter(user, 'ai', 1, ['owner_user_id', 'created_by']);
    const templateVisibility = this.visibilityFilter(user, 'ot', 1, ['owner_user_id', 'created_by']);
    const articleWhere = `a.deleted_at IS NULL AND ${articleVisibility.sql} AND ${this.financeSql(user, 'a', 'article')}`;
    const assetWhere = `ai.deleted_at IS NULL AND ${assetVisibility.sql} AND ${this.financeSql(user, 'ai', 'asset')}`;
    const templateWhere = `ot.deleted_at IS NULL AND ${templateVisibility.sql} AND ${this.financeSql(user, 'ot', 'template')}`;
    const articleRows = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'published')::int AS "publishedArticles",
         COUNT(*) FILTER (WHERE status = 'draft')::int AS "draftArticles",
         COUNT(*) FILTER (WHERE review_due_at IS NOT NULL AND review_due_at <= now() AND status <> 'archived')::int AS "articlesDueForReview",
         COUNT(*) FILTER (WHERE updated_at >= now() - interval '14 days')::int AS "recentlyUpdatedCount"
       FROM "${schema}".knowledge_articles a
       WHERE ${articleWhere}`,
      articleVisibility.params,
    );
    const assetRows = await this.dataSource.query(
      `SELECT COUNT(*)::int AS "totalAssets" FROM "${schema}".asset_items ai WHERE ${assetWhere}`,
      assetVisibility.params,
    );
    const templateRows = await this.dataSource.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'active')::int AS "activeTemplates",
         COUNT(*) FILTER (WHERE is_system = true)::int AS "systemTemplatesCount"
       FROM "${schema}".operational_templates ot
       WHERE ${templateWhere}`,
      templateVisibility.params,
    );
    const favoritesCount = UUID_RE.test(user.id)
      ? Number((await this.dataSource.query(`SELECT COUNT(*)::int AS count FROM "${schema}".knowledge_favorites WHERE user_id = $1`, [user.id]))[0]?.count || 0)
      : 0;
    const articlesDueForReview = Number(articleRows[0]?.articlesDueForReview || 0);
    return {
      publishedArticles: Number(articleRows[0]?.publishedArticles || 0),
      draftArticles: Number(articleRows[0]?.draftArticles || 0),
      articlesDueForReview,
      totalAssets: Number(assetRows[0]?.totalAssets || 0),
      activeTemplates: Number(templateRows[0]?.activeTemplates || 0),
      favoritesCount,
      recentlyUpdatedCount: Number(articleRows[0]?.recentlyUpdatedCount || 0),
      systemTemplatesCount: Number(templateRows[0]?.systemTemplatesCount || 0),
      knowledgeRisksCount: articlesDueForReview,
      sources: {
        knowledge_articles: true,
        asset_items: true,
        operational_templates: true,
        knowledge_favorites: true,
      },
    };
  }

  async listCategories(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const params: unknown[] = [];
    const where = ['c.deleted_at IS NULL'];
    const visibility = this.visibilityFilter(user, 'c', params.length + 1, ['created_by']);
    where.push(visibility.sql, this.financeSql(user, 'c', 'category'));
    params.push(...visibility.params);
    if (query.search) {
      params.push(`%${String(query.search).trim()}%`);
      where.push(`(c.name ILIKE $${params.length} OR COALESCE(c.description, '') ILIKE $${params.length})`);
    }
    const rows = await this.dataSource.query(
      `SELECT c.* FROM "${schema}".knowledge_categories c WHERE ${where.join(' AND ')} ORDER BY c.sort_order ASC, c.name ASC`,
      params,
    );
    return { items: rows };
  }

  async createCategory(body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('name obbligatorio');
    const visibility = this.normalizeEnum(body.visibility, KNOWLEDGE_VISIBILITIES, 'team', 'visibility');
    this.assertFinanceAllowed(user, { name, visibility });
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".knowledge_categories (
         name, slug, description, parent_id, icon, color, sort_order, visibility, is_system, created_by, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,false,$9,now(),now()) RETURNING *`,
      [
        name,
        this.textOrNull(body.slug) || this.slugify(name),
        this.textOrNull(body.description),
        body.parent_id ? this.requireUuid(body.parent_id, 'parent_id') : null,
        this.textOrNull(body.icon),
        this.textOrNull(body.color),
        Number(body.sort_order || 0),
        visibility,
        this.uuidOrNull(user.id),
      ],
    );
    await this.logActivity(schema, 'category_created', { targetType: 'category', targetId: rows[0].id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async getCategory(categoryId: string) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const visibility = this.visibilityFilter(user, 'c', 2, ['created_by']);
    const rows = await this.dataSource.query(
      `SELECT c.* FROM "${schema}".knowledge_categories c
       WHERE c.id = $1 AND c.deleted_at IS NULL AND ${visibility.sql} AND ${this.financeSql(user, 'c', 'category')} LIMIT 1`,
      [this.requireUuid(categoryId, 'categoryId'), ...visibility.params],
    );
    if (!rows[0]) throw new NotFoundException('Categoria non trovata');
    return rows[0];
  }

  async updateCategory(categoryId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const current = await this.getCategory(categoryId);
    const schema = this.getSchema();
    if (current.is_system && !this.isAdmin(user.role)) throw new ForbiddenException('Le categorie di sistema sono modificabili solo da owner/admin.');
    const name = this.textOrNull(body.name) || current.name;
    const visibility = body.visibility === undefined ? current.visibility : this.normalizeEnum(body.visibility, KNOWLEDGE_VISIBILITIES, 'team', 'visibility');
    this.assertFinanceAllowed(user, { name, visibility });
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".knowledge_categories
       SET name=$2, slug=$3, description=$4, parent_id=$5, icon=$6, color=$7, sort_order=$8, visibility=$9, updated_at=now()
       WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
      [
        current.id,
        name,
        this.textOrNull(body.slug) || current.slug,
        body.description === undefined ? current.description : this.textOrNull(body.description),
        body.parent_id === undefined ? current.parent_id : body.parent_id ? this.requireUuid(body.parent_id, 'parent_id') : null,
        body.icon === undefined ? current.icon : this.textOrNull(body.icon),
        body.color === undefined ? current.color : this.textOrNull(body.color),
        body.sort_order === undefined ? current.sort_order : Number(body.sort_order || 0),
        visibility,
      ],
    );
    await this.logActivity(schema, 'category_updated', { targetType: 'category', targetId: current.id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async deleteCategory(categoryId: string) {
    const user = this.assertManage();
    const current = await this.getCategory(categoryId);
    const schema = this.getSchema();
    if (current.is_system && !this.isAdmin(user.role)) throw new ForbiddenException('Le categorie di sistema sono eliminabili solo da owner/admin.');
    await this.dataSource.query(`UPDATE "${schema}".knowledge_categories SET deleted_at=now(), updated_at=now() WHERE id=$1`, [current.id]);
    await this.logActivity(schema, 'category_deleted', { targetType: 'category', targetId: current.id, actorUserId: this.uuidOrNull(user.id) });
    return { deleted: true };
  }

  async listTags(query: Record<string, any> = {}) {
    this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const params: unknown[] = [];
    const where = ['deleted_at IS NULL'];
    if (query.search) {
      params.push(`%${String(query.search).trim()}%`);
      where.push(`(name ILIKE $${params.length} OR COALESCE(description, '') ILIKE $${params.length})`);
    }
    const rows = await this.dataSource.query(`SELECT * FROM "${schema}".knowledge_tags WHERE ${where.join(' AND ')} ORDER BY name ASC`, params);
    return { items: rows };
  }

  async createTag(body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('name obbligatorio');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".knowledge_tags (name, slug, color, description, created_at, updated_at)
       VALUES ($1,$2,$3,$4,now(),now()) RETURNING *`,
      [name, this.textOrNull(body.slug) || this.slugify(name), this.textOrNull(body.color), this.textOrNull(body.description)],
    );
    await this.logActivity(schema, 'tag_created', { targetType: 'tag', targetId: rows[0].id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async updateTag(tagId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".knowledge_tags
       SET name=COALESCE($2,name), slug=COALESCE($3,slug), color=$4, description=$5, updated_at=now()
       WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
      [
        this.requireUuid(tagId, 'tagId'),
        this.textOrNull(body.name),
        this.textOrNull(body.slug),
        body.color === undefined ? null : this.textOrNull(body.color),
        body.description === undefined ? null : this.textOrNull(body.description),
      ],
    );
    if (!rows[0]) throw new NotFoundException('Tag non trovato');
    await this.logActivity(schema, 'tag_updated', { targetType: 'tag', targetId: rows[0].id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async deleteTag(tagId: string) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".knowledge_tags SET deleted_at=now(), updated_at=now() WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
      [this.requireUuid(tagId, 'tagId')],
    );
    if (!rows[0]) throw new NotFoundException('Tag non trovato');
    await this.logActivity(schema, 'tag_deleted', { targetType: 'tag', targetId: rows[0].id, actorUserId: this.uuidOrNull(user.id) });
    return { deleted: true };
  }

  private buildArticleWhere(schema: string, user: AuthUser, query: Record<string, any> = {}, alias = 'a') {
    const params: unknown[] = [];
    const where = [`${alias}.deleted_at IS NULL`];
    const visibility = this.visibilityFilter(user, alias, params.length + 1, ['owner_user_id', 'created_by']);
    where.push(visibility.sql, this.financeSql(user, alias, 'article'));
    params.push(...visibility.params);
    if (query.search) {
      params.push(`%${String(query.search).trim()}%`);
      where.push(`(${alias}.title ILIKE $${params.length} OR COALESCE(${alias}.excerpt,'') ILIKE $${params.length} OR COALESCE(${alias}.content,'') ILIKE $${params.length})`);
    }
    for (const field of ['category_id', 'owner_user_id']) {
      if (query[field]) {
        params.push(this.requireUuid(query[field], field));
        where.push(`${alias}.${field} = $${params.length}`);
      }
    }
    for (const [field, allowed] of [
      ['article_type', KNOWLEDGE_ARTICLE_TYPES],
      ['status', KNOWLEDGE_ARTICLE_STATUSES],
      ['visibility', KNOWLEDGE_VISIBILITIES],
      ['priority', KNOWLEDGE_PRIORITIES],
    ] as Array<[string, readonly string[]]>) {
      if (query[field]) {
        params.push(this.normalizeEnum(query[field], allowed, String(allowed[0]), field));
        where.push(`${alias}.${field} = $${params.length}`);
      }
    }
    if (query.tag_id) {
      params.push(this.requireUuid(query.tag_id, 'tag_id'));
      where.push(`EXISTS (SELECT 1 FROM "${schema}".knowledge_article_tags kat WHERE kat.article_id = ${alias}.id AND kat.tag_id = $${params.length})`);
    }
    if (this.parseBool(query.review_due)) where.push(`${alias}.review_due_at IS NOT NULL AND ${alias}.review_due_at <= now()`);
    return { where: where.join(' AND '), params };
  }

  async listArticles(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const filters = this.buildArticleWhere(schema, user, query);
    const rows = await this.dataSource.query(
      `SELECT a.*, c.name AS category_name
       FROM "${schema}".knowledge_articles a
       LEFT JOIN "${schema}".knowledge_categories c ON c.id = a.category_id
       WHERE ${filters.where}
       ORDER BY a.updated_at DESC, a.created_at DESC
       LIMIT $${filters.params.length + 1} OFFSET $${filters.params.length + 2}`,
      [...filters.params, limit, offset],
    );
    const total = Number((await this.dataSource.query(`SELECT COUNT(*)::int AS count FROM "${schema}".knowledge_articles a WHERE ${filters.where}`, filters.params))[0]?.count || 0);
    return { items: rows, total, limit, offset };
  }

  async getArticle(articleId: string) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const filters = this.buildArticleWhere(schema, user, {}, 'a');
    const rows = await this.dataSource.query(
      `SELECT a.*, c.name AS category_name
       FROM "${schema}".knowledge_articles a
       LEFT JOIN "${schema}".knowledge_categories c ON c.id = a.category_id
       WHERE a.id = $1 AND ${filters.where}
       LIMIT 1`,
      [this.requireUuid(articleId, 'articleId'), ...filters.params],
    );
    if (!rows[0]) throw new NotFoundException('Articolo non trovato');
    await this.dataSource.query(`UPDATE "${schema}".knowledge_articles SET view_count = view_count + 1 WHERE id = $1`, [rows[0].id]).catch(() => undefined);
    return rows[0];
  }

  private normalizeArticleInput(body: Record<string, any>, existing?: any) {
    const title = String(body.title ?? existing?.title ?? '').trim();
    if (!title) throw new BadRequestException('title obbligatorio');
    return {
      category_id: body.category_id === undefined ? existing?.category_id || null : body.category_id ? this.requireUuid(body.category_id, 'category_id') : null,
      title,
      slug: this.textOrNull(body.slug) || existing?.slug || this.slugify(title),
      excerpt: body.excerpt === undefined ? existing?.excerpt || null : this.textOrNull(body.excerpt),
      content: String(body.content ?? existing?.content ?? ''),
      content_format: this.normalizeEnum(body.content_format ?? existing?.content_format, KNOWLEDGE_CONTENT_FORMATS, 'markdown', 'content_format'),
      article_type: this.normalizeEnum(body.article_type ?? existing?.article_type, KNOWLEDGE_ARTICLE_TYPES, 'article', 'article_type'),
      status: this.normalizeEnum(body.status ?? existing?.status, KNOWLEDGE_ARTICLE_STATUSES, 'draft', 'status'),
      visibility: this.normalizeEnum(body.visibility ?? existing?.visibility, KNOWLEDGE_VISIBILITIES, 'team', 'visibility'),
      priority: this.normalizeEnum(body.priority ?? existing?.priority, KNOWLEDGE_PRIORITIES, 'medium', 'priority'),
      owner_user_id: body.owner_user_id === undefined ? existing?.owner_user_id || null : this.uuidOrNull(body.owner_user_id),
      review_due_at: body.review_due_at === undefined ? existing?.review_due_at || null : this.textOrNull(body.review_due_at),
      metadata: body.metadata === undefined ? existing?.metadata || null : this.parseJsonObject(body.metadata, {}),
    };
  }

  async createArticle(body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const input = this.normalizeArticleInput(body);
    this.assertFinanceAllowed(user, input);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".knowledge_articles (
         category_id, title, slug, excerpt, content, content_format, article_type, status,
         visibility, priority, owner_user_id, created_by, updated_by, review_due_at, metadata,
         published_at, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$12,$13,$14::jsonb,
         CASE WHEN $8 = 'published' THEN now() ELSE NULL END, now(), now()) RETURNING *`,
      [
        input.category_id,
        input.title,
        input.slug,
        input.excerpt,
        input.content,
        input.content_format,
        input.article_type,
        input.status,
        input.visibility,
        input.priority,
        input.owner_user_id || this.uuidOrNull(user.id),
        this.uuidOrNull(user.id),
        input.review_due_at,
        JSON.stringify(input.metadata || {}),
      ],
    );
    await this.createArticleVersionInternal(schema, rows[0], 1, body.change_summary || 'Versione iniziale', this.uuidOrNull(user.id));
    await this.logActivity(schema, 'article_created', { targetType: 'article', targetId: rows[0].id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async updateArticle(articleId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const current = await this.getArticle(articleId);
    const schema = this.getSchema();
    if (current.visibility === 'private' && !this.isAdmin(user.role) && current.created_by !== this.uuidOrNull(user.id) && current.owner_user_id !== this.uuidOrNull(user.id)) {
      throw new ForbiddenException('Puoi modificare solo i tuoi contenuti privati.');
    }
    const input = this.normalizeArticleInput(body, current);
    this.assertFinanceAllowed(user, input);
    const versionKeys = ['title', 'excerpt', 'content', 'content_format'] as const;
    const shouldVersion = versionKeys.some((key) => String(input[key] ?? '') !== String(current[key] ?? ''));
    await this.dataSource.query(
      `UPDATE "${schema}".knowledge_articles
       SET category_id=$2,title=$3,slug=$4,excerpt=$5,content=$6,content_format=$7,article_type=$8,status=$9,
           visibility=$10,priority=$11,owner_user_id=$12,updated_by=$13,review_due_at=$14,metadata=$15::jsonb,
           published_at=CASE WHEN $9='published' AND published_at IS NULL THEN now() ELSE published_at END,
           archived_at=CASE WHEN $9='archived' THEN now() ELSE archived_at END,
           updated_at=now()
       WHERE id=$1 AND deleted_at IS NULL`,
      [
        current.id,
        input.category_id,
        input.title,
        input.slug,
        input.excerpt,
        input.content,
        input.content_format,
        input.article_type,
        input.status,
        input.visibility,
        input.priority,
        input.owner_user_id,
        this.uuidOrNull(user.id),
        input.review_due_at,
        JSON.stringify(input.metadata || {}),
      ],
    );
    const updatedRows = await this.dataSource.query(
      `SELECT * FROM "${schema}".knowledge_articles WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [current.id],
    );
    if (!updatedRows[0]) throw new NotFoundException('Articolo non trovato dopo aggiornamento');
    if (shouldVersion) await this.createArticleVersionInternal(schema, updatedRows[0], null, body.change_summary || null, this.uuidOrNull(user.id));
    await this.logActivity(schema, 'article_updated', { targetType: 'article', targetId: current.id, actorUserId: this.uuidOrNull(user.id) });
    return updatedRows[0];
  }

  private async createArticleVersionInternal(schema: string, article: any, versionNumber: number | null, changeSummary: string | null, createdBy: string | null) {
    if (!article?.id) throw new BadRequestException('Articolo non valido per versioning');
    await this.dataSource.query(
      `INSERT INTO "${schema}".knowledge_article_versions (
         article_id, version_number, title, excerpt, content, content_format, change_summary, created_by, created_at
       )
       VALUES (
         $1,
         COALESCE($2::integer, (SELECT COALESCE(MAX(version_number), 0)::int + 1 FROM "${schema}".knowledge_article_versions WHERE article_id = $1)),
         $3,$4,$5,$6,$7,$8,now()
       )
       ON CONFLICT (article_id, version_number) DO NOTHING`,
      [article.id, versionNumber, article.title, article.excerpt || null, article.content || '', article.content_format || 'markdown', changeSummary || null, createdBy],
    );
    const versionRows = await this.dataSource.query(
      `SELECT COALESCE(MAX(version_number), 0)::int AS version FROM "${schema}".knowledge_article_versions WHERE article_id = $1`,
      [article.id],
    );
    const version = Number(versionRows[0]?.version || versionNumber || 0);
    await this.logActivity(schema, 'article_version_created', { targetType: 'article', targetId: article.id, actorUserId: createdBy, metadata: { version_number: version } });
  }

  async createArticleVersion(articleId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const article = await this.getArticle(articleId);
    const schema = this.getSchema();
    const snapshot = {
      ...article,
      title: this.textOrNull(body.title) || article.title,
      excerpt: body.excerpt === undefined ? article.excerpt : this.textOrNull(body.excerpt),
      content: String(body.content ?? article.content ?? ''),
      content_format: this.normalizeEnum(body.content_format ?? article.content_format, KNOWLEDGE_CONTENT_FORMATS, 'markdown', 'content_format'),
    };
    await this.createArticleVersionInternal(schema, snapshot, null, body.change_summary || null, this.uuidOrNull(user.id));
    return this.listArticleVersions(articleId);
  }

  async listArticleVersions(articleId: string) {
    await this.getArticle(articleId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".knowledge_article_versions WHERE article_id = $1 ORDER BY version_number DESC`,
      [this.requireUuid(articleId, 'articleId')],
    );
    return { items: rows };
  }

  async publishArticle(articleId: string) {
    const user = this.getUser();
    if (!this.canPublish(user.role)) throw new ForbiddenException('Non hai permessi per pubblicare articoli.');
    const schema = this.getSchema();
    const article = await this.getArticle(articleId);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".knowledge_articles SET status='published', published_at=COALESCE(published_at, now()), updated_by=$2, updated_at=now() WHERE id=$1 RETURNING *`,
      [article.id, this.uuidOrNull(user.id)],
    );
    await this.logActivity(schema, 'article_published', { targetType: 'article', targetId: article.id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async archiveArticle(articleId: string) {
    const user = this.assertManage();
    const schema = this.getSchema();
    const article = await this.getArticle(articleId);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".knowledge_articles SET status='archived', archived_at=now(), updated_by=$2, updated_at=now() WHERE id=$1 RETURNING *`,
      [article.id, this.uuidOrNull(user.id)],
    );
    await this.logActivity(schema, 'article_archived', { targetType: 'article', targetId: article.id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async reviewArticle(articleId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    const article = await this.getArticle(articleId);
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".knowledge_articles
       SET last_reviewed_at=now(), last_reviewed_by=$2, review_due_at=$3, updated_by=$2, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [article.id, this.uuidOrNull(user.id), body.review_due_at ? String(body.review_due_at) : article.review_due_at],
    );
    await this.logActivity(schema, 'article_reviewed', { targetType: 'article', targetId: article.id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async deleteArticle(articleId: string) {
    const user = this.assertManage();
    const article = await this.getArticle(articleId);
    const schema = this.getSchema();
    await this.dataSource.query(`UPDATE "${schema}".knowledge_articles SET deleted_at=now(), updated_at=now() WHERE id=$1`, [article.id]);
    await this.logActivity(schema, 'article_deleted', { targetType: 'article', targetId: article.id, actorUserId: this.uuidOrNull(user.id) });
    return { deleted: true };
  }

  async addArticleTag(articleId: string, tagId: string) {
    const user = this.assertManage();
    const article = await this.getArticle(articleId);
    const schema = this.getSchema();
    await this.dataSource.query(
      `INSERT INTO "${schema}".knowledge_article_tags (article_id, tag_id, created_at)
       VALUES ($1,$2,now()) ON CONFLICT DO NOTHING`,
      [article.id, this.requireUuid(tagId, 'tagId')],
    );
    return { success: true };
  }

  async removeArticleTag(articleId: string, tagId: string) {
    this.assertManage();
    const article = await this.getArticle(articleId);
    const schema = this.getSchema();
    await this.dataSource.query(`DELETE FROM "${schema}".knowledge_article_tags WHERE article_id=$1 AND tag_id=$2`, [article.id, this.requireUuid(tagId, 'tagId')]);
    return { success: true };
  }

  async listArticleLinks(articleId: string) {
    await this.getArticle(articleId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(`SELECT * FROM "${schema}".knowledge_article_links WHERE article_id=$1 ORDER BY created_at DESC`, [this.requireUuid(articleId, 'articleId')]);
    return { items: rows };
  }

  async createArticleLink(articleId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const article = await this.getArticle(articleId);
    const schema = this.getSchema();
    const entityType = this.normalizeEnum(body.entity_type, KNOWLEDGE_ENTITY_TYPES, '', 'entity_type');
    const relationType = this.normalizeEnum(body.relation_type, KNOWLEDGE_RELATION_TYPES, 'related', 'relation_type');
    const entityId = this.requireEntityUuid(body.entity_id, 'entity_id');
    this.assertFinanceAllowed(user, { entity_type: entityType });
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".knowledge_article_links (article_id, entity_type, entity_id, relation_type, metadata, created_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,now())
       ON CONFLICT (article_id, entity_type, entity_id, relation_type) DO UPDATE SET metadata = EXCLUDED.metadata
       RETURNING *`,
      [article.id, entityType, entityId, relationType, JSON.stringify(this.parseJsonObject(body.metadata, {}) || {})],
    );
    await this.logActivity(schema, 'article_linked', { targetType: 'article', targetId: article.id, actorUserId: this.uuidOrNull(user.id), entityType, entityId, metadata: { relation_type: relationType } });
    return rows[0];
  }

  async deleteArticleLink(articleId: string, linkId: string) {
    const user = this.assertManage();
    await this.getArticle(articleId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(`DELETE FROM "${schema}".knowledge_article_links WHERE id=$1 AND article_id=$2 RETURNING *`, [this.requireUuid(linkId, 'linkId'), this.requireUuid(articleId, 'articleId')]);
    if (!rows[0]) throw new NotFoundException('Collegamento non trovato');
    await this.logActivity(schema, 'article_unlinked', { targetType: 'article', targetId: articleId, actorUserId: this.uuidOrNull(user.id), entityType: rows[0].entity_type, entityId: rows[0].entity_id });
    return { deleted: true };
  }

  async exportArticle(articleId: string) {
    return {
      exportedAt: new Date().toISOString(),
      article: await this.getArticle(articleId),
      versions: await this.listArticleVersions(articleId),
      links: await this.listArticleLinks(articleId),
    };
  }

  async listFavorites() {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    if (!UUID_RE.test(user.id)) return { items: [] };
    const rows = await this.dataSource.query(`SELECT * FROM "${schema}".knowledge_favorites WHERE user_id=$1 ORDER BY created_at DESC`, [user.id]);
    return { items: rows };
  }

  async createFavorite(body: Record<string, any>) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const targetType = this.normalizeEnum(body.target_type, KNOWLEDGE_FAVORITE_TARGET_TYPES, 'article', 'target_type');
    const targetId = this.requireUuid(body.target_id, 'target_id');
    if (!UUID_RE.test(user.id)) throw new BadRequestException('Utente non valido');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".knowledge_favorites (user_id, target_type, target_id, created_at)
       VALUES ($1,$2,$3,now())
       ON CONFLICT (user_id, target_type, target_id) DO UPDATE SET created_at = EXCLUDED.created_at
       RETURNING *`,
      [user.id, targetType, targetId],
    );
    await this.logActivity(schema, 'favorite_added', { targetType, targetId, actorUserId: user.id });
    return rows[0];
  }

  async deleteFavorite(favoriteId: string) {
    const user = this.assertRead();
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `DELETE FROM "${schema}".knowledge_favorites WHERE id=$1 AND user_id=$2 RETURNING *`,
      [this.requireUuid(favoriteId, 'favoriteId'), this.requireUuid(user.id, 'user_id')],
    );
    if (!rows[0]) throw new NotFoundException('Preferito non trovato');
    await this.logActivity(schema, 'favorite_removed', { targetType: rows[0].target_type, targetId: rows[0].target_id, actorUserId: user.id });
    return { deleted: true };
  }

  async listAssetCollections(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const params: unknown[] = [];
    const visibility = this.visibilityFilter(user, 'ac', 1, ['created_by']);
    const where = [`ac.deleted_at IS NULL`, visibility.sql, this.financeSql(user, 'ac', 'collection')];
    params.push(...visibility.params);
    if (query.search) {
      params.push(`%${String(query.search).trim()}%`);
      where.push(`(ac.name ILIKE $${params.length} OR COALESCE(ac.description,'') ILIKE $${params.length})`);
    }
    const rows = await this.dataSource.query(`SELECT ac.* FROM "${schema}".asset_collections ac WHERE ${where.join(' AND ')} ORDER BY ac.sort_order ASC, ac.name ASC`, params);
    return { items: rows };
  }

  async getAssetCollection(collectionId: string) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const visibility = this.visibilityFilter(user, 'ac', 2, ['created_by']);
    const rows = await this.dataSource.query(
      `SELECT ac.* FROM "${schema}".asset_collections ac WHERE ac.id=$1 AND ac.deleted_at IS NULL AND ${visibility.sql} AND ${this.financeSql(user, 'ac', 'collection')} LIMIT 1`,
      [this.requireUuid(collectionId, 'collectionId'), ...visibility.params],
    );
    if (!rows[0]) throw new NotFoundException('Raccolta asset non trovata');
    return rows[0];
  }

  async createAssetCollection(body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('name obbligatorio');
    this.assertFinanceAllowed(user, { name });
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".asset_collections (name, slug, description, visibility, sort_order, is_system, created_by, created_at, updated_at)
       VALUES ($1,$2,$3,$4,$5,false,$6,now(),now()) RETURNING *`,
      [
        name,
        this.textOrNull(body.slug) || this.slugify(name),
        this.textOrNull(body.description),
        this.normalizeEnum(body.visibility, KNOWLEDGE_VISIBILITIES, 'team', 'visibility'),
        Number(body.sort_order || 0),
        this.uuidOrNull(user.id),
      ],
    );
    await this.logActivity(schema, 'asset_collection_created', { targetType: 'asset_collection', targetId: rows[0].id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async updateAssetCollection(collectionId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const current = await this.getAssetCollection(collectionId);
    const schema = this.getSchema();
    if (current.is_system && !this.isAdmin(user.role)) throw new ForbiddenException('Le raccolte di sistema sono modificabili solo da owner/admin.');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".asset_collections
       SET name=COALESCE($2,name), slug=COALESCE($3,slug), description=$4, visibility=$5, sort_order=$6, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [
        current.id,
        this.textOrNull(body.name),
        this.textOrNull(body.slug),
        body.description === undefined ? current.description : this.textOrNull(body.description),
        body.visibility === undefined ? current.visibility : this.normalizeEnum(body.visibility, KNOWLEDGE_VISIBILITIES, 'team', 'visibility'),
        body.sort_order === undefined ? current.sort_order : Number(body.sort_order || 0),
      ],
    );
    await this.logActivity(schema, 'asset_collection_updated', { targetType: 'asset_collection', targetId: current.id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async deleteAssetCollection(collectionId: string) {
    const user = this.assertManage();
    const current = await this.getAssetCollection(collectionId);
    if (current.is_system && !this.isAdmin(user.role)) throw new ForbiddenException('Le raccolte di sistema sono eliminabili solo da owner/admin.');
    const schema = this.getSchema();
    await this.dataSource.query(`UPDATE "${schema}".asset_collections SET deleted_at=now(), updated_at=now() WHERE id=$1`, [current.id]);
    await this.logActivity(schema, 'asset_collection_deleted', { targetType: 'asset_collection', targetId: current.id, actorUserId: this.uuidOrNull(user.id) });
    return { deleted: true };
  }

  private buildAssetWhere(user: AuthUser, query: Record<string, any> = {}, alias = 'ai') {
    const params: unknown[] = [];
    const where = [`${alias}.deleted_at IS NULL`];
    const visibility = this.visibilityFilter(user, alias, params.length + 1, ['owner_user_id', 'created_by']);
    where.push(visibility.sql, this.financeSql(user, alias, 'asset'));
    params.push(...visibility.params);
    if (query.search) {
      params.push(`%${String(query.search).trim()}%`);
      where.push(`(${alias}.name ILIKE $${params.length} OR COALESCE(${alias}.description,'') ILIKE $${params.length})`);
    }
    for (const field of ['collection_id', 'owner_user_id', 'document_id']) {
      if (query[field]) {
        params.push(this.requireUuid(query[field], field));
        where.push(`${alias}.${field} = $${params.length}`);
      }
    }
    for (const [field, allowed] of [
      ['asset_type', KNOWLEDGE_ASSET_TYPES],
      ['status', KNOWLEDGE_ASSET_STATUSES],
      ['visibility', KNOWLEDGE_VISIBILITIES],
    ] as Array<[string, readonly string[]]>) {
      if (query[field]) {
        params.push(this.normalizeEnum(query[field], allowed, String(allowed[0]), field));
        where.push(`${alias}.${field} = $${params.length}`);
      }
    }
    if (query.tag_id) {
      params.push(this.requireUuid(query.tag_id, 'tag_id'));
      where.push(`EXISTS (SELECT 1 FROM "${this.getSchema()}".asset_item_tags ait WHERE ait.asset_id = ${alias}.id AND ait.tag_id = $${params.length})`);
    }
    return { where: where.join(' AND '), params };
  }

  async listAssets(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const filters = this.buildAssetWhere(user, query);
    const rows = await this.dataSource.query(
      `SELECT ai.*, ac.name AS collection_name, d.title AS document_title, d.original_filename
       FROM "${schema}".asset_items ai
       LEFT JOIN "${schema}".asset_collections ac ON ac.id = ai.collection_id
       LEFT JOIN "${schema}".documents d ON d.id = ai.document_id
       WHERE ${filters.where}
       ORDER BY ai.updated_at DESC, ai.created_at DESC
       LIMIT $${filters.params.length + 1} OFFSET $${filters.params.length + 2}`,
      [...filters.params, limit, offset],
    );
    const total = Number((await this.dataSource.query(`SELECT COUNT(*)::int AS count FROM "${schema}".asset_items ai WHERE ${filters.where}`, filters.params))[0]?.count || 0);
    return { items: rows, total, limit, offset };
  }

  async getAsset(assetId: string) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const filters = this.buildAssetWhere(user, {}, 'ai');
    const rows = await this.dataSource.query(
      `SELECT ai.*, ac.name AS collection_name, d.title AS document_title, d.original_filename, d.mime_type AS document_mime_type, d.size_bytes AS document_size_bytes
       FROM "${schema}".asset_items ai
       LEFT JOIN "${schema}".asset_collections ac ON ac.id = ai.collection_id
       LEFT JOIN "${schema}".documents d ON d.id = ai.document_id
       WHERE ai.id=$1 AND ${filters.where}
       LIMIT 1`,
      [this.requireUuid(assetId, 'assetId'), ...filters.params],
    );
    if (!rows[0]) throw new NotFoundException('Asset non trovato');
    return rows[0];
  }

  async createAsset(body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('name obbligatorio');
    const assetType = this.normalizeEnum(body.asset_type, KNOWLEDGE_ASSET_TYPES, 'document', 'asset_type');
    const externalUrl = this.normalizeUrl(body.external_url);
    this.assertFinanceAllowed(user, { name, asset_type: assetType });
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".asset_items (
         collection_id, document_id, name, description, asset_type, status, visibility, external_url,
         mime_type, file_size_bytes, version, owner_user_id, created_by, metadata, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,now(),now()) RETURNING *`,
      [
        body.collection_id ? this.requireUuid(body.collection_id, 'collection_id') : null,
        body.document_id ? this.requireUuid(body.document_id, 'document_id') : null,
        name,
        this.textOrNull(body.description),
        assetType,
        this.normalizeEnum(body.status, KNOWLEDGE_ASSET_STATUSES, 'active', 'status'),
        this.normalizeEnum(body.visibility, KNOWLEDGE_VISIBILITIES, 'team', 'visibility'),
        externalUrl,
        this.textOrNull(body.mime_type),
        body.file_size_bytes === undefined ? null : Number(body.file_size_bytes || 0),
        this.textOrNull(body.version),
        this.uuidOrNull(body.owner_user_id) || this.uuidOrNull(user.id),
        this.uuidOrNull(user.id),
        JSON.stringify(this.parseJsonObject(body.metadata, {}) || {}),
      ],
    );
    await this.logActivity(schema, 'asset_created', { targetType: 'asset', targetId: rows[0].id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async updateAsset(assetId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const current = await this.getAsset(assetId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".asset_items
       SET collection_id=$2, document_id=$3, name=$4, description=$5, asset_type=$6, status=$7, visibility=$8,
           external_url=$9, mime_type=$10, file_size_bytes=$11, version=$12, owner_user_id=$13, metadata=$14::jsonb, updated_at=now(),
           archived_at=CASE WHEN $7='archived' THEN now() ELSE archived_at END
       WHERE id=$1 RETURNING *`,
      [
        current.id,
        body.collection_id === undefined ? current.collection_id : body.collection_id ? this.requireUuid(body.collection_id, 'collection_id') : null,
        body.document_id === undefined ? current.document_id : body.document_id ? this.requireUuid(body.document_id, 'document_id') : null,
        this.textOrNull(body.name) || current.name,
        body.description === undefined ? current.description : this.textOrNull(body.description),
        body.asset_type === undefined ? current.asset_type : this.normalizeEnum(body.asset_type, KNOWLEDGE_ASSET_TYPES, 'document', 'asset_type'),
        body.status === undefined ? current.status : this.normalizeEnum(body.status, KNOWLEDGE_ASSET_STATUSES, 'active', 'status'),
        body.visibility === undefined ? current.visibility : this.normalizeEnum(body.visibility, KNOWLEDGE_VISIBILITIES, 'team', 'visibility'),
        body.external_url === undefined ? current.external_url : this.normalizeUrl(body.external_url),
        body.mime_type === undefined ? current.mime_type : this.textOrNull(body.mime_type),
        body.file_size_bytes === undefined ? current.file_size_bytes : Number(body.file_size_bytes || 0),
        body.version === undefined ? current.version : this.textOrNull(body.version),
        body.owner_user_id === undefined ? current.owner_user_id : this.uuidOrNull(body.owner_user_id),
        body.metadata === undefined ? JSON.stringify(current.metadata || {}) : JSON.stringify(this.parseJsonObject(body.metadata, {}) || {}),
      ],
    );
    await this.logActivity(schema, 'asset_updated', { targetType: 'asset', targetId: current.id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async archiveAsset(assetId: string) {
    return this.updateAsset(assetId, { status: 'archived' });
  }

  async deleteAsset(assetId: string) {
    const user = this.assertManage();
    const current = await this.getAsset(assetId);
    const schema = this.getSchema();
    await this.dataSource.query(`UPDATE "${schema}".asset_items SET deleted_at=now(), updated_at=now() WHERE id=$1`, [current.id]);
    await this.logActivity(schema, 'asset_deleted', { targetType: 'asset', targetId: current.id, actorUserId: this.uuidOrNull(user.id) });
    return { deleted: true };
  }

  async addAssetTag(assetId: string, tagId: string) {
    await this.getAsset(assetId);
    this.assertManage();
    const schema = this.getSchema();
    await this.dataSource.query(`INSERT INTO "${schema}".asset_item_tags (asset_id, tag_id, created_at) VALUES ($1,$2,now()) ON CONFLICT DO NOTHING`, [this.requireUuid(assetId, 'assetId'), this.requireUuid(tagId, 'tagId')]);
    return { success: true };
  }

  async removeAssetTag(assetId: string, tagId: string) {
    await this.getAsset(assetId);
    this.assertManage();
    const schema = this.getSchema();
    await this.dataSource.query(`DELETE FROM "${schema}".asset_item_tags WHERE asset_id=$1 AND tag_id=$2`, [this.requireUuid(assetId, 'assetId'), this.requireUuid(tagId, 'tagId')]);
    return { success: true };
  }

  async exportAsset(assetId: string) {
    return { exportedAt: new Date().toISOString(), asset: await this.getAsset(assetId) };
  }

  private buildTemplateWhere(user: AuthUser, query: Record<string, any> = {}, alias = 'ot') {
    const params: unknown[] = [];
    const where = [`${alias}.deleted_at IS NULL`];
    const visibility = this.visibilityFilter(user, alias, params.length + 1, ['owner_user_id', 'created_by']);
    where.push(visibility.sql, this.financeSql(user, alias, 'template'));
    params.push(...visibility.params);
    if (query.search) {
      params.push(`%${String(query.search).trim()}%`);
      where.push(`(${alias}.name ILIKE $${params.length} OR COALESCE(${alias}.description,'') ILIKE $${params.length} OR COALESCE(${alias}.instructions,'') ILIKE $${params.length})`);
    }
    for (const [field, allowed] of [
      ['template_type', OPERATIONAL_TEMPLATE_TYPES],
      ['category', OPERATIONAL_TEMPLATE_CATEGORIES],
      ['status', OPERATIONAL_TEMPLATE_STATUSES],
      ['visibility', KNOWLEDGE_VISIBILITIES],
    ] as Array<[string, readonly string[]]>) {
      if (query[field]) {
        params.push(this.normalizeEnum(query[field], allowed, String(allowed[0]), field));
        where.push(`${alias}.${field} = $${params.length}`);
      }
    }
    if (query.owner_user_id) {
      params.push(this.requireUuid(query.owner_user_id, 'owner_user_id'));
      where.push(`${alias}.owner_user_id = $${params.length}`);
    }
    if (query.is_system !== undefined) {
      params.push(this.parseBool(query.is_system));
      where.push(`${alias}.is_system = $${params.length}`);
    }
    return { where: where.join(' AND '), params };
  }

  async listTemplates(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const filters = this.buildTemplateWhere(user, query);
    const rows = await this.dataSource.query(
      `SELECT ot.* FROM "${schema}".operational_templates ot WHERE ${filters.where}
       ORDER BY ot.updated_at DESC LIMIT $${filters.params.length + 1} OFFSET $${filters.params.length + 2}`,
      [...filters.params, limit, offset],
    );
    const total = Number((await this.dataSource.query(`SELECT COUNT(*)::int AS count FROM "${schema}".operational_templates ot WHERE ${filters.where}`, filters.params))[0]?.count || 0);
    return { items: rows, total, limit, offset };
  }

  async getTemplate(templateId: string) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const filters = this.buildTemplateWhere(user, {}, 'ot');
    const rows = await this.dataSource.query(
      `SELECT ot.* FROM "${schema}".operational_templates ot WHERE ot.id=$1 AND ${filters.where} LIMIT 1`,
      [this.requireUuid(templateId, 'templateId'), ...filters.params],
    );
    if (!rows[0]) throw new NotFoundException('Template non trovato');
    return rows[0];
  }

  private normalizeTemplateInput(body: Record<string, any>, existing?: any) {
    const name = String(body.name ?? existing?.name ?? '').trim();
    if (!name) throw new BadRequestException('name obbligatorio');
    const content = body.content === undefined ? existing?.content || {} : this.parseJsonObject(body.content, {}) || {};
    return {
      name,
      slug: this.textOrNull(body.slug) || existing?.slug || this.slugify(name),
      description: body.description === undefined ? existing?.description || null : this.textOrNull(body.description),
      template_type: this.normalizeEnum(body.template_type ?? existing?.template_type, OPERATIONAL_TEMPLATE_TYPES, 'generic', 'template_type'),
      category: this.normalizeEnum(body.category ?? existing?.category, OPERATIONAL_TEMPLATE_CATEGORIES, 'operations', 'category'),
      status: this.normalizeEnum(body.status ?? existing?.status, OPERATIONAL_TEMPLATE_STATUSES, 'draft', 'status'),
      visibility: this.normalizeEnum(body.visibility ?? existing?.visibility, KNOWLEDGE_VISIBILITIES, 'team', 'visibility'),
      content,
      variables: body.variables === undefined ? existing?.variables || null : this.parseJsonValue(body.variables, null),
      instructions: body.instructions === undefined ? existing?.instructions || null : this.textOrNull(body.instructions),
      owner_user_id: body.owner_user_id === undefined ? existing?.owner_user_id || null : this.uuidOrNull(body.owner_user_id),
      metadata: body.metadata === undefined ? existing?.metadata || null : this.parseJsonObject(body.metadata, {}),
    };
  }

  async createTemplate(body: Record<string, any>) {
    const user = this.assertManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const input = this.normalizeTemplateInput(body);
    this.assertFinanceAllowed(user, input);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".operational_templates (
         name, slug, description, template_type, category, status, visibility, content, variables,
         instructions, owner_user_id, created_by, updated_by, is_system, metadata, created_at, updated_at
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9::jsonb,$10,$11,$12,$12,false,$13::jsonb,now(),now()) RETURNING *`,
      [
        input.name,
        input.slug,
        input.description,
        input.template_type,
        input.category,
        input.status,
        input.visibility,
        JSON.stringify(input.content),
        input.variables === null ? null : JSON.stringify(input.variables),
        input.instructions,
        input.owner_user_id || this.uuidOrNull(user.id),
        this.uuidOrNull(user.id),
        JSON.stringify(input.metadata || {}),
      ],
    );
    await this.createTemplateVersionInternal(schema, rows[0], 1, body.change_summary || 'Versione iniziale', this.uuidOrNull(user.id));
    await this.logActivity(schema, 'template_created', { targetType: 'operational_template', targetId: rows[0].id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async updateTemplate(templateId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const current = await this.getTemplate(templateId);
    const schema = this.getSchema();
    if (current.is_system && !this.isAdmin(user.role)) throw new ForbiddenException('I template di sistema sono modificabili solo da owner/admin.');
    const input = this.normalizeTemplateInput(body, current);
    this.assertFinanceAllowed(user, input);
    const shouldVersion =
      JSON.stringify(input.content || {}) !== JSON.stringify(current.content || {}) ||
      JSON.stringify(input.variables || null) !== JSON.stringify(current.variables || null) ||
      String(input.instructions || '') !== String(current.instructions || '');
    await this.dataSource.query(
      `UPDATE "${schema}".operational_templates
       SET name=$2, slug=$3, description=$4, template_type=$5, category=$6, status=$7, visibility=$8,
           content=$9::jsonb, variables=$10::jsonb, instructions=$11, owner_user_id=$12, updated_by=$13,
           metadata=$14::jsonb, archived_at=CASE WHEN $7='archived' THEN now() ELSE archived_at END, updated_at=now()
       WHERE id=$1 AND deleted_at IS NULL`,
      [
        current.id,
        input.name,
        input.slug,
        input.description,
        input.template_type,
        input.category,
        input.status,
        input.visibility,
        JSON.stringify(input.content),
        input.variables === null ? null : JSON.stringify(input.variables),
        input.instructions,
        input.owner_user_id,
        this.uuidOrNull(user.id),
        JSON.stringify(input.metadata || {}),
      ],
    );
    const updatedRows = await this.dataSource.query(
      `SELECT * FROM "${schema}".operational_templates WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [current.id],
    );
    if (!updatedRows[0]) throw new NotFoundException('Template non trovato dopo aggiornamento');
    if (shouldVersion) await this.createTemplateVersionInternal(schema, updatedRows[0], null, body.change_summary || null, this.uuidOrNull(user.id));
    await this.logActivity(schema, 'template_updated', { targetType: 'operational_template', targetId: current.id, actorUserId: this.uuidOrNull(user.id) });
    return updatedRows[0];
  }

  private async createTemplateVersionInternal(schema: string, template: any, versionNumber: number | null, changeSummary: string | null, createdBy: string | null) {
    if (!template?.id) throw new BadRequestException('Template non valido per versioning');
    await this.dataSource.query(
      `INSERT INTO "${schema}".operational_template_versions (
         template_id, version_number, content, variables, instructions, change_summary, created_by, created_at
       )
       VALUES (
         $1,
         COALESCE($2::integer, (SELECT COALESCE(MAX(version_number), 0)::int + 1 FROM "${schema}".operational_template_versions WHERE template_id = $1)),
         $3::jsonb,$4::jsonb,$5,$6,$7,now()
       )
       ON CONFLICT (template_id, version_number) DO NOTHING`,
      [
        template.id,
        versionNumber,
        JSON.stringify(template.content || {}),
        template.variables === null ? null : JSON.stringify(template.variables || null),
        template.instructions || null,
        changeSummary || null,
        createdBy,
      ],
    );
    const versionRows = await this.dataSource.query(
      `SELECT COALESCE(MAX(version_number), 0)::int AS version FROM "${schema}".operational_template_versions WHERE template_id = $1`,
      [template.id],
    );
    const version = Number(versionRows[0]?.version || versionNumber || 0);
    await this.logActivity(schema, 'template_version_created', { targetType: 'operational_template', targetId: template.id, actorUserId: createdBy, metadata: { version_number: version } });
  }

  async createTemplateVersion(templateId: string, body: Record<string, any>) {
    const user = this.assertManage();
    const template = await this.getTemplate(templateId);
    const schema = this.getSchema();
    const snapshot = {
      ...template,
      content: body.content === undefined ? template.content || {} : this.parseJsonObject(body.content, {}) || {},
      variables: body.variables === undefined ? template.variables || null : this.parseJsonValue(body.variables, null),
      instructions: body.instructions === undefined ? template.instructions || null : this.textOrNull(body.instructions),
    };
    await this.createTemplateVersionInternal(schema, snapshot, null, body.change_summary || null, this.uuidOrNull(user.id));
    return this.listTemplateVersions(templateId);
  }

  async listTemplateVersions(templateId: string) {
    await this.getTemplate(templateId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(`SELECT * FROM "${schema}".operational_template_versions WHERE template_id=$1 ORDER BY version_number DESC`, [this.requireUuid(templateId, 'templateId')]);
    return { items: rows };
  }

  async setTemplateStatus(templateId: string, status: 'active' | 'archived') {
    const user = this.assertManage();
    const current = await this.getTemplate(templateId);
    const schema = this.getSchema();
    if (current.is_system && !this.isAdmin(user.role)) throw new ForbiddenException('I template di sistema sono modificabili solo da owner/admin.');
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".operational_templates
       SET status=$2, archived_at=CASE WHEN $2='archived' THEN now() ELSE archived_at END, updated_by=$3, updated_at=now()
       WHERE id=$1 RETURNING *`,
      [current.id, status, this.uuidOrNull(user.id)],
    );
    await this.logActivity(schema, status === 'active' ? 'template_activated' : 'template_archived', { targetType: 'operational_template', targetId: current.id, actorUserId: this.uuidOrNull(user.id) });
    return rows[0];
  }

  async deleteTemplate(templateId: string) {
    const user = this.assertManage();
    const current = await this.getTemplate(templateId);
    if (current.is_system && !this.isAdmin(user.role)) throw new ForbiddenException('I template di sistema sono eliminabili solo da owner/admin.');
    const schema = this.getSchema();
    await this.dataSource.query(`UPDATE "${schema}".operational_templates SET deleted_at=now(), updated_at=now() WHERE id=$1`, [current.id]);
    await this.logActivity(schema, 'template_deleted', { targetType: 'operational_template', targetId: current.id, actorUserId: this.uuidOrNull(user.id) });
    return { deleted: true };
  }

  async duplicateTemplate(templateId: string) {
    const user = this.assertManage();
    const current = await this.getTemplate(templateId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".operational_templates (
         name, slug, description, template_type, category, status, visibility, content, variables,
         instructions, owner_user_id, created_by, updated_by, is_system, metadata, created_at, updated_at
       )
       VALUES ($1,$2,$3,$4,$5,'draft',$6,$7::jsonb,$8::jsonb,$9,$10,$11,$11,false,$12::jsonb,now(),now())
       RETURNING *`,
      [
        `Copia di ${current.name}`,
        `${current.slug}-copia-${Date.now()}`,
        current.description,
        current.template_type,
        current.category,
        current.visibility,
        JSON.stringify(current.content || {}),
        current.variables === null ? null : JSON.stringify(current.variables || null),
        current.instructions,
        current.owner_user_id || this.uuidOrNull(user.id),
        this.uuidOrNull(user.id),
        JSON.stringify(current.metadata || {}),
      ],
    );
    await this.createTemplateVersionInternal(schema, rows[0], 1, 'Duplicazione template', this.uuidOrNull(user.id));
    await this.dataSource.query(
      `INSERT INTO "${schema}".operational_template_usage (template_id, action, actor_user_id, result_payload, created_at)
       VALUES ($1, 'duplicated', $2, $3::jsonb, now())`,
      [current.id, this.uuidOrNull(user.id), JSON.stringify({ duplicated_template_id: rows[0].id })],
    );
    await this.logActivity(schema, 'template_used', { targetType: 'operational_template', targetId: current.id, actorUserId: this.uuidOrNull(user.id), metadata: { action: 'duplicated' } });
    return rows[0];
  }

  private renderValue(value: unknown, variables: Record<string, unknown>): unknown {
    if (typeof value === 'string') {
      return value.replace(/\{\{\s*([a-zA-Z0-9_-]+)\s*\}\}/g, (_match, key) => {
        const v = variables[key];
        return v === undefined || v === null ? '' : String(v);
      });
    }
    if (Array.isArray(value)) return value.map((item) => this.renderValue(item, variables));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, this.renderValue(v, variables)]));
    }
    return value;
  }

  async previewTemplate(templateId: string, body: Record<string, any>) {
    const user = this.assertRead();
    const template = await this.getTemplate(templateId);
    const variables = this.parseJsonObject(body.variables, {}) || {};
    const rendered = this.renderValue(template.content || {}, variables);
    const schema = this.getSchema();
    await this.dataSource.query(
      `INSERT INTO "${schema}".operational_template_usage (template_id, action, actor_user_id, result_payload, created_at)
       VALUES ($1,'previewed',$2,$3::jsonb,now())`,
      [template.id, this.uuidOrNull(user.id), JSON.stringify({ variables })],
    ).catch(() => undefined);
    return { template, rendered_preview: rendered };
  }

  async useTemplate(templateId: string, body: Record<string, any>) {
    const user = this.assertRead();
    const template = await this.getTemplate(templateId);
    const schema = this.getSchema();
    const targetEntityType = this.textOrNull(body.target_entity_type);
    if (targetEntityType && !KNOWLEDGE_ENTITY_TYPES.includes(targetEntityType as any)) throw new BadRequestException('target_entity_type non valido');
    const targetEntityId = body.target_entity_id ? this.requireEntityUuid(body.target_entity_id, 'target_entity_id') : null;
    this.assertFinanceAllowed(user, { category: template.category, target_entity_type: targetEntityType });
    await this.dataSource.query(`UPDATE "${schema}".operational_templates SET usage_count = usage_count + 1, last_used_at = now(), updated_at = now() WHERE id = $1`, [template.id]);
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".operational_template_usage (
         template_id, target_entity_type, target_entity_id, action, actor_user_id, result_payload, created_at
       ) VALUES ($1,$2,$3,$4,$5,$6::jsonb,now()) RETURNING *`,
      [
        template.id,
        targetEntityType,
        targetEntityId,
        this.normalizeEnum(body.action, OPERATIONAL_TEMPLATE_USAGE_ACTIONS, 'used', 'action'),
        this.uuidOrNull(user.id),
        JSON.stringify({ content: template.content || {}, variables: body.variables || null }),
      ],
    );
    await this.logActivity(schema, 'template_used', { targetType: 'operational_template', targetId: template.id, actorUserId: this.uuidOrNull(user.id), entityType: targetEntityType, entityId: targetEntityId });
    return { template: { ...template, usage_count: Number(template.usage_count || 0) + 1 }, usage: rows[0] };
  }

  async listTemplateUsage(templateId: string) {
    await this.getTemplate(templateId);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".operational_template_usage WHERE template_id=$1 ORDER BY created_at DESC LIMIT 100`,
      [this.requireUuid(templateId, 'templateId')],
    );
    return { items: rows };
  }

  async exportTemplate(templateId: string) {
    return {
      exportedAt: new Date().toISOString(),
      template: await this.getTemplate(templateId),
      versions: await this.listTemplateVersions(templateId),
      usage: await this.listTemplateUsage(templateId),
    };
  }

  async search(query: Record<string, any> = {}) {
    const user = this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const term = String(query.q || query.search || '').trim();
    if (!term) return { items: [], total: 0 };
    const limit = this.normalizeLimit(query.limit, 50);
    const like = `%${term}%`;
    const canFinance = this.canViewFinance(user.role);
    const canAdmin = this.isAdmin(user.role);
    const userId = this.uuidOrNull(user.id);
    const visibilitySql = (alias: string, ownerColumn = 'owner_user_id', createdColumn = 'created_by') => {
      if (canAdmin) return 'TRUE';
      return userId
        ? `(${alias}.visibility = 'team' OR (${alias}.visibility = 'private' AND (${alias}.${ownerColumn} = $2 OR ${alias}.${createdColumn} = $2)))`
        : `${alias}.visibility = 'team'`;
    };
    const params: unknown[] = userId && !canAdmin ? [like, userId, limit] : [like, limit];
    const limitParam = params.length;
    const rows = await this.dataSource.query(
      `
      SELECT 'article' AS target_type, a.id AS target_id, a.title, a.excerpt, a.article_type AS type,
             c.name AS category, a.status, a.visibility, a.updated_at
      FROM "${schema}".knowledge_articles a
      LEFT JOIN "${schema}".knowledge_categories c ON c.id = a.category_id
      WHERE a.deleted_at IS NULL AND (a.title ILIKE $1 OR COALESCE(a.excerpt,'') ILIKE $1 OR COALESCE(a.content,'') ILIKE $1)
        AND ${visibilitySql('a')} AND ${canFinance ? 'TRUE' : `NOT EXISTS (
          SELECT 1 FROM "${schema}".knowledge_categories kc
          WHERE kc.id = a.category_id AND lower(kc.name) LIKE '%finance%' AND kc.deleted_at IS NULL
        )`}
      UNION ALL
      SELECT 'asset' AS target_type, ai.id AS target_id, ai.name AS title, ai.description AS excerpt, ai.asset_type AS type,
             ac.name AS category, ai.status, ai.visibility, ai.updated_at
      FROM "${schema}".asset_items ai
      LEFT JOIN "${schema}".asset_collections ac ON ac.id = ai.collection_id
      WHERE ai.deleted_at IS NULL AND (ai.name ILIKE $1 OR COALESCE(ai.description,'') ILIKE $1)
        AND ${visibilitySql('ai')} AND ${canFinance ? 'TRUE' : `COALESCE(ai.asset_type, '') NOT IN ('legal_document')`}
      UNION ALL
      SELECT 'operational_template' AS target_type, ot.id AS target_id, ot.name AS title, ot.description AS excerpt,
             ot.template_type AS type, ot.category, ot.status, ot.visibility, ot.updated_at
      FROM "${schema}".operational_templates ot
      WHERE ot.deleted_at IS NULL AND (ot.name ILIKE $1 OR COALESCE(ot.description,'') ILIKE $1 OR COALESCE(ot.instructions,'') ILIKE $1)
        AND ${visibilitySql('ot')} AND ${canFinance ? 'TRUE' : `ot.category <> 'finance'`}
      UNION ALL
      SELECT 'tag' AS target_type, kt.id AS target_id, kt.name AS title, kt.description AS excerpt, 'tag' AS type,
             NULL AS category, NULL AS status, 'team' AS visibility, kt.updated_at
      FROM "${schema}".knowledge_tags kt
      WHERE kt.deleted_at IS NULL AND kt.name ILIKE $1
      ORDER BY updated_at DESC NULLS LAST
      LIMIT $${limitParam}`,
      params,
    );
    return { items: rows, total: rows.length };
  }

  async activity(query: Record<string, any> = {}) {
    this.assertRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit, 100);
    const offset = this.normalizeOffset(query.offset);
    const params: unknown[] = [];
    const where = ['TRUE'];
    for (const field of ['action', 'target_type', 'entity_type']) {
      if (query[field]) {
        params.push(String(query[field]));
        where.push(`${field} = $${params.length}`);
      }
    }
    for (const field of ['target_id', 'actor_user_id', 'entity_id']) {
      if (query[field]) {
        params.push(this.requireUuid(query[field], field));
        where.push(`${field} = $${params.length}`);
      }
    }
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".knowledge_activity WHERE ${where.join(' AND ')} ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    return { items: rows, limit, offset };
  }

  async exportKnowledge(query: Record<string, any> = {}) {
    return {
      exportedAt: new Date().toISOString(),
      summary: await this.summary(),
      articles: await this.listArticles({ ...query, limit: query.limit || 100 }),
      assets: await this.listAssets({ ...query, limit: query.limit || 100 }),
      templates: await this.listTemplates({ ...query, limit: query.limit || 100 }),
    };
  }

  async seedBase() {
    const user = this.assertAdmin();
    const schema = this.getSchema();
    await seedTenantKnowledgeBase(this.dataSource, schema, this.uuidOrNull(user.id));
    return this.summary();
  }
}
