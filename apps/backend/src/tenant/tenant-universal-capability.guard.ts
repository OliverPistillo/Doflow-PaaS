import { CanActivate, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { tenantActor } from './tenant-universal-context';
import {
  TenantUniversalCapabilitiesService,
  TenantUniversalCapability,
} from './tenant-universal-capabilities.service';

export const TENANT_UNIVERSAL_CAPABILITY = 'tenant:universal-capability';

export const RequireTenantCapability = (...capabilities: TenantUniversalCapability[]) =>
  SetMetadata(TENANT_UNIVERSAL_CAPABILITY, capabilities);

@Injectable()
export class TenantUniversalCapabilityGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly capabilities: TenantUniversalCapabilitiesService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<TenantUniversalCapability[]>(
      TENANT_UNIVERSAL_CAPABILITY,
      [context.getHandler(), context.getClass()],
    ) || [];
    if (!required.length) return true;
    const request = context.switchToHttp().getRequest<any>();
    await this.capabilities.require(tenantActor(request, 'TenantUniversalCapabilityGuard'), ...required);
    return true;
  }
}
