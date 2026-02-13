import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('EXCEPTION_SHIELD');

  constructor(private readonly telemetryService: TelemetryService) {}

  catch(exception: any, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const tenantId = request.tenantId || 'global';
    const message = exception.message || 'Internal server error';

    // 1. SHADOW LOGGING: Mandiamo l'errore alla Control Tower
    this.telemetryService.logRequest({
      type: 'SYSTEM_ERROR',
      ip: request.ip,
      path: request.url,
      tenantId,
      metadata: {
        status,
        message,
        stack: process.env.NODE_ENV === 'development' ? exception.stack : undefined,
      },
    });

    this.logger.error(`[${status}] ${request.method} ${request.url} - ${message}`);

    // 2. RESPONSE: Risposta pulita per l'utente (Zero Trust)
    response.status(status).json({
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.url,
      error: status >= 500 ? 'Si è verificato un errore interno. Il team tecnico è stato avvisato.' : message,
    });
  }
}