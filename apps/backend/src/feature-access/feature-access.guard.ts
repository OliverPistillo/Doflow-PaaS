import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { DataSource } from 'typeorm';
import {
  FEATURE_ACCESS_META_KEY,
  FeatureAccessRequirement,
  PlanTier,
} from './feature-access.decorator';

const PLAN_ORDER: Record<PlanTier, number> = {
  STARTER: 1,
  PRO: 2,
  ENTERPRISE: 3,
};

const SUPERADMIN_ROLES = new Set(['superadmin', 'super_admin']);

type TenantRow = {
  id: string;
  slug: string | null;
  schemaName: string | null;
  planTier: PlanTier | string | null;
  isActive: boolean | null;
};

type ModuleRow = {
  key: string;
  name?: string | null;
  minTier?: PlanTier | string | null;
};

@Injectable()
export class FeatureAccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly dataSource: DataSource,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requirement = this.reflector.getAllAndOverride<FeatureAccessRequirement>(
      FEATURE_ACCESS_META_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Nessun metadata => rotta pubblica/core. Non tocchiamo nulla.
    if (!requirement) return true;

    const req = context.switchToHttp().getRequest<any>();
    const user = req.user || req.authUser;
    const role = String(user?.role || '').toLowerCase();

    if (SUPERADMIN_ROLES.has(role)) return true;
    if (!user) throw new UnauthorizedException('Authentication required');

    const tenantRef = this.resolveTenantRef(req, user);
    if (!tenantRef || tenantRef === 'public') {
      throw new ForbiddenException({
        error: 'TENANT_REQUIRED',
        message: 'Questa funzione richiede un tenant attivo.',
      });
    }

    const tenant = await this.findTenant(tenantRef);
    if (!tenant || tenant.isActive !== true) {
      throw new ForbiddenException({
        error: 'TENANT_INACTIVE',
        message: 'Tenant non trovato o non attivo.',
      });
    }

    const currentPlan = this.normalizePlan(tenant.planTier);
    let requiredPlan = requirement.minPlan ?? 'STARTER';
    let moduleInfo: ModuleRow | null = null;

    if (requirement.moduleKey) {
      moduleInfo = await this.findModule(requirement.moduleKey);
      if (!moduleInfo) {
        throw new ForbiddenException({
          error: 'FEATURE_NOT_CONFIGURED',
          moduleKey: requirement.moduleKey,
          message: 'Modulo non configurato nel catalogo piattaforma.',
        });
      }
      requiredPlan = requirement.minPlan ?? this.normalizePlan(moduleInfo.minTier);
    }

    if (!this.planIncludes(currentPlan, requiredPlan)) {
      throw new ForbiddenException({
        error: 'PLAN_REQUIRED',
        moduleKey: requirement.moduleKey,
        requiredPlan,
        currentPlan,
        message: `Funzione disponibile dal piano ${requiredPlan}.`,
      });
    }

    if (requirement.moduleKey && requirement.requireActiveSubscription !== false) {
      const active = await this.hasActiveSubscription(tenant.id, requirement.moduleKey);
      if (!active) {
        throw new ForbiddenException({
          error: 'FEATURE_LOCKED',
          moduleKey: requirement.moduleKey,
          requiredPlan,
          currentPlan,
          message: `Modulo ${moduleInfo?.name || requirement.moduleKey} non attivo per questo tenant.`,
        });
      }
    }

    return true;
  }

  private resolveTenantRef(req: any, user: any): string | null {
    // Il JWT è la fonte autorevole: evita che un header x-doflow-tenant-id
    // punti a un altro tenant o a public su app.doflow.it/localhost.
    return (
      user?.tenantId ||
      user?.tenant_id ||
      req?.authUser?.tenantId ||
      req?.authUser?.tenant_id ||
      req?.tenantId ||
      null
    );
  }

  private normalizePlan(input: unknown): PlanTier {
    const value = String(input || 'STARTER').toUpperCase();
    if (value === 'ENTERPRISE') return 'ENTERPRISE';
    if (value === 'PRO') return 'PRO';
    return 'STARTER';
  }

  private planIncludes(current: PlanTier, required: PlanTier): boolean {
    return PLAN_ORDER[current] >= PLAN_ORDER[required];
  }

  private async findTenant(ref: string): Promise<TenantRow | null> {
    const rows = await this.dataSource.query(
      `SELECT
         id,
         slug,
         schema_name AS "schemaName",
         plan_tier AS "planTier",
         is_active AS "isActive"
       FROM public.tenants
       WHERE id::text = $1 OR slug = $1 OR schema_name = $1
       LIMIT 1`,
      [ref],
    );
    return rows[0] || null;
  }

  private async findModule(moduleKey: string): Promise<ModuleRow | null> {
    // Colonne TypeORM in camelCase: "minTier". Query separata per messaggi 403 chiari.
    const rows = await this.dataSource.query(
      `SELECT key, name, "minTier" AS "minTier"
       FROM public.platform_modules
       WHERE key = $1
       LIMIT 1`,
      [moduleKey],
    );
    return rows[0] || null;
  }

  private async hasActiveSubscription(tenantId: string, moduleKey: string): Promise<boolean> {
    const rows = await this.dataSource.query(
      `SELECT 1
       FROM public.tenant_subscriptions
       WHERE "tenantId" = $1
         AND "moduleKey" = $2
         AND status IN ('ACTIVE', 'TRIAL')
         AND ("expiresAt" IS NULL OR "expiresAt" > NOW())
         AND (
           status <> 'TRIAL'
           OR "trialEndsAt" IS NULL
           OR "trialEndsAt" > NOW()
         )
       LIMIT 1`,
      [tenantId, moduleKey],
    );
    return rows.length > 0;
  }
}
