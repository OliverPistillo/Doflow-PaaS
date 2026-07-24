import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
  SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { safeSchema } from '../schema.utils';

export const REQUIRE_TENANT_MODULE_KEY = 'requireTenantModule';
export const RequireTenantModule = (moduleKey: string) =>
  SetMetadata(REQUIRE_TENANT_MODULE_KEY, moduleKey);

@Injectable()
export class TenantModuleGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredModule = this.reflector.getAllAndOverride<string>(
      REQUIRE_TENANT_MODULE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredModule) {
      return true; // Nessun modulo richiesto
    }

    const request = context.switchToHttp().getRequest();
    const user = request.authUser || request.user;
    const tenantId = user?.tenantId || user?.tenant_id;

    if (!tenantId || tenantId === 'public') {
      // Potenzialmente public schema per superadmin globali
      // Decidiamo di lasciar passare i superadmin oppure no?
      // Richiesta: la logica usa "TenantSubscription", quindi
      // ci aspettiamo un tenant vero. Per sicurezza blocchiamo se
      // non c'è tenant. Se è un superadmin globale, potrebbe avere by-pass altrove
      // ma il requisito chiede di verificare subscriptions.
      const role = String(user?.role || '').toLowerCase();
      if (['superadmin', 'super_admin'].includes(role)) {
          return true; // Platform superadmin bypass
      }
      throw new ForbiddenException('Tenant environment required for this module');
    }

    const safeTenant = safeSchema(tenantId, 'TenantModuleGuard');

    // Query on public.tenant_subscriptions since it's the global table for tracking them
    // (Notice that signup service saves them via queryRunner.manager which defaults to public)
    const rows = await this.dataSource.query(
      `
      SELECT status, trial_ends_at as "trialEndsAt", expires_at as "expiresAt"
      FROM public.tenant_subscriptions
      WHERE tenant_id = $1 AND module_key = $2
      LIMIT 1
      `,
      [tenantId, requiredModule], // using raw tenantId to match tenant id properly
      // note: safeTenant might be schema slug, while tenant_id might be UUID.
      // We will try joining or relying on the DB schema.
      // Wait, let's query the tenant table to get the correct UUID if needed.
    );

    // Let's refine the query: we need the exact tenant UUID.
    const subs = await this.dataSource.query(`
      SELECT s.status, s.trial_ends_at as "trialEndsAt", s.expires_at as "expiresAt"
      FROM public.tenant_subscriptions s
      JOIN public.tenants t ON s.tenant_id = t.id
      WHERE (t.id::text = $1 OR t.slug = $1 OR t.schema_name = $1)
        AND s.module_key = $2
      LIMIT 1
    `, [tenantId, requiredModule]);


    if (subs.length === 0) {
      throw new ForbiddenException(`Module ${requiredModule} is not active for this tenant`);
    }

    const sub = subs[0];

    if (!['ACTIVE', 'TRIAL'].includes(sub.status)) {
      throw new ForbiddenException(`Module ${requiredModule} subscription status is ${sub.status}`);
    }

    const now = Date.now();
    if (sub.expiresAt && new Date(sub.expiresAt).getTime() <= now) {
        throw new ForbiddenException(`Module ${requiredModule} subscription expired`);
    }

    if (sub.status === 'TRIAL' && sub.trialEndsAt && new Date(sub.trialEndsAt).getTime() <= now) {
        throw new ForbiddenException(`Module ${requiredModule} trial expired`);
    }

    return true;
  }
}
