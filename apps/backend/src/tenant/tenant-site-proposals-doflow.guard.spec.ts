import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { TenantSiteProposalsDoflowGuard } from './tenant-site-proposals-doflow.guard';

function ctx(tenantId?: string): any {
  return { switchToHttp: () => ({ getRequest: () => ({ user: tenantId ? { tenantId } : undefined, tenantId }) }) };
}

describe('TenantSiteProposalsDoflowGuard', () => {
  it('allows doflow', () => {
    expect(new TenantSiteProposalsDoflowGuard().canActivate(ctx('doflow'))).toBe(true);
  });

  it('rejects federicanerone, public and missing tenant', () => {
    const guard = new TenantSiteProposalsDoflowGuard();
    expect(() => guard.canActivate(ctx('federicanerone'))).toThrow(ForbiddenException);
    expect(() => guard.canActivate(ctx('public'))).toThrow(NotFoundException);
    expect(() => guard.canActivate(ctx())).toThrow(NotFoundException);
  });
});
