import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { DataSource, EntityManager } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { NotificationsService } from '../realtime/notifications.service';
import {
  assertCallTransition,
  callOutcomeForState,
  isTerminalCallState,
  parseCallState,
  type TenantCallContextKind,
  type TenantCallState,
  type TenantCallType,
} from './tenant-calls-domain';
import { ensureTenantCallActivityProjection, ensureTenantCallTables } from './tenant-calls-schema';

export type CallCrmContext = {
  kind: TenantCallContextKind;
  id: string;
  companyId?: string | null;
  contactId?: string | null;
  opportunityId?: string | null;
  projectId?: string | null;
};

export type TenantCallRow = {
  id: string;
  conversation_id?: string | null;
  room_key: string;
  call_type: TenantCallType;
  status: TenantCallState;
  created_by: string;
  caller_user_id: string;
  callee_user_id?: string | null;
  created_at: Date | string;
  ringing_at?: Date | string | null;
  accepted_at?: Date | string | null;
  connecting_at?: Date | string | null;
  started_at?: Date | string | null;
  ended_at?: Date | string | null;
  expires_at: Date | string;
  duration_seconds?: number | null;
  outcome?: string | null;
  termination_reason?: string | null;
  crm_context_type?: TenantCallContextKind | null;
  crm_context_id?: string | null;
  metadata?: Record<string, unknown> | string | null;
  accepted_device_id?: string | null;
  optimistic_version: number;
  guest_mode: boolean;
};

type CreateCallInput = {
  actorId: string;
  calleeUserId?: string;
  conversationId?: string | null;
  callType: TenantCallType;
  context: CallCrmContext | null;
  callerName: string;
  calleeName?: string;
  idempotencyKey: string;
  ringingTimeoutSeconds: number;
  connectTimeoutSeconds: number;
  maximumSeconds: number;
  guestMode?: boolean;
};

type TransitionOptions = {
  actorId?: string | null;
  deviceId?: string;
  reason?: string;
  eventKey?: string;
  occurredAt?: Date;
};

const TERMINAL = "('rejected','cancelled','missed','busy','failed','ended')";

function stable(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function requestHash(value: unknown) {
  return createHash('sha256').update(stable(value)).digest('hex');
}

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

function metadata(row: TenantCallRow): Record<string, unknown> {
  if (!row.metadata) return {};
  if (typeof row.metadata === 'object') return row.metadata;
  try { return JSON.parse(row.metadata) as Record<string, unknown>; } catch { return {}; }
}

@Injectable()
export class TenantCallsStoreService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly notifications: NotificationsService,
  ) {}

  async ensure(schemaValue: string) {
    const schema = safeSchema(schemaValue, 'TenantCallsStoreService.ensure');
    await ensureTenantCallTables(this.dataSource, schema);
    return schema;
  }

  private summary(row: TenantCallRow) {
    const details = metadata(row);
    return {
      id: String(row.id),
      callId: String(row.id),
      type: row.call_type,
      status: row.status,
      callerUserId: String(row.caller_user_id),
      calleeUserId: row.callee_user_id ? String(row.callee_user_id) : null,
      callerName: String(details.callerName || 'Utente Doflow'),
      calleeName: details.calleeName ? String(details.calleeName) : null,
      guestDisplayName: details.guestDisplayName ? String(details.guestDisplayName) : null,
      guestMode: Boolean(row.guest_mode),
      conversationId: row.conversation_id ? String(row.conversation_id) : null,
      context: row.crm_context_type && row.crm_context_id
        ? { kind: row.crm_context_type, id: String(row.crm_context_id) }
        : null,
      createdAt: iso(row.created_at),
      ringingAt: iso(row.ringing_at),
      acceptedAt: iso(row.accepted_at),
      connectingAt: iso(row.connecting_at),
      startedAt: iso(row.started_at),
      endedAt: iso(row.ended_at),
      expiresAt: iso(row.expires_at),
      durationSeconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
      outcome: row.outcome || null,
      terminationReason: row.termination_reason || null,
      version: Number(row.optimistic_version || 1),
    };
  }

  private async lockUsers(manager: EntityManager, schema: string, userIds: string[]) {
    for (const userId of [...new Set(userIds)].sort()) {
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtext('desktop-call-user'),hashtext($1))`,
        [`${schema}:${userId}`],
      );
    }
    await manager.query(
      `DELETE FROM "${schema}".tenant_call_user_locks l
       USING "${schema}".tenant_call_sessions c
       WHERE l.call_id=c.id
         AND (c.status IN ${TERMINAL} OR c.expires_at<=now())`,
    );
  }

  private async audit(
    manager: EntityManager,
    schema: string,
    callId: string,
    action: string,
    actorId?: string | null,
    eventKey?: string,
    details: Record<string, unknown> = {},
  ) {
    await manager.query(
      `INSERT INTO "${schema}".tenant_call_audit
         (call_id,actor_user_id,action,event_key,metadata,created_at)
       VALUES ($1,$2,$3,$4,$5::jsonb,now())
       ON CONFLICT (event_key) WHERE event_key IS NOT NULL DO NOTHING`,
      [callId, actorId || null, action, eventKey || null, JSON.stringify(details)],
    );
  }

  private async recordActivity(manager: EntityManager, schema: string, row: TenantCallRow) {
    if (!isTerminalCallState(row.status)) return;
    // CRM modules are heterogeneous across tenant schemas. Isolate projection in a
    // savepoint so an optional legacy constraint can never roll back the call outcome.
    await manager.query('SAVEPOINT doflow_call_activity_projection');
    try {
      if (!(await ensureTenantCallActivityProjection(manager, schema))) {
        await manager.query('RELEASE SAVEPOINT doflow_call_activity_projection');
        await this.audit(manager, schema, row.id, 'call_activity_projection_unavailable', null, `activity-unavailable:${row.id}`);
        return;
      }
      const claimed = await manager.query(
        `INSERT INTO "${schema}".tenant_call_activities(call_id,recorded_at)
         VALUES ($1,now()) ON CONFLICT (call_id) DO NOTHING RETURNING call_id`,
        [row.id],
      );
      if (!claimed[0]) {
        await manager.query('RELEASE SAVEPOINT doflow_call_activity_projection');
        return;
      }
      const details = metadata(row);
      const crm = (details.crmContext && typeof details.crmContext === 'object'
        ? details.crmContext
        : {}) as Record<string, unknown>;
      const otherName = String(details.guestDisplayName || details.calleeName || 'partecipante Doflow');
      const title = `${row.call_type === 'video' ? 'Videochiamata' : 'Audiochiamata'} con ${otherName}`;
      const activities = await manager.query(
        `INSERT INTO "${schema}".commercial_activities (
           company_id,contact_id,opportunity_id,project_id,type,title,description,
           completed_at,created_by,updated_by,channel,direction,status,outcome,metadata,
           created_at,updated_at
         ) VALUES ($1,$2,$3,$4,'call',$5,$6,$7,$8,$8,'doflow_calls',$9,$10,$11,$12::jsonb,now(),now())
         RETURNING id`,
        [
          crm.companyId || null,
          crm.contactId || null,
          crm.opportunityId || null,
          crm.projectId || null,
          title,
          row.duration_seconds == null ? null : `Durata: ${Number(row.duration_seconds)} secondi`,
          row.ended_at || new Date(),
          row.caller_user_id,
          Boolean(row.guest_mode) ? 'external' : 'internal',
          row.status,
          row.outcome || callOutcomeForState(row.status),
          JSON.stringify({
            timeline_event: true,
            desktop_call_id: row.id,
            call_type: row.call_type,
            duration_seconds: row.duration_seconds == null ? null : Number(row.duration_seconds),
            guest: Boolean(row.guest_mode),
          }),
        ],
      );
      await manager.query(
        `UPDATE "${schema}".tenant_call_activities SET activity_id=$2 WHERE call_id=$1`,
        [row.id, activities[0]?.id || null],
      );
      await manager.query('RELEASE SAVEPOINT doflow_call_activity_projection');
    } catch {
      await manager.query('ROLLBACK TO SAVEPOINT doflow_call_activity_projection');
      await manager.query('RELEASE SAVEPOINT doflow_call_activity_projection');
      await this.audit(manager, schema, row.id, 'call_activity_projection_failed', null, `activity-failed:${row.id}`);
    }
  }

  async create(schemaValue: string, input: CreateCallInput) {
    const schema = await this.ensure(schemaValue);
    const hash = requestHash({
      calleeUserId: input.calleeUserId || null,
      conversationId: input.conversationId || null,
      callType: input.callType,
      context: input.context,
      guestMode: Boolean(input.guestMode),
    });
    const roomKey = `df-${randomBytes(24).toString('base64url')}`;
    const now = new Date();
    const ringExpires = new Date(now.getTime() + input.ringingTimeoutSeconds * 1000);
    const guestExpires = new Date(now.getTime() + input.maximumSeconds * 1000);
    const users = [input.actorId, ...(input.calleeUserId ? [input.calleeUserId] : [])];

    const row = await this.dataSource.transaction(async (manager) => {
      await this.lockUsers(manager, schema, users);
      const replay = await manager.query(
        `SELECT * FROM "${schema}".tenant_call_sessions
         WHERE created_by=$1 AND idempotency_key=$2 LIMIT 1 FOR UPDATE`,
        [input.actorId, input.idempotencyKey],
      );
      if (replay[0]) {
        if (String(replay[0].idempotency_hash || '') !== hash) {
          throw new ConflictException('Idempotency-Key già usata con una richiesta diversa');
        }
        return replay[0] as TenantCallRow;
      }

      const locks = await manager.query(
        `SELECT l.user_id,l.call_id FROM "${schema}".tenant_call_user_locks l
         JOIN "${schema}".tenant_call_sessions c ON c.id=l.call_id
         WHERE l.user_id=ANY($1::uuid[]) AND c.status NOT IN ${TERMINAL}
         FOR UPDATE OF l`,
        [users],
      );
      const busy = locks.length > 0;
      const initialState: TenantCallState = busy ? 'busy' : input.guestMode ? 'accepted' : 'created';
      const expiresAt = input.guestMode ? guestExpires : ringExpires;
      const rows = await manager.query(
        `INSERT INTO "${schema}".tenant_call_sessions (
           conversation_id,room_key,status,created_by,caller_user_id,callee_user_id,
           call_type,created_at,ringing_at,accepted_at,expires_at,outcome,
           crm_context_type,crm_context_id,metadata,idempotency_key,idempotency_hash,
           optimistic_version,last_state_event_at,guest_mode,ended_at
         ) VALUES ($1,$2,$3,$4,$4,$5,$6,now(),$7,$8,$9,$10,$11,$12,$13::jsonb,$14,$15,1,now(),$16,$17)
         RETURNING *`,
        [
          input.conversationId || null,
          roomKey,
          initialState,
          input.actorId,
          input.calleeUserId || null,
          input.callType,
          !busy && !input.guestMode ? now : null,
          !busy && input.guestMode ? now : null,
          expiresAt,
          busy ? 'busy' : null,
          input.context?.kind || null,
          input.context?.id || null,
          JSON.stringify({
            callerName: input.callerName,
            ...(input.calleeName ? { calleeName: input.calleeName } : {}),
            ...(input.context ? { crmContext: input.context } : {}),
            maximumSeconds: input.maximumSeconds,
            connectTimeoutSeconds: input.connectTimeoutSeconds,
          }),
          input.idempotencyKey,
          hash,
          Boolean(input.guestMode),
          busy ? now : null,
        ],
      );
      let created = rows[0] as TenantCallRow;
      await this.audit(manager, schema, created.id, 'call_created', input.actorId, undefined, {
        callType: input.callType,
        guest: Boolean(input.guestMode),
      });
      if (busy) {
        await this.audit(manager, schema, created.id, 'call_busy', input.actorId);
        await this.recordActivity(manager, schema, created);
        return created;
      }
      for (const userId of users) {
        await manager.query(
          `INSERT INTO "${schema}".tenant_call_user_locks(user_id,call_id,acquired_at)
           VALUES ($1,$2,now())`,
          [userId, created.id],
        );
      }
      await manager.query(
        `INSERT INTO public.desktop_call_room_index(room_key,tenant_schema,call_id,created_at)
         VALUES ($1,$2,$3,now())`,
        [roomKey, schema, created.id],
      );
      if (!input.guestMode) {
        assertCallTransition('created', 'ringing');
        const ringing = await manager.query(
          `UPDATE "${schema}".tenant_call_sessions
           SET status='ringing',ringing_at=now(),optimistic_version=optimistic_version+1,last_state_event_at=now()
           WHERE id=$1 RETURNING *`,
          [created.id],
        );
        created = ringing[0] as TenantCallRow;
        await this.audit(manager, schema, created.id, 'call_ringing', input.actorId);
      } else {
        await this.audit(manager, schema, created.id, 'call_accepted', input.actorId);
      }
      return created;
    });
    return this.summary(row);
  }

  async getParticipantCall(schemaValue: string, callId: string, userId: string) {
    const schema = await this.ensure(schemaValue);
    const rows: TenantCallRow[] = await this.dataSource.query(
      `SELECT * FROM "${schema}".tenant_call_sessions
       WHERE id=$1 AND (caller_user_id=$2 OR callee_user_id=$2)`,
      [callId, userId],
    );
    if (!rows[0]) throw new ForbiddenException('Chiamata non autorizzata');
    return rows[0] as TenantCallRow;
  }

  async getCall(schemaValue: string, callId: string) {
    const schema = await this.ensure(schemaValue);
    const rows = await this.dataSource.query(
      `SELECT * FROM "${schema}".tenant_call_sessions WHERE id=$1 LIMIT 1`,
      [callId],
    );
    if (!rows[0]) throw new NotFoundException('Chiamata non trovata');
    return rows[0] as TenantCallRow;
  }

  async detail(schemaValue: string, callId: string, userId: string) {
    const row = await this.getParticipantCall(schemaValue, callId, userId);
    return this.summary(row);
  }

  async systemDetail(schemaValue: string, callId: string) {
    return this.summary(await this.getCall(schemaValue, callId));
  }

  async incoming(schemaValue: string, userId: string) {
    const schema = await this.ensure(schemaValue);
    await this.expireTenant(schema);
    const rows: TenantCallRow[] = await this.dataSource.query(
      `SELECT * FROM "${schema}".tenant_call_sessions
       WHERE callee_user_id=$1 AND status='ringing' AND expires_at>now()
       ORDER BY ringing_at DESC LIMIT 10`,
      [userId],
    );
    return rows.map((row) => this.summary(row));
  }

  async userHasActiveCall(schemaValue: string, userId: string) {
    const schema = await this.ensure(schemaValue);
    const rows = await this.dataSource.query(
      `SELECT EXISTS (
         SELECT 1
         FROM "${schema}".tenant_call_user_locks l
         JOIN "${schema}".tenant_call_sessions c ON c.id=l.call_id
         WHERE l.user_id=$1 AND c.status NOT IN ${TERMINAL} AND c.expires_at>now()
       ) AS active`,
      [userId],
    );
    return rows[0]?.active === true;
  }

  async transition(schemaValue: string, callId: string, target: TenantCallState, options: TransitionOptions = {}) {
    const schema = await this.ensure(schemaValue);
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT * FROM "${schema}".tenant_call_sessions WHERE id=$1 FOR UPDATE`,
        [callId],
      );
      let row = rows[0] as TenantCallRow | undefined;
      if (!row) throw new NotFoundException('Chiamata non trovata');
      const actorId = options.actorId || null;
      if (actorId && actorId !== String(row.caller_user_id) && actorId !== String(row.callee_user_id || '')) {
        throw new ForbiddenException('Chiamata non autorizzata');
      }
      if (row.status === target) {
        if (
          target === 'accepted'
          && row.accepted_device_id
          && options.deviceId
          && row.accepted_device_id !== options.deviceId
        ) {
          throw new ConflictException({
            error: 'CALL_ACCEPTED_ELSEWHERE',
            message: 'La chiamata è già stata accettata su un altro dispositivo.',
          });
        }
        return this.summary(row);
      }
      if (isTerminalCallState(row.status)) {
        throw new ConflictException({ error: 'CALL_ALREADY_FINAL', message: 'La chiamata è già conclusa.' });
      }
      assertCallTransition(row.status, target);
      if ((target === 'accepted' || target === 'rejected') && actorId !== String(row.callee_user_id || '')) {
        throw new ForbiddenException('Solo il destinatario può rispondere alla chiamata');
      }
      if (target === 'cancelled' && actorId !== String(row.caller_user_id)) {
        throw new ForbiddenException('Solo il chiamante può annullare la chiamata');
      }
      if (target === 'accepted' && new Date(row.expires_at).getTime() <= Date.now()) {
        throw new ConflictException({ error: 'CALL_EXPIRED', message: 'La chiamata non è più disponibile.' });
      }
      const occurredAt = options.occurredAt || new Date();
      const terminal = isTerminalCallState(target);
      const startedAt = row.started_at ? new Date(row.started_at) : null;
      const duration = terminal && startedAt
        ? Math.max(0, Math.floor((occurredAt.getTime() - startedAt.getTime()) / 1000))
        : null;
      const updated = await manager.query(
        `UPDATE "${schema}".tenant_call_sessions SET
           status=$2,
           accepted_at=CASE WHEN $2='accepted' THEN COALESCE(accepted_at,$3) ELSE accepted_at END,
           accepted_device_id=CASE WHEN $2='accepted' THEN $4 ELSE accepted_device_id END,
           connecting_at=CASE WHEN $2='connecting' THEN COALESCE(connecting_at,$3) ELSE connecting_at END,
           started_at=CASE WHEN $2='active' THEN COALESCE(started_at,$3) ELSE started_at END,
           ended_at=CASE WHEN $5 THEN COALESCE(ended_at,$3) ELSE ended_at END,
           duration_seconds=CASE WHEN $5 THEN $6 ELSE duration_seconds END,
           outcome=CASE WHEN $5 THEN $7 ELSE outcome END,
           termination_reason=CASE WHEN $5 THEN $8 ELSE termination_reason END,
           expires_at=CASE
             WHEN $2 IN ('accepted','connecting') THEN $3 + make_interval(
               secs => LEAST(GREATEST(COALESCE((metadata->>'connectTimeoutSeconds')::int,90),30),300)
             )
             WHEN $2='active' THEN $3 + make_interval(
               secs => LEAST(GREATEST(COALESCE((metadata->>'maximumSeconds')::int,14400),300),43200)
             )
             ELSE expires_at
           END,
           optimistic_version=optimistic_version+1,
           last_state_event_at=$3
         WHERE id=$1 RETURNING *`,
        [
          callId,
          target,
          occurredAt,
          options.deviceId || null,
          terminal,
          duration,
          terminal ? callOutcomeForState(target) : null,
          options.reason || null,
        ],
      );
      row = updated[0] as TenantCallRow;
      await this.audit(manager, schema, callId, `call_${target}`, actorId, options.eventKey, {
        reason: options.reason || null,
      });
      if (terminal) {
        await manager.query(`DELETE FROM "${schema}".tenant_call_user_locks WHERE call_id=$1`, [callId]);
        await manager.query(
          `UPDATE "${schema}".tenant_call_guest_invites SET revoked_at=COALESCE(revoked_at,now()) WHERE call_id=$1`,
          [callId],
        );
        await manager.query(
          `UPDATE public.desktop_call_room_index SET ended_at=COALESCE(ended_at,now()) WHERE call_id=$1`,
          [callId],
        );
        await manager.query(
          `UPDATE public.desktop_call_guest_invite_index p SET revoked_at=COALESCE(p.revoked_at,now())
           FROM "${schema}".tenant_call_guest_invites i
           WHERE i.call_id=$1 AND p.invite_id=i.id`,
          [callId],
        );
        await this.recordActivity(manager, schema, row);
      }
      return this.summary(row);
    });
  }

  async tokenParticipant(schemaValue: string, callId: string, userId: string) {
    const schema = await this.ensure(schemaValue);
    const rows = await this.dataSource.transaction(async (manager) => {
      const selected = await manager.query(
        `SELECT c.*,COALESCE(NULLIF(tm.display_name,''),NULLIF(u.full_name,''),u.email,'Utente Doflow') AS participant_name
         FROM "${schema}".tenant_call_sessions c
         LEFT JOIN "${schema}".users u ON u.id=$2
         LEFT JOIN "${schema}".team_members tm ON tm.user_id=$2 AND tm.deleted_at IS NULL
         WHERE c.id=$1 AND (c.caller_user_id=$2 OR c.callee_user_id=$2)
         LIMIT 1 FOR UPDATE OF c`,
        [callId, userId],
      );
      let row = selected[0] as (TenantCallRow & { participant_name?: string }) | undefined;
      if (!row) throw new ForbiddenException('Token chiamata non autorizzato');
      if (!['accepted', 'connecting', 'active'].includes(row.status)) {
        throw new ConflictException({ error: 'CALL_NOT_JOINABLE', message: 'La chiamata non è ancora disponibile.' });
      }
      if (row.status === 'accepted') {
        assertCallTransition('accepted', 'connecting');
        const updated = await manager.query(
          `UPDATE "${schema}".tenant_call_sessions
           SET status='connecting',connecting_at=COALESCE(connecting_at,now()),optimistic_version=optimistic_version+1,last_state_event_at=now()
           WHERE id=$1 RETURNING *`,
          [callId],
        );
        row = { ...updated[0], participant_name: row.participant_name };
        await this.audit(manager, schema, callId, 'call_connecting', userId);
      }
      return row!;
    });
    if (!rows) throw new NotFoundException('Partecipante chiamata non trovato');
    return {
      row: rows,
      name: String(rows.participant_name || 'Utente Doflow'),
      identity: `u:${createHash('sha256').update(`${schema}:${userId}`).digest('hex').slice(0, 40)}`,
    };
  }

  async createGuestInvite(
    schemaValue: string,
    callId: string,
    actorId: string,
    ttlSeconds: number,
  ) {
    const schema = await this.ensure(schemaValue);
    const token = randomBytes(32).toString('base64url');
    const digest = createHash('sha256').update(token).digest('hex');
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
    const invite = await this.dataSource.transaction(async (manager) => {
      const calls = await manager.query(
        `SELECT * FROM "${schema}".tenant_call_sessions
         WHERE id=$1 AND caller_user_id=$2 AND guest_mode=true AND status NOT IN ${TERMINAL}
         FOR UPDATE`,
        [callId, actorId],
      );
      if (!calls[0]) throw new ForbiddenException('Invito guest non autorizzato');
      const rows = await manager.query(
        `INSERT INTO "${schema}".tenant_call_guest_invites
           (call_id,token_digest,created_by,created_at,expires_at)
         VALUES ($1,$2,$3,now(),$4) RETURNING id,call_id,expires_at`,
        [callId, digest, actorId, expiresAt],
      );
      await manager.query(
        `INSERT INTO public.desktop_call_guest_invite_index
           (token_digest,tenant_schema,invite_id,created_at,expires_at)
         VALUES ($1,$2,$3,now(),$4)`,
        [digest, schema, rows[0].id, expiresAt],
      );
      await this.audit(manager, schema, callId, 'guest_invite_created', actorId, undefined, {
        inviteId: rows[0].id,
        expiresAt: expiresAt.toISOString(),
      });
      return rows[0];
    });
    return { ...invite, token, expiresAt: expiresAt.toISOString() };
  }

  async revokeGuestInvite(schemaValue: string, inviteId: string, actorId: string) {
    const schema = await this.ensure(schemaValue);
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `UPDATE "${schema}".tenant_call_guest_invites i
         SET revoked_at=COALESCE(revoked_at,now())
         FROM "${schema}".tenant_call_sessions c
         WHERE i.id=$1 AND i.call_id=c.id AND c.caller_user_id=$2
         RETURNING i.id,i.call_id,i.revoked_at`,
        [inviteId, actorId],
      );
      if (!rows[0]) throw new ForbiddenException('Revoca invito non autorizzata');
      await manager.query(
        `UPDATE public.desktop_call_guest_invite_index SET revoked_at=COALESCE(revoked_at,now()) WHERE invite_id=$1`,
        [inviteId],
      );
      await this.audit(manager, schema, rows[0].call_id, 'guest_invite_revoked', actorId, undefined, {
        inviteId,
      });
      return { inviteId, revoked: true };
    });
  }

  async resolveGuestToken(token: string) {
    const digest = createHash('sha256').update(token).digest('hex');
    const index = await this.dataSource.query(
      `SELECT tenant_schema,invite_id FROM public.desktop_call_guest_invite_index
       WHERE token_digest=$1 AND revoked_at IS NULL AND expires_at>now() LIMIT 1`,
      [digest],
    );
    if (!index[0]) throw new NotFoundException('Invito non valido, scaduto o revocato');
    return { schema: safeSchema(index[0].tenant_schema, 'resolveGuestToken'), inviteId: String(index[0].invite_id), digest };
  }

  async guestPreview(schemaValue: string, inviteId: string, digest: string) {
    const schema = await this.ensure(schemaValue);
    const rows = await this.dataSource.query(
      `SELECT i.id,i.expires_at,i.revoked_at,i.consumed_at,c.*,
              COALESCE(NULLIF(tm.display_name,''),NULLIF(u.full_name,''),u.email,'Utente Doflow') AS host_name,
              i.expires_at AS invite_expires_at,
              i.revoked_at AS invite_revoked_at,
              i.consumed_at AS invite_consumed_at
       FROM "${schema}".tenant_call_guest_invites i
       JOIN "${schema}".tenant_call_sessions c ON c.id=i.call_id
       LEFT JOIN "${schema}".users u ON u.id=c.caller_user_id
       LEFT JOIN "${schema}".team_members tm ON tm.user_id=c.caller_user_id AND tm.deleted_at IS NULL
       WHERE i.id=$1 AND i.token_digest=$2 LIMIT 1`,
      [inviteId, digest],
    );
    const row = rows[0] as (TenantCallRow & { invite_expires_at: Date | string; invite_revoked_at?: Date | string | null; invite_consumed_at?: Date | string | null; host_name?: string }) | undefined;
    if (!row || row.invite_revoked_at || new Date(row.invite_expires_at).getTime() <= Date.now() || isTerminalCallState(row.status)) {
      throw new NotFoundException('Invito non valido, scaduto o revocato');
    }
    return {
      inviteId,
      callId: row.id,
      callType: row.call_type,
      hostName: String(row.host_name || 'Utente Doflow'),
      status: row.status,
      expiresAt: iso(row.invite_expires_at),
      alreadyUsed: Boolean(row.invite_consumed_at),
    };
  }

  async consumeGuest(
    schemaValue: string,
    inviteId: string,
    digest: string,
    displayName: string,
  ) {
    const schema = await this.ensure(schemaValue);
    const session = randomBytes(32).toString('base64url');
    const sessionDigest = createHash('sha256').update(session).digest('hex');
    const identity = `g:${randomUUID()}`;
    const result = await this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT i.*,c.*,
                i.expires_at AS invite_expires_at,
                i.revoked_at AS invite_revoked_at,
                i.consumed_at AS invite_consumed_at
         FROM "${schema}".tenant_call_guest_invites i
         JOIN "${schema}".tenant_call_sessions c ON c.id=i.call_id
         WHERE i.id=$1 AND i.token_digest=$2 FOR UPDATE OF i,c`,
        [inviteId, digest],
      );
      const row = rows[0] as (TenantCallRow & { call_id: string; invite_expires_at: Date | string; invite_revoked_at?: Date | string | null; invite_consumed_at?: Date | string | null }) | undefined;
      if (!row || row.invite_revoked_at || new Date(row.invite_expires_at).getTime() <= Date.now() || isTerminalCallState(row.status)) {
        throw new NotFoundException('Invito non valido, scaduto o revocato');
      }
      if (row.invite_consumed_at) throw new ConflictException({ error: 'GUEST_INVITE_USED', message: 'Invito già utilizzato.' });
      await manager.query(
        `UPDATE "${schema}".tenant_call_guest_invites
         SET consumed_at=now(),guest_session_digest=$2,guest_identity=$3,display_name=$4,last_token_at=now()
         WHERE id=$1`,
        [inviteId, sessionDigest, identity, displayName],
      );
      await manager.query(
        `UPDATE "${schema}".tenant_call_sessions
         SET metadata=jsonb_set(metadata,'{guestDisplayName}',to_jsonb($2::text),true),optimistic_version=optimistic_version+1
         WHERE id=$1`,
        [row.call_id, displayName],
      );
      await this.audit(manager, schema, row.call_id, 'guest_token_issued', null, undefined, { inviteId });
      return { row: { ...row, id: row.call_id } as TenantCallRow, identity };
    });
    return { ...result, guestSession: session };
  }

  async renewGuest(inviteId: string, guestSession: string) {
    const index = await this.dataSource.query(
      `SELECT tenant_schema FROM public.desktop_call_guest_invite_index WHERE invite_id=$1 LIMIT 1`,
      [inviteId],
    );
    if (!index[0]) throw new ForbiddenException('Sessione guest non autorizzata');
    const schema = await this.ensure(safeSchema(index[0].tenant_schema, 'renewGuest'));
    const digest = createHash('sha256').update(guestSession).digest('hex');
    const rows = await this.dataSource.query(
      `SELECT i.display_name,i.guest_identity,c.*
       FROM "${schema}".tenant_call_guest_invites i
       JOIN "${schema}".tenant_call_sessions c ON c.id=i.call_id
       WHERE i.id=$1 AND i.guest_session_digest=$2 AND i.revoked_at IS NULL
         AND i.expires_at>now() AND c.status NOT IN ${TERMINAL}
       LIMIT 1`,
      [inviteId, digest],
    );
    if (!rows[0]) throw new ForbiddenException('Sessione guest non autorizzata');
    return { schema, row: rows[0] as TenantCallRow, identity: String(rows[0].guest_identity), name: String(rows[0].display_name) };
  }

  async markWebhookEvent(
    schemaValue: string,
    callId: string,
    eventId: string,
    eventType: string,
    participantIdentity: string | undefined,
    occurredAt: Date,
  ) {
    const schema = await this.ensure(schemaValue);
    const identityHash = participantIdentity
      ? createHash('sha256').update(participantIdentity).digest('hex')
      : null;
    const rows = await this.dataSource.query(
      `INSERT INTO "${schema}".tenant_call_webhook_events
         (event_id,call_id,event_type,participant_identity_hash,occurred_at,processed_at)
       VALUES ($1,$2,$3,$4,$5,now()) ON CONFLICT (event_id) DO NOTHING RETURNING event_id`,
      [eventId, callId, eventType, identityHash, occurredAt],
    );
    return rows.length > 0;
  }

  async joinedParticipantCount(schemaValue: string, callId: string) {
    const schema = await this.ensure(schemaValue);
    const rows = await this.dataSource.query(
      `SELECT count(DISTINCT participant_identity_hash)::int AS total
       FROM "${schema}".tenant_call_webhook_events
       WHERE call_id=$1 AND event_type='participant_joined'
         AND participant_identity_hash IS NOT NULL`,
      [callId],
    );
    return Number(rows[0]?.total || 0);
  }

  async resolveRoom(roomKey: string) {
    const rows = await this.dataSource.query(
      `SELECT tenant_schema,call_id FROM public.desktop_call_room_index WHERE room_key=$1 LIMIT 1`,
      [roomKey],
    );
    if (!rows[0]) return null;
    return { schema: safeSchema(rows[0].tenant_schema, 'resolveRoom'), callId: String(rows[0].call_id) };
  }

  async expireTenant(schemaValue: string) {
    const schema = safeSchema(schemaValue, 'expireTenant');
    const table = await this.dataSource.query(`SELECT to_regclass($1) AS name`, [`${schema}.tenant_call_sessions`]);
    if (!table[0]?.name) return [];
    const rows: TenantCallRow[] = await this.dataSource.query(
      `SELECT * FROM "${schema}".tenant_call_sessions
       WHERE expires_at<=now() AND status IN ('ringing','accepted','connecting')
       ORDER BY expires_at LIMIT 50`,
    );
    const expired = [];
    for (const row of rows) {
      const target: TenantCallState = row.status === 'ringing' ? 'missed' : 'failed';
      try {
        expired.push(await this.transition(schema, row.id, target, {
          reason: target === 'missed' ? 'ringing_timeout' : 'connection_timeout',
          eventKey: `timeout:${row.id}:${target}`,
        }));
      } catch (error) {
        if (!(error instanceof ConflictException)) throw error;
      }
    }
    return expired;
  }

  async publishState(schemaValue: string, summary: Record<string, unknown>, eventType = 'calls.state') {
    const schema = safeSchema(schemaValue, 'publishState');
    const eventId = randomUUID();
    const message = { type: eventType, eventId, payload: summary };
    const recipients = (eventType === 'calls.busy'
      ? [summary.callerUserId]
      : [summary.callerUserId, summary.calleeUserId])
      .filter((value): value is string => typeof value === 'string' && Boolean(value));
    await Promise.all([...new Set(recipients)].map((userId) => this.notifications.notifyUser(userId, message, schema)));
  }
}
