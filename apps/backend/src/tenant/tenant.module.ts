import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { TenantController } from './tenant.controller';
import { TenantDashboardController } from './tenant-dashboard.controller';
import { TenantDashboardService } from './tenant-dashboard.service';
import { TenantSelfServiceController } from './tenant-selfservice.controller';
import { TenantCrmController } from './tenant-crm.controller';
import { TenantCrmService } from './tenant-crm.service';
import { TenantCommercialCoreController } from './tenant-commercial-core.controller';
import { TenantCommercialCoreService } from './tenant-commercial-core.service';
import { TenantCommercialAccessService } from './tenant-commercial-access.service';
import { TenantTimelineController } from './tenant-timeline.controller';
import { TenantTimelineService } from './tenant-timeline.service';
import { TenantRecordOperationsController } from './tenant-record-operations.controller';
import { TenantRecordOperationsService } from './tenant-record-operations.service';
import { TenantBriefingController } from './tenant-briefing.controller';
import { TenantBriefingService } from './tenant-briefing.service';
import { TenantQuotesController } from './tenant-quotes.controller';
import { TenantQuotesService } from './tenant-quotes.service';
import { TenantProjectsController } from './tenant-projects.controller';
import { TenantProjectsService } from './tenant-projects.service';
import { TenantDeliveryCoreController } from './tenant-delivery-core.controller';
import { TenantDeliveryCoreService } from './tenant-delivery-core.service';
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
import { TenantDoflowWorkspaceController } from './tenant-doflow-workspace.controller';
import { TenantDoflowWorkspaceService } from './tenant-doflow-workspace.service';
import { TenantDoflowCommerceController } from './tenant-doflow-commerce.controller';
import { TenantDoflowCommerceService } from './tenant-doflow-commerce.service';
import { TenantDoflowCollaborationController } from './tenant-doflow-collaboration.controller';
import { TenantDoflowCollaborationService } from './tenant-doflow-collaboration.service';
import { DOFLOW_COLLABORATION_OUTBOX_QUEUE } from './tenant-doflow-collaboration.service';
import { TenantDoflowCollaborationOutboxProcessor } from './tenant-doflow-collaboration-outbox.processor';
import { TenantDoflowDocumentRevenueController } from './tenant-doflow-document-revenue.controller';
import { TenantDoflowDocumentRevenueService } from './tenant-doflow-document-revenue.service';
import { DOFLOW_AUTOMATION_PERFORMANCE_QUEUE } from './tenant-automation-performance.constants';
import { TenantAutomationEngineService } from './tenant-automation-engine.service';
import { TenantAutomationPerformanceProcessor } from './tenant-automation-performance.processor';
import { TenantAutomationPerformanceDispatcher } from './tenant-automation-performance.dispatcher';
import { TenantDoflowPerformanceRuntimeService } from './tenant-doflow-performance-runtime.service';
import { TenantDoflowPerformanceController } from './tenant-doflow-performance.controller';
import { TenantDoflowPerformanceService } from './tenant-doflow-performance.service';
import { AuthModule } from '../auth/auth.module';
import { NotificationsModule } from '../realtime/notifications.module';
import { SalesIntelligenceModule } from '../sales-intelligence/sales-intelligence.module';
import { TenantConversationsController } from './tenant-conversations.controller';
import { TenantConversationsService } from './tenant-conversations.service';
import { TenantFlowboardsController } from './tenant-flowboards.controller';
import { TenantFlowboardsService } from './tenant-flowboards.service';
import { TenantPresenceController } from './tenant-presence.controller';
import { TenantPresenceService } from './tenant-presence.service';
import { TenantLivekitController } from './tenant-livekit.controller';
import { TenantLivekitService } from './tenant-livekit.service';
import { TenantCallsPublicController } from './tenant-calls-public.controller';
import { TenantCallsPublicService } from './tenant-calls-public.service';
import { TenantCallsFeatureService } from './tenant-calls-feature.service';
import { TenantCallsLivekitProviderService } from './tenant-calls-livekit-provider.service';
import { TenantCallsStoreService } from './tenant-calls-store.service';
import { TenantCallsSweeperService } from './tenant-calls-sweeper.service';
import { TenantBonusController } from './tenant-bonus.controller';
import { TenantBonusService } from './tenant-bonus.service';
import { TenantPreferencesController } from './tenant-preferences.controller';
import { TenantPreferencesService } from './tenant-preferences.service';
import { TenantReleasesController } from './tenant-releases.controller';
import { TenantReleasesService } from './tenant-releases.service';
import { TenantCompanyIntelligenceController } from './tenant-company-intelligence.controller';
import { TenantCompanyIntelligenceService } from './tenant-company-intelligence.service';
import { TenantUniversalScopeGuard } from './tenant-universal-scope.guard';
import { TenantUniversalCapabilitiesService } from './tenant-universal-capabilities.service';
import { TenantUniversalCapabilityGuard } from './tenant-universal-capability.guard';
import { TenantBackendContractsController } from './tenant-backend-contracts.controller';
import { TenantBackendContractsService } from './tenant-backend-contracts.service';
import { TenantCustomerInboxMailService } from './tenant-customer-inbox-mail.service';
import { TenantCalendarFeedController } from './tenant-calendar-feed.controller';

import { Tenant } from '../superadmin/entities/tenant.entity';
import { TenantSubscription } from '../superadmin/entities/tenant-subscription.entity';
import { PlatformModule } from '../superadmin/entities/platform-module.entity';
import { ChangelogEntry } from '../superadmin/entities/changelog-entry.entity';
import { PlatformNotification } from '../superadmin/entities/platform-notification.entity';
import { SupportTicket } from '../superadmin/entities/support-ticket.entity';

@Module({
  imports: [
    AuthModule,
    NotificationsModule,
    SalesIntelligenceModule,
    BullModule.registerQueue({ name: DOFLOW_COLLABORATION_OUTBOX_QUEUE }),
    BullModule.registerQueue({ name: DOFLOW_AUTOMATION_PERFORMANCE_QUEUE }),
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
    TenantCommercialCoreController,
    TenantTimelineController,
    TenantRecordOperationsController,
    TenantBriefingController,
    TenantQuotesController,
    TenantProjectsController,
    TenantDeliveryCoreController,
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
    TenantDoflowWorkspaceController,
    TenantDoflowCommerceController,
    TenantDoflowCollaborationController,
    TenantDoflowDocumentRevenueController,
    TenantDoflowPerformanceController,
    TenantConversationsController,
    TenantFlowboardsController,
    TenantPresenceController,
    TenantLivekitController,
    TenantCallsPublicController,
    TenantBonusController,
    TenantPreferencesController,
    TenantReleasesController,
    TenantCompanyIntelligenceController,
    TenantBackendContractsController,
    TenantCalendarFeedController,
  ],
  providers: [
    TenantDashboardService,
    TenantCrmService,
    TenantCommercialCoreService,
    TenantCommercialAccessService,
    TenantTimelineService,
    TenantRecordOperationsService,
    TenantBriefingService,
    TenantQuotesService,
    TenantProjectsService,
    TenantDeliveryCoreService,
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
      TenantDoflowWorkspaceService,
      TenantDoflowCommerceService,
      TenantDoflowCollaborationService,
      TenantDoflowCollaborationOutboxProcessor,
      TenantDoflowDocumentRevenueService,
      TenantAutomationEngineService,
      TenantAutomationPerformanceProcessor,
      TenantAutomationPerformanceDispatcher,
      TenantDoflowPerformanceRuntimeService,
      TenantDoflowPerformanceService,
      TenantConversationsService,
      TenantFlowboardsService,
      TenantPresenceService,
      TenantLivekitService,
      TenantCallsPublicService,
      TenantCallsFeatureService,
      TenantCallsLivekitProviderService,
      TenantCallsStoreService,
      TenantCallsSweeperService,
      TenantBonusService,
      TenantPreferencesService,
      TenantReleasesService,
      TenantCompanyIntelligenceService,
      TenantBackendContractsService,
      TenantCustomerInboxMailService,
      TenantUniversalScopeGuard,
      TenantUniversalCapabilitiesService,
      TenantUniversalCapabilityGuard,
  ],
  exports: [TenantTeamService],
})
export class TenantModule {}
