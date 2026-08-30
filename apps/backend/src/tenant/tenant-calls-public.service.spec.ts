import { ConflictException, NotFoundException } from '@nestjs/common';
import { TenantCallsPublicService } from './tenant-calls-public.service';

const CALL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const INVITE_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const INVITE_TOKEN = 'a'.repeat(43);

function dependencies() {
  const row = {
    id: CALL_ID,
    room_key: 'df-opaque-room-key',
    call_type: 'video',
    status: 'accepted',
    caller_user_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
  };
  return {
    features: { requireGuest: jest.fn().mockResolvedValue({ enabled: true, guestEnabled: true }) },
    store: {
      resolveGuestToken: jest.fn().mockResolvedValue({ schema: 'tenant_a', inviteId: INVITE_ID, digest: 'digest-only' }),
      guestPreview: jest.fn().mockResolvedValue({ inviteId: INVITE_ID, callId: CALL_ID }),
      consumeGuest: jest.fn().mockResolvedValue({ row, identity: 'g:opaque', guestSession: 's'.repeat(43) }),
      transition: jest.fn().mockResolvedValue({ callId: CALL_ID, status: 'connecting' }),
      getCall: jest.fn().mockResolvedValue({ ...row, status: 'connecting' }),
      systemDetail: jest.fn().mockResolvedValue({ callId: CALL_ID, status: 'active', callerUserId: row.caller_user_id }),
      publishState: jest.fn(),
      renewGuest: jest.fn().mockResolvedValue({ schema: 'tenant_a', row: { ...row, status: 'active' }, identity: 'g:opaque', name: 'Ospite' }),
      resolveRoom: jest.fn().mockResolvedValue({ schema: 'tenant_a', callId: CALL_ID }),
      markWebhookEvent: jest.fn().mockResolvedValue(true),
      joinedParticipantCount: jest.fn().mockResolvedValue(2),
    },
    livekit: {
      issueToken: jest.fn().mockResolvedValue({ token: 'jwt-value', serverUrl: 'wss://calls.example.test', expiresInSeconds: 300 }),
      verifyWebhook: jest.fn(),
    },
  };
}

