import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { SiteGenController } from './sitegen.controller';
import { SiteExportController } from './site-export.controller';
import { ManifestGeneratorService } from './manifest-generator.service';
import { ExportStoreService } from './storage/export-store.service';
import { SiteGenerationProducer } from './queue/site-generation.producer';
import { SiteGenerationProcessor } from './queue/site-generation.processor';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_EXPORT_SECRET || 'super-secret-export-key',
      signOptions: { expiresIn: '1h' },
    }),
    BullModule.registerQueue({
      name: 'site-generation',
    }),
  ],
  controllers: [SiteGenController, SiteExportController],
  providers: [
    ManifestGeneratorService,
    ExportStoreService,
    SiteGenerationProducer,
    SiteGenerationProcessor,
  ],
  exports: [ManifestGeneratorService, ExportStoreService],
})
export class SiteGenModule {}
