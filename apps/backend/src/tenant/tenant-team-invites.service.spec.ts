import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { AuthService } from '../auth.service';
import { TenantTeamService } from './tenant-team.service';

jest.mock('./tenant-team-schema', () => ({
  ensureTenantTeamTables: jest.fn().mockResolvedValue(undefined),
  seedTenantTeamSkills: jest.fn().mockResolvedValue(undefined),
  syncTenantUsersToTeamMembers: jest.fn().mockResolvedValue(undefined),
}));

const actorId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const skillId = '33333333-3333-4333-8333-333333333333';

type RunnerOptions = {
  mailFails?: boolean;
  mailHangs?: boolean;
  inviteInsertFails?: boolean;
  existingMember?: boolean;
  initialMemberRole?: string;
  lockedMemberRole?: string;
  availableSkillIds?: string[];
  linkedTenantUser?: { id: string; email: string; role?: string; is_active?: boolean } | null;
};

function makeQueryRunner(options: RunnerOptions = {}) {
  const calls: Array<{ sql: string; params?: unknown[] }> = [];
  const manager = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('FROM "doflow".team_members') && sql.includes('lower(email)')) {
        return options.existingMember ? [{ id: memberId }] : [];
      }
      if (sql.includes('FROM "doflow".team_members') && sql.includes('FOR UPDATE')) {
        return [{
          id: memberId,
          email: 'nuovo@example.com',
          tenant_role: options.lockedMemberRole || options.initialMemberRole || 'user',
          user_id: null,
          status: 'active',
        }];
      }
      if (sql.includes('SELECT id, email, role, is_active') && sql.includes('FROM "doflow".users')) {
        return options.linkedTenantUser ? [options.linkedTenantUser] : [];
      }
      if (sql.includes('FROM "doflow".users')) return [];
      if (sql.includes('FROM "doflow".team_skills')) {
        return (options.availableSkillIds || []).map((id) => ({ id }));
      }
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

