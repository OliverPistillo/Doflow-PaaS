// apps/backend/src/main.ts
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NotificationsService } from './realtime/notifications.service';
import { WebSocketServer, WebSocket } from 'ws';

type ClientMeta = {
  userId: string;
  tenantId: string; // schema
  tenantSlug?: string;
  email?: string;
};

type ClientWithMeta = WebSocket & { __meta?: ClientMeta };

function decodeJwt(token: string): any {
  const parts = token.split('.');
  if (parts.length < 2) throw new Error('Malformed token');
  const payload = parts[1];
  const json = Buffer.from(payload, 'base64url').toString('utf8');
  return JSON.parse(json);
}

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
  const app = await NestFactory.create(AppModule);

  // ✅ Global prefix
  app.setGlobalPrefix('api');

  // ✅ CORS (Configurazione aggiornata per supportare header custom tenant)
  app.enableCors({
    origin: true,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    // 👇 HEADER AGGIUNTI PER IL MULTI-TENANCY
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-DOFLOW-TENANT-ID',
      'x-doflow-tenant-id', // Case-insensitive safety
      'x-doflow-pathname',
      'Accept'
    ],
    exposedHeaders: ['Content-Length'],
    maxAge: 86400,
  });

  const port = Number(process.env.PORT ?? 4000);
  await app.listen(port, '0.0.0.0');

  // ⚠️ Prendiamo il VERO http.Server da Nest via HttpAdapter
  const httpAdapter: any = (app as any).getHttpAdapter();
  const httpServer: any = httpAdapter.getHttpServer();

  const notifications = app.get(NotificationsService);
  const wsPath = process.env.WS_PATH ?? '/ws';

  // ✅ WebSocketServer in modalità "noServer"
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<ClientWithMeta>();

  // 🔍 Instradamento manuale dell'upgrade
  httpServer.on('upgrade', (req: any, socket: any, head: Buffer) => {
    try {
      const url = req.url ?? '/';
      const fullUrl = new URL(url, 'http://localhost');
      if (fullUrl.pathname !== wsPath) return;

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[UPGRADE] error parsing URL', e);
      socket.destroy();
    }
  });

  // 🔗 Gestione connessione WS
  wss.on('connection', (socket: ClientWithMeta, req: any) => {
    try {
      const urlStr = req.url ?? '/';
      const fullUrl = new URL(urlStr, 'http://localhost');
      const token = fullUrl.searchParams.get('token');

      if (!token) {
        socket.close(4001, 'Missing token');
        return;
      }

      const decoded: any = decodeJwt(token);
      const { tenantId, tenantSlug } = pickTenantFromJwt(decoded);

      const meta: ClientMeta = {
        userId: String(decoded.sub),
        tenantId,
        tenantSlug,
        email: decoded.email as string | undefined,
      };

      socket.__meta = meta;
      clients.add(socket);

      // handshake
      socket.send(
        JSON.stringify({
          type: 'hello',
          payload: { tenantId: meta.tenantId, tenantSlug: meta.tenantSlug, userId: meta.userId },
        }),
      );

      // probe health ping/pong
      socket.on('message', (data: any) => {
        try {
          const raw =
            typeof data === 'string'
              ? data
              : Buffer.isBuffer(data)
                ? data.toString('utf8')
                : data?.toString?.('utf8');

          if (!raw) return;
          const msg = JSON.parse(raw);

          if (msg?.type === 'health_ping' && typeof msg?.nonce === 'string') {
            if (socket.readyState === WebSocket.OPEN) {
              socket.send(
                JSON.stringify({
                  type: 'health_pong',
                  nonce: msg.nonce,
                  ts: new Date().toISOString(),
                }),
              );
            }
          }
        } catch {
          // ignore
        }
      });

      socket.on('close', () => clients.delete(socket));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[WS] connection error', e);
      socket.close(4002, 'Invalid token');
    }
  });

  // 🔁 Redis Pub/Sub → WebSocket clients
  notifications.registerHandler((channel, payload) => {
    for (const socket of clients) {
      const meta = socket.__meta;
      if (!meta) continue;

      if (channel.startsWith('tenant:')) {
        const [, tenantId] = channel.split(':');
        if (meta.tenantId !== tenantId) continue;

        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: 'tenant_notification', channel, payload }));
          } catch {}
        }
      } else if (channel.startsWith('user:')) {
        const [, userId] = channel.split(':');
        if (meta.userId !== userId) continue;

        if (socket.readyState === WebSocket.OPEN) {
          try {
            socket.send(JSON.stringify({ type: 'user_notification', channel, payload }));
          } catch {}
        }
      }
    }
  });

  // eslint-disable-next-line no-console
  console.log(`✅ Backend running on http://0.0.0.0:${port} (WS path: ${wsPath})`);
}

bootstrap();