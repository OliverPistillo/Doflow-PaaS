import { BadRequestException, ForbiddenException, HttpException, HttpStatus, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, QueryRunner } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { ensureTenantCredentialsTables } from './tenant-credentials-schema';
import { TenantCredentialsCryptoService } from './tenant-credentials-crypto.service';
import { TenantCredentialsPermissionsService } from './tenant-credentials-permissions.service';
import {
  AuthUser,
  CREDENTIAL_ACCESS_SCOPES,
  CREDENTIAL_AUDIT_ACTIONS,
  CREDENTIAL_AUDIT_OUTCOMES,
  CREDENTIAL_ENVIRONMENTS,
  CREDENTIAL_KINDS,
  CREDENTIAL_LINK_ENTITY_TYPES,
  CREDENTIAL_LINK_RELATIONS,
  CREDENTIAL_SECRET_KEYS,
  CREDENTIAL_STATUSES,
  CredentialSecretPayload,
  hasCredentialSensitiveKey,
  redactCredentialSensitive,
} from './tenant-credentials.types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{12}$/i;
const SORT_COLUMNS = ['title', 'kind', 'provider', 'environment', 'status', 'expires_at', 'renewal_at', 'rotation_due_at', 'updated_at', 'created_at'];

@Injectable()
export class TenantCredentialsService {
  private static revealBuckets = new Map<string, { count: number; resetAt: number }>();

  static resetRevealRateLimitForTests() {
    TenantCredentialsService.revealBuckets.clear();
  }

