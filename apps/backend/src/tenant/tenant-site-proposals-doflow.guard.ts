import { CanActivate, ExecutionContext, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { safeSchema } from '../common/schema.utils';
import { SITE_PROPOSALS_TENANT } from './tenant-site-proposals.constants';
import { TenantCommercialAccessService } from './tenant-commercial-access.service';

@Injectable()
export class TenantSiteProposalsDoflowGuard implements CanActivate {
  constructor(private readonly access: TenantCommercialAccessService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const user = req.user || req.authUser;
    const tenantRef = user?.tenantId || user?.tenant_id || user?.tenantSlug || req.tenantId;
    if (!tenantRef) throw new NotFoundException();
    const schema = safeSchema(tenantRef, 'TenantSiteProposalsDoflowGuard');
    if (schema !== SITE_PROPOSALS_TENANT) {
      if (schema === 'public') throw new NotFoundException();
      throw new ForbiddenException();
    }
    const actor = await this.access.current();
    this.access.require(actor, 'canUseBuilder');
    req.doflowBuilderAuthorized = true;
    return true;
  }
}
