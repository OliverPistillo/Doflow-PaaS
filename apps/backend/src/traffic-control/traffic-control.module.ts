import { Module } from '@nestjs/common';
import { TrafficControlService } from './traffic-control.service';
import { TrafficGuard } from './traffic.guard';
import { RedisModule } from '../redis/redis.module';

@Module({
  imports: [RedisModule],
  providers: [TrafficControlService, TrafficGuard],
  exports: [TrafficControlService, TrafficGuard],
})
export class TrafficControlModule {}