  constructor(
    private readonly dataSource: DataSource,
    private readonly crypto: TenantCredentialsCryptoService,
    private readonly permissions: TenantCredentialsPermissionsService,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  async options() {
    return {
      kinds: CREDENTIAL_KINDS,
      environments: CREDENTIAL_ENVIRONMENTS,
      statuses: CREDENTIAL_STATUSES,
      accessScopes: CREDENTIAL_ACCESS_SCOPES,
      linkEntityTypes: CREDENTIAL_LINK_ENTITY_TYPES,
      linkRelations: CREDENTIAL_LINK_RELATIONS,
      auditActions: CREDENTIAL_AUDIT_ACTIONS,
      auditOutcomes: CREDENTIAL_AUDIT_OUTCOMES,
      secretFields: CREDENTIAL_SECRET_KEYS,
    };
  }

  async dashboard() {
    const schema = this.getSchema();
    const user = this.getUser();
    await this.ensureSchema(schema);
    const visibility = await this.visibilityWhere(schema, user, 'ci');
    const rows = await this.dataSource.query(
      `SELECT
         COUNT(*)::int AS "totalCredentials",
         COUNT(*) FILTER (WHERE ci.status = 'active')::int AS "activeCredentials",
         COUNT(*) FILTER (WHERE ci.status = 'archived')::int AS "archivedCredentials",
         COUNT(*) FILTER (WHERE ci.expires_at IS NOT NULL AND ci.expires_at <= now() + interval '30 days' AND ci.expires_at >= now())::int AS "expiringCredentials",
         COUNT(*) FILTER (WHERE ci.renewal_at IS NOT NULL AND ci.renewal_at <= now() + interval '30 days')::int AS "renewalsDue",
         COUNT(*) FILTER (WHERE ci.rotation_due_at IS NOT NULL AND ci.rotation_due_at <= now() + interval '30 days')::int AS "rotationDue",
         COUNT(*) FILTER (WHERE ci.expires_at IS NOT NULL AND ci.expires_at < now())::int AS "expiredCredentials"
       FROM "${schema}".credential_items ci
       WHERE ci.deleted_at IS NULL AND ${visibility.sql}`,
      visibility.params,
    );
    return {
      totalCredentials: Number(rows[0]?.totalCredentials || 0),
      activeCredentials: Number(rows[0]?.activeCredentials || 0),
      archivedCredentials: Number(rows[0]?.archivedCredentials || 0),
      expiringCredentials: Number(rows[0]?.expiringCredentials || 0),
      renewalsDue: Number(rows[0]?.renewalsDue || 0),
      rotationDue: Number(rows[0]?.rotationDue || 0),
      expiredCredentials: Number(rows[0]?.expiredCredentials || 0),
    };
  }

  async list(query: Record<string, any>) {
    const schema = this.getSchema();
    const user = this.getUser();
    await this.ensureSchema(schema);
    const visibility = await this.visibilityWhere(schema, user, 'ci');
    const limit = this.limit(query.limit);
    const offset = this.offset(query.offset);
    const where = [`ci.deleted_at IS NULL`, visibility.sql];
    const params: any[] = [...visibility.params];
    const add = (sql: string, value: unknown) => {
      params.push(value);
      where.push(sql.replace('?', `$${params.length}`));
    };
    if (query.search) {
      const term = `%${String(query.search).trim()}%`;
      params.push(term, term, term, term);
      const base = params.length - 3;
      where.push(`(ci.title ILIKE $${base} OR ci.provider ILIKE $${base + 1} OR ci.account_label ILIKE $${base + 2} OR ci.domain_name ILIKE $${base + 3})`);
    }
    if (query.kind) add(`ci.kind = ?`, this.requireEnum(query.kind, CREDENTIAL_KINDS, 'kind'));
    if (query.environment) add(`ci.environment = ?`, this.requireEnum(query.environment, CREDENTIAL_ENVIRONMENTS, 'environment'));
    if (query.status) add(`ci.status = ?`, this.requireEnum(query.status, CREDENTIAL_STATUSES, 'status'));
    if (query.access_scope) add(`ci.access_scope = ?`, this.requireEnum(query.access_scope, CREDENTIAL_ACCESS_SCOPES, 'access_scope'));
    if (query.owner_user_id) add(`ci.owner_user_id = ?`, this.requireUuid(query.owner_user_id, 'owner_user_id'));
    if (query.expiring === 'true') where.push(`ci.expires_at IS NOT NULL AND ci.expires_at <= now() + interval '30 days'`);
    if (query.rotation_due === 'true') where.push(`ci.rotation_due_at IS NOT NULL AND ci.rotation_due_at <= now() + interval '30 days'`);
    if (query.renewal_due === 'true') where.push(`ci.renewal_at IS NOT NULL AND ci.renewal_at <= now() + interval '30 days'`);

    if (query.sort && !SORT_COLUMNS.includes(String(query.sort))) throw new BadRequestException('sort non valido');
    const sort = query.sort ? String(query.sort) : 'updated_at';
    const dir = String(query.dir || '').toLowerCase() === 'asc' ? 'ASC' : 'DESC';
    const rows = await this.dataSource.query(
      `SELECT ${this.itemColumns('ci')}, (cs.id IS NOT NULL) AS has_secret, cs.secret_version, cs.updated_at AS secret_updated_at
       FROM "${schema}".credential_items ci
       LEFT JOIN "${schema}".credential_secrets cs ON cs.credential_item_id = ci.id
       WHERE ${where.join(' AND ')}
       ORDER BY ci.${sort} ${dir}
       LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
      [...params, limit, offset],
    );
    const total = await this.dataSource.query(
      `SELECT COUNT(*)::int AS count FROM "${schema}".credential_items ci WHERE ${where.join(' AND ')}`,
      params,
    );
    return { items: rows.map((row: any) => this.sanitizeItem(row)), total: Number(total[0]?.count || 0), limit, offset };
  }

  async expiring(query: Record<string, any>) {
    return this.list({ ...query, expiring: 'true', sort: query.sort || 'expires_at', dir: query.dir || 'asc' });
  }

  async renewalsDue(query: Record<string, any>) {
    return this.list({ ...query, renewal_due: 'true', sort: query.sort || 'renewal_at', dir: query.dir || 'asc' });
  }

  async rotationDue(query: Record<string, any>) {
    return this.list({ ...query, rotation_due: 'true', sort: query.sort || 'rotation_due_at', dir: query.dir || 'asc' });
  }

  async create(body: Record<string, any>) {
    const schema = this.getSchema();
    const user = this.getUser();
    await this.ensureSchema(schema);
    await this.permissions.assertCanCreate(schema, user);
    const input = this.validateItemInput(body, true);
    const secret = body.secret ? this.validateSecretPayload(body.secret) : null;
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const rows = await runner.query(
        `INSERT INTO "${schema}".credential_items (
           title, kind, provider, account_label, login_url, domain_name, environment, status, access_scope,
           owner_user_id, expires_at, renewal_at, rotation_due_at, last_rotated_at, auto_renew, description,
           metadata, created_by, updated_by, created_at, updated_at
         )
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17::jsonb,$18,$18,now(),now())
         RETURNING ${this.itemColumns()}`,
        [
          input.title, input.kind, input.provider, input.account_label, input.login_url, input.domain_name,
          input.environment, input.status, input.access_scope, input.owner_user_id, input.expires_at,
          input.renewal_at, input.rotation_due_at, input.last_rotated_at, input.auto_renew, input.description,
          JSON.stringify(input.metadata || {}), this.userIdOrNull(user.id),
        ],
      );
      const item = rows[0];
      if (!this.permissions.isAdmin(user) && this.userIdOrNull(user.id)) {
        await runner.query(
          `INSERT INTO "${schema}".credential_permissions (
             credential_item_id, user_id, can_view_metadata, can_reveal_secret, can_edit, can_manage_permissions, granted_by, created_at, updated_at
           ) VALUES ($1,$2,true,true,true,true,$2,now(),now())`,
          [item.id, this.userIdOrNull(user.id)],
        );
      }
      if (secret) await this.upsertSecret(runner, schema, item.id, secret, 1, user, false);
      await this.audit(runner, schema, item.id, user, 'credential_created', 'success', body.reason, { has_secret: Boolean(secret) });
      await runner.commitTransaction();
      return this.get(item.id);
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
  }

  async get(id: string) {
    const schema = this.getSchema();
    const user = this.getUser();
    await this.ensureSchema(schema);
    const itemId = this.requireUuid(id, 'credential_id');
    await this.permissions.assertCanReadItem(schema, itemId, user);
    const rows = await this.dataSource.query(
      `SELECT ${this.itemColumns('ci')}, (cs.id IS NOT NULL) AS has_secret, cs.secret_version, cs.updated_at AS secret_updated_at
       FROM "${schema}".credential_items ci
       LEFT JOIN "${schema}".credential_secrets cs ON cs.credential_item_id = ci.id
       WHERE ci.id = $1 AND ci.deleted_at IS NULL`,
      [itemId],
    );
    if (!rows[0]) throw new NotFoundException('Credenziale non trovata');
    return this.sanitizeItem(rows[0]);
  }

  async update(id: string, body: Record<string, any>) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanEditItem(schema, itemId, user);
    const input = this.validateItemInput(body, false);
    const fields: string[] = [];
    const params: any[] = [];
    for (const [key, value] of Object.entries(input)) {
      params.push(key === 'metadata' ? JSON.stringify(value || {}) : value);
      fields.push(`${key} = $${params.length}${key === 'metadata' ? '::jsonb' : ''}`);
    }
    if (!fields.length) return this.get(itemId);
    params.push(this.userIdOrNull(user.id), itemId);
    await this.dataSource.query(
      `UPDATE "${schema}".credential_items
       SET ${fields.join(', ')}, updated_by = $${params.length - 1}, updated_at = now()
       WHERE id = $${params.length} AND deleted_at IS NULL`,
      params,
    );
    await this.audit(null, schema, itemId, user, 'credential_updated', 'success', body.reason, { fields: Object.keys(input) });
    return this.get(itemId);
  }

  async archive(id: string) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanEditItem(schema, itemId, user);
    await this.dataSource.query(`UPDATE "${schema}".credential_items SET status = 'archived', deleted_at = now(), updated_at = now(), updated_by = $2 WHERE id = $1`, [itemId, this.userIdOrNull(user.id)]);
    await this.audit(null, schema, itemId, user, 'credential_archived', 'success');
    return { ok: true };
  }

  async restore(id: string) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    if (!this.permissions.isAdmin(user)) throw new ForbiddenException('Non hai permessi per questa operazione.');
    await this.dataSource.query(`UPDATE "${schema}".credential_items SET status = 'active', deleted_at = NULL, updated_at = now(), updated_by = $2 WHERE id = $1`, [itemId, this.userIdOrNull(user.id)]);
    await this.audit(null, schema, itemId, user, 'credential_restored', 'success');
    return this.get(itemId);
  }

  async replaceSecret(id: string, body: Record<string, any>) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanEditItem(schema, itemId, user);
    const secret = this.validateSecretPayload(body.secret || body);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const existingRows = await runner.query(
        `SELECT * FROM "${schema}".credential_secrets WHERE credential_item_id = $1 FOR UPDATE`,
        [itemId],
      );
      const existing = existingRows[0] || null;
      const reason = existing ? this.validateAuditReason(body.reason, true) : this.validateAuditReason(body.reason, false);
      const newVersion = existing ? Number(existing.secret_version || 1) + 1 : 1;
      await this.upsertSecret(runner, schema, itemId, secret, newVersion, user, Boolean(existing));
      await this.audit(runner, schema, itemId, user, existing ? 'secret_replaced' : 'secret_created', 'success', reason, { secret_version: newVersion });
      await runner.commitTransaction();
      return { ok: true, secret_version: newVersion };
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
  }

  async reveal(id: string, body: Record<string, any>) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    let reason: string;
    try {
      reason = this.validateAuditReason(body.reason, true);
    } catch (err) {
      await this.audit(null, schema, itemId, user, 'secret_reveal_denied', 'denied', 'Motivo rifiutato dalla validazione', { validation_error: 'reason' }).catch(() => undefined);
      throw err;
    }
    this.checkRevealRate(user);
    try {
      await this.permissions.assertCanRevealItem(schema, itemId, user);
      const row = await this.getSecretRow(schema, itemId);
      if (!row) throw new NotFoundException('Segreto non configurato');
      const secret = this.crypto.decryptPayload(schema, itemId, row);
      await this.audit(null, schema, itemId, user, 'secret_revealed', 'success', reason, { secret_version: Number(row.secret_version) });
      return {
        credential_item_id: itemId,
        secret_version: Number(row.secret_version),
        payload_version: Number(row.payload_version),
        revealed_at: new Date().toISOString(),
        secret,
      };
    } catch (err) {
      await this.audit(null, schema, itemId, user, 'secret_reveal_denied', 'denied', reason, { error: err instanceof Error ? err.name : 'Error' }).catch(() => undefined);
      throw err;
    }
  }

  async rotate(id: string, body: Record<string, any>) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanEditItem(schema, itemId, user);
    const reason = this.validateAuditReason(body.reason, true);
    const nextRotationDueAt = body.next_rotation_due_at ? this.isoDate(body.next_rotation_due_at, 'next_rotation_due_at') : null;
    const secret = this.validateSecretPayload(body.secret);
    const runner = this.dataSource.createQueryRunner();
    await runner.connect();
    await runner.startTransaction();
    try {
      const existingRows = await runner.query(
        `SELECT * FROM "${schema}".credential_secrets WHERE credential_item_id = $1 FOR UPDATE`,
        [itemId],
      );
      const existing = existingRows[0];
      if (!existing) throw new BadRequestException('Segreto non configurato');
      const previousVersion = Number(existing.secret_version || 0);
      const newVersion = previousVersion + 1;
      await this.upsertSecret(runner, schema, itemId, secret, newVersion, user, true);
      const itemRows = await runner.query(
        `UPDATE "${schema}".credential_items
         SET last_rotated_at = now(),
             rotation_due_at = COALESCE($2::timestamptz, rotation_due_at),
             updated_at = now(),
             updated_by = $3
         WHERE id = $1 AND deleted_at IS NULL
         RETURNING last_rotated_at, rotation_due_at`,
        [itemId, nextRotationDueAt, this.userIdOrNull(user.id)],
      );
      if (!itemRows[0]) throw new NotFoundException('Credenziale non trovata');
      await runner.query(
        `INSERT INTO "${schema}".credential_rotation_history (
           credential_item_id, previous_secret_version, new_secret_version, rotated_by, reason, rotated_at, next_rotation_due_at
         ) VALUES ($1,$2,$3,$4,$5,now(),$6)`,
        [itemId, previousVersion, newVersion, this.userIdOrNull(user.id), reason, nextRotationDueAt],
      );
      await this.audit(runner, schema, itemId, user, 'credential_rotated', 'success', reason, { secret_version: newVersion, next_rotation_due_at: nextRotationDueAt });
      await runner.commitTransaction();
      return {
        ok: true,
        secret_version: newVersion,
        last_rotated_at: itemRows[0].last_rotated_at,
        rotation_due_at: itemRows[0].rotation_due_at,
      };
    } catch (err) {
      await runner.rollbackTransaction();
      throw err;
    } finally {
      await runner.release();
    }
  }

  async listPermissions(id: string) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanManagePermissions(schema, itemId, user);
    const rows = await this.dataSource.query(
      `SELECT cp.id, cp.credential_item_id, cp.user_id, u.email, u.full_name,
              cp.can_view_metadata, cp.can_reveal_secret, cp.can_edit, cp.can_manage_permissions,
              cp.granted_by, cp.created_at, cp.updated_at
       FROM "${schema}".credential_permissions cp
       LEFT JOIN "${schema}".users u ON u.id = cp.user_id
       WHERE cp.credential_item_id = $1 AND cp.deleted_at IS NULL
       ORDER BY cp.updated_at DESC`,
      [itemId],
    );
    return { items: rows };
  }

  async grantPermission(id: string, body: Record<string, any>) {
    return this.upsertPermission(id, body, false);
  }

  async updatePermission(id: string, permissionId: string, body: Record<string, any>) {
    return this.upsertPermission(id, { ...body, permission_id: permissionId }, true);
  }

  async deletePermission(id: string, permissionId: string) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    const permId = this.requireUuid(permissionId, 'permission_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanManagePermissions(schema, itemId, user);
    const rows = await this.dataSource.query(`SELECT user_id FROM "${schema}".credential_permissions WHERE id = $1 AND credential_item_id = $2 AND deleted_at IS NULL`, [permId, itemId]);
    if (!rows[0]) throw new NotFoundException('Permesso non trovato');
    if (!this.permissions.isAdmin(user) && rows[0].user_id === this.userIdOrNull(user.id)) throw new ForbiddenException('Non puoi modificare i tuoi permessi');
    await this.dataSource.query(`UPDATE "${schema}".credential_permissions SET deleted_at = now(), updated_at = now() WHERE id = $1`, [permId]);
    await this.audit(null, schema, itemId, user, 'permission_revoked', 'success', undefined, { permission_id: permId });
    return { ok: true };
  }

  async listLinks(id: string) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanReadItem(schema, itemId, user);
    const rows = await this.dataSource.query(
      `SELECT id, credential_item_id, entity_type, entity_id, relation, metadata, created_by, created_at
       FROM "${schema}".credential_links
       WHERE credential_item_id = $1 AND deleted_at IS NULL
       ORDER BY created_at DESC`,
      [itemId],
    );
    return { items: rows };
  }

  async createLink(id: string, body: Record<string, any>) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanEditItem(schema, itemId, user);
    const entityType = this.requireEnum(body.entity_type || body.entityType, CREDENTIAL_LINK_ENTITY_TYPES, 'entity_type');
    const entityId = this.requireUuid(body.entity_id || body.entityId, 'entity_id');
    const relation = this.requireEnum(body.relation || body.relation_type || body.relationType || 'related_to', CREDENTIAL_LINK_RELATIONS, 'relation');
    const metadata = this.jsonObject(body.metadata, 'metadata');
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".credential_links (
         credential_item_id, entity_type, entity_id, relation, metadata, created_by, created_at
       ) VALUES ($1,$2,$3,$4,$5::jsonb,$6,now())
       ON CONFLICT (credential_item_id, entity_type, entity_id, relation) WHERE deleted_at IS NULL DO UPDATE
         SET metadata = EXCLUDED.metadata
       RETURNING id, credential_item_id, entity_type, entity_id, relation, metadata, created_by, created_at`,
      [itemId, entityType, entityId, relation, JSON.stringify(metadata), this.userIdOrNull(user.id)],
    );
    await this.audit(null, schema, itemId, user, 'link_created', 'success', undefined, { entity_type: entityType, entity_id: entityId, relation });
    return rows[0];
  }

