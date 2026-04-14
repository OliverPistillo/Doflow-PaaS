// apps/backend/src/app.module.ts
// AGGIORNAMENTO: Aggiunti QuoteRequest entity, controllers (pubblico + admin) e service
// AGGIORNAMENTO: Aggiunto SalesIntelligenceModule con entità e variabili Apollo.io

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

// --- NUOVI MODULI SUPERADMIN ---
import { ModulesController } from './superadmin/modules.controller';
import { ModulesService } from './superadmin/modules.service';
import { SubscriptionsController } from './superadmin/subscriptions.controller';
import { SubscriptionsService } from './superadmin/subscriptions.service';
import { LeadsController } from './superadmin/leads.controller';
import { LeadsService } from './superadmin/leads.service';
import { BackupController } from './superadmin/backup.controller';
import { BackupService } from './superadmin/backup.service';
import { Lead } from './superadmin/entities/lead.entity';
import { SystemBackup } from './superadmin/entities/system-backup.entity';

// --- NUOVI MODULI SUPERADMIN (Batch 2: Notifiche, Ticket, API Usage) ---
import { PlatformNotificationsController } from './superadmin/platform-notifications.controller';
import { PlatformNotificationsService } from './superadmin/platform-notifications.service';
import { TicketsController } from './superadmin/tickets.controller';
import { TicketsService } from './superadmin/tickets.service';
import { ApiUsageController } from './superadmin/api-usage.controller';
import { ApiUsageService } from './superadmin/api-usage.service';
import { PlatformNotification } from './superadmin/entities/platform-notification.entity';
import { SupportTicket } from './superadmin/entities/support-ticket.entity';

// --- NUOVI MODULI SUPERADMIN (Batch 3: Email Templates, Changelog, Automations) ---
import { EmailTemplatesController } from './superadmin/email-templates.controller';
import { EmailTemplatesService } from './superadmin/email-templates.service';
import { ChangelogAdminController, ChangelogPublicController } from './superadmin/changelog.controller';
import { ChangelogService } from './superadmin/changelog.service';
import { AutomationsController } from './superadmin/automations.controller';
import { AutomationsService } from './superadmin/automations.service';
import { EmailTemplate } from './superadmin/entities/email-template.entity';
import { ChangelogEntry } from './superadmin/entities/changelog-entry.entity';
import { AutomationRule } from './superadmin/entities/automation-rule.entity';
import { TenantSelfServiceController } from './tenant/tenant-selfservice.controller';
import { ScheduleModule } from '@nestjs/schedule';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerModule } from '@nestjs/throttler';
import { AutomationEventBus } from './superadmin/automation-event-bus';
import { AutomationCronService } from './superadmin/automation-cron.service';
import { ExportController } from './superadmin/export.controller';
import { ExportService } from './superadmin/export.service';
import { BackupSchedule } from './superadmin/entities/backup-schedule.entity';

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
import { SavedService } from './superadmin/entities/saved-service.entity';
import { Tenant } from './superadmin/entities/tenant.entity';
import { QuoteRequest } from './superadmin/entities/quote-request.entity';
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

// --- SITEBUILDER (WordPress AI) ---
import { SiteBuilderModule } from './sitebuilder/sitebuilder.module';
import { BullModule } from '@nestjs/bullmq';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';

// --- Piattaforma odoo-style ---
import { PlatformModule } from './superadmin/entities/platform-module.entity';
import { TenantSubscription } from './superadmin/entities/tenant-subscription.entity';
import { TenantDashboardController } from './tenant/dashboard/tenant-dashboard.controller';
import { TenantDashboardService } from './tenant/dashboard/tenant-dashboard.service';

// --- SALES INTELLIGENCE (AI B2B Outreach) ---
import { SalesIntelligenceModule } from './sales-intelligence/sales-intelligence.module';
import { CompanyIntel }     from './sales-intelligence/entities/company-intel.entity';
import { Prospect }         from './sales-intelligence/entities/prospect.entity';
import { ResearchData }     from './sales-intelligence/entities/research-data.entity';
import { OutreachCampaign } from './sales-intelligence/entities/outreach-campaign.entity';

@Module({
  imports: [
    HealthModule,
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: false,
      envFilePath: path.join(__dirname, '..', '.env'),
    }),

    ServeStaticModule.forRoot({
      rootPath: join(process.cwd(), 'apps', 'backend', 'public'),
      serveRoot: '/public',
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
      SavedService,
      Tenant,
      PlatformModule,
      TenantSubscription,
      QuoteRequest,
      Lead,
      SystemBackup,
      PlatformNotification,
      SupportTicket,
      EmailTemplate,
      ChangelogEntry,
      AutomationRule,
      BackupSchedule,
      // --- Sales Intelligence entities ---
      CompanyIntel,
      Prospect,
      ResearchData,
      OutreachCampaign,
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
    ScheduleModule.forRoot(),
    EventEmitterModule.forRoot(),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 20 }]),
    FedericaNeroneModule,
    BusinaroModule,

    // --- BULLMQ ROOT (connessione Redis condivisa per tutte le code) ---
    BullModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        connection: {
          host:     cfg.get<string>('REDIS_HOST', 'localhost'),
          port:     cfg.get<number>('REDIS_PORT', 6379),
          password: cfg.get<string>('REDIS_PASSWORD'),
        },
      }),
    }),

    // --- FEATURE MODULES ---
    SiteBuilderModule,
    SalesIntelligenceModule,
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
    PublicQuoteRequestController,
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
    ChangelogPublicController,
    AutomationsController,
    TenantSelfServiceController,
    ExportController,
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
    QuoteRequestService,
    ModulesService,
    SubscriptionsService,
    LeadsService,
    BackupService,
    PlatformNotificationsService,
    TicketsService,
    ApiUsageService,
    EmailTemplatesService,
    ChangelogService,
    AutomationsService,
    AutomationEventBus,
    AutomationCronService,
    ExportService,
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
      .exclude('api/superadmin/(.*)', 'api/public/(.*)', 'api/tenant/self-service/(.*)')
      .forRoutes('*');
  }
}