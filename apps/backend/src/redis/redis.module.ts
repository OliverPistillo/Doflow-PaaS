import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { RedisScriptManager } from './redis-script.manager';

@Global()
@Module({
  providers: [RedisService, RedisScriptManager],
  exports: [RedisService, RedisScriptManager],
})
export class RedisModule {}