  async deleteLink(id: string, linkId: string) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    const safeLinkId = this.requireUuid(linkId, 'link_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanEditItem(schema, itemId, user);
    await this.dataSource.query(`UPDATE "${schema}".credential_links SET deleted_at = now() WHERE id = $1 AND credential_item_id = $2`, [safeLinkId, itemId]);
    await this.audit(null, schema, itemId, user, 'link_deleted', 'success', undefined, { link_id: safeLinkId });
    return { ok: true };
  }

  async auditLog(id: string, query: Record<string, any>) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanReadItem(schema, itemId, user);
    const limit = this.limit(query.limit);
    const rows = await this.dataSource.query(
      `SELECT id, credential_item_id, actor_user_id, action, outcome, reason, request_id, metadata, created_at
       FROM "${schema}".credential_audit_log
       WHERE credential_item_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [itemId, limit],
    );
    return { items: rows.map((row: any) => ({ ...row, metadata: redactCredentialSensitive(row.metadata || {}) })) };
  }

  async rotations(id: string) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanReadItem(schema, itemId, user);
    const rows = await this.dataSource.query(
      `SELECT id, credential_item_id, previous_secret_version, new_secret_version, rotated_by, reason, rotated_at, next_rotation_due_at
       FROM "${schema}".credential_rotation_history
       WHERE credential_item_id = $1
       ORDER BY rotated_at DESC`,
      [itemId],
    );
    return { items: rows };
  }

  async activity(query: Record<string, any>) {
    const schema = this.getSchema();
    const user = this.getUser();
    await this.ensureSchema(schema);
    if (!this.permissions.isAdmin(user) && !(await this.permissions.canUseModule(schema, user, 'audit'))) {
      throw new ForbiddenException('Non hai permessi per questa operazione.');
    }
    const limit = this.limit(query.limit);
    const rows = await this.dataSource.query(
      `SELECT id, credential_item_id, actor_user_id, action, outcome, reason, request_id, metadata, created_at
       FROM "${schema}".credential_audit_log
       ORDER BY created_at DESC
       LIMIT $1`,
      [limit],
    );
    return { items: rows.map((row: any) => ({ ...row, metadata: redactCredentialSensitive(row.metadata || {}) })) };
  }

  async export(id: string) {
    const schema = this.getSchema();
    const user = this.getUser();
    const item = await this.get(id);
    await this.permissions.assertCanReadItem(schema, item.id, user);
    const [links, rotations] = await Promise.all([this.listLinks(item.id), this.rotations(item.id)]);
    await this.audit(null, schema, item.id, user, 'export_created', 'success');
    return { item, links: links.items, rotations: rotations.items, exported_at: new Date().toISOString(), secrets_included: false };
  }

  async exportAll(query: Record<string, any> = {}) {
    const schema = this.getSchema();
    const user = this.getUser();
    const list = await this.list({ ...query, limit: Math.min(this.limit(query.limit), 100) });
    await this.audit(null, schema, null, user, 'export_created', 'success', undefined, {
      scope: 'credentials_metadata',
      count: list.items.length,
    });
    return {
      items: list.items,
      total: list.total,
      exported_at: new Date().toISOString(),
      secrets_included: false,
    };
  }

  private async upsertPermission(id: string, body: Record<string, any>, byPermissionId: boolean) {
    const schema = this.getSchema();
    const user = this.getUser();
    const itemId = this.requireUuid(id, 'credential_id');
    await this.ensureSchema(schema);
    await this.permissions.assertCanManagePermissions(schema, itemId, user);
    let userId = this.requireUuid(body.user_id || body.userId, 'user_id');
    let existingPermissionId: string | null = null;
    if (byPermissionId) {
      existingPermissionId = this.requireUuid(body.permission_id, 'permission_id');
      const existing = await this.dataSource.query(`SELECT user_id FROM "${schema}".credential_permissions WHERE id = $1 AND credential_item_id = $2 AND deleted_at IS NULL`, [existingPermissionId, itemId]);
      if (!existing[0]) throw new NotFoundException('Permesso non trovato');
      userId = existing[0].user_id;
    } else {
      const userRows = await this.dataSource.query(`SELECT id FROM "${schema}".users WHERE id = $1 LIMIT 1`, [userId]);
      if (!userRows[0]) throw new BadRequestException('Utente tenant non valido');
    }
    if (!this.permissions.isAdmin(user) && userId === this.userIdOrNull(user.id)) throw new ForbiddenException('Non puoi modificare i tuoi permessi');
    const values = [
      itemId,
      userId,
      this.boolean(body.can_view_metadata ?? body.canViewMetadata ?? true),
      this.boolean(body.can_reveal_secret ?? body.canRevealSecret ?? false),
      this.boolean(body.can_edit ?? body.canEdit ?? false),
      this.boolean(body.can_manage_permissions ?? body.canManagePermissions ?? false),
      this.userIdOrNull(user.id),
    ];
    const rows = await this.dataSource.query(
      byPermissionId
        ? `UPDATE "${schema}".credential_permissions
           SET can_view_metadata = $3, can_reveal_secret = $4, can_edit = $5, can_manage_permissions = $6, granted_by = $7, updated_at = now()
           WHERE credential_item_id = $1 AND user_id = $2 AND deleted_at IS NULL
           RETURNING *`
        : `INSERT INTO "${schema}".credential_permissions (
             credential_item_id, user_id, can_view_metadata, can_reveal_secret, can_edit, can_manage_permissions, granted_by, created_at, updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,now(),now())
           ON CONFLICT (credential_item_id, user_id) WHERE deleted_at IS NULL DO UPDATE
             SET can_view_metadata = EXCLUDED.can_view_metadata,
                 can_reveal_secret = EXCLUDED.can_reveal_secret,
                 can_edit = EXCLUDED.can_edit,
                 can_manage_permissions = EXCLUDED.can_manage_permissions,
                 granted_by = EXCLUDED.granted_by,
                 updated_at = now()
           RETURNING *`,
      values,
    );
    await this.audit(null, schema, itemId, user, byPermissionId ? 'permission_updated' : 'permission_granted', 'success', undefined, { user_id: userId });
    return rows[0];
  }

  private async upsertSecret(runner: QueryRunner, schema: string, itemId: string, secret: CredentialSecretPayload, secretVersion: number, user: AuthUser, hadExisting: boolean) {
    const encrypted = this.crypto.encryptPayload(schema, itemId, secretVersion, secret);
    if (hadExisting) {
      await runner.query(
        `UPDATE "${schema}".credential_secrets
         SET encrypted_payload = $2, payload_iv = $3, payload_auth_tag = $4, encrypted_dek = $5, dek_iv = $6,
             dek_auth_tag = $7, key_version = $8, payload_version = $9, secret_version = $10, updated_by = $11, updated_at = now()
         WHERE credential_item_id = $1`,
        [
          itemId,
          encrypted.encrypted_payload,
          encrypted.payload_iv,
          encrypted.payload_auth_tag,
          encrypted.encrypted_dek,
          encrypted.dek_iv,
          encrypted.dek_auth_tag,
          encrypted.key_version,
          encrypted.payload_version,
          encrypted.secret_version,
          this.userIdOrNull(user.id),
        ],
      );
    } else {
      await runner.query(
        `INSERT INTO "${schema}".credential_secrets (
           credential_item_id, encrypted_payload, payload_iv, payload_auth_tag, encrypted_dek, dek_iv, dek_auth_tag,
           key_version, payload_version, secret_version, created_by, updated_by, created_at, updated_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$11,now(),now())`,
        [
          itemId,
          encrypted.encrypted_payload,
          encrypted.payload_iv,
          encrypted.payload_auth_tag,
          encrypted.encrypted_dek,
          encrypted.dek_iv,
          encrypted.dek_auth_tag,
          encrypted.key_version,
          encrypted.payload_version,
          encrypted.secret_version,
          this.userIdOrNull(user.id),
        ],
      );
    }
    await runner.query(`UPDATE "${schema}".credential_items SET updated_at = now(), updated_by = $2 WHERE id = $1`, [itemId, this.userIdOrNull(user.id)]);
  }

  private async getSecretRow(schema: string, itemId: string) {
    const rows = await this.dataSource.query(`SELECT * FROM "${schema}".credential_secrets WHERE credential_item_id = $1 LIMIT 1`, [itemId]);
    return rows[0] || null;
  }

  private async visibilityWhere(schema: string, user: AuthUser, alias: string) {
    if (this.permissions.isAdmin(user)) return { sql: 'TRUE', params: [] };
    const moduleOk = await this.permissions.canUseModule(schema, user, 'read');
    if (!moduleOk) return { sql: 'FALSE', params: [] };
    const userId = this.userIdOrNull(user.id);
    if (!userId) return { sql: 'FALSE', params: [] };
    return {
      sql: `EXISTS (
        SELECT 1 FROM "${schema}".credential_permissions cp
        WHERE cp.credential_item_id = ${alias}.id
          AND cp.user_id = $1
          AND cp.can_view_metadata = true
          AND cp.deleted_at IS NULL
      )`,
      params: [userId],
    };
  }

  private async audit(runner: QueryRunner | null, schema: string, itemId: string | null, user: AuthUser, action: string, outcome: string, reason?: string | null, metadata: Record<string, any> = {}) {
    const safeReason = this.validateAuditReason(reason, false);
    const query = `INSERT INTO "${schema}".credential_audit_log (
      credential_item_id, actor_user_id, action, outcome, reason, request_id, metadata, created_at
    ) VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,now())`;
    const params = [
      itemId,
      this.userIdOrNull(user.id),
      this.requireEnum(action, CREDENTIAL_AUDIT_ACTIONS, 'action'),
      this.requireEnum(outcome, CREDENTIAL_AUDIT_OUTCOMES, 'outcome'),
      safeReason,
      this.text(this.request.headers?.['x-request-id']),
      JSON.stringify(this.sanitizeAuditMetadata(metadata || {})),
    ];
    if (runner) await runner.query(query, params);
    else await this.dataSource.query(query, params);
  }

  private validateItemInput(body: Record<string, any>, create: boolean) {
    this.rejectUnknownKeys(body, new Set([
      'title',
      'kind',
      'provider',
      'account_label',
      'login_url',
      'domain_name',
      'environment',
      'status',
      'access_scope',
      'owner_user_id',
      'expires_at',
      'renewal_at',
      'rotation_due_at',
      'last_rotated_at',
      'auto_renew',
      'description',
      'metadata',
      'secret',
      'reason',
    ]));
    const out: Record<string, any> = {};
    const assignText = (key: string, max = 500) => {
      if (body[key] !== undefined) out[key] = this.text(body[key], max);
    };
    assignText('title', 240);
    if (create && !out.title) throw new BadRequestException('title obbligatorio');
    if (body.kind !== undefined || create) out.kind = this.requireEnum(body.kind || 'other', CREDENTIAL_KINDS, 'kind');
    assignText('provider', 240);
    assignText('account_label', 240);
    assignText('login_url', 1000);
    if (out.login_url) this.validateUrl(out.login_url, 'login_url');
    assignText('domain_name', 255);
    if (body.environment !== undefined || create) out.environment = this.requireEnum(body.environment || 'production', CREDENTIAL_ENVIRONMENTS, 'environment');
    if (body.status !== undefined || create) out.status = this.requireEnum(body.status || 'active', CREDENTIAL_STATUSES, 'status');
    if (body.access_scope !== undefined || create) out.access_scope = this.requireEnum(body.access_scope || 'restricted', CREDENTIAL_ACCESS_SCOPES, 'access_scope');
    if (body.owner_user_id !== undefined) out.owner_user_id = body.owner_user_id ? this.requireUuid(body.owner_user_id, 'owner_user_id') : null;
    for (const key of ['expires_at', 'renewal_at', 'rotation_due_at', 'last_rotated_at']) {
      if (body[key] !== undefined) out[key] = body[key] ? this.isoDate(body[key], key) : null;
    }
    if (body.auto_renew !== undefined) out.auto_renew = this.boolean(body.auto_renew);
    assignText('description', 4000);
    if (body.metadata !== undefined) out.metadata = this.jsonObject(body.metadata, 'metadata');
    if (create && out.metadata === undefined) out.metadata = {};
    return out;
  }

  private validateSecretPayload(value: unknown): CredentialSecretPayload {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException('secret non valido');
    const source = value as Record<string, any>;
    const allowed = new Set<string>(CREDENTIAL_SECRET_KEYS as unknown as string[]);
    for (const key of Object.keys(source)) {
      if (!allowed.has(key)) throw new BadRequestException(`Campo segreto non consentito: ${key}`);
    }
    const out: CredentialSecretPayload = {};
    const optional = (key: keyof CredentialSecretPayload, max = 10000) => {
      if (source[key] !== undefined) (out as any)[key] = source[key] === null ? null : this.text(source[key], max);
    };
    optional('username', 1000);
    optional('password');
    optional('apiKey');
    optional('secretKey');
    optional('token');
    optional('privateNotes');
    if (source.recoveryCodes !== undefined) {
      if (source.recoveryCodes === null) out.recoveryCodes = null;
      else if (!Array.isArray(source.recoveryCodes) || source.recoveryCodes.length > 50) throw new BadRequestException('recoveryCodes non valido');
      else out.recoveryCodes = source.recoveryCodes.map((entry: unknown) => this.text(entry, 1000) || '');
    }
    if (source.customFields !== undefined) {
      if (source.customFields === null) out.customFields = null;
      else if (!Array.isArray(source.customFields) || source.customFields.length > 50) throw new BadRequestException('customFields non valido');
      else out.customFields = source.customFields.map((entry: any) => {
        if (!entry || typeof entry !== 'object') throw new BadRequestException('customFields non valido');
        const label = this.text(entry.label, 120);
        if (!label) throw new BadRequestException('customFields.label obbligatorio');
        return { label, value: this.text(entry.value, 10000) || '', secret: Boolean(entry.secret) };
      });
    }
    return out;
  }

  private sanitizeItem(row: Record<string, any>) {
    return {
      id: row.id,
      title: row.title,
      kind: row.kind,
      provider: row.provider,
      account_label: row.account_label,
      login_url: row.login_url,
      domain_name: row.domain_name,
      environment: row.environment,
      status: row.status,
      access_scope: row.access_scope,
      owner_user_id: row.owner_user_id,
      expires_at: row.expires_at,
      renewal_at: row.renewal_at,
      rotation_due_at: row.rotation_due_at,
      last_rotated_at: row.last_rotated_at,
      auto_renew: row.auto_renew,
      description: row.description,
      metadata: redactCredentialSensitive(row.metadata || {}),
      created_by: row.created_by,
      updated_by: row.updated_by,
      created_at: row.created_at,
      updated_at: row.updated_at,
      deleted_at: row.deleted_at,
      has_secret: Boolean(row.has_secret),
      secret_version: row.secret_version ? Number(row.secret_version) : null,
      secret_updated_at: row.secret_updated_at || null,
    };
  }

  private itemColumns(alias = '') {
    const p = alias ? `${alias}.` : '';
    return `${p}id, ${p}title, ${p}kind, ${p}provider, ${p}account_label, ${p}login_url, ${p}domain_name, ${p}environment, ${p}status, ${p}access_scope, ${p}owner_user_id, ${p}expires_at, ${p}renewal_at, ${p}rotation_due_at, ${p}last_rotated_at, ${p}auto_renew, ${p}description, ${p}metadata, ${p}created_by, ${p}updated_by, ${p}created_at, ${p}updated_at, ${p}deleted_at`;
  }

  private checkRevealRate(user: AuthUser) {
    const key = `${this.getSchema()}:${user.id || user.email || 'anonymous'}`;
    const now = Date.now();
    const bucket = TenantCredentialsService.revealBuckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      TenantCredentialsService.revealBuckets.set(key, { count: 1, resetAt: now + 60_000 });
      return;
    }
    if (bucket.count >= 10) throw new HttpException('Troppe richieste di reveal. Riprova tra poco.', HttpStatus.TOO_MANY_REQUESTS);
    bucket.count += 1;
  }

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
    const schema = safeSchema(tenantRef || 'public', 'TenantCredentialsService.getSchema');
    if (schema === 'public') throw new ForbiddenException('Credenziali non disponibili nel contesto public');
    return schema;
  }

  private async ensureSchema(schema: string) {
    await ensureTenantCredentialsTables(this.dataSource, schema);
  }

  private requireUuid(value: unknown, label: string): string {
    const text = String(value || '').trim();
    if (!UUID_RE.test(text)) throw new BadRequestException(`${label} non valido`);
    return text;
  }

  private userIdOrNull(value: unknown): string | null {
    const text = String(value || '').trim();
    return UUID_RE.test(text) ? text : null;
  }

  private requireEnum<T extends readonly string[]>(value: unknown, allowed: T, label: string): T[number] {
    const text = String(value || '').trim();
    if (!allowed.includes(text as T[number])) throw new BadRequestException(`${label} non valido`);
    return text as T[number];
  }

  private text(value: unknown, max = 2000): string | null {
    const text = String(value ?? '').trim();
    if (!text) return null;
    if (text.length > max) throw new BadRequestException('Testo troppo lungo');
    return text;
  }

  private jsonObject(value: unknown, label: string): Record<string, unknown> {
    if (value === undefined || value === null || value === '') return {};
    if (typeof value === 'string') {
      try {
        value = JSON.parse(value);
      } catch {
        throw new BadRequestException(`${label} JSON non valido`);
      }
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new BadRequestException(`${label} deve essere un oggetto JSON`);
    if (hasCredentialSensitiveKey(value)) throw new BadRequestException(`${label} contiene chiavi sensibili non consentite`);
    return value as Record<string, unknown>;
  }

  private validateAuditReason(value: unknown, required: true): string;
  private validateAuditReason(value: unknown, required: false): string | null;
  private validateAuditReason(value: unknown, required: boolean): string | null {
    if (value === undefined || value === null || value === '') {
      if (required) throw new BadRequestException('Motivo richiesto');
      return null;
    }
    if (typeof value !== 'string') throw new BadRequestException('Motivo non valido');
    const text = value.trim();
    if (text.length < 5 || text.length > 500) throw new BadRequestException('Motivo non valido');
    if (/^\s*[{[]/.test(text)) throw new BadRequestException('Motivo non valido');
    if (this.reasonLooksSensitive(text)) {
      throw new BadRequestException('Il motivo non deve contenere password, token o altri segreti.');
    }
    return text;
  }

  private sanitizeAuditMetadata(metadata: Record<string, any>): Record<string, unknown> {
    return this.redactSensitiveValues(redactCredentialSensitive(metadata || {})) as Record<string, unknown>;
  }

  private redactSensitiveValues(value: unknown): unknown {
    if (Array.isArray(value)) return value.map((entry) => this.redactSensitiveValues(entry));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, this.redactSensitiveValues(entry)]));
    }
    if (typeof value === 'string' && this.reasonLooksSensitive(value)) return '[redacted]';
    return value;
  }

  private reasonLooksSensitive(text: string): boolean {
    const patterns = [
      /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
      /\bBearer\s+[A-Za-z0-9._~+/=-]{12,}/i,
      /\bpassword\s*[:=]/i,
      /\btoken\s*[:=]/i,
      /\bapiKey\s*=/i,
      /\bapi_key\s*=/i,
      /\bsecretKey\s*=/i,
      /\bauthorization\s*:/i,
      /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
    ];
    return patterns.some((pattern) => pattern.test(text));
  }

  private validateUrl(value: string, label: string) {
    try {
      const url = new URL(value);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error('protocollo non consentito');
    } catch {
      throw new BadRequestException(`${label} non valido`);
    }
  }

  private rejectUnknownKeys(body: Record<string, any>, allowed: Set<string>) {
    for (const key of Object.keys(body || {})) {
      if (!allowed.has(key)) throw new BadRequestException(`Campo non consentito: ${key}`);
    }
  }

  private isoDate(value: unknown, label: string): string {
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`${label} non valido`);
    return date.toISOString();
  }

  private boolean(value: unknown): boolean {
    return value === true || value === 'true' || value === 1 || value === '1';
  }

  private limit(value: unknown): number {
    const n = Number(value || 50);
    if (!Number.isFinite(n)) return 50;
    return Math.max(1, Math.min(100, Math.trunc(n)));
  }

  private offset(value: unknown): number {
    const n = Number(value || 0);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.trunc(n));
  }
}
