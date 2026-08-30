import { Injectable } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { safeSchema } from '../common/schema.utils';
import { NotificationsService } from './notifications.service';

const PRESENCE_TTL_SECONDS = 45;
const ID_RE = /^[0-9a-f-]{16,64}$/i;

export type PresenceState = {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline' | 'do_not_disturb' | 'in_call' | 'in_meeting';
  source: 'ws' | 'http' | 'manual' | 'desktop';
  lastSeenAt: string;
  expiresAt?: string;
};

type ManualPresence = Pick<PresenceState, 'userId' | 'status' | 'expiresAt'> & { source: 'manual' };

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

  private manualKey(tenantValue: string, userId: string) {
    const { tenant } = this.key(tenantValue, userId, 'manual');
    return { tenant, key: `presence-manual:${tenant}:${userId}` };
  }

  private status(value: string): PresenceState['status'] {
    return ['online', 'away', 'busy', 'offline', 'do_not_disturb', 'in_call', 'in_meeting'].includes(value)
      ? value as PresenceState['status']
      : value === 'dnd' ? 'do_not_disturb' : 'online';
  }

  private async manual(tenantValue: string, userId: string): Promise<ManualPresence | null> {
    const { key } = this.manualKey(tenantValue, userId);
    const raw = await this.redis.getClient().get(key);
    if (!raw) return null;
    try {
      const value = JSON.parse(raw) as ManualPresence;
      if (value.expiresAt && Date.parse(value.expiresAt) <= Date.now()) {
        await this.redis.getClient().del(key);
        return null;
      }
      return { userId, status: this.status(value.status), source: 'manual', expiresAt: value.expiresAt };
    } catch {
      await this.redis.getClient().del(key);
      return null;
    }
  }

  async heartbeat(tenantValue: string, userId: string, sessionId: string, statusValue: string, source: 'ws' | 'http' | 'desktop' = 'ws') {
    const { tenant, key } = this.key(tenantValue, userId, sessionId);
    const override = await this.manual(tenant, userId);
    const state: PresenceState = {
      userId,
      status: override?.status ?? this.status(statusValue),
      // A manual availability choice may override the status, never the transport
      // that proved this heartbeat came from an active Desktop session.
      source: source === 'desktop' ? 'desktop' : override ? 'manual' : source,
      lastSeenAt: new Date().toISOString(),
      ...(override?.expiresAt ? { expiresAt: override.expiresAt } : {}),
    };
    await this.redis.getClient().set(key, JSON.stringify(state), 'EX', PRESENCE_TTL_SECONDS);
    await this.notifications.broadcastToTenant(tenant, { type: 'presence.updated', payload: state });
    return state;
  }

  async setManual(tenantValue: string, userId: string, statusValue: string, durationValue: string) {
    const { tenant, key } = this.manualKey(tenantValue, userId);
    const status = this.status(statusValue);
    const duration = ['30m', '1h', 'today', 'forever'].includes(durationValue) ? durationValue : 'forever';
    const now = new Date();
    let ttl: number | undefined;
    if (duration === '30m') ttl = 30 * 60;
    if (duration === '1h') ttl = 60 * 60;
    if (duration === 'today') {
      const end = new Date(now);
      end.setHours(24, 0, 0, 0);
      ttl = Math.max(60, Math.ceil((end.getTime() - now.getTime()) / 1000));
    }
    const value: ManualPresence = {
      userId,
      status,
      source: 'manual',
      ...(ttl ? { expiresAt: new Date(now.getTime() + ttl * 1000).toISOString() } : {}),
    };
    if (ttl) await this.redis.getClient().set(key, JSON.stringify(value), 'EX', ttl);
    else await this.redis.getClient().set(key, JSON.stringify(value));
    return this.heartbeat(tenant, userId, 'http', status, 'http');
  }

  async clearManual(tenantValue: string, userId: string, automaticStatus = 'online') {
    const { tenant, key } = this.manualKey(tenantValue, userId);
    await this.redis.getClient().del(key);
    return this.heartbeat(tenant, userId, 'http', automaticStatus, 'http');
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

  async desktopHeartbeat(tenantValue: string, userId: string, deviceId: string, status = 'online') {
    return this.heartbeat(tenantValue, userId, `desktop-${deviceId}`, status, 'desktop');
  }

  async hasDesktopSession(tenantValue: string, userId: string, deviceId?: string) {
    const tenant = safeSchema(tenantValue, 'PresenceRegistryService.hasDesktopSession');
    const pattern = deviceId
      ? this.key(tenant, userId, `desktop-${deviceId}`).key
      : `presence:${tenant}:${userId}:desktop-*`;
    const keys = deviceId ? [pattern] : await this.keys(pattern);
    if (!keys.length) return false;
    const values = await this.redis.getClient().mget(...keys);
    return values.some((value) => {
      if (!value) return false;
      try {
        const state = JSON.parse(value) as PresenceState;
        return state.source === 'desktop'
          && !['offline', 'do_not_disturb'].includes(state.status);
      } catch {
        return false;
      }
    });
  }

  async disconnectDesktop(tenantValue: string, userId: string, deviceId: string) {
    return this.disconnect(tenantValue, userId, `desktop-${deviceId}`);
  }
}
