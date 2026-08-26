import 'reflect-metadata';
import { INestApplication } from '@nestjs/common';
import { GUARDS_METADATA, MODULE_METADATA, PATH_METADATA } from '@nestjs/common/constants';
import { ConfigService } from '@nestjs/config';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import * as jwt from 'jsonwebtoken';
import { DataSource } from 'typeorm';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { JwtStrategy } from '../auth/jwt.strategy';
import { ApiUsageController } from './api-usage.controller';
import { AutomationsController } from './automations.controller';
import { BackupController } from './backup.controller';
import { CalendarController } from './calendar.controller';
import { ChangelogAdminController, ChangelogPublicController } from './changelog.controller';
import { DeliveryController } from './delivery.controller';
import { EmailTemplatesController } from './email-templates.controller';
import { ExportController } from './export.controller';
import { FinanceController } from './finance.controller';
import { LeadsController } from './leads.controller';
import { MetricsController } from './metrics.controller';
import { ModulesController } from './modules.controller';
import { PlatformNotificationsController } from './platform-notifications.controller';
import { PlatformSuperadminGuard } from './platform-superadmin.guard';
import { AdminQuoteRequestController, PublicQuoteRequestController } from './quote-request.controller';
import { SecurityPolicyController } from './security-policy.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { SuperadminDashboardController } from './superadmin-dashboard.controller';
import { SuperadminDashboardService } from './superadmin-dashboard.service';
import { SuperadminUsersController } from './superadmin-users.controller';
import { SuperadminModule } from './superadmin.module';
import { SystemController } from './system.controller';
import { TenantsController } from './tenants.controller';
import { TicketsController } from './tickets.controller';

const JWT_SECRET = 'superadmin-contract-test-secret-with-sufficient-length';

const PRIVATE_PLATFORM = [
  SuperadminUsersController,
  SecurityPolicyController,
  SuperadminDashboardController,
  DeliveryController,
  CalendarController,
  FinanceController,
  TenantsController,
  SystemController,
  MetricsController,
  AdminQuoteRequestController,
  ModulesController,
  SubscriptionsController,
  LeadsController,
  BackupController,
  PlatformNotificationsController,
  TicketsController,
  ApiUsageController,
  EmailTemplatesController,
  ChangelogAdminController,
  AutomationsController,
  ExportController,
] as const;

const PUBLIC_INTENTIONAL = [PublicQuoteRequestController, ChangelogPublicController] as const;

describe('SuperadminModule access contract', () => {
  it('requires an explicit classification for every registered controller', () => {
    const registered = Reflect.getMetadata(
      MODULE_METADATA.CONTROLLERS,
      SuperadminModule,
    ) as Function[];
    const classified = [...PRIVATE_PLATFORM, ...PUBLIC_INTENTIONAL];

    expect(registered).toHaveLength(classified.length);
    expect(new Set(registered)).toEqual(new Set(classified));
  });

  it.each(PRIVATE_PLATFORM)('%s has JWT and platform scope guards', (controller) => {
    const guards = (Reflect.getMetadata(GUARDS_METADATA, controller) ?? []) as Function[];

    expect(guards).toEqual(expect.arrayContaining([JwtAuthGuard, PlatformSuperadminGuard]));
  });

  it('keeps only the intentional quote and changelog controllers public', () => {
    expect(Reflect.getMetadata(PATH_METADATA, PublicQuoteRequestController)).toBe(
      'public/quote-request',
    );
    expect(Reflect.getMetadata(PATH_METADATA, ChangelogPublicController)).toBe(
      'public/changelog',
    );

    for (const controller of PUBLIC_INTENTIONAL) {
      expect(Reflect.getMetadata(GUARDS_METADATA, controller) ?? []).toEqual([]);
    }
  });
});

describe('Private platform request enforcement', () => {
  let app: INestApplication;
  let baseUrl: string;
  let accountSequence = 0;
  const accountRoles = new Map<string, string>();
  const dashboardService = { getSalesStats: jest.fn() };
  const dataSource = {
    query: jest.fn(async (_sql: string, params?: unknown[]) => {
      const subject = String(params?.[0] || '');
      const role = accountRoles.get(subject);
      return role
        ? [{ id: subject, email: 'platform-contract@example.invalid', role, is_active: true }]
        : [];
    }),
  };

  function token(payload: Record<string, unknown>) {
    const subject = `platform-contract-${++accountSequence}`;
    accountRoles.set(subject, String(payload.role || 'user'));
    return jwt.sign(
      {
        sub: subject,
        email: 'platform-contract@example.invalid',
        ...payload,
      },
      JWT_SECRET,
      { algorithm: 'HS256', expiresIn: '5m' },
    );
  }

  async function get(bearer?: string) {
    const headers = new Headers();
    if (bearer) headers.set('Authorization', `Bearer ${bearer}`);
    return fetch(`${baseUrl}/api/superadmin/dashboard/stats`, { headers });
  }

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [SuperadminDashboardController],
      providers: [
        JwtStrategy,
        PlatformSuperadminGuard,
        { provide: ConfigService, useValue: { get: () => JWT_SECRET } },
        { provide: DataSource, useValue: dataSource },
        { provide: SuperadminDashboardService, useValue: dashboardService },
      ],
    }).compile();

    app = moduleRef.createNestApplication();
    app.setGlobalPrefix('api');
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    dashboardService.getSalesStats.mockResolvedValue({ status: 'ok' });
  });

  afterAll(async () => {
    await app.close();
  });

  it('returns 401 without a valid JWT', async () => {
    expect((await get()).status).toBe(401);
    expect(dashboardService.getSalesStats).not.toHaveBeenCalled();
  });

  it.each([
    ['owner', 'doflow', 'FULL'],
    ['admin', 'doflow', 'FULL'],
    ['superadmin', 'doflow', 'FULL'],
    ['superadmin', 'public', 'MFA_PENDING'],
    ['superadmin', 'public', 'MFA_SETUP_NEEDED'],
  ])('returns 403 for role=%s tenant=%s stage=%s', async (role, tenantId, authStage) => {
    const response = await get(token({ role, tenantId, authStage }));

    expect(response.status).toBe(403);
    expect(dashboardService.getSalesStats).not.toHaveBeenCalled();
  });

  it.each(['superadmin', 'super_admin'])(
    'allows public FULL %s and delegates exactly once',
    async (role) => {
      const response = await get(token({ role, tenantId: 'public', authStage: 'FULL' }));

      expect(response.status).toBe(200);
      expect(dashboardService.getSalesStats).toHaveBeenCalledTimes(1);
    },
  );
});
