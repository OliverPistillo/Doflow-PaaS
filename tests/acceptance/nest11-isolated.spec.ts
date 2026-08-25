import { expect, request as apiRequest, test } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const runtimeConfigPath = path.join(root, '.visual-runtime', 'commercial-core-stack.json');
const credentialPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Queue, QueueEvents, Worker } = backendRequire('bullmq');

type RuntimeConfig = {
  redisHost: string;
  redisPort: number;
  stripeWebhookSecret: string;
};

type Credentials = { password: string };

async function backendHealth() {
  const deadline = Date.now() + 30_000;
  let response: Response | null = null;
  while (Date.now() < deadline) {
    try {
      const candidate = await fetch('http://localhost:3401/api/health/system');
      if (candidate.status === 200) {
        response = candidate;
        break;
      }
    } catch {
      // A Windows restart can reset the first socket while the listener settles.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  if (!response) throw new Error('Isolated backend health did not stabilize after restart.');
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body.checks).toMatchObject({
    api: { status: 'ok' },
    db: { status: expect.not.stringMatching(/^down$/) },
    redis: { status: expect.not.stringMatching(/^down$/) },
  });
}

function restartBackend() {
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/commercial-core-isolated-stack.mjs'), 'restart-backend'],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0) throw new Error('Unable to restart isolated backend.');
}

async function login(email: string, password: string) {
  const context = await apiRequest.newContext({
    extraHTTPHeaders: {
      Origin: 'http://localhost:3100',
      'X-Doflow-Web': '1',
    },
  });
  const response = await context.post('http://localhost:3401/api/auth/login', {
    data: { email, password, rememberMe: false },
  });
  expect(response.status()).toBe(201);
  expect(await response.json()).not.toHaveProperty('token');
  return context;
}

test('Nest 11 isolated HTTP, tenant, Builder, webhook and restart smoke', async ({ request }) => {
  const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8')) as RuntimeConfig;
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  await backendHealth();

  expect((await request.get('http://localhost:3401/api/docs')).status()).toBe(200);
  const staticAsset = await request.get(
    'http://localhost:3401/public/forms/doflow-lead-intake.v1.js',
  );
  expect(staticAsset.status()).toBe(200);
  expect(await staticAsset.text()).toContain('doflow');

  const publicLead = await request.post('http://localhost:3401/api/public/lead-intake/doflow', {
    data: {
      submission_id: randomUUID(),
      form_version: 'doflow-contact-v1',
      project_type: 'Sito vetrina',
      goals: ['Ricevere più contatti'],
      timeline: 'Sto valutando',
      name: 'Synthetic Nest Acceptance',
      email: 'nest11.public@acceptance.invalid',
      phone: '+39000000000',
      province: 'Test',
      privacy_accepted: true,
      landing_url: 'http://localhost:3100/nest11-acceptance',
      completion_seconds: 10,
    },
  });
  expect(publicLead.status()).toBe(200);
  expect(await publicLead.json()).toMatchObject({ success: true, duplicate: false });

  const unknown = await request.get('http://localhost:3401/api/not-a-real-route');
  expect(unknown.status()).toBe(404);

  const manager = await login('visual.manager@acceptance.invalid', credentials.password);
  const builder = await manager.get('http://localhost:3401/api/tenant/commercial/site-proposals');
  expect(builder.status()).toBe(200);

  const secondary = await login('secondary.owner@acceptance.invalid', credentials.password);
  const crossTenantBuilder = await secondary.get(
    'http://localhost:3401/api/tenant/commercial/site-proposals',
    { headers: { 'X-Doflow-Tenant-Id': 'doflow' } },
  );
  expect(crossTenantBuilder.status()).toBe(403);

  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({
      id: `evt_${randomUUID().replaceAll('-', '')}`,
      object: 'event',
      type: 'nest11.compatibility.checked',
      created: timestamp,
      livemode: false,
      pending_webhooks: 0,
      request: null,
      data: { object: {} },
    });
    const digest = createHmac('sha256', config.stripeWebhookSecret)
      .update(`${timestamp}.${payload}`)
      .digest('hex');
    const webhook = await request.post('http://localhost:3401/api/billing/webhook', {
      headers: {
        'content-type': 'application/json',
        'stripe-signature': `t=${timestamp},v1=${digest}`,
      },
      data: payload,
    });
    expect(webhook.status()).toBe(200);
    expect(await webhook.json()).toEqual({ received: true });
  } finally {
    await manager.dispose();
    await secondary.dispose();
  }

  restartBackend();
  await backendHealth();
});

