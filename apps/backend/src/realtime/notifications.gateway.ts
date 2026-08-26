import {
  OnGatewayConnection,
  OnGatewayDisconnect,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, Optional } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { IncomingMessage } from 'http';
import WebSocket, { Server } from 'ws';
import { WebSessionService } from '../auth/web-session.service';
import { NotificationsService } from './notifications.service';
import { PresenceRegistryService } from './presence-registry.service';

interface ClientMeta {
  userId: string;
  tenantId: string;
  request: IncomingMessage;
  heartbeat: ReturnType<typeof setInterval>;
  presenceId: string;
}

type WsClient = WebSocket & { __meta?: ClientMeta };

function normalizedOrigin(value: string) {
  try { return new URL(value).origin.toLowerCase(); } catch { return ''; }
}

@WebSocketGateway({ path: process.env.WS_PATH ?? '/ws' })
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  public server!: Server;

  private readonly clients = new Map<WsClient, ClientMeta>();

  constructor(
    private readonly notifications: NotificationsService,
    private readonly webSessions: WebSessionService,
    @Optional() private readonly presence?: PresenceRegistryService,
  ) {
    void this.notifications.registerHandler((channel, payload) => this.broadcastFromChannel(channel, payload))
      .catch(() => this.logger.error('Realtime Redis subscriber unavailable'));
  }

  private originAllowed(req: IncomingMessage) {
    const origin = normalizedOrigin(String(req.headers.origin || ''));
    const configured = String(process.env.CORS_ORIGINS || 'https://app.doflow.it')
      .split(',').map((item) => normalizedOrigin(item.trim())).filter(Boolean);
    if (process.env.NODE_ENV !== 'production') configured.push('http://localhost:3100');
    return Boolean(origin && new Set(configured).has(origin));
  }

  async handleConnection(client: WsClient, ...args: any[]) {
    const req = args[0] as IncomingMessage | undefined;
    if (!req || !this.originAllowed(req)) {
      client.close(4003, 'Origin not allowed');
      return;
    }
    try {
      const session = await this.webSessions.resolve(req as any);
      if (!session || session.user.authStage !== 'FULL') {
        client.close(4001, 'Session required');
        return;
      }
      const userId = String(session.user.id || session.user.sub || '');
      const tenantId = String(session.user.tenantId || '').toLowerCase();
      if (!userId || !tenantId || tenantId === 'public') {
        client.close(4002, 'Invalid session');
        return;
      }
      const presenceId = randomUUID();
      const heartbeat = setInterval(() => { void this.revalidate(client); }, 25_000);
      heartbeat.unref?.();
      const meta: ClientMeta = { userId, tenantId, request: req, heartbeat, presenceId };
      client.__meta = meta;
      this.clients.set(client, meta);
      await this.presence?.heartbeat(tenantId, userId, presenceId, 'online', 'ws');
      this.safeSend(client, { type: 'hello', payload: { tenantId, userId } });
    } catch {
      client.close(4002, 'Invalid session');
    }
  }

  handleDisconnect(client: WsClient) {
    const meta = this.clients.get(client);
    if (meta) clearInterval(meta.heartbeat);
    this.clients.delete(client);
    if (meta) void this.presence?.disconnect(meta.tenantId, meta.userId, meta.presenceId).catch(() => undefined);
  }

  private async revalidate(client: WsClient) {
    const meta = this.clients.get(client);
    if (!meta) return;
    try {
      const session = await this.webSessions.resolve(meta.request as any);
      const valid = session?.user.authStage === 'FULL'
        && String(session.user.id || session.user.sub) === meta.userId
        && String(session.user.tenantId).toLowerCase() === meta.tenantId;
      if (!valid) {
        client.close(4001, 'Session revoked');
        this.handleDisconnect(client);
        return;
      }
      this.safeSend(client, { type: 'heartbeat', timestamp: new Date().toISOString() });
      await this.presence?.heartbeat(meta.tenantId, meta.userId, meta.presenceId, 'online', 'ws');
    } catch {
      client.close(1011, 'Session validation unavailable');
      this.handleDisconnect(client);
    }
  }

  private broadcastFromChannel(channel: string, payload: unknown) {
    const [scope, id, userId] = channel.split(':');
    for (const [client, meta] of this.clients.entries()) {
      const tenantUser = scope === 'tenant-user' && meta.tenantId === id && meta.userId === userId;
      if ((scope === 'tenant' && meta.tenantId === id) || tenantUser) {
        this.safeSend(client, { type: scope === 'tenant' ? 'tenant_notification' : 'user_notification', channel, payload });
      }
    }
  }

  private safeSend(client: WsClient, data: unknown) {
    try {
      if (client.readyState === WebSocket.OPEN) client.send(JSON.stringify(data));
    } catch {
      this.handleDisconnect(client);
    }
  }
}
