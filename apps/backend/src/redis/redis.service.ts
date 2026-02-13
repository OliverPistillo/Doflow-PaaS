import { Injectable, OnModuleDestroy, Logger } from '@nestjs/common';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private client: Redis;
  private readonly logger = new Logger(RedisService.name);

  constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST,
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        // Strategia di riconnessione "Exponential Backoff" limitata
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('connect', () => this.logger.log('🔌 Redis Connected'));
    this.client.on('error', (err) => this.logger.error('Redis Error', err));
  }

  // --- CORE METHODS ---

  getClient(): Redis {
    return this.client;
  }

  async ping(): Promise<{ pong: string; latency_ms: number }> {
    const t0 = Date.now();
    const pong = await this.client.ping();
    return { pong, latency_ms: Date.now() - t0 };
  }

  async get(key: string): Promise<string | null> {
    return await this.client.get(key);
  }

  async set(key: string, value: string, ttlSeconds?: number) {
    if (ttlSeconds) {
      return await this.client.set(key, value, 'EX', ttlSeconds);
    }
    return await this.client.set(key, value);
  }

  async del(key: string) {
    return await this.client.del(key);
  }
  
  // --- LEGACY SUPPORT (Compatibilità con il tuo codice precedente) ---
  // In futuro, sposta la logica di 'dual_probe' dentro RedisScriptManager.executeScript('dual_probe', ...)
  // Questo metodo ora è un wrapper diretto per evitare rotture immediate.
  async evalShaDirect(sha: string, keys: string[], args: string[]) {
      return await this.client.evalsha(sha, keys.length, ...keys, ...args);
  }

  onModuleDestroy() {
    this.client.disconnect();
    this.logger.log('🔌 Redis Disconnected');
  }
}