test('CORS accepts the configured origin and rejects foreign origins without 500', async ({ request }) => {
  const endpoint = 'http://localhost:3401/api/health/system';
  const mutativeEndpoint = 'http://localhost:3401/api/auth/logout';
  const allowedOrigin = 'http://localhost:3100';
  const foreignOrigin = 'https://foreign-origin.acceptance.invalid';

  const allowedPreflight = await request.fetch(endpoint, {
    method: 'OPTIONS',
    headers: {
      Origin: allowedOrigin,
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'x-doflow-web',
    },
  });
  expect(allowedPreflight.status()).toBe(204);
  expect(allowedPreflight.headers()['access-control-allow-origin']).toBe(allowedOrigin);
  expect(allowedPreflight.headers()['access-control-allow-credentials']).toBe('true');

  const allowedSimple = await request.get(endpoint, {
    headers: { Origin: allowedOrigin },
  });
  expect(allowedSimple.status()).toBe(200);
  expect(allowedSimple.headers()['access-control-allow-origin']).toBe(allowedOrigin);
  expect(allowedSimple.headers()['access-control-allow-credentials']).toBe('true');

  const allowedMutativePreflight = await request.fetch(mutativeEndpoint, {
    method: 'OPTIONS',
    headers: {
      Origin: allowedOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-doflow-web,x-csrf-token',
    },
  });
  expect(allowedMutativePreflight.status()).toBe(204);
  expect(allowedMutativePreflight.headers()['access-control-allow-origin']).toBe(allowedOrigin);
  expect(allowedMutativePreflight.headers()['access-control-allow-credentials']).toBe('true');

  const foreignPreflight = await request.fetch(mutativeEndpoint, {
    method: 'OPTIONS',
    headers: {
      Origin: foreignOrigin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-doflow-web,x-csrf-token',
    },
  });
  const foreignSimple = await request.get(endpoint, {
    headers: { Origin: foreignOrigin },
  });
  const foreignMutative = await request.post(mutativeEndpoint, {
    headers: {
      Origin: foreignOrigin,
      'content-type': 'application/json',
      'X-Doflow-Web': '1',
    },
    data: {},
  });

  for (const response of [foreignPreflight, foreignSimple, foreignMutative]) {
    expect(response.status()).toBe(403);
    expect(response.status()).toBeLessThan(500);
    expect(response.headers()).not.toHaveProperty('access-control-allow-origin');
    expect(response.headers()).not.toHaveProperty('access-control-allow-credentials');
    const body = await response.text();
    expect(body).toContain('Origine CORS non autorizzata');
    expect(body).not.toContain(foreignOrigin);
    expect(body).not.toContain('SYSTEM_ERROR');
  }
});

test('BullMQ processes, retries and deduplicates jobs on isolated Redis', async () => {
  const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8')) as RuntimeConfig;
  const queueName = `nest11-acceptance-${randomUUID()}`;
  const connection = {
    host: config.redisHost,
    port: config.redisPort,
    maxRetriesPerRequest: null,
  };
  const queue = new Queue(queueName, { connection });
  const events = new QueueEvents(queueName, { connection });
  let executions = 0;
  const worker = new Worker(queueName, async () => {
    executions += 1;
    if (executions === 1) throw new Error('synthetic retry');
    return { processed: true };
  }, { connection });

  try {
    await Promise.all([worker.waitUntilReady(), events.waitUntilReady()]);
    const first = await queue.add('nest11-smoke', { synthetic: true }, {
      jobId: 'stable-idempotency-key',
      attempts: 2,
      backoff: { type: 'fixed', delay: 50 },
    });
    const duplicate = await queue.add('nest11-smoke', { synthetic: true }, {
      jobId: 'stable-idempotency-key',
      attempts: 2,
      backoff: { type: 'fixed', delay: 50 },
    });
    expect(duplicate.id).toBe(first.id);
    await expect(first.waitUntilFinished(events, 15_000)).resolves.toEqual({ processed: true });
    expect(executions).toBe(2);
  } finally {
    await worker.close();
    await events.close();
    await queue.obliterate({ force: true });
    await queue.close();
  }
});
