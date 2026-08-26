import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource, EntityManager } from 'typeorm';
import { NotificationsService } from '../realtime/notifications.service';
import { TenantUniversalCapabilitiesService, TenantUniversalCapability } from './tenant-universal-capabilities.service';
import { boundedText, isTenantAdministrator, rejectActorOverride, tenantActor, TenantActor, tenantUuid } from './tenant-universal-context';
import { ensureTenantUniversalFeatureTables } from './tenant-universal-features-schema';
import { withTenantIdempotency } from './tenant-universal-idempotency';

type Participant = { role: string };

@Injectable()
export class TenantConversationsService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
    private readonly realtime: NotificationsService,
    private readonly capabilities: TenantUniversalCapabilitiesService,
  ) {}

  private actor() { return tenantActor(this.request, 'TenantConversationsService'); }
  private async ensure(capability: TenantUniversalCapability = 'canViewTeam', actor = this.actor()) {
    await this.capabilities.require(actor, capability);
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    return actor;
  }
  private limit(value: unknown) { const n = Number(value || 50); return Math.max(1, Math.min(100, Number.isFinite(n) ? Math.trunc(n) : 50)); }

  private encodeCursor(row: any) {
    return Buffer.from(JSON.stringify({ at: row.created_at || row.updated_at, id: row.id })).toString('base64url');
  }

  private decodeCursor(value: unknown): { at: string; id: string } | null {
    if (!value) return null;
    try {
      const parsed = JSON.parse(Buffer.from(String(value), 'base64url').toString('utf8'));
      return { at: new Date(parsed.at).toISOString(), id: tenantUuid(parsed.id, 'cursor') };
    } catch {
      throw new BadRequestException('cursor non valido');
    }
  }

  private async participant(manager: DataSource | EntityManager, actor: TenantActor, conversationId: string): Promise<Participant> {
    const rows = await manager.query(
      `SELECT cp.role FROM "${actor.schema}".conversation_participants cp
       JOIN "${actor.schema}".conversations c ON c.id=cp.conversation_id
       WHERE cp.conversation_id=$1 AND cp.user_id=$2 AND cp.left_at IS NULL AND c.deleted_at IS NULL LIMIT 1`,
      [conversationId, actor.id],
    );
    if (!rows[0]) throw new ForbiddenException('Non partecipi a questa conversazione');
    return rows[0];
  }

  private async audit(manager: EntityManager, actor: TenantActor, conversationId: string, action: string, messageId?: string, metadata: Record<string, unknown> = {}) {
    await manager.query(
      `INSERT INTO "${actor.schema}".conversation_audit
       (conversation_id,message_id,actor_user_id,action,metadata) VALUES ($1,$2,$3,$4,$5::jsonb)`,
      [conversationId, messageId || null, actor.id, action, JSON.stringify(metadata)],
    );
  }

  private async publishConversation(
    actor: TenantActor,
    conversationId: string,
    type: string,
    payload: Record<string, unknown> = {},
    extraRecipients: string[] = [],
  ) {
    try {
      const rows = await this.dataSource.query(
        `SELECT user_id FROM "${actor.schema}".conversation_participants
         WHERE conversation_id=$1 AND left_at IS NULL`,
        [conversationId],
      );
      const recipients = new Set<string>([
        ...rows.map((row: any) => String(row.user_id)),
        ...extraRecipients,
      ]);
      const event = {
        type,
        conversationId,
        actorUserId: actor.id,
        occurredAt: new Date().toISOString(),
        ...payload,
      };
      await Promise.all([...recipients].map((userId) =>
        this.realtime.notifyUser(userId, event, actor.schema),
      ));
    } catch {
      // Realtime is an auxiliary projection; committed tenant data remains authoritative.
    }
  }

  private async assertUsers(manager: EntityManager, actor: TenantActor, ids: string[]) {
    if (!ids.length) return;
    const rows = await manager.query(
      `SELECT id FROM "${actor.schema}".users WHERE id=ANY($1::uuid[]) AND COALESCE(is_active,true)=true`,
      [ids],
    );
    const found = new Set(rows.map((row: any) => String(row.id)));
    if (ids.some((id) => !found.has(id))) throw new BadRequestException('Uno o piu partecipanti non appartengono al tenant');
  }

  private normalizeIds(value: unknown, label: string) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value)) throw new BadRequestException(`${label} deve essere un array`);
    return Array.from(new Set(value.map((item) => tenantUuid(item, label))));
  }

  async listConversations(query: Record<string, unknown>) {
    rejectActorOverride(query);
    const actor = await this.ensure();
    const limit = this.limit(query.limit);
    const cursor = this.decodeCursor(query.cursor);
    const params: unknown[] = [actor.id];
    let cursorSql = '';
    if (cursor) {
      params.push(cursor.at, cursor.id);
      cursorSql = `AND (c.updated_at,c.id) < ($2::timestamptz,$3::uuid)`;
    }
    params.push(limit + 1);
    const rows = await this.dataSource.query(
      `SELECT c.*,cp.role AS participant_role,cp.last_read_at,
         COALESCE((SELECT jsonb_agg(jsonb_build_object('userId',member.user_id,'role',member.role,'lastReadAt',member.last_read_at)
           ORDER BY member.joined_at) FROM "${actor.schema}".conversation_participants member
           WHERE member.conversation_id=c.id AND member.left_at IS NULL),'[]'::jsonb) AS participants,
         (SELECT to_jsonb(latest) FROM "${actor.schema}".conversation_messages latest
          WHERE latest.conversation_id=c.id AND latest.deleted_at IS NULL
          ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1) AS "lastMessage",
         (SELECT COUNT(*)::int FROM "${actor.schema}".conversation_messages m
          WHERE m.conversation_id=c.id AND m.deleted_at IS NULL
            AND m.created_at>COALESCE(cp.last_read_at,'epoch'::timestamptz) AND m.author_id<>$1) AS unread_count
       FROM "${actor.schema}".conversations c
       JOIN "${actor.schema}".conversation_participants cp ON cp.conversation_id=c.id
       WHERE cp.user_id=$1 AND cp.left_at IS NULL AND c.deleted_at IS NULL ${cursorSql}
       ORDER BY c.updated_at DESC,c.id DESC LIMIT $${params.length}`,
      params,
    );
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit);
    return { items, nextCursor: hasMore ? this.encodeCursor({ ...items[items.length - 1], created_at: items[items.length - 1].updated_at }) : null };
  }

  async createConversation(body: Record<string, unknown>, idempotencyKey?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canCreateConversations');
    const title = boundedText(body.title, 'title', 160, true);
    const kind = ['direct', 'group', 'project'].includes(String(body.kind)) ? String(body.kind) : 'group';
    const requested = this.normalizeIds(body.participantIds ?? body.participant_ids, 'participantId');
    const participants = Array.from(new Set([actor.id, ...requested]));
    const created = await this.dataSource.transaction((manager) => withTenantIdempotency(
      manager, actor.schema, `conversation:create:${actor.id}`, idempotencyKey, { title, kind, participants }, actor.id,
      async () => {
        await this.assertUsers(manager, actor, participants);
        const rows = await manager.query(
          `INSERT INTO "${actor.schema}".conversations (kind,title,created_by) VALUES ($1,$2,$3) RETURNING *`,
          [kind, title, actor.id],
        );
        const conversation = rows[0];
        for (const userId of participants) {
          await manager.query(
            `INSERT INTO "${actor.schema}".conversation_participants (conversation_id,user_id,role)
             VALUES ($1,$2,$3)`,
            [conversation.id, userId, userId === actor.id ? 'owner' : 'member'],
          );
        }
        await manager.query(
          `INSERT INTO "${actor.schema}".conversation_system_events
           (conversation_id,event_type,actor_user_id,payload) VALUES ($1,'conversation_created',$2,$3::jsonb)`,
          [conversation.id, actor.id, JSON.stringify({ participantIds: participants })],
        );
        await this.audit(manager, actor, conversation.id, 'conversation_created', undefined, { participantIds: participants });
        return { ...conversation, participantIds: participants };
      },
    ));
    await this.publishConversation(actor, created.id, 'collaboration.conversation.created');
    return created;
  }

  async getConversation(idValue: string) {
    const actor = await this.ensure();
    const id = tenantUuid(idValue, 'conversationId');
    await this.participant(this.dataSource, actor, id);
    const rows = await this.dataSource.query(
      `SELECT c.*,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('userId',cp.user_id,'role',cp.role,'lastReadAt',cp.last_read_at)
          ORDER BY cp.joined_at) FROM "${actor.schema}".conversation_participants cp
          WHERE cp.conversation_id=c.id AND cp.left_at IS NULL),'[]'::jsonb) AS participants,
        (SELECT to_jsonb(latest) FROM "${actor.schema}".conversation_messages latest
          WHERE latest.conversation_id=c.id AND latest.deleted_at IS NULL
          ORDER BY latest.created_at DESC,latest.id DESC LIMIT 1) AS "lastMessage"
       FROM "${actor.schema}".conversations c WHERE c.id=$1 AND c.deleted_at IS NULL LIMIT 1`, [id],
    );
    if (!rows[0]) throw new NotFoundException('Conversazione non trovata');
    return rows[0];
  }

  async addParticipants(idValue: string, body: Record<string, unknown>, idempotencyKey?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canManageConversations');
    const id = tenantUuid(idValue, 'conversationId');
    const ids = this.normalizeIds(body.participantIds ?? body.participant_ids, 'participantId').filter((v) => v !== actor.id);
    const result = await this.dataSource.transaction(async (manager) => {
      const membership = await this.participant(manager, actor, id);
      if (membership.role !== 'owner' && !isTenantAdministrator(actor)) throw new ForbiddenException('Solo il proprietario puo aggiungere partecipanti');
      return withTenantIdempotency(manager, actor.schema, `conversation:participants:${id}`, idempotencyKey, ids, actor.id, async () => {
        await this.assertUsers(manager, actor, ids);
        for (const userId of ids) await manager.query(
          `INSERT INTO "${actor.schema}".conversation_participants (conversation_id,user_id,role,left_at)
           VALUES ($1,$2,'member',NULL) ON CONFLICT (conversation_id,user_id)
           DO UPDATE SET left_at=NULL,
             role=CASE
               WHEN conversation_participants.role='owner' THEN 'owner'
               ELSE 'member'
             END`, [id, userId],
        );
        await this.audit(manager, actor, id, 'participants_added', undefined, { participantIds: ids });
        return { conversationId: id, participantIds: ids };
      });
    });
    await this.publishConversation(actor, id, 'collaboration.participants.added', { participantIds: ids });
    return result;
  }

  async removeParticipant(
    conversationValue: string,
    participantValue: string,
    idempotencyKey?: string,
  ) {
    const actor = await this.ensure('canManageConversations');
    const conversationId = tenantUuid(conversationValue, 'conversationId');
    const participantId = tenantUuid(participantValue, 'participantId');
    if (participantId === actor.id) throw new BadRequestException('Usa leave per uscire dalla conversazione');
    const result = await this.dataSource.transaction(async (manager) => {
      const membership = await this.participant(manager, actor, conversationId);
      if (membership.role !== 'owner' && !isTenantAdministrator(actor)) {
        throw new ForbiddenException('Solo il proprietario puo rimuovere partecipanti');
      }
      return withTenantIdempotency(
        manager,
        actor.schema,
        `conversation:participant:remove:${conversationId}:${participantId}`,
        idempotencyKey,
        {},
        actor.id,
        async () => {
          const conversations = await manager.query(
            `SELECT created_by FROM "${actor.schema}".conversations
             WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
            [conversationId],
          );
          if (!conversations[0]) throw new NotFoundException('Conversazione non trovata');
          const targets = await manager.query(
            `SELECT role FROM "${actor.schema}".conversation_participants
             WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL FOR UPDATE`,
            [conversationId, participantId],
          );
          if (!targets[0]) throw new NotFoundException('Partecipante non trovato');
          if (String(conversations[0].created_by) === participantId || String(targets[0].role) === 'owner') {
            throw new ForbiddenException('Il creator/proprietario della conversazione non puo essere rimosso');
          }
          await manager.query(
            `UPDATE "${actor.schema}".conversation_participants
             SET left_at=now() WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL`,
            [conversationId, participantId],
          );
          await manager.query(
            `INSERT INTO "${actor.schema}".conversation_system_events
             (conversation_id,event_type,actor_user_id,payload)
             VALUES ($1,'participant_removed',$2,$3::jsonb)`,
            [conversationId, actor.id, JSON.stringify({ participantId })],
          );
          await this.audit(manager, actor, conversationId, 'participant_removed', undefined, { participantId });
          return { conversationId, participantId, removed: true };
        },
      );
    });
    await this.publishConversation(
      actor,
      conversationId,
      'collaboration.participant.removed',
      { participantId },
      [participantId],
    );
    return result;
  }

  async leaveConversation(conversationValue: string, idempotencyKey?: string) {
    const actor = await this.ensure();
    const conversationId = tenantUuid(conversationValue, 'conversationId');
    const result = await this.dataSource.transaction((manager) => withTenantIdempotency(
      manager,
      actor.schema,
      `conversation:participant:leave:${conversationId}:${actor.id}`,
      idempotencyKey,
      {},
      actor.id,
      async () => {
        const membership = await this.participant(manager, actor, conversationId);
        const conversations = await manager.query(
          `SELECT created_by FROM "${actor.schema}".conversations
           WHERE id=$1 AND deleted_at IS NULL FOR UPDATE`,
          [conversationId],
        );
        if (!conversations[0]) throw new NotFoundException('Conversazione non trovata');
        if (String(conversations[0].created_by) === actor.id || membership.role === 'owner') {
          throw new ForbiddenException('Il creator/proprietario deve trasferire la proprieta prima di uscire');
        }
        await manager.query(
          `UPDATE "${actor.schema}".conversation_participants
           SET left_at=now() WHERE conversation_id=$1 AND user_id=$2 AND left_at IS NULL`,
          [conversationId, actor.id],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".conversation_system_events
           (conversation_id,event_type,actor_user_id,payload)
           VALUES ($1,'participant_left',$2,$3::jsonb)`,
          [conversationId, actor.id, JSON.stringify({ participantId: actor.id })],
        );
        await this.audit(manager, actor, conversationId, 'participant_left', undefined, { participantId: actor.id });
        return { conversationId, participantId: actor.id, left: true };
      },
    ));
    await this.publishConversation(
      actor,
      conversationId,
      'collaboration.participant.left',
      { participantId: actor.id },
      [actor.id],
    );
    return result;
  }

  private messageSelect(schema: string) {
    return `SELECT m.*,
      COALESCE((SELECT jsonb_agg(mm.user_id ORDER BY mm.user_id) FROM "${schema}".conversation_message_mentions mm WHERE mm.message_id=m.id),'[]'::jsonb) AS mention_user_ids,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('userId',mr.user_id,'emoji',mr.emoji) ORDER BY mr.created_at) FROM "${schema}".conversation_message_reactions mr WHERE mr.message_id=m.id),'[]'::jsonb) AS reactions,
      COALESCE((SELECT jsonb_agg(jsonb_build_object('userId',rc.user_id,'readAt',rc.read_at) ORDER BY rc.read_at) FROM "${schema}".conversation_message_receipts rc WHERE rc.message_id=m.id),'[]'::jsonb) AS receipts,
      COALESCE((SELECT COUNT(*)::int FROM "${schema}".conversation_messages child WHERE child.parent_message_id=m.id AND child.deleted_at IS NULL),0) AS reply_count
      FROM "${schema}".conversation_messages m`;
  }

  async listMessages(conversationValue: string, query: Record<string, unknown>) {
    rejectActorOverride(query);
    const actor = await this.ensure();
    const conversationId = tenantUuid(conversationValue, 'conversationId');
    await this.participant(this.dataSource, actor, conversationId);
    const limit = this.limit(query.limit);
    const cursor = this.decodeCursor(query.cursor);
    const params: unknown[] = [conversationId];
    let cursorSql = '';
    if (cursor) { params.push(cursor.at, cursor.id); cursorSql = `AND (m.created_at,m.id)<($2::timestamptz,$3::uuid)`; }
    params.push(limit + 1);
    const rows = await this.dataSource.query(
      `${this.messageSelect(actor.schema)} WHERE m.conversation_id=$1 ${cursorSql}
       ORDER BY m.created_at DESC,m.id DESC LIMIT $${params.length}`, params,
    );
    const hasMore = rows.length > limit;
    const items = rows.slice(0, limit).map((row: any) => ({ ...row, body: row.deleted_at ? null : row.body, isDeleted: Boolean(row.deleted_at) }));
    return { items, nextCursor: hasMore ? this.encodeCursor(items[items.length - 1]) : null };
  }

  private attachments(value: unknown) {
    if (value === undefined || value === null) return [];
    if (!Array.isArray(value) || value.length > 20) throw new BadRequestException('attachmentMetadata non valido');
    return value.map((item) => {
      if (!item || typeof item !== 'object') throw new BadRequestException('attachmentMetadata non valido');
      const source = item as Record<string, unknown>;
      return {
        documentId: source.documentId ? tenantUuid(source.documentId, 'documentId') : undefined,
        name: boundedText(source.name, 'attachment name', 255, true),
        mimeType: boundedText(source.mimeType, 'mimeType', 120),
        size: Math.max(0, Math.min(50_000_000, Number(source.size || 0))),
      };
    });
  }

  private async validateMentions(manager: EntityManager, actor: TenantActor, conversationId: string, ids: string[]) {
    if (!ids.length) return;
    const rows = await manager.query(
      `SELECT user_id FROM "${actor.schema}".conversation_participants
       WHERE conversation_id=$1 AND user_id=ANY($2::uuid[]) AND left_at IS NULL`, [conversationId, ids],
    );
    const allowed = new Set(rows.map((row: any) => String(row.user_id)));
    if (ids.some((id) => !allowed.has(id))) throw new BadRequestException('Menzione non appartenente alla conversazione');
  }

  async sendMessage(conversationValue: string, body: Record<string, unknown>, idempotencyKey?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canSendMessages');
    const conversationId = tenantUuid(conversationValue, 'conversationId');
    const text = boundedText(body.body ?? body.text, 'body', 20_000);
    const attachments = this.attachments(body.attachmentMetadata ?? body.attachment_metadata);
    if (!text && !attachments.length) throw new BadRequestException('Messaggio vuoto');
    const parentId = body.parentMessageId || body.parent_message_id ? tenantUuid(body.parentMessageId ?? body.parent_message_id, 'parentMessageId') : null;
    const mentions = this.normalizeIds(body.mentionUserIds ?? body.mention_user_ids, 'mentionUserId');
    const result = await this.dataSource.transaction(async (manager) => {
      await this.participant(manager, actor, conversationId);
      return withTenantIdempotency(manager, actor.schema, `message:create:${conversationId}:${actor.id}`, idempotencyKey, { text, attachments, parentId, mentions }, actor.id, async () => {
        if (parentId) {
          const parent = await manager.query(
            `SELECT 1 FROM "${actor.schema}".conversation_messages
             WHERE id=$1 AND conversation_id=$2 AND deleted_at IS NULL LIMIT 1`, [parentId, conversationId],
          );
          if (!parent[0]) throw new BadRequestException('Messaggio parent non disponibile');
        }
        await this.validateMentions(manager, actor, conversationId, mentions);
        const rows = await manager.query(
          `INSERT INTO "${actor.schema}".conversation_messages
           (conversation_id,parent_message_id,author_id,body,attachment_metadata)
           VALUES ($1,$2,$3,$4,$5::jsonb) RETURNING *`,
          [conversationId, parentId, actor.id, text, JSON.stringify(attachments)],
        );
        const message = rows[0];
        for (const userId of mentions) await manager.query(
          `INSERT INTO "${actor.schema}".conversation_message_mentions (message_id,user_id) VALUES ($1,$2)`, [message.id, userId],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".conversation_message_receipts (message_id,user_id,read_at)
           VALUES ($1,$2,now()) ON CONFLICT (message_id,user_id) DO UPDATE SET read_at=now()`, [message.id, actor.id],
        );
        await manager.query(`UPDATE "${actor.schema}".conversations SET updated_at=now() WHERE id=$1`, [conversationId]);
        await this.audit(manager, actor, conversationId, parentId ? 'message_replied' : 'message_created', message.id, { mentionUserIds: mentions });
        return {
          ...message,
          mention_user_ids: mentions,
          reactions: [],
          receipts: [{ userId: actor.id, readAt: message.created_at }],
          reply_count: 0,
        };
      });
    });
    await this.publishConversation(actor, conversationId, parentId ? 'collaboration.message.replied' : 'collaboration.message.created', {
      messageId: result.id,
      parentMessageId: parentId,
    });
    return result;
  }

  private async mutableMessage(manager: EntityManager, actor: TenantActor, conversationId: string, messageId: string) {
    await this.participant(manager, actor, conversationId);
    const rows = await manager.query(
      `SELECT m.*,cp.role AS participant_role FROM "${actor.schema}".conversation_messages m
       JOIN "${actor.schema}".conversation_participants cp ON cp.conversation_id=m.conversation_id AND cp.user_id=$3 AND cp.left_at IS NULL
       WHERE m.id=$1 AND m.conversation_id=$2 FOR UPDATE`, [messageId, conversationId, actor.id],
    );
    const message = rows[0];
    if (!message) throw new NotFoundException('Messaggio non trovato');
    if (String(message.author_id) !== actor.id && !isTenantAdministrator(actor)) {
      const canModerate = await this.capabilities.has(actor, 'canModerateMessages');
      if (!canModerate) throw new ForbiddenException('Messaggio non modificabile');
    }
    return message;
  }

  async updateMessage(conversationValue: string, messageValue: string, body: Record<string, unknown>, idempotencyKey?: string) {
    rejectActorOverride(body);
    const actor = await this.ensure('canEditMessages');
    const conversationId = tenantUuid(conversationValue, 'conversationId');
    const messageId = tenantUuid(messageValue, 'messageId');
    const text = boundedText(body.body ?? body.text, 'body', 20_000, true);
    const mentions = this.normalizeIds(body.mentionUserIds ?? body.mention_user_ids, 'mentionUserId');
    const result = await this.dataSource.transaction(async (manager) => withTenantIdempotency(
      manager, actor.schema, `message:update:${messageId}:${actor.id}`, idempotencyKey, { text, mentions, optimisticVersion: body.optimisticVersion ?? body.optimistic_version }, actor.id,
      async () => {
        const current = await this.mutableMessage(manager, actor, conversationId, messageId);
        const requestedVersion = body.optimisticVersion ?? body.optimistic_version;
        if (requestedVersion !== undefined && Number(requestedVersion) !== Number(current.optimistic_version)) {
          throw new ConflictException('Il messaggio e stato modificato da un altro utente');
        }
        await this.validateMentions(manager, actor, conversationId, mentions);
        await manager.query(
          `INSERT INTO "${actor.schema}".conversation_message_revisions
           (message_id,version,body,attachment_metadata,changed_by,reason)
           VALUES ($1,$2,$3,$4::jsonb,$5,'edit')`,
          [messageId, current.optimistic_version, current.body, JSON.stringify(current.attachment_metadata || []), actor.id],
        );
        const rows = await manager.query(
          `UPDATE "${actor.schema}".conversation_messages SET body=$2,optimistic_version=optimistic_version+1,
           edited_at=now(),updated_at=now() WHERE id=$1 RETURNING *`, [messageId, text],
        );
        await manager.query(`DELETE FROM "${actor.schema}".conversation_message_mentions WHERE message_id=$1`, [messageId]);
        for (const userId of mentions) await manager.query(
          `INSERT INTO "${actor.schema}".conversation_message_mentions (message_id,user_id) VALUES ($1,$2)`, [messageId, userId],
        );
        await this.audit(manager, actor, conversationId, 'message_updated', messageId);
        return { ...rows[0], mention_user_ids: mentions };
      },
    ));
    await this.publishConversation(actor, conversationId, 'collaboration.message.updated', { messageId });
    return result;
  }

  async deleteMessage(conversationValue: string, messageValue: string, idempotencyKey?: string) {
    const actor = await this.ensure('canDeleteMessages');
    const conversationId = tenantUuid(conversationValue, 'conversationId');
    const messageId = tenantUuid(messageValue, 'messageId');
    const result = await this.dataSource.transaction(async (manager) => withTenantIdempotency(
      manager, actor.schema, `message:delete:${messageId}:${actor.id}`, idempotencyKey, {}, actor.id,
      async () => {
        const current = await this.mutableMessage(manager, actor, conversationId, messageId);
        if (current.deleted_at) return { id: messageId, deleted: true };
        await manager.query(
          `INSERT INTO "${actor.schema}".conversation_message_revisions
           (message_id,version,body,attachment_metadata,changed_by,reason)
           VALUES ($1,$2,$3,$4::jsonb,$5,'delete')`,
          [messageId, current.optimistic_version, current.body, JSON.stringify(current.attachment_metadata || []), actor.id],
        );
        await manager.query(
          `UPDATE "${actor.schema}".conversation_messages SET body='',attachment_metadata='[]'::jsonb,deleted_at=now(),updated_at=now(),
           optimistic_version=optimistic_version+1 WHERE id=$1`, [messageId],
        );
        await this.audit(manager, actor, conversationId, 'message_deleted', messageId);
        return { id: messageId, deleted: true };
      },
    ));
    await this.publishConversation(actor, conversationId, 'collaboration.message.deleted', { messageId });
    return result;
  }

  async setReaction(conversationValue: string, messageValue: string, emojiValue: unknown, active = true) {
    if (emojiValue && typeof emojiValue === 'object' && !Array.isArray(emojiValue)) {
      rejectActorOverride(emojiValue as Record<string, unknown>);
      emojiValue = (emojiValue as Record<string, unknown>).emoji;
    }
    const actor = await this.ensure('canReactMessages');
    const conversationId = tenantUuid(conversationValue, 'conversationId');
    const messageId = tenantUuid(messageValue, 'messageId');
    const emoji = boundedText(emojiValue, 'emoji', 32, true);
    await this.participant(this.dataSource, actor, conversationId);
    const message = await this.dataSource.query(
      `SELECT 1 FROM "${actor.schema}".conversation_messages WHERE id=$1 AND conversation_id=$2 AND deleted_at IS NULL`, [messageId, conversationId],
    );
    if (!message[0]) throw new NotFoundException('Messaggio non trovato');
    if (active) await this.dataSource.query(
      `INSERT INTO "${actor.schema}".conversation_message_reactions (message_id,user_id,emoji)
       VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`, [messageId, actor.id, emoji],
    );
    else await this.dataSource.query(
      `DELETE FROM "${actor.schema}".conversation_message_reactions WHERE message_id=$1 AND user_id=$2 AND emoji=$3`, [messageId, actor.id, emoji],
    );
    const result = { messageId, emoji, active };
    await this.publishConversation(actor, conversationId, 'collaboration.reaction.updated', { messageId, emoji, active });
    return result;
  }

  async markRead(conversationValue: string, messageValue: string) {
    const actor = await this.ensure();
    const conversationId = tenantUuid(conversationValue, 'conversationId');
    const messageId = tenantUuid(messageValue, 'messageId');
    await this.participant(this.dataSource, actor, conversationId);
    const rows = await this.dataSource.query(
      `SELECT created_at FROM "${actor.schema}".conversation_messages WHERE id=$1 AND conversation_id=$2 LIMIT 1`, [messageId, conversationId],
    );
    if (!rows[0]) throw new NotFoundException('Messaggio non trovato');
    await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `INSERT INTO "${actor.schema}".conversation_message_receipts (message_id,user_id,read_at)
         VALUES ($1,$2,now()) ON CONFLICT (message_id,user_id) DO UPDATE SET read_at=now()`, [messageId, actor.id],
      );
      await manager.query(
        `UPDATE "${actor.schema}".conversation_participants SET last_read_at=GREATEST(COALESCE(last_read_at,'epoch'),$3)
         WHERE conversation_id=$1 AND user_id=$2`, [conversationId, actor.id, rows[0].created_at],
      );
    });
    const result = { conversationId, messageId, read: true };
    await this.publishConversation(actor, conversationId, 'collaboration.receipt.updated', { messageId, userId: actor.id });
    return result;
  }

  async revisions(conversationValue: string, messageValue: string) {
    const actor = await this.ensure();
    const conversationId = tenantUuid(conversationValue, 'conversationId');
    const messageId = tenantUuid(messageValue, 'messageId');
    await this.participant(this.dataSource, actor, conversationId);
    const owns = await this.dataSource.query(
      `SELECT 1 FROM "${actor.schema}".conversation_messages WHERE id=$1 AND conversation_id=$2`, [messageId, conversationId],
    );
    if (!owns[0]) throw new NotFoundException('Messaggio non trovato');
    return { items: await this.dataSource.query(
      `SELECT id,message_id,version,body,attachment_metadata,changed_by,reason,created_at
       FROM "${actor.schema}".conversation_message_revisions WHERE message_id=$1 ORDER BY version DESC`, [messageId],
    ) };
  }
}
