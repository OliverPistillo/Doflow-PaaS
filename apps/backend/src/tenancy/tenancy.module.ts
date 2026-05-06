// apps/backend/src/tenancy/tenancy.module.ts
import { Module } from '@nestjs/common';
import { RedisModule } from '../redis/redis.module';
import { TenancyMiddleware } from './tenancy.middleware';
import { TenantBootstrapService } from './tenant-bootstrap.service';

@Module({
  imports: [RedisModule],
  providers: [TenancyMiddleware, TenantBootstrapService],
  exports: [TenancyMiddleware, TenantBootstrapService],
})
export class TenancyModule {}
