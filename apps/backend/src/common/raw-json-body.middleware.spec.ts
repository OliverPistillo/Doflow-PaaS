import { HttpException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import express = require('express');
import type { AddressInfo } from 'node:net';
import { AccessToken } from 'livekit-server-sdk';
import { TenantCallsLivekitProviderService } from '../tenant/tenant-calls-livekit-provider.service';
import { TenantCallsPublicService } from '../tenant/tenant-calls-public.service';
import { createDoflowJsonBodyParser } from './raw-json-body.middleware';

type RawBodyRequest = express.Request & { rawBody?: Buffer };

async function withServer(app: express.Express, run: (baseUrl: string) => Promise<void>) {
  const server = app.listen(0);
  try {
    await new Promise<void>((resolve, reject) => {
      server.once('listening', resolve);
      server.once('error', reject);
    });
    const address = server.address() as AddressInfo;
    await run(`http://127.0.0.1:${address.port}`);
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
}

function captureApp() {
  const app = express();
  app.use(createDoflowJsonBodyParser('1mb'));
  app.post('/capture', (request: express.Request, response: express.Response) => {
    const rawBody = (request as RawBodyRequest).rawBody;
    response.json({
      hasRawBody: Buffer.isBuffer(rawBody),
      rawBody: rawBody?.toString('base64') ?? null,
      parsedBody: request.body ?? null,
    });
  });
  app.post('/normal-json', (request: express.Request, response: express.Response) => {
    if (!request.body || typeof request.body !== 'object' || request.body.action !== 'ping') {
      response.status(422).json({ error: 'INVALID_ACTION' });
      return;
    }
    response.status(200).json({ accepted: true, action: request.body.action });
  });
  return app;
}

describe('createDoflowJsonBodyParser', () => {
  const exactBody = '{\n  "event": "room_started",\n  "room": { "name": "probe" }\n}\n';

  it.each([
    'application/json',
    'application/webhook+json',
    'application/webhook+json; charset=utf-8',
  ])('preserves exact bytes and parses the JSON body for %s', async (contentType) => {
    await withServer(captureApp(), async (baseUrl) => {
      const result = await fetch(`${baseUrl}/capture`, {
        method: 'POST',
        headers: { 'content-type': contentType },
        body: exactBody,
      });

      expect(result.status).toBe(200);
      await expect(result.json()).resolves.toEqual({
        hasRawBody: true,
        rawBody: Buffer.from(exactBody).toString('base64'),
        parsedBody: {
          event: 'room_started',
          room: { name: 'probe' },
        },
      });
    });
  });

  it('does not consume an unrelated content type as webhook JSON', async () => {
    await withServer(captureApp(), async (baseUrl) => {
      const result = await fetch(`${baseUrl}/capture`, {
        method: 'POST',
        headers: { 'content-type': 'text/plain; charset=utf-8' },
        body: exactBody,
      });

      expect(result.status).toBe(200);
      await expect(result.json()).resolves.toEqual({
        hasRawBody: false,
        rawBody: null,
        parsedBody: {},
      });
    });
  });

  it('keeps ordinary JSON endpoints parsed and able to validate input', async () => {
    await withServer(captureApp(), async (baseUrl) => {
      const accepted = await fetch(`${baseUrl}/normal-json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'ping' }),
      });
      expect(accepted.status).toBe(200);
      await expect(accepted.json()).resolves.toEqual({ accepted: true, action: 'ping' });

      const rejected = await fetch(`${baseUrl}/normal-json`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'unsupported' }),
      });
      expect(rejected.status).toBe(422);
      await expect(rejected.json()).resolves.toEqual({ error: 'INVALID_ACTION' });
    });
  });
});

describe('LiveKit webhook HTTP integration', () => {
  const originalEnvironment = { ...process.env };
  const apiKey = 'webhook-test-key';
  const apiSecret = 'webhook-test-secret-with-enough-entropy';
  const exactBody = '{\n  "id": "event-safe-test",\n  "event": "room_started",\n  "room": { "name": "df-unknown-test-room" }\n}\n';

  beforeEach(() => {
    process.env.LIVEKIT_ENABLED = 'true';
    process.env.LIVEKIT_URL = 'wss://calls.example.test';
    process.env.LIVEKIT_API_KEY = apiKey;
    process.env.LIVEKIT_API_SECRET = apiSecret;
  });

  afterAll(() => {
    process.env = originalEnvironment;
  });

  async function authorization(body: string) {
    const token = new AccessToken(apiKey, apiSecret);
    token.sha256 = createHash('sha256').update(Buffer.from(body)).digest('base64');
    return token.toJwt();
  }

  function webhookApp() {
    const store = {
      resolveRoom: jest.fn().mockResolvedValue(null),
      markWebhookEvent: jest.fn(),
      transition: jest.fn(),
      publishState: jest.fn(),
    };
    const provider = new TenantCallsLivekitProviderService();
    const service = new TenantCallsPublicService({} as never, store as never, provider);
    const app = express();
    app.use(createDoflowJsonBodyParser('1mb'));
    app.post('/api/public/desktop-calls/webhook/livekit', async (request, response) => {
      try {
        const result = await service.webhook(
          (request as RawBodyRequest).rawBody,
          request.header('authorization'),
        );
        response.status(201).json(result);
      } catch (error) {
        const status = error instanceof HttpException ? error.getStatus() : 500;
        response.status(status).json({ statusCode: status });
      }
    });
    return { app, store };
  }

  it.each([
    'application/json',
    'application/webhook+json',
    'application/webhook+json; charset=utf-8',
  ])('accepts an SDK-signed exact body with %s and safely ignores an unknown room', async (contentType) => {
    const { app, store } = webhookApp();
    await withServer(app, async (baseUrl) => {
      const result = await fetch(`${baseUrl}/api/public/desktop-calls/webhook/livekit`, {
        method: 'POST',
        headers: {
          authorization: await authorization(exactBody),
          'content-type': contentType,
        },
        body: exactBody,
      });

      expect(result.status).toBe(201);
      await expect(result.json()).resolves.toEqual({ received: true, ignored: 'room-unknown' });
      expect(store.resolveRoom).toHaveBeenCalledWith('df-unknown-test-room');
      expect(store.markWebhookEvent).not.toHaveBeenCalled();
      expect(store.transition).not.toHaveBeenCalled();
      expect(store.publishState).not.toHaveBeenCalled();
    });
  });

  it('rejects a missing, invalid, or body-mismatched signature', async () => {
    const { app } = webhookApp();
    await withServer(app, async (baseUrl) => {
      const endpoint = `${baseUrl}/api/public/desktop-calls/webhook/livekit`;
      const missing = await fetch(endpoint, {
        method: 'POST',
        headers: { 'content-type': 'application/webhook+json' },
        body: exactBody,
      });
      expect(missing.status).toBe(401);

      const invalid = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: 'invalid-signature-marker',
          'content-type': 'application/webhook+json',
        },
        body: exactBody,
      });
      expect(invalid.status).toBe(401);

      const changedBody = exactBody.replace('room_started', 'room_finished');
      const mismatched = await fetch(endpoint, {
        method: 'POST',
        headers: {
          authorization: await authorization(exactBody),
          'content-type': 'application/webhook+json; charset=utf-8',
        },
        body: changedBody,
      });
      expect(mismatched.status).toBe(401);
    });
  });

  it('does not log the Authorization value when verification fails', async () => {
    const marker = 'invalid-authorization-must-not-be-logged';
    const spies = [
      jest.spyOn(console, 'log').mockImplementation(() => undefined),
      jest.spyOn(console, 'warn').mockImplementation(() => undefined),
      jest.spyOn(console, 'error').mockImplementation(() => undefined),
    ];
    try {
      const { app } = webhookApp();
      await withServer(app, async (baseUrl) => {
        const result = await fetch(`${baseUrl}/api/public/desktop-calls/webhook/livekit`, {
          method: 'POST',
          headers: {
            authorization: marker,
            'content-type': 'application/webhook+json',
          },
          body: exactBody,
        });
        expect(result.status).toBe(401);
        expect(await result.text()).not.toContain(marker);
      });
      expect(spies.flatMap((spy) => spy.mock.calls).join(' ')).not.toContain(marker);
    } finally {
      spies.forEach((spy) => spy.mockRestore());
    }
  });
});
