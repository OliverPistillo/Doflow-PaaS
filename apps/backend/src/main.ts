import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NotificationsService } from './realtime/notifications.service';
import { WebSocketServer, WebSocket } from 'ws';
import * as jwt from 'jsonwebtoken';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import * as express from 'express';
import * as dotenv from 'dotenv';
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

// Helper per estrarre tenant (logica invariata)
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
  // 1. Safety Check all'avvio
  if (!process.env.JWT_SECRET) {
    console.error('❌ FATAL: JWT_SECRET is not defined in .env. Exiting.');
    process.exit(1);
  }

  // 2. Creazione App con configurazione specifica per il Body Parser
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    bodyParser: false, 
  });

  // 3. ABILITA IL PARSING DEL JSON MANUALMENTE
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  app.setGlobalPrefix('api');

  // 4. CORS (Configurazione permissiva)
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-DOFLOW-TENANT-ID',
      'x-doflow-tenant-id',
      'x-doflow-pathname',
      'Accept'
    ],
    exposedHeaders: ['Content-Length', 'X-RateLimit-Remaining', 'Retry-After'], // Aggiunto per Traffic Control
    maxAge: 86400,
  });

  // 5. VALIDATION PIPE (Attiva i DTO)
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidNonWhitelisted: false,
  }));

  // --- v3.5: ATTIVAZIONE GLOBAL MONITORING ---
  // Iniettiamo i servizi necessari per il monitoring passivo
  const telemetryService = app.get(TelemetryService);
  app.useGlobalInterceptors(new TelemetryInterceptor(telemetryService));
  app.useGlobalFilters(new GlobalExceptionFilter(telemetryService));
  // -------------------------------------------

  // Avvio Server HTTP
  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');

  // 6. Configurazione WebSocket (Dopo app.listen)
  // Manteniamo intatta tutta la tua logica WebSocket e Redis
  const httpAdapter: any = (app as any).getHttpAdapter();
  const httpServer: any = httpAdapter.getHttpServer();

  const notifications = app.get(NotificationsService);
  const wsPath = process.env.WS_PATH ?? '/ws';

  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<ClientWithMeta>();

  // Upgrade HTTP -> WS
  httpServer.on('upgrade', (req: any, socket: any, head: Buffer) => {
    try {
      const url = req.url ?? '/';
      const fullUrl = new URL(url, `http://${req.headers.host || 'localhost'}`);
      
      if (fullUrl.pathname !== wsPath) return; // Ignora path non WS

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch (e) {
      console.error('[UPGRADE] error parsing URL', e);
      socket.destroy();
    }
  });

  // Gestione Connessione
  wss.on('connection', (socket: ClientWithMeta, req: any) => {
    try {
      const urlStr = req.url ?? '/';
      const fullUrl = new URL(urlStr, `http://${req.headers.host || 'localhost'}`);
      const token = fullUrl.searchParams.get('token');

      if (!token) {
        socket.close(4001, 'Missing token');
        return;
      }

      // Verifica Token
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

      // Handshake
      socket.send(
        JSON.stringify({
          type: 'hello',
          payload: { tenantId: meta.tenantId, tenantSlug: meta.tenantSlug, userId: meta.userId },
        }),
      );

      // Ping/Pong
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
          console.error('[WS] Socket error', err);
          clients.delete(socket);
      });

    } catch (e) {
      console.error('[WS] Auth connection error:', (e as Error).message);
      socket.close(4002, 'Invalid or expired token');
    }
  });

  // Redis Pub/Sub -> WS
  notifications.registerHandler((channel, payload) => {
    for (const socket of clients) {
      const meta = socket.__meta;
      if (!meta) continue;

      // Logica broadcast Tenant/User
      if (channel.startsWith('tenant:')) {
        const [, tenantId] = channel.split(':');
        // Supporto per canale 'global' (per superadmin) o tenant specifico
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

  console.log(`🚀 Backend running on port ${port} (Prefix: /api, WS: ${wsPath})`);
}

bootstrap();