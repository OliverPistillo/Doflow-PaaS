import { ForbiddenException } from '@nestjs/common';
import { TenantAdminController } from './tenant-admin.controller';
import { TenantUsersController } from './tenant-users.controller';

const userId = '11111111-1111-4111-8111-111111111111';

function response() {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  } as any;
}

describe('legacy tenant identity surfaces', () => {
  it('nega un header tenant diverso dal principal su TenantAdminController', async () => {
    const controller = new TenantAdminController({} as any, {} as any);
    const req = {
      tenantId: 'tenant_b',
      user: { sub: userId, role: 'owner', tenantId: 'tenant_a' },
      authUser: { sub: userId, role: 'owner', tenantId: 'tenant_a' },
    } as any;
    await expect(controller.listAll(req, response())).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('nega un header tenant diverso dal principal su TenantUsersController', async () => {
    const controller = new TenantUsersController({} as any);
    const req = {
      tenantId: 'tenant_b',
      user: { sub: userId, role: 'manager', tenantId: 'tenant_a' },
      tenantConnection: { query: jest.fn() },
    } as any;
    await expect(controller.list(req)).rejects.toBeInstanceOf(ForbiddenException);
  });

  it.each(['manager', 'editor', 'user', 'viewer'])(
    'nega la mutation legacy tenant/users a %s',
    async (role) => {
      const teamService = { createMember: jest.fn() };
      const controller = new TenantUsersController(teamService as any);
      const req = {
        tenantId: 'doflow',
        user: { sub: userId, role, tenantId: 'doflow' },
      } as any;
      await expect(controller.create({ email: 'new@example.test' }, req)).rejects.toBeInstanceOf(ForbiddenException);
      expect(teamService.createMember).not.toHaveBeenCalled();
    },
  );

  it('delega la rimozione legacy al lifecycle Team senza cancellare public.users', async () => {
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const teamService = {
      deleteMemberByUserId: jest.fn().mockResolvedValue({ success: true, email: 'member@example.test' }),
    };
    const controller = new TenantAdminController(auditService as any, teamService as any);
    const query = jest.fn();
    const req = {
      tenantId: 'doflow',
      user: { sub: userId, role: 'owner', tenantId: 'doflow' },
      authUser: { sub: userId, role: 'owner', tenantId: 'doflow' },
      tenantConnection: { query },
    } as any;
    const res = response();

    await controller.deleteUser(`user:${userId}`, req, res);

    expect(teamService.deleteMemberByUserId).toHaveBeenCalledWith(userId);
    expect(query).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ status: 'ok', deletedId: `user:${userId}` });
  });

  it('delega la cancellazione invite legacy al lifecycle serializzato', async () => {
    const inviteId = '22222222-2222-4222-8222-222222222222';
    const auditService = { log: jest.fn().mockResolvedValue(undefined) };
    const teamService = {
      cancelInvite: jest.fn().mockResolvedValue({ success: true, email: 'pending@example.test' }),
    };
    const controller = new TenantAdminController(auditService as any, teamService as any);
    const query = jest.fn();
    const req = {
      tenantId: 'doflow',
      user: { sub: userId, role: 'owner', tenantId: 'doflow' },
      authUser: { sub: userId, role: 'owner', tenantId: 'doflow' },
      tenantConnection: { query },
    } as any;
    const res = response();

    await controller.deleteUser(`invite:${inviteId}`, req, res);

    expect(teamService.cancelInvite).toHaveBeenCalledWith(inviteId);
    expect(query).not.toHaveBeenCalled();
    expect(res.json).toHaveBeenCalledWith({ status: 'ok', deletedId: `invite:${inviteId}` });
  });
});
