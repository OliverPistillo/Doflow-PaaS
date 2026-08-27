import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import {
  atomicWriteJson,
  safeAcceptanceFailure,
  withAcceptanceCheckpoint,
} from '../../scripts/lib/acceptance-evidence.mjs';

const root = path.resolve(__dirname, '../..');
const runtimeConfigPath = path.join(root, '.visual-runtime', 'commercial-core-stack.json');
const credentialPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const resultPath = path.join(root, '.visual-runtime', 'final-global-acceptance-result.json');
const superadminResultPath = path.join(root, '.visual-runtime', 'superadmin-acceptance-result.json');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Client: PgClient } = backendRequire('pg');

type Credentials = { email: string; password: string; mfaSecret: string };
type RuntimeConfig = { databaseUrl: string };
type AppResult = { status: number; ok: boolean; json: any; text: string };
type ApiRequestTiming = {
  method: string;
  path: string;
  phase: string;
  status: number | null;
  durationMs: number;
};

const evidenceFiles = {
  commercial: 'commercial-core-acceptance-result.json',
  delivery: 'delivery-core-acceptance-result.json',
  commerce: 'commerce-cash-acceptance-result.json',
  documentRevenue: 'document-revenue-acceptance-result.json',
  collaboration: 'collaboration-acceptance-result.json',
  automationPerformance: 'automation-performance-acceptance-result.json',
} as const;

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/=+$/g, '');
  let bits = '';
  for (const character of normalized) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
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
    try { json = text ? JSON.parse(text) : null; } catch { /* keep raw response */ }
    return { status: response.status, ok: response.ok, json, text };
  }, { pathValue: pathname, request: options });
}

function observeNoBearer(context: BrowserContext, violations: string[]) {
  context.on('request', (request: Request) => {
    if (new URL(request.url()).pathname.startsWith('/api/') && request.headers().authorization) {
      violations.push(`${request.method()} ${new URL(request.url()).pathname}`);
    }
  });
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * percentileValue) - 1)];
}

function safeApiPath(url: string) {
  return new URL(url).pathname.replace(
    /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi,
    ':id',
  );
}

function summarizeApiRequestTimings(timings: ApiRequestTiming[], inFlightRequestCount: number) {
  const durations = timings.map((timing) => timing.durationMs);
  const byPhase = Object.fromEntries([...new Set(timings.map((timing) => timing.phase))].map((phase) => {
    const phaseDurations = timings
      .filter((timing) => timing.phase === phase)
      .map((timing) => timing.durationMs);
    return [phase, {
      requests: phaseDurations.length,
      p50Ms: percentile(phaseDurations, 0.5),
      p95Ms: percentile(phaseDurations, 0.95),
      maxMs: phaseDurations.length === 0 ? null : Math.max(...phaseDurations),
    }];
  }));
  return {
    available: timings.length > 0,
    source: 'privacy-safe browser API response timings from Context A',
    scope: 'synthetic isolated stack',
    measurement: 'request start to response headers; bodies, headers and query strings are not retained',
    requestCount: timings.length,
    initialRequestCount: timings.filter((timing) => timing.phase === 'initial-workspace').length,
    failedRequestCount: timings.filter((timing) => timing.status === null).length,
    unexpected5xxCount: timings.filter((timing) => (timing.status ?? 0) >= 500).length,
    inFlightRequestCount,
    p50Ms: percentile(durations, 0.5),
    p95Ms: percentile(durations, 0.95),
    maxMs: durations.length === 0 ? null : Math.max(...durations),
    byPhase,
    statusCounts: Object.fromEntries([...new Set(timings.map((timing) => timing.status))]
      .map((status) => [String(status), timings.filter((timing) => timing.status === status).length])),
    slowestRequests: [...timings]
      .sort((left, right) => right.durationMs - left.durationMs)
      .slice(0, 10),
  };
}

async function loginWithMfa(
  context: BrowserContext,
  email: string,
  credentials: Credentials,
  target: 'dashboard' | 'superadmin' = 'dashboard',
) {
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await page.waitForURL(/\/(?:doflow|acceptance-secondary|public)\/mfa$/);
  await page.getByLabel('Codice di verifica a 6 cifre').fill(await stableTotp(page, credentials.mfaSecret));
  await page.getByRole('button', { name: 'Verifica Codice' }).click();
  await page.waitForURL(target === 'superadmin' ? /\/superadmin$/ : /\/dashboard$/);
  const session = (await context.cookies()).find((cookie) => cookie.name === 'doflow_session');
  expect(session).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
  return page;
}

