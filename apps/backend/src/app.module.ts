// apps/backend/src/app.module.ts
// AGGIORNAMENTO: Aggiunti QuoteRequest entity, controllers (pubblico + admin) e service

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
import { NotificationsModule } from './realtime/notifications.module';

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
import { MetricsController } from './superadmin/metrics.controller';
import { InvoicePdfService } from './superadmin/invoice-pdf.service';
import { PreventivoPdfService } from './superadmin/preventivo-pdf.service';
import { InvoiceMailService } from './superadmin/invoice-mail.service';
import { PublicSchemaBootstrapService } from './superadmin/public-schema-bootstrap.service';

// --- NUOVO: Richieste Preventivo (sito web → CRM) ---
import { PublicQuoteRequestController, AdminQuoteRequestController } from './superadmin/quote-request.controller';
import { QuoteRequestService } from './superadmin/quote-request.service';

// --- SERVIZI ---
import { AuthService } from './auth.service';
import { AuditService } from './audit.service';
import { LoginGuardService } from './login-guard.service';
import { FileStorageService } from './file-storage.service';
import { ProjectsEventsService } from './realtime/projects-events.service';
import { TenantBootstrapService } from './tenancy/tenant-bootstrap.service';
import { AuthMfaService } from './auth-mfa.service';
import { SystemStatsService } from './superadmin/telemetry.service';
import { MetricsService } from './superadmin/metrics.service';

// --- ENTITIES & SECURITY ---
import { PlatformDeal } from './superadmin/entities/platform-deal.entity';
import { DeliveryTask } from './superadmin/entities/delivery-task.entity';
import { CalendarEvent } from './superadmin/entities/calendar-event.entity';
import { Invoice } from './superadmin/entities/invoice.entity';
import { InvoiceLineItem } from './superadmin/entities/invoice-line-item.entity';
import { InvoiceTemplate } from './superadmin/entities/invoice-template.entity';
import { InvoiceClient } from './superadmin/entities/invoice-client.entity';
import { Tenant } from './superadmin/entities/tenant.entity';
import { QuoteRequest } from './superadmin/entities/quote-request.entity'; // <--- NUOVO
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

// --- Piattaforma odoo-style ---
import { PlatformModule } from './superadmin/entities/platform-module.entity';
import { TenantSubscription } from './superadmin/entities/tenant-subscription.entity';
import { TenantDashboardController } from './tenant/dashboard/tenant-dashboard.controller';
import { TenantDashboardService } from './tenant/dashboard/tenant-dashboard.service';

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
    NotificationsModule,

    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres' as const,
        url: cfg.get<string>('DATABASE_URL'),
        autoLoadEntities: true,
        synchronize: process.env.DB_SYNC === 'true',
      }),
    }),

    TypeOrmModule.forFeature([
      PlatformDeal,
      DeliveryTask,
      CalendarEvent,
      Invoice,
      InvoiceLineItem,
      InvoiceTemplate,
      InvoiceClient,
      Tenant,
      PlatformModule,
      TenantSubscription,
      QuoteRequest, // <--- NUOVA ENTITY
    ]),

    PassportModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const secret = configService.get<string>('JWT_SECRET');
        if (!secret) {
          throw new Error(
            '[AppModule] FATAL: JWT_SECRET is not set. ' +
            'Set it in your .env file before starting the server.',
          );
        }
        return {
          secret,
          signOptions: { expiresIn: '1d' },
        };
      },
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
    MetricsController,
    TenantDashboardController,
    // --- NUOVO: Controller pubblico e admin per richieste preventivo ---
    PublicQuoteRequestController,
    AdminQuoteRequestController,
  ],

  providers: [
    SystemStatsService,
    AuthService,
    AuditService,
    LoginGuardService,
    FileStorageService,
    ProjectsEventsService,
    TenantBootstrapService,
    AuthMfaService,
    JwtStrategy,
    SuperadminDashboardService,
    DeliveryService,
    CalendarService,
    FinanceService,
    InvoicePdfService,
    PreventivoPdfService,
    InvoiceMailService,
    TenantsService,
    MetricsService,
    TenantDashboardService,
    PublicSchemaBootstrapService,
    QuoteRequestService, // <--- NUOVO SERVICE
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
      // Escludiamo superadmin E le route pubbliche dal middleware tenant
      .exclude('api/superadmin/(.*)', 'api/public/(.*)')
      .forRoutes('*');
  }
}