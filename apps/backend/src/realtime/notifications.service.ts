import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis, { Redis as RedisClient } from 'ioredis';

type ChannelHandler = (channel: string, payload: any) => void;

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private pub: RedisClient;
  private sub: RedisClient;
  private handlers: ChannelHandler[] = [];

  constructor() {
    const redisUrl = process.env.REDIS_URL ?? 'redis://redis:6379';

    this.pub = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });

    this.sub = new Redis(redisUrl, {
      maxRetriesPerRequest: null,
    });
  }

  async onModuleInit() {
    // Pattern-matching per canali tenant/user
    await this.sub.psubscribe('tenant:*:notifications', 'user:*:notifications');

    this.sub.on('pmessage', (_pattern, channel, message) => {
      let payload: any = message;
      try {
        payload = JSON.parse(message);
      } catch {
        // se non è JSON, passa stringa raw
      }
      for (const handler of this.handlers) {
        handler(channel, payload);
      }
    });
  }

  async onModuleDestroy() {
    await this.sub.quit();
    await this.pub.quit();
  }

  registerHandler(handler: ChannelHandler) {
    this.handlers.push(handler);
  }

  async notifyTenant(tenantId: string, event: any) {
    const channel = `tenant:${tenantId}:notifications`;
    await this.pub.publish(channel, JSON.stringify(event));
  }

  async notifyUser(userId: string, event: any) {
    const channel = `user:${userId}:notifications`;
    await this.pub.publish(channel, JSON.stringify(event));
  }
}
