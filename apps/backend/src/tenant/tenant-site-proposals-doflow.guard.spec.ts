import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { TenantCommercialAccessService } from './tenant-commercial-access.service';
import { TenantSiteProposalsDoflowGuard } from './tenant-site-proposals-doflow.guard';

function ctx(tenantId?: string): any {
  return { switchToHttp: () => ({ getRequest: () => ({ user: tenantId ? { tenantId } : undefined, tenantId }) }) };
}

describe('TenantSiteProposalsDoflowGuard', () => {
  const access = {
    current: jest.fn(async () => ({ capabilities: ['canUseBuilder'] })),
    require: jest.fn(),
  } as unknown as TenantCommercialAccessService;

  beforeEach(() => jest.clearAllMocks());

  it('allows doflow with the server-side Builder capability', async () => {
    await expect(new TenantSiteProposalsDoflowGuard(access).canActivate(ctx('doflow'))).resolves.toBe(true);
    expect(access.current).toHaveBeenCalledTimes(1);
    expect(access.require).toHaveBeenCalledWith(expect.any(Object), 'canUseBuilder');
  });

  it('rejects foreign, public and missing tenant before capability lookup', async () => {
    const guard = new TenantSiteProposalsDoflowGuard(access);
    await expect(guard.canActivate(ctx('acme'))).rejects.toBeInstanceOf(ForbiddenException);
    await expect(guard.canActivate(ctx('public'))).rejects.toBeInstanceOf(NotFoundException);
    await expect(guard.canActivate(ctx())).rejects.toBeInstanceOf(NotFoundException);
    expect(access.current).not.toHaveBeenCalled();
  });
});
