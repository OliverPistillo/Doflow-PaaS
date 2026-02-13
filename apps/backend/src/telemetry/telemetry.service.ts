import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

export type TelemetryEvent = {
  type: string;
  ip?: string | null;
  path?: string;
  tenantId?: string;
  timestamp?: string;
  metadata?: any;
};

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);
  private readonly SHADOW_LOG_KEY = 'df:telemetry:shadow_queue';

  constructor(private readonly redisService: RedisService) {}

  /**
   * Esegue lo Shadow Logging: spara l'evento su Redis e prosegue immediatamente.
   * Questo garantisce che il logging non blocchi mai l'esecuzione del business logic.
   */
  async log(event: TelemetryEvent) {
    const enriched: TelemetryEvent = {
      ...event,
      timestamp: event.timestamp ?? new Date().toISOString(),
    };

    // 1. Output su Console (per i log di Docker/Coolify)
    this.logger.log(`[EVENT:${enriched.type}] ${enriched.path} - ${enriched.tenantId}`);

    // 2. Shadow Logging su Redis (Coda asincrona)
    try {
      const client = this.redisService.getClient();
      await client.lpush(this.SHADOW_LOG_KEY, JSON.stringify(enriched));
      // Manteniamo la coda snella (ultimi 2000 eventi di sistema)
      await client.ltrim(this.SHADOW_LOG_KEY, 0, 1999);
    } catch (err) {
      this.logger.error('Shadow Logging failed to push to Redis', err);
    }
  }

  /**
   * Recupera i log dalla coda per la dashboard
   */
  async getRecentLogs(limit = 100): Promise<TelemetryEvent[]> {
    const client = this.redisService.getClient();
    const logs = await client.lrange(this.SHADOW_LOG_KEY, 0, limit - 1);
    return logs.map((l) => JSON.parse(l));
  }
}