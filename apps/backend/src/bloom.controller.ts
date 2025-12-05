// apps/backend/src/bloom.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { RedisService } from './redis/redis.service';

@Controller('bloom')
export class BloomController {
  constructor(private readonly redisService: RedisService) {}

  // GET /bloom/test?key=login&item=utente1
  @Get('test')
  async test(
    @Query('key') key: string,
    @Query('item') item: string,
  ) {
    const exists = await this.redisService.checkAndAdd(key, item, 3600);

    return {
      status: 'ok',
      key,
      item,
      alreadySeen: exists, // true se era già presente, false se nuovo
    };
  }
}
