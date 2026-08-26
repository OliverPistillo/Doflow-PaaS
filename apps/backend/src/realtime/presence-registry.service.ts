import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { safeSchema } from '../common/schema.utils';
import { NotificationsService } from './notifications.service';

const PRESENCE_TTL_SECONDS = 45;
const ID_RE = /^[0-9a-f-]{16,64}$/i;

export type PresenceState = {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'dnd';
  source: 'ws' | 'http';
  lastSeenAt: string;
};

@Injectable()
export class PresenceRegistryService {
  constructor(private readonly redis: RedisService, private readonly notifications: NotificationsService) {}

  private key(tenantValue: string, userId: string, sessionValue: string) {
    const tenant = safeSchema(tenantValue, 'PresenceRegistryService');
    if (tenant === 'public' || !ID_RE.test(userId)) throw new Error('Invalid tenant presence identity');
    const session = String(sessionValue || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 80);
    if (!session) throw new Error('Invalid presence session');
    return { tenant, key: `presence:${tenant}:${userId}:${session}` };
  }

  async heartbeat(tenantValue: string, userId: string, sessionId: string, statusValue: string, source: 'ws' | 'http' = 'ws') {
    const { tenant, key } = this.key(tenantValue, userId, sessionId);
    const status = ['online', 'away', 'busy', 'dnd'].includes(statusValue) ? statusValue as PresenceState['status'] : 'online';
    const state: PresenceState = { userId, status, source, lastSeenAt: new Date().toISOString() };
    await this.redis.getClient().set(key, JSON.stringify(state), 'EX', PRESENCE_TTL_SECONDS);
    await this.notifications.broadcastToTenant(tenant, { type: 'presence.updated', payload: state });
    return state;
  }

  private async keys(pattern: string) {
    const client = this.redis.getClient();
    let cursor = '0';
    const found: string[] = [];
    do {
      const result = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      found.push(...result[1]);
    } while (cursor !== '0' && found.length < 10_000);
    return found.slice(0, 10_000);
  }

  async list(tenantValue: string): Promise<PresenceState[]> {
    const tenant = safeSchema(tenantValue, 'PresenceRegistryService.list');
    if (tenant === 'public') return [];
    const keys = await this.keys(`presence:${tenant}:*`);
    if (!keys.length) return [];
    const values = await this.redis.getClient().mget(...keys);
    const latest = new Map<string, PresenceState>();
    for (const value of values) {
      if (!value) continue;
      try {
        const state = JSON.parse(value) as PresenceState;
        const previous = latest.get(state.userId);
        if (!previous || previous.lastSeenAt < state.lastSeenAt) latest.set(state.userId, state);
      } catch { /* Ignore corrupt or expired values. */ }
    }
    return [...latest.values()].sort((a, b) => a.userId.localeCompare(b.userId));
  }

  async disconnect(tenantValue: string, userId: string, sessionId: string) {
    const { tenant, key } = this.key(tenantValue, userId, sessionId);
    await this.redis.getClient().del(key);
    const remaining = await this.keys(`presence:${tenant}:${userId}:*`);
    if (!remaining.length) {
      await this.notifications.broadcastToTenant(tenant, {
        type: 'presence.offline',
        payload: { userId, status: 'offline', lastSeenAt: new Date().toISOString() },
      });
    }
    return { userId, online: remaining.length > 0 };
  }
}
