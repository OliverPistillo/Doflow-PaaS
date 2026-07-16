import {
  TENANT_MODULE_KEYS,
  TenantEffectivePermissionsService,
  type EffectiveTenantAccess,
  type ModuleCapability,
  type TenantModuleKey,
} from './tenant-effective-permissions.service';
import { TenantDashboardService } from './tenant-dashboard.service';
import { TenantTeamController } from './tenant-team.controller';

const OWNER = { sub: '11111111-1111-4111-8111-111111111111', email: 'owner@example.com', role: 'owner', tenantId: 'tenant_a' };
const ADMIN = { sub: '11111111-1111-4111-8111-111111111112', email: 'admin@example.com', role: 'admin', tenantId: 'tenant_a' };
const MANAGER = { sub: '22222222-2222-4222-8222-222222222222', email: 'manager@example.com', role: 'manager', tenantId: 'tenant_a' };
const USER = { sub: '33333333-3333-4333-8333-333333333333', email: 'user@example.com', role: 'user', tenantId: 'tenant_a' };
const VIEWER = { sub: '44444444-4444-4444-8444-444444444444', email: 'viewer@example.com', role: 'viewer', tenantId: 'tenant_a' };

function makeService(user: Record<string, string>, overrides: Array<Record<string, unknown>> = []) {
  const query = jest.fn(async (sql: string) => {
    if (sql.includes('FROM "tenant_a".team_members')) return [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }];
    if (sql.includes('FROM "tenant_a".team_module_permissions')) return overrides;
    return [];
  });
  const service = new TenantEffectivePermissionsService({ query } as any, { user }) as any;
  return { service, query };
}