async function directLogin(context: BrowserContext, email: string, password: string) {
  return context.request.post('http://localhost:3401/api/auth/login', {
    headers: { Origin: 'http://localhost:3100', 'X-Doflow-Web': '1' },
    data: { email, password, rememberMe: false },
  });
}

async function directSuperadminStatus(context: BrowserContext) {
  return (await context.request.get('http://localhost:3401/api/superadmin/tenants', {
    headers: { Origin: 'http://localhost:3100', 'X-Doflow-Web': '1' },
  })).status();
}

function restart(service: 'frontend' | 'backend' | 'redis') {
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/commercial-core-isolated-stack.mjs'), `restart-${service}`],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0) throw new Error(`Unable to restart isolated ${service}.`);
}

function acceptanceGitIdentity() {
  const branch = spawnSync('git', ['branch', '--show-current'], {
    cwd: root, encoding: 'utf8', windowsHide: true,
  });
  const sha = spawnSync('git', ['rev-parse', 'HEAD'], {
    cwd: root, encoding: 'utf8', windowsHide: true,
  });
  if (branch.status !== 0 || sha.status !== 0) throw new Error('Unable to capture acceptance Git identity.');
  return { branch: String(branch.stdout).trim(), sha: String(sha.stdout).trim() };
}

async function connectBusinessSocket(page: Page, expectedTenant: string) {
  await page.evaluate((tenant) => new Promise<void>((resolve, reject) => {
    const socket = new WebSocket('ws://localhost:3401/ws');
    (window as any).__finalAcceptanceSocket = socket;
    const timeout = window.setTimeout(() => reject(new Error('WebSocket hello timeout')), 10_000);
    socket.onerror = () => reject(new Error('WebSocket connection rejected'));
    socket.onmessage = (event) => {
      const message = JSON.parse(String(event.data));
      if (message.type === 'hello' && message.payload?.tenantId === tenant) {
        window.clearTimeout(timeout);
        resolve();
      }
    };
  }), expectedTenant);
}

