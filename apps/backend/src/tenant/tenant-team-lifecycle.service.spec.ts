import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantTeamService } from './tenant-team.service';

jest.mock('./tenant-team-schema', () => ({
  ensureTenantTeamTables: jest.fn().mockResolvedValue(undefined),
  seedTenantTeamSkills: jest.fn().mockResolvedValue(undefined),
  syncTenantUsersToTeamMembers: jest.fn().mockResolvedValue(undefined),
}));

const actorId = '11111111-1111-4111-8111-111111111111';
const memberId = '22222222-2222-4222-8222-222222222222';
const accountId = '33333333-3333-4333-8333-333333333333';
const inviteId = '44444444-4444-4444-8444-444444444444';

type FixtureOptions = {
  actorRole?: string;
  memberRole?: string;
  memberStatus?: string;
  memberExists?: boolean;
  accountExists?: boolean;
  requestTenant?: string;
  memberUserId?: string | null;
  pendingInviteExists?: boolean;
  lockedPendingInviteExists?: boolean;
};

function fixture(options: FixtureOptions = {}) {
  const member = {
    id: memberId,
    user_id: options.memberUserId === undefined ? accountId : options.memberUserId,
    email: 'member@example.test',
    display_name: 'Member',
    tenant_role: options.memberRole || 'user',
    operational_role: 'developer',
    status: options.memberStatus || 'active',
  };
  const account = {
    id: accountId,
    email: member.email,
    role: options.memberRole || 'user',
    is_active: options.memberStatus !== 'suspended' && options.memberStatus !== 'inactive',
  };
  const managerCalls: Array<{ sql: string; params?: unknown[] }> = [];
  const queryCalls: Array<{ sql: string; params?: unknown[] }> = [];
  const manager = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      managerCalls.push({ sql, params });
      if (sql.includes('SELECT * FROM "doflow".team_members')) {
        return options.memberExists === false ? [] : [member];
      }
      if (sql.includes('SELECT id, user_id, email, tenant_role, status')) {
        return options.memberExists === false ? [] : [member];
      }
      if (sql.includes('SELECT id, email, role, is_active FROM "doflow".users')) {
        return options.accountExists === false ? [] : [account];
      }
      if (sql.includes('SELECT id, role, is_active FROM "doflow".users')) {
        return options.accountExists === false ? [] : [account];
      }
      if (sql.includes('SELECT id, email, accepted_at') && sql.includes('FROM "doflow".invites')) {
        return [{ id: inviteId, email: member.email, accepted_at: new Date().toISOString() }];
      }
      if (sql.includes('FROM "doflow".invites') && sql.includes('SELECT 1 AS pending')) {
        return options.lockedPendingInviteExists ? [{ pending: true }] : [];
      }
      if (sql.includes('SELECT id') && sql.includes('FROM "doflow".team_members') && sql.includes('user_id IS NULL')) {
        return options.memberExists === false ? [] : [{ id: memberId }];
      }
      if (sql.includes('SELECT to_regclass')) return [{ relation: 'present' }];
      if (sql.includes('UPDATE "doflow".team_members') && sql.includes('RETURNING *')) {
        return [{ ...member, tenant_role: params?.includes('manager') ? 'manager' : member.tenant_role, status: params?.includes('suspended') ? 'suspended' : params?.includes('active') ? 'active' : member.status }];
      }
      if (sql.includes('UPDATE "doflow".team_members') && sql.includes('RETURNING id')) return [{ id: memberId }];
      return [];
    }),
  };
  const dataSource = {
    query: jest.fn(async (sql: string, params?: unknown[]) => {
      queryCalls.push({ sql, params });
      if (sql.includes('SELECT tm.* FROM "doflow".team_members')) {
        return options.memberExists === false ? [] : [member];
      }
      if (sql.includes('SELECT role FROM "doflow".users')) {
        return options.accountExists === false ? [] : [{ role: account.role }];
      }
      if (sql.includes('SELECT id, email FROM "doflow".users')) {
        return options.accountExists === false ? [] : [account];
      }
      if (sql.includes('FROM "doflow".invites') && sql.includes('SELECT 1 AS pending')) {
        return options.pendingInviteExists ? [{ pending: true }] : [];
      }
      if (sql.includes('SELECT id, email') && sql.includes('FROM "doflow".invites')) {
        return [{ id: inviteId, email: member.email }];
      }
      if (sql.includes('UPDATE "doflow".team_members') && sql.includes('RETURNING *')) {
        return [{ ...member, email: String(params?.[1] || member.email) }];
      }
      if (sql.includes('team_module_permissions')) return [];
      return [];
    }),
    transaction: jest.fn(async (work: (entityManager: typeof manager) => Promise<unknown>) => work(manager)),
  };
  const webSessions = { revokeUserSessions: jest.fn().mockResolvedValue(1) };
  const request = {
    tenantId: options.requestTenant || 'doflow',
    user: {
      sub: actorId,
      id: actorId,
      email: 'actor@example.test',
      role: options.actorRole || 'owner',
      tenantId: 'doflow',
      tenantSlug: 'doflow',
    },
  };
  const service = new TenantTeamService(
    dataSource as any,
    {} as any,
    {} as any,
    webSessions as any,
    request,
  );
  return { service, dataSource, manager, managerCalls, queryCalls, webSessions };
}

