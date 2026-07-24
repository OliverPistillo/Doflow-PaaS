// apps/backend/src/sales-intelligence/sales-intelligence.module.ts
//
// INTEGRAZIONE IN app.module.ts:
// 1. Aggiungi l'import:  import { SalesIntelligenceModule } from './sales-intelligence/sales-intelligence.module';
// 2. Aggiungilo all'array imports[] di AppModule
// 3. Aggiungi le entity a TypeOrmModule.forRootAsync → entities: [..., CompanyIntel, Prospect, ResearchData, OutreachCampaign]
//
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { TypeOrmModule } from '@nestjs/typeorm';

import { SalesIntelligenceController } from './sales-intelligence.controller';
import { SalesIntelProducer, SALES_INTEL_QUEUE } from './queue/sales-intel.producer';
import { SalesIntelProcessor } from './queue/sales-intel.processor';

import { EnrichmentService } from './workers/enrichment.service';
import { ResearchService } from './workers/research.service';
import { StrategicAnalysisService } from './workers/strategic-analysis.service';
import { OutreachGeneratorService } from './workers/outreach-generator.service';

import { CompanyIntel } from './entities/company-intel.entity';
import { Prospect } from './entities/prospect.entity';
import { ResearchData } from './entities/research-data.entity';
import { OutreachCampaign } from './entities/outreach-campaign.entity';

// NotificationsModule è già globale in app.module.ts — importiamo solo il service
import { NotificationsModule } from '../realtime/notifications.module';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [
    // Coda BullMQ — riusa la connessione Redis già configurata in BullModule.forRootAsync()
    BullModule.registerQueue({
      name: SALES_INTEL_QUEUE,
    }),

    // Entità del modulo
    TypeOrmModule.forFeature([
      CompanyIntel,
      Prospect,
      ResearchData,
      OutreachCampaign,
    ]),

    // Deps condivisi già in app.module.ts
    NotificationsModule,
    RedisModule,
  ],
  controllers: [SalesIntelligenceController],
  providers: [
    SalesIntelProducer,
    SalesIntelProcessor,
    EnrichmentService,
    ResearchService,
    StrategicAnalysisService,
    OutreachGeneratorService,
  ],
  exports: [SalesIntelProducer],
})
export class SalesIntelligenceModule {}
