// apps/backend/src/health/health.service.ts
import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';
import { WebSocket } from 'ws';

type HealthStatus = 'ok' | 'warn' | 'down';
type Check = { status: HealthStatus; latency_ms?: number; message?: string };

function statusFromChecks(checks: Record<string, Check>): HealthStatus {
  const values = Object.values(checks);
  if (values.some((c) => c.status === 'down')) return 'down';
  if (values.some((c) => c.status === 'warn')) return 'warn';
  return 'ok';
}

// Base64url JSON helper
function b64urlJson(obj: unknown): string {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

// JWT “fake” compatibile con decodeJwt() che hai in main.ts:
// il server RAW NON verifica firma, quindi basta che il payload sia decodificabile.
function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = b64urlJson({ alg: 'none', typ: 'JWT' });
  const body = b64urlJson(payload);
  return `${header}.${body}.x`;
}

async function wsProbe(url: string, timeoutMs = 800): Promise<{ ok: boolean; latency_ms: number; message?: string }> {
  const t0 = Date.now();
  const nonce = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

  return await new Promise((resolve) => {
    const ws = new WebSocket(url);
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
      // Se vuoi, puoi mettere PORT nell'env. Fallback: 4000 come il tuo main.ts.
      const port = Number(process.env.PORT ?? 4000);
      const wsPath = process.env.WS_PATH ?? '/ws';

      const token = makeFakeJwt({
        sub: 'health',
        email: 'health@doflow.local',
        tenantId: 'public',
        role: 'superadmin',
      });

      const url = `ws://127.0.0.1:${port}${wsPath}?token=${encodeURIComponent(token)}`;

      try {
        const res = await wsProbe(url, 800);

        if (res.ok) {
          checks.ws = {
            status: res.latency_ms > 350 ? 'warn' : 'ok',
            latency_ms: res.latency_ms,
          };
        } else {
          // se API è up ma probe fallisce -> warn (degraded), non down
          checks.ws = {
            status: 'warn',
            latency_ms: res.latency_ms,
            message: res.message ?? 'ws probe failed',
          };
        }
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
    checks.storage = { status: 'warn', message: 'storage probe not implemented' };

    return {
      status: statusFromChecks(checks),
      checks,
      ts: new Date().toISOString(),
    };
  }
}
