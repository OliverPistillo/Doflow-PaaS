import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from './redis/redis.service';

const MAX_FAILS     = 5;    // tentativi falliti prima del blocco
const WINDOW_SEC    = 300;  // finestra di osservazione: 5 minuti
const BLOCK_TTL_SEC = 3600; // durata blocco: 1 ora

@Injectable()
export class LoginGuardService {
  private readonly logger = new Logger(LoginGuardService.name);

  constructor(private readonly redisService: RedisService) {}

  // Chiave Redis per il contatore fallimenti: email|ip
  private getKey(req: Request, email: string): string {
    const ip =
      (req.ip as string | undefined) ??
      (req.headers['x-forwarded-for'] as string | undefined)
        ?.split(',')[0]
        ?.trim() ??
      'unknown';
    return `df:login:fails:${email.toLowerCase()}|${ip}`;
  }

  private getBlockKey(req: Request, email: string): string {
    return `df:login:blocked:${this.getKey(req, email)}`;
  }

  /**
   * Verifica se l'identità è bloccata per troppi tentativi falliti.
   * Lancia HTTP 429 se bloccata.
   */
  async checkBeforeLogin(req: Request, email: string): Promise<void> {
    try {
      const blocked = await this.redisService.get(this.getBlockKey(req, email));
      if (blocked) {
        const ttl = await this.redisService.getClient().ttl(this.getBlockKey(req, email));
        this.logger.warn(`[LoginGuard] Identità bloccata — ${ttl}s remaining`);
        throw new HttpException(
          `Troppi tentativi falliti. Riprova tra ${Math.ceil(ttl / 60)} minuti.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
    } catch (e) {
      if (e instanceof HttpException) throw e;
      this.logger.error('[LoginGuard] Redis unavailable in checkBeforeLogin', e);
      // fail-open: se Redis è giù non blocchiamo il login
    }
  }

  /**
   * Registra un tentativo fallito. Dopo MAX_FAILS imposta il blocco.
   */
  async registerFailure(req: Request, email: string): Promise<void> {
    try {
      const failKey  = this.getKey(req, email);
      const blockKey = this.getBlockKey(req, email);
      const client   = this.redisService.getClient();

      const fails = await client.incr(failKey);
      if (fails === 1) await client.expire(failKey, WINDOW_SEC);

      this.logger.warn(`[LoginGuard] Tentativo ${fails}/${MAX_FAILS}`);

      if (fails >= MAX_FAILS) {
        await client.set(blockKey, '1', 'EX', BLOCK_TTL_SEC);
        await client.del(failKey);
        this.logger.warn(`[LoginGuard] Identità bloccata per ${BLOCK_TTL_SEC}s`);
      }
    } catch (e) {
      this.logger.error('[LoginGuard] Redis unavailable in registerFailure', e);
    }
  }

  /**
   * Reset contatore dopo un login riuscito.
   */
  async resetFailures(req: Request, email: string): Promise<void> {
    try {
      const client = this.redisService.getClient();
      await client.del(
        this.getKey(req, email),
        this.getBlockKey(req, email),
      );
    } catch (e) {
      this.logger.error('[LoginGuard] Redis unavailable in resetFailures', e);
    }
  }
}