test('release candidate globale integra i Context A/B/C/D e tutte le authority persistenti', async ({ browser }) => {
  const contexts: BrowserContext[] = [];
  const bearerViolations: string[] = [];
  let db: InstanceType<typeof PgClient> | null = null;
  let operations = 0;
  let contextAStartedAtMs: number | null = null;
  let contextAStartedAt: string | null = null;
  const contextARequestStarts = new Map<Request, { startedAtMs: number; phase: string }>();
  const contextARequestTimings: ApiRequestTiming[] = [];
  let contextARequestPhase = 'initial-workspace';
  const workspaceReadiness: Array<{
    route: string;
    shellReadyMs: number;
    workspaceReadyMs: number;
  }> = [];
  let activeStage = 'bootstrap';
  let globalEvidence: Record<string, any> = {
    schemaVersion: 1,
    runId: process.env.DOFLOW_ACCEPTANCE_RUN_ID ?? null,
    verdict: 'GLOBAL CONTEXTS A-D BLOCKED',
    startedAt: new Date().toISOString(),
    ...acceptanceGitIdentity(),
    currentStage: activeStage,
    contexts: {
      A: { status: 'pending' },
      B: { status: 'pending' },
      C: { status: 'pending' },
      D: { status: 'pending' },
    },
    operationCount: 0,
    browserBearerViolations: 0,
    checkpoints: {},
  };
  const checkpoint = async (stage: string, status: string, details: Record<string, unknown> = {}) => {
    activeStage = stage;
    globalEvidence = withAcceptanceCheckpoint(globalEvidence, stage, status, details);
    globalEvidence.operationCount = operations;
    globalEvidence.browserBearerViolations = bearerViolations.length;
    await atomicWriteJson(resultPath, globalEvidence);
  };
  const checked = (condition: unknown, label: string) => {
    expect(Boolean(condition), label).toBe(true);
    operations += 1;
  };

  await checkpoint('bootstrap', 'running');
  try {
    const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8')) as RuntimeConfig;
    const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
    const domainEvidence = Object.fromEntries(await Promise.all(
      Object.entries(evidenceFiles).map(async ([key, filename]) => [
        key,
        JSON.parse(await readFile(path.join(root, '.visual-runtime', filename), 'utf8')),
      ]),
    )) as Record<string, any>;
    db = new PgClient({ connectionString: config.databaseUrl });
    await db.connect();
    const requiredRows = await db.query(
      `SELECT
         EXISTS (SELECT 1 FROM doflow.leads WHERE deleted_at IS NULL) AS leads,
         EXISTS (SELECT 1 FROM doflow.companies WHERE deleted_at IS NULL) AS companies,
         EXISTS (SELECT 1 FROM doflow.projects WHERE deleted_at IS NULL) AS projects,
         EXISTS (SELECT 1 FROM doflow.orders WHERE deleted_at IS NULL) AS orders,
         EXISTS (SELECT 1 FROM doflow.payments WHERE deleted_at IS NULL) AS payments,
         EXISTS (SELECT 1 FROM doflow.quotes WHERE deleted_at IS NULL) AS quotes,
         EXISTS (SELECT 1 FROM doflow.contracts WHERE deleted_at IS NULL) AS contracts,
         EXISTS (SELECT 1 FROM doflow.invoices WHERE deleted_at IS NULL) AS invoices,
         EXISTS (SELECT 1 FROM doflow.record_comments WHERE deleted_at IS NULL) AS comments,
         EXISTS (SELECT 1 FROM doflow.automation_rules WHERE deleted_at IS NULL) AS automations,
         EXISTS (SELECT 1 FROM doflow.point_ledger) AS points,
         EXISTS (SELECT 1 FROM doflow.ranking_snapshots) AS rankings`,
    );
    for (const [name, present] of Object.entries(requiredRows.rows[0])) checked(present, `${name} persisted in PostgreSQL`);

    checked(domainEvidence.commercial.conversionIdempotent, 'commercial conversion idempotency');
    checked(domainEvidence.commercial.mergeIdempotent, 'commercial merge idempotency');
    checked(domainEvidence.commercial.intakeIdempotent, 'public intake idempotency');
    checked(domainEvidence.delivery.projectIdempotent, 'delivery project idempotency');
    checked(domainEvidence.delivery.timerIdempotent, 'delivery timer idempotency');
    checked(domainEvidence.delivery.qaIdempotent, 'delivery QA idempotency');
    checked(domainEvidence.delivery.optimisticConflict, 'delivery optimistic conflict');
    checked(domainEvidence.commerce.db.idempotency >= 1, 'commerce idempotency registry');
    checked(domainEvidence.documentRevenue.proof.audit >= 1, 'document audit');
    checked(domainEvidence.collaboration.realtime, 'collaboration realtime');
    checked(domainEvidence.automationPerformance.counts.executions === '2', 'automation dedupe/retry');
    globalEvidence.domainEvidence = Object.fromEntries(Object.keys(evidenceFiles).map((key) => [key, 'passed']));
    await checkpoint('bootstrap', 'passed', { persistedDomains: Object.keys(evidenceFiles).length });

    contextAStartedAtMs = Date.now();
    contextAStartedAt = new Date(contextAStartedAtMs).toISOString();
    globalEvidence.contexts.A = { status: 'running', startedAt: contextAStartedAt };
    await checkpoint('contextA', 'running');
    const contextA = await browser.newContext();
    contexts.push(contextA);
    observeNoBearer(contextA, bearerViolations);
    contextA.on('request', (request) => {
      if (safeApiPath(request.url()).startsWith('/api/')) {
        contextARequestStarts.set(request, { startedAtMs: Date.now(), phase: contextARequestPhase });
      }
    });
    contextA.on('response', (response) => {
      const request = response.request();
      const started = contextARequestStarts.get(request);
      if (!started) return;
      contextARequestStarts.delete(request);
      contextARequestTimings.push({
        method: request.method(),
        path: safeApiPath(request.url()),
        phase: started.phase,
        status: response.status(),
        durationMs: Date.now() - started.startedAtMs,
      });
    });
    contextA.on('requestfailed', (request) => {
      const started = contextARequestStarts.get(request);
      if (!started) return;
      contextARequestStarts.delete(request);
      contextARequestTimings.push({
        method: request.method(),
        path: safeApiPath(request.url()),
        phase: started.phase,
        status: null,
        durationMs: Date.now() - started.startedAtMs,
      });
    });
    const owner = await loginWithMfa(contextA, credentials.email, credentials);
    checked((await appFetch(owner, '/auth/me')).json.user.authStage === 'FULL', 'Context A FULL session');
    await owner.goto(`/dashboard/progetti/${domainEvidence.delivery.projectId}`);
    const tabs = owner.getByRole('tablist').first().getByRole('tab');
    await expect(tabs).toHaveText(['Panoramica', 'Attività', 'Fasi', 'Produzione e QA', 'Documenti', 'Pagamenti', 'Timeline']);
    operations += 7;
    await owner.goto(`/dashboard/ordini/${domainEvidence.commerce.orderId}`);
    await expect(owner.locator('main[data-commerce-source="server"]')).toBeVisible({ timeout: 60_000 });
    await expect(owner.getByRole('heading', { level: 1 })).toBeVisible();
    operations += 1;
    contextARequestPhase = 'workspace-readiness-routes';
    for (const route of ['/dashboard/preventivi', '/dashboard/contratti', '/dashboard/fatture', '/dashboard/automazioni']) {
      await checkpoint('workspaceReadiness', 'running', {
        currentRoute: route,
        routesCompleted: workspaceReadiness.length,
      });
      const routeStartedAt = Date.now();
      await owner.goto(route, { waitUntil: 'domcontentloaded' });
      const shell = owner.locator('main[data-app-shell-ready="true"]').first();
      await expect(shell).toBeVisible();
      const shellReadyMs = Date.now() - routeStartedAt;
      await expect(shell).toHaveAttribute('data-workspace-ready', 'true', { timeout: 20_000 });
      workspaceReadiness.push({
        route,
        shellReadyMs,
        workspaceReadyMs: Date.now() - routeStartedAt,
      });
      globalEvidence.workspaceReadiness = {
        routes: [...workspaceReadiness],
        shellReady: true,
        workspaceReady: true,
        maxShellReadyMs: Math.max(...workspaceReadiness.map((entry) => entry.shellReadyMs)),
        maxWorkspaceReadyMs: Math.max(...workspaceReadiness.map((entry) => entry.workspaceReadyMs)),
      };
      await checkpoint('workspaceReadiness', 'running', {
        currentRoute: route,
        routesCompleted: workspaceReadiness.length,
        latest: workspaceReadiness.at(-1),
      });
      operations += 2;
    }
    globalEvidence.workspaceReadiness = {
      routes: workspaceReadiness,
      shellReady: true,
      workspaceReady: true,
      maxShellReadyMs: Math.max(...workspaceReadiness.map((entry) => entry.shellReadyMs)),
      maxWorkspaceReadyMs: Math.max(...workspaceReadiness.map((entry) => entry.workspaceReadyMs)),
    };
    await checkpoint('workspaceReadiness', 'passed', globalEvidence.workspaceReadiness);
    await checkpoint('contextA', 'running', { workspaceReadiness: 'passed' });

    contextARequestPhase = 'legacy-routes';
    const legacyRoutes = [
      ['/commercial', '/dashboard/commercial'],
      ['/leads', '/dashboard/commercial/leads'],
      ['/pipeline', '/dashboard/commercial/pipeline'],
      ['/companies', '/dashboard/clienti'],
      ['/contacts', '/dashboard/clienti'],
      ['/customers', '/dashboard/clienti'],
      ['/projects', '/dashboard/progetti'],
      ['/activities', '/dashboard/attivita'],
      ['/finance', '/dashboard/pagamenti'],
      ['/quotes', '/dashboard/preventivi'],
      ['/contracts', '/dashboard/contratti'],
      ['/documents', '/dashboard/documenti'],
      ['/reports', '/dashboard'],
      ['/settings', '/dashboard/impostazioni'],
    ] as const;
    for (const [source, destination] of legacyRoutes) {
      await owner.goto('/dashboard');
      await owner.goto(`${source}?rc_legacy=1`, { waitUntil: 'domcontentloaded' });
      await expect(owner).toHaveURL(new RegExp(`${destination.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\?rc_legacy=1$`));
      await owner.goBack({ waitUntil: 'domcontentloaded' });
      await expect(owner).toHaveURL(/\/dashboard$/);
      operations += 3;
    }
    globalEvidence.legacyRedirects = legacyRoutes.length;
    await checkpoint('legacyRoutes', 'passed', { count: legacyRoutes.length });
    await checkpoint('contextA', 'running', { legacyRoutes: 'passed' });

    contextARequestPhase = 'persistence-and-restarts';
    await connectBusinessSocket(owner, 'doflow');
    await owner.evaluate(() => (window as any).__finalAcceptanceSocket?.close());
    operations += 1;
    const storageAudit = await owner.evaluate(async () => ({
      local: Object.entries(localStorage),
      session: Object.entries(sessionStorage),
      indexed: (await indexedDB.databases()).map((database) => database.name),
    }));
    const storageKeys = JSON.stringify({
      local: storageAudit.local.map(([key]) => key),
      session: storageAudit.session.map(([key]) => key),
      indexed: storageAudit.indexed,
    });
    expect(storageKeys).not.toMatch(/lead|customer|project|order|payment|invoice|contract|automation|ranking/i);
    expect(JSON.stringify(storageAudit)).not.toMatch(/doflow_token|access_?token|authorization|bearer|eyJ[A-Za-z0-9_-]{10,}\./i);
    operations += 1;

    restart('frontend');
    await owner.reload({ waitUntil: 'domcontentloaded' });
    checked((await appFetch(owner, '/auth/me')).ok, 'session survives frontend restart');
    restart('backend');
    checked((await appFetch(owner, '/auth/me')).ok, 'session survives backend restart');
    restart('redis');
    checked((await appFetch(owner, '/auth/me')).ok, 'session survives Redis AOF restart');

    const managerMembership = await appFetch(
      owner,
      `/tenant/delivery/projects/${domainEvidence.delivery.projectId}/members`,
      {
        method: 'POST',
        headers: { 'Idempotency-Key': `final-manager-${domainEvidence.delivery.projectId}` },
        body: {
          user_id: 'a0000000-0000-4000-8000-000000000008',
          role: 'project_manager',
          allocation_percent: 50,
          capacity_minutes_week: 1_800,
        },
      },
    );
    expect(managerMembership.ok, managerMembership.text).toBe(true);
    operations += 1;
    globalEvidence.queryProfile = summarizeApiRequestTimings(
      contextARequestTimings,
      contextARequestStarts.size,
    );
    const contextACompletedAtMs = Date.now();
    globalEvidence.contexts.A = {
      status: 'passed',
      owner: true,
      mfa: true,
      opaqueCookie: true,
      integratedPersistence: true,
      startedAt: contextAStartedAt,
      completedAt: new Date(contextACompletedAtMs).toISOString(),
      durationMs: contextAStartedAtMs === null ? null : contextACompletedAtMs - contextAStartedAtMs,
    };
    await checkpoint('contextA', 'passed');

    globalEvidence.contexts.B = { status: 'running' };
    await checkpoint('contextB', 'running');
    const contextB = await browser.newContext();
    contexts.push(contextB);
    observeNoBearer(contextB, bearerViolations);
    const manager = await loginWithMfa(contextB, 'final.manager@acceptance.invalid', credentials);
    const managerIdentity = await appFetch(manager, '/tenant/doflow/identity');
    expect(managerIdentity.json.capabilities).toEqual(expect.arrayContaining(['canViewAssignedProjects', 'canApproveProjectWork']));
    await manager.goto(`/dashboard/progetti/${domainEvidence.delivery.projectId}`);
    await expect(
      manager.locator('main[data-app-shell-ready="true"]').first(),
    ).toHaveAttribute('data-workspace-ready', 'true', { timeout: 20_000 });
    await expect(manager.getByRole('tab', { name: 'Produzione e QA' })).toBeVisible();
    await connectBusinessSocket(manager, 'doflow');
    await manager.evaluate(() => (window as any).__finalAcceptanceSocket?.close());
    operations += 3;
    globalEvidence.contexts.B = {
      status: 'passed', manager: true, mfa: true, realtime: true, capabilityScoped: true,
    };
    await checkpoint('contextB', 'passed');

    globalEvidence.contexts.C = { status: 'running' };
    await checkpoint('contextC', 'running');
    const contextC = await browser.newContext();
    contexts.push(contextC);
    observeNoBearer(contextC, bearerViolations);
    const limited = await loginWithMfa(contextC, 'final.limited@acceptance.invalid', credentials);
    await limited.goto('/dashboard/pagamenti');
    await expect(limited.getByText('Accesso non autorizzato')).toBeVisible();
    expect((await appFetch(limited, '/tenant/doflow/commerce/payments')).status).toBe(403);
    expect((await appFetch(limited, '/superadmin/tenants')).status).toBe(403);
    operations += 3;
    globalEvidence.contexts.C = {
      status: 'passed', limited: true, mfa: true, financeRedacted: true, forbiddenMutations: true,
    };
    await checkpoint('contextC', 'passed');

    globalEvidence.contexts.D = { status: 'running' };
    await checkpoint('contextD', 'running');
    const contextD = await browser.newContext();
    contexts.push(contextD);
    observeNoBearer(contextD, bearerViolations);
    const secondary = await loginWithMfa(contextD, 'final.secondary@acceptance.invalid', credentials);
    checked((await appFetch(secondary, '/auth/me')).json.user.tenantSlug === 'acceptance-secondary', 'Context D tenant');
    await secondary.goto('/finance?legacy=1', { waitUntil: 'domcontentloaded' });
    await expect(secondary).toHaveURL(/\/finance\?legacy=1$/);
    expect((await appFetch(secondary, '/tenant/doflow/commerce/orders?tenant=doflow', {
      headers: { 'X-Doflow-Tenant-Id': 'doflow' },
    })).status).toBe(403);
    expect((await appFetch(secondary, '/tenant/doflow/commerce/services', {
      method: 'POST',
      headers: { 'X-Doflow-Tenant-Id': 'doflow' },
      body: { name: 'Cross tenant forbidden', category: 'Altro', price: 10, currency: 'EUR' },
    })).status).toBe(403);
    expect([400, 403]).toContain((await appFetch(secondary, '/tenant/doflow/commerce/services', {
      method: 'POST',
      body: { tenant: 'doflow', name: 'Body spoof forbidden', category: 'Altro', price: 10, currency: 'EUR' },
    })).status);
    await connectBusinessSocket(secondary, 'acceptance_secondary');
    await secondary.evaluate(() => (window as any).__finalAcceptanceSocket?.close());
    operations += 6;
    globalEvidence.contexts.D = {
      status: 'passed', secondTenant: true, mfa: true, legacyCompatible: true, isolated: true,
    };
    await checkpoint('contextD', 'passed');

    expect(bearerViolations).toEqual([]);
    globalEvidence = {
      ...globalEvidence,
      verdict: 'GLOBAL CONTEXTS A-D GO',
      operationCount: operations,
      restarts: ['frontend', 'backend-with-worker-and-scheduler', 'redis'],
      browserBearerViolations: bearerViolations.length,
      postgresAuthoritative: true,
      idempotency: true,
      concurrency: true,
      completedAt: new Date().toISOString(),
    };
    await checkpoint('contextsAD', 'passed', { operationCount: operations });
  } catch (error) {
    if (contextARequestTimings.length > 0) {
      globalEvidence.queryProfile = summarizeApiRequestTimings(
        contextARequestTimings,
        contextARequestStarts.size,
      );
    }
    const contextKey = ['legacyRoutes', 'workspaceReadiness'].includes(activeStage)
      ? 'A'
      : /^context([A-D])$/.exec(activeStage)?.[1];
    if (contextKey) {
      const failedAtMs = Date.now();
      globalEvidence.contexts[contextKey] = {
        ...(globalEvidence.contexts[contextKey] ?? {}),
        status: 'failed',
        ...(contextKey === 'A' && contextAStartedAtMs !== null
          ? {
              startedAt: contextAStartedAt,
              completedAt: new Date(failedAtMs).toISOString(),
              durationMs: failedAtMs - contextAStartedAtMs,
            }
          : {}),
      };
      const contextOrder = ['A', 'B', 'C', 'D'];
      for (const pendingContext of contextOrder.slice(contextOrder.indexOf(contextKey) + 1)) {
        if (globalEvidence.contexts[pendingContext]?.status === 'pending') {
          globalEvidence.contexts[pendingContext] = { status: 'skipped', reason: `${contextKey} failed` };
        }
      }
    }
    globalEvidence = {
      ...globalEvidence,
      verdict: 'GLOBAL CONTEXTS A-D BLOCKED',
      failure: safeAcceptanceFailure(error, activeStage),
      completedAt: new Date().toISOString(),
    };
    await checkpoint(activeStage, 'failed');
    throw error;
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    await db?.end().catch(() => undefined);
  }
});

