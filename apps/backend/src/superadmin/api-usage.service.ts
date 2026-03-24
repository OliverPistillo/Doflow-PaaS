import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from '../redis/redis.service';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Tenant } from './entities/tenant.entity';

export interface ApiUsageStats {
  totalRequests: number;
  uniqueIps: number;
  topEndpoints: { path: string; count: number }[];
  topTenants: { tenantId: string; tenantName?: string; count: number }[];
  requestsByType: { type: string; count: number }[];
  errorRate: number;
  recentErrors: any[];
  requestsTimeline: { hour: string; count: number }[];
  rateLimitHits: number;
}

@Injectable()
export class ApiUsageService {
  private readonly logger = new Logger(ApiUsageService.name);
  private readonly SHADOW_LOG_KEY = 'df:telemetry:shadow_queue';

  constructor(
    private readonly redis: RedisService,
    @InjectRepository(Tenant)
    private tenantRepo: Repository<Tenant>,
  ) {}

  async getUsageDashboard(): Promise<ApiUsageStats> {
    const client = this.redis.getClient();

    // Recupera tutti i log dalla coda telemetria
    let rawLogs: string[] = [];
    try {
      rawLogs = await client.lrange(this.SHADOW_LOG_KEY, 0, 1999);
    } catch (e) {
      this.logger.error('Failed to read telemetry logs from Redis', e);
    }

    const logs = rawLogs.map(l => {
      try { return JSON.parse(l); } catch { return null; }
    }).filter(Boolean);

    // Tenants lookup per nome
    const tenants = await this.tenantRepo.find();
    const tenantMap = new Map(tenants.map(t => [t.schemaName, t.name]));
    tenantMap.set('global', 'Platform');
    tenantMap.set('unknown', 'Unknown');

    // ─── Aggregazioni ─────────────────────────────────────────

    const endpointCounts: Record<string, number> = {};
    const tenantCounts: Record<string, number> = {};
    const typeCounts: Record<string, number> = {};
    const ipSet = new Set<string>();
    const hourlyCounts: Record<string, number> = {};
    const errors: any[] = [];
    let rateLimitHits = 0;

    for (const log of logs) {
      // Endpoint
      if (log.path) {
        // Normalizza path (rimuovi parametri UUID)
        const normalizedPath = (log.path as string).replace(
          /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
          ':id',
        );
        endpointCounts[normalizedPath] = (endpointCounts[normalizedPath] || 0) + 1;
      }

      // Tenant
      if (log.tenantId) {
        tenantCounts[log.tenantId] = (tenantCounts[log.tenantId] || 0) + 1;
      }

      // Type
      if (log.type) {
        typeCounts[log.type] = (typeCounts[log.type] || 0) + 1;
      }

      // Unique IPs
      if (log.ip) ipSet.add(log.ip);

      // Hourly timeline
      if (log.timestamp) {
        const hour = log.timestamp.slice(0, 13); // "2026-03-24T14"
        hourlyCounts[hour] = (hourlyCounts[hour] || 0) + 1;
      }

      // Errors
      const typeUpper = (log.type || '').toUpperCase();
      if (typeUpper.includes('ERROR') || typeUpper.includes('FAIL') || typeUpper.includes('EXCEPTION')) {
        errors.push(log);
      }

      // Rate limit events
      if (typeUpper.includes('RATE_LIMIT') || typeUpper.includes('THROTTLE') || typeUpper.includes('429')) {
        rateLimitHits++;
      }
    }

    // Sort & slice
    const topEndpoints = Object.entries(endpointCounts)
      .map(([path, count]) => ({ path, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20);

    const topTenants = Object.entries(tenantCounts)
      .map(([tenantId, count]) => ({
        tenantId,
        tenantName: tenantMap.get(tenantId) || tenantId,
        count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 15);

    const requestsByType = Object.entries(typeCounts)
      .map(([type, count]) => ({ type, count }))
      .sort((a, b) => b.count - a.count);

    const requestsTimeline = Object.entries(hourlyCounts)
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour.localeCompare(b.hour))
      .slice(-48); // Ultime 48 ore

    const errorRate = logs.length > 0
      ? Math.round((errors.length / logs.length) * 10000) / 100
      : 0;

    return {
      totalRequests: logs.length,
      uniqueIps: ipSet.size,
      topEndpoints,
      topTenants,
      requestsByType,
      errorRate,
      recentErrors: errors.slice(0, 20),
      requestsTimeline,
      rateLimitHits,
    };
  }

  /** Contatori rate limit live da Redis */
  async getRateLimitStatus() {
    const client = this.redis.getClient();
    const keys = await client.keys('df:rl:*');

    const entries: { key: string; tokens: string | null }[] = [];
    for (const key of keys.slice(0, 50)) {
      const val = await client.get(key);
      entries.push({ key, tokens: val });
    }

    return {
      activeKeys: keys.length,
      sample: entries.map(e => {
        const parts = e.key.replace('df:rl:', '').split(':');
        return {
          tenant: parts[0] || 'global',
          ip: parts[1] || 'unknown',
          remainingTokens: e.tokens,
        };
      }),
    };
  }
}