describe('TenantEffectivePermissionsService', () => {
  it('owner e admin ricevono tutti i moduli con capability complete', async () => {
    for (const user of [OWNER, ADMIN]) {
      const { service } = makeService(user);
      const access = await service.getCurrentAccess();

      expect(access.audience).toBe('executive');
      expect(access.modules.finance).toMatchObject({ can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true });
      expect(access.modules.credentials).toMatchObject({ can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true });
      expect(access.modules.settings).toMatchObject({ can_view: true, can_manage: true });
    }
  });

  it('dashboard non calcola summary di moduli non autorizzati', async () => {
    const denied = { can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false } satisfies ModuleCapability;
    const modules = Object.fromEntries(TENANT_MODULE_KEYS.map((key) => [key, { ...denied }])) as Record<TenantModuleKey, ModuleCapability>;
    modules.dashboard.can_view = true;
    modules.notifications.can_view = true;
    const access = {
      role: 'user',
      audience: 'employee',
      modules,
    } satisfies EffectiveTenantAccess;
    const service = new TenantDashboardService(
      { query: jest.fn() } as any,
      { getCurrentAccess: jest.fn().mockResolvedValue(access) } as any,
      { user: USER },
    ) as any;

    jest.spyOn(service, 'getTenantIdentity').mockResolvedValue({ id: 'tenant-a', slug: 'tenant-a', schema: 'tenant_a' });
    jest.spyOn(service, 'buildPersonalSummary').mockResolvedValue({
      myTasks: 0,
      dueSoon: 0,
      blockedTasks: 0,
      assignedProjects: 0,
      upcomingDeadlines: 0,
      sources: {},
    });
    jest.spyOn(service, 'getRecentNotifications').mockResolvedValue([]);
    jest.spyOn(service, 'getRecentTenantNotifications').mockResolvedValue([]);
    jest.spyOn(service, 'buildNotificationsSummary').mockResolvedValue(null);
    const forbiddenBuilders = [
      'buildFinanceSummary',
      'buildCredentialsSummary',
      'buildReportsSummary',
      'buildAutomationsSummary',
      'buildContractsSummary',
      'buildPaperworkSummary',
      'buildSalesSummary',
      'buildTeamSummary',
    ];
    for (const method of forbiddenBuilders) {
      jest.spyOn(service, method).mockImplementation(() => {
        throw new Error(`${method} should not be called`);
      });
    }

    const summary = await service.getSummary();

    expect(summary.finance).toBeNull();
    expect(summary.sales).toBeNull();
    expect(summary.team).toBeNull();
    expect(summary.operations.credentialsSummary).toBeNull();
    expect(summary.operations.reportsSummary).toBeNull();
    expect(summary.operations.automationsSummary).toBeNull();
    expect(summary.operations.contractsSummary).toBeNull();
    expect(summary.operations.paperworkSummary).toBeNull();
    for (const method of forbiddenBuilders) {
      expect(service[method]).not.toHaveBeenCalled();
    }
  });

  it('manager non riceve Finance, Credentials, Automations o Settings di default', async () => {
    const { service } = makeService(MANAGER);
    const access = await service.getCurrentAccess();

    expect(access.audience).toBe('manager');
    expect(access.modules.projects.can_view).toBe(true);
    expect(access.modules.team.can_view).toBe(true);
    expect(access.modules.finance.can_view).toBe(false);
    expect(access.modules.credentials.can_view).toBe(false);
    expect(access.modules.automations.can_view).toBe(false);
    expect(access.modules.settings.can_view).toBe(false);
  });

  it('user riceve solo baseline operativa', async () => {
    const { service } = makeService(USER);
    const access = await service.getCurrentAccess();

    expect(access.audience).toBe('employee');
    expect(access.modules.dashboard.can_view).toBe(true);
    expect(access.modules.projects.can_view).toBe(true);
    expect(access.modules.documents.can_view).toBe(true);
    expect(access.modules.notifications.can_view).toBe(true);
    expect(access.modules.knowledge.can_view).toBe(true);
    expect(access.modules.crm.can_view).toBe(false);
    expect(access.modules.quotes.can_view).toBe(false);
    expect(access.modules.finance.can_view).toBe(false);
    expect(access.modules.contracts.can_view).toBe(false);
  });

  it('viewer mantiene solo capability di lettura', async () => {
    const { service } = makeService(VIEWER, [
      { module_key: 'crm', can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true },
    ]);

    const access = await service.getCurrentAccess();

    expect(access.modules.crm).toEqual({ can_view: true, can_create: false, can_update: false, can_delete: false, can_manage: false });
    expect(access.modules.projects).toEqual({ can_view: true, can_create: false, can_update: false, can_delete: false, can_manage: false });
  });

  it('override can_view=false nasconde un modulo baseline', async () => {
    const { service } = makeService(USER, [
      { module_key: 'projects', can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false },
    ]);

    const access = await service.getCurrentAccess();

    expect(access.modules.projects.can_view).toBe(false);
    expect(access.modules.dashboard.can_view).toBe(true);
    expect(access.modules.notifications.can_view).toBe(true);
  });

  it('override concesso abilita un modulo consentibile', async () => {
    const { service } = makeService(USER, [
      { module_key: 'crm', can_view: true, can_create: true, can_update: true, can_delete: false, can_manage: false },
    ]);

    const access = await service.getCurrentAccess();

    expect(access.modules.crm).toMatchObject({ can_view: true, can_create: true, can_update: true, can_delete: false, can_manage: false });
  });

  it('override non amministrativo non abilita moduli non superabili', async () => {
    const { service } = makeService(MANAGER, [
      { module_key: 'finance', can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true },
      { module_key: 'credentials', can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true },
      { module_key: 'settings', can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true },
      { module_key: 'automations', can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true },
    ]);

    const access = await service.getCurrentAccess();

    expect(access.modules.finance.can_view).toBe(false);
    expect(access.modules.credentials.can_view).toBe(false);
    expect(access.modules.settings.can_view).toBe(false);
    expect(access.modules.automations.can_view).toBe(false);
  });

  it('endpoint corrente deriva utente e tenant dal request context senza parametri', async () => {
    const access = { role: 'user', audience: 'employee', modules: {} };
    const controller = new TenantTeamController({} as any, { getCurrentAccess: jest.fn().mockResolvedValue(access) } as any);

    await expect(controller.currentModulePermissions()).resolves.toBe(access);
  });

  it('tenant A non legge override tenant B', async () => {
    const query = jest.fn(async (sql: string) => {
      expect(sql).not.toContain('"tenant_b"');
      if (sql.includes('FROM "tenant_a".team_members')) return [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }];
      if (sql.includes('FROM "tenant_a".team_module_permissions')) return [];
      return [];
    });
    const service = new TenantEffectivePermissionsService({ query } as any, { user: USER }) as any;

    const access = await service.getCurrentAccess();

    expect(access.modules.finance.can_view).toBe(false);
  });
});
