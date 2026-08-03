import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { safeSchema } from '../common/schema.utils';
import { SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';

@Injectable()
export class TenantSiteProposalsDoflowGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest();
    const user = req.user || req.authUser;
    const tenantRef = user?.tenantId || user?.tenant_id || user?.tenantSlug || req.tenantId;
    if (!tenantRef) throw new NotFoundException();
    const schema = safeSchema(tenantRef, 'TenantSiteProposalsDoflowGuard');
    if (schema !== SITE_PROPOSALS_TENANT) {
      if (schema === 'public') throw new NotFoundException();
      throw new ForbiddenException();
    }
    return true;
  }
}
