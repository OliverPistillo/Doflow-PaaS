import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { TelemetryService } from './telemetry.service';

@Injectable()
export class TelemetryInterceptor implements NestInterceptor {
  private readonly logger = new Logger('API_PERF');

  constructor(private readonly telemetryService: TelemetryService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const now = Date.now();
    const req = context.switchToHttp().getRequest();
    const { method, url, ip } = req;
    const tenantId = req.tenantId || 'global';

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - now;
        
        // Salviamo la metrica in modo silenzioso (Shadow Logging)
        this.telemetryService.logRequest({
          type: 'API_PERFORMANCE',
          ip,
          path: url,
          tenantId,
          metadata: {
            method,
            durationMs: duration,
            status: context.switchToHttp().getResponse().statusCode,
          },
        });

        if (duration > 500) {
          this.logger.warn(`[SLOW API] ${method} ${url} took ${duration}ms`);
        }
      }),
    );
  }
}