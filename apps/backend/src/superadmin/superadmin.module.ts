// apps/backend/src/superadmin/superadmin.module.ts
// Raggruppa tutti i controller e service del pannello superadmin.
// Dipende da AuthModule (per AuditService) e MailModule.

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { AuthModule } from '../auth/auth.module';
import { MailModule } from '../mail/mail.module';
import { TenancyModule } from '../tenancy/tenancy.module';

// ── Controllers ──────────────────────────────────────────────────────────────
import { SuperadminUsersController } from './superadmin-users.controller';
import { SecurityPolicyController } from './security-policy.controller';
import { SuperadminDashboardController } from './superadmin-dashboard.controller';
import { DeliveryController } from './delivery.controller';
import { CalendarController } from './calendar.controller';
import { FinanceController } from './finance.controller';
import { TenantsController } from './tenants.controller';
import { SystemController } from './system.controller';
import { MetricsController } from './metrics.controller';
import { PublicQuoteRequestController, AdminQuoteRequestController } from './quote-request.controller';
import { ModulesController } from './modules.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { LeadsController } from './leads.controller';
import { BackupController } from './backup.controller';
import { PlatformNotificationsController } from './platform-notifications.controller';
import { TicketsController } from './tickets.controller';
import { ApiUsageController } from './api-usage.controller';
import { EmailTemplatesController } from './email-templates.controller';
import { ChangelogAdminController, ChangelogPublicController } from './changelog.controller';
import { AutomationsController } from './automations.controller';
import { ExportController } from './export.controller';

// ── Services ─────────────────────────────────────────────────────────────────
import { SuperadminDashboardService } from './superadmin-dashboard.service';
import { DeliveryService } from './delivery.service';
import { CalendarService } from './calendar.service';
import { FinanceService } from './finance.service';
import { TenantsService } from './tenants.service';
import { InvoicePdfService } from './invoice-pdf.service';
import { PreventivoPdfService } from './preventivo-pdf.service';
import { InvoiceMailService } from './invoice-mail.service';
import { PublicSchemaBootstrapService } from './public-schema-bootstrap.service';
import { QuoteRequestService } from './quote-request.service';
import { ModulesService } from './modules.service';
import { SubscriptionsService } from './subscriptions.service';
import { LeadsService } from './leads.service';
import { BackupService } from './backup.service';
import { PlatformNotificationsService } from './platform-notifications.service';
import { TicketsService } from './tickets.service';
import { ApiUsageService } from './api-usage.service';
import { EmailTemplatesService } from './email-templates.service';
import { ChangelogService } from './changelog.service';
import { AutomationsService } from './automations.service';
import { AutomationEventBus } from './automation-event-bus';
import { AutomationCronService } from './automation-cron.service';
import { ExportService } from './export.service';
import { SystemStatsService } from './telemetry.service';
import { MetricsService } from './metrics.service';

// ── Entities ─────────────────────────────────────────────────────────────────
import { PlatformDeal } from './entities/platform-deal.entity';
import { DeliveryTask } from './entities/delivery-task.entity';
import { CalendarEvent } from './entities/calendar-event.entity';
import { Invoice } from './entities/invoice.entity';
import { InvoiceLineItem } from './entities/invoice-line-item.entity';
import { InvoiceTemplate } from './entities/invoice-template.entity';
import { InvoiceClient } from './entities/invoice-client.entity';
import { SavedService } from './entities/saved-service.entity';
import { Tenant } from './entities/tenant.entity';
import { PlatformModule } from './entities/platform-module.entity';
import { TenantSubscription } from './entities/tenant-subscription.entity';
import { QuoteRequest } from './entities/quote-request.entity';
import { Lead } from './entities/lead.entity';
import { SystemBackup } from './entities/system-backup.entity';
import { PlatformNotification } from './entities/platform-notification.entity';
import { SupportTicket } from './entities/support-ticket.entity';
import { EmailTemplate } from './entities/email-template.entity';
import { ChangelogEntry } from './entities/changelog-entry.entity';
import { AutomationRule } from './entities/automation-rule.entity';
import { BackupSchedule } from './entities/backup-schedule.entity';

@Module({
  imports: [
    AuthModule,
    MailModule,
    TenancyModule,
    TypeOrmModule.forFeature([
      PlatformDeal,
      DeliveryTask,
      CalendarEvent,
      Invoice, InvoiceLineItem, InvoiceTemplate, InvoiceClient, SavedService,
      Tenant, PlatformModule, TenantSubscription,
      QuoteRequest,
      Lead, SystemBackup,
      PlatformNotification, SupportTicket,
      EmailTemplate, ChangelogEntry, AutomationRule, BackupSchedule,
    ]),
  ],

  controllers: [
    SuperadminUsersController,
    SecurityPolicyController,
    SuperadminDashboardController,
    DeliveryController,
    CalendarController,
    FinanceController,
    TenantsController,
    SystemController,
    MetricsController,
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
    ExportController,
  ],

  providers: [
    SuperadminDashboardService,
    DeliveryService,
    CalendarService,
    FinanceService,
    TenantsService,
    InvoicePdfService,
    PreventivoPdfService,
    InvoiceMailService,
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
    SystemStatsService,
    MetricsService,
  ],

  exports: [TenantsService, ModulesService, SubscriptionsService],
})
export class SuperadminModule {}
