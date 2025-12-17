// apps/backend/src/health/health.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

type HealthStatus = 'ok' | 'warn' | 'down';
type Check = { status: HealthStatus; latency_ms?: number; message?: string };

function statusFromChecks(checks: Record<string, Check>): HealthStatus {
  if (Object.values(checks).some((c) => c.status === 'down')) return 'down';
  if (Object.values(checks).some((c) => c.status === 'warn')) return 'warn';
  return 'ok';
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  async system() {
    const checks: {
      api: Check;
      db: Check;
      redis: Check;
      ws: Check;
      storage: Check;
    } = {
      api: { status: 'ok' }, // se sei arrivato qui, l'API risponde
      db: { status: 'down' },
      redis: { status: 'down' },
      ws: { status: 'warn', message: 'not verified' },
      storage: { status: 'warn', message: 'not verified' },
    };

    // 1) DB check
    {
      const t0 = Date.now();
      try {
        await this.dataSource.query('SELECT 1');
        const ms = Date.now() - t0;
        checks.db = { status: ms > 300 ? 'warn' : 'ok', latency_ms: ms };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'db error';
        checks.db = { status: 'down', message: msg };
      }
    }

    // 2) Redis check (via RedisService.ping())
    {
      try {
        const { pong, latency_ms } = await this.redis.ping();
        checks.redis = {
          status: pong === 'PONG' ? (latency_ms > 200 ? 'warn' : 'ok') : 'warn',
          latency_ms,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'redis error';
        checks.redis = { status: 'down', message: msg };
      }
    }

    // 3) WS check (pragmatico ma sensato)
    // Se usi Redis per Pub/Sub del realtime, Redis giù => realtime degradato.
    if (checks.redis.status === 'down') {
      checks.ws = { status: 'warn', message: 'redis down → ws pubsub may be degraded' };
    } else {
      checks.ws = { status: 'ok' };
    }

    // 4) Storage check
    // TODO: quando colleghi S3/MinIO, fai un HEAD/LIST rapido e setta ok/warn/down
    checks.storage = { status: 'warn', message: 'storage probe not implemented' };

    return {
      status: statusFromChecks(checks),
      checks,
      ts: new Date().toISOString(),
    };
  }
}
