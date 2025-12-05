import { Injectable } from '@nestjs/common';
import { OtelWrapper, TelemetryEvent } from './otel-wrapper';

@Injectable()
export class TelemetryService {
  private otel = new OtelWrapper();

  async log(event: TelemetryEvent) {
    await this.otel.emit(event);
  }
}
