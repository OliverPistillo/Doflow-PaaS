import { ForbiddenException } from '@nestjs/common';
import { PlatformSuperadminGuard } from './platform-superadmin.guard';

function context(user?: Record<string, unknown>): any {
  return {
    switchToHttp: () => ({
      getRequest: () => ({ user }),
    }),
  };
}

describe('PlatformSuperadminGuard', () => {
  const guard = new PlatformSuperadminGuard();

  it('rejects a missing authenticated user', () => {
    expect(() => guard.canActivate(context())).toThrow(ForbiddenException);
  });

  it.each(['superadmin', 'super_admin'])(
    'allows platform role alias %s with public scope and completed MFA',
    (role) => {
      expect(guard.canActivate(context({ role, tenantId: 'public', authStage: 'FULL' }))).toBe(true);
    },
  );

  it.each([
    ['owner', 'doflow', 'FULL'],
    ['owner', 'public', 'FULL'],
    ['admin', 'public', 'FULL'],
    ['manager', 'public', 'FULL'],
    ['member', 'public', 'FULL'],
    ['superadmin', 'doflow', 'FULL'],
    ['superadmin', 'public', 'MFA_PENDING'],
    ['superadmin', 'public', 'MFA_SETUP_NEEDED'],
  ])('rejects role=%s tenant=%s stage=%s', (role, tenantId, authStage) => {
    expect(() => guard.canActivate(context({ role, tenantId, authStage }))).toThrow(
      ForbiddenException,
    );
  });

  it('normalizes role, public scope and auth stage', () => {
    expect(
      guard.canActivate(
        context({ role: ' SUPER_ADMIN ', tenantId: ' PUBLIC ', authStage: ' full ' }),
      ),
    ).toBe(true);
  });
});
