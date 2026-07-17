import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { TenantTeamService } from './tenant-team.service';

jest.mock('./tenant-team-schema', () => ({
  ensureTenantTeamTables: jest.fn().mockResolvedValue(undefined),
  seedTenantTeamSkills: jest.fn().mockResolvedValue(undefined),
  syncTenantUsersToTeamMembers: jest.fn().mockResolvedValue(undefined),
}));

const actorId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';

function makeQueryRunner(options: { mailFails?: boolean; mailHangs?: boolean; inviteInsertFails?: boolean; existingMember?: boolean } = {}) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const manager = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM "doflow".team_members') && sql.includes('lower(email)')) {
        return options.existingMember ? [{ id: memberId }] : [];
      }
      if (sql.includes('FROM "doflow".users')) return [];
      if (sql.includes('INSERT INTO "doflow".team_members')) {
        return [{
          id: memberId,
          email: 'nuovo@example.com',
          display_name: 'Nuovo membro',
          tenant_role: params?.[6] || 'user',
          status: params?.[11] || 'active',
          user_id: params?.[0] || null,
        }];
      }
      if (sql.includes('INSERT INTO "doflow".invites')) {
        if (options.inviteInsertFails) throw new Error('invite insert failed');
        return [{ expires_at: '2030-01-01T00:00:00.000Z' }];
      }
      return [];
    }),
  };
  const runner = {
    manager,
    connect: jest.fn().mockResolvedValue(undefined),
    startTransaction: jest.fn().mockResolvedValue(undefined),
    commitTransaction: jest.fn().mockResolvedValue(undefined),
    rollbackTransaction: jest.fn().mockResolvedValue(undefined),
    release: jest.fn().mockResolvedValue(undefined),
  };
  return { runner, calls };
}

function makeTeamService(role = 'owner', runnerOptions: { mailFails?: boolean; mailHangs?: boolean; inviteInsertFails?: boolean; existingMember?: boolean } = {}, dataSourceOverrides: Record<string, unknown> = {}) {
  const { runner, calls } = makeQueryRunner(runnerOptions);
  const dataSource = {
    createQueryRunner: jest.fn(() => runner),
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('public.tenants')) return [{ slug: 'doflow', is_active: true, schema_name: 'doflow' }];
      if (sql.includes('SELECT id, email, tenant_role, user_id, status FROM "doflow".team_members')) {
        return [{ id: memberId, email: 'nuovo@example.com', tenant_role: 'user', user_id: null, status: 'active' }];
      }
      if (sql.includes('FROM "doflow".users')) return [];
      return [];
    }),
    ...dataSourceOverrides,
  } as any;
  const mailService = {
    sendInviteEmail: jest.fn(() => {
      if (runnerOptions.mailHangs) return new Promise<boolean>(() => undefined);
      return Promise.resolve(!runnerOptions.mailFails);
    }),
  };
  const request = { user: { sub: actorId, id: actorId, role, tenantId: 'doflow', tenantSlug: 'doflow', email: 'owner@example.com' } };
  const service = new TenantTeamService(dataSource, {} as any, mailService as any, request);
  return { service, dataSource, mailService, runner, calls };
}

