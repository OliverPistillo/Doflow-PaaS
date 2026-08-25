// apps/backend/src/health/health.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { WebSocket } from 'ws';
import { FileStorageService } from '../file-storage.service';
import { createHealthProbeSignature } from './health-probe-signature';

export type HealthStatus = 'ok' | 'warn' | 'down';
export type Check = { status: HealthStatus; latency_ms?: number; message?: string };

export function statusFromChecks(checks: Record<string, Check>): HealthStatus {
  const values = Object.values(checks);
  if (values.some((c) => c.status === 'down')) return 'down';
  if (values.some((c) => c.status === 'warn')) return 'warn';
  return 'ok';
}

export async function wsProbe(
  url: string,
  timeoutMs = 800,
  headers: Record<string, string> = {},
): Promise<{ ok: boolean; latency_ms: number; message?: string }> {
  const t0 = Date.now();
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return await new Promise((resolve) => {
    const ws = new WebSocket(url, { headers });
    let done = false;

    const finish = (ok: boolean, message?: string) => {
      if (done) return;
      done = true;
      const latency_ms = Date.now() - t0;
      try { ws.close(); } catch {}
      resolve({ ok, latency_ms, message });
    };

    const timer = setTimeout(() => {
      finish(false, `timeout ${timeoutMs}ms`);
    }, timeoutMs);

    ws.on('open', () => {
      try {
        ws.send(JSON.stringify({ type: 'health_ping', nonce }));
      } catch {
        clearTimeout(timer);
        finish(false, 'send failed');
      }
    });

    ws.on('message', (data: any) => {
      try {
        const raw =
          typeof data === 'string'
            ? data
            : Buffer.isBuffer(data)
            ? data.toString('utf8')
            : data?.toString?.('utf8');

        if (!raw) return;

        const msg = JSON.parse(raw);

        // ignoriamo eventuale "hello", cerchiamo pong col nonce
        if (msg?.type === 'health_pong' && msg?.nonce === nonce) {
          clearTimeout(timer);
          finish(true);
        }
      } catch {
        // ignore
      }
    });

    ws.on('error', (err: any) => {
      clearTimeout(timer);
      finish(false, err?.message || 'ws error');
    });

    ws.on('close', () => {
      if (!done) {
        clearTimeout(timer);
        finish(false, 'closed before pong');
      }
    });
  });
}

export function wsCheckFromProbe(
  result: { ok: boolean; latency_ms: number; message?: string },
): Check {
  if (result.ok) {
    return {
      status: result.latency_ms > 350 ? 'warn' : 'ok',
      latency_ms: result.latency_ms,
    };
  }

  return {
    status: 'warn',
    latency_ms: result.latency_ms,
    message: result.message ?? 'ws probe failed',
  };
}

@Injectable()
export class HealthService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
    private readonly storage: FileStorageService,
  ) {}

  async system() {
    const checks: Record<string, Check> = {
      api: { status: 'ok' },
      db: { status: 'down' },
      redis: { status: 'down' },
      ws: { status: 'warn', message: 'not verified' },
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

    // Redis (usa RedisService.ping())
    {
      try {
        const { pong, latency_ms } = await this.redis.ping();
        checks.redis = {
          status: pong === 'PONG' ? (latency_ms > 200 ? 'warn' : 'ok') : 'warn',
          latency_ms,
          message: pong === 'PONG' ? undefined : `pong=${pong}`,
        };
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'redis error';
        checks.redis = { status: 'down', message: msg };
      }
    }

    // WS probe reale (contro il WS RAW in main.ts)
    {
      try {
        const jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) throw new Error('JWT_SECRET is not configured');

        const port = Number(process.env.PORT ?? 4000);
        const wsPath = process.env.WS_PATH ?? '/ws';
        const token = createHealthProbeSignature(jwtSecret);
        const url = `ws://127.0.0.1:${port}${wsPath}`;
        const res = await wsProbe(url, 800, {
          Origin: process.env.FRONTEND_URL || 'http://localhost:3100',
          'X-Doflow-Health-Probe': token,
        });
        checks.ws = wsCheckFromProbe(res);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : 'ws error';
        checks.ws = { status: 'down', message: msg };
      }
    }

    // Realtime: ora dipende da Redis + WS (più onesto)
    if (checks.redis.status === 'down' || checks.ws.status === 'down') {
      checks.realtime = { status: 'down', message: 'redis/ws down → realtime down' };
    } else if (checks.redis.status === 'warn' || checks.ws.status === 'warn') {
      checks.realtime = { status: 'warn', message: 'degraded (redis/ws)' };
    } else {
      checks.realtime = { status: 'ok' };
    }

    // Storage: placeholder finché non fai probe su S3/MinIO
    try {
      const res = await this.storage.probe();
      checks.storage = {
        status: res.status,
        latency_ms: res.latency_ms,
        message: res.message,
      };
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'storage error';
      checks.storage = { status: 'down', message: msg };
    }

    return {
      status: statusFromChecks(checks),
      checks,
      ts: new Date().toISOString(),
    };
  }
}
