import { Injectable } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';

@Injectable()
export class ShadowLoggerService {
  constructor(private readonly telemetryService: TelemetryService) {}

  async logBlock(data: { ip: string; tenantId: string; reason: string; path: string; method: string }) {
    await this.telemetryService.log({
      type: 'SECURITY_BLOCK',
      ip: data.ip,
      path: `${data.method} ${data.path}`,
      tenantId: data.tenantId,
      metadata: { reason: data.reason },
    });
  }
}