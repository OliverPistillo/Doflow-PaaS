// apps/backend/src/main.ts
// AGGIORNAMENTO:
// - CORS: aggiunto supporto per dominio sito web pubblico (CORS_PUBLIC_ORIGINS)
// - Header esposti: aggiunto Content-Disposition per download zip
// - Static assets pubblici generici per file caricati e risorse applicative

import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NotificationsService } from './realtime/notifications.service';
import { WebSocketServer, WebSocket } from 'ws';
import * as jwt from 'jsonwebtoken';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import * as express from 'express';
import * as dotenv from 'dotenv';
import { Logger } from '@nestjs/common';
import * as path from 'path';

// --- AGGIUNTE v3.5 (Monitoring) ---
import { TelemetryService } from './telemetry/telemetry.service';
import { TelemetryInterceptor } from './telemetry/telemetry.interceptor';
import { GlobalExceptionFilter } from './telemetry/global-exception.filter';

dotenv.config({ path: path.join(__dirname, '..', '.env') });

type ClientMeta = {
  userId: string;
  tenantId: string;
  tenantSlug?: string;
  email?: string;
};

type ClientWithMeta = WebSocket & { __meta?: ClientMeta };

function pickTenantFromJwt(decoded: any): { tenantId: string; tenantSlug?: string } {
  const slug =
    decoded.tenantSlug ??
    decoded.tenant_slug ??
    decoded.activeTenantSlug ??
    decoded.active_tenant_slug ??
    undefined;

  const tenantId =
    (decoded.tenantId ??
      decoded.tenant_id ??
      decoded.activeTenantId ??
      decoded.active_tenant_id ??
      decoded.tenant ??
      slug ??
      'public') as string;

  return {
    tenantId: String(tenantId).toLowerCase(),
    tenantSlug: slug ? String(slug).toLowerCase() : undefined,
  };
}

async function bootstrap() {
  if (!process.env.JWT_SECRET) {
    new Logger('Bootstrap').error('❌ FATAL: JWT_SECRET is not defined in .env. Exiting.');
    process.exit(1);
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false,
  });

  app.use(express.json({ limit: '50mb' }));
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
    .map((o) => o.trim())
    .filter(Boolean);

  const publicOrigins = (process.env.CORS_PUBLIC_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  const allowedOrigins = [...new Set([...crmOrigins, ...publicOrigins])];

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.includes(origin)) return callback(null, true);
      return callback(new Error(`CORS: origin '${origin}' non autorizzata`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-DOFLOW-TENANT-ID',
      'x-doflow-tenant-id',
      'x-doflow-pathname',
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

  // ── WebSocket (invariato) ────────────────────────────────────────────────
  const httpAdapter: any = (app as any).getHttpAdapter();
  const httpServer: any = httpAdapter.getHttpServer();

  const notifications = app.get(NotificationsService);
  const wsPath = process.env.WS_PATH ?? '/ws';

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<ClientWithMeta>();

  httpServer.on('upgrade', (req: any, socket: any, head: Buffer) => {
    try {
      const url = req.url ?? '/';
      const fullUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
      if (fullUrl.pathname !== wsPath) return;
      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch (e) {
      new Logger('WS').error('[UPGRADE] error parsing URL', (e as Error).message);
      socket.destroy();
    }
  });

  wss.on('connection', (socket: ClientWithMeta, req: any) => {
    try {
      const urlStr = req.url ?? '/';
      const fullUrl = new URL(urlStr, `http://${req.headers.host || 'localhost'}`);
      const token = fullUrl.searchParams.get('token');

      if (!token) { socket.close(4001, 'Missing token'); return; }

      const decoded: any = jwt.verify(token, process.env.JWT_SECRET as string);
      const { tenantId, tenantSlug } = pickTenantFromJwt(decoded);

      const meta: ClientMeta = {
        userId: String(decoded.sub),
        tenantId,
        tenantSlug,
        email: decoded.email as string | undefined,
      };

      socket.__meta = meta;
      clients.add(socket);

      socket.send(
        JSON.stringify({
          type: 'hello',
          payload: { tenantId: meta.tenantId, tenantSlug: meta.tenantSlug, userId: meta.userId },
        }),
      );

      socket.on('message', (data: any) => {
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

      socket.on('close', () => clients.delete(socket));
      socket.on('error', (err) => {
        new Logger('WS').error('[WS] Socket error', (err as Error).message);
        clients.delete(socket);
      });

    } catch (e) {
      new Logger('WS').error('[WS] Auth connection error:', (e as Error).message);
      socket.close(4002, 'Invalid or expired token');
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
      } else if (channel.startsWith('user:')) {
        const [, userId] = channel.split(':');
        if (meta.userId !== userId) continue;
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

bootstrap();