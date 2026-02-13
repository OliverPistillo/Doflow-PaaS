import { Module, Global } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { RedisModule } from '../redis/redis.module';

@Global() // Lo rendiamo Globale così è disponibile ovunque (incluso Telemetry)
@Module({
  imports: [RedisModule],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}