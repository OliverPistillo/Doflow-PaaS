import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantLivekitService } from './tenant-livekit.service';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';
const RECORD = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const DEVICE = 'desktop-aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

function request(tenant = 'tenant_a') {
  return { user: { sub: USER_A, id: USER_A, email: 'actor@example.test', role: 'owner', tenantId: tenant, tenantSlug: tenant }, headers: {} };
}

function dependencies(overrides: Record<string, unknown> = {}) {
  return {
    dataSource: { query: jest.fn() },
    capabilities: { require: jest.fn().mockResolvedValue(undefined), has: jest.fn().mockResolvedValue(true) },
    features: {
      requireInternal: jest.fn().mockResolvedValue({ enabled: true }),
      requireGuest: jest.fn().mockResolvedValue({ enabled: true, guestEnabled: true }),
      availability: jest.fn().mockResolvedValue({ enabled: true, configured: true, tenantEnabled: true, guestEnabled: true, browserInternalCalls: false, reason: 'ready' }),
    },
    presence: {
      hasDesktopSession: jest.fn().mockResolvedValue(true),
      desktopHeartbeat: jest.fn().mockResolvedValue('online'),
      disconnectDesktop: jest.fn(),
    },
    store: { create: jest.fn(), publishState: jest.fn(), tokenParticipant: jest.fn(), detail: jest.fn() },
    livekit: { issueToken: jest.fn(), deleteRoom: jest.fn() },
    crm: { findOne: jest.fn() },
    projects: { getProject: jest.fn() },
    ...overrides,
  };
}

function service(values = dependencies(), tenant = 'tenant_a') {
  return new TenantLivekitService(
    values.dataSource as never,
    request(tenant),
    values.capabilities as never,
    values.features as never,
    values.presence as never,
    values.store as never,
    values.livekit as never,
    values.crm as never,
    values.projects as never,
  );
}

describe('TenantLivekitService authority', () => {
  it('rejects tenant, actor, room and token overrides before any persistence or SDK access', async () => {
    const values = dependencies();
    const target = service(values);
    for (const body of [{ tenantId: 'tenant_b' }, { userId: USER_B }, { roomName: 'chosen-room' }, { token: 'chosen-token' }]) {
      await expect(target.create({ ...body, calleeUserId: USER_B, type: 'audio', deviceId: DEVICE }, 'key'))
        .rejects.toBeInstanceOf(BadRequestException);
    }
    expect(values.dataSource.query).not.toHaveBeenCalled();
    expect(values.store.create).not.toHaveBeenCalled();
    expect(values.livekit.issueToken).not.toHaveBeenCalled();
  });

  it('enforces feature capability before checking presence or tenant records', async () => {
    const values = dependencies({
      features: {
        requireInternal: jest.fn().mockRejectedValue(new ForbiddenException('feature disabled')),
        requireGuest: jest.fn(),
        availability: jest.fn(),
      },
    });
    await expect(service(values).create({ calleeUserId: USER_B, type: 'audio', deviceId: DEVICE }, 'key'))
      .rejects.toBeInstanceOf(ForbiddenException);
    expect(values.presence.hasDesktopSession).not.toHaveBeenCalled();
    expect(values.dataSource.query).not.toHaveBeenCalled();
  });

  it('looks up a recipient only inside the authenticated schema and denies cross-tenant IDs', async () => {
    const values = dependencies();
    values.dataSource.query.mockResolvedValue([]);
    await expect(service(values).create({ calleeUserId: USER_B, type: 'video', deviceId: DEVICE }, 'key'))
      .rejects.toBeInstanceOf(NotFoundException);
    expect(values.dataSource.query).toHaveBeenCalledWith(expect.stringContaining('"tenant_a".users'), [USER_B]);
    expect(values.dataSource.query.mock.calls.every(([sql]) => !String(sql).includes('tenant_b'))).toBe(true);
    expect(values.store.create).not.toHaveBeenCalled();
  });

  it('denies inaccessible CRM context before creating the call', async () => {
    const values = dependencies();
    values.dataSource.query.mockResolvedValue([{ id: USER_B, display_name: 'Recipient' }]);
    values.crm.findOne.mockRejectedValue(new ForbiddenException('record denied'));
    await expect(service(values).create({
      calleeUserId: USER_B,
      type: 'audio',
      deviceId: DEVICE,
      context: { kind: 'company', id: RECORD },
    }, 'key')).rejects.toBeInstanceOf(ForbiddenException);
    expect(values.crm.findOne).toHaveBeenCalledWith('companies', RECORD);
    expect(values.store.create).not.toHaveBeenCalled();
  });

  it('rejects a group conversation for the one-to-one internal call contract', async () => {
    const values = dependencies();
    values.dataSource.query
      .mockResolvedValueOnce([{ id: USER_B, display_name: 'Recipient' }])
      .mockResolvedValueOnce([{ participant_count: 3, authorized_count: 2 }]);
    await expect(service(values).create({
      calleeUserId: USER_B,
      conversationId: RECORD,
      type: 'audio',
      deviceId: DEVICE,
    }, 'key')).rejects.toBeInstanceOf(ForbiddenException);
    expect(values.store.create).not.toHaveBeenCalled();
  });

  it('never issues a room token to a non-participant', async () => {
    const values = dependencies();
    values.store.tokenParticipant.mockRejectedValue(new ForbiddenException('not a participant'));
    await expect(service(values).token(RECORD, { deviceId: DEVICE })).rejects.toBeInstanceOf(ForbiddenException);
    expect(values.livekit.issueToken).not.toHaveBeenCalled();
  });
});