function makeTeamService(role = 'owner', runnerOptions: RunnerOptions = {}, dataSourceOverrides: Record<string, unknown> = {}) {
  const { runner, calls } = makeQueryRunner(runnerOptions);
  const dataSource = {
    createQueryRunner: jest.fn(() => runner),
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('public.tenants')) return [{ slug: 'doflow', is_active: true, schema_name: 'doflow' }];
      if (sql.includes('SELECT id, email, tenant_role, user_id, status FROM "doflow".team_members')) {
        return [{ id: memberId, email: 'nuovo@example.com', tenant_role: runnerOptions.initialMemberRole || 'user', user_id: null, status: 'active' }];
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
  const webSessions = { revokeUserSessions: jest.fn().mockResolvedValue(0) };
  const request = { user: { sub: actorId, id: actorId, role, tenantId: 'doflow', tenantSlug: 'doflow', email: 'owner@example.com' } };
  const service = new TenantTeamService(dataSource, {} as any, mailService as any, webSessions as any, request);
  return { service, dataSource, mailService, webSessions, runner, calls };
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
    expect(token).toMatch(/^sha256:[a-f0-9]{64}$/);
    expect(result.invite?.invite_link).not.toContain(token);
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

  it('send_invite=false rifiuta un user_id che non appartiene al tenant corrente', async () => {
    const foreignUserId = '55555555-5555-4555-8555-555555555555';
    const { service, calls, runner } = makeTeamService('owner', { linkedTenantUser: null });

    await expect(service.createMember({
      email: 'foreign@example.com',
      display_name: 'Foreign identity',
      tenant_role: 'user',
      send_invite: false,
      user_id: foreignUserId,
    })).rejects.toBeInstanceOf(NotFoundException);

    const lookup = calls.find((call) =>
      call.sql.includes('SELECT id, email, role, is_active') && call.sql.includes('FROM "doflow".users'),
    );
    expect(lookup?.params).toEqual([foreignUserId]);
    expect(lookup?.sql).toContain('FOR UPDATE');
    expect(calls.some((call) => call.sql.includes('INSERT INTO "doflow".team_members'))).toBe(false);
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('send_invite=false rifiuta email discordante dall account tenant collegato', async () => {
    const linkedUserId = '55555555-5555-4555-8555-555555555555';
    const { service, calls, runner } = makeTeamService('owner', {
      linkedTenantUser: {
        id: linkedUserId,
        email: 'account@example.com',
        role: 'user',
        is_active: true,
      },
    });

    await expect(service.createMember({
      email: 'other@example.com',
      display_name: 'Wrong email',
      tenant_role: 'user',
      send_invite: false,
      user_id: linkedUserId,
    })).rejects.toBeInstanceOf(BadRequestException);

    expect(calls.some((call) => call.sql.includes('INSERT INTO "doflow".team_members'))).toBe(false);
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
  });

  it('send_invite=false collega soltanto account tenant con la stessa email normalizzata', async () => {
    const linkedUserId = '55555555-5555-4555-8555-555555555555';
    const { service, calls, runner } = makeTeamService('owner', {
      linkedTenantUser: {
        id: linkedUserId,
        email: 'linked@example.com',
        role: 'user',
        is_active: true,
      },
    });

    const result = await service.createMember({
      email: ' LINKED@EXAMPLE.COM ',
      display_name: 'Linked account',
      tenant_role: 'user',
      send_invite: false,
      user_id: linkedUserId,
    });

    const insert = calls.find((call) => call.sql.includes('INSERT INTO "doflow".team_members'));
    expect(insert?.params?.[0]).toBe(linkedUserId);
    expect(result.member.user_id).toBe(linkedUserId);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('salva identity allowlisted, override modulo e skill nella transazione che crea il pending', async () => {
    const { service, calls, runner } = makeTeamService('owner', { availableSkillIds: [skillId] });
    await service.createMember({
      email: 'nuovo@example.com',
      display_name: 'Nuovo membro',
      tenant_role: 'user',
      send_invite: true,
      doflow_identity: {
        roles: ['web_developer'],
        capabilities: ['canViewAllLeads'],
      },
      module_permissions: [{
        module_key: 'crm',
        can_view: true,
        can_create: true,
        can_update: false,
        can_delete: false,
        can_manage: false,
      }],
      skill_ids: [skillId],
    });

    const memberInsert = calls.find((call) => call.sql.includes('INSERT INTO "doflow".team_members'));
    const metadata = JSON.parse(String(memberInsert?.params?.[22] || '{}'));
    expect(metadata.pending_doflow_identity).toEqual({
      roles: ['web_developer'],
      capabilities: ['canViewAllLeads'],
    });
    expect(calls.some((call) => call.sql.includes('INSERT INTO "doflow".team_module_permissions'))).toBe(true);
    expect(calls.some((call) => call.sql.includes('INSERT INTO "doflow".team_member_skills'))).toBe(true);
    const inviteIndex = calls.findIndex((call) => call.sql.includes('INSERT INTO "doflow".invites'));
    expect(calls.findIndex((call) => call.sql.includes('INSERT INTO "doflow".team_module_permissions'))).toBeLessThan(inviteIndex);
    expect(runner.commitTransaction).toHaveBeenCalledTimes(1);
  });

  it('rifiuta valori identity fuori allowlist e grant positivi impossibili', async () => {
    await expect(makeTeamService().service.createMember({
      email: 'owner@example.com',
      display_name: 'Owner tecnico',
      tenant_role: 'user',
      doflow_identity: { roles: ['owner'], capabilities: [] },
    })).rejects.toBeInstanceOf(BadRequestException);

    await expect(makeTeamService().service.createMember({
      email: 'finance@example.com',
      display_name: 'Finance',
      tenant_role: 'user',
      module_permissions: [{ module_key: 'finance', can_view: true }],
    })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rollbacka l intera creazione quando una skill staged non esiste', async () => {
    const { service, runner, mailService } = makeTeamService();
    await expect(service.createMember({
      email: 'nuovo@example.com',
      display_name: 'Nuovo membro',
      tenant_role: 'user',
      skill_ids: [skillId],
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(runner.rollbackTransaction).toHaveBeenCalledTimes(1);
    expect(runner.commitTransaction).not.toHaveBeenCalled();
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
    const inviteCalls = calls.filter((call) =>
      call.sql.includes('pg_advisory_xact_lock') ||
      call.sql.includes('UPDATE "doflow".invites') ||
      call.sql.includes('INSERT INTO "doflow".invites'),
    );
    expect(inviteCalls.map((call) =>
      call.sql.includes('pg_advisory_xact_lock') ? 'lock' :
      call.sql.includes('UPDATE') ? 'invalidate' : 'insert',
    )).toEqual(['lock', 'invalidate', 'insert']);
    expect(inviteCalls[0].params).toEqual(['doflow:nuovo@example.com']);
    expect(calls.some((call) => call.sql.includes('UPDATE "doflow".invites'))).toBe(true);
    const token = calls.find((call) => call.sql.includes('INSERT INTO "doflow".invites'))?.params?.[2] as string;
    expect(token).toMatch(/^sha256:[a-f0-9]{64}$/);
  });

  it('reinvio rilegge il ruolo sotto advisory e row lock prima di creare il token', async () => {
    const { service, calls } = makeTeamService('owner', {
      initialMemberRole: 'manager',
      lockedMemberRole: 'viewer',
    });
    await service.inviteMember(memberId);

    const advisoryIndex = calls.findIndex((call) => call.sql.includes('pg_advisory_xact_lock'));
    const rowLockIndex = calls.findIndex((call) =>
      call.sql.includes('FROM "doflow".team_members') && call.sql.includes('FOR UPDATE'),
    );
    const insertIndex = calls.findIndex((call) => call.sql.includes('INSERT INTO "doflow".invites'));
    expect(advisoryIndex).toBeGreaterThanOrEqual(0);
    expect(rowLockIndex).toBeGreaterThan(advisoryIndex);
    expect(insertIndex).toBeGreaterThan(rowLockIndex);
    expect(calls[insertIndex]?.params?.[1]).toBe('viewer');
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
      if (sql.includes('from "doflow"."team_members"')) return [{ id: memberId, metadata: {} }];
      if (sql.includes('update "doflow"."invites"')) return [{ id: memberId }];
      if (sql.includes('insert into "doflow"."users"')) return [{ id: actorId, email: 'nuovo@example.com', created_at: new Date(), role: 'user' }];
      return [];
    });
    const service = new AuthService({
      query,
      transaction: jest.fn(async (work: (manager: { query: typeof query }) => Promise<unknown>) => work({ query })),
    } as any);
    await service.acceptInvite({} as any, 'token', 'Password123!', 'doflow');

    expect(query).toHaveBeenCalledWith(expect.stringContaining('UPDATE "doflow"."team_members"'), [actorId, 'user', 'nuovo@example.com']);
    process.env.JWT_SECRET = previousSecret;
  });

  it('applica identity staged e rimuove soltanto la chiave riservata nella stessa accept transaction', async () => {
    const previousSecret = process.env.JWT_SECRET;
    process.env.JWT_SECRET = 'test-secret';
    const calls: Array<{ sql: string; params?: unknown[] }> = [];
    const query = jest.fn(async (sql: string, params?: unknown[]) => {
      calls.push({ sql, params });
      if (sql.includes('select is_active from public.tenants')) return [{ is_active: true }];
      if (sql.includes('from public.tenants') && sql.includes('id::text')) return [{ id: 'tenant-public-id', slug: 'doflow', schema_name: 'doflow' }];
      if (sql.includes('from "doflow"."invites"')) return [{ id: memberId, email: 'nuovo@example.com', role: 'user', accepted_at: null, expires_at: '2030-01-01T00:00:00.000Z' }];
      if (sql.includes('from "doflow"."users"')) return [];
      if (sql.includes('from "doflow"."team_members"')) return [{
        id: memberId,
        metadata: {
          retained: true,
          pending_doflow_identity: {
            roles: ['web_developer'],
            capabilities: ['canViewAllLeads'],
          },
        },
      }];
      if (sql.includes('update "doflow"."invites"')) return [{ id: memberId }];
      if (sql.includes('insert into "doflow"."users"')) return [{ id: actorId, email: 'nuovo@example.com', created_at: new Date(), role: 'user' }];
      return [];
    });
    const service = new AuthService({
      query,
      transaction: jest.fn(async (work: (manager: { query: typeof query }) => Promise<unknown>) => work({ query })),
    } as any);
    await service.acceptInvite({} as any, 'token', 'Password123!', 'doflow');

    expect(calls).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sql: expect.stringContaining('doflow_user_roles'),
        params: [actorId, 'web_developer'],
      }),
      expect.objectContaining({
        sql: expect.stringContaining('doflow_user_capabilities'),
        params: [actorId, 'canViewAllLeads'],
      }),
    ]));
    const activation = calls.find((call) => call.sql.includes('UPDATE "doflow"."team_members"'));
    expect(activation?.sql).toContain("metadata = COALESCE(metadata, '{}'::jsonb) - 'pending_doflow_identity'");
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
    return {
      service: new TenantTeamService(
        dataSource as any,
        {} as any,
        {} as any,
        { revokeUserSessions: jest.fn().mockResolvedValue(0) } as any,
        request,
      ),
      calls,
    };
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
