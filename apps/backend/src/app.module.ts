import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { APP_GUARD } from '@nestjs/core';
import * as path from 'path';

// --- MODULI CORE & INFRA ---
import { RedisModule } from './redis/redis.module';
import { TelemetryModule } from './telemetry/telemetry.module';
import { TrafficControlModule } from './traffic-control/traffic-control.module';
import { TenancyModule } from './tenancy/tenancy.module';
import { MailModule } from './mail/mail.module';
import { HealthModule } from './health/health.module';

// --- CONTROLLERS ---
import { AppController } from './app.controller';
import { BloomController } from './bloom.controller';
import { TenantUsersController } from './tenant-users.controller';
import { AuthController } from './auth.controller';
import { TenantAdminController } from './tenant-admin.controller';
import { ProjectsController } from './projects.controller';
import { FilesController } from './files.controller';
import { NotificationsTestController } from './realtime/notifications-test.controller';
import { AuthPasswordController } from './auth-password.controller';
import { AuthMfaController } from './auth-mfa.controller';
import { SuperadminAuditController } from './audit.controller';

// --- SUPERADMIN CONTROLLERS & SERVICES ---
import { SuperadminUsersController } from './superadmin/superadmin-users.controller';
import { SecurityPolicyController } from './superadmin/security-policy.controller';
import { SuperadminDashboardController } from './superadmin/superadmin-dashboard.controller';
import { SuperadminDashboardService } from './superadmin/superadmin-dashboard.service';
import { DeliveryController } from './superadmin/delivery.controller';
import { DeliveryService } from './superadmin/delivery.service';
import { CalendarController } from './superadmin/calendar.controller';
import { CalendarService } from './superadmin/calendar.service';
import { FinanceController } from './superadmin/finance.controller';
import { FinanceService } from './superadmin/finance.service';
import { TenantsController } from './superadmin/tenants.controller';
import { TenantsService } from './superadmin/tenants.service';
import { SystemController } from './superadmin/system.controller';

// --- SERVIZI ---
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { LoginGuardService } from './login-guard.service';
import { FileStorageService } from './file-storage.service';
import { NotificationsService } from './realtime/notifications.service';
import { ProjectsEventsService } from './realtime/projects-events.service';
import { TenantBootstrapService } from './tenancy/tenant-bootstrap.service';
import { AuthMfaService } from './auth-mfa.service';
import { SystemStatsService } from './superadmin/telemetry.service'; // <--- ASSICURATI CHE SIA IMPORTATO

// --- ENTITIES & SECURITY ---
import { PlatformDeal } from './superadmin/entities/platform-deal.entity';
import { DeliveryTask } from './superadmin/entities/delivery-task.entity';
import { CalendarEvent } from './superadmin/entities/calendar-event.entity';
import { Invoice } from './superadmin/entities/invoice.entity';
import { Tenant } from './superadmin/entities/tenant.entity';
import { PassportModule } from '@nestjs/passport';
import { JwtModule } from '@nestjs/jwt';
import { JwtStrategy } from './auth/jwt.strategy';
import { TrafficGuard } from './traffic-control/traffic.guard';

// --- MIDDLEWARE ---
import { TenancyMiddleware } from './tenancy/tenancy.middleware';
import { AuthMiddleware } from './auth.middleware';
import { TenantModule } from './tenant/tenant.module';
import { FedericaNeroneModule } from './federicanerone/federicanerone.module';
import { BusinaroModule } from './businaro/businaro.module';

@Module({
  imports: [
    HealthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: false,
      envFilePath: path.join(__dirname, '..', '.env'),
    }),

    RedisModule,
    TelemetryModule,
    TrafficControlModule,
    TenancyModule,

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres' as const,
        url: cfg.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: false,
      }),
    }),

    TypeOrmModule.forFeature([
      PlatformDeal,
      DeliveryTask,
      CalendarEvent,
      Invoice,
      Tenant,
    ]),

    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => ({
        secret: configService.get<string>('JWT_SECRET') || 'SECRET_DA_CONFIGURARE',
        signOptions: { expiresIn: '1d' },
      }),
    }),

    MailModule,
    TenantModule,
    FedericaNeroneModule,
    BusinaroModule,
  ],

  controllers: [
    AppController,
    BloomController,
    TenantUsersController,
    AuthController,
    TenantAdminController,
    ProjectsController,
    FilesController,
    NotificationsTestController,
    AuthPasswordController,
    SuperadminAuditController,
    SuperadminUsersController,
    SecurityPolicyController,
    AuthMfaController,
    SuperadminDashboardController,
    DeliveryController,
    CalendarController,
    FinanceController,
    TenantsController,
    SystemController,
  ],

  providers: [
    SystemStatsService, // <--- ECCOLO! RIAGGIUNGI QUESTO
    AuthService,
    AuditService,
    LoginGuardService,
    FileStorageService,
    NotificationsService,
    ProjectsEventsService,
    TenantBootstrapService,
    AuthMfaService,
    JwtStrategy,
    SuperadminDashboardService,
    DeliveryService,
    CalendarService,
    FinanceService,
    TenantsService,
    {
      provide: APP_GUARD,
      useClass: TrafficGuard,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(TenancyMiddleware, AuthMiddleware)
      .exclude('api/superadmin/(.*)')
      .forRoutes('*');
  }
}