describe('TenantCallsPublicService guest and webhook authority', () => {
  it('returns only pre-join metadata and rejects expired or revoked invite resolution', async () => {
    const values = dependencies();
    const service = new TenantCallsPublicService(values.features as never, values.store as never, values.livekit as never);
    await expect(service.preview({ inviteToken: INVITE_TOKEN })).resolves.toEqual({ inviteId: INVITE_ID, callId: CALL_ID });
    expect(values.store.resolveGuestToken).toHaveBeenCalledWith(INVITE_TOKEN);
    expect(values.store.guestPreview).toHaveBeenCalledWith('tenant_a', INVITE_ID, 'digest-only');

    values.store.resolveGuestToken.mockRejectedValueOnce(new NotFoundException('expired'));
    await expect(service.preview({ inviteToken: INVITE_TOKEN })).rejects.toBeInstanceOf(NotFoundException);
  });

  it('consumes an invite once and scopes the guest token to the server-selected room', async () => {
    const values = dependencies();
    const service = new TenantCallsPublicService(values.features as never, values.store as never, values.livekit as never);
    await expect(service.join({ inviteToken: INVITE_TOKEN, displayName: '  Mario  Rossi  ' })).resolves.toMatchObject({
      inviteId: INVITE_ID,
      guestSession: 's'.repeat(43),
      call: { id: CALL_ID, type: 'video', status: 'connecting' },
    });
    expect(values.store.consumeGuest).toHaveBeenCalledWith('tenant_a', INVITE_ID, 'digest-only', 'Mario Rossi');
    expect(values.livekit.issueToken).toHaveBeenCalledWith(expect.objectContaining({
      callId: CALL_ID,
      roomKey: 'df-opaque-room-key',
      identity: 'g:opaque',
      kind: 'guest',
    }));
    expect(JSON.stringify(values.livekit.issueToken.mock.calls)).not.toContain(INVITE_TOKEN);

    values.store.consumeGuest.mockRejectedValueOnce(new ConflictException('used'));
    await expect(service.join({ inviteToken: INVITE_TOKEN, displayName: 'Mario Rossi' }))
      .rejects.toBeInstanceOf(ConflictException);
  });

  it('ignores unknown rooms and leaves an already-applied webhook retry idempotent', async () => {
    const values = dependencies();
    values.livekit.verifyWebhook.mockResolvedValue({ id: 'evt-1', event: 'participant_joined', room: { name: 'df-opaque-room-key' }, participant: { identity: 'g:opaque' }, createdAt: 1_800_000_000 });
    const service = new TenantCallsPublicService(values.features as never, values.store as never, values.livekit as never);

    values.store.resolveRoom.mockResolvedValueOnce(null);
    await expect(service.webhook(Buffer.from('{}'), 'valid-signature')).resolves.toEqual({ received: true, ignored: 'room-unknown' });
    expect(values.store.markWebhookEvent).not.toHaveBeenCalled();

    values.store.markWebhookEvent.mockResolvedValueOnce(false);
    values.store.getCall.mockResolvedValueOnce({
      id: CALL_ID,
      room_key: 'df-opaque-room-key',
      call_type: 'video',
      status: 'active',
      caller_user_id: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
    });
    await expect(service.webhook(Buffer.from('{}'), 'valid-signature')).resolves.toMatchObject({ received: true, duplicate: true, stateChanged: false });
    expect(values.store.transition).not.toHaveBeenCalled();
  });

  it('maps an authenticated participant event into the single authoritative state machine', async () => {
    const values = dependencies();
    values.livekit.verifyWebhook.mockResolvedValue({ id: 'evt-2', event: 'participant_joined', room: { name: 'df-opaque-room-key' }, participant: { identity: 'u:opaque' }, createdAt: 1_800_000_000 });
    const service = new TenantCallsPublicService(values.features as never, values.store as never, values.livekit as never);
    await expect(service.webhook(Buffer.from('{}'), 'valid-signature')).resolves.toMatchObject({ stateChanged: true, state: 'active' });
    expect(values.store.transition).toHaveBeenCalledWith('tenant_a', CALL_ID, 'active', expect.objectContaining({ eventKey: 'livekit-state:evt-2' }));
    expect(values.store.publishState).toHaveBeenCalledTimes(1);
  });

  it('recovers a signed duplicate when the first delivery stopped after durable dedupe', async () => {
    const values = dependencies();
    values.store.markWebhookEvent.mockResolvedValueOnce(false);
    values.livekit.verifyWebhook.mockResolvedValue({ id: 'evt-retry', event: 'participant_joined', room: { name: 'df-opaque-room-key' }, participant: { identity: 'u:opaque' }, createdAt: 1_800_000_000 });
    const service = new TenantCallsPublicService(values.features as never, values.store as never, values.livekit as never);
    await expect(service.webhook(Buffer.from('{}'), 'valid-signature')).resolves.toMatchObject({
      duplicate: true,
      stateChanged: true,
      state: 'active',
    });
    expect(values.store.transition).toHaveBeenCalledTimes(1);
  });

  it('keeps the room connecting until both distinct participants have joined', async () => {
    const values = dependencies();
    values.store.joinedParticipantCount.mockResolvedValueOnce(1);
    values.livekit.verifyWebhook.mockResolvedValue({ id: 'evt-first', event: 'participant_joined', room: { name: 'df-opaque-room-key' }, participant: { identity: 'u:first' }, createdAt: 1_800_000_000 });
    const service = new TenantCallsPublicService(values.features as never, values.store as never, values.livekit as never);
    await expect(service.webhook(Buffer.from('{}'), 'valid-signature')).resolves.toMatchObject({ stateChanged: false });
    expect(values.store.transition).not.toHaveBeenCalled();
  });
});
