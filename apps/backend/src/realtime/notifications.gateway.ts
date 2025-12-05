import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server } from 'ws';
import { IncomingMessage } from 'http';
import { NotificationsService } from './notifications.service';

interface ClientMeta {
  userId: string;
  tenantId: string;
  email?: string;
}

type WsClient = WebSocket & { __meta?: ClientMeta };

// Helper per costruire l’URL della richiesta
function buildUrl(req: IncomingMessage): URL {
  const base = 'http://localhost';
  const path = req.url ?? '/';
  return new URL(path, base);
}

// 🔥 Decoder “stupido” del JWT: NON verifica la firma, serve solo per test
function decodeJwt(token: string): any {
  const parts = token.split('.');
  if (parts.length < 2) {
    throw new Error('Malformed token');
  }
  const payload = parts[1];
  const json = Buffer.from(payload, 'base64url').toString('utf8');
  return JSON.parse(json);
}

@WebSocketGateway({
  path: process.env.WS_PATH ?? '/ws',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  public server!: Server;

  private readonly clients = new Map<WsClient, ClientMeta>();

  constructor(private readonly notifications: NotificationsService) {
    // Quando Redis Pub/Sub riceve un evento, lo inoltriamo ai client interessati
    this.notifications.registerHandler((channel, payload) => {
      this.broadcastFromChannel(channel, payload);
    });
  }

  async handleConnection(client: WsClient, ...args: any[]) {
    const req = args[0] as IncomingMessage | undefined;
    if (!req) {
      client.close(4000, 'Missing request');
      return;
    }

    try {
      const url = buildUrl(req);
      const token = url.searchParams.get('token');

      if (!token) {
        client.close(4001, 'Missing token');
        return;
      }

      // ⚠️ DEV-ONLY: decodifica senza verificare la firma
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

      client.__meta = meta;
      this.clients.set(client, meta);

      // eslint-disable-next-line no-console
      console.log('[WS] client connected (NO VERIFY JWT)', meta);

      const hello = {
        type: 'hello' as const,
        payload: {
          tenantId: meta.tenantId,
          userId: meta.userId,
        },
      };
      client.send(JSON.stringify(hello));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error('[WS] connection error (decode)', e);
      client.close(4002, 'Invalid token');
    }
  }

  handleDisconnect(client: WsClient) {
    this.clients.delete(client);
  }

  private broadcastFromChannel(channel: string, payload: unknown) {
    if (channel.startsWith('tenant:')) {
      const parts = channel.split(':');
      const tenantId = parts[1];

      for (const [client, meta] of this.clients.entries()) {
        if (meta.tenantId === tenantId) {
          this.safeSend(client, {
            type: 'tenant_notification' as const,
            channel,
            payload,
          });
        }
      }
    } else if (channel.startsWith('user:')) {
      const parts = channel.split(':');
      const userId = parts[1];

      for (const [client, meta] of this.clients.entries()) {
        if (meta.userId === userId) {
          this.safeSend(client, {
            type: 'user_notification' as const,
            channel,
            payload,
          });
        }
      }
    }
  }

  private safeSend(client: WsClient, data: unknown) {
    try {
      const wsAny = client as any;
      if (wsAny.readyState === wsAny.OPEN) {
        wsAny.send(JSON.stringify(data));
      }
    } catch {
      // ignora errori singoli di invio
    }
  }
}
