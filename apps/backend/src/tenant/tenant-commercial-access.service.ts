import { ForbiddenException, Inject, Injectable } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';
import { hasRoleAtLeast } from '../roles';
import { isDoflowTenant } from './tenant-context';
import {
  DOFLOW_ROLE_CAPABILITIES,
  ensureDoflowWorkspaceTables,
} from './tenant-doflow-workspace.service';

export type CommercialActor = {
  id: string;
  email: string | null;
  role: string;
  schema: string;
  capabilities: ReadonlySet<string>;
};

@Injectable()
export class TenantCommercialAccessService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private requestUser() {
    const source = this.request.user || this.request.authUser;
    if (!source) throw new ForbiddenException('Sessione commerciale non valida');
    const schema = safeSchema(
      source.tenantId || source.tenant_id || this.request.tenantId || 'public',
      'TenantCommercialAccessService.requestUser',
    );
    if (schema === 'public') {
      throw new ForbiddenException('Tenant commerciale non disponibile');
    }
    return {
      id: String(source.sub || source.id || source.userId || ''),
      email: typeof source.email === 'string' ? source.email : null,
      role: String(source.role || 'user').toLowerCase().trim(),
      schema,
    };
  }

  async current(): Promise<CommercialActor> {
    const user = this.requestUser();
    if (!isDoflowTenant(user.schema)) {
      if (!hasRoleAtLeast(user.role, 'manager')) {
        throw new ForbiddenException('Manager o superiore richiesto per il CRM');
      }
      return { ...user, capabilities: new Set(['*']) };
    }

    if (['owner', 'admin'].includes(user.role)) {
      return { ...user, capabilities: new Set(['*']) };
    }

    await ensureDoflowWorkspaceTables(this.dataSource, user.schema);
    const [roleRows, capabilityRows] = await Promise.all([
      this.dataSource.query(
        `SELECT role FROM "${user.schema}".doflow_user_roles WHERE user_id = $1`,
        [user.id],
      ),
      this.dataSource.query(
        `SELECT capability FROM "${user.schema}".doflow_user_capabilities WHERE user_id = $1`,
        [user.id],
      ),
    ]);
    const inherited = roleRows.flatMap(
      (row: any) => DOFLOW_ROLE_CAPABILITIES[String(row.role)] || [],
    );
    const explicit = capabilityRows.map((row: any) => String(row.capability));
    return { ...user, capabilities: new Set([...inherited, ...explicit]) };
  }

  has(actor: CommercialActor, capability: string) {
    return actor.capabilities.has('*') || actor.capabilities.has(capability);
  }

  require(actor: CommercialActor, ...capabilities: string[]) {
    if (!capabilities.some((capability) => this.has(actor, capability))) {
      throw new ForbiddenException('Capability commerciale richiesta');
    }
  }

  requireAll(actor: CommercialActor, ...capabilities: string[]) {
    if (!capabilities.every((capability) => this.has(actor, capability))) {
      throw new ForbiddenException('Capability commerciale richiesta');
    }
  }
}
