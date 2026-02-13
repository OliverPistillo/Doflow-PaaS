import { CanActivate, ExecutionContext, Injectable, HttpException, HttpStatus } from '@nestjs/common';
import { TrafficControlService } from './traffic-control.service';
import { Request } from 'express';

@Injectable()
export class TrafficGuard implements CanActivate {
  constructor(private readonly trafficService: TrafficControlService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request>();
    
    // Escludi rotte di health check o statiche se necessario
    if (req.url.startsWith('/health') || req.url.startsWith('/favicon.ico')) {
        return true;
    }

    const result = await this.trafficService.checkRequest(req);

    const res = context.switchToHttp().getResponse();
    
    // Imposta Headers informativi (RateLimit standard)
    if (result.remainingTokens !== undefined) {
        res.header('X-RateLimit-Limit', '200');
        res.header('X-RateLimit-Remaining', result.remainingTokens.toString());
    }

    if (!result.allowed) {
        res.header('Retry-After', result.retryAfter?.toString() || '60');
        throw new HttpException(
            `Too Many Requests. Please retry in ${Math.ceil(result.retryAfter || 60)} seconds.`, 
            HttpStatus.TOO_MANY_REQUESTS
        );
    }

    return true;
  }
}