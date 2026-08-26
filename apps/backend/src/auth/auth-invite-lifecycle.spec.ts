import { BadRequestException, ConflictException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { INVITE_TOKEN_DIGEST_PREFIX, storedInviteToken } from './invite-token';

const inviteId = '11111111-1111-4111-8111-111111111111';
const userId = '22222222-2222-4222-8222-222222222222';

function request() {
  return { tenantId: 'public' } as any;
}

function fixture(options: {
  role?: string;
  directoryUser?: Record<string, unknown> | null;
  claimSucceeds?: boolean;
    lookupInvite?: boolean;
    acceptedAt?: string | null;
    pendingMember?: boolean;
    legacyRaw?: boolean;
    priorTeamMember?: boolean;
} = {}) {
  const invite = {
    id: inviteId,
    email: 'invited@example.test',
    role: options.role || 'user',
    accepted_at: options.acceptedAt ?? null,
    expires_at: '2099-01-01T00:00:00.000Z',
    legacy_raw: options.legacyRaw === true,
  };
  const managerCalls: Array<{ sql: string; params?: unknown[] }> = [];
  const manager = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      managerCalls.push({ sql, params });
      if (sql.includes('from "doflow"."invites"')) return [invite];
      if (sql.includes('from "doflow"."users"')) return [];
      if (sql.includes('from "doflow"."team_members"') && sql.includes('user_id is null')) {
        return options.pendingMember === false ? [] : [{ id: inviteId, metadata: {} }];
      }
      if (sql.includes('from "doflow"."team_members"')) {
        return options.priorTeamMember ? [{ id: inviteId }] : [];
      }
      if (sql.includes('insert into "doflow"."team_members"')) {
        return [{ id: inviteId, metadata: {} }];
      }
      if (sql.includes('from public.users')) return options.directoryUser ? [options.directoryUser] : [];
      if (sql.includes('update "doflow"."invites"')) {
        return options.claimSucceeds === false ? [] : [{ id: inviteId }];
      }
      if (sql.includes('insert into "doflow"."users"')) {
        return [{ id: userId, email: invite.email, role: invite.role, created_at: new Date() }];
      }
      return [];
    }),
  };
  const query = jest.fn(async (sql: string, params?: unknown[]) => {
    if (sql.includes('select is_active from public.tenants')) return [{ is_active: true }];
    if (sql.includes('from public.tenants')) {
      return [{ id: 'tenant-public-id', slug: 'doflow', schema_name: 'doflow' }];
    }
    if (sql.includes('from "doflow"."invites"')) return options.lookupInvite === false ? [] : [invite];
    return [];
  });
  const dataSource = {
    query,
    transaction: jest.fn(async (work: (entityManager: typeof manager) => Promise<unknown>) => work(manager)),
  };
  return { service: new AuthService(dataSource as any), dataSource, managerCalls, query };
}

