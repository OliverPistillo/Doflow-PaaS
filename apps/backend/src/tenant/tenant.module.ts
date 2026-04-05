import { Module } from '@nestjs/common';
import { TenantController } from './tenant.controller';
import { TenantDashboardController } from './tenant-dashboard.controller';
import { TenantDashboardService } from './tenant-dashboard.service';

@Module({
  controllers: [TenantController, TenantDashboardController],
  providers: [TenantDashboardService],
})
export class TenantModule {}
