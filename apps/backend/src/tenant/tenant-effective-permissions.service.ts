import { ForbiddenException, Injectable, Inject } from '@nestjs/common';
import { REQUEST } from '@nestjs/core';
import { DataSource } from 'typeorm';
import { safeSchema } from '../common/schema.utils';

export type TenantModuleKey =
  | 'dashboard'
  | 'crm'
  | 'briefing'
  | 'quotes'
  | 'projects'
  | 'calendar'
  | 'documents'
  | 'notifications'
  | 'team'
  | 'knowledge'
  | 'contracts'
  | 'paperwork'
  | 'finance'
  | 'reports'
  | 'automations'
  | 'credentials'
  | 'settings'
  | 'credentials.read'
  | 'credentials.create'
  | 'credentials.edit'
  | 'credentials.reveal'
  | 'credentials.manage_permissions'
  | 'credentials.audit';

export type ModuleCapability = {
  can_view: boolean;
  can_create: boolean;
  can_update: boolean;
  can_delete: boolean;
  can_manage: boolean;
};

export type EffectiveTenantAccess = {
  role: string;
  audience: 'executive' | 'manager' | 'employee';
  modules: Record<TenantModuleKey, ModuleCapability>;
};

export const TENANT_MODULE_KEYS: TenantModuleKey[] = [
  'dashboard',
  'crm',
  'briefing',
  'quotes',
  'projects',
  'calendar',
  'documents',
  'notifications',
  'team',
  'knowledge',
  'contracts',
  'paperwork',
  'finance',
  'reports',
  'automations',
  'credentials',
  'settings',
  'credentials.read',
  'credentials.create',
  'credentials.edit',
  'credentials.reveal',
  'credentials.manage_permissions',
  'credentials.audit',
];

const ADMIN_ROLES = new Set(['owner', 'admin', 'superadmin', 'super_admin']);
const MANAGER_DEFAULTS: TenantModuleKey[] = [
  'dashboard',
  'briefing',
  'projects',
  'calendar',
  'documents',
  'notifications',
  'team',
  'knowledge',
  'reports',
];
const EMPLOYEE_DEFAULTS: TenantModuleKey[] = [
  'dashboard',
  'projects',
  'calendar',
  'documents',
  'notifications',
  'knowledge',
];
const NEVER_OVERRIDE_FOR_NON_ADMIN = new Set<TenantModuleKey>([
  'finance',
  'credentials',
  'credentials.read',
  'credentials.create',
  'credentials.edit',
  'credentials.reveal',
  'credentials.manage_permissions',
  'credentials.audit',
  'settings',
  'automations',
]);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function emptyCapability(): ModuleCapability {
  return { can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false };
}

function readCapability(): ModuleCapability {
  return { can_view: true, can_create: false, can_update: false, can_delete: false, can_manage: false };
}

function editCapability(): ModuleCapability {
  return { can_view: true, can_create: true, can_update: true, can_delete: false, can_manage: false };
}

function fullCapability(): ModuleCapability {
  return { can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true };
}

@Injectable()
export class TenantEffectivePermissionsService {
  constructor(
    private readonly dataSource: DataSource,
    @Inject(REQUEST) private readonly request: any,
  ) {}

  private getUser() {
    const user = this.request.user || this.request.authUser;
    if (!user) throw new ForbiddenException('Utente non valido');
    return {
      id: String(user.sub || user.id || user.userId || ''),
      email: typeof user.email === 'string' ? user.email : undefined,
      role: String(user.role || 'user').toLowerCase().trim().replace('super_admin', 'superadmin'),
    };
  }

  private getSchema() {
    const user = this.request.user || this.request.authUser;
    return safeSchema(user?.tenantId || user?.tenant_id || this.request.tenantId || 'public', 'TenantEffectivePermissionsService.getSchema');
  }

  audienceFor(role: string): EffectiveTenantAccess['audience'] {
    if (ADMIN_ROLES.has(role)) return 'executive';
    if (role === 'manager') return 'manager';
    return 'employee';
  }

  isAdminRole(role: string): boolean {
    return ADMIN_ROLES.has(role);
  }

  private baseModules(role: string): Record<TenantModuleKey, ModuleCapability> {
    const modules = Object.fromEntries(TENANT_MODULE_KEYS.map((key) => [key, emptyCapability()])) as Record<TenantModuleKey, ModuleCapability>;

    if (this.isAdminRole(role)) {
      for (const key of TENANT_MODULE_KEYS) modules[key] = fullCapability();
      return modules;
    }

    const defaults = role === 'manager' ? MANAGER_DEFAULTS : EMPLOYEE_DEFAULTS;
    for (const key of defaults) {
      modules[key] = role === 'viewer' ? readCapability() : editCapability();
    }
    if (role === 'viewer') {
      for (const key of TENANT_MODULE_KEYS) {
        if (modules[key].can_view) modules[key] = readCapability();
      }
    }
    return modules;
  }

  private async currentMemberId(schema: string, user: { id: string; email?: string }) {
    const rows = await this.dataSource.query(
      `SELECT id
       FROM "${schema}".team_members
       WHERE deleted_at IS NULL
         AND (($1::uuid IS NOT NULL AND user_id = $1::uuid) OR lower(email) = lower($2))
       LIMIT 1`,
      [UUID_RE.test(user.id) ? user.id : null, user.email || ''],
    ).catch(() => []);
    return rows[0]?.id || null;
  }

  async getCurrentAccess(): Promise<EffectiveTenantAccess> {
    const user = this.getUser();
    const schema = this.getSchema();
    const modules = this.baseModules(user.role);

    if (schema !== 'public' && !this.isAdminRole(user.role)) {
      const memberId = await this.currentMemberId(schema, user);
      if (memberId) {
        const rows = await this.dataSource.query(
          `SELECT module_key, can_view, can_create, can_update, can_delete, can_manage
           FROM "${schema}".team_module_permissions
           WHERE team_member_id = $1 AND deleted_at IS NULL`,
          [memberId],
        ).catch(() => []);

        for (const row of rows) {
          const key = String(row.module_key || '') as TenantModuleKey;
          if (!TENANT_MODULE_KEYS.includes(key)) continue;
          if (NEVER_OVERRIDE_FOR_NON_ADMIN.has(key)) {
            if (row.can_view === false) modules[key] = emptyCapability();
            continue;
          }
          const next = {
            can_view: Boolean(row.can_view),
            can_create: Boolean(row.can_view && row.can_create),
            can_update: Boolean(row.can_view && row.can_update),
            can_delete: Boolean(row.can_view && row.can_delete),
            can_manage: Boolean(row.can_view && row.can_manage),
          };
          if (user.role === 'viewer') {
            modules[key] = next.can_view ? readCapability() : emptyCapability();
          } else {
            modules[key] = next;
          }
        }
      }
    }

    modules.dashboard.can_view = true;
    modules.notifications.can_view = true;
    return {
      role: user.role,
      audience: this.audienceFor(user.role),
      modules,
    };
  }

  async canView(moduleKey: TenantModuleKey): Promise<boolean> {
    const access = await this.getCurrentAccess();
    return Boolean(access.modules[moduleKey]?.can_view);
  }
}
