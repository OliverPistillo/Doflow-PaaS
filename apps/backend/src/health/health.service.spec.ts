import { AddressInfo } from 'net';
import * as jwt from 'jsonwebtoken';
import { WebSocket, WebSocketServer } from 'ws';
import {
  createHealthProbeToken,
  statusFromChecks,
  wsCheckFromProbe,
  wsProbe,
} from './health.service';

const JWT_SECRET = 'health-probe-test-secret-with-sufficient-length';

describe('HealthService realtime probe contract', () => {
  const servers: WebSocketServer[] = [];

  async function server(
    onConnection: (socket: WebSocket) => void,
  ): Promise<string> {
    const instance = new WebSocketServer({ host: '127.0.0.1', port: 0 });
    servers.push(instance);
    instance.on('connection', onConnection);
    await new Promise<void>((resolve) => instance.once('listening', resolve));
    const address = instance.address() as AddressInfo;
    return `ws://127.0.0.1:${address.port}`;
  }

  afterEach(async () => {
    await Promise.all(
      servers.splice(0).map(
        (instance) =>
          new Promise<void>((resolve) => {
            for (const client of instance.clients) client.terminate();
            instance.close(() => resolve());
          }),
      ),
    );
  });

  it('signs a short-lived HS256 token accepted only by the configured secret', () => {
    const token = createHealthProbeToken(JWT_SECRET);
    const complete = jwt.decode(token, { complete: true });
    const verified = jwt.verify(token, JWT_SECRET, { algorithms: ['HS256'] }) as jwt.JwtPayload;

    expect(complete?.header.alg).toBe('HS256');
    expect(complete?.header.alg).not.toBe('none');
    expect(verified).toMatchObject({
      sub: 'health-probe',
      tenantId: 'public',
      role: 'superadmin',
      authStage: 'FULL',
    });
    expect((verified.exp ?? 0) - (verified.iat ?? 0)).toBeGreaterThanOrEqual(30);
    expect((verified.exp ?? 0) - (verified.iat ?? 0)).toBeLessThanOrEqual(60);
    expect(() => jwt.verify(token, 'wrong-health-probe-secret')).toThrow();
  });

  it('marks the websocket healthy only after the matching nonce pong', async () => {
    const url = await server((socket) => {
      socket.on('message', (data) => {
        const message = JSON.parse(data.toString('utf8'));
        socket.send(JSON.stringify({ type: 'health_pong', nonce: message.nonce }));
      });
    });

    const result = await wsProbe(url, 200);

    expect(result.ok).toBe(true);
    expect(wsCheckFromProbe(result).status).toBe('ok');
  });

  it('keeps a connection closed before pong in warn', async () => {
    const url = await server((socket) => socket.close());

    const result = await wsProbe(url, 200);

    expect(result).toMatchObject({ ok: false, message: 'closed before pong' });
    expect(wsCheckFromProbe(result).status).toBe('warn');
  });

  it('keeps a websocket timeout in warn', async () => {
    const url = await server(() => undefined);

    const result = await wsProbe(url, 40);

    expect(result.ok).toBe(false);
    expect(result.message).toContain('timeout');
    expect(wsCheckFromProbe(result).status).toBe('warn');
  });

  it('preserves real warn and down states when aggregating checks', () => {
    expect(statusFromChecks({ api: { status: 'ok' }, ws: { status: 'ok' } })).toBe('ok');
    expect(statusFromChecks({ api: { status: 'ok' }, ws: { status: 'warn' } })).toBe('warn');
    expect(statusFromChecks({ api: { status: 'down' }, ws: { status: 'warn' } })).toBe('down');
  });
});
