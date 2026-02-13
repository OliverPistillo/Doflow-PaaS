import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);
  private subscriberClient: any;
  private publisherClient: any;

  constructor(private readonly redisService: RedisService) {
    this.init();
  }

  private init() {
    // Client dedicato alla pubblicazione
    this.publisherClient = this.redisService.getClient().duplicate();
    // Client dedicato alla sottoscrizione
    this.subscriberClient = this.redisService.getClient().duplicate();
  }

  async registerHandler(callback: (channel: string, payload: any) => void) {
    await this.subscriberClient.psubscribe('tenant:*');
    await this.subscriberClient.psubscribe('user:*');

    this.subscriberClient.on('pmessage', (_pattern: string, channel: string, message: string) => {
      try {
        const payload = JSON.parse(message);
        callback(channel, payload);
      } catch (e) {
        this.logger.error('Failed to parse Redis message', e);
      }
    });

    this.logger.log('📡 Redis Pub/Sub listeners registered');
  }

  /**
   * Invia un messaggio a tutti gli utenti di un Tenant specifico.
   * Pubblica su Redis canale "tenant:{tenantId}"
   */
  async broadcastToTenant(tenantId: string, message: any) {
    try {
      const channel = `tenant:${tenantId}`;
      const payload = JSON.stringify(message);
      
      // Pubblica su Redis. main.ts lo intercetterà e lo manderà ai WebSocket
      await this.publisherClient.publish(channel, payload);
      
    } catch (e) {
      this.logger.error(`Failed to broadcast to tenant ${tenantId}`, e);
    }
  }

  /**
   * ALIAS per compatibilità con il codice esistente (projects-events, etc.)
   */
  async notifyTenant(tenantId: string, message: any) {
    return this.broadcastToTenant(tenantId, message);
  }

  /**
   * Invia un messaggio a un singolo utente specifico.
   */
  async notifyUser(userId: string, message: any) {
    try {
      const channel = `user:${userId}`;
      const payload = JSON.stringify(message);
      await this.publisherClient.publish(channel, payload);
    } catch (e) {
      this.logger.error(`Failed to notify user ${userId}`, e);
    }
  }
}