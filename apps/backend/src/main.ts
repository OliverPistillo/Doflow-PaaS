import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { NotificationsService } from './realtime/notifications.service';
import { WebSocketServer, WebSocket } from 'ws';

type ClientMeta = {
  userId: string;
  tenantId: string;
  email?: string;
};

type ClientWithMeta = WebSocket & { __meta?: ClientMeta };

function decodeJwt(token: string): any {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Malformed token');
  }
  const payload = parts[1];
  const json = Buffer.from(payload, 'base64url').toString('utf8');
  return JSON.parse(json);
}

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // 🔥 QUESTA È LA RIGA MANCANTE CHE RISOLVE IL 404
  app.setGlobalPrefix('api'); 

  app.enableCors({
    origin: true,
    credentials: true,
  });

  const port = 4000;
  await app.listen(port);

  // ⚠️ Prendiamo il VERO http.Server da Nest via HttpAdapter
  const httpAdapter: any = (app as any).getHttpAdapter();
  const httpServer: any = httpAdapter.getHttpServer();

  const notifications = app.get(NotificationsService);
  const wsPath = process.env.WS_PATH ?? '/ws';

  // 🔥 WebSocketServer in modalità "noServer"
  const wss = new WebSocketServer({ noServer: true });
  const clients = new Set<ClientWithMeta>();

  // 🔍 Log e instradamento manuale dell'upgrade
  httpServer.on('upgrade', (req: any, socket: any, head: Buffer) => {
    const url = req.url ?? '/';

    // eslint-disable-next-line no-console
    console.log(
      '[UPGRADE RAW]',
      'url=',
      url,
      'host=',
      req.headers?.host,
    );

    try {
      const fullUrl = new URL(url, 'http://localhost');
      if (fullUrl.pathname !== wsPath) {
        return;
      }

      wss.handleUpgrade(req, socket, head, (ws) => {
        wss.emit('connection', ws, req);
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[UPGRADE RAW] error parsing URL', e);
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

      const meta: ClientMeta = {
        userId: String(decoded.sub),
        tenantId:
          (decoded.tenantId ??
            decoded.tenant_id ??
            decoded.tenant ??
            'public') as string,
        email: decoded.email as string | undefined,
      };

      socket.__meta = meta;
      clients.add(socket);

      // eslint-disable-next-line no-console
      console.log('[WS RAW] client connected', meta);

      const hello = {
        type: 'hello' as const,
        payload: {
          tenantId: meta.tenantId,
          userId: meta.userId,
        },
      };
      socket.send(JSON.stringify(hello));

      socket.on('close', () => {
        clients.delete(socket);
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[WS RAW] connection error', e);
      socket.close(4002, 'Invalid token');
    }
  });

  // 🔁 Collega Redis Pub/Sub → WebSocket clients
  notifications.registerHandler((channel, payload) => {
    for (const socket of clients) {
      const meta = socket.__meta;
      if (!meta) continue;

      if (channel.startsWith('tenant:')) {
        const [, tenantId] = channel.split(':');
        if (meta.tenantId !== tenantId) continue;

        const msg = {
          type: 'tenant_notification' as const,
          channel,
          payload,
        };
        try {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(msg));
          }
        } catch {
          // ignore
        }
      } else if (channel.startsWith('user:')) {
        const [, userId] = channel.split(':');
        if (meta.userId !== userId) continue;

        const msg = {
          type: 'user_notification' as const,
          channel,
          payload,
        };
        try {
          if (socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify(msg));
          }
        } catch {
          // ignore
        }
      }
    }
  });

  // eslint-disable-next-line no-console
  console.log(
    `✅ Backend running on http://localhost:${port} (WS path: ${wsPath})`,
  );
}
bootstrap();