// apps/backend/src/tenancy/tenancy.module.ts
import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { TenancyMiddleware } from './tenancy.middleware';

@Module({
  imports: [RedisModule],
  providers: [TenancyMiddleware],
  exports: [TenancyMiddleware],
})
export class TenancyModule {}
