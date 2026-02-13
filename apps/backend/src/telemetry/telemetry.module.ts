import { Global, Module } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { TelemetryController } from './telemetry.controller';
// import { ShadowLoggerService } from './shadow-logger.service'; // Se usi questo service
import { NotificationsModule } from '../realtime/notifications.module'; // Ora il file esiste!

@Global()
@Module({
  imports: [NotificationsModule], // Importiamo il modulo, non il service
  providers: [TelemetryService], // Aggiungi ShadowLoggerService se lo usi
  controllers: [TelemetryController],
  exports: [TelemetryService],
})
export class TelemetryModule {}