describe('TenantTeamService secure lifecycle', () => {
  it.each(['manager', 'editor', 'user', 'viewer'])(
    'nega a %s la modifica di un altro membro',
    async (actorRole) => {
      const { service } = fixture({ actorRole });
      await expect(service.updateMember(memberId, { status: 'suspended' })).rejects.toBeInstanceOf(ForbiddenException);
    },
  );

  it.each(['manager', 'editor', 'user', 'viewer'])(
    'nega a %s una mutation account anche sul proprio profilo',
    async (actorRole) => {
      const { service, dataSource } = fixture({ actorRole, memberUserId: actorId });
      await expect(service.updateMember(memberId, { tenant_role: 'admin' })).rejects.toBeInstanceOf(ForbiddenException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    },
  );

  it.each(['owner', 'superadmin', 'super_admin', 'ceo'])(
    'rifiuta escalation al ruolo protetto %s',
    async (tenantRole) => {
      const { service, dataSource } = fixture();
      await expect(service.updateMember(memberId, { tenant_role: tenantRole })).rejects.toBeInstanceOf(BadRequestException);
      expect(dataSource.transaction).not.toHaveBeenCalled();
    },
  );

  it.each([
    ['downgrade', () => ({ tenant_role: 'manager' })],
    ['suspend', () => ({ status: 'suspended' })],
  ])('protegge un owner da %s', async (_label, body) => {
    const { service } = fixture({ memberRole: 'owner' });
    await expect(service.updateMember(memberId, body())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('protegge un owner da rimozione e override modulo', async () => {
    const removal = fixture({ memberRole: 'owner' });
    await expect(removal.service.deleteMember(memberId)).rejects.toBeInstanceOf(ForbiddenException);

    const permissions = fixture({ memberRole: 'owner' });
    await expect(permissions.service.updateModulePermissions(memberId, {
      permissions: [{ module_key: 'projects', can_view: true }],
    })).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each([
    ['suspended', false],
    ['inactive', false],
    ['active', true],
  ])('sincronizza status %s con tenant.users.is_active=%s e revoca le sessioni', async (status, active) => {
    const { service, managerCalls, webSessions } = fixture({ memberStatus: status === 'active' ? 'suspended' : 'active' });
    await service.updateMember(memberId, { status });
    const accountUpdate = managerCalls.find((call) => call.sql.includes('UPDATE "doflow".users'));
    expect(accountUpdate?.params).toEqual([accountId, active]);
    expect(webSessions.revokeUserSessions).toHaveBeenCalledWith('doflow', accountId);
  });

  it.each(['suspended', 'inactive'])(
    'invalida atomicamente gli inviti pendenti quando lo stato diventa %s',
    async (status) => {
      const { service, dataSource, managerCalls, webSessions } = fixture({
        memberStatus: 'invited',
        memberUserId: null,
      });
      await service.updateMember(memberId, { status });

      expect(dataSource.transaction).toHaveBeenCalledTimes(1);
      const memberUpdateIndex = managerCalls.findIndex((call) =>
        call.sql.includes('UPDATE "doflow".team_members'),
      );
      const inviteInvalidationIndex = managerCalls.findIndex((call) =>
        call.sql.includes('UPDATE "doflow".invites') && call.sql.includes('accepted_at = now()'),
      );
      expect(memberUpdateIndex).toBeGreaterThanOrEqual(0);
      expect(inviteInvalidationIndex).toBeGreaterThan(memberUpdateIndex);
      expect(managerCalls[inviteInvalidationIndex]?.params).toEqual(['member@example.test']);
      expect(webSessions.revokeUserSessions).not.toHaveBeenCalled();
    },
  );

  it.each(['owner', 'admin'])('%s puo assegnare un ruolo ordinario e lo sincronizza sul tenant user', async (actorRole) => {
    const { service, managerCalls, webSessions } = fixture({ actorRole });
    await service.updateMember(memberId, { tenant_role: 'manager' });
    const accountUpdate = managerCalls.find((call) => call.sql.includes('UPDATE "doflow".users'));
    expect(accountUpdate?.params).toEqual([accountId, 'manager']);
    expect(webSessions.revokeUserSessions).toHaveBeenCalledWith('doflow', accountId);
  });

  it('sincronizza atomicamente un downgrade sul ruolo dell invito pending', async () => {
    const { service, dataSource, managerCalls, webSessions } = fixture({
      memberRole: 'manager',
      memberStatus: 'invited',
      memberUserId: null,
    });
    await service.updateMember(memberId, { tenant_role: 'viewer' });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    const memberUpdateIndex = managerCalls.findIndex((call) =>
      call.sql.includes('UPDATE "doflow".team_members'),
    );
    const inviteRoleIndex = managerCalls.findIndex((call) =>
      call.sql.includes('UPDATE "doflow".invites') && call.sql.includes('SET role = $2'),
    );
    expect(memberUpdateIndex).toBeGreaterThanOrEqual(0);
    expect(inviteRoleIndex).toBeGreaterThan(memberUpdateIndex);
    expect(managerCalls[inviteRoleIndex]?.params).toEqual(['member@example.test', 'viewer']);
    expect(webSessions.revokeUserSessions).not.toHaveBeenCalled();
  });

  it('nega una modifica email-only per un account tenant gia collegato', async () => {
    const { service, dataSource, queryCalls } = fixture();
    await expect(service.updateMember(memberId, { email: 'other@example.test' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(queryCalls.some((call) => call.sql.includes('UPDATE "doflow".team_members'))).toBe(false);
  });

  it('tratta la stessa email normalizzata come no-op per un account collegato', async () => {
    const { service, dataSource, queryCalls } = fixture();
    await expect(service.updateMember(memberId, { email: ' MEMBER@EXAMPLE.TEST ' }))
      .resolves.toMatchObject({ id: memberId, email: 'member@example.test' });
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(queryCalls.some((call) => call.sql.includes('UPDATE "doflow".team_members'))).toBe(false);
  });

  it('nega la modifica email anche se combinata con una mutation lifecycle', async () => {
    const { service, dataSource } = fixture();
    await expect(service.updateMember(memberId, {
      email: 'other@example.test',
      status: 'suspended',
    })).rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
  });

  it('nega il cambio email di un pending invited prima di poter creare un account orfano', async () => {
    const { service, dataSource, queryCalls } = fixture({
      memberStatus: 'invited',
      memberUserId: null,
    });
    await expect(service.updateMember(memberId, { email: 'other@example.test' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(queryCalls.some((call) => call.sql.includes('UPDATE "doflow".team_members'))).toBe(false);
  });

  it('nega il cambio email anche se un pending con invito vivo ha status incoerente', async () => {
    const { service, dataSource, queryCalls } = fixture({
      memberStatus: 'active',
      memberUserId: null,
      pendingInviteExists: true,
    });
    await expect(service.updateMember(memberId, { email: 'other@example.test' }))
      .rejects.toBeInstanceOf(BadRequestException);
    expect(dataSource.transaction).not.toHaveBeenCalled();
    expect(queryCalls.some((call) => call.sql.includes('SELECT 1 AS pending'))).toBe(true);
    expect(queryCalls.some((call) => call.sql.includes('UPDATE "doflow".team_members'))).toBe(false);
  });

  it('rivalida il cambio email sotto advisory e row lock se un resend ha appena creato il token', async () => {
    const { service, dataSource, managerCalls } = fixture({
      memberStatus: 'active',
      memberUserId: null,
      pendingInviteExists: false,
      lockedPendingInviteExists: true,
    });

    await expect(service.updateMember(memberId, { email: 'other@example.test' }))
      .rejects.toBeInstanceOf(BadRequestException);

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    const advisoryIndex = managerCalls.findIndex((call) => call.sql.includes('pg_advisory_xact_lock'));
    const memberLockIndex = managerCalls.findIndex((call) =>
      call.sql.includes('SELECT * FROM "doflow".team_members') && call.sql.includes('FOR UPDATE'),
    );
    const lockedInviteCheckIndex = managerCalls.findIndex((call) =>
      call.sql.includes('SELECT 1 AS pending') && call.sql.includes('FROM "doflow".invites'),
    );
    expect(advisoryIndex).toBeGreaterThanOrEqual(0);
    expect(memberLockIndex).toBeGreaterThan(advisoryIndex);
    expect(lockedInviteCheckIndex).toBeGreaterThan(memberLockIndex);
    expect(managerCalls.some((call) => call.sql.includes('UPDATE "doflow".team_members'))).toBe(false);
  });

  it('rimuove soltanto la membership tenant, pulisce gli accessi e preserva public.users', async () => {
    const { service, managerCalls, webSessions } = fixture();
    await expect(service.deleteMember(memberId)).resolves.toMatchObject({ success: true, member_id: memberId });

    const sql = managerCalls.map((call) => call.sql).join('\n');
    expect(sql).toContain('UPDATE "doflow".users SET is_active = false');
    expect(sql).toContain('UPDATE "doflow".team_module_permissions');
    expect(sql).toContain('DELETE FROM "doflow".doflow_user_roles');
    expect(sql).toContain('DELETE FROM "doflow".doflow_user_capabilities');
    expect(sql).toContain('UPDATE "doflow".invites SET accepted_at = now()');
    expect(sql).toContain('UPDATE "doflow".password_reset_tokens');
    expect(sql).toContain("status = 'archived'");
    expect(managerCalls.some((call) => call.params?.includes('team_member_removed'))).toBe(true);
    expect(sql).not.toContain('public.users');
    expect(webSessions.revokeUserSessions).toHaveBeenCalledWith('doflow', accountId);
  });

  it('cancella un invite legacy sotto advisory, revoca tutti i token vivi e archivia il pending', async () => {
    const { service, dataSource, managerCalls } = fixture({
      memberStatus: 'invited',
      memberUserId: null,
    });
    await expect(service.cancelInvite(inviteId)).resolves.toMatchObject({
      success: true,
      invite_id: inviteId,
      member_id: memberId,
    });

    expect(dataSource.transaction).toHaveBeenCalledTimes(1);
    const advisoryIndex = managerCalls.findIndex((call) => call.sql.includes('pg_advisory_xact_lock'));
    const inviteRowLockIndex = managerCalls.findIndex((call) =>
      call.sql.includes('FROM "doflow".invites') && call.sql.includes('FOR UPDATE'),
    );
    const invalidateIndex = managerCalls.findIndex((call) =>
      call.sql.includes('UPDATE "doflow".invites') && call.sql.includes('lower(email)'),
    );
    const archiveIndex = managerCalls.findIndex((call) =>
      call.sql.includes('UPDATE "doflow".team_members') && call.sql.includes("status = 'archived'"),
    );
    expect(advisoryIndex).toBeGreaterThanOrEqual(0);
    expect(inviteRowLockIndex).toBeGreaterThan(advisoryIndex);
    expect(invalidateIndex).toBeGreaterThan(inviteRowLockIndex);
    expect(archiveIndex).toBeGreaterThan(invalidateIndex);
    const sql = managerCalls.map((call) => call.sql).join('\n');
    expect(sql).toContain('UPDATE "doflow".team_module_permissions');
    expect(sql).toContain('UPDATE "doflow".team_member_skills');
    expect(sql).not.toContain('public.users');
  });

  it('restituisce 404 per un member id inesistente o appartenente a un altro tenant', async () => {
    const { service, webSessions } = fixture({ memberExists: false, requestTenant: 'tenant_b' });
    await expect(service.deleteMember(memberId)).rejects.toBeInstanceOf(NotFoundException);
    expect(webSessions.revokeUserSessions).not.toHaveBeenCalled();
  });

  it.each([
    ['read', (service: TenantTeamService) => service.getMember(memberId)],
    ['update', (service: TenantTeamService) => service.updateMember(memberId, { display_name: 'Cross tenant' })],
    ['delete', (service: TenantTeamService) => service.deleteMember(memberId)],
    ['module permissions', (service: TenantTeamService) => service.getModulePermissions(memberId)],
    ['skills', (service: TenantTeamService) => service.addMemberSkill(memberId, { skill_id: actorId })],
    ['workload', (service: TenantTeamService) => service.memberWorkload(memberId)],
    ['activity', (service: TenantTeamService) => service.memberActivity(memberId)],
  ])('nega %s di UUID esterno e ignora tenant header/query falsificato', async (_label, action) => {
    const { service, managerCalls, queryCalls } = fixture({ memberExists: false, requestTenant: 'tenant_b' });
    await expect(action(service)).rejects.toBeInstanceOf(NotFoundException);
    const sql = [...managerCalls, ...queryCalls].map((call) => call.sql).join('\n');
    expect(sql).toContain('"doflow"');
    expect(sql).not.toContain('"tenant_b"');
  });

  it('espone soltanto ruoli tecnici assegnabili nelle options', () => {
    const { service } = fixture();
    expect(service.options().tenantRoles).toEqual(['admin', 'manager', 'editor', 'user', 'viewer']);
  });

  it('non offre ad admin il ruolo admin che soltanto owner puo assegnare', () => {
    const { service } = fixture({ actorRole: 'admin' });
    expect(service.options().tenantRoles).toEqual(['manager', 'editor', 'user', 'viewer']);
  });
});
