// apps/backend/src/health/health.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

type HealthStatus = 'ok' | 'warn' | 'down';
type Check = { status: HealthStatus; latency_ms?: number; message?: string };

function statusFromChecks(checks: Record<string, Check>): HealthStatus {
  const values = Object.values(checks);
  if (values.some((c) => c.status === 'down')) return 'down';
  if (values.some((c) => c.status === 'warn')) return 'warn';
  return 'ok';
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  async system() {
    const checks: Record<string, Check> = {
      api: { status: 'ok' },
      db: { status: 'down' },
      redis: { status: 'down' },
      realtime: { status: 'warn', message: 'not verified' },
      storage: { status: 'warn', message: 'not verified' },
    };

    // DB
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

    // Redis (usa RedisService.ping() che hai già aggiunto)
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

    // Realtime: euristica sensata (se Redis giù, Pub/Sub degradato)
    if (checks.redis.status === 'down') {
      checks.realtime = { status: 'warn', message: 'redis down → realtime may be degraded' };
    } else {
      checks.realtime = { status: 'ok' };
    }

    // Storage: placeholder finché non fai probe su S3/MinIO
    checks.storage = { status: 'warn', message: 'storage probe not implemented' };

    return {
      status: statusFromChecks(checks),
      checks,
      ts: new Date().toISOString(),
    };
  }
}
