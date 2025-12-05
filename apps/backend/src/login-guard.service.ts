import { Injectable } from '@nestjs/common';
import { Request } from 'express';
import { RedisService } from './redis/redis.service';

const MAX_FAILS = 5;          // tentativi falliti prima del blocco
const WINDOW_SEC = 300;       // 5 minuti di finestra
const BLOCK_TTL_SEC = 3600;   // blocco per 1 ora

@Injectable()
export class LoginGuardService {
  constructor(private readonly redisService: RedisService) {}

  private getIdentity(req: Request, email: string): string {
    const ip = (req.ip as string | undefined) ?? 'unknown';
    return `${email}|${ip}`;
  }

  async checkBeforeLogin(req: Request, email: string): Promise<void> {
    const identity = this.getIdentity(req, email);

    // Bloom: se l'identità è già nella blocklist, blocca subito
    const blocked = await this.redisService.checkAndAdd(
      'login_block',
      identity,
      BLOCK_TTL_SEC,
    );

    if (blocked) {
      throw new Error('Too many failed login attempts. Please try again later.');
    }
  }

  async registerFailure(req: Request, email: string): Promise<void> {
    const identity = this.getIdentity(req, email);
    const key = `login_fail:${identity}`;
    const client = this.redisService.getClient();

    const fails = await client.incr(key);
    if (fails === 1) {
      await client.expire(key, WINDOW_SEC);
    }

    if (fails >= MAX_FAILS) {
      // aggiungi l'identità alla blocklist Bloom
      await this.redisService.checkAndAdd(
        'login_block',
        identity,
        BLOCK_TTL_SEC,
      );
    }
  }

  async resetFailures(req: Request, email: string): Promise<void> {
    const identity = this.getIdentity(req, email);
    const key = `login_fail:${identity}`;
    const client = this.redisService.getClient();
    await client.del(key);
  }
}
