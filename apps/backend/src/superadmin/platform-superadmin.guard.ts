import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';

const PLATFORM_SUPERADMIN_ROLES = new Set(['superadmin', 'super_admin']);

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

@Injectable()
export class PlatformSuperadminGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request?.user;

    const role = normalize(user?.role);
    const tenantId = normalize(user?.tenantId);
    const authStage = String(user?.authStage ?? '').trim().toUpperCase();

    if (
      PLATFORM_SUPERADMIN_ROLES.has(role) &&
      tenantId === 'public' &&
      authStage === 'FULL'
    ) {
      return true;
    }

    throw new ForbiddenException('Accesso riservato al Superadmin di piattaforma');
  }
}
