import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantController } from './tenant.controller';
import { TenantDashboardController } from './tenant-dashboard.controller';
import { TenantDashboardService } from './tenant-dashboard.service';
import { TenantSelfServiceController } from './tenant-selfservice.controller';
import { TenantCrmController } from './tenant-crm.controller';
import { TenantCrmService } from './tenant-crm.service';
import { TenantBriefingController } from './tenant-briefing.controller';
import { TenantBriefingService } from './tenant-briefing.service';
import { TenantQuotesController } from './tenant-quotes.controller';
import { TenantQuotesService } from './tenant-quotes.service';
import { TenantProjectsController } from './tenant-projects.controller';
import { TenantProjectsService } from './tenant-projects.service';
import { TenantFinanceController } from './tenant-finance.controller';
import { TenantFinanceService } from './tenant-finance.service';
import { TenantNotificationsController } from './tenant-notifications.controller';
import { TenantNotificationsService } from './tenant-notifications.service';
import { TenantDocumentsController } from './tenant-documents.controller';
import { TenantDocumentsService } from './tenant-documents.service';
import { TenantTeamController } from './tenant-team.controller';
import { TenantTeamService } from './tenant-team.service';
import { TenantReportsController } from './tenant-reports.controller';
import { TenantReportsService } from './tenant-reports.service';
import { TenantContractsController } from './tenant-contracts.controller';
import { TenantPaperworkController } from './tenant-paperwork.controller';
import { TenantContractsService } from './tenant-contracts.service';
import { TenantAutomationsController } from './tenant-automations.controller';
import { TenantAutomationsService } from './tenant-automations.service';
import { TenantCalendarController } from './tenant-calendar.controller';
import { TenantCalendarService } from './tenant-calendar.service';
import { TenantKnowledgeController } from './tenant-knowledge.controller';
import { TenantKnowledgeService } from './tenant-knowledge.service';
import { TenantCredentialsController } from './tenant-credentials.controller';
import { TenantCredentialsService } from './tenant-credentials.service';
import { TenantCredentialsCryptoService } from './tenant-credentials-crypto.service';
import { TenantCredentialsPermissionsService } from './tenant-credentials-permissions.service';
import { TenantCredentialsSchedulerService } from './tenant-credentials-scheduler.service';
import { TenantEffectivePermissionsService } from './tenant-effective-permissions.service';
import { FileStorageService } from '../file-storage.service';

import { Tenant } from '../superadmin/entities/tenant.entity';
import { TenantSubscription } from '../superadmin/entities/tenant-subscription.entity';
import { PlatformModule } from '../superadmin/entities/platform-module.entity';
import { ChangelogEntry } from '../superadmin/entities/changelog-entry.entity';
import { PlatformNotification } from '../superadmin/entities/platform-notification.entity';
import { SupportTicket } from '../superadmin/entities/support-ticket.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Tenant,
      TenantSubscription,
      PlatformModule,
      ChangelogEntry,
      PlatformNotification,
      SupportTicket,
    ])
  ],
  controllers: [
    TenantController,
    TenantDashboardController,
    TenantSelfServiceController,
    TenantCrmController,
    TenantBriefingController,
    TenantQuotesController,
    TenantProjectsController,
    TenantFinanceController,
    TenantNotificationsController,
    TenantDocumentsController,
    TenantTeamController,
    TenantReportsController,
    TenantContractsController,
    TenantPaperworkController,
    TenantAutomationsController,
    TenantCalendarController,
    TenantKnowledgeController,
    TenantCredentialsController,
  ],
  providers: [
    TenantDashboardService,
    TenantCrmService,
    TenantBriefingService,
    TenantQuotesService,
    TenantProjectsService,
    TenantFinanceService,
    TenantNotificationsService,
    TenantDocumentsService,
    TenantTeamService,
    TenantReportsService,
    TenantContractsService,
    TenantAutomationsService,
    TenantCalendarService,
    TenantKnowledgeService,
    TenantCredentialsService,
    TenantCredentialsCryptoService,
    TenantCredentialsPermissionsService,
    TenantCredentialsSchedulerService,
    TenantEffectivePermissionsService,
    FileStorageService,
  ],
})
export class TenantModule {}
