import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RedisModule } from '../redis/redis.module';
import { PresenceRegistryService } from './presence-registry.service';

@Global() // Lo rendiamo Globale così è disponibile ovunque (incluso Telemetry)
@Module({
  imports: [RedisModule],
  providers: [NotificationsService, PresenceRegistryService],
  exports: [NotificationsService, PresenceRegistryService],
})
export class NotificationsModule {}
