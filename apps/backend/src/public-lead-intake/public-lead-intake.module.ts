import { Module } from '@nestjs/common';
import { PublicLeadIntakeController } from './public-lead-intake.controller';
import { PublicLeadIntakeService } from './public-lead-intake.service';
import { TenantNotificationsService } from '../tenant/tenant-notifications.service';

@Module({
  controllers: [PublicLeadIntakeController],
  providers: [PublicLeadIntakeService, TenantNotificationsService],
})
export class PublicLeadIntakeModule {}
