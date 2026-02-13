import { Global, Module } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
import { ShadowLoggerService } from './shadow-logger.service';

@Global()
@Module({
  providers: [TelemetryService, ShadowLoggerService],
  controllers: [TelemetryController],
  exports: [TelemetryService, ShadowLoggerService],
})
export class TelemetryModule {}