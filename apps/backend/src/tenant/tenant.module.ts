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
import { TenantSiteProposalsController } from './tenant-site-proposals.controller';
import { TenantSiteProposalsService } from './tenant-site-proposals.service';
import { TenantSiteProposalsCsvService } from './tenant-site-proposals-csv.service';
import { TenantSiteProposalsTemplateService } from './tenant-site-proposals-template.service';
import { TenantSiteProposalsArtifactService } from './tenant-site-proposals-artifact.service';
import { TenantSiteProposalsDoflowGuard } from './tenant-site-proposals-doflow.guard';
import { FileStorageService } from '../file-storage.service';
import { TenantSiteProposalsWebsiteFetcherService } from './tenant-site-proposals-website-fetcher.service';
import { TenantSiteProposalsWebsiteExtractorService } from './tenant-site-proposals-website-extractor.service';
import { TenantSiteProposalsBrandService } from './tenant-site-proposals-brand.service';
import { TenantSiteProposalsAiService } from './tenant-site-proposals-ai.service';
import { TenantSiteProposalsPersonalizationService } from './tenant-site-proposals-personalization.service';
import { TenantSiteProposalsImageService } from './tenant-site-proposals-image.service';
import { SITE_PROPOSAL_PREPARATION_QUEUE } from './tenant-site-proposals.constants';
import { TenantSiteProposalsThemePackageService } from './tenant-site-proposals-theme-package.service';
import { TenantSiteProposalsThemeCompilerService } from './tenant-site-proposals-theme-compiler.service';
import { TenantSiteProposalsThemeService } from './tenant-site-proposals-theme.service';
import { TenantSiteProposalsGenerationCoreService } from './tenant-site-proposals-generation-core.service';
import { TenantSiteProposalsPreparationCoreService } from './tenant-site-proposals-preparation-core.service';
import { TenantSiteProposalsPreparationQueueService } from './tenant-site-proposals-preparation-queue.service';
import { TenantSiteProposalsPreparationWorker } from './tenant-site-proposals-preparation.worker';
import { TenantSiteProposalsThemeStorageCleanupService } from './tenant-site-proposals-theme-storage-cleanup.service';
import { TenantSiteProposalsLogoGeneratorService } from './tenant-site-proposals-logo-generator.service';
import { TenantSiteProposalsPreparationProgressService } from './tenant-site-proposals-preparation-progress.service';
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

import { Tenant } from '../superadmin/entities/tenant.entity';
import { TenantSubscription } from '../superadmin/entities/tenant-subscription.entity';
import { PlatformModule } from '../superadmin/entities/platform-module.entity';
import { ChangelogEntry } from '../superadmin/entities/changelog-entry.entity';
import { PlatformNotification } from '../superadmin/entities/platform-notification.entity';
import { SupportTicket } from '../superadmin/entities/support-ticket.entity';

@Module({
  imports: [
    BullModule.registerQueue({ name: SITE_PROPOSAL_PREPARATION_QUEUE }),
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
    TenantSiteProposalsController,
    TenantDoflowWorkspaceController,
    TenantDoflowCommerceController,
    TenantDoflowCollaborationController,
    TenantDoflowDocumentRevenueController,
    TenantDoflowPerformanceController,
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
    TenantSiteProposalsService,
    TenantSiteProposalsCsvService,
    TenantSiteProposalsTemplateService,
    TenantSiteProposalsArtifactService,
    TenantSiteProposalsDoflowGuard,
    FileStorageService,
    TenantSiteProposalsWebsiteFetcherService,
    TenantSiteProposalsWebsiteExtractorService,
    TenantSiteProposalsBrandService,
    TenantSiteProposalsImageService,
    TenantSiteProposalsAiService,
    TenantSiteProposalsPersonalizationService,
    TenantSiteProposalsThemePackageService,
    TenantSiteProposalsThemeCompilerService,
    TenantSiteProposalsThemeService,
    TenantSiteProposalsGenerationCoreService,
    TenantSiteProposalsPreparationCoreService,
    TenantSiteProposalsPreparationQueueService,
    TenantSiteProposalsPreparationWorker,
    TenantSiteProposalsThemeStorageCleanupService,
      TenantSiteProposalsLogoGeneratorService,
      TenantSiteProposalsPreparationProgressService,
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
  ],
})
export class TenantModule {}
