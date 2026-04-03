// apps/backend/src/sitebuilder/sitebuilder.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { SitebuilderJob } from './sitebuilder.entity';
import { SitebuilderController } from './sitebuilder.controller';
import { SitebuilderProducerService } from './sitebuilder.producer.service';
import { SitebuilderProcessor } from './sitebuilder.processor';
import { SITEBUILDER_QUEUE } from './sitebuilder.constants';

export { SITEBUILDER_QUEUE } from './sitebuilder.constants';

@Module({
  imports: [
    ConfigModule,                              // ← serve al Controller per leggere SITEBUILDER_DEPLOYMENTS_PATH
    TypeOrmModule.forFeature([SitebuilderJob]),
    BullModule.registerQueue({
      name: SITEBUILDER_QUEUE,
      defaultJobOptions: {
        attempts: 4,
        backoff: { type: 'exponential', delay: 15_000 },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 100 },
      },
    }),
  ],
  controllers: [SitebuilderController],
  providers: [SitebuilderProducerService, SitebuilderProcessor],
  exports: [SitebuilderProducerService],
})
export class SitebuilderModule {}