test('Context E Superadmin verifica matrice negativa, superfici e separazione shell', async ({ browser }) => {
  const contextEStartedAtMs = Date.now();
  const contextEStartedAt = new Date(contextEStartedAtMs).toISOString();
  const contexts: BrowserContext[] = [];
  const bearerViolations: string[] = [];
  const matrix: Record<string, number> = {};
  let tenantOwnerContext: BrowserContext | null = null;
  let operations = 0;
  let activeStage = 'bootstrap';
  let evidence: Record<string, any> = {
    schemaVersion: 1,
    runId: process.env.DOFLOW_ACCEPTANCE_RUN_ID ?? null,
    verdict: 'SUPERADMIN CONTEXT E BLOCKED',
    context: { name: 'E', status: 'running', startedAt: contextEStartedAt },
    startedAt: contextEStartedAt,
    ...acceptanceGitIdentity(),
    currentStage: activeStage,
    operationCount: 0,
    browserBearerViolations: 0,
    destructiveBusinessMutations: 0,
    checkpoints: {},
  };
  const checkpoint = async (stage: string, status: string, details: Record<string, unknown> = {}) => {
    activeStage = stage;
    evidence = withAcceptanceCheckpoint(evidence, stage, status, details);
    evidence.operationCount = operations;
    evidence.browserBearerViolations = bearerViolations.length;
    await atomicWriteJson(superadminResultPath, evidence);
  };

  await checkpoint('bootstrap', 'running', { fixtureSource: 'isolated-synthetic-seed' });
  try {
    const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
    await checkpoint('bootstrap', 'passed', { fixtureSource: 'isolated-synthetic-seed' });
    await checkpoint('negativeMatrix', 'running');
    const anonymous = await browser.newContext();
    contexts.push(anonymous);
    matrix.anonymous = await directSuperadminStatus(anonymous);

    const invalid = await browser.newContext();
    contexts.push(invalid);
    await invalid.addCookies([{ name: 'doflow_session', value: 'invalid-session', url: 'http://localhost:3100', httpOnly: true }]);
    matrix.invalidSession = await directSuperadminStatus(invalid);

    for (const [key, email] of [
      ['ownerTenant', 'final.owner@acceptance.invalid'],
      ['adminTenant', 'final.admin@acceptance.invalid'],
      ['managerTenant', 'visual.manager@acceptance.invalid'],
      ['tenantScopedSuperadmin', 'final.tenant-superadmin@acceptance.invalid'],
    ] as const) {
      const context = await browser.newContext();
      contexts.push(context);
      if (key === 'ownerTenant') tenantOwnerContext = context;
      const login = await directLogin(context, email, credentials.password);
      expect(login.status()).toBe(201);
      matrix[key] = await directSuperadminStatus(context);
    }

    const pending = await browser.newContext();
    contexts.push(pending);
    expect((await directLogin(pending, 'platform.superadmin@acceptance.invalid', credentials.password)).status()).toBe(201);
    matrix.publicMfaPending = await directSuperadminStatus(pending);

    expect(matrix).toEqual({
      anonymous: 401,
      invalidSession: 401,
      ownerTenant: 403,
      adminTenant: 403,
      managerTenant: 403,
      tenantScopedSuperadmin: 403,
      publicMfaPending: 403,
    });
    operations += Object.keys(matrix).length;
    evidence.negativeMatrix = matrix;
    await checkpoint('negativeMatrix', 'passed', { expected: 7, passed: Object.keys(matrix).length });

    await checkpoint('publicFull', 'running');
    const contextE = await browser.newContext();
    contexts.push(contextE);
    observeNoBearer(contextE, bearerViolations);
    const platform = await loginWithMfa(contextE, 'platform.superadmin@acceptance.invalid', credentials, 'superadmin');
    const me = await appFetch(platform, '/auth/me');
    expect(me.json.user).toMatchObject({ tenantSlug: 'public', role: 'superadmin', authStage: 'FULL' });
    operations += 1;
    await checkpoint('publicFull', 'passed', { scope: 'public/FULL', mfa: true, opaqueCookie: true });

    await checkpoint('safeApis', 'running', { expected: 10 });
    const safeApis = [
      '/superadmin/tenants',
      '/superadmin/modules',
      '/superadmin/subscriptions/revenue',
      '/superadmin/audit?limit=5',
      '/superadmin/system/health',
      '/superadmin/api-usage/stats',
      '/superadmin/automations',
      '/superadmin/storage/overview',
      '/superadmin/changelog',
      '/superadmin/dashboard/stats',
    ];
    for (const endpoint of safeApis) {
      const response = await appFetch(platform, endpoint);
      expect(response.status, endpoint).toBe(200);
      operations += 1;
    }
    evidence.safeApis = { expected: safeApis.length, passed: safeApis.length };
    await checkpoint('safeApis', 'passed', evidence.safeApis);

    await checkpoint('surfaces', 'running', { expected: 9 });
    const pageErrors: string[] = [];
    const serverErrors: string[] = [];
    platform.on('pageerror', (error) => pageErrors.push(error.message));
    platform.on('response', (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
    const surfaces = [
      '/superadmin',
      '/superadmin/tenants',
      '/superadmin/modules',
      '/superadmin/subscriptions',
      '/superadmin/system?tab=audit',
      '/superadmin/system?tab=api',
      '/superadmin/automations',
      '/superadmin/storage',
      '/superadmin/changelog',
    ];
    for (const route of surfaces) {
      await platform.goto(route, { waitUntil: 'domcontentloaded' });
      await expect(platform.locator('main').first()).toBeVisible();
      await expect(platform).toHaveURL(new RegExp(route.split('?')[0]));
      operations += 2;
    }
    expect(pageErrors).toEqual([]);
    expect(serverErrors).toEqual([]);
    evidence.surfaces = { expected: surfaces.length, passed: surfaces.length, pageErrors: 0, serverErrors: 0 };
    await checkpoint('surfaces', 'passed', evidence.surfaces);

    await checkpoint('shellSeparation', 'running');
    await platform.goto('/dashboard', { waitUntil: 'domcontentloaded' });
    await expect(platform).toHaveURL(/\/superadmin$/);
    expect(tenantOwnerContext).not.toBeNull();
    const tenantPage = await tenantOwnerContext!.newPage();
    await tenantPage.goto('/superadmin', { waitUntil: 'domcontentloaded' });
    await expect(tenantPage).toHaveURL(/\/dashboard$/);
    operations += 2;
    await checkpoint('shellSeparation', 'passed', { separate: true });

    await checkpoint('navigation', 'running');
    await platform.goto('/superadmin/tenants');
    await platform.reload({ waitUntil: 'domcontentloaded' });
    await expect(platform).toHaveURL(/\/superadmin\/tenants$/);
    await platform.goBack({ waitUntil: 'domcontentloaded' });
    await expect(platform).toHaveURL(/\/superadmin$/);
    operations += 3;
    await checkpoint('navigation', 'passed', { refresh: true, browserBack: true });

    await checkpoint('logoutRevocation', 'running');
    await platform.goto('/superadmin');
    const logout = await appFetch(platform, '/auth/logout', { method: 'POST' });
    expect(logout.ok).toBe(true);
    expect((await appFetch(platform, '/auth/me')).status).toBe(401);
    expect(await directSuperadminStatus(contextE)).toBe(401);
    expect(bearerViolations).toEqual([]);
    operations += 4;
    const contextECompletedAtMs = Date.now();
    evidence.context = {
      name: 'E',
      status: 'passed',
      superadmin: true,
      mfa: true,
      scope: 'public/FULL',
      negativeMatrix: matrix,
      safeApis: safeApis.length,
      surfaces: surfaces.length,
      shellSeparated: true,
      logoutRevoked: true,
      startedAt: contextEStartedAt,
      completedAt: new Date(contextECompletedAtMs).toISOString(),
      durationMs: contextECompletedAtMs - contextEStartedAtMs,
    };
    evidence = {
      ...evidence,
      verdict: 'SUPERADMIN CONTEXT E GO',
      superadmin: 'SUPERADMIN CONTEXT E GO',
      operationCount: operations,
      browserBearerViolations: bearerViolations.length,
      completedAt: new Date().toISOString(),
    };
    await checkpoint('logoutRevocation', 'passed', { logout: true, revoked: true, browserBearerViolations: 0 });
  } catch (error) {
    const contextEFailedAtMs = Date.now();
    evidence = {
      ...evidence,
      verdict: 'SUPERADMIN CONTEXT E BLOCKED',
      context: {
        ...(typeof evidence.context === 'object' ? evidence.context : { name: 'E' }),
        name: 'E',
        status: 'failed',
        startedAt: contextEStartedAt,
        completedAt: new Date(contextEFailedAtMs).toISOString(),
        durationMs: contextEFailedAtMs - contextEStartedAtMs,
      },
      failure: safeAcceptanceFailure(error, activeStage),
      completedAt: new Date().toISOString(),
    };
    await checkpoint(activeStage, 'failed');
    throw error;
  } finally {
    await Promise.allSettled(contexts.map((context) => context.close()));
    evidence = { ...evidence, completedAt: new Date().toISOString() };
    await atomicWriteJson(superadminResultPath, evidence);
  }
});
