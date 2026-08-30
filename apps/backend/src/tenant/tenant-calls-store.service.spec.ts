import { ConflictException, NotFoundException } from '@nestjs/common';
import { TenantCallsStoreService } from './tenant-calls-store.service';

jest.mock('./tenant-calls-schema', () => ({
  ensureTenantCallTables: jest.fn().mockResolvedValue(undefined),
  ensureTenantCallActivityProjection: jest.fn().mockResolvedValue(true),
}));
jest.mock('./tenant-timeline-schema', () => ({ ensureDoflowTimelineSchema: jest.fn().mockResolvedValue(undefined) }));

const CALL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CALLER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CALLEE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function row(status = 'ringing', acceptedDevice?: string) {
  return {
    id: CALL_ID,
    room_key: 'df-opaque-room',
    call_type: 'audio',
    status,
    created_by: CALLER,
    caller_user_id: CALLER,
    callee_user_id: CALLEE,
    created_at: new Date(),
    ringing_at: new Date(),
    expires_at: new Date(Date.now() + 60_000),
    metadata: { callerName: 'Caller', calleeName: 'Callee', maximumSeconds: 3600 },
    accepted_device_id: acceptedDevice || null,
    optimistic_version: status === 'accepted' ? 3 : 2,
    guest_mode: false,
  };
}

