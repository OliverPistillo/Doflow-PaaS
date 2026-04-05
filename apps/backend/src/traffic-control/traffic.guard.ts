import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { TrafficControlService } from './traffic-control.service';
import { Request } from 'express';

@Injectable()
export class TrafficGuard implements CanActivate {
  private readonly logger = new Logger(TrafficGuard.name);

  constructor(private readonly trafficService: TrafficControlService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();

    // ✅ FIX CORS: Lascia passare SEMPRE le richieste Preflight (OPTIONS)
    // Se blocchiamo queste, il browser non riceverà mai gli header Access-Control-Allow-Origin
    if (req.method === 'OPTIONS') {
      return true;
    }

    // Qui inizia il controllo vero e proprio per GET/POST/PUT/DELETE
    try {
      const result = await this.trafficService.checkRequest(req);
      
      if (!result.allowed) {
        // Se il service ha deciso di bloccare, solitamente lancia già HttpException.
        // Se ritorna false senza eccezione, blocchiamo qui.
        return false;
      }
      
      // Se c'è un header di Retry-After o RateLimit, lo iniettiamo nella risposta
      const res = context.switchToHttp().getResponse();
      if (result.remainingTokens !== undefined) {
        res.header('X-RateLimit-Remaining', result.remainingTokens);
      }
      
      return true;

    } catch (err) {
      // Se il traffic service lancia un errore (es. 403 Forbidden), 
      // dobbiamo lasciarlo passare affinché NestJS mandi la risposta d'errore corretta
      throw err; 
    }
  }
}