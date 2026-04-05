import { Controller, Get, Query, HttpException, HttpStatus } from '@nestjs/common';
import { RedisScriptManager } from './redis/redis-script.manager'; 

@Controller('bloom')
export class BloomController {
  constructor(private readonly redisScriptManager: RedisScriptManager) {}

  // GET /bloom/test?key=login&item=utente1
  @Get('test')
  async test(
    @Query('key') key: string,
    @Query('item') item: string,
  ) {
    if (!key || !item) {
        throw new HttpException('Missing key or item', HttpStatus.BAD_REQUEST);
    }

    const currentKey = `doflow:bf:${key}:current`;
    const prevKey = `doflow:bf:${key}:prev`;
    const ttlSeconds = 3600;

    try {
        const result = await this.redisScriptManager.executeScript(
            'dual_probe', 
            [currentKey, prevKey], 
            [item, ttlSeconds]
        );

        return {
            status: 'ok',
            key,
            item,
            alreadySeen: result === 1, 
            backend_version: 'v3.5-redis-guard'
        };
    } catch (e: unknown) {
        const message = e instanceof Error ? e.message : 'Unknown script execution error';
        return {
            status: 'error',
            message: message
        };
    }
  }
}