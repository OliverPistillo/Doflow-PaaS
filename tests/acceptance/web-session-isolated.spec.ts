import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test';
import { createHash, createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const runtimeConfigPath = path.join(root, '.visual-runtime', 'commercial-core-stack.json');
const credentialPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const Redis = backendRequire('ioredis').default;

type Credentials = { email: string; password: string; mfaSecret: string };
type AppResult = { status: number; ok: boolean; json: any; text: string };

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/=+$/g, '');
  let bits = '';
  for (const character of normalized) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string, intervalOffset = 0) {
  const counter = Math.floor(Date.now() / 30_000) + intervalOffset;
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

async function stableTotp(page: Page, secret: string) {
  const remaining = 30_000 - (Date.now() % 30_000);
  if (remaining < 5_000) await page.waitForTimeout(remaining + 150);
  return totp(secret);
}

async function appFetch(
  page: Page,
  pathname: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<AppResult> {
  return page.evaluate(async ({ pathValue, request }) => {
    const method = request.method ?? 'GET';
    const csrf = document.cookie.split(';').map((part) => part.trim())
      .find((part) => part.startsWith('doflow_csrf='))?.slice('doflow_csrf='.length);
    const headers: Record<string, string> = {
      'X-Doflow-Web': '1',
      ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(request.headers ?? {}),
    };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && csrf && !headers['X-CSRF-Token']) {
      headers['X-CSRF-Token'] = decodeURIComponent(csrf);
    }
    const response = await fetch(`/api${pathValue}`, {
      method,
      headers,
      credentials: 'include',
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* retain raw response */ }
    return { status: response.status, ok: response.ok, json, text };
  }, { pathValue: pathname, request: options });
}

function observeBrowserAuth(context: BrowserContext, violations: string[]) {
  context.on('request', (request: Request) => {
    if (!new URL(request.url()).pathname.startsWith('/api/')) return;
    const authorization = request.headers().authorization;
    if (authorization) violations.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
}

async function login(
  context: BrowserContext,
  email: string,
  credentials: Credentials,
  options: { rememberMe: boolean; mfa: boolean; target: 'dashboard' | 'superadmin'; rejectExpiredTotp?: boolean },
) {
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  if (options.rememberMe) await page.getByLabel('Ricordami').check();
  const loginResponsePromise = page.waitForResponse((response) =>
    new URL(response.url()).pathname.endsWith('/api/auth/login') && response.request().method() === 'POST');
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  const loginResponse = await loginResponsePromise;
  const loginBody = await loginResponse.json();
  expect(JSON.stringify(loginBody)).not.toMatch(/"(?:token|accessToken|access_token|jwt)"\s*:/i);
  const preMfaCookie = (await context.cookies()).find((cookie) => cookie.name === 'doflow_session');
  expect(preMfaCookie?.httpOnly).toBe(true);

  if (options.mfa) {
    await page.waitForURL(/\/(?:doflow|public)\/mfa$/);
    expect((await appFetch(page, '/auth/session-stage')).json.authStage).toBe('MFA_PENDING');
    expect((await appFetch(page, '/tenant/commercial/leads')).status).toBe(403);
    if (options.rejectExpiredTotp) {
      await page.getByLabel('Codice di verifica a 6 cifre').fill(totp(credentials.mfaSecret, -2));
      await page.getByRole('button', { name: 'Verifica Codice' }).click();
      await expect(page.getByText('Codice non valido').last()).toBeVisible();
    }
    await page.getByLabel('Codice di verifica a 6 cifre').fill(await stableTotp(page, credentials.mfaSecret));
    await page.getByRole('button', { name: 'Verifica Codice' }).click();
  }

  await page.waitForURL(options.target === 'superadmin' ? /\/superadmin$/ : /\/dashboard$/);
  const session = (await context.cookies()).find((cookie) => cookie.name === 'doflow_session');
  expect(session).toMatchObject({ httpOnly: true, secure: false, sameSite: 'Lax', path: '/' });
  if (options.mfa) expect(session?.value).not.toBe(preMfaCookie?.value);
  if (options.rememberMe) expect(Number(session?.expires)).toBeGreaterThan(Date.now() / 1000 + 86_400);
  else expect(session?.expires).toBe(-1);
  return { page, session: session!, loginBody };
}

async function assertNoBrowserAuthMaterial(page: Page) {
  const result = await page.evaluate(async () => {
    const indexed: unknown[] = [];
    for (const database of await indexedDB.databases()) {
      if (!database.name) continue;
      const opened = await new Promise<IDBDatabase | null>((resolve) => {
        const request = indexedDB.open(database.name!);
        request.onerror = () => resolve(null);
        request.onsuccess = () => resolve(request.result);
      });
      if (!opened) continue;
      for (const storeName of Array.from(opened.objectStoreNames)) {
        const values = await new Promise<unknown[]>((resolve) => {
          const request = opened.transaction(storeName).objectStore(storeName).getAll();
          request.onerror = () => resolve([]);
          request.onsuccess = () => resolve(request.result);
        });
        indexed.push({ database: database.name, storeName, values });
      }
      opened.close();
    }
    return {
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
      indexed,
      readableCookies: document.cookie,
      href: location.href,
    };
  });
  const serialized = JSON.stringify({ local: result.local, session: result.session, indexed: result.indexed });
  expect(serialized).not.toMatch(/doflow_token|access_?token|authorization|bearer|eyJ[A-Za-z0-9_-]{10,}\./i);
  expect(result.readableCookies).not.toContain('doflow_session=');
  expect(result.href).not.toMatch(/[?&](?:access_?token|jwt|bearer)=/i);
}

async function connectBusinessSocket(page: Page, expectedTenant: string) {
  await page.evaluate((tenant) => new Promise<void>((resolve, reject) => {
    const socket = new WebSocket('ws://localhost:3401/ws');
    (window as any).__webSessionAcceptanceSocket = socket;
    const timeout = window.setTimeout(() => reject(new Error('WebSocket hello timeout')), 10_000);
    socket.onerror = () => reject(new Error('WebSocket rejected'));
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.type === 'hello' && message.payload?.tenantId === tenant) {
        window.clearTimeout(timeout);
        resolve();
      }
    };
  }), expectedTenant);
}

function restart(service: 'backend' | 'redis') {
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/commercial-core-isolated-stack.mjs'), `restart-${service}`],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0) throw new Error(`Unable to restart isolated ${service}.`);
}

test('browser web auth usa esclusivamente sessioni opache HttpOnly nei Context A/B/C/D', async ({ browser }) => {
  const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8')) as { redisHost: string; redisPort: number };
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  const redis = new Redis({ host: config.redisHost, port: config.redisPort, lazyConnect: true });
  const violations: string[] = [];
  const contexts: BrowserContext[] = [];

  try {
    await redis.connect();

    const headerlessBrowser = await browser.newContext();
    contexts.push(headerlessBrowser);
    const headerlessLogin = await headerlessBrowser.request.post(
      'http://localhost:3401/api/auth/login',
      {
        headers: { Origin: 'http://localhost:3100' },
        data: { email: credentials.email, password: credentials.password, rememberMe: false },
      },
    );
    expect(headerlessLogin.status()).toBe(201);
    expect(await headerlessLogin.json()).not.toHaveProperty('token');

    const badContext = await browser.newContext();
    contexts.push(badContext);
    observeBrowserAuth(badContext, violations);
    const badPage = await badContext.newPage();
    await badPage.goto('/login');
    for (const email of ['visual.owner@acceptance.invalid', 'missing.user@acceptance.invalid']) {
      await badPage.getByLabel('Email').fill(email);
      await badPage.getByLabel('Password', { exact: true }).fill('synthetic-wrong-password');
      await badPage.getByRole('button', { name: 'Accedi', exact: true }).click();
      await expect(badPage.locator('.df-auth-error')).toContainText('Credenziali non valide');
    }

    let contextA = await browser.newContext();
    contexts.push(contextA);
    observeBrowserAuth(contextA, violations);
    const owner = await login(contextA, credentials.email, credentials, {
      rememberMe: true,
      mfa: true,
      target: 'dashboard',
      rejectExpiredTotp: true,
    });
    await assertNoBrowserAuthMaterial(owner.page);
    expect((await appFetch(owner.page, '/auth/me')).json.user).toMatchObject({ tenantSlug: 'doflow', authStage: 'FULL' });

    const tab = await contextA.newPage();
    await tab.goto('/dashboard');
    expect((await appFetch(tab, '/auth/me')).json.user.tenantSlug).toBe('doflow');

    const invalidCsrf = await appFetch(owner.page, '/auth/handoff', {
      method: 'POST',
      headers: { 'X-CSRF-Token': 'invalid' },
      body: { tenantTarget: 'doflow' },
    });
    expect(invalidCsrf.status).toBe(401);
    const browserBearer = await contextA.request.get('http://localhost:3401/api/auth/me', {
      headers: {
        Origin: 'http://localhost:3100',
        'X-Doflow-Web': '1',
        Authorization: 'Bearer browser-forbidden-synthetic-value',
      },
    });
    expect(browserBearer.status()).toBe(400);

    const ownerCsrf = (await contextA.cookies()).find((cookie) => cookie.name === 'doflow_csrf')!.value;
    const invalidOrigin = await contextA.request.post('http://localhost:3401/api/auth/logout', {
      headers: {
        Origin: 'https://evil.invalid',
        'X-Doflow-Web': '1',
        'X-CSRF-Token': ownerCsrf,
      },
    });
    expect(invalidOrigin.status()).toBe(403);
    expect((await appFetch(owner.page, '/auth/me')).ok).toBe(true);

    const wrongTenantHandoff = await appFetch(owner.page, '/auth/handoff', {
      method: 'POST', body: { tenantTarget: 'doflow', rememberMe: true },
    });
    const wrongTenantContext = await browser.newContext();
    contexts.push(wrongTenantContext);
    const wrongTenantPage = await wrongTenantContext.newPage();
    await wrongTenantPage.goto('/login');
    expect((await appFetch(wrongTenantPage, '/auth/handoff/exchange', {
      method: 'POST', body: { handoff: wrongTenantHandoff.json.handoff, tenantTarget: 'acceptance-secondary' },
    })).status).toBe(401);
    expect((await appFetch(wrongTenantPage, '/auth/handoff/exchange', {
      method: 'POST', body: { handoff: wrongTenantHandoff.json.handoff, tenantTarget: 'doflow' },
    })).status).toBe(401);

    const wrongHostHandoff = await appFetch(owner.page, '/auth/handoff', {
      method: 'POST', body: { tenantTarget: 'doflow', rememberMe: true },
    });
    const wrongHost = await contextA.request.post('http://localhost:3401/api/auth/handoff/exchange', {
      headers: {
        Origin: 'http://handoff-mismatch.localhost:3100',
        'X-Doflow-Web': '1',
        'X-CSRF-Token': ownerCsrf,
      },
      data: { handoff: wrongHostHandoff.json.handoff, tenantTarget: 'doflow' },
    });
    expect(wrongHost.status()).toBe(401);

    const correctHandoff = await appFetch(owner.page, '/auth/handoff', {
      method: 'POST', body: { tenantTarget: 'doflow', rememberMe: true },
    });
    const handoffContext = await browser.newContext();
    contexts.push(handoffContext);
    observeBrowserAuth(handoffContext, violations);
    const handoffPage = await handoffContext.newPage();
    await handoffPage.goto('/login');
    expect((await appFetch(handoffPage, '/auth/handoff/exchange', {
      method: 'POST', body: { handoff: correctHandoff.json.handoff, tenantTarget: 'doflow' },
    })).ok).toBe(true);
    expect((await appFetch(handoffPage, '/auth/me')).json.user.tenantSlug).toBe('doflow');
    expect((await appFetch(wrongTenantPage, '/auth/handoff/exchange', {
      method: 'POST', body: { handoff: correctHandoff.json.handoff, tenantTarget: 'doflow' },
    })).status).toBe(401);

    const persistentState = await contextA.storageState();
    const ownerSessionValue = owner.session.value;
    await contextA.close();
    contextA = await browser.newContext({ storageState: persistentState });
    contexts.push(contextA);
    observeBrowserAuth(contextA, violations);
    const reopenedOwner = await contextA.newPage();
    await reopenedOwner.goto('/dashboard');
    expect((await appFetch(reopenedOwner, '/auth/me')).json.user.tenantSlug).toBe('doflow');
    expect((await contextA.cookies()).find((cookie) => cookie.name === 'doflow_session')?.value).toBe(ownerSessionValue);

    const contextB = await browser.newContext();
    contexts.push(contextB);
    observeBrowserAuth(contextB, violations);
    const manager = await login(contextB, 'visual.manager@acceptance.invalid', credentials, {
      rememberMe: false, mfa: false, target: 'dashboard',
    });
    await assertNoBrowserAuthMaterial(manager.page);
    expect(manager.session.value).not.toBe(ownerSessionValue);
    await connectBusinessSocket(manager.page, 'doflow');
    await manager.page.evaluate(() => (window as any).__webSessionAcceptanceSocket?.close());
    await contextB.close();
    const contextBReopened = await browser.newContext();
    contexts.push(contextBReopened);
    const bReopenedPage = await contextBReopened.newPage();
    await bReopenedPage.goto('/login');
    expect((await appFetch(bReopenedPage, '/auth/me')).status).toBe(401);

    const contextC = await browser.newContext();
    contexts.push(contextC);
    observeBrowserAuth(contextC, violations);
    const secondary = await login(contextC, 'secondary.owner@acceptance.invalid', credentials, {
      rememberMe: false, mfa: false, target: 'dashboard',
    });
    expect((await appFetch(secondary.page, '/auth/me')).json.user.tenantSlug).toBe('acceptance-secondary');
    expect((await appFetch(secondary.page, '/tenant/doflow/commerce/services', {
      headers: { 'X-Doflow-Tenant-Id': 'doflow' },
    })).status).toBe(403);
    await connectBusinessSocket(secondary.page, 'acceptance-secondary');
    await secondary.page.evaluate(() => (window as any).__webSessionAcceptanceSocket?.close());

    const contextD = await browser.newContext();
    contexts.push(contextD);
    observeBrowserAuth(contextD, violations);
    const platform = await login(contextD, 'platform.superadmin@acceptance.invalid', credentials, {
      rememberMe: true, mfa: true, target: 'superadmin',
    });
    await assertNoBrowserAuthMaterial(platform.page);
    expect((await appFetch(platform.page, '/auth/me')).json.user).toMatchObject({ tenantSlug: 'public', role: 'superadmin', authStage: 'FULL' });
    expect((await appFetch(platform.page, '/superadmin/tenants')).ok).toBe(true);
    expect((await appFetch(reopenedOwner, '/superadmin/tenants')).status).toBe(403);

    const setupContext = await browser.newContext();
    contexts.push(setupContext);
    observeBrowserAuth(setupContext, violations);
    const setupPage = await setupContext.newPage();
    await setupPage.goto('/login');
    await setupPage.getByLabel('Email').fill('visual.mfa-setup@acceptance.invalid');
    await setupPage.getByLabel('Password', { exact: true }).fill(credentials.password);
    await setupPage.getByRole('button', { name: 'Accedi', exact: true }).click();
    await setupPage.waitForURL(/\/doflow\/mfa$/);
    expect((await appFetch(setupPage, '/auth/session-stage')).json.authStage).toBe('MFA_SETUP_NEEDED');
    const setupSecret = (await setupPage.locator('code').first().textContent())!.trim();
    await setupPage.getByLabel('Codice di verifica a 6 cifre').fill(await stableTotp(setupPage, setupSecret));
    await setupPage.getByRole('button', { name: /Attiva e Accedi/ }).click();
    await setupPage.waitForURL(/\/dashboard$/);
    await assertNoBrowserAuthMaterial(setupPage);

    restart('backend');
    expect((await appFetch(reopenedOwner, '/auth/me')).ok).toBe(true);
    restart('redis');
    expect((await appFetch(reopenedOwner, '/auth/me')).ok).toBe(true);

    await connectBusinessSocket(reopenedOwner, 'doflow');
    const ownerKey = `doflow:web-session:${createHash('sha256').update(ownerSessionValue).digest('hex')}`;
    expect(await redis.exists(ownerKey)).toBe(1);
    const logout = await appFetch(reopenedOwner, '/auth/logout', { method: 'POST' });
    expect(logout.ok).toBe(true);
    expect((await contextA.cookies()).some((cookie) => cookie.name === 'doflow_session')).toBe(false);
    expect(await redis.exists(ownerKey)).toBe(0);
    expect((await appFetch(reopenedOwner, '/auth/me')).status).toBe(401);
    await expect.poll(() => reopenedOwner.evaluate(() => (window as any).__webSessionAcceptanceSocket?.readyState), {
      timeout: 35_000,
    }).toBe(3);

    const expiringCookie = (await handoffContext.cookies()).find((cookie) => cookie.name === 'doflow_session')!;
    const expiringKey = `doflow:web-session:${createHash('sha256').update(expiringCookie.value).digest('hex')}`;
    await redis.expire(expiringKey, 1);
    await handoffPage.waitForTimeout(1_200);
    expect((await appFetch(handoffPage, '/auth/me')).status).toBe(401);

    expect(violations).toEqual([]);
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    redis.disconnect();
  }
});
