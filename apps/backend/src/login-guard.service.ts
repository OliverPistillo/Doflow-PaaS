import { Injectable } from '@nestjs/common';
import { Request } from 'express';
// Lo lasciamo, anche se non lo usiamo, così non tocchi i provider esistenti
import { RedisService } from './redis/redis.service';

// Questi non servono più per ora, ma puoi anche lasciarli
const MAX_FAILS = 5;          // tentativi falliti prima del blocco
const WINDOW_SEC = 300;       // 5 minuti di finestra
const BLOCK_TTL_SEC = 3600;   // blocco per 1 ora

@Injectable()
export class LoginGuardService {
  constructor(private readonly redisService: RedisService) {}

  // Lo teniamo ma non lo usiamo più
  private getIdentity(req: Request, email: string): string {
    const ip = (req.ip as string | undefined) ?? 'unknown';
    return `${email}|${ip}`;
  }

  /**
   * ✅ DISABILITATO: non blocca più nessuno.
   */
  async checkBeforeLogin(req: Request, email: string): Promise<void> {
    // Temporaneamente disabilitato in fase di sviluppo.
    // Qui prima c'era il controllo del Bloom filter + blocco.
    return;
  }

  /**
   * ✅ DISABILITATO: non registra più i fallimenti.
   */
  async registerFailure(req: Request, email: string): Promise<void> {
    // Temporaneamente disabilitato: nessun conteggio tentativi.
    return;
  }

  /**
   * ✅ DISABILITATO: non serve più, ma lo lasciamo
   * per compatibilità con il codice che lo chiama.
   */
  async resetFailures(req: Request, email: string): Promise<void> {
    // Temporaneamente disabilitato.
    return;
  }
}
