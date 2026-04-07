// apps/backend/src/sitebuilder/sitebuilder.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { SiteBuilderController } from './sitebuilder.controller';
import { SiteExportController } from './site-export.controller';
import { AiGeneratorService } from './ai-generator.service';
import { SiteStorageService } from './site-storage.service';
import { SiteGenerationProducer } from './queue/site-generation.producer';
import { SiteGenerationProcessor } from './queue/site-generation.processor';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_EXPORT_SECRET || 'super-secret-export-key',
      signOptions: { expiresIn: '1h' },
    }),
    // Registriamo la coda per BullMQ
    BullModule.registerQueue({
      name: 'site-generation',
    }),
  ],
  controllers: [SiteBuilderController, SiteExportController],
  providers: [
    AiGeneratorService, 
    SiteStorageService,
    SiteGenerationProducer,
    SiteGenerationProcessor
  ],
})
export class SiteBuilderModule {}