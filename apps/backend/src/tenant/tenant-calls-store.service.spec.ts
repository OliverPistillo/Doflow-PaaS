import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import {
  requireReturnedRow,
  returnedRows,
  TenantCallsStoreService,
  type TenantCallRow,
} from './tenant-calls-store.service';

jest.mock('./tenant-calls-schema', () => ({
  ensureTenantCallTables: jest.fn().mockResolvedValue(undefined),
  ensureTenantCallActivityProjection: jest.fn().mockResolvedValue(true),
}));
jest.mock('./tenant-timeline-schema', () => ({ ensureDoflowTimelineSchema: jest.fn().mockResolvedValue(undefined) }));

const CALL_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const CALLER = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const CALLEE = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
const INVITE_ID = 'dddddddd-dddd-4ddd-8ddd-dddddddddddd';
const ACTIVITY_ID = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee';

function row(
  status: TenantCallRow['status'] = 'ringing',
  acceptedDevice?: string,
  callType: TenantCallRow['call_type'] = 'audio',
): TenantCallRow {
  return {
    id: CALL_ID,
    room_key: 'df-opaque-room',
    call_type: callType,
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

describe('PostgreSQL DML RETURNING normalization', () => {
  const returned = { id: CALL_ID };

  it('accepts direct rows and returns the required row', () => {
    expect(returnedRows([returned], 'direct rows')).toEqual([returned]);
    expect(requireReturnedRow([returned], 'direct row')).toBe(returned);
  });

  it('unwraps the TypeORM PostgreSQL DML tuple', () => {
    expect(returnedRows([[returned], 1], 'tuple rows')).toEqual([returned]);
    expect(requireReturnedRow([[returned], 1], 'tuple row')).toBe(returned);
  });

  it('preserves optional zero-row results', () => {
    expect(returnedRows([[], 0], 'optional rows')).toEqual([]);
  });

  it.each([
    [[[], 0], 'tuple empty'],
    [[], 'direct empty'],
  ])('rejects a required result with no rows: %s', (result, operation) => {
    expect(() => requireReturnedRow(result, operation)).toThrow(`${operation}: nessuna riga restituita`);
  });

  it.each([null, {}, 'invalid'])('rejects a malformed DML result: %p', (result) => {
    expect(() => returnedRows(result, 'malformed')).toThrow('malformed: risultato DML non valido');
  });
});

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
        if (sql.includes("SET status='ringing'")) return [[ringing], 1];
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
    const audits = manager.query.mock.calls.filter(([sql]) => String(sql).includes('tenant_call_audit'));
    expect(audits.map(([, params]) => (params as unknown[])[2])).toEqual(['call_created', 'call_ringing']);
    expect(audits.every(([, params]) => (params as unknown[])[0] === CALL_ID)).toBe(true);
  });

  it('creates a video call through the same PostgreSQL tuple path', async () => {
    const created = { ...row('created', undefined, 'video'), ringing_at: null, optimistic_version: 1 };
    const ringing = row('ringing', undefined, 'video');
    const manager = {
      query: jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('WHERE created_by=') && sql.includes('idempotency_key')) return [];
        if (sql.includes('SELECT l.user_id')) return [];
        if (sql.includes('INSERT INTO') && sql.includes('tenant_call_sessions')) return [created];
        if (sql.includes("SET status='ringing'")) return [[ringing], 1];
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
      callType: 'video',
      context: null,
      callerName: 'Caller',
      calleeName: 'Callee',
      idempotencyKey: 'call:video',
      ringingTimeoutSeconds: 45,
      connectTimeoutSeconds: 90,
      maximumSeconds: 3600,
    })).resolves.toMatchObject({ status: 'ringing', type: 'video', callId: CALL_ID });
    const ringingUpdate = manager.query.mock.calls.find(([sql]) => String(sql).includes("SET status='ringing'"));
    expect(ringingUpdate).toBeDefined();
  });

  it('allows exactly one accepting Desktop device and makes the winner idempotent', async () => {
    let current = row();
    const manager = {
      query: jest.fn(async (sql: string, params: unknown[]) => {
        if (sql.includes('SELECT *') && sql.includes('FOR UPDATE')) return [current];
        if (sql.includes('UPDATE') && sql.includes('tenant_call_sessions SET')) {
          current = row('accepted', String(params[3]));
          return [[current], 1];
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

  it('persists busy with valid audit and no participant locks or room index', async () => {
    const busy = row('busy');
    const manager = {
      query: jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('WHERE created_by=') && sql.includes('idempotency_key')) return [];
        if (sql.includes('SELECT l.user_id')) return [{ user_id: CALLEE, call_id: CALL_ID }];
        if (sql.includes('INSERT INTO') && sql.includes('tenant_call_sessions')) return [busy];
        if (sql.includes('tenant_call_activities(call_id')) return [[{ call_id: CALL_ID }], 1];
        if (sql.includes('commercial_activities')) return [[{ id: ACTIVITY_ID }], 1];
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
      idempotencyKey: 'call:busy',
      ringingTimeoutSeconds: 45,
      connectTimeoutSeconds: 90,
      maximumSeconds: 3600,
    })).resolves.toMatchObject({ status: 'busy', callId: CALL_ID });
    const writes = manager.query.mock.calls.map(([sql]) => String(sql));
    expect(writes.filter((sql) => sql.includes('tenant_call_user_locks(user_id'))).toHaveLength(0);
    expect(writes.filter((sql) => sql.includes('desktop_call_room_index(room_key'))).toHaveLength(0);
    const audits = manager.query.mock.calls.filter(([sql]) => String(sql).includes('tenant_call_audit'));
    expect(audits.map(([, params]) => (params as unknown[])[2])).toEqual(['call_created', 'call_busy']);
  });

  it('normalizes every lifecycle UPDATE and performs terminal cleanup once', async () => {
    let current = row('ringing');
    const manager = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        if (sql.includes('SELECT *') && sql.includes('FOR UPDATE')) return [current];
        if (sql.includes('UPDATE "tenant_a".tenant_call_sessions SET')) {
          const target = String(params?.[1]) as TenantCallRow['status'];
          const occurredAt = params?.[2] as Date;
          current = {
            ...current,
            status: target,
            accepted_device_id: target === 'accepted' ? String(params?.[3]) : current.accepted_device_id,
            started_at: target === 'active' ? occurredAt : current.started_at,
            ended_at: target === 'ended' ? occurredAt : current.ended_at,
            optimistic_version: current.optimistic_version + 1,
          };
          return [[current], 1];
        }
        if (sql.includes('tenant_call_activities(call_id')) return [[{ call_id: CALL_ID }], 1];
        if (sql.includes('INSERT INTO "tenant_a".commercial_activities')) return [[{ id: ACTIVITY_ID }], 1];
        return [];
      }),
    };
    const dataSource = {
      query: jest.fn(),
      transaction: jest.fn(async (operation: (value: typeof manager) => unknown) => operation(manager)),
    };
    const service = new TenantCallsStoreService(dataSource as never, { notifyUser: jest.fn() } as never);

    await expect(service.transition('tenant_a', CALL_ID, 'accepted', {
      actorId: CALLEE,
      deviceId: 'desktop-device-a',
    })).resolves.toMatchObject({ status: 'accepted' });
    await expect(service.transition('tenant_a', CALL_ID, 'connecting', { actorId: CALLER }))
      .resolves.toMatchObject({ status: 'connecting' });
    await expect(service.transition('tenant_a', CALL_ID, 'active', { actorId: CALLER }))
      .resolves.toMatchObject({ status: 'active' });
    await expect(service.transition('tenant_a', CALL_ID, 'ended', { actorId: CALLER }))
      .resolves.toMatchObject({ status: 'ended' });

    const audits = manager.query.mock.calls.filter(([sql]) => String(sql).includes('tenant_call_audit'));
    expect(audits.map(([, params]) => (params as unknown[])[2])).toEqual([
      'call_accepted',
      'call_connecting',
      'call_active',
      'call_ended',
    ]);
    expect(manager.query.mock.calls.filter(([sql]) => String(sql).includes('DELETE FROM "tenant_a".tenant_call_user_locks')))
      .toHaveLength(1);
    expect(manager.query.mock.calls.filter(([sql]) => String(sql).includes('UPDATE public.desktop_call_room_index')))
      .toHaveLength(1);
    expect(manager.query.mock.calls.filter(([sql]) => String(sql).includes('INSERT INTO "tenant_a".commercial_activities')))
      .toHaveLength(1);
  });

  it('normalizes the remaining generic terminal transitions', async () => {
    const cases: Array<{
      from: TenantCallRow['status'];
      target: TenantCallRow['status'];
      actorId?: string;
    }> = [
      { from: 'ringing', target: 'rejected', actorId: CALLEE },
      { from: 'ringing', target: 'cancelled', actorId: CALLER },
      { from: 'ringing', target: 'missed' },
      { from: 'ringing', target: 'busy' },
      { from: 'accepted', target: 'failed', actorId: CALLER },
    ];

    for (const item of cases) {
      const current = row(item.from);
      const updated = { ...current, status: item.target, ended_at: new Date() };
      const manager = {
        query: jest.fn(async (sql: string) => {
          if (sql.includes('SELECT *') && sql.includes('FOR UPDATE')) return [current];
          if (sql.includes('UPDATE "tenant_a".tenant_call_sessions SET')) return [[updated], 1];
          if (sql.includes('tenant_call_activities(call_id')) return [[], 0];
          return [];
        }),
      };
      const dataSource = {
        query: jest.fn(),
        transaction: jest.fn(async (operation: (value: typeof manager) => unknown) => operation(manager)),
      };
      const service = new TenantCallsStoreService(dataSource as never, { notifyUser: jest.fn() } as never);
      await expect(service.transition('tenant_a', CALL_ID, item.target, { actorId: item.actorId }))
        .resolves.toMatchObject({ status: item.target, callId: CALL_ID });
    }
  });

  it('normalizes accepted to connecting before issuing participant details', async () => {
    const selected = { ...row('accepted'), participant_name: 'Participant' };
    const connecting = row('connecting');
    const manager = {
      query: jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('SELECT c.*')) return [selected];
        if (sql.includes("SET status='connecting'")) return [[connecting], 1];
        return [];
      }),
    };
    const dataSource = {
      query: jest.fn(),
      transaction: jest.fn(async (operation: (value: typeof manager) => unknown) => operation(manager)),
    };
    const service = new TenantCallsStoreService(dataSource as never, { notifyUser: jest.fn() } as never);
    await expect(service.tokenParticipant('tenant_a', CALL_ID, CALLER)).resolves.toMatchObject({
      row: { id: CALL_ID, status: 'connecting' },
      name: 'Participant',
    });
    const audit = manager.query.mock.calls.find(([sql]) => String(sql).includes('tenant_call_audit'));
    expect((audit?.[1] as unknown[])[0]).toBe(CALL_ID);
  });

  it('normalizes guest invite creation and revocation results', async () => {
    const invite = { id: INVITE_ID, call_id: CALL_ID, expires_at: new Date() };
    const createManager = {
      query: jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('SELECT *') && sql.includes('guest_mode=true')) return [row('accepted')];
        if (sql.includes('INSERT INTO "tenant_a".tenant_call_guest_invites')) return [[invite], 1];
        return [];
      }),
    };
    const createSource = {
      query: jest.fn(),
      transaction: jest.fn(async (operation: (value: typeof createManager) => unknown) => operation(createManager)),
    };
    const createService = new TenantCallsStoreService(createSource as never, { notifyUser: jest.fn() } as never);
    await expect(createService.createGuestInvite('tenant_a', CALL_ID, CALLER, 300))
      .resolves.toMatchObject({ id: INVITE_ID });

    const revokeManager = {
      query: jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('RETURNING i.id')) return [[{ ...invite, revoked_at: new Date() }], 1];
        return [];
      }),
    };
    const revokeSource = {
      query: jest.fn(),
      transaction: jest.fn(async (operation: (value: typeof revokeManager) => unknown) => operation(revokeManager)),
    };
    const revokeService = new TenantCallsStoreService(revokeSource as never, { notifyUser: jest.fn() } as never);
    await expect(revokeService.revokeGuestInvite('tenant_a', INVITE_ID, CALLER))
      .resolves.toEqual({ inviteId: INVITE_ID, revoked: true });
    const audit = revokeManager.query.mock.calls.find(([sql]) => String(sql).includes('tenant_call_audit'));
    expect((audit?.[1] as unknown[])[0]).toBe(CALL_ID);
  });

  it('maps a zero-row guest revoke to the existing authorization error', async () => {
    const manager = { query: jest.fn().mockResolvedValueOnce([[], 0]) };
    const dataSource = {
      query: jest.fn(),
      transaction: jest.fn(async (operation: (value: typeof manager) => unknown) => operation(manager)),
    };
    const service = new TenantCallsStoreService(dataSource as never, { notifyUser: jest.fn() } as never);
    await expect(service.revokeGuestInvite('tenant_a', INVITE_ID, CALLER)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('claims and projects a terminal activity once across tuple and zero-row results', async () => {
    const firstManager = {
      query: jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('tenant_call_activities(call_id')) return [[{ call_id: CALL_ID }], 1];
        if (sql.includes('INSERT INTO "tenant_a".commercial_activities')) return [[{ id: ACTIVITY_ID }], 1];
        return [];
      }),
    };
    const secondManager = {
      query: jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('tenant_call_activities(call_id')) return [[], 0];
        return [];
      }),
    };
    const service = new TenantCallsStoreService({} as never, { notifyUser: jest.fn() } as never);
    const projection = service as unknown as {
      recordActivity(target: typeof firstManager, schema: string, call: ReturnType<typeof row>): Promise<void>;
    };
    await projection.recordActivity(firstManager, 'tenant_a', row('ended'));
    await projection.recordActivity(secondManager as typeof firstManager, 'tenant_a', row('ended'));
    const activityLink = firstManager.query.mock.calls.find(([sql]) => String(sql).includes('SET activity_id=$2'));
    expect(activityLink?.[1]).toEqual([CALL_ID, ACTIVITY_ID]);
    expect(secondManager.query.mock.calls.some(([sql]) => String(sql).includes('commercial_activities'))).toBe(false);
  });

  it('stops before call_ringing audit when a required DML result is empty', async () => {
    const created = { ...row('created'), ringing_at: null, optimistic_version: 1 };
    const manager = {
      query: jest.fn(async (sql: string, _params?: unknown[]) => {
        if (sql.includes('WHERE created_by=') && sql.includes('idempotency_key')) return [];
        if (sql.includes('SELECT l.user_id')) return [];
        if (sql.includes('INSERT INTO') && sql.includes('tenant_call_sessions')) return [created];
        if (sql.includes("SET status='ringing'")) return [[], 0];
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
      idempotencyKey: 'call:empty-ringing',
      ringingTimeoutSeconds: 45,
      connectTimeoutSeconds: 90,
      maximumSeconds: 3600,
    })).rejects.toThrow('transition call to ringing: nessuna riga restituita');
    const audits = manager.query.mock.calls.filter(([sql]) => String(sql).includes('tenant_call_audit'));
    expect(audits.map(([, params]) => (params as unknown[])[2])).toEqual(['call_created']);
    expect(audits.every(([, params]) => (params as unknown[])[0] !== undefined)).toBe(true);
  });

  it('deduplicates webhook events and rejects unknown, expired or revoked invite tokens', async () => {
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([[], 0])
        .mockResolvedValueOnce([]),
      transaction: jest.fn(),
    };
    const service = new TenantCallsStoreService(dataSource as never, { notifyUser: jest.fn() } as never);
    await expect(service.markWebhookEvent('tenant_a', CALL_ID, 'event-1', 'participant_joined', 'g:guest', new Date()))
      .resolves.toBe(false);
    await expect(service.resolveGuestToken('not-present-token')).rejects.toBeInstanceOf(NotFoundException);
    expect(dataSource.query.mock.calls.every(([_sql, params]) => !JSON.stringify(params).includes('tenant_b'))).toBe(true);

    const insertedSource = {
      query: jest.fn().mockResolvedValueOnce([[{ event_id: 'event-2' }], 1]),
      transaction: jest.fn(),
    };
    const inserted = new TenantCallsStoreService(insertedSource as never, { notifyUser: jest.fn() } as never);
    await expect(inserted.markWebhookEvent('tenant_a', CALL_ID, 'event-2', 'participant_joined', undefined, new Date()))
      .resolves.toBe(true);
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
