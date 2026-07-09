import { BadRequestException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { randomUUID } from 'crypto';
import { DataSource } from 'typeorm';
import { FileStorageService } from '../file-storage.service';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import { ensureTenantDocumentsTables, seedDoflowDocumentFolders } from './tenant-documents-schema';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const VISIBILITIES = ['internal', 'finance', 'private'];
const CATEGORIES = [
  'generic', 'contract', 'quote', 'invoice', 'receipt', 'project_asset', 'briefing_material',
  'company_document', 'brand_asset', 'legal', 'finance', 'technical', 'image', 'video', 'archive',
];
const STATUSES = ['active', 'archived', 'deleted'];
const ENTITY_TYPES = [
  'company', 'contact', 'lead', 'opportunity', 'briefing', 'quote', 'project', 'task',
  'milestone', 'team_member', 'invoice', 'payment', 'deadline', 'renewal', 'recurring_service',
  'contract', 'contract_version', 'contract_checklist_item', 'paperwork_dossier', 'paperwork_item',
];
const RELATION_TYPES = ['attachment', 'source', 'output', 'contract', 'invoice', 'quote', 'asset', 'reference'];
const SORT_COLUMNS = ['created_at', 'updated_at', 'title', 'size_bytes', 'category'];
const FINANCE_CATEGORIES = new Set(['finance', 'invoice', 'receipt']);
const FINANCE_ENTITIES = new Set(['invoice', 'payment', 'deadline', 'renewal', 'recurring_service']);

type AuthUser = { id: string; email?: string; role: string };

@Injectable()
export class TenantDocumentsService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly fileStorage: FileStorageService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getUser(): AuthUser {
    const user = this.request.user || this.request.authUser;
    if (!user) throw new ForbiddenException('Utente non valido');
    return {
      id: String(user.sub || user.id || user.userId || ''),
      email: typeof user.email === 'string' ? user.email : undefined,
      role: String(user.role || 'user').toLowerCase().trim(),
    };
  }

  private getSchema(): string {
    const user = this.request.user || this.request.authUser;
    const tenantRef = user?.tenantId || user?.tenant_id || this.request.tenantId;
    const schema = safeSchema(tenantRef || 'public', 'TenantDocumentsService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Documenti tenant non disponibili nel contesto public');
    return schema;
  }

  private canRead(role: string): boolean {
    return ['owner', 'admin', 'superadmin', 'super_admin', 'manager', 'editor', 'user', 'viewer'].includes(role);
  }

  private canManage(role: string): boolean {
    return ['owner', 'admin', 'superadmin', 'super_admin', 'manager', 'editor', 'user'].includes(role);
  }

  private canViewFinance(role: string): boolean {
    return ['owner', 'admin', 'superadmin', 'super_admin'].includes(role);
  }

  private assertCanRead(user = this.getUser()) {
    if (!this.canRead(user.role)) throw new ForbiddenException('Non hai accesso ai documenti interni.');
    return user;
  }

  private assertCanManage(user = this.getUser()) {
    if (!this.canManage(user.role)) throw new ForbiddenException('Non hai permessi per modificare i documenti.');
    return user;
  }

  private userIdOrNull(value: string): string | null {
    return UUID_RE.test(value) ? value : null;
  }

  private requireUuid(value: string, label = 'ID'): string {
    if (!UUID_RE.test(String(value))) throw new BadRequestException(`${label} non valido`);
    return String(value);
  }

  private normalizeLimit(value: unknown): number {
    const n = Number(value || 50);
    if (!Number.isFinite(n)) return 50;
    return Math.max(1, Math.min(100, Math.trunc(n)));
  }

  private normalizeOffset(value: unknown): number {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.trunc(n));
  }

  private textOrNull(value: unknown): string | null {
    const text = String(value ?? '').trim();
    return text || null;
  }

  private async ensureSchema(schema: string) {
    await ensureTenantDocumentsTables(this.dataSource, schema);
  }

  private async tableExists(schema: string, table: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = $2 LIMIT 1`,
      [schema, table],
    );
    return rows.length > 0;
  }

  private normalizeVisibility(value: unknown): string {
    const visibility = String(value || 'internal').trim();
    return VISIBILITIES.includes(visibility) ? visibility : 'internal';
  }

  private normalizeCategory(value: unknown): string {
    const category = String(value || 'generic').trim();
    return CATEGORIES.includes(category) ? category : 'generic';
  }

  private normalizeStatus(value: unknown): string {
    const status = String(value || 'active').trim();
    return STATUSES.includes(status) ? status : 'active';
  }

  private normalizeEntityType(value: unknown): string | null {
    const type = this.textOrNull(value);
    if (!type) return null;
    if (!ENTITY_TYPES.includes(type)) throw new BadRequestException('entity_type non valido');
    return type;
  }

  private normalizeRelationType(value: unknown): string {
    const relation = String(value || 'attachment').trim();
    return RELATION_TYPES.includes(relation) ? relation : 'attachment';
  }

  private parseMetadata(value: unknown): Record<string, unknown> | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value === 'object' && !Array.isArray(value)) return value as Record<string, unknown>;
    try {
      const parsed = JSON.parse(String(value));
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
    } catch {
      throw new BadRequestException('metadata JSON non valido');
    }
    throw new BadRequestException('metadata deve essere un oggetto JSON');
  }

  private isFinanceDocument(row: Record<string, any>): boolean {
    return row.visibility === 'finance' || FINANCE_CATEGORIES.has(String(row.category || '')) || FINANCE_ENTITIES.has(String(row.entity_type || ''));
  }

  private assertFinanceAllowed(user: AuthUser, row: Record<string, any>) {
    if (this.isFinanceDocument(row) && !this.canViewFinance(user.role)) {
      throw new ForbiddenException('Documenti finance disponibili solo per CEO/Admin.');
    }
  }

  private visibilitySql(user: AuthUser, alias = 'd') {
    if (this.canViewFinance(user.role)) return 'TRUE';
    return `(${alias}.visibility <> 'finance' AND COALESCE(${alias}.category, '') NOT IN ('finance', 'invoice', 'receipt') AND COALESCE(${alias}.entity_type, '') NOT IN ('invoice', 'payment', 'deadline', 'renewal', 'recurring_service'))`;
  }

  private sanitizeDocument(row: Record<string, any>) {
    if (!row) return row;
    const { storage_key: _storageKey, ...safe } = row;
    return safe;
  }

  private safeFilename(filename: string): string {
    const cleaned = String(filename || 'file')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 140);
    return cleaned || 'file';
  }

  private storageKey(schema: string, filename: string): string {
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    return `tenant/${schema}/documents/${yyyy}/${mm}/${randomUUID()}-${this.safeFilename(filename)}`;
  }

  async listFolders(query: Record<string, any>) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const params: unknown[] = [];
    const where = ['deleted_at IS NULL', this.visibilitySql(user, 'document_folders')];

    if (query.parent_id) {
      params.push(this.requireUuid(String(query.parent_id), 'parent_id'));
      where.push(`parent_id = $${params.length}`);
    }
    if (query.entity_type) {
      params.push(this.normalizeEntityType(query.entity_type));
      where.push(`entity_type = $${params.length}`);
    }
    if (query.entity_id) {
      params.push(this.requireUuid(String(query.entity_id), 'entity_id'));
      where.push(`entity_id = $${params.length}`);
    }

    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".document_folders
       WHERE ${where.join(' AND ')}
       ORDER BY name ASC`,
      params,
    );
    return { items: rows };
  }

  async createFolder(body: Record<string, any>) {
    const user = this.assertCanManage();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const visibility = this.normalizeVisibility(body.visibility);
    const candidate = { visibility, category: 'generic', entity_type: body.entity_type };
    this.assertFinanceAllowed(user, candidate);
    const name = String(body.name || '').trim();
    if (!name) throw new BadRequestException('name obbligatorio');
    const entityType = this.normalizeEntityType(body.entity_type);
    const entityId = body.entity_id ? this.requireUuid(String(body.entity_id), 'entity_id') : null;
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".document_folders (
         parent_id, name, slug, description, entity_type, entity_id, visibility, created_by, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now(), now())
       RETURNING *`,
      [
        body.parent_id ? this.requireUuid(String(body.parent_id), 'parent_id') : null,
        name,
        this.textOrNull(body.slug) || this.safeFilename(name).toLowerCase(),
        this.textOrNull(body.description),
        entityType,
        entityId,
        visibility,
        this.userIdOrNull(user.id),
      ],
    );
    await this.activity(schema, null, 'created_folder', user, entityType, entityId, { folder_id: rows[0].id });
    return rows[0];
  }

  async getFolder(id: string) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".document_folders
       WHERE id = $1 AND deleted_at IS NULL AND ${this.visibilitySql(user, 'document_folders')}
       LIMIT 1`,
      [this.requireUuid(id)],
    );
    if (!rows[0]) throw new NotFoundException('Cartella non trovata');
    return rows[0];
  }

  async updateFolder(id: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const current = await this.getFolder(id);
    const schema = this.getSchema();
    const nextVisibility = body.visibility === undefined ? current.visibility : this.normalizeVisibility(body.visibility);
    this.assertFinanceAllowed(user, { ...current, visibility: nextVisibility });
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".document_folders
       SET name = COALESCE($2, name),
           slug = COALESCE($3, slug),
           description = COALESCE($4, description),
           visibility = $5,
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [
        id,
        this.textOrNull(body.name),
        this.textOrNull(body.slug),
        this.textOrNull(body.description),
        nextVisibility,
      ],
    );
    await this.activity(schema, null, 'updated_folder', user, current.entity_type, current.entity_id, { folder_id: id });
    return rows[0];
  }

  async deleteFolder(id: string) {
    const user = this.assertCanManage();
    const current = await this.getFolder(id);
    this.assertFinanceAllowed(user, current);
    const schema = this.getSchema();
    await this.dataSource.query(
      `UPDATE "${schema}".document_folders SET deleted_at = now(), updated_at = now() WHERE id = $1 AND deleted_at IS NULL`,
      [id],
    );
    await this.activity(schema, null, 'deleted_folder', user, current.entity_type, current.entity_id, { folder_id: id });
    return { success: true };
  }

  async listDocuments(query: Record<string, any>) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const sortBy = SORT_COLUMNS.includes(String(query.sort || query.sortBy || '')) ? String(query.sort || query.sortBy) : 'created_at';
    const sortDir = String(query.sortDir || query.sortOrder || 'desc').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const params: unknown[] = [];
    const where = ['d.deleted_at IS NULL', this.visibilitySql(user, 'd')];
    const status = query.status === undefined ? 'active' : String(query.status);
    if (status !== '__all__' && status !== 'all') {
      params.push(this.normalizeStatus(status));
      where.push(`d.status = $${params.length}`);
    }
    const search = String(query.search || '').trim();
    if (search) {
      params.push(`%${search.toLowerCase()}%`);
      where.push(`(lower(coalesce(d.title, '')) LIKE $${params.length} OR lower(coalesce(d.original_filename, '')) LIKE $${params.length} OR lower(coalesce(d.description, '')) LIKE $${params.length})`);
    }
    for (const field of ['folder_id', 'uploaded_by', 'entity_id']) {
      if (!query[field]) continue;
      params.push(this.requireUuid(String(query[field]), field));
      where.push(`d.${field} = $${params.length}`);
    }
    for (const field of ['category', 'visibility', 'entity_type']) {
      if (!query[field]) continue;
      const value = field === 'category' ? this.normalizeCategory(query[field]) : field === 'visibility' ? this.normalizeVisibility(query[field]) : this.normalizeEntityType(query[field]);
      params.push(value);
      where.push(`d.${field} = $${params.length}`);
    }
    if (query.date_from) {
      params.push(String(query.date_from));
      where.push(`d.created_at >= $${params.length}::timestamptz`);
    }
    if (query.date_to) {
      params.push(String(query.date_to));
      where.push(`d.created_at <= $${params.length}::timestamptz`);
    }

    const rows = await this.dataSource.query(
      `SELECT d.*, f.name AS folder_name, u.email AS uploaded_by_email
       FROM "${schema}".documents d
       LEFT JOIN "${schema}".document_folders f ON f.id = d.folder_id
       LEFT JOIN "${schema}".users u ON u.id = d.uploaded_by
       WHERE ${where.join(' AND ')}
       ORDER BY d.${sortBy} ${sortDir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const total = Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".documents d WHERE ${where.join(' AND ')}`,
      params,
    ))[0]?.count || 0);
    return { items: rows.map((row: any) => this.sanitizeDocument(row)), total, limit, offset };
  }

  async uploadDocument(file: Express.Multer.File | undefined, body: Record<string, any>) {
    const user = this.assertCanManage();
    if (!file) throw new BadRequestException('file obbligatorio');
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const category = this.normalizeCategory(body.category);
    const visibility = this.normalizeVisibility(body.visibility);
    const entityType = this.normalizeEntityType(body.entity_type);
    const entityId = body.entity_id ? this.requireUuid(String(body.entity_id), 'entity_id') : null;
    this.assertFinanceAllowed(user, { visibility, category, entity_type: entityType });

    const originalFilename = this.safeFilename(file.originalname);
    const key = this.storageKey(schema, originalFilename);
    const stored = await this.fileStorage.uploadBuffer(key, file);
    const metadata = this.parseMetadata(body.metadata);
    const title = String(body.title || file.originalname || originalFilename).trim();

    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".documents (
         folder_id, title, description, original_filename, stored_filename, mime_type,
         size_bytes, storage_provider, storage_bucket, storage_key, category, visibility,
         status, entity_type, entity_id, uploaded_by, metadata, version_group_id,
         version_number, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'minio', $8, $9, $10, $11,
         'active', $12, $13, $14, $15::jsonb, uuid_generate_v4(), 1, now(), now())
       RETURNING *`,
      [
        body.folder_id ? this.requireUuid(String(body.folder_id), 'folder_id') : null,
        title,
        this.textOrNull(body.description),
        file.originalname,
        originalFilename,
        file.mimetype,
        file.size,
        stored.bucket,
        stored.key,
        category,
        visibility,
        entityType,
        entityId,
        this.userIdOrNull(user.id),
        metadata ? JSON.stringify(metadata) : null,
      ],
    );
    const document = rows[0];
    if (entityType && entityId) {
      await this.createLinkInternal(schema, document.id, entityType, entityId, this.normalizeRelationType(body.relation_type), user);
      await this.mirrorProjectFileLink(schema, document.id, entityType, entityId, user);
    }
    await this.activity(schema, document.id, 'uploaded', user, entityType, entityId, { filename: file.originalname, size: file.size });
    await this.notifyDocumentUploaded(schema, document, user);
    return this.sanitizeDocument(document);
  }

  async getDocument(id: string, includeStorageKey = false) {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT d.*, f.name AS folder_name, u.email AS uploaded_by_email
       FROM "${schema}".documents d
       LEFT JOIN "${schema}".document_folders f ON f.id = d.folder_id
       LEFT JOIN "${schema}".users u ON u.id = d.uploaded_by
       WHERE d.id = $1 AND d.deleted_at IS NULL AND ${this.visibilitySql(user, 'd')}
       LIMIT 1`,
      [this.requireUuid(id)],
    );
    if (!rows[0]) throw new NotFoundException('Documento non trovato');
    this.assertFinanceAllowed(user, rows[0]);
    return includeStorageKey ? rows[0] : this.sanitizeDocument(rows[0]);
  }

  async updateDocument(id: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const current = await this.getDocument(id, true);
    const schema = this.getSchema();
    const category = body.category === undefined ? current.category : this.normalizeCategory(body.category);
    const visibility = body.visibility === undefined ? current.visibility : this.normalizeVisibility(body.visibility);
    this.assertFinanceAllowed(user, { ...current, category, visibility });
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".documents
       SET folder_id = $2,
           title = COALESCE($3, title),
           description = $4,
           category = $5,
           visibility = $6,
           metadata = COALESCE($7::jsonb, metadata),
           updated_at = now()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *`,
      [
        current.id,
        body.folder_id === undefined ? current.folder_id : body.folder_id ? this.requireUuid(String(body.folder_id), 'folder_id') : null,
        this.textOrNull(body.title),
        body.description === undefined ? current.description : this.textOrNull(body.description),
        category,
        visibility,
        body.metadata === undefined ? null : JSON.stringify(this.parseMetadata(body.metadata) || {}),
      ],
    );
    await this.activity(schema, id, 'updated', user, current.entity_type, current.entity_id, {});
    return this.sanitizeDocument(rows[0]);
  }

  async setDocumentStatus(id: string, status: 'archived' | 'active' | 'deleted') {
    const user = this.assertCanManage();
    const current = status === 'active'
      ? await this.getDocumentForRestore(id)
      : await this.getDocument(id, true);
    this.assertFinanceAllowed(user, current);
    const schema = this.getSchema();
    const deletedSql = status === 'deleted' ? ', deleted_at = now()' : status === 'active' ? ', deleted_at = NULL' : '';
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".documents
       SET status = $2, updated_at = now() ${deletedSql}
       WHERE id = $1
       RETURNING *`,
      [id, status],
    );
    await this.activity(schema, id, status === 'active' ? 'restored' : status, user, current.entity_type, current.entity_id, {});
    return this.sanitizeDocument(rows[0]);
  }

  async downloadDocument(id: string) {
    const user = this.assertCanRead();
    const document = await this.getDocument(id, true);
    this.assertFinanceAllowed(user, document);
    const schema = this.getSchema();
    const expectedPrefix = `tenant/${schema}/documents/`;
    if (!String(document.storage_key || '').startsWith(expectedPrefix)) {
      throw new ForbiddenException('Storage key non valida per il tenant corrente.');
    }
    await this.activity(schema, document.id, 'downloaded', user, document.entity_type, document.entity_id, {});
    const object = await this.fileStorage.downloadObjectStream(document.storage_key);
    return {
      ...object,
      filename: document.original_filename || document.title || 'documento',
    };
  }

  async createVersion(id: string, file: Express.Multer.File | undefined, body: Record<string, any>) {
    const user = this.assertCanManage();
    const current = await this.getDocument(id, true);
    this.assertFinanceAllowed(user, current);
    if (!file) throw new BadRequestException('file obbligatorio');
    const schema = this.getSchema();
    const key = this.storageKey(schema, file.originalname);
    const stored = await this.fileStorage.uploadBuffer(key, file);
    const maxRows = await this.dataSource.query(
      `SELECT COALESCE(MAX(version_number), 0)::int AS max
       FROM "${schema}".documents
       WHERE version_group_id = $1 AND deleted_at IS NULL`,
      [current.version_group_id || current.id],
    );
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".documents (
         folder_id, title, description, original_filename, stored_filename, mime_type,
         size_bytes, storage_provider, storage_bucket, storage_key, category, visibility,
         status, entity_type, entity_id, uploaded_by, metadata, version_group_id,
         version_number, created_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'minio', $8, $9, $10, $11,
         'active', $12, $13, $14, $15::jsonb, $16, $17, now(), now())
       RETURNING *`,
      [
        current.folder_id,
        this.textOrNull(body.title) || current.title,
        this.textOrNull(body.description) || current.description,
        file.originalname,
        this.safeFilename(file.originalname),
        file.mimetype,
        file.size,
        stored.bucket,
        stored.key,
        current.category,
        current.visibility,
        current.entity_type,
        current.entity_id,
        this.userIdOrNull(user.id),
        JSON.stringify(this.parseMetadata(body.metadata) || current.metadata || {}),
        current.version_group_id || current.id,
        Number(maxRows[0]?.max || current.version_number || 1) + 1,
      ],
    );
    await this.activity(schema, rows[0].id, 'version_created', user, current.entity_type, current.entity_id, { previous_document_id: current.id });
    return this.sanitizeDocument(rows[0]);
  }

  async activityForDocument(id: string) {
    await this.getDocument(id);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `SELECT a.*, u.email AS actor_email
       FROM "${schema}".document_activity a
       LEFT JOIN "${schema}".users u ON u.id = a.actor_user_id
       WHERE a.document_id = $1
       ORDER BY a.created_at DESC
       LIMIT 100`,
      [id],
    );
    return { items: rows };
  }

  async createLink(id: string, body: Record<string, any>) {
    const user = this.assertCanManage();
    const document = await this.getDocument(id, true);
    this.assertFinanceAllowed(user, document);
    const schema = this.getSchema();
    const entityType = this.normalizeEntityType(body.entity_type);
    if (!entityType) throw new BadRequestException('entity_type obbligatorio');
    const entityId = this.requireUuid(String(body.entity_id || ''), 'entity_id');
    this.assertFinanceAllowed(user, { ...document, entity_type: entityType });
    const link = await this.createLinkInternal(schema, id, entityType, entityId, this.normalizeRelationType(body.relation_type), user);
    await this.mirrorProjectFileLink(schema, id, entityType, entityId, user);
    await this.activity(schema, id, 'linked', user, entityType, entityId, { link_id: link.id });
    return link;
  }

  async deleteLink(id: string, linkId: string) {
    const user = this.assertCanManage();
    const document = await this.getDocument(id, true);
    this.assertFinanceAllowed(user, document);
    const schema = this.getSchema();
    const rows = await this.dataSource.query(
      `UPDATE "${schema}".document_links SET deleted_at = now()
       WHERE id = $1 AND document_id = $2 AND deleted_at IS NULL
       RETURNING *`,
      [this.requireUuid(linkId, 'linkId'), id],
    );
    if (!rows[0]) throw new NotFoundException('Link documento non trovato');
    await this.activity(schema, id, 'unlinked', user, rows[0].entity_type, rows[0].entity_id, { link_id: linkId });
    return { success: true };
  }

  async documentsForEntity(entityType: string, entityId: string, query: Record<string, any>) {
    const normalizedType = this.normalizeEntityType(entityType);
    if (!normalizedType) throw new BadRequestException('entityType obbligatorio');
    const normalizedId = this.requireUuid(entityId, 'entityId');
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const limit = this.normalizeLimit(query.limit);
    const offset = this.normalizeOffset(query.offset);
    const status = query.status === undefined ? 'active' : String(query.status);
    const params: unknown[] = [normalizedType, normalizedId];
    const where = [
      'd.deleted_at IS NULL',
      this.visibilitySql(user, 'd'),
      `(d.entity_type = $1 AND d.entity_id = $2 OR EXISTS (
        SELECT 1 FROM "${schema}".document_links dl
        WHERE dl.document_id = d.id AND dl.entity_type = $1 AND dl.entity_id = $2 AND dl.deleted_at IS NULL
      ))`,
    ];
    if (status !== '__all__' && status !== 'all') {
      params.push(this.normalizeStatus(status));
      where.push(`d.status = $${params.length}`);
    }
    const rows = await this.dataSource.query(
      `SELECT d.*, f.name AS folder_name, u.email AS uploaded_by_email
       FROM "${schema}".documents d
       LEFT JOIN "${schema}".document_folders f ON f.id = d.folder_id
       LEFT JOIN "${schema}".users u ON u.id = d.uploaded_by
       WHERE ${where.join(' AND ')}
       ORDER BY d.created_at DESC
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const total = Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".documents d WHERE ${where.join(' AND ')}`,
      params,
    ))[0]?.count || 0);
    return { items: rows.map((row: any) => this.sanitizeDocument(row)), total, limit, offset };
  }

  async summary() {
    const user = this.assertCanRead();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const visibility = this.visibilitySql(user, 'd');
    const count = async (extra = 'TRUE') => Number((await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".documents d WHERE d.deleted_at IS NULL AND ${visibility} AND ${extra}`,
    ))[0]?.count || 0);
    const storageRows = await this.dataSource.query(
      `SELECT COALESCE(SUM(d.size_bytes), 0)::bigint AS bytes
       FROM "${schema}".documents d
       WHERE d.deleted_at IS NULL AND ${visibility}`,
    );
    const recent = await this.dataSource.query(
      `SELECT d.id, d.title, d.original_filename, d.category, d.visibility, d.created_at
       FROM "${schema}".documents d
       WHERE d.deleted_at IS NULL AND ${visibility}
       ORDER BY d.created_at DESC
       LIMIT 5`,
    );
    return {
      totalDocuments: await count(),
      recentDocuments: recent.map((row: any) => this.sanitizeDocument(row)),
      projectDocuments: await count(`(d.entity_type = 'project' OR EXISTS (
        SELECT 1 FROM "${schema}".document_links dl
        WHERE dl.document_id = d.id AND dl.entity_type = 'project' AND dl.deleted_at IS NULL
      ))`),
      financeDocuments: this.canViewFinance(user.role) ? await count(`(d.visibility = 'finance' OR d.category IN ('finance', 'invoice', 'receipt'))`) : 0,
      storageUsedBytes: Number(storageRows[0]?.bytes || 0),
    };
  }

  async seedBaseFolders() {
    const schema = this.getSchema();
    await seedDoflowDocumentFolders(this.dataSource, schema);
    return this.listFolders({});
  }

  private async createLinkInternal(schema: string, documentId: string, entityType: string, entityId: string, relationType: string, user: AuthUser) {
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".document_links (document_id, entity_type, entity_id, relation_type, created_by, created_at)
       VALUES ($1, $2, $3, $4, $5, now())
       ON CONFLICT (document_id, entity_type, entity_id, relation_type) WHERE deleted_at IS NULL DO UPDATE
         SET deleted_at = NULL
       RETURNING *`,
      [documentId, entityType, entityId, relationType, this.userIdOrNull(user.id)],
    );
    return rows[0];
  }

  private async getDocumentForRestore(id: string) {
    const user = this.getUser();
    const schema = this.getSchema();
    await this.ensureSchema(schema);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".documents
       WHERE id = $1 AND ${this.visibilitySql(user, 'documents')}
       LIMIT 1`,
      [this.requireUuid(id)],
    );
    if (!rows[0]) throw new NotFoundException('Documento non trovato');
    return rows[0];
  }

  private async mirrorProjectFileLink(schema: string, documentId: string, entityType: string, entityId: string, user: AuthUser) {
    if (!(await this.tableExists(schema, 'project_file_links'))) return;
    let projectId: string | null = null;
    let taskId: string | null = null;
    if (entityType === 'project') {
      projectId = entityId;
    } else if (entityType === 'task' && await this.tableExists(schema, 'tasks')) {
      const rows = await this.dataSource.query(
        `SELECT project_id FROM "${schema}".tasks WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [entityId],
      );
      projectId = rows[0]?.project_id || null;
      taskId = entityId;
    }
    if (!projectId) return;
    await this.dataSource.query(
      `INSERT INTO "${schema}".project_file_links (project_id, task_id, file_id, type, visibility, created_by, created_at)
       VALUES ($1, $2, $3, 'other', 'internal', $4, now())
       ON CONFLICT DO NOTHING`,
      [projectId, taskId, documentId, this.userIdOrNull(user.id)],
    ).catch(() => undefined);
  }

  private async activity(schema: string, documentId: string | null, action: string, user: AuthUser, entityType: string | null, entityId: string | null, metadata: Record<string, unknown>) {
    await this.dataSource.query(
      `INSERT INTO "${schema}".document_activity (document_id, action, actor_user_id, entity_type, entity_id, metadata, created_at)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb, now())`,
      [documentId, action, this.userIdOrNull(user.id), entityType, entityId, JSON.stringify(metadata || {})],
    );
  }

  private async notifyDocumentUploaded(schema: string, document: Record<string, any>, user: AuthUser) {
    if (!(await this.tableExists(schema, 'notifications'))) return;
    if (!['project', 'task', 'briefing', 'quote'].includes(String(document.entity_type || ''))) return;
    const recipientRole = hasRoleAtLeast(user.role, 'manager') ? 'manager' : 'owner';
    await this.dataSource.query(
      `INSERT INTO "${schema}".notifications (
         recipient_role, title, body, type, priority, entity_type, entity_id, link_url,
         fingerprint, metadata, created_by, created_at, updated_at
       )
       VALUES ($1, $2, $3, 'system', 'medium', $4, $5, $6, $7, $8::jsonb, $9, now(), now())
       ON CONFLICT (fingerprint) WHERE fingerprint IS NOT NULL AND deleted_at IS NULL AND status <> 'archived' DO NOTHING`,
      [
        recipientRole,
        `Documento caricato: ${document.title}`,
        document.original_filename || null,
        document.entity_type,
        document.entity_id,
        document.entity_type === 'project' ? `/projects/${document.entity_id}` : '/documents',
        `document_uploaded:${document.id}`,
        JSON.stringify({ document_id: document.id, category: document.category }),
        this.userIdOrNull(user.id),
      ],
    ).catch(() => undefined);
  }
}