describe('AuthService secure invite acceptance', () => {
  const previousSecret = process.env.JWT_SECRET;

  beforeAll(() => {
    process.env.JWT_SECRET = 'invite-lifecycle-test-secret';
  });

  afterAll(() => {
    process.env.JWT_SECRET = previousSecret;
  });

  it.each(['owner', 'superadmin', 'super_admin', 'ceo', 'unknown'])(
    'nega fail-closed il ruolo invito %s prima di aprire una transazione',
    async (role) => {
      const { service, dataSource } = fixture({ role });
      await expect(service.acceptInvite(request(), 'raw-token', 'Password123!', 'doflow'))
        .rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    },
  );

  it('non ribinda né sovrascrive una identità globale esistente', async () => {
    const { service, managerCalls } = fixture({
      directoryUser: { id: 'existing-id', tenant_id: 'another-tenant' },
    });
    await expect(service.acceptInvite(request(), 'raw-token', 'Password123!', 'doflow'))
      .rejects.toBeInstanceOf(ConflictException);
    const sql = managerCalls.map((call) => call.sql).join('\n');
    expect(sql).not.toContain('insert into "doflow"."users"');
    expect(sql).not.toContain('insert into public.users');
    expect(sql).not.toContain('on conflict (email)');
  });

  it('nega fail-closed un token Doflow rimasto senza profilo Team pending', async () => {
    const { service, managerCalls } = fixture({ pendingMember: false });
    await expect(service.acceptInvite(request(), 'raw-token', 'Password123!', 'doflow'))
      .rejects.toBeInstanceOf(BadRequestException);
    const sql = managerCalls.map((call) => call.sql).join('\n');
    expect(sql).not.toContain('insert into "doflow"."users"');
    expect(sql).not.toContain('insert into public.users');
  });

  it('riconcilia soltanto un token raw legacy senza pending nella stessa accept transaction', async () => {
    const { service, managerCalls } = fixture({ pendingMember: false, legacyRaw: true });
    await expect(service.acceptInvite(request(), 'raw-token', 'Password123!', 'doflow'))
      .resolves.toMatchObject({ user: { role: 'user' } });

    const pendingInsertIndex = managerCalls.findIndex((call) =>
      call.sql.includes('insert into "doflow"."team_members"'),
    );
    const userInsertIndex = managerCalls.findIndex((call) =>
      call.sql.includes('insert into "doflow"."users"'),
    );
    expect(pendingInsertIndex).toBeGreaterThanOrEqual(0);
    expect(userInsertIndex).toBeGreaterThan(pendingInsertIndex);
    expect(managerCalls[pendingInsertIndex]?.params).toEqual([
      'invited@example.test',
      'invited',
      'user',
    ]);
  });

  it('non riconcilia un raw legacy se esiste un tombstone Team per la stessa email', async () => {
    const { service, managerCalls } = fixture({
      pendingMember: false,
      legacyRaw: true,
      priorTeamMember: true,
    });
    await expect(service.acceptInvite(request(), 'raw-token', 'Password123!', 'doflow'))
      .rejects.toBeInstanceOf(BadRequestException);
    const sql = managerCalls.map((call) => call.sql).join('\n');
    expect(sql).not.toContain('insert into "doflow"."team_members"');
    expect(sql).not.toContain('insert into "doflow"."users"');
    expect(sql).not.toContain('insert into public.users');
  });

  it('blocca il replay concorrente quando il claim atomico non restituisce righe', async () => {
    const { service, managerCalls } = fixture({ claimSucceeds: false });
    await expect(service.acceptInvite(request(), 'raw-token', 'Password123!', 'doflow'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(managerCalls.some((call) => call.sql.includes('insert into "doflow"."users"'))).toBe(false);
  });

  it('nega un invito revocato marcato come gia consumato prima della transazione', async () => {
    const { service, dataSource } = fixture({ acceptedAt: '2026-08-26T12:00:00.000Z' });
    await expect(service.acceptInvite(request(), 'raw-token', 'Password123!', 'doflow'))
      .rejects.toBeInstanceOf(ConflictException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('applica il ruolo viewer sincronizzato dall ultimo downgrade pending', async () => {
    const { service, managerCalls } = fixture({ role: 'viewer' });
    await expect(service.acceptInvite(request(), 'raw-token', 'Password123!', 'doflow'))
      .resolves.toMatchObject({ user: { role: 'viewer' } });
    const tenantInsert = managerCalls.find((call) =>
      call.sql.includes('insert into "doflow"."users"'),
    );
    const memberActivation = managerCalls.find((call) =>
      call.sql.includes('UPDATE "doflow"."team_members"'),
    );
    expect(tenantInsert?.params?.[2]).toBe('viewer');
    expect(memberActivation?.params?.[1]).toBe('viewer');
  });

  it('cerca il digest versionato e limita il fallback ai soli record legacy', async () => {
    const { service, query } = fixture();
    await expect(service.acceptInvite(request(), 'raw-token', 'Password123!', 'doflow')).resolves.toBeDefined();
    const lookup = query.mock.calls.find(([sql]) => String(sql).includes('from "doflow"."invites"'));
    expect(lookup?.[0]).toContain('token not like $3');
    expect(lookup?.[1]).toEqual([
      storedInviteToken('raw-token'),
      'raw-token',
      `${INVITE_TOKEN_DIGEST_PREFIX}%`,
    ]);
  });

  it('non consente di usare come bearer il digest versionato letto dallo storage', async () => {
    const stored = storedInviteToken('raw-token');
    const { service, query } = fixture({ lookupInvite: false });
    await expect(service.acceptInvite(request(), stored, 'Password123!', 'doflow'))
      .rejects.toBeInstanceOf(BadRequestException);
    const lookup = query.mock.calls.find(([sql]) => String(sql).includes('from "doflow"."invites"'));
    expect(lookup?.[1]?.[0]).not.toBe(stored);
    expect(lookup?.[1]).toEqual([
      storedInviteToken(stored),
      stored,
      `${INVITE_TOKEN_DIGEST_PREFIX}%`,
    ]);
  });
});
