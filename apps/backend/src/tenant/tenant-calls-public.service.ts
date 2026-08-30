import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'crypto';
import { TenantCallsFeatureService } from './tenant-calls-feature.service';
import { TenantCallsLivekitProviderService } from './tenant-calls-livekit-provider.service';
import { sanitizeGuestDisplayName } from './tenant-calls-domain';
import { TenantCallsStoreService } from './tenant-calls-store.service';

function guestToken(value: unknown) {
  const token = String(value || '').trim();
  if (!/^[A-Za-z0-9_-]{40,96}$/.test(token)) throw new NotFoundException('Invito non valido, scaduto o revocato');
  return token;
}

function webhookDate(value: unknown) {
  if (typeof value === 'bigint') return new Date(Number(value) * 1000);
  const numeric = Number(value);
  if (Number.isFinite(numeric) && numeric > 0) return new Date(numeric < 10_000_000_000 ? numeric * 1000 : numeric);
  return new Date();
}

@Injectable()
export class TenantCallsPublicService {
  constructor(
    private readonly features: TenantCallsFeatureService,
    private readonly store: TenantCallsStoreService,
    private readonly livekit: TenantCallsLivekitProviderService,
  ) {}

  async preview(body: Record<string, unknown>) {
    const resolved = await this.store.resolveGuestToken(guestToken(body.inviteToken ?? body.invite_token));
    await this.features.requireGuest(resolved.schema);
    return this.store.guestPreview(resolved.schema, resolved.inviteId, resolved.digest);
  }

  async join(body: Record<string, unknown>) {
    const token = guestToken(body.inviteToken ?? body.invite_token);
    const displayName = sanitizeGuestDisplayName(body.displayName ?? body.display_name);
    const resolved = await this.store.resolveGuestToken(token);
    await this.features.requireGuest(resolved.schema);
    const guest = await this.store.consumeGuest(resolved.schema, resolved.inviteId, resolved.digest, displayName);
    if (guest.row.status === 'accepted') {
      await this.store.transition(resolved.schema, guest.row.id, 'connecting', {
        reason: 'guest_token_issued',
        eventKey: `guest-connect:${resolved.inviteId}`,
      });
    }
    const access = await this.livekit.issueToken({
      identity: guest.identity,
      name: displayName,
      callId: guest.row.id,
      roomKey: guest.row.room_key,
      kind: 'guest',
      callType: guest.row.call_type,
    });
    const call = await this.store.getCall(resolved.schema, guest.row.id);
    await this.store.publishState(resolved.schema, {
      callId: call.id,
      callerUserId: call.caller_user_id,
      calleeUserId: null,
      status: call.status,
      guestMode: true,
      guestDisplayName: displayName,
    }, 'calls.guest-connecting');
    return {
      ...access,
      inviteId: resolved.inviteId,
      guestSession: guest.guestSession,
      call: { id: call.id, type: call.call_type, status: call.status },
    };
  }

  async renew(body: Record<string, unknown>) {
    const inviteId = String((body.inviteId ?? body.invite_id) || '').trim();
    const session = String((body.guestSession ?? body.guest_session) || '').trim();
    if (!/^[0-9a-f-]{36}$/i.test(inviteId) || !/^[A-Za-z0-9_-]{40,96}$/.test(session)) {
      throw new NotFoundException('Sessione guest non valida');
    }
    const guest = await this.store.renewGuest(inviteId, session);
    await this.features.requireGuest(guest.schema);
    const access = await this.livekit.issueToken({
      identity: guest.identity,
      name: guest.name,
      callId: guest.row.id,
      roomKey: guest.row.room_key,
      kind: 'guest',
      callType: guest.row.call_type,
    });
    return { ...access, inviteId, call: { id: guest.row.id, type: guest.row.call_type, status: guest.row.status } };
  }

  async webhook(rawBody: Buffer | string | undefined, authorization: string | undefined) {
    const event = await this.livekit.verifyWebhook(rawBody, authorization);
    const roomKey = String(event.room?.name || '').trim();
    if (!roomKey) return { received: true, ignored: 'room-missing' };
    const authority = await this.store.resolveRoom(roomKey);
    if (!authority) return { received: true, ignored: 'room-unknown' };
    const suppliedEventId = String(event.id || '').trim();
    const eventId = suppliedEventId || createHash('sha256').update(String(rawBody || '')).digest('hex');
    const eventType = String(event.event || '');
    const participantIdentity = event.participant?.identity ? String(event.participant.identity) : undefined;
    const occurredAt = webhookDate(event.createdAt);
    const inserted = await this.store.markWebhookEvent(
      authority.schema,
      authority.callId,
      eventId,
      eventType,
      participantIdentity,
      occurredAt,
    );

    const current = await this.store.getCall(authority.schema, authority.callId);
    let target: 'connecting' | 'active' | 'failed' | 'ended' | null = null;
    if (eventType === 'room_started' && current.status === 'accepted') target = 'connecting';
    if (
      eventType === 'participant_joined'
      && ['accepted', 'connecting'].includes(current.status)
      && await this.store.joinedParticipantCount(authority.schema, authority.callId) >= 2
    ) target = 'active';
    if (eventType === 'participant_connection_aborted' && !['ended', 'failed'].includes(current.status)) target = 'failed';
    if (eventType === 'participant_left' && ['accepted', 'connecting', 'active'].includes(current.status)) target = 'ended';
    if (eventType === 'room_finished' && ['accepted', 'connecting', 'active'].includes(current.status)) {
      target = current.status === 'active' ? 'ended' : 'failed';
    }
    if (!target) {
      if (eventType === 'participant_joined' && participantIdentity?.startsWith('g:') && current.status === 'active') {
        const summary = await this.store.systemDetail(authority.schema, authority.callId);
        await this.store.publishState(authority.schema, summary, 'calls.guest-joined');
        return { received: true, duplicate: !inserted, stateChanged: false, signaled: 'guest-joined' };
      }
      if (eventType === 'participant_joined' && participantIdentity?.startsWith('g:')) {
        const summary = await this.store.systemDetail(authority.schema, authority.callId);
        await this.store.publishState(authority.schema, summary, 'calls.guest-joined');
        return { received: true, duplicate: !inserted, stateChanged: false, signaled: 'guest-joined' };
      }
      return { received: true, duplicate: !inserted, stateChanged: false };
    }
    try {
      const summary = await this.store.transition(authority.schema, authority.callId, target, {
        reason: `livekit_${eventType}`,
        eventKey: `livekit-state:${eventId}`,
        occurredAt,
      });
      await this.store.publishState(
        authority.schema,
        summary,
        participantIdentity?.startsWith('g:') && eventType === 'participant_joined'
          ? 'calls.guest-joined'
          : `calls.${target}`,
      );
      return { received: true, duplicate: !inserted, stateChanged: true, state: target };
    } catch (error) {
      if (error instanceof ConflictException) return { received: true, stateChanged: false, final: true };
      throw error;
    }
  }
}
