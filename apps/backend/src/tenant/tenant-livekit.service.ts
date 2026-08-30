import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { PresenceRegistryService } from '../realtime/presence-registry.service';
import {
  parseCallContext,
  parseCallIdempotencyKey,
  parseCallType,
  parseDesktopDeviceId,
  type TenantCallContextKind,
} from './tenant-calls-domain';
import { tenantCallsConfig } from './tenant-calls-config';
import { TenantCallsFeatureService } from './tenant-calls-feature.service';
import { TenantCallsLivekitProviderService } from './tenant-calls-livekit-provider.service';
import { TenantCallsStoreService, type CallCrmContext } from './tenant-calls-store.service';
import { TenantCrmService } from './tenant-crm.service';
import { TenantProjectsService } from './tenant-projects.service';
import {
  rejectActorOverride,
  tenantActor,
  tenantUuid,
  type TenantActor,
} from './tenant-universal-context';
import { TenantUniversalCapabilitiesService } from './tenant-universal-capabilities.service';

function field(row: Record<string, unknown>, snake: string, camel: string): string | null {
  const value = row[snake] ?? row[camel];
  const text = String(value || '').trim();
  return /^[0-9a-f-]{36}$/i.test(text) ? text : null;
}

@Injectable()
export class TenantLivekitService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
    private readonly capabilities: TenantUniversalCapabilitiesService,
    private readonly features: TenantCallsFeatureService,
    private readonly presence: PresenceRegistryService,
    private readonly store: TenantCallsStoreService,
    private readonly livekit: TenantCallsLivekitProviderService,
    private readonly crm: TenantCrmService,
    private readonly projects: TenantProjectsService,
  ) {}

  private actor() { return tenantActor(this.request, 'TenantLivekitService'); }

  private rejectOverrides(body: Record<string, unknown>) {
    rejectActorOverride(body);
    for (const key of ['room', 'roomName', 'room_key', 'token', 'callerUserId', 'caller_user_id']) {
      if (body[key] !== undefined) throw new BadRequestException('Identità, tenant, room e token sono determinati dal server');
    }
  }

  private async authorize(actor: TenantActor, guest = false) {
    await this.capabilities.require(actor, guest ? 'canCreateGuestMeetings' : 'canUseDesktopCalls');
    if (guest) await this.features.requireGuest(actor.schema);
    else await this.features.requireInternal(actor.schema);
    return actor;
  }

  private async requireDesktop(actor: TenantActor, deviceValue: unknown) {
    const deviceId = parseDesktopDeviceId(deviceValue);
    if (!(await this.presence.hasDesktopSession(actor.schema, actor.id, deviceId))) {
      throw new ForbiddenException({
        error: 'DESKTOP_SESSION_REQUIRED',
        message: 'Apri Doflow Desktop e attendi la connessione prima di usare le chiamate.',
      });
    }
    return deviceId;
  }

  private async actorName(actor: TenantActor) {
    const rows = await this.dataSource.query(
      `SELECT COALESCE(NULLIF(tm.display_name,''),NULLIF(u.full_name,''),u.email,$2) AS display_name
       FROM "${actor.schema}".users u
       LEFT JOIN "${actor.schema}".team_members tm ON tm.user_id=u.id AND tm.deleted_at IS NULL
       WHERE u.id=$1 AND COALESCE(u.is_active,true)=true LIMIT 1`,
      [actor.id, actor.email || 'Utente Doflow'],
    );
    return String(rows[0]?.display_name || actor.email || 'Utente Doflow').slice(0, 120);
  }

  private async callee(actor: TenantActor, value: unknown) {
    const calleeUserId = tenantUuid(value, 'calleeUserId');
    if (calleeUserId === actor.id) throw new BadRequestException('Non puoi chiamare il tuo stesso account');
    const rows = await this.dataSource.query(
      `SELECT u.id,COALESCE(NULLIF(tm.display_name,''),NULLIF(u.full_name,''),u.email,'Utente Doflow') AS display_name
       FROM "${actor.schema}".users u
       LEFT JOIN "${actor.schema}".team_members tm ON tm.user_id=u.id AND tm.deleted_at IS NULL
       WHERE u.id=$1 AND COALESCE(u.is_active,true)=true LIMIT 1`,
      [calleeUserId],
    );
    if (!rows[0]) throw new NotFoundException('Destinatario non disponibile nel tenant corrente');
    return { id: calleeUserId, name: String(rows[0].display_name || 'Utente Doflow').slice(0, 120) };
  }

  private async conversation(actor: TenantActor, value: unknown, calleeUserId: string) {
    if (value === undefined || value === null || value === '') return null;
    const conversationId = tenantUuid(value, 'conversationId');
    const rows = await this.dataSource.query(
      `SELECT count(DISTINCT cp.user_id)::int AS participant_count,
              count(DISTINCT cp.user_id) FILTER (WHERE cp.user_id=ANY($2::uuid[]))::int AS authorized_count
       FROM "${actor.schema}".conversations c
       JOIN "${actor.schema}".conversation_participants cp ON cp.conversation_id=c.id AND cp.left_at IS NULL
       WHERE c.id=$1 AND c.deleted_at IS NULL`,
      [conversationId, [actor.id, calleeUserId]],
    );
    if (Number(rows[0]?.participant_count || 0) !== 2 || Number(rows[0]?.authorized_count || 0) !== 2) {
      throw new ForbiddenException('La chiamata interna richiede una conversazione diretta autorizzata');
    }
    return conversationId;
  }

  private async context(value: unknown): Promise<CallCrmContext | null> {
    const parsed = parseCallContext(value, tenantUuid);
    if (!parsed) return null;
    if (parsed.kind === 'project') {
      const row = await this.projects.getProject(parsed.id) as Record<string, unknown>;
      return {
        ...parsed,
        companyId: field(row, 'company_id', 'companyId'),
        contactId: field(row, 'contact_id', 'contactId'),
        opportunityId: field(row, 'opportunity_id', 'opportunityId'),
        projectId: parsed.id,
      };
    }
    const resource = ({
      company: 'companies',
      contact: 'contacts',
      opportunity: 'opportunities',
    } satisfies Record<Exclude<TenantCallContextKind, 'project'>, 'companies' | 'contacts' | 'opportunities'>)[parsed.kind];
    const row = await this.crm.findOne(resource, parsed.id) as Record<string, unknown>;
    return {
      ...parsed,
      companyId: parsed.kind === 'company' ? parsed.id : field(row, 'company_id', 'companyId'),
      contactId: parsed.kind === 'contact' ? parsed.id : field(row, 'contact_id', 'contactId'),
      opportunityId: parsed.kind === 'opportunity' ? parsed.id : null,
      projectId: null,
    };
  }

  async status() {
    const actor = this.actor();
    await this.capabilities.require(actor, 'canUseDesktopCalls');
    const availability = await this.features.availability(actor.schema);
    const guestPermitted = await this.capabilities.has(actor, 'canCreateGuestMeetings');
    return {
      ...availability,
      guestEnabled: availability.guestEnabled && guestPermitted,
      userId: actor.id,
      supportsAudio: true,
      supportsVideo: true,
      supportsScreenShare: true,
      supportsGuest: availability.guestEnabled && guestPermitted,
      bridgeMinimumVersion: 2,
      stateMachineVersion: 1,
    };
  }

  async heartbeat(body: Record<string, unknown>) {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.authorize(actor);
    const deviceId = parseDesktopDeviceId(body.deviceId ?? body.device_id);
    const presence = await this.store.userHasActiveCall(actor.schema, actor.id) ? 'in_call' : 'online';
    const state = await this.presence.desktopHeartbeat(actor.schema, actor.id, deviceId, presence);
    return { connected: true, deviceId, expiresInSeconds: 45, state };
  }

  async disconnect(body: Record<string, unknown>) {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.capabilities.require(actor, 'canUseDesktopCalls');
    const deviceId = parseDesktopDeviceId(body.deviceId ?? body.device_id);
    await this.presence.disconnectDesktop(actor.schema, actor.id, deviceId);
    return { connected: false, deviceId };
  }

  async create(body: Record<string, unknown>, idempotencyValue: unknown) {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.authorize(actor);
    const deviceId = await this.requireDesktop(actor, body.deviceId ?? body.device_id);
    const recipient = await this.callee(actor, body.calleeUserId ?? body.callee_user_id);
    if (!(await this.presence.hasDesktopSession(actor.schema, recipient.id))) {
      throw new ConflictException({
        error: 'CALLEE_DESKTOP_OFFLINE',
        message: 'Il destinatario non è disponibile su Doflow Desktop.',
      });
    }
    const callType = parseCallType(body.type ?? body.callType ?? body.call_type);
    const crmContext = await this.context(body.context);
    const conversationId = await this.conversation(actor, body.conversationId ?? body.conversation_id, recipient.id);
    const config = tenantCallsConfig();
    const summary = await this.store.create(actor.schema, {
      actorId: actor.id,
      calleeUserId: recipient.id,
      conversationId,
      callType,
      context: crmContext,
      callerName: await this.actorName(actor),
      calleeName: recipient.name,
      idempotencyKey: parseCallIdempotencyKey(idempotencyValue),
      ringingTimeoutSeconds: config.ringingTimeoutSeconds,
      connectTimeoutSeconds: config.connectTimeoutSeconds,
      maximumSeconds: config.callMaximumSeconds,
    });
    if (summary.status === 'ringing') {
      await this.presence.desktopHeartbeat(actor.schema, actor.id, deviceId, 'in_call');
      await this.store.publishState(actor.schema, summary, 'calls.incoming');
    } else {
      await this.store.publishState(actor.schema, summary, 'calls.busy');
    }
    return summary;
  }

  async incoming(body: Record<string, unknown>) {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.authorize(actor);
    await this.requireDesktop(actor, body.deviceId ?? body.device_id);
    return { items: await this.store.incoming(actor.schema, actor.id) };
  }

  async detail(callValue: string, body: Record<string, unknown> = {}) {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.authorize(actor);
    if (body.deviceId || body.device_id) await this.requireDesktop(actor, body.deviceId ?? body.device_id);
    return this.store.detail(actor.schema, tenantUuid(callValue, 'callId'), actor.id);
  }

  private async respond(callValue: string, body: Record<string, unknown>, target: 'accepted' | 'rejected') {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.authorize(actor);
    const deviceId = await this.requireDesktop(actor, body.deviceId ?? body.device_id);
    const summary = await this.store.transition(actor.schema, tenantUuid(callValue, 'callId'), target, {
      actorId: actor.id,
      deviceId,
      reason: target === 'rejected' ? 'callee_rejected' : undefined,
    });
    await this.presence.desktopHeartbeat(actor.schema, actor.id, deviceId, target === 'accepted' ? 'in_call' : 'online');
    await this.store.publishState(actor.schema, summary, `calls.${target}`);
    return summary;
  }

  accept(callId: string, body: Record<string, unknown>) { return this.respond(callId, body, 'accepted'); }
  reject(callId: string, body: Record<string, unknown>) { return this.respond(callId, body, 'rejected'); }

  async cancel(callValue: string, body: Record<string, unknown>) {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.authorize(actor);
    const deviceId = await this.requireDesktop(actor, body.deviceId ?? body.device_id);
    const summary = await this.store.transition(actor.schema, tenantUuid(callValue, 'callId'), 'cancelled', {
      actorId: actor.id,
      reason: 'caller_cancelled',
    });
    await this.presence.desktopHeartbeat(actor.schema, actor.id, deviceId, 'online');
    await this.store.publishState(actor.schema, summary, 'calls.cancelled');
    return summary;
  }

  async end(callValue: string, body: Record<string, unknown>) {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.authorize(actor);
    const deviceId = await this.requireDesktop(actor, body.deviceId ?? body.device_id);
    const callId = tenantUuid(callValue, 'callId');
    const before = await this.store.getParticipantCall(actor.schema, callId, actor.id);
    const target = ['created', 'ringing'].includes(before.status) && before.caller_user_id === actor.id ? 'cancelled' : 'ended';
    const summary = await this.store.transition(actor.schema, callId, target, {
      actorId: actor.id,
      reason: String(body.reason || 'participant_ended').slice(0, 120),
    });
    let providerCleanup = 'not-required';
    if (!['created', 'ringing'].includes(before.status)) {
      try {
        await this.livekit.deleteRoom(before.room_key);
        providerCleanup = 'completed';
      } catch {
        providerCleanup = 'pending-webhook';
      }
    }
    await this.presence.desktopHeartbeat(actor.schema, actor.id, deviceId, 'online');
    await this.store.publishState(actor.schema, summary, `calls.${target}`);
    return { ...summary, providerCleanup };
  }

  async fail(callValue: string, body: Record<string, unknown>) {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.authorize(actor);
    const deviceId = await this.requireDesktop(actor, body.deviceId ?? body.device_id);
    const callId = tenantUuid(callValue, 'callId');
    await this.store.getParticipantCall(actor.schema, callId, actor.id);
    const summary = await this.store.transition(actor.schema, callId, 'failed', {
      actorId: actor.id,
      reason: String(body.reason || 'participant_media_failed').slice(0, 120),
    });
    await this.presence.desktopHeartbeat(actor.schema, actor.id, deviceId, 'online');
    await this.store.publishState(actor.schema, summary, 'calls.failed');
    return summary;
  }

  async token(callValue: string, body: Record<string, unknown>) {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.authorize(actor);
    await this.requireDesktop(actor, body.deviceId ?? body.device_id);
    const callId = tenantUuid(callValue, 'callId');
    const participant = await this.store.tokenParticipant(actor.schema, callId, actor.id);
    const access = await this.livekit.issueToken({
      identity: participant.identity,
      name: participant.name,
      callId,
      roomKey: participant.row.room_key,
      kind: 'internal',
      callType: participant.row.call_type,
    });
    const summary = await this.store.detail(actor.schema, callId, actor.id);
    await this.store.publishState(actor.schema, summary, 'calls.connecting');
    return { ...access, call: summary };
  }

  async createGuestMeeting(body: Record<string, unknown>, idempotencyValue: unknown) {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.authorize(actor, true);
    const deviceId = await this.requireDesktop(actor, body.deviceId ?? body.device_id);
    const callType = parseCallType(body.type ?? body.callType ?? body.call_type);
    const config = tenantCallsConfig();
    const summary = await this.store.create(actor.schema, {
      actorId: actor.id,
      callType,
      context: await this.context(body.context),
      callerName: await this.actorName(actor),
      idempotencyKey: parseCallIdempotencyKey(idempotencyValue),
      ringingTimeoutSeconds: config.ringingTimeoutSeconds,
      connectTimeoutSeconds: config.connectTimeoutSeconds,
      maximumSeconds: config.callMaximumSeconds,
      guestMode: true,
    });
    if (summary.status === 'busy') {
      await this.store.publishState(actor.schema, summary, 'calls.busy');
      return { call: summary, invite: null };
    }
    try {
      const invite = await this.store.createGuestInvite(actor.schema, summary.callId, actor.id, config.guestInviteTtlSeconds);
      await this.presence.desktopHeartbeat(actor.schema, actor.id, deviceId, 'in_call');
      return {
        call: summary,
        invite: {
          id: invite.id,
          expiresAt: invite.expiresAt,
          url: `${config.publicMeetingUrl}#invite=${encodeURIComponent(invite.token)}`,
        },
      };
    } catch (error) {
      await this.store.transition(actor.schema, summary.callId, 'failed', {
        actorId: actor.id,
        reason: 'guest_invite_creation_failed',
      });
      throw error;
    }
  }

  async revokeGuestInvite(inviteValue: string, body: Record<string, unknown>) {
    this.rejectOverrides(body);
    const actor = this.actor();
    await this.authorize(actor, true);
    await this.requireDesktop(actor, body.deviceId ?? body.device_id);
    return this.store.revokeGuestInvite(actor.schema, tenantUuid(inviteValue, 'inviteId'), actor.id);
  }
}
