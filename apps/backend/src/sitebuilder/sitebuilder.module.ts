// apps/backend/src/sitebuilder/sitebuilder.module.ts

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { SitebuilderJob } from './sitebuilder.entity';
import { SitebuilderController } from './sitebuilder.controller';
import { SitebuilderProducerService } from './sitebuilder.producer.service';
import { SitebuilderProcessor } from './sitebuilder.processor';

// ─────────────────────────────────────────────
//  Costanti di configurazione della coda
// ─────────────────────────────────────────────
export const SITEBUILDER_QUEUE = 'sitebuilder';

@Module({
  imports: [
    // ── TypeORM ───────────────────────────────
    // Registra l'entità nel DataSource condiviso (quello definito in AppModule).
    // Usa forFeature per iniettare il Repository<SitebuilderJob> nei service.
    TypeOrmModule.forFeature([SitebuilderJob]),

    // ── BullMQ Queue ──────────────────────────
    // forRootAsync viene già configurato in AppModule (o un BullModule root shared).
    // Qui registriamo solo la coda specifica con le sue opzioni di default.
    BullModule.registerQueueAsync({
      name: SITEBUILDER_QUEUE,
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: {
          host: config.get<string>('REDIS_HOST', 'localhost'),
          port: config.get<number>('REDIS_PORT', 6379),
          password: config.get<string>('REDIS_PASSWORD'),
        },
        defaultJobOptions: {
          // ── Retry con backoff esponenziale ────
          attempts: 4,
          backoff: {
            type: 'exponential',
            delay: 15_000, // 15 s → 30 s → 60 s → 120 s
          },
          // Mantieni i job completati/falliti per audit (max 100)
          removeOnComplete: { count: 100 },
          removeOnFail: { count: 100 },
        },
      }),
    }),
  ],

  controllers: [SitebuilderController],

  providers: [
    SitebuilderProducerService,
    SitebuilderProcessor,
  ],

  // Esporta il service se altri moduli devono accodare job (opzionale)
  exports: [SitebuilderProducerService],
})
export class SitebuilderModule {}

// ─────────────────────────────────────────────
//  NOTA per app.module.ts
// ─────────────────────────────────────────────
// 1. Aggiungere SitebuilderJob all'array `entities` della configurazione
//    TypeOrmModule.forRootAsync in AppModule:
//
//      entities: [...esistenti, SitebuilderJob],
//
// 2. Aggiungere SitebuilderModule all'array `imports` di AppModule:
//
//      imports: [...esistenti, SitebuilderModule],
//
// 3. Aggiungere la migration SQL (o abilitare DB_SYNC solo in dev):
//
//      CREATE TYPE public.sitebuilder_jobs_status_enum
//        AS ENUM ('PENDING','RUNNING','DONE','FAILED','ROLLED_BACK');
//
//      CREATE TABLE public.sitebuilder_jobs (
//        id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
//        tenant_id      VARCHAR NOT NULL,
//        site_domain    VARCHAR NOT NULL,
//        site_title     VARCHAR NOT NULL,
//        admin_email    VARCHAR NOT NULL,
//        content_topics TEXT[]  NOT NULL DEFAULT '{}',
//        locale         VARCHAR NOT NULL DEFAULT 'it',
//        status         public.sitebuilder_jobs_status_enum NOT NULL DEFAULT 'PENDING',
//        logs           JSONB   NOT NULL DEFAULT '[]',
//        attempt_count  INTEGER NOT NULL DEFAULT 0,
//        site_url       VARCHAR,
//        created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
//        updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
//      );
//      CREATE INDEX idx_sbj_status    ON public.sitebuilder_jobs(status);
//      CREATE INDEX idx_sbj_tenant_id ON public.sitebuilder_jobs(tenant_id);
//
// 4. Installare le dipendenze mancanti:
//      pnpm --filter backend add @nestjs/bullmq bullmq @anthropic-ai/sdk