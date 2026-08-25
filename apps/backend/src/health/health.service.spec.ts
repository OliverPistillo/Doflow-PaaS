import { AddressInfo } from 'net';
import type { IncomingMessage } from 'http';
import { WebSocket, WebSocketServer } from 'ws';
import {
  statusFromChecks,
  wsCheckFromProbe,
  wsProbe,
} from './health.service';
import {
  createHealthProbeSignature,
  verifyHealthProbeSignature,
} from './health-probe-signature';

const JWT_SECRET = 'health-probe-test-secret-with-sufficient-length';

describe('HealthService realtime probe contract', () => {
  const servers: WebSocketServer[] = [];

  async function server(
    onConnection: (socket: WebSocket, request: IncomingMessage) => void,
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

  it('signs a short-lived internal probe without creating an auth identity', () => {
    const now = Date.now();
    const signature = createHealthProbeSignature(
      JWT_SECRET,
      now,
      '0123456789abcdef0123456789abcdef',
    );

    expect(signature.split('.')).toHaveLength(3);
    expect(verifyHealthProbeSignature(signature, JWT_SECRET, now + 44_999)).toBe(true);
    expect(verifyHealthProbeSignature(signature, JWT_SECRET, now + 45_001)).toBe(false);
    expect(verifyHealthProbeSignature(signature, 'wrong-health-probe-secret', now)).toBe(false);
    expect(verifyHealthProbeSignature(`${signature}00`, JWT_SECRET, now)).toBe(false);
  });

  it('marks the websocket healthy only after the matching nonce pong', async () => {
    const url = await server((socket, request) => {
      expect(request.url).not.toContain('token=');
      expect(request.headers['x-doflow-health-probe']).toBe('signed-internal-probe');
      socket.on('message', (data) => {
        const message = JSON.parse(data.toString('utf8'));
        socket.send(JSON.stringify({ type: 'health_pong', nonce: message.nonce }));
      });
    });

    const result = await wsProbe(url, 200, {
      Origin: 'http://localhost:3100',
      'X-Doflow-Health-Probe': 'signed-internal-probe',
    });

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
