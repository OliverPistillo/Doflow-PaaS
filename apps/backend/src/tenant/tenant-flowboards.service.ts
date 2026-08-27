import { BadRequestException, ConflictException, ForbiddenException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager } from 'typeorm';
import { NotificationsService } from '../realtime/notifications.service';
import { TenantUniversalCapabilitiesService, TenantUniversalCapability } from './tenant-universal-capabilities.service';
import { boundedText, isTenantAdministrator, rejectActorOverride, tenantActor, TenantActor, tenantUuid } from './tenant-universal-context';
import { ensureTenantUniversalFeatureTables } from './tenant-universal-features-schema';
import { withTenantIdempotency } from './tenant-universal-idempotency';
import { ensureTenantBackendContractTables } from './tenant-backend-contracts-schema';

@Injectable()
export class TenantFlowboardsService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
    private readonly realtime: NotificationsService,
    private readonly capabilities: TenantUniversalCapabilitiesService,
  ) {}
  private actor() { return tenantActor(this.request, 'TenantFlowboardsService'); }
  private async ensure(capability: TenantUniversalCapability = 'canViewProjects', actor = this.actor()) {
    await this.capabilities.require(actor, capability);
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    await ensureTenantBackendContractTables(this.dataSource, actor.schema);
    return actor;
  }

  private async projectId(manager: DataSource | EntityManager, actor: TenantActor, value: unknown) {
    if (value === undefined || value === null || value === '') return null;
    const id = tenantUuid(value, 'projectId');
    const privileged = isTenantAdministrator(actor) || actor.role === 'manager';
    const rows = await manager.query(
      `SELECT p.id FROM "${actor.schema}".projects p WHERE p.id=$1 AND p.deleted_at IS NULL AND
       ($3::boolean OR p.project_manager_id=$2 OR EXISTS (SELECT 1 FROM "${actor.schema}".project_members pm WHERE pm.project_id=p.id AND pm.user_id=$2 AND pm.deleted_at IS NULL) OR EXISTS (SELECT 1 FROM "${actor.schema}".tasks t WHERE t.project_id=p.id AND t.assignee_id=$2 AND t.deleted_at IS NULL))`,
      [id, actor.id, privileged],
    );
    if (!rows[0]) throw new NotFoundException('Progetto non trovato');
    return id;
  }

  private graph(value: unknown, label: string, max: number) {
    if (!Array.isArray(value) || value.length > max) throw new BadRequestException(`${label} non valido`);
    const encoded = JSON.stringify(value);
    if (Buffer.byteLength(encoded) > 2_000_000) throw new BadRequestException(`${label} troppo grande`);
    return value;
  }

  private cloneGraph(nodesValue: unknown, edgesValue: unknown) {
    const nodes = this.graph(nodesValue ?? [], 'nodes', 5_000) as Array<Record<string, unknown>>;
    const edges = this.graph(edgesValue ?? [], 'edges', 10_000) as Array<Record<string, unknown>>;
    const nodeIds = new Map<string, string>();
    for (const node of nodes) {
      const sourceId = typeof node?.id === 'string' ? node.id : '';
      if (sourceId) nodeIds.set(sourceId, randomUUID());
    }
    const clonedNodes = nodes.map((node) => {
      const sourceId = typeof node?.id === 'string' ? node.id : '';
      const parentId = typeof node?.parentId === 'string' ? node.parentId : undefined;
      return {
        ...structuredClone(node),
        id: nodeIds.get(sourceId) ?? randomUUID(),
        ...(parentId ? { parentId: nodeIds.get(parentId) ?? parentId } : {}),
      };
    });
    const clonedEdges = edges.map((edge) => {
      const source = typeof edge?.source === 'string' ? edge.source : '';
      const target = typeof edge?.target === 'string' ? edge.target : '';
      return {
        ...structuredClone(edge),
        id: randomUUID(),
        source: nodeIds.get(source) ?? source,
        target: nodeIds.get(target) ?? target,
      };
    });
    return { nodes: clonedNodes, edges: clonedEdges };
  }

  private async access(manager: DataSource | EntityManager, actor: TenantActor, id: string, write = false) {
    const rows = await manager.query(
      `SELECT b.*,fc.permission AS collaborator_permission
       FROM "${actor.schema}".flowboards b
       LEFT JOIN "${actor.schema}".flowboard_collaborators fc ON fc.board_id=b.id AND fc.user_id=$2
       WHERE b.id=$1 AND b.deleted_at IS NULL LIMIT 1`, [id, actor.id],
    );
    const board = rows[0];
    if (!board) throw new NotFoundException('Flowboard non trovata');
    const owner = String(board.owner_user_id) === actor.id;
    const template = board.is_template === true;
    const view = template || owner || Boolean(board.collaborator_permission) || isTenantAdministrator(actor);
    const edit = !template && (owner || board.collaborator_permission === 'edit' || isTenantAdministrator(actor));
    if (!view || (write && !edit)) throw new ForbiddenException('Accesso Flowboard non autorizzato');
    return { board, owner, edit };
  }

  private async audit(manager: EntityManager, actor: TenantActor, boardId: string, action: string, metadata: Record<string, unknown> = {}) {
    await manager.query(
      `INSERT INTO "${actor.schema}".flowboard_audit (board_id,actor_user_id,action,metadata)
       VALUES ($1,$2,$3,$4::jsonb)`, [boardId, actor.id, action, JSON.stringify(metadata)],
    );
  }

  private async publishBoard(
    actor: TenantActor,
    boardId: string,
    type: string,
    payload: Record<string, unknown> = {},
  ) {
    try {
      const rows = await this.dataSource.query(
        `SELECT owner_user_id AS user_id FROM "${actor.schema}".flowboards WHERE id=$1
         UNION
         SELECT user_id FROM "${actor.schema}".flowboard_collaborators WHERE board_id=$1`,
        [boardId],
      );
      const event = {
        type,
        boardId,
        actorUserId: actor.id,
        occurredAt: new Date().toISOString(),
        ...payload,
      };
      await Promise.all(rows.map((row: any) =>
        this.realtime.notifyUser(String(row.user_id), event, actor.schema),
      ));
    } catch {
      // Realtime is an auxiliary projection; committed tenant data remains authoritative.
    }
  }

  private collaboratorInput(value: unknown) {
    if (value === undefined) return null;
    if (!Array.isArray(value) || value.length > 100) throw new BadRequestException('collaborators non valido');
    const map = new Map<string, 'view' | 'edit'>();
    for (const item of value) {
      if (!item || typeof item !== 'object') throw new BadRequestException('collaborator non valido');
      const source = item as Record<string, unknown>;
      const id = tenantUuid(source.userId ?? source.user_id, 'collaborator userId');
      const permission = source.permission === 'edit' ? 'edit' : 'view';
      map.set(id, permission);
    }
    return [...map.entries()].map(([userId, permission]) => ({ userId, permission }));
  }

  private async replaceCollaborators(manager: EntityManager, actor: TenantActor, boardId: string, collaborators: Array<{userId: string; permission: string}>) {
    const filtered = collaborators.filter((item) => item.userId !== actor.id);
    if (filtered.length) {
      const rows = await manager.query(
        `SELECT id FROM "${actor.schema}".users WHERE id=ANY($1::uuid[]) AND COALESCE(is_active,true)=true`,
        [filtered.map((item) => item.userId)],
      );
      if (rows.length !== filtered.length) throw new BadRequestException('Collaboratore non appartenente al tenant');
    }
    await manager.query(`DELETE FROM "${actor.schema}".flowboard_collaborators WHERE board_id=$1`, [boardId]);
    for (const item of filtered) await manager.query(
      `INSERT INTO "${actor.schema}".flowboard_collaborators (board_id,user_id,permission) VALUES ($1,$2,$3)`,
      [boardId, item.userId, item.permission],
    );
  }

  async list(query: Record<string, unknown>) {
    rejectActorOverride(query);
    const actor = await this.ensure();
    const includeArchived = query.archived === 'true' || query.archived === true;
    const rows = await this.dataSource.query(
      `SELECT DISTINCT b.*,CASE WHEN b.owner_user_id=$1 THEN 'owner' ELSE fc.permission END AS permission
       FROM "${actor.schema}".flowboards b
       LEFT JOIN "${actor.schema}".flowboard_collaborators fc ON fc.board_id=b.id AND fc.user_id=$1
       WHERE b.deleted_at IS NULL AND ($2::boolean OR b.archived_at IS NULL)
         AND (b.is_template=true OR b.owner_user_id=$1 OR fc.user_id=$1 OR $3::boolean)
       ORDER BY b.updated_at DESC,b.id DESC LIMIT 200`, [actor.id, includeArchived, isTenantAdministrator(actor)],
    );
    return { items: rows };
  }

  async templates() {
    const actor = await this.ensure();
    await ensureTenantBackendContractTables(this.dataSource, actor.schema);
    const rows = await this.dataSource.query(
      `SELECT b.*,CASE WHEN b.owner_user_id=$1 THEN 'owner' ELSE 'viewer' END AS permission
       FROM "${actor.schema}".flowboards b
       WHERE b.is_template=true AND b.deleted_at IS NULL AND b.archived_at IS NULL
       ORDER BY b.template_key NULLS LAST,b.name,b.id LIMIT 100`,
      [actor.id],
    );
    return { items: rows };
  }

  async create(body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canCreateFlowboards');
    await ensureTenantBackendContractTables(this.dataSource, actor.schema);
    const name = boundedText(body.name, 'name', 160, true);
    const description = boundedText(body.description, 'description', 2_000);
    const collaborators = this.collaboratorInput(body.collaborators) || [];
    const isTemplate = body.isTemplate === true;
    if (isTemplate && !isTenantAdministrator(actor)) throw new ForbiddenException('Solo un amministratore può creare modelli Flowboard');
    const templateKey = isTemplate ? boundedText(body.templateKey, 'templateKey', 80) || null : null;
    const created = await this.dataSource.transaction(async (manager) => {
      const projectId = await this.projectId(manager, actor, body.projectId ?? body.project_id);
      const templateId = body.templateId && body.templateId !== 'template-blank' ? tenantUuid(body.templateId, 'templateId') : null;
      return withTenantIdempotency(
      manager, actor.schema, `flowboard:create:${actor.id}`, key, { name, description, collaborators, projectId, templateId, isTemplate, templateKey }, actor.id,
      async () => {
        let template: any = null;
        if (templateId) {
          const rows = await manager.query(`SELECT * FROM "${actor.schema}".flowboards WHERE id=$1 AND is_template=true AND deleted_at IS NULL AND archived_at IS NULL`, [templateId]);
          if (!rows[0]) throw new NotFoundException('Template Flowboard non trovato');
          template = rows[0];
        }
        const graph = this.cloneGraph(template?.nodes ?? [], template?.edges ?? []);
        const rows = await manager.query(
          `INSERT INTO "${actor.schema}".flowboards (owner_user_id,name,description,nodes,edges,viewport,project_id,is_template,template_key)
           VALUES ($1,$2,$3,$4::jsonb,$5::jsonb,$6::jsonb,$7,$8,$9) RETURNING *`, [actor.id, name, description || template?.description || null, JSON.stringify(graph.nodes), JSON.stringify(graph.edges), JSON.stringify(template?.viewport || {}), projectId, isTemplate, templateKey],
        );
        await this.replaceCollaborators(manager, actor, rows[0].id, collaborators);
        await this.audit(manager, actor, rows[0].id, 'flowboard_created', { collaborators });
        return rows[0];
      },
    ); });
    await this.publishBoard(actor, created.id, 'flowboard.created');
    return created;
  }

  async get(idValue: string) {
    const actor = await this.ensure();
    const id = tenantUuid(idValue, 'boardId');
    const { board, owner, edit } = await this.access(this.dataSource, actor, id);
    const [collaborators, comments, versions] = await Promise.all([
      this.dataSource.query(`SELECT user_id,permission,created_at FROM "${actor.schema}".flowboard_collaborators WHERE board_id=$1 ORDER BY created_at`, [id]),
      this.dataSource.query(`SELECT * FROM "${actor.schema}".flowboard_comments WHERE board_id=$1 ORDER BY created_at`, [id]),
      this.dataSource.query(`SELECT id,version,reason,created_by,created_at FROM "${actor.schema}".flowboard_versions WHERE board_id=$1 ORDER BY version DESC LIMIT 50`, [id]),
    ]);
    return { ...board, owner, canEdit: edit, collaborators, comments: comments.map((row: any) => ({ ...row, body: row.deleted_at ? null : row.body })), versions };
  }

  async update(idValue: string, body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canUpdateFlowboards');
    await ensureTenantBackendContractTables(this.dataSource, actor.schema);
    const id = tenantUuid(idValue, 'boardId');
    const expectedVersion = Number(body.optimisticVersion ?? body.optimistic_version);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new BadRequestException('optimisticVersion obbligatoria');
    const result = await this.dataSource.transaction(async (manager) => {
      const { board, owner } = await this.access(manager, actor, id, true);
      const collaborators = this.collaboratorInput(body.collaborators);
      if (collaborators && !owner && !isTenantAdministrator(actor)) throw new ForbiddenException('Solo il proprietario puo condividere la Flowboard');
      const name = body.name === undefined ? board.name : boundedText(body.name, 'name', 160, true);
      const description = body.description === undefined ? board.description : boundedText(body.description, 'description', 2_000);
      const status = body.status === undefined ? board.status : boundedText(body.status, 'status', 40, true);
      const projectId = body.projectId === undefined && body.project_id === undefined ? board.project_id : await this.projectId(manager, actor, body.projectId ?? body.project_id);
      return withTenantIdempotency(manager, actor.schema, `flowboard:update:${id}`, key, { name, description, status, collaborators, expectedVersion, projectId }, actor.id, async () => {
        const rows = await manager.query(
          `UPDATE "${actor.schema}".flowboards SET name=$2,description=$3,status=$4,project_id=$6,updated_at=now(),
           optimistic_version=optimistic_version+1
           WHERE id=$1 AND deleted_at IS NULL AND optimistic_version=$5 RETURNING *`,
          [id, name, description || null, status, expectedVersion, projectId],
        );
        if (!rows[0]) throw new ConflictException('Flowboard modificata da un altro utente');
        if (collaborators) await this.replaceCollaborators(manager, actor, id, collaborators);
        await this.audit(manager, actor, id, 'flowboard_updated', { fields: Object.keys(body) });
        return rows[0];
      });
    });
    await this.publishBoard(actor, id, 'flowboard.updated');
    return result;
  }

  async duplicate(idValue: string, body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canCreateFlowboards');
    await ensureTenantBackendContractTables(this.dataSource, actor.schema);
    const id = tenantUuid(idValue, 'boardId');
    const expectedVersion = Number(body.optimisticVersion ?? body.optimistic_version);
    if (!Number.isInteger(expectedVersion) || expectedVersion < 1) throw new BadRequestException('optimisticVersion obbligatoria');
    const result = await this.dataSource.transaction(async (manager) => {
      const { board } = await this.access(manager, actor, id);
      if (Number(board.optimistic_version) !== expectedVersion) throw new ConflictException('Flowboard modificata da un altro utente');
      const projectId = body.projectId === undefined ? board.project_id : await this.projectId(manager, actor, body.projectId);
      const name = boundedText(body.name ?? `${board.name} (copia)`, 'name', 160, true);
      return withTenantIdempotency(manager, actor.schema, `flowboard:duplicate:${id}`, key, { name, projectId, expectedVersion }, actor.id, async () => {
        const graph = this.cloneGraph(board.nodes, board.edges);
        const rows = await manager.query(`INSERT INTO "${actor.schema}".flowboards (owner_user_id,name,description,status,nodes,edges,viewport,project_id,is_template,template_key) VALUES ($1,$2,$3,'active',$4::jsonb,$5::jsonb,$6::jsonb,$7,false,NULL) RETURNING *`, [actor.id,name,board.description,JSON.stringify(graph.nodes),JSON.stringify(graph.edges),JSON.stringify(board.viewport||{}),projectId]);
        await this.audit(manager, actor, rows[0].id, 'flowboard_duplicated', { sourceBoardId: id });
        return rows[0];
      });
    });
    await this.publishBoard(actor, result.id, 'flowboard.duplicated', { sourceBoardId: id });
    return result;
  }

  async save(idValue: string, body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canUpdateFlowboards');
    const id = tenantUuid(idValue, 'boardId');
    const nodes = this.graph(body.nodes, 'nodes', 5_000);
    const edges = this.graph(body.edges, 'edges', 10_000);
    const viewport = body.viewport && typeof body.viewport === 'object' && !Array.isArray(body.viewport) ? body.viewport : {};
    const version = Number(body.optimisticVersion ?? body.optimistic_version);
    if (!Number.isInteger(version) || version < 1) throw new BadRequestException('optimisticVersion obbligatoria');
    const result = await this.dataSource.transaction(async (manager) => {
      await this.access(manager, actor, id, true);
      return withTenantIdempotency(manager, actor.schema, `flowboard:save:${id}`, key, { nodes, edges, viewport, version }, actor.id, async () => {
        const rows = await manager.query(
          `UPDATE "${actor.schema}".flowboards SET nodes=$2::jsonb,edges=$3::jsonb,viewport=$4::jsonb,
           optimistic_version=optimistic_version+1,updated_at=now()
           WHERE id=$1 AND optimistic_version=$5 AND deleted_at IS NULL RETURNING *`,
          [id, JSON.stringify(nodes), JSON.stringify(edges), JSON.stringify(viewport), version],
        );
        if (!rows[0]) throw new ConflictException('Flowboard modificata da un altro utente');
        await this.audit(manager, actor, id, 'flowboard_saved', { fromVersion: version, toVersion: version + 1 });
        return rows[0];
      });
    });
    await this.publishBoard(actor, id, 'flowboard.graph.saved', { optimisticVersion: result.optimistic_version });
    return result;
  }

  async addComment(idValue: string, body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canCreateFlowboardComments');
    const id = tenantUuid(idValue, 'boardId');
    const text = boundedText(body.body ?? body.text, 'comment', 5_000, true);
    const parentId = body.parentCommentId || body.parent_id ? tenantUuid(body.parentCommentId ?? body.parent_id, 'parentCommentId') : null;
    const targetType = boundedText(body.targetType ?? 'board', 'targetType', 40, true);
    const targetId = boundedText(body.targetId, 'targetId', 160);
    const result = await this.dataSource.transaction(async (manager) => {
      await this.access(manager, actor, id);
      return withTenantIdempotency(manager, actor.schema, `flowboard:comment:${id}:${actor.id}`, key, { text, parentId, targetType, targetId }, actor.id, async () => {
        if (parentId) {
          const parent = await manager.query(`SELECT 1 FROM "${actor.schema}".flowboard_comments WHERE id=$1 AND board_id=$2 AND deleted_at IS NULL`, [parentId, id]);
          if (!parent[0]) throw new BadRequestException('Thread non disponibile');
        }
        const rows = await manager.query(
          `INSERT INTO "${actor.schema}".flowboard_comments
           (board_id,parent_comment_id,author_user_id,target_type,target_id,body)
           VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`, [id, parentId, actor.id, targetType, targetId || null, text],
        );
        await this.audit(manager, actor, id, parentId ? 'flowboard_comment_replied' : 'flowboard_comment_created', { commentId: rows[0].id });
        return rows[0];
      });
    });
    await this.publishBoard(actor, id, parentId ? 'flowboard.comment.replied' : 'flowboard.comment.created', { commentId: result.id });
    return result;
  }

  async updateComment(boardValue: string, commentValue: string, body: Record<string, unknown>) {
    rejectActorOverride(body);
    const actor = await this.ensure('canUpdateFlowboardComments');
    const boardId = tenantUuid(boardValue, 'boardId');
    const commentId = tenantUuid(commentValue, 'commentId');
    const text = boundedText(body.body ?? body.text, 'comment', 5_000, true);
    const result = await this.dataSource.transaction(async (manager) => {
      await this.access(manager, actor, boardId);
      const comments = await manager.query(`SELECT * FROM "${actor.schema}".flowboard_comments WHERE id=$1 AND board_id=$2 AND deleted_at IS NULL FOR UPDATE`, [commentId, boardId]);
      if (!comments[0]) throw new NotFoundException('Commento non trovato');
      if (String(comments[0].author_user_id) !== actor.id && !isTenantAdministrator(actor)) {
        const canModerate = await this.capabilities.has(actor, 'canModerateFlowboardComments');
        if (!canModerate) throw new ForbiddenException('Commento non modificabile');
      }
      const requestedVersion = body.optimisticVersion ?? body.optimistic_version;
      const expected = requestedVersion === undefined ? comments[0].optimistic_version : Number(requestedVersion);
      const rows = await manager.query(
        `UPDATE "${actor.schema}".flowboard_comments SET body=$2,optimistic_version=optimistic_version+1,updated_at=now()
         WHERE id=$1 AND optimistic_version=$3 RETURNING *`, [commentId, text, expected],
      );
      if (!rows[0]) throw new ConflictException('Commento modificato da un altro utente');
      await this.audit(manager, actor, boardId, 'flowboard_comment_updated', { commentId });
      return rows[0];
    });
    await this.publishBoard(actor, boardId, 'flowboard.comment.updated', { commentId });
    return result;
  }

  async deleteComment(boardValue: string, commentValue: string) {
    const actor = await this.ensure('canDeleteFlowboardComments');
    const boardId = tenantUuid(boardValue, 'boardId');
    const commentId = tenantUuid(commentValue, 'commentId');
    const result = await this.dataSource.transaction(async (manager) => {
      await this.access(manager, actor, boardId);
      const comments = await manager.query(`SELECT * FROM "${actor.schema}".flowboard_comments WHERE id=$1 AND board_id=$2 FOR UPDATE`, [commentId, boardId]);
      if (!comments[0]) throw new NotFoundException('Commento non trovato');
      if (String(comments[0].author_user_id) !== actor.id && !isTenantAdministrator(actor)) {
        const canModerate = await this.capabilities.has(actor, 'canModerateFlowboardComments');
        if (!canModerate) throw new ForbiddenException('Commento non eliminabile');
      }
      await manager.query(`UPDATE "${actor.schema}".flowboard_comments SET body='',deleted_at=COALESCE(deleted_at,now()),updated_at=now() WHERE id=$1`, [commentId]);
      await this.audit(manager, actor, boardId, 'flowboard_comment_deleted', { commentId });
      return { id: commentId, deleted: true };
    });
    await this.publishBoard(actor, boardId, 'flowboard.comment.deleted', { commentId });
    return result;
  }

  async createVersion(idValue: string, body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canUpdateFlowboards');
    const id = tenantUuid(idValue, 'boardId');
    const reason = boundedText(body.reason, 'reason', 1_000, true);
    const result = await this.dataSource.transaction(async (manager) => {
      await this.access(manager, actor, id, true);
      const locked = await manager.query(`SELECT * FROM "${actor.schema}".flowboards WHERE id=$1 FOR UPDATE`, [id]);
      const board = locked[0];
      return withTenantIdempotency(manager, actor.schema, `flowboard:version:${id}`, key, { reason, boardVersion: board.optimistic_version }, actor.id, async () => {
        const next = await manager.query(`SELECT COALESCE(MAX(version),0)+1 AS version FROM "${actor.schema}".flowboard_versions WHERE board_id=$1`, [id]);
        const snapshot = { nodes: board.nodes, edges: board.edges, viewport: board.viewport, optimisticVersion: board.optimistic_version };
        const rows = await manager.query(
          `INSERT INTO "${actor.schema}".flowboard_versions (board_id,version,snapshot,reason,created_by)
           VALUES ($1,$2,$3::jsonb,$4,$5) RETURNING *`, [id, next[0].version, JSON.stringify(snapshot), reason, actor.id],
        );
        await this.audit(manager, actor, id, 'flowboard_version_created', { version: next[0].version });
        return rows[0];
      });
    });
    await this.publishBoard(actor, id, 'flowboard.version.created', { versionId: result.id, version: result.version });
    return result;
  }

  async restoreVersion(boardValue: string, versionValue: string, body: Record<string, unknown>, key?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canUpdateFlowboards');
    const boardId = tenantUuid(boardValue, 'boardId');
    const versionId = tenantUuid(versionValue, 'versionId');
    const expected = Number(body.optimisticVersion ?? body.optimistic_version);
    if (!Number.isInteger(expected)) throw new BadRequestException('optimisticVersion obbligatoria');
    const result = await this.dataSource.transaction(async (manager) => {
      await this.access(manager, actor, boardId, true);
      return withTenantIdempotency(manager, actor.schema, `flowboard:restore:${boardId}`, key, { versionId, expected }, actor.id, async () => {
        const versions = await manager.query(`SELECT * FROM "${actor.schema}".flowboard_versions WHERE id=$1 AND board_id=$2`, [versionId, boardId]);
        if (!versions[0]) throw new NotFoundException('Versione non trovata');
        const snapshot = versions[0].snapshot || {};
        const rows = await manager.query(
          `UPDATE "${actor.schema}".flowboards SET nodes=$3::jsonb,edges=$4::jsonb,viewport=$5::jsonb,
           optimistic_version=optimistic_version+1,updated_at=now()
           WHERE id=$1 AND optimistic_version=$2 AND deleted_at IS NULL RETURNING *`,
          [boardId, expected, JSON.stringify(snapshot.nodes || []), JSON.stringify(snapshot.edges || []), JSON.stringify(snapshot.viewport || {})],
        );
        if (!rows[0]) throw new ConflictException('Flowboard modificata da un altro utente');
        await this.audit(manager, actor, boardId, 'flowboard_version_restored', { versionId });
        return rows[0];
      });
    });
    await this.publishBoard(actor, boardId, 'flowboard.version.restored', { versionId });
    return result;
  }

  async archive(idValue: string, archived: boolean) {
    const actor = await this.ensure(archived ? 'canDeleteFlowboards' : 'canUpdateFlowboards');
    const id = tenantUuid(idValue, 'boardId');
    const result = await this.dataSource.transaction(async (manager) => {
      const { owner } = await this.access(manager, actor, id, true);
      if (!owner && !isTenantAdministrator(actor)) throw new ForbiddenException('Solo il proprietario puo archiviare la Flowboard');
      const rows = await manager.query(
        `UPDATE "${actor.schema}".flowboards SET archived_at=${archived ? 'now()' : 'NULL'},
         status=$2,updated_at=now(),optimistic_version=optimistic_version+1 WHERE id=$1 AND deleted_at IS NULL RETURNING *`,
        [id, archived ? 'archived' : 'active'],
      );
      await this.audit(manager, actor, id, archived ? 'flowboard_archived' : 'flowboard_restored');
      return rows[0];
    });
    await this.publishBoard(actor, id, archived ? 'flowboard.archived' : 'flowboard.restored');
    return result;
  }

  async remove(idValue: string) {
    const actor = await this.ensure('canDeleteFlowboards');
    const id = tenantUuid(idValue, 'boardId');
    const result = await this.dataSource.transaction(async (manager) => {
      const { owner } = await this.access(manager, actor, id, true);
      if (!owner && !isTenantAdministrator(actor)) throw new ForbiddenException('Solo il proprietario puo eliminare la Flowboard');
      await manager.query(`UPDATE "${actor.schema}".flowboards SET deleted_at=COALESCE(deleted_at,now()),updated_at=now() WHERE id=$1`, [id]);
      await this.audit(manager, actor, id, 'flowboard_deleted');
      return { id, deleted: true };
    });
    await this.publishBoard(actor, id, 'flowboard.deleted');
    return result;
  }
}
