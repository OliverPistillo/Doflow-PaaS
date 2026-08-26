import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { rejectTenantOverride, tenantActor } from './tenant-universal-context';

/** Enforces that universal tenant routes take their tenant only from auth. */
@Injectable()
export class TenantUniversalScopeGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<any>();
    tenantActor(request, 'TenantUniversalScopeGuard');
    rejectTenantOverride(request?.query);
    rejectTenantOverride(request?.body);
    return true;
  }
}
