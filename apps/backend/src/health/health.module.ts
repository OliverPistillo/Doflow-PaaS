// apps/backend/src/health/health.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HealthController } from './health.controller';
import { HealthService } from './health.service';
import { RedisService } from '../redis/redis.service';
import { FileStorageService } from '../file-storage.service';

@Module({
  imports: [
    // così DataSource è garantito disponibile qui
    TypeOrmModule.forFeature([]),
  ],
  controllers: [HealthController],
  providers: [
    HealthService,
    RedisService,
    FileStorageService,
  ],
})
export class HealthModule {}
