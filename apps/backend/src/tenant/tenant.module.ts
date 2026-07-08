import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TenantController } from './tenant.controller';
import { TenantDashboardController } from './tenant-dashboard.controller';
import { TenantDashboardService } from './tenant-dashboard.service';
import { TenantSelfServiceController } from './tenant-selfservice.controller';
import { TenantCrmController } from './tenant-crm.controller';
import { TenantCrmService } from './tenant-crm.service';

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
  controllers: [TenantController, TenantDashboardController, TenantSelfServiceController, TenantCrmController],
  providers: [TenantDashboardService, TenantCrmService],
})
export class TenantModule {}