describe('TenantCallsStoreService concurrency and idempotence', () => {
  it('locks both participants against concurrent calls without a per-call uniqueness conflict', async () => {
    const created = { ...row('created'), ringing_at: null, optimistic_version: 1 };
    const ringing = row('ringing');
    const manager = {
      query: jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('SELECT pg_advisory_xact_lock')) return [];
        if (sql.includes('DELETE FROM') && sql.includes('tenant_call_user_locks')) return [];
        if (sql.includes('WHERE created_by=') && sql.includes('idempotency_key')) return [];
        if (sql.includes('SELECT l.user_id')) return [];
        if (sql.includes('INSERT INTO') && sql.includes('tenant_call_sessions')) return [created];
        if (sql.includes("SET status='ringing'")) return [ringing];
        return [];
      }),
    };
    const dataSource = {
      query: jest.fn(),
      transaction: jest.fn(async (operation: (value: typeof manager) => unknown) => operation(manager)),
    };
    const service = new TenantCallsStoreService(dataSource as never, { notifyUser: jest.fn() } as never);
    await expect(service.create('tenant_a', {
      actorId: CALLER,
      calleeUserId: CALLEE,
      callType: 'audio',
      context: null,
      callerName: 'Caller',
      calleeName: 'Callee',
      idempotencyKey: 'call:test',
      ringingTimeoutSeconds: 45,
      connectTimeoutSeconds: 90,
      maximumSeconds: 3600,
    })).resolves.toMatchObject({ status: 'ringing' });
    const lockWrites = manager.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO') && String(sql).includes('tenant_call_user_locks'));
    expect(lockWrites).toHaveLength(2);
    expect(lockWrites.map(([, params]) => (params as unknown[])[0])).toEqual([CALLER, CALLEE]);
  });

  it('allows exactly one accepting Desktop device and makes the winner idempotent', async () => {
    let current = row();
    const manager = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('SELECT *') && sql.includes('FOR UPDATE')) return [current];
        if (sql.includes('UPDATE') && sql.includes('tenant_call_sessions SET')) {
          current = row('accepted', String(params[3]));
          return [current];
        }
        return [];
      }),
    };
    const dataSource = {
      query: jest.fn(),
      transaction: jest.fn(async (operation: (value: typeof manager) => unknown) => operation(manager)),
    };
    const service = new TenantCallsStoreService(dataSource as never, { notifyUser: jest.fn() } as never);
    await expect(service.transition('tenant_a', CALL_ID, 'accepted', { actorId: CALLEE, deviceId: 'desktop-device-a' }))
      .resolves.toMatchObject({ status: 'accepted' });
    await expect(service.transition('tenant_a', CALL_ID, 'accepted', { actorId: CALLEE, deviceId: 'desktop-device-a' }))
      .resolves.toMatchObject({ status: 'accepted' });
    await expect(service.transition('tenant_a', CALL_ID, 'accepted', { actorId: CALLEE, deviceId: 'desktop-device-b' }))
      .rejects.toMatchObject({ response: expect.objectContaining({ error: 'CALL_ACCEPTED_ELSEWHERE' }) });
    expect(manager.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE') && String(sql).includes('tenant_call_sessions SET'))).toHaveLength(1);
  });

  it('rejects illegal transitions before writing state', async () => {
    const manager = { query: jest.fn().mockResolvedValueOnce([row('ringing')]) };
    const dataSource = { query: jest.fn(), transaction: jest.fn(async (operation: (value: typeof manager) => unknown) => operation(manager)) };
    const service = new TenantCallsStoreService(dataSource as never, { notifyUser: jest.fn() } as never);
    await expect(service.transition('tenant_a', CALL_ID, 'active', { actorId: CALLER }))
      .rejects.toBeInstanceOf(ConflictException);
    expect(manager.query).toHaveBeenCalledTimes(1);
  });

  it('deduplicates webhook events and rejects unknown, expired or revoked invite tokens', async () => {
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]),
      transaction: jest.fn(),
    };
    const service = new TenantCallsStoreService(dataSource as never, { notifyUser: jest.fn() } as never);
    await expect(service.markWebhookEvent('tenant_a', CALL_ID, 'event-1', 'participant_joined', 'g:guest', new Date()))
      .resolves.toBe(false);
    await expect(service.resolveGuestToken('not-present-token')).rejects.toBeInstanceOf(NotFoundException);
    expect(dataSource.query.mock.calls.every(([_sql, params]) => !JSON.stringify(params).includes('tenant_b'))).toBe(true);
  });

  it('rejects both revoked and expired guest invite rows before exposing pre-join data', async () => {
    const future = new Date(Date.now() + 60_000);
    const revokedSource = {
      query: jest.fn().mockResolvedValueOnce([{
        ...row('accepted'),
        invite_expires_at: future,
        invite_revoked_at: new Date(),
        host_name: 'Host',
      }]),
    };
    const expiredSource = {
      query: jest.fn().mockResolvedValueOnce([{
        ...row('accepted'),
        invite_expires_at: new Date(Date.now() - 1_000),
        invite_revoked_at: null,
        host_name: 'Host',
      }]),
    };
    const revoked = new TenantCallsStoreService(revokedSource as never, { notifyUser: jest.fn() } as never);
    const expired = new TenantCallsStoreService(expiredSource as never, { notifyUser: jest.fn() } as never);
    await expect(revoked.guestPreview('tenant_a', CALL_ID, 'digest')).rejects.toBeInstanceOf(NotFoundException);
    await expect(expired.guestPreview('tenant_a', CALL_ID, 'digest')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps ringing and connecting expiry to deterministic missed and failed outcomes', async () => {
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{ name: 'tenant_a.tenant_call_sessions' }])
        .mockResolvedValueOnce([row('ringing'), row('connecting')]),
      transaction: jest.fn(),
    };
    const service = new TenantCallsStoreService(dataSource as never, { notifyUser: jest.fn() } as never);
    const transition = jest.spyOn(service, 'transition').mockImplementation(async (_schema, callId, target) => ({ callId, status: target }) as never);
    await expect(service.expireTenant('tenant_a')).resolves.toEqual([
      { callId: CALL_ID, status: 'missed' },
      { callId: CALL_ID, status: 'failed' },
    ]);
    expect(transition).toHaveBeenNthCalledWith(1, 'tenant_a', CALL_ID, 'missed', expect.objectContaining({ reason: 'ringing_timeout' }));
    expect(transition).toHaveBeenNthCalledWith(2, 'tenant_a', CALL_ID, 'failed', expect.objectContaining({ reason: 'connection_timeout' }));
  });

  it('keeps the terminal call authoritative when an optional CRM projection rejects', async () => {
    const manager = {
      query: jest.fn(async (sql: string, _parameters?: unknown[]) => {
        if (sql.includes('INSERT INTO "tenant_a".commercial_activities')) throw new Error('legacy constraint');
        if (sql.includes('INSERT INTO "tenant_a".tenant_call_activities')) return [{ call_id: CALL_ID }];
        return [];
      }),
    };
    const service = new TenantCallsStoreService({} as never, { notifyUser: jest.fn() } as never);
    const projection = service as unknown as {
      recordActivity(target: typeof manager, schema: string, call: ReturnType<typeof row>): Promise<void>;
    };
    await expect(projection.recordActivity(manager, 'tenant_a', row('ended'))).resolves.toBeUndefined();
    expect(manager.query).toHaveBeenCalledWith('ROLLBACK TO SAVEPOINT doflow_call_activity_projection');
    expect(manager.query.mock.calls.some(([sql, parameters]) => (
      String(sql).includes('tenant_call_audit')
      && Array.isArray(parameters)
      && parameters[2] === 'call_activity_projection_failed'
    ))).toBe(true);
  });
});