describe('TenantTeamService invite flow', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = { ...originalEnv };
    process.env.NODE_ENV = 'test';
    process.env.FRONTEND_URL = 'https://app.doflow.test';
    delete process.env.APP_URL;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('create con send_invite=true crea membro invited, invito e link senza token separato', async () => {
    const { service, mailService, runner, calls } = makeTeamService();
    const result = await service.createMember({
      email: 'Nuovo@Example.com',
      display_name: 'Nuovo membro',
      tenant_role: 'user',
      send_invite: true,
    });

    expect(result.member.status).toBe('invited');
    expect(result.member.user_id).toBeNull();
    expect(result.invite?.email_sent).toBe(true);
    expect(result.invite?.invite_link).toContain('/accept-invite?token=');
    expect(Object.keys(result.invite || {})).not.toContain('token');
    expect(mailService.sendInviteEmail).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);

    const inviteInsert = calls.find((call) => call.sql.includes('INSERT INTO "doflow".invites'));
    const token = inviteInsert?.params?.[2] as string;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const activityPayloads = calls.filter((call) => call.sql.includes('team_activity')).map((call) => JSON.stringify(call.params));
    expect(activityPayloads.join(' ')).not.toContain(token);
  });

  it('in produzione genera link con FRONTEND_URL pubblico e non localhost', async () => {
    process.env.NODE_ENV = 'production';
    process.env.FRONTEND_URL = 'https://app.doflow.it';
    const { service } = makeTeamService();
    const result = await service.createMember({
      email: 'nuovo@example.com',
      display_name: 'Nuovo membro',
      tenant_role: 'user',
      send_invite: true,
    });

    expect(result.invite?.invite_link).toMatch(/^https:\/\/app\.doflow\.it\/accept-invite\?token=/);
    expect(result.invite?.invite_link).toContain('&tenant=doflow');
    expect(result.invite?.invite_link).not.toContain('localhost');
  });

  it('mail failure non annulla membro e invito', async () => {
    const { service, runner } = makeTeamService('owner', { mailFails: true });
    const result = await service.createMember({
      email: 'nuovo@example.com',
      display_name: 'Nuovo membro',
      tenant_role: 'user',
      send_invite: true,
    });
    expect(result.invite?.email_sent).toBe(false);
    expect(result.invite?.invite_link).toBeTruthy();
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('SMTP appeso torna rapidamente con email_sent=false senza rollback', async () => {
    process.env.TEAM_INVITE_EMAIL_TIMEOUT_MS = '20';
    const { service, runner } = makeTeamService('owner', { mailHangs: true });
    const started = Date.now();
    const result = await service.createMember({
      email: 'nuovo@example.com',
      display_name: 'Nuovo membro',
      tenant_role: 'user',
      send_invite: true,
    });

    expect(Date.now() - started).toBeLessThan(2000);
    expect(result.invite?.email_sent).toBe(false);
    expect(result.invite?.invite_link).toBeTruthy();
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
    expect(runner.rollbackTransaction).not.toHaveBeenCalled();
  });

  it('rollback se insert invito fallisce', async () => {
    const { service, runner } = makeTeamService('owner', { inviteInsertFails: true });
    await expect(service.createMember({
      email: 'nuovo@example.com',
      display_name: 'Nuovo membro',
      tenant_role: 'user',
      send_invite: true,
    })).rejects.toThrow('invite insert failed');
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
  });

  it('send_invite=false crea solo profilo', async () => {
    const { service, mailService } = makeTeamService();
    const result = await service.createMember({
      email: 'nuovo@example.com',
      display_name: 'Nuovo membro',
      tenant_role: 'user',
      send_invite: false,
    });
    expect(result.invite).toBeNull();
    expect(result.member.status).toBe('active');
    expect(mailService.sendInviteEmail).not.toHaveBeenCalled();
  });

  it('membro duplicato restituisce 400 e non crea nuovo invito', async () => {
    const { service, mailService, runner } = makeTeamService('owner', { existingMember: true });
    await expect(service.createMember({
      email: 'nuovo@example.com',
      display_name: 'Nuovo membro',
      tenant_role: 'user',
      send_invite: true,
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(mailService.sendInviteEmail).not.toHaveBeenCalled();
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('reinvio invalida precedente invito e genera nuovo token', async () => {
    const { service, calls } = makeTeamService();
    const result = await service.inviteMember(memberId);
    expect(result.invite_link).toContain('/accept-invite?token=');
    expect(calls.some((call) => call.sql.includes('UPDATE "doflow".invites'))).toBe(true);
    const token = calls.find((call) => call.sql.includes('INSERT INTO "doflow".invites'))?.params?.[2] as string;
    expect(token).toMatch(/^[a-f0-9]{64}$/);
  });

  it('manager non puo invitare e admin non puo invitare admin', async () => {
    await expect(makeTeamService('manager').service.createMember({
      email: 'nuovo@example.com',
      display_name: 'Nuovo membro',
      tenant_role: 'user',
    })).rejects.toBeInstanceOf(ForbiddenException);

    await expect(makeTeamService('admin').service.createMember({
      email: 'admin@example.com',
      display_name: 'Admin',
      tenant_role: 'admin',
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rifiuta owner, superadmin e ruolo tecnico ceo', async () => {
    for (const tenantRole of ['owner', 'superadmin', 'super_admin', 'ceo']) {
      await expect(makeTeamService('owner').service.createMember({
        email: `${tenantRole}@example.com`,
        display_name: tenantRole,
        tenant_role: tenantRole,
      })).rejects.toBeInstanceOf(BadRequestException);
    }
  });
});

describe('AuthService accept invite team link', () => {
  it('collega team_members.user_id e attiva il profilo dopo accept-invite', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret';
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      if (sql.includes('select is_active from public.tenants')) return [{ is_active: true }];
      if (sql.includes('from public.tenants') && sql.includes('id::text')) return [{ id: 'tenant-public-id', slug: 'doflow', schema_name: 'doflow' }];
      if (sql.includes('from "doflow"."invites"')) return [{ id: memberId, email: 'nuovo@example.com', role: 'user', accepted_at: null, expires_at: '2030-01-01T00:00:00.000Z' }];
      if (sql.includes('from "doflow"."users"')) return [];
      if (sql.includes('insert into "doflow"."users"')) return [{ id: actorId, email: 'nuovo@example.com', created_at: new Date(), role: 'user' }];
      return [];
    });
    const service = new AuthService({ query } as any);
    await service.acceptInvite({} as any, 'token', 'Password123!', 'doflow');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "doflow"."team_members"'), [actorId, 'user', 'nuovo@example.com']);
    process.env.JWT_SECRET = previousSecret;
  });
});

describe('TenantTeamService member update nullable fields', () => {
  function makeUpdateService() {
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const member = {
      id: memberId,
      user_id: null,
      email: 'nuovo@example.com',
      display_name: 'Nuovo membro',
      tenant_role: 'user',
      status: 'active',
      start_date: '2026-01-01',
      end_date: null,
    };
    const dataSource = {
      query: jest.fn(async (sql: string, params?: unknown[]) => {
        calls.push({ sql, params });
        if (sql.includes('SELECT tm.* FROM "doflow".team_members')) return [member];
        if (sql.includes('UPDATE "doflow".team_members SET')) return [{ ...member, id: params?.[0], updated: true }];
        return [];
      }),
    };
    const request = { user: { sub: actorId, id: actorId, role: 'owner', tenantId: 'doflow', tenantSlug: 'doflow', email: 'owner@example.com' } };
    return { service: new TenantTeamService(dataSource as any, {} as any, {} as any, request), calls };
  }

  it('date vuote e numerici vuoti diventano NULL', async () => {
    const { service, calls } = makeUpdateService();

    await service.updateMember(memberId, {
      start_date: '',
      end_date: '   ',
      capacity_hours_per_week: '',
      hourly_rate_cents: '',
      daily_rate_cents: '',
    });

    const update = calls.find((call) => call.sql.includes('UPDATE "doflow".team_members SET'));
    expect(update?.sql).toContain('start_date');
    expect(update?.sql).toContain('end_date');
    expect(update?.params?.slice(1)).toEqual([null, null, null, null, null]);
  });

  it('undefined non modifica date o numerici', async () => {
    const { service, calls } = makeUpdateService();

    await service.updateMember(memberId, { display_name: 'Aggiornato' });

    const update = calls.find((call) => call.sql.includes('UPDATE "doflow".team_members SET'));
    expect(update?.sql).toContain('display_name');
    expect(update?.sql).not.toContain('start_date');
    expect(update?.sql).not.toContain('capacity_hours_per_week');
  });

  it('data valida viene salvata', async () => {
    const { service, calls } = makeUpdateService();

    await service.updateMember(memberId, { start_date: '2026-02-01', end_date: '2026-02-28' });

    const update = calls.find((call) => call.sql.includes('UPDATE "doflow".team_members SET'));
    expect(update?.params).toContain('2026-02-01');
    expect(update?.params).toContain('2026-02-28');
  });

  it('data invalida restituisce 400 controllato', async () => {
    const { service } = makeUpdateService();

    await expect(service.updateMember(memberId, { start_date: '2026-99-99' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('end_date prima di start_date restituisce 400 controllato', async () => {
    const { service } = makeUpdateService();

    await expect(service.updateMember(memberId, { start_date: '2026-02-10', end_date: '2026-02-01' })).rejects.toBeInstanceOf(BadRequestException);
  });
});
