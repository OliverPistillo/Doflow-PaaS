import { Injectable, Logger, HttpException, HttpStatus } from '@nestjs/common';
import { RedisScriptManager } from '../redis/redis-script.manager';
import { Request } from 'express';

interface TrafficCheckResult {
  allowed: boolean;
  remainingTokens: number;
  reason?: string;
  retryAfter?: number;
}

@Injectable()
export class TrafficControlService {
  private readonly logger = new Logger(TrafficControlService.name);

  // CONFIGURAZIONE BASE (In v4 sposteremo questo nel DB per ogni Tenant)
  private readonly GLOBAL_LIMIT = 200; // Burst capacity
  private readonly GLOBAL_RATE = 20;   // Tokens per secondo (refill)
  private readonly COST_PER_REQ = 1;

  constructor(private readonly redisScriptManager: RedisScriptManager) {}

  /**
   * Esegue il controllo del traffico per una richiesta specifica.
   */
  async checkRequest(req: Request): Promise<TrafficCheckResult> {
    // 1. Estrazione Sicura dell'IP (Fix per l'errore string | string[])
    let ip = req.headers['x-forwarded-for'] || req.ip || 'unknown';
    
    // Se x-forwarded-for è un array, prendiamo il primo elemento (client originale)
    if (Array.isArray(ip)) {
        ip = ip[0];
    }

    // Se il tenant è stato risolto dal middleware precedente, usalo. Altrimenti 'global'.
    const tenantId = (req as any).tenant?.id || 'global'; 
    
    // Costruzione Chiavi Redis
    const rateLimitKey = `df:rl:${tenantId}:${ip}`; // Rate limit per IP dentro al tenant
    const blacklistKey = `df:security:blacklist`;
    const bloomKey = `df:tenants:bloom`; // (Futuro uso)

    const now = Math.floor(Date.now() / 1000);

    try {
      // Chiamata atomica a Lua
      // Script signature: rate_limit_key, blacklist_key, bloom_key, burst, rate, cost, now, type, target
      const result = await this.redisScriptManager.executeScript(
        'traffic_guard',
        [rateLimitKey, blacklistKey, bloomKey],
        [
            this.GLOBAL_LIMIT, 
            this.GLOBAL_RATE, 
            this.COST_PER_REQ, 
            now, 
            'IP', 
            ip // Ora siamo sicuri che 'ip' è una stringa
        ]
      ) as [number, number, string];

      const [status, remainingOrRetry, reason] = result;

      if (status === 1) {
        return { allowed: true, remainingTokens: remainingOrRetry };
      } else if (status === -1) {
         // Blacklisted
         this.logger.warn(`⛔ BLOCKED BLACKLIST IP: ${ip}`);
         throw new HttpException('Access Denied by Security Policy', HttpStatus.FORBIDDEN);
      } else {
        // Rate Limited
        this.logger.warn(`⚠️ RATE LIMIT EXCEEDED IP: ${ip} (Tenant: ${tenantId})`);
        return { 
            allowed: false, 
            remainingTokens: 0, 
            retryAfter: remainingOrRetry,
            reason 
        };
      }

    } catch (error: unknown) { // Fix per l'errore 'unknown'
      if (error instanceof HttpException) throw error;
      
      const errorMessage = error instanceof Error ? error.message : 'Unknown Redis error';

      // Fail-open strategy: Se Redis cade, lasciamo passare il traffico per non bloccare il business (Emergency Mode)
      this.logger.error(`Redis Traffic Check Failed: ${errorMessage}. Allowing request.`);
      return { allowed: true, remainingTokens: 1 };
    }
  }
}