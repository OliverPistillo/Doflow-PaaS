import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';

import { SitebuilderJob } from './sitebuilder.entity';
import { SitebuilderController } from './sitebuilder.controller';
import { SitebuilderProducerService } from './sitebuilder.producer.service';
import { SitebuilderProcessor } from './sitebuilder.processor';

export const SITEBUILDER_QUEUE = 'sitebuilder';

@Module({
  imports: [
    // ── TypeORM ───────────────────────────────────────────────────────
    TypeOrmModule.forFeature([SitebuilderJob]),

    // ── BullMQ Queue ──────────────────────────────────────────────────
    // La connessione Redis è già definita in BullModule.forRootAsync
    // dentro AppModule — qui registriamo solo la coda con le sue opzioni.
    BullModule.registerQueue({
      name: SITEBUILDER_QUEUE,
      defaultJobOptions: {
        attempts: 4,
        backoff: {
          type: 'exponential',
          delay: 15_000, // 15 s → 30 s → 60 s → 120 s
        },
        removeOnComplete: { count: 100 },
        removeOnFail:     { count: 100 },
      },
    }),
  ],

  controllers: [SitebuilderController],

  providers: [
    SitebuilderProducerService,
    SitebuilderProcessor,
  ],

  exports: [SitebuilderProducerService],
})
export class SitebuilderModule {}