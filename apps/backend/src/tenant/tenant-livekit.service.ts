import { BadRequestException, ForbiddenException, Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { createHash } from 'crypto';
import { DataSource } from 'typeorm';
import { isTenantAdministrator, tenantActor, tenantUuid } from './tenant-universal-context';
import { ensureTenantUniversalFeatureTables } from './tenant-universal-features-schema';
import { TenantUniversalCapabilitiesService } from './tenant-universal-capabilities.service';

@Injectable()
export class TenantLivekitService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
    private readonly capabilities: TenantUniversalCapabilitiesService,
  ) {}
  private actor() { return tenantActor(this.request, 'TenantLivekitService'); }
  private enabled() { return String(process.env.LIVEKIT_ENABLED || 'false').trim().toLowerCase() === 'true'; }
  private config() {
    return {
      url: String(process.env.LIVEKIT_URL || '').trim(),
      key: String(process.env.LIVEKIT_API_KEY || '').trim(),
      secret: String(process.env.LIVEKIT_API_SECRET || '').trim(),
    };
  }

  private sdk() {
    try {
      return require('livekit-server-sdk') as {
        AccessToken: new (...args: any[]) => any;
        RoomServiceClient: new (url: string, key: string, secret: string) => {
          deleteRoom(room: string): Promise<void>;
        };
      };
    } catch {
      throw new ServiceUnavailableException({ error: 'LIVEKIT_SDK_UNAVAILABLE', message: 'Provider chiamate non disponibile.' });
    }
  }

  private async authorize(actor = this.actor()) {
    await this.capabilities.require(actor, 'canViewProjects');
    return actor;
  }

  async status() {
    await this.authorize();
    const config = this.config();
    return {
      enabled: this.enabled(),
      configured: Boolean(config.url && config.key && config.secret),
      status: this.enabled() ? (config.url && config.key && config.secret ? 'ready' : 'provider_unconfigured') : 'disabled',
    };
  }

  async token(body: Record<string, unknown>) {
    const actor = this.actor();
    if (!this.enabled()) throw new ForbiddenException({ error: 'LIVEKIT_DISABLED', message: 'Chiamate non abilitate.' });
    if (body.userId !== undefined || body.user_id !== undefined || body.tenantId !== undefined || body.tenant_id !== undefined || body.room !== undefined || body.roomName !== undefined) {
      throw new BadRequestException('Identita, tenant e room sono determinati dal server');
    }
    await this.authorize(actor);
    const config = this.config();
    if (!config.url || !config.key || !config.secret) {
      throw new ServiceUnavailableException({ error: 'LIVEKIT_PROVIDER_UNCONFIGURED', message: 'Provider chiamate non configurato.' });
    }
    const conversationId = tenantUuid(body.conversationId ?? body.conversation_id, 'conversationId');
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    const participants = await this.dataSource.query(
      `SELECT cp.role FROM "${actor.schema}".conversation_participants cp
       JOIN "${actor.schema}".conversations c ON c.id=cp.conversation_id
       WHERE cp.conversation_id=$1 AND cp.user_id=$2 AND cp.left_at IS NULL AND c.deleted_at IS NULL LIMIT 1`,
      [conversationId, actor.id],
    );
    if (!participants[0]) throw new ForbiddenException('Conversazione non autorizzata');

    const { AccessToken } = this.sdk();
    const roomKey = `t-${createHash('sha256').update(actor.schema).digest('hex').slice(0, 12)}-c-${conversationId}`;
    const call = await this.dataSource.transaction(async (manager) => {
      await manager.query(
        `SELECT pg_advisory_xact_lock(hashtext('tenant-call'),hashtext($1))`,
        [`${actor.schema}:${conversationId}`],
      );
      const existing = await manager.query(
        `SELECT * FROM "${actor.schema}".tenant_call_sessions
         WHERE conversation_id=$1
         ORDER BY created_at DESC LIMIT 1 FOR UPDATE`, [conversationId],
      );
      if (existing[0]?.status === 'active' && !existing[0].ended_at) return existing[0];
      if (existing[0]) {
        const restarted = await manager.query(
          `UPDATE "${actor.schema}".tenant_call_sessions
           SET status='active',ended_at=NULL,created_by=$2,created_at=now() WHERE id=$1 RETURNING *`,
          [existing[0].id, actor.id],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".tenant_call_audit (call_id,actor_user_id,action,metadata)
           VALUES ($1,$2,'call_restarted',$3::jsonb)`,
          [existing[0].id, actor.id, JSON.stringify({ conversationId })],
        );
        return restarted[0];
      }
      const rows = await manager.query(
        `INSERT INTO "${actor.schema}".tenant_call_sessions
         (conversation_id,room_key,status,created_by) VALUES ($1,$2,'active',$3) RETURNING *`,
        [conversationId, roomKey, actor.id],
      );
      await manager.query(
        `INSERT INTO "${actor.schema}".tenant_call_audit (call_id,actor_user_id,action,metadata)
         VALUES ($1,$2,'call_started',$3::jsonb)`,
        [rows[0].id, actor.id, JSON.stringify({ conversationId })],
      );
      return rows[0];
    });
    const canPublish = String(participants[0].role) !== 'viewer';
    const accessToken = new AccessToken(config.key, config.secret, {
      identity: `${actor.schema}:${actor.id}`,
      name: actor.email || actor.id,
      ttl: '5m',
      metadata: JSON.stringify({ tenant: actor.schema, userId: actor.id, conversationId, callId: call.id }),
    });
    accessToken.addGrant({ roomJoin: true, room: call.room_key, canSubscribe: true, canPublish, canPublishData: canPublish });
    const jwt = await accessToken.toJwt();
    await this.dataSource.query(
      `INSERT INTO "${actor.schema}".tenant_call_audit (call_id,actor_user_id,action,metadata)
       VALUES ($1,$2,'token_issued',$3::jsonb)`,
      [call.id, actor.id, JSON.stringify({ conversationId, ttlSeconds: 300, canPublish })],
    );
    return { token: jwt, serverUrl: config.url, room: call.room_key, callId: call.id, conversationId, canPublish, expiresInSeconds: 300 };
  }

  async end(callValue: string) {
    const actor = this.actor();
    if (!this.enabled()) throw new ForbiddenException({ error: 'LIVEKIT_DISABLED', message: 'Chiamate non abilitate.' });
    await this.authorize(actor);
    const config = this.config();
    if (!config.url || !config.key || !config.secret) {
      throw new ServiceUnavailableException({ error: 'LIVEKIT_PROVIDER_UNCONFIGURED', message: 'Provider chiamate non configurato.' });
    }
    const { RoomServiceClient } = this.sdk();
    const rooms = new RoomServiceClient(config.url, config.key, config.secret);
    const callId = tenantUuid(callValue, 'callId');
    await ensureTenantUniversalFeatureTables(this.dataSource, actor.schema);
    return this.dataSource.transaction(async (manager) => {
      const rows = await manager.query(
        `SELECT cs.*,cp.role AS participant_role
         FROM "${actor.schema}".tenant_call_sessions cs
         JOIN "${actor.schema}".conversations c ON c.id=cs.conversation_id AND c.deleted_at IS NULL
         JOIN "${actor.schema}".conversation_participants cp
           ON cp.conversation_id=cs.conversation_id AND cp.user_id=$2 AND cp.left_at IS NULL
         WHERE cs.id=$1 FOR UPDATE OF cs`,
        [callId, actor.id],
      );
      const call = rows[0];
      if (!call) throw new ForbiddenException('Chiamata non autorizzata');
      const mayEnd = String(call.created_by) === actor.id
        || String(call.participant_role) === 'owner'
        || isTenantAdministrator(actor);
      if (!mayEnd) throw new ForbiddenException('Chiusura chiamata non autorizzata');
      if (!call.ended_at || call.status !== 'ended') {
        try {
          await rooms.deleteRoom(String(call.room_key));
        } catch {
          throw new ServiceUnavailableException({
            error: 'LIVEKIT_TERMINATION_FAILED',
            message: 'Il provider chiamate non ha confermato la chiusura.',
          });
        }
        await manager.query(
          `UPDATE "${actor.schema}".tenant_call_sessions SET status='ended',ended_at=now() WHERE id=$1`,
          [callId],
        );
        await manager.query(
          `INSERT INTO "${actor.schema}".tenant_call_audit (call_id,actor_user_id,action,metadata)
           VALUES ($1,$2,'call_ended',$3::jsonb)`,
          [callId, actor.id, JSON.stringify({ conversationId: call.conversation_id })],
        );
      }
      return { callId, conversationId: call.conversation_id, ended: true };
    });
  }
}
