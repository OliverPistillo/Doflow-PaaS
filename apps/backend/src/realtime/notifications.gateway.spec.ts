import WebSocket from 'ws';
import { NotificationsGateway } from './notifications.gateway';

function client() {
  return {
    readyState: WebSocket.OPEN,
    send: jest.fn(),
    close: jest.fn(),
  } as any;
}

describe('NotificationsGateway cookie session authority', () => {
  const fullSession = {
    user: {
      id: 'user-1',
      sub: 'user-1',
      tenantId: 'doflow',
      tenantSlug: 'doflow',
      authStage: 'FULL',
    },
  };

  function fixture(session: any = fullSession) {
    const notifications = { registerHandler: jest.fn().mockResolvedValue(undefined) };
    const webSessions = { resolve: jest.fn().mockResolvedValue(session) };
    return {
      webSessions,
      gateway: new NotificationsGateway(notifications as any, webSessions as any),
    };
  }

  it('accetta una sessione cookie FULL senza bearer e invia hello tenant-scoped', async () => {
    const { gateway, webSessions } = fixture();
    const socket = client();
    const request = { headers: { origin: 'http://localhost:3100', cookie: 'doflow_session=opaque' } };
    await gateway.handleConnection(socket, request);
    expect(webSessions.resolve).toHaveBeenCalledWith(request);
    expect(socket.close).not.toHaveBeenCalled();
    expect(socket.send).toHaveBeenCalledWith(expect.stringContaining('"tenantId":"doflow"'));
    gateway.handleDisconnect(socket);
  });

  it('rifiuta origin non consentita prima di risolvere la sessione', async () => {
    const { gateway, webSessions } = fixture();
    const socket = client();
    await gateway.handleConnection(socket, { headers: { origin: 'https://evil.invalid' } });
    expect(socket.close).toHaveBeenCalledWith(4003, 'Origin not allowed');
    expect(webSessions.resolve).not.toHaveBeenCalled();
  });

  it.each(['MFA_PENDING', 'MFA_SETUP_NEEDED', null])(
    'rifiuta sessione business non FULL: %s',
    async (stage) => {
      const session = stage ? { user: { ...fullSession.user, authStage: stage } } : null;
      const { gateway } = fixture(session);
      const socket = client();
      await gateway.handleConnection(socket, { headers: { origin: 'http://localhost:3100' } });
      expect(socket.close).toHaveBeenCalledWith(4001, 'Session required');
    },
  );

  it('chiude la connessione quando la sessione Redis viene revocata', async () => {
    const { gateway, webSessions } = fixture();
    const socket = client();
    const request = { headers: { origin: 'http://localhost:3100', cookie: 'doflow_session=opaque' } };
    await gateway.handleConnection(socket, request);
    webSessions.resolve.mockResolvedValueOnce(null);
    await (gateway as any).revalidate(socket);
    expect(socket.close).toHaveBeenCalledWith(4001, 'Session revoked');
  });

  it('isola lo stesso userId per tenant e ignora i vecchi canali user tenantless', () => {
    const { gateway } = fixture();
    const tenantA = client();
    const tenantB = client();
    const meta = (tenantId: string) => ({
      userId: 'shared-user', tenantId, request: {}, heartbeat: setInterval(() => undefined, 60_000), presenceId: 'presence',
    });
    (gateway as any).clients.set(tenantA, meta('tenant_a'));
    (gateway as any).clients.set(tenantB, meta('tenant_b'));

    (gateway as any).broadcastFromChannel('tenant-user:tenant_a:shared-user', { ok: true });
    expect(tenantA.send).toHaveBeenCalledTimes(1);
    expect(tenantB.send).not.toHaveBeenCalled();

    tenantA.send.mockClear();
    (gateway as any).broadcastFromChannel('user:shared-user', { legacy: true });
    expect(tenantA.send).not.toHaveBeenCalled();
    expect(tenantB.send).not.toHaveBeenCalled();
    for (const entry of (gateway as any).clients.values()) clearInterval(entry.heartbeat);
  });
});
