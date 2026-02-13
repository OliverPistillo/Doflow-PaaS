import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { RedisScriptManager } from '../redis/redis-script.manager';
import { TelemetryService } from '../telemetry/telemetry.service';
import { Request } from 'express';

@Injectable()
export class TrafficControlService {
  private readonly logger = new Logger(TrafficControlService.name);

  // Configurazioni Tier (in v4 saranno dinamiche dal DB)
  private readonly LIMIT = 200; 
  private readonly RATE = 20;

  constructor(
    private readonly redisScriptManager: RedisScriptManager,
    private readonly telemetryService: TelemetryService,
  ) {}

  async checkRequest(req: Request): Promise<{ allowed: boolean; remainingTokens: number; retryAfter?: number }> {
    let ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    if (Array.isArray(ip)) ip = ip[0];

    const tenantId = (req as any).tenant?.id || 'global';
    const rateLimitKey = `df:rl:${tenantId}:${ip}`;
    const now = Math.floor(Date.now() / 1000);

    try {
      // Esecuzione Script Lua Atomico
      const result = await this.redisScriptManager.executeScript(
        'traffic_guard',
        [rateLimitKey, 'df:security:blacklist', ''],
        [this.LIMIT, this.RATE, 1, now, 'IP', ip]
      ) as [number, number, string];

      const [status, remainingOrRetry, reason] = result;

      if (status !== 1) {
        // --- SHADOW LOGGING ASINCRONO ---
        // Registriamo il blocco su Redis senza aspettare il DB
        this.telemetryService.log({
          type: status === -1 ? 'SECURITY_BLACKLIST' : 'SECURITY_RATE_LIMIT',
          ip: String(ip),
          path: `${req.method} ${req.url}`,
          tenantId: String(tenantId),
          metadata: { reason }
        });

        if (status === -1) {
          throw new HttpException('IP Blocked by Security Policy', HttpStatus.FORBIDDEN);
        }

        return { allowed: false, remainingTokens: 0, retryAfter: remainingOrRetry };
      }

      return { allowed: true, remainingTokens: remainingOrRetry };
    } catch (error: unknown) {
      if (error instanceof HttpException) throw error;
      this.logger.error('Traffic Control Engine Error', error);
      return { allowed: true, remainingTokens: 1 }; // Fail-open
    }
  }
}