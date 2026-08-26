// apps/backend/src/main.ts
// AGGIORNAMENTO:
// - CORS: aggiunto supporto per dominio sito web pubblico (CORS_PUBLIC_ORIGINS)
// - Header esposti: aggiunto Content-Disposition per download zip
// - Static assets pubblici generici per file caricati e risorse applicative

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NotificationsService } from './realtime/notifications.service';
import { WebSocketServer, WebSocket, type RawData } from 'ws';
import { WebSessionService } from './auth/web-session.service';
import { ForbiddenException, ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import type { IncomingMessage, Server as HttpServer } from 'node:http';
import type { Duplex } from 'node:stream';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';
import * as path from 'path';
import { parseTrustProxy } from './common/client-ip.utils';
import { verifyHealthProbeSignature } from './health/health-probe-signature';
import { PresenceRegistryService } from './realtime/presence-registry.service';
import { randomUUID } from 'node:crypto';

// --- AGGIUNTE v3.5 (Monitoring) ---
import { TelemetryService } from './telemetry/telemetry.service';
import { TelemetryInterceptor } from './telemetry/telemetry.interceptor';
import { GlobalExceptionFilter } from './telemetry/global-exception.filter';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

type ClientMeta = {
  userId: string;
  tenantId: string;
  request: express.Request;
  heartbeat: ReturnType<typeof setInterval>;
  presenceId: string;
};

type ClientWithMeta = WebSocket & { __meta?: ClientMeta };

const CORS_ORIGIN_FORBIDDEN_MESSAGE = 'Origine CORS non autorizzata';

function normalizeCorsOrigin(origin: string): string | null {
  try {
    const parsed = new URL(origin.trim());
    return `${parsed.protocol}//${parsed.host}`.toLowerCase();
  } catch {
    return null;
  }
}

export async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    new Logger('Bootstrap').error('❌ FATAL: JWT_SECRET is not defined in .env. Exiting.');
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });
  app.enableShutdownHooks();
  try {
    app.set('trust proxy', parseTrustProxy(process.env.TRUST_PROXY));
  } catch (error) {
    new Logger('Bootstrap').error(error instanceof Error ? error.message : 'TRUST_PROXY non valido.');
    process.exit(1);
  }

  app.use(express.json({
    limit: '50mb',
    verify: (request, _response, buffer) => {
      (request as IncomingMessage & { rawBody?: Buffer }).rawBody = buffer;
    },
  }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.setGlobalPrefix('api');

  // ── Static assets pubblici generici ──────────────────────────────────────
  app.useStaticAssets(
    path.resolve(process.cwd(), 'public'),
    { prefix: '/public', index: false },
  );
  new Logger('Bootstrap').log(`📦 Static assets served from: ${path.resolve(process.cwd(), 'public')} → /public`);

  // ── CORS — Whitelist unificata CRM + Sito Web Pubblico ───────────────────
  // CORS_ORIGINS: origini per l'app CRM (es. https://app.doflow.it)
  // CORS_PUBLIC_ORIGINS: origini per il sito web pubblico (es. https://www.doflow.it)
  const crmOrigins = (process.env.CORS_ORIGINS ?? 'https://app.doflow.it')
    .split(',')
    .map((o) => normalizeCorsOrigin(o))
    .filter((o): o is string => Boolean(o));

  const publicOrigins = (process.env.CORS_PUBLIC_ORIGINS ?? '')
    .split(',')
    .map((o) => normalizeCorsOrigin(o))
    .filter((o): o is string => Boolean(o));

  const allowedOrigins = [...new Set([...crmOrigins, ...publicOrigins])];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      const normalized = normalizeCorsOrigin(origin);
      if (normalized && allowedOrigins.includes(normalized)) return callback(null, true);
      return callback(new ForbiddenException(CORS_ORIGIN_FORBIDDEN_MESSAGE));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Doflow-Web',
      'X-CSRF-Token',
      'X-DOFLOW-TENANT-ID',
      'x-doflow-tenant-id',
      'x-doflow-pathname',
      'Idempotency-Key',
      'If-Match',
      'X-Correlation-ID',
      'Accept',
    ],
    // Content-Disposition per download file dal CRM
    exposedHeaders: ['Content-Length', 'X-RateLimit-Remaining', 'Retry-After', 'Content-Disposition'],
    maxAge: 86400,
  });

  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
  }));

  // ── Swagger / OpenAPI Documentation ──────────────────────────────────────
  const swaggerConfig = new DocumentBuilder()
    .setTitle('DoFlow PaaS API')
    .setDescription('API completa della piattaforma DoFlow — superadmin, tenant, self-service, automazioni')
    .setVersion('3.7')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT')
    .addServer(`http://localhost:${Number(process.env.PORT ?? 4000)}`, 'Local Dev')
    .addServer('https://api.doflow.it', 'Production')
    .addTag('Superadmin', 'Gestione piattaforma, tenant, moduli, metriche')
    .addTag('Tenant Self-Service', 'Portale tenant: piano, moduli, ticket, notifiche')
    .addTag('Auth', 'Login, MFA, password reset')
    .addTag('Export', 'Download CSV dati')
    .addTag('Automations', 'Regole di automazione workflow')
    .build();
  const swaggerDoc = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDoc, {
    customSiteTitle: 'DoFlow API Docs',
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
  });
  new Logger('Bootstrap').log('📖 Swagger docs available at /api/docs');

  const telemetryService = app.get(TelemetryService);
  app.useGlobalInterceptors(new TelemetryInterceptor(telemetryService));
  app.useGlobalFilters(new GlobalExceptionFilter(telemetryService));

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');

  // ── WebSocket: sessione opaque Redis, tenant/user scope e revalidation ───
  const httpServer = app.getHttpServer() as HttpServer;

  const notifications = app.get(NotificationsService);
  const presence = app.get(PresenceRegistryService);
  const webSessions = app.get(WebSessionService);
  const wsPath = process.env.WS_PATH ?? '/ws';

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<ClientWithMeta>();

  httpServer.on('upgrade', (req: IncomingMessage, socket: Duplex, head: Buffer) => {
    try {
      const url = req.url ?? '/';
      const fullUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
      if (fullUrl.pathname !== wsPath) return;
      const origin = normalizeCorsOrigin(String(req.headers.origin || ''));
      if (!origin || !allowedOrigins.includes(origin)) {
        socket.write('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
        socket.destroy();
        return;
      }
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch (e) {
      new Logger('WS').error('[UPGRADE] error parsing URL', (e as Error).message);
      socket.destroy();
    }
  });

  wss.on('connection', async (socket: ClientWithMeta, req: IncomingMessage) => {
    try {
      const healthProbe = String(req.headers['x-doflow-health-probe'] || '');
      if (healthProbe) {
        if (!verifyHealthProbeSignature(
          healthProbe,
          String(process.env.JWT_SECRET || ''),
        )) {
          socket.close(4003, 'Invalid health probe');
          return;
        }
        socket.on('message', (data: RawData) => {
          try {
            const message = JSON.parse(data.toString('utf8'));
            if (message?.type === 'health_ping' && typeof message.nonce === 'string') {
              socket.send(JSON.stringify({
                type: 'health_pong',
                nonce: message.nonce,
                ts: new Date().toISOString(),
              }));
            }
          } catch { /* ignore malformed health probes */ }
        });
        return;
      }
      const request = req as express.Request;
      const session = await webSessions.resolve(request);
      if (!session || session.user.authStage !== 'FULL') {
        socket.close(4001, 'Session required');
        return;
      }
      const userId = String(session.user.id || session.user.sub || '');
      const tenantId = String(session.user.tenantId || '').toLowerCase();
      if (!userId || !tenantId || tenantId === 'public') {
        socket.close(4002, 'Invalid session');
        return;
      }
      const presenceId = randomUUID();
      const heartbeat = setInterval(() => {
        void webSessions.resolve(request).then((current) => {
          const valid = current?.user.authStage === 'FULL'
            && String(current.user.id || current.user.sub) === userId
            && String(current.user.tenantId || '').toLowerCase() === tenantId;
          if (!valid) socket.close(4001, 'Session revoked');
          else if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({ type: 'heartbeat', timestamp: new Date().toISOString() }));
            return presence.heartbeat(tenantId, userId, presenceId, 'online', 'ws');
          }
          return undefined;
        }).catch(() => socket.close(1011, 'Session validation unavailable'));
      }, 25_000);
      heartbeat.unref?.();

      const meta: ClientMeta = {
        userId,
        tenantId,
        request,
        heartbeat,
        presenceId,
      };

      socket.__meta = meta;
      clients.add(socket);
      await presence.heartbeat(tenantId, userId, presenceId, 'online', 'ws');

      socket.send(
        JSON.stringify({
          type: 'hello',
          payload: { tenantId: meta.tenantId, userId: meta.userId },
        }),
      );

      socket.on('message', (data: RawData) => {
        try {
          const raw = typeof data === 'string' ? data : data?.toString?.('utf8');
          if (!raw) return;
          const msg = JSON.parse(raw);
          if (msg?.type === 'health_ping' && typeof msg?.nonce === 'string') {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(JSON.stringify({
                type: 'health_pong',
                nonce: msg.nonce,
                ts: new Date().toISOString(),
              }));
            }
          }
        } catch { /* ignore garbage */ }
      });

      socket.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(socket);
        void presence.disconnect(tenantId, userId, presenceId).catch(() => undefined);
      });
      socket.on('error', (err) => {
        new Logger('WS').error('[WS] Socket error', (err as Error).message);
        clearInterval(heartbeat);
        clients.delete(socket);
        void presence.disconnect(tenantId, userId, presenceId).catch(() => undefined);
      });

    } catch (e) {
      new Logger('WS').error('[WS] Session connection error:', (e as Error).message);
      socket.close(4002, 'Invalid session');
    }
  });

  notifications.registerHandler((channel, payload) => {
    for (const socket of clients) {
      const meta = socket.__meta;
      if (!meta) continue;

      if (channel.startsWith('tenant:')) {
        const [, tenantId] = channel.split(':');
        if (tenantId !== 'global' && meta.tenantId !== tenantId) continue;
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'tenant_notification', channel, payload }));
        }
      } else if (channel.startsWith('tenant-user:')) {
        const [, tenantId, userId] = channel.split(':');
        if (meta.tenantId !== tenantId || meta.userId !== userId) continue;
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'user_notification', channel, payload }));
        }
      }
    }
  });

  new Logger('Bootstrap').log(`🚀 Backend running on port ${port} (Prefix: /api, WS: ${wsPath})`);
  new Logger('Bootstrap').log(`   CORS CRM origins: ${crmOrigins.join(', ')}`);
  new Logger('Bootstrap').log(`   CORS Public origins: ${publicOrigins.join(', ') || '(nessuna)'}`);
}

if (require.main === module) {
  void bootstrap().catch(() => {
    new Logger('Bootstrap').error('BACKEND_BOOTSTRAP_FAILED');
    process.exitCode = 1;
  });
}
