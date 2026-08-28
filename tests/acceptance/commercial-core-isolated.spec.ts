import { expect, test, type BrowserContext, type Locator, type Page, type Route } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const runtimeConfigPath = path.join(root, '.visual-runtime', 'commercial-core-stack.json');
const credentialPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const resultPath = path.join(root, '.visual-runtime', 'commercial-core-acceptance-result.json');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Client: PgClient } = backendRequire('pg');
const Redis = backendRequire('ioredis').default;

type RuntimeConfig = {
  databaseUrl: string;
  redisHost: string;
  redisPort: number;
};

type Credentials = {
  email: string;
  password: string;
  mfaSecret: string;
};

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/=+$/g, '');
  let bits = '';
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid isolated MFA secret.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string) {
  const counter = Math.floor(Date.now() / 30_000);
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

async function verifyMfa(page: Page, secret: string) {
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const remaining = 30_000 - (Date.now() % 30_000);
    if (remaining < 15_000) await page.waitForTimeout(remaining + 500);
    const responsePromise = page.waitForResponse(
      (response) => response.url().includes('/api/auth/mfa/verify') && response.request().method() === 'POST',
      { timeout: 60_000 },
    );
    await page.getByLabel('Codice di verifica a 6 cifre').fill(totp(secret));
    await page.getByRole('button', { name: 'Verifica Codice' }).click();
    const response = await responsePromise;
    if (response.ok()) {
      await page.waitForURL(/\/dashboard$/, { timeout: 60_000 });
      return;
    }
    if (attempt === 3) throw new Error(`Isolated MFA verification failed with HTTP ${response.status()} after ${attempt} attempts.`);
    await expect(page.getByLabel('Codice di verifica a 6 cifre')).toBeVisible();
  }
}

async function login(context: BrowserContext, email: string, credentials: Credentials, withMfa = false) {
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  if (withMfa) {
    await page.waitForURL(/\/doflow\/mfa$/);
    await verifyMfa(page, credentials.mfaSecret);
  } else {
    await page.waitForURL(/\/dashboard$/);
  }
  const cookies = await context.cookies();
  const session = cookies.find((cookie) => cookie.name === 'doflow_session');
  const csrf = cookies.find((cookie) => cookie.name === 'doflow_csrf');
  expect(session?.httpOnly).toBe(true);
  expect(csrf?.httpOnly).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('doflow_token'))).toBeNull();
  const flowPreferences = await appFetch(page, '/tenant/preferences', {
    method: 'PATCH',
    body: {
      onboardingStatus: 'dismissed',
      tutorialVersion: 2,
      dismissedModules: ['commercial'],
      suggestionsEnabled: false,
      contextualMascotEnabled: false,
    },
  });
  expect(flowPreferences.ok).toBe(true);
  await dismissFlowOverlays(page, true);
  return { page, sessionValue: session!.value };
}

async function appFetch(
  page: Page,
  pathname: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
) {
  return page.evaluate(async ({ pathValue, request }) => {
    const method = request.method ?? 'GET';
    const csrf = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('doflow_csrf='))?.slice('doflow_csrf='.length);
    const headers: Record<string, string> = {
      ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(request.headers ?? {}),
    };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
    const response = await fetch(`/api${pathValue}`, {
      method,
      headers,
      credentials: 'include',
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* assertion reports status/text */ }
    return { status: response.status, ok: response.ok, json, text };
  }, { pathValue: pathname, request: options });
}

async function assertNoAuthoritativeCommercialStorage(page: Page) {
  const audit = await page.evaluate(() => Object.keys(localStorage).filter((key) => /lead|pipeline|customer|duplicate|campaign|commercial/i.test(key)));
  expect(audit).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('doflow_token'))).toBeNull();
}

async function dismissFlowOverlays(page: Page, waitForAppearance = false) {
  const welcomeDialog = page.getByRole('dialog', { name: 'Benvenuto in DoFlow' });
  const hintClose = page.getByRole('button', { name: 'Chiudi suggerimento Flow', exact: true });
  let welcomeVisible = await welcomeDialog.isVisible().catch(() => false);
  let hintVisible = await hintClose.isVisible().catch(() => false);

  if (waitForAppearance && !welcomeVisible && !hintVisible) {
    await Promise.race([
      welcomeDialog.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined),
      hintClose.waitFor({ state: 'visible', timeout: 3_000 }).catch(() => undefined),
      page.waitForTimeout(3_000),
    ]);
    welcomeVisible = await welcomeDialog.isVisible().catch(() => false);
    hintVisible = await hintClose.isVisible().catch(() => false);
  }

  if (welcomeVisible) {
    await welcomeDialog.getByRole('button', { name: 'Esplora in autonomia', exact: true }).click();
    await welcomeDialog.waitFor({ state: 'hidden' });
    hintVisible = await hintClose.waitFor({ state: 'visible', timeout: 3_000 })
      .then(() => true)
      .catch(() => false);
  }

  if (hintVisible) {
    await hintClose.click();
    await hintClose.waitFor({ state: 'hidden' });
  }
}

async function createLeadThroughUi(page: Page, input: {
  marker: string;
  company: string;
  email: string;
  firstName: string;
  lastName: string;
  duplicate?: boolean;
}) {
  await page.goto('/dashboard/commercial/leads');
  await dismissFlowOverlays(page, true);
  const newLeadButton = page.getByRole('button', { name: 'Nuovo lead', exact: true }).first();
  await newLeadButton.waitFor();
  await newLeadButton.click();
  await page.getByLabel('Nome *').fill(input.firstName);
  await page.getByLabel('Cognome').fill(input.lastName);
  await page.getByLabel('Azienda *').fill(input.company);
  await page.getByLabel('Email').fill(input.email);
  const phoneSuffix = input.marker.replace(/\D/g, '').slice(-7).padStart(7, '0');
  await page.getByLabel('Telefono').fill(`+39 333 ${phoneSuffix}`);
  await page.getByLabel('Servizio richiesto').fill(`Servizio ${input.marker}`);
  await page.getByLabel('Valore stimato').fill('12500');
  await page.getByLabel('Prossima azione').fill(`Follow-up ${input.marker}`);

  const responsePromise = page.waitForResponse((response) => response.url().endsWith('/api/tenant/commercial/leads') && response.request().method() === 'POST', { timeout: 30_000 });
  await page.getByRole('button', { name: 'Crea lead', exact: true }).click();
  const duplicateHeading = page.getByRole('heading', { name: 'Possibile duplicato rilevato' });
  const duplicateVisible = await Promise.race([
    responsePromise.then(() => false),
    duplicateHeading.waitFor({ timeout: 5_000 }).then(() => true).catch(() => false),
  ]);
  if (input.duplicate) expect(duplicateVisible).toBe(true);
  if (duplicateVisible) {
    await page.getByRole('button', { name: 'Crea comunque' }).click();
    await page.getByRole('heading', { name: 'Creare comunque il lead?' }).waitFor();
    await page.getByRole('button', { name: 'Conferma creazione' }).click();
  }
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  return (await response.json()).item as { id: string; version: number };
}

async function editOpportunityThroughUi(page: Page, opportunityName: string) {
  await dismissFlowOverlays(page, true);
  await page.getByRole('button', { name: 'Modifica', exact: true }).click();
  const editor = page.getByRole('dialog', { name: 'Modifica dati del lead' });
  await expect(editor).toBeVisible();
  await page.locator('#lead-opportunityName').fill(opportunityName);
  await page.locator('#lead-location').fill('Milano');
  const responsePromise = page.waitForResponse((response) => /\/api\/tenant\/crm\/opportunities\/[0-9a-f-]+$/.test(response.url()) && response.request().method() === 'PATCH');
  await page.getByRole('button', { name: 'Salva modifiche' }).click();
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  await expect(editor).toBeHidden();
}

async function selectOperationalValue(page: Page, label: string, option: string, endpoint: RegExp) {
  await dismissFlowOverlays(page);
  const block = page.getByText(label, { exact: true }).first().locator('..');
  await block.getByRole('combobox').click();
  const responsePromise = page.waitForResponse(
    (response) => endpoint.test(response.url()) && ['PATCH', 'POST'].includes(response.request().method()),
    { timeout: 30_000 },
  );
  await page.getByRole('option', { name: option, exact: true }).click();
  const confirmation = page.getByRole('alertdialog');
  if (await confirmation.isVisible().catch(() => false)) {
    await confirmation.getByRole('button', { name: 'Conferma', exact: true }).click();
  }
  const response = await responsePromise;
  expect(response.ok()).toBe(true);
  return response;
}

async function dragCenterTo(page: Page, source: Locator, target: Locator) {
  await source.scrollIntoViewIfNeeded();
  await target.scrollIntoViewIfNeeded();
  const sourceBox = await source.boundingBox();
  const targetBox = await target.boundingBox();
  if (!sourceBox || !targetBox) throw new Error('Pipeline drag target is not measurable.');
  const sourcePoint = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + Math.min(40, sourceBox.height / 2) };
  const targetPoint = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + Math.min(72, targetBox.height / 2) };
  await page.mouse.move(sourcePoint.x, sourcePoint.y);
  await page.mouse.down();
  await page.mouse.move(sourcePoint.x + 12, sourcePoint.y + 12, { steps: 4 });
  await page.mouse.move(targetPoint.x, targetPoint.y, { steps: 18 });
  await page.mouse.up();
}

function restart(service: 'frontend' | 'backend') {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/commercial-core-isolated-stack.mjs'), `restart-${service}`], {
    cwd: root,
    encoding: 'utf8',
    windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`Unable to restart isolated ${service}.`);
}

test('Commercial Core usa PostgreSQL e Redis con sessioni e tenant realmente isolati', async ({ browser, request }) => {
  const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8')) as RuntimeConfig;
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  expect(new URL(config.databaseUrl).hostname).toBe('localhost');
  expect(config.redisHost).toBe('localhost');

  const marker = `ACC-${Date.now()}`;
  const company = `Acceptance ${marker}`;
  const email = `lead.${marker.toLowerCase()}@example.invalid`;
  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  let contextA2: BrowserContext | undefined;
  const db = new PgClient({ connectionString: config.databaseUrl });
  const redis = new Redis({ host: config.redisHost, port: config.redisPort, lazyConnect: true });

  try {
    await db.connect();
    await redis.connect();

    const ownerLogin = await login(contextA, credentials.email, credentials, true);
    const pageA = ownerLogin.page;
    const notificationActor = (await db.query(
      'SELECT id::text, lower(role) AS role FROM public.users WHERE lower(email) = lower($1) LIMIT 1',
      [credentials.email],
    )).rows[0];
    expect(notificationActor?.id).toBeTruthy();
    const initialNotificationSummary = await appFetch(pageA, '/tenant/notifications/summary');
    expect(initialNotificationSummary.ok).toBe(true);
    const initialUnread = Number(initialNotificationSummary.json.unreadNotifications || 0);
    await db.query(
      `WITH watermark AS (
         SELECT MAX(created_at) AS value
         FROM doflow.notifications
         WHERE deleted_at IS NULL
           AND (recipient_user_id = $1 OR lower(coalesce(recipient_role, '')) = $2)
       )
       INSERT INTO doflow.notification_preferences (user_id, last_seen_at, created_at, updated_at)
       SELECT $1, watermark.value, now(), now() FROM watermark
       ON CONFLICT (user_id) WHERE deleted_at IS NULL DO UPDATE
       SET last_seen_at = EXCLUDED.last_seen_at, updated_at = now()`,
      [notificationActor.id, notificationActor.role],
    );
    const otherDoflowUser = (await db.query(
      `SELECT id::text FROM public.users
       WHERE lower(email) = 'visual.manager@acceptance.invalid'
       LIMIT 1`,
    )).rows[0];
    expect(otherDoflowUser?.id).toBeTruthy();
    const isolationSentinel = '2000-01-01T00:00:00.123456Z';
    for (const schema of ['doflow', 'acceptance_secondary']) {
      await db.query(
        `INSERT INTO "${schema}".notification_preferences (user_id, last_seen_at, created_at, updated_at)
         VALUES ($1, $2::timestamptz, now(), now())
         ON CONFLICT (user_id) WHERE deleted_at IS NULL DO UPDATE
         SET last_seen_at = EXCLUDED.last_seen_at, updated_at = now()`,
        [otherDoflowUser.id, isolationSentinel],
      );
    }
    const notificationIds = Array.from({ length: 5 }, () => randomUUID());
    await db.query(
      `WITH base AS (
         SELECT date_trunc('second', clock_timestamp()) + interval '0.123450 seconds' AS value
       )
       INSERT INTO doflow.notifications (
         id, recipient_user_id, title, type, priority, status, fingerprint, created_at, updated_at
       )
       SELECT ids.id, $2, 'Synthetic notification', 'hotfix_acceptance', 'medium', 'unread',
              $3 || ':' || ids.ordinality, base.value + ids.ordinality * interval '1 microsecond',
              base.value + ids.ordinality * interval '1 microsecond'
       FROM unnest($1::uuid[]) WITH ORDINALITY AS ids(id, ordinality)
       CROSS JOIN base`,
      [notificationIds, notificationActor.id, `hotfix:${marker}:initial`],
    );
    const fiveNotificationSummary = await appFetch(pageA, '/tenant/notifications/summary');
    expect(fiveNotificationSummary.ok).toBe(true);
    expect(fiveNotificationSummary.json.newNotifications).toBe(5);
    expect(fiveNotificationSummary.json.unreadNotifications).toBe(initialUnread + 5);
    const firstSeen = await appFetch(pageA, '/tenant/notifications/seen', { method: 'PATCH' });
    expect(firstSeen.ok).toBe(true);
    const afterFirstSeen = await appFetch(pageA, '/tenant/notifications/summary');
    expect(afterFirstSeen.json.newNotifications).toBe(0);
    expect(afterFirstSeen.json.unreadNotifications).toBe(initialUnread + 5);
    const precisionAudit = (await db.query(
      `SELECT preference.last_seen_at = visible.maximum AS exact,
              to_char(preference.last_seen_at, 'YYYY-MM-DD HH24:MI:SS.US') AS seen,
              to_char(visible.maximum, 'YYYY-MM-DD HH24:MI:SS.US') AS maximum
       FROM doflow.notification_preferences preference
       CROSS JOIN LATERAL (
         SELECT MAX(created_at) AS maximum
         FROM doflow.notifications
         WHERE recipient_user_id = $1 AND deleted_at IS NULL
       ) visible
       WHERE preference.user_id = $1 AND preference.deleted_at IS NULL`,
      [notificationActor.id],
    )).rows[0];
    expect(precisionAudit).toMatchObject({ exact: true });
    expect(precisionAudit.seen).toBe(precisionAudit.maximum);
    const markOneRead = await appFetch(pageA, `/tenant/notifications/${notificationIds[0]}/read`, { method: 'PATCH' });
    expect(markOneRead.ok).toBe(true);
    const afterOneRead = await appFetch(pageA, '/tenant/notifications/summary');
    expect(afterOneRead.json.newNotifications).toBe(0);
    expect(afterOneRead.json.unreadNotifications).toBe(initialUnread + 4);
    const laterNotificationId = randomUUID();
    await db.query(
      `INSERT INTO doflow.notifications (
         id, recipient_user_id, title, type, priority, status, fingerprint, created_at, updated_at
       )
       SELECT $1, $2, 'Synthetic later notification', 'hotfix_acceptance', 'medium', 'unread', $3,
              last_seen_at + interval '1 microsecond', last_seen_at + interval '1 microsecond'
       FROM doflow.notification_preferences
       WHERE user_id = $2 AND deleted_at IS NULL`,
      [laterNotificationId, notificationActor.id, `hotfix:${marker}:later`],
    );
    const afterConcurrentInsert = await appFetch(pageA, '/tenant/notifications/summary');
    expect(afterConcurrentInsert.json.newNotifications).toBe(1);
    const secondSeen = await appFetch(pageA, '/tenant/notifications/seen', { method: 'PATCH' });
    expect(secondSeen.ok).toBe(true);
    expect((await appFetch(pageA, '/tenant/notifications/summary')).json.newNotifications).toBe(0);
    const isolationRows = await db.query(
      `SELECT
         (SELECT last_seen_at::text FROM doflow.notification_preferences WHERE user_id = $1 AND deleted_at IS NULL) AS user_b,
         (SELECT last_seen_at::text FROM acceptance_secondary.notification_preferences WHERE user_id = $1 AND deleted_at IS NULL) AS tenant_b`,
      [otherDoflowUser.id],
    );
    expect(new Date(isolationRows.rows[0].user_b).toISOString()).toBe('2000-01-01T00:00:00.123Z');
    expect(new Date(isolationRows.rows[0].tenant_b).toISOString()).toBe('2000-01-01T00:00:00.123Z');

    const staleNotificationId = randomUUID();
    await db.query(
      `INSERT INTO doflow.notifications (
         id, recipient_user_id, title, type, priority, status, fingerprint, created_at, updated_at
       )
       SELECT $1, $2, 'Synthetic stale response notification', 'hotfix_acceptance', 'medium', 'unread', $3,
              last_seen_at + interval '1 microsecond', last_seen_at + interval '1 microsecond'
       FROM doflow.notification_preferences
       WHERE user_id = $2 AND deleted_at IS NULL`,
      [staleNotificationId, notificationActor.id, `hotfix:${marker}:stale`],
    );
    let releaseStaleSummary!: () => void;
    let staleSummaryStarted!: () => void;
    const staleSummaryRelease = new Promise<void>((resolve) => { releaseStaleSummary = resolve; });
    const staleSummaryRequest = new Promise<void>((resolve) => { staleSummaryStarted = resolve; });
    let heldSummary = false;
    const holdStaleSummary = async (route: Route) => {
      if (heldSummary) return route.continue();
      heldSummary = true;
      const response = await route.fetch();
      staleSummaryStarted();
      await staleSummaryRelease;
      await route.fulfill({ response });
    };
    await pageA.route('**/api/tenant/notifications/summary*', holdStaleSummary);
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await staleSummaryRequest;
    const seenResponse = pageA.waitForResponse(
      (response) => response.url().includes('/api/tenant/notifications/seen') && response.request().method() === 'PATCH',
    );
    const notificationBell = pageA.getByRole('button', { name: 'Apri notifiche' });
    await notificationBell.click();
    expect((await seenResponse).ok()).toBe(true);
    releaseStaleSummary();
    await pageA.waitForTimeout(300);
    await pageA.unroute('**/api/tenant/notifications/summary*', holdStaleSummary);
    await expect(notificationBell).not.toContainText('1');
    expect((await appFetch(pageA, '/tenant/notifications/summary')).json.newNotifications).toBe(0);
    await notificationBell.click();
    await notificationBell.click();
    await expect(notificationBell).not.toContainText('1');
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await expect(pageA.getByRole('button', { name: 'Apri notifiche' })).not.toContainText('1');

    const lead = await createLeadThroughUi(pageA, {
      marker,
      company,
      email,
      firstName: 'Owner',
      lastName: marker,
    });
    const detailPath = `/dashboard/commercial/leads/${lead.id}`;

    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await expect(pageA.getByText(company, { exact: true }).first()).toBeVisible();
    await pageA.goto(detailPath);
    await expect(pageA.getByText(`Follow-up ${marker}`, { exact: true })).toBeVisible();
    await editOpportunityThroughUi(pageA, `Owner updated ${marker}`);
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await dismissFlowOverlays(pageA);
    await pageA.getByRole('button', { name: 'Modifica', exact: true }).click();
    await expect(pageA.locator('#lead-opportunityName')).toHaveValue(`Owner updated ${marker}`);
    await pageA.getByRole('button', { name: 'Annulla', exact: true }).click();

    await selectOperationalValue(pageA, 'Responsabile', 'Visual Manager', new RegExp(`/api/tenant/crm/opportunities/${lead.id}$`));
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await selectOperationalValue(pageA, 'Stato', 'Qualificato', new RegExp(`/api/tenant/commercial/pipeline/${lead.id}/transition$`));
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await expect(pageA.getByText('Visual Manager', { exact: true }).first()).toBeVisible();
    await expect(pageA.getByText('Qualificato', { exact: true }).first()).toBeVisible();

    const pipelineMarker = `${marker}-PIPE`;
    const pipelineCompany = `Pipeline ${pipelineMarker}`;
    const pipelineLead = await createLeadThroughUi(pageA, {
      marker: pipelineMarker,
      company: pipelineCompany,
      email: `pipeline.${marker.toLowerCase()}@example.invalid`,
      firstName: 'Pipeline',
      lastName: marker,
    });
    await pageA.goto('/dashboard/commercial/pipeline');
    await dismissFlowOverlays(pageA, true);
    const pipelineCard = () => pageA.locator(`[data-commercial-deal="${pipelineLead.id}"]`);
    const pipelineMutations: string[] = [];
    const pipelineDestructiveMutations: string[] = [];
    const observePipelineMutation = (request: { method(): string; url(): string }) => {
      if (request.method() === 'PATCH' && /\/api\/tenant\/commercial\/pipeline\//.test(request.url())) pipelineMutations.push(request.url());
      if (
        /\/api\/tenant\/commercial\/archive\//.test(request.url()) ||
        (request.method() === 'DELETE' && /\/api\/tenant\/crm\/opportunities\//.test(request.url()))
      ) pipelineDestructiveMutations.push(request.url());
    };
    pageA.on('request', observePipelineMutation);
    await pipelineCard().getByRole('button', { name: `Azioni ${pipelineCompany}` }).click();
    await expect(pageA.getByRole('menuitem', { name: 'Apri scheda', exact: true })).toBeVisible();
    expect(pipelineMutations).toEqual([]);
    await pageA.keyboard.press('Escape');

    const crossColumnResponse = pageA.waitForResponse(
      (response) => response.url().endsWith(`/api/tenant/commercial/pipeline/${pipelineLead.id}/transition`) && response.request().method() === 'PATCH',
      { timeout: 30_000 },
    );
    await dragCenterTo(pageA, pipelineCard(), pageA.locator('[data-commercial-stage="proposal"]'));
    const completedCrossColumnResponse = await crossColumnResponse;
    expect(completedCrossColumnResponse.ok()).toBe(true);
    const completedCrossColumnBody = await completedCrossColumnResponse.json();
    expect({
      stage: completedCrossColumnBody.item.stage,
      uiStage: completedCrossColumnBody.item.ui_stage,
      itemKeys: Object.keys(completedCrossColumnBody.item).sort(),
    }).toEqual(expect.objectContaining({ stage: 'quote', uiStage: 'proposal' }));
    await expect(pageA.locator('[data-commercial-stage="new"]', { has: pipelineCard() })).toHaveCount(0);
    await expect(pageA.locator('[data-commercial-stage="proposal"]', { has: pipelineCard() })).toHaveCount(1);
    await expect(pageA.locator(`[data-commercial-stage] [data-commercial-deal="${pipelineLead.id}"]`)).toHaveCount(1);
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await dismissFlowOverlays(pageA);
    await expect(pageA.locator('[data-commercial-stage="proposal"]', { has: pipelineCard() })).toBeVisible();

    await pipelineCard().getByRole('button', { name: `Azioni ${pipelineCompany}` }).click();
    await pageA.getByRole('menuitem', { name: 'Sposta in', exact: true }).hover();
    const menuMoveResponse = pageA.waitForResponse(
      (response) => response.url().endsWith(`/api/tenant/commercial/pipeline/${pipelineLead.id}/transition`) && response.request().method() === 'PATCH',
      { timeout: 30_000 },
    );
    await pageA.getByRole('menuitem', { name: 'Qualificato', exact: true }).click();
    expect((await menuMoveResponse).ok()).toBe(true);
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await dismissFlowOverlays(pageA);
    const qualified = pageA.locator('[data-commercial-stage="qualified"]');
    await expect(qualified.locator(`[data-commercial-deal="${lead.id}"]`)).toBeVisible();
    await expect(qualified.locator(`[data-commercial-deal="${pipelineLead.id}"]`)).toBeVisible();
    const orderBefore = await qualified.locator('[data-commercial-deal]').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-commercial-deal')));
    const pipelineWasBeforeLead = orderBefore.indexOf(pipelineLead.id) < orderBefore.indexOf(lead.id);
    const reorderResponse = pageA.waitForResponse(
      (response) => response.url().endsWith('/api/tenant/commercial/pipeline/reorder') && response.request().method() === 'PATCH',
      { timeout: 30_000 },
    );
    await dragCenterTo(pageA, qualified.locator(`[data-commercial-deal="${pipelineLead.id}"]`), qualified.locator(`[data-commercial-deal="${lead.id}"]`));
    expect((await reorderResponse).ok()).toBe(true);
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await dismissFlowOverlays(pageA);
    const orderAfter = await pageA.locator('[data-commercial-stage="qualified"] [data-commercial-deal]').evaluateAll((cards) => cards.map((card) => card.getAttribute('data-commercial-deal')));
    expect(orderAfter).not.toEqual(orderBefore);
    expect(orderAfter.indexOf(pipelineLead.id) < orderAfter.indexOf(lead.id)).toBe(!pipelineWasBeforeLead);

    const failureMarker = `${marker}-FAIL`;
    const failureCompany = `Pipeline failure ${failureMarker}`;
    const failureLead = await createLeadThroughUi(pageA, {
      marker: failureMarker,
      company: failureCompany,
      email: `pipeline.failure.${marker.toLowerCase()}@example.invalid`,
      firstName: 'Failure',
      lastName: marker,
    });
    await pageA.goto('/dashboard/commercial/pipeline');
    await dismissFlowOverlays(pageA, true);
    const failureCard = () => pageA.locator(`[data-commercial-deal="${failureLead.id}"]`);
    let failedMoveAttempts = 0;
    let releaseFailedMove!: () => void;
    let failedMoveStarted!: () => void;
    const failedMoveRelease = new Promise<void>((resolve) => { releaseFailedMove = resolve; });
    const failedMoveRequest = new Promise<void>((resolve) => { failedMoveStarted = resolve; });
    const failTransition = async (route: Route) => {
      failedMoveAttempts += 1;
      failedMoveStarted();
      await failedMoveRelease;
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ message: 'Synthetic transition failure' }) });
    };
    await pageA.route(`**/api/tenant/commercial/pipeline/${failureLead.id}/transition`, failTransition);
    await failureCard().getByRole('button', { name: `Azioni ${failureCompany}` }).click();
    await pageA.getByRole('menuitem', { name: 'Sposta in', exact: true }).hover();
    await pageA.getByRole('menuitem', { name: 'Qualificato', exact: true }).click();
    await failedMoveRequest;
    await expect(failureCard().getByRole('button', { name: `Azioni ${failureCompany}` })).toBeDisabled();
    releaseFailedMove();
    await pageA.waitForTimeout(200);
    await pageA.unroute(`**/api/tenant/commercial/pipeline/${failureLead.id}/transition`, failTransition);
    expect(failedMoveAttempts).toBe(1);
    await expect(pageA.locator('[data-commercial-stage="new"]', { has: failureCard() })).toHaveCount(1);
    await expect(pageA.locator(`[data-commercial-stage] [data-commercial-deal="${failureLead.id}"]`)).toHaveCount(1);

    await failureCard().getByRole('button', { name: `Azioni ${failureCompany}` }).click();
    await pageA.getByRole('menuitem', { name: 'Sposta in', exact: true }).hover();
    await pageA.getByRole('menuitem', { name: 'Non idoneo', exact: true }).click();
    await expect(pageA.getByRole('dialog')).toBeVisible();
    await expect(pageA.locator('[data-commercial-stage="new"]', { has: failureCard() })).toHaveCount(1);
    await pageA.locator('#move-reason').fill('Synthetic negative-stage acceptance');
    const negativeResponse = pageA.waitForResponse(
      (response) => response.url().endsWith(`/api/tenant/commercial/pipeline/${failureLead.id}/transition`) && response.request().method() === 'PATCH',
    );
    await pageA.getByRole('dialog').getByRole('button', { name: 'Conferma', exact: true }).click();
    expect((await negativeResponse).ok()).toBe(true);
    await expect(pageA.locator('[data-commercial-stage="unqualified"]', { has: failureCard() })).toHaveCount(1);
    await expect(pageA.locator(`[data-commercial-stage] [data-commercial-deal="${failureLead.id}"]`)).toHaveCount(1);

    const wonMarker = `${marker}-WON`;
    const wonCompany = `Pipeline won ${wonMarker}`;
    const wonLead = await createLeadThroughUi(pageA, {
      marker: wonMarker,
      company: wonCompany,
      email: `pipeline.won.${marker.toLowerCase()}@example.invalid`,
      firstName: 'Won',
      lastName: marker,
    });
    await pageA.goto('/dashboard/commercial/pipeline');
    await dismissFlowOverlays(pageA, true);
    const wonCard = () => pageA.locator(`[data-commercial-deal="${wonLead.id}"]`);
    await wonCard().getByRole('button', { name: `Azioni ${wonCompany}` }).click();
    await pageA.getByRole('menuitem', { name: 'Sposta in', exact: true }).hover();
    await pageA.getByRole('menuitem', { name: 'Vinto', exact: true }).click();
    await expect(pageA.getByRole('dialog')).toBeVisible();
    await expect(pageA.locator('[data-commercial-stage="new"]', { has: wonCard() })).toHaveCount(1);
    const wonResponse = pageA.waitForResponse(
      (response) => response.url().endsWith(`/api/tenant/commercial/leads/${wonLead.id}/convert`) && response.request().method() === 'POST',
      { timeout: 30_000 },
    );
    await pageA.getByRole('dialog').getByRole('button', { name: 'Conferma e crea cliente', exact: true }).click();
    expect((await wonResponse).ok()).toBe(true);
    await expect(pageA.locator('[data-commercial-stage="won"]', { has: wonCard() })).toHaveCount(1);
    await expect(pageA.locator(`[data-commercial-stage] [data-commercial-deal="${wonLead.id}"]`)).toHaveCount(1);
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await dismissFlowOverlays(pageA);
    await expect(pageA.locator('[data-commercial-stage="won"]', { has: wonCard() })).toHaveCount(1);
    expect(pipelineDestructiveMutations).toEqual([]);
    pageA.off('request', observePipelineMutation);
    await pageA.goto(detailPath);
    await expect(pageA.getByRole('heading', { name: company, exact: true }).first()).toBeVisible();

    const managerLogin = await login(contextB, 'visual.manager@acceptance.invalid', credentials);
    const pageB = managerLogin.page;
    expect(managerLogin.sessionValue).not.toBe(ownerLogin.sessionValue);
    await pageB.goto(detailPath);
    await expect(pageB.getByRole('heading', { name: company, exact: true }).first()).toBeVisible();
    await editOpportunityThroughUi(pageB, `Manager updated ${marker}`);
    await pageB.reload({ waitUntil: 'domcontentloaded' });
    await dismissFlowOverlays(pageB);
    await pageB.getByRole('button', { name: 'Modifica', exact: true }).click();
    await expect(pageB.locator('#lead-opportunityName')).toHaveValue(`Manager updated ${marker}`);
    await pageB.getByRole('button', { name: 'Annulla', exact: true }).click();
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    await dismissFlowOverlays(pageA);
    await pageA.getByRole('button', { name: 'Modifica', exact: true }).click();
    await expect(pageA.locator('#lead-opportunityName')).toHaveValue(`Manager updated ${marker}`);
    await pageA.getByRole('button', { name: 'Annulla', exact: true }).click();

    await assertNoAuthoritativeCommercialStorage(pageA);
    await assertNoAuthoritativeCommercialStorage(pageB);
    await contextA.close();

    contextA2 = await browser.newContext();
    const ownerRelogin = await login(contextA2, credentials.email, credentials, true);
    const pageA2 = ownerRelogin.page;
    expect(ownerRelogin.sessionValue).not.toBe(managerLogin.sessionValue);
    await pageA2.goto(detailPath);
    await expect(pageA2.getByRole('heading', { name: company, exact: true }).first()).toBeVisible({ timeout: 30_000 });

    restart('frontend');
    await pageA2.reload({ waitUntil: 'domcontentloaded' });
    await expect(pageA2.getByRole('heading', { name: company, exact: true }).first()).toBeVisible();
    restart('backend');
    await pageA2.reload({ waitUntil: 'domcontentloaded' });
    await expect(pageA2.getByRole('heading', { name: company, exact: true }).first()).toBeVisible();

    const conversionResponse = await selectOperationalValue(
      pageA2,
      'Stato',
      'Vinto',
      new RegExp(`/api/tenant/commercial/leads/${lead.id}/convert$`),
    );
    const conversionRequest = conversionResponse.request();
    const conversionKey = conversionRequest.headers()['idempotency-key'];
    const conversionBody = conversionRequest.postDataJSON();
    const conversion = await conversionResponse.json();
    expect(conversionKey).toBeTruthy();
    const repeatedConversion = await appFetch(pageA2, `/tenant/commercial/leads/${lead.id}/convert`, {
      method: 'POST',
      headers: { 'Idempotency-Key': conversionKey },
      body: conversionBody,
    });
    expect(repeatedConversion.ok).toBe(true);
    expect(repeatedConversion.json.clientId).toBe(conversion.clientId);
    await pageA2.reload({ waitUntil: 'domcontentloaded' });
    await expect(pageA2.getByRole('link', { name: 'Apri cliente' })).toBeVisible();
    await pageB.reload({ waitUntil: 'domcontentloaded' });
    await expect(pageB.getByRole('link', { name: 'Apri cliente' })).toBeVisible();

    const duplicate = await createLeadThroughUi(pageA2, {
      marker,
      company,
      email,
      firstName: 'Duplicate',
      lastName: marker,
      duplicate: true,
    });
    await pageA2.goto('/dashboard/duplicati');
    await pageA2.getByRole('heading', { name: 'Duplicati', exact: true }).waitFor();
    const duplicateRefreshPromise = pageA2.waitForResponse(
      (response) => response.url().endsWith('/api/tenant/commercial/duplicates') && response.request().method() === 'GET',
      { timeout: 30_000 },
    );
    await pageA2.getByRole('button', { name: 'Analizza adesso' }).click();
    expect((await duplicateRefreshPromise).ok()).toBe(true);
    await pageA2.getByPlaceholder('Cerca record o motivo').fill(marker);
    const comparison = pageA2.getByRole('dialog').filter({ hasText: 'Confronta record' });
    const compareButtons = pageA2.getByRole('button', { name: 'Confronta' });
    let matchingOpportunityPair = false;
    for (let index = 0; index < await compareButtons.count(); index += 1) {
      await compareButtons.nth(index).click();
      await comparison.getByRole('heading', { name: 'Valori da conservare' }).waitFor();
      const hasOriginal = await comparison.locator(`a[href="${detailPath}"]`).count();
      const hasDuplicate = await comparison.locator(`a[href="/dashboard/commercial/leads/${duplicate.id}"]`).count();
      if (hasOriginal && hasDuplicate) {
        matchingOpportunityPair = true;
        break;
      }
      await pageA2.keyboard.press('Escape');
      await expect(comparison).toBeHidden();
    }
    expect(matchingOpportunityPair).toBe(true);
    const conflictRows = comparison.getByRole('heading', { name: 'Valori da conservare' }).locator('..').locator('div.grid');
    for (let index = 0; index < await conflictRows.count(); index += 1) {
      const buttons = conflictRows.nth(index).getByRole('button');
      if (await buttons.count()) await buttons.first().click();
    }
    await comparison.getByRole('button', { name: 'Continua con la fusione' }).click();
    const mergeConfirmation = pageA2.getByRole('alertdialog');
    await expect(mergeConfirmation.getByRole('heading', { name: 'Riepilogo finale della fusione' })).toBeVisible();
    const mergeResponsePromise = pageA2.waitForResponse((response) => response.url().endsWith('/api/tenant/commercial/duplicates/merge') && response.request().method() === 'POST');
    await mergeConfirmation.getByRole('button', { name: 'Conferma fusione' }).click();
    const mergeResponse = await mergeResponsePromise;
    expect(mergeResponse.ok()).toBe(true);
    const mergeRequest = mergeResponse.request();
    const mergeKey = mergeRequest.headers()['idempotency-key'];
    const mergeBody = mergeRequest.postDataJSON();
    const merge = await mergeResponse.json();
    const repeatedMerge = await appFetch(pageA2, '/tenant/commercial/duplicates/merge', {
      method: 'POST',
      headers: { 'Idempotency-Key': mergeKey },
      body: mergeBody,
    });
    expect(repeatedMerge.ok).toBe(true);
    expect(repeatedMerge.json.primaryId).toBe(merge.primaryId);

    const archived = await db.query(
      `SELECT id::text, version, merged_into_id::text, deleted_at IS NOT NULL AS archived
       FROM doflow.opportunities WHERE id = $1`,
      [merge.secondaryId],
    );
    expect(archived.rows[0]).toMatchObject({ archived: true, merged_into_id: merge.primaryId });
    const restore = await appFetch(pageA2, `/tenant/commercial/archive/lead/${merge.secondaryId}/restore`, {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: { version: Number(archived.rows[0].version) },
    });
    expect(restore.ok).toBe(false);

    const submissionId = randomUUID();
    const intakePayload = {
      submission_id: submissionId,
      form_version: 'doflow-contact-v1',
      project_type: 'Sito vetrina',
      goals: ['Ricevere più contatti'],
      timeline: 'Sto valutando',
      name: `Intake ${marker}`,
      company: `Intake Company ${marker}`,
      email: `intake.${marker.toLowerCase()}@example.invalid`,
      phone: '+39 333 000 5678',
      province: 'MI',
      privacy_accepted: true,
      website: '',
      landing_url: 'http://localhost:3100/acceptance',
      utm_source: 'acceptance-source',
      utm_medium: 'acceptance-medium',
      utm_campaign: `campaign-${marker}`,
      utm_content: 'acceptance-content',
      utm_term: 'acceptance-term',
      gclid: `gclid-${marker}`,
      completion_seconds: 60,
    };
    const intakeFirst = await request.post('http://localhost:3401/api/public/lead-intake/doflow', { data: intakePayload });
    const intakeSecond = await request.post('http://localhost:3401/api/public/lead-intake/doflow', { data: intakePayload });
    expect(intakeFirst.ok()).toBe(true);
    expect((await intakeFirst.json()).duplicate).toBe(false);
    expect(intakeSecond.ok()).toBe(true);
    expect((await intakeSecond.json()).duplicate).toBe(true);
    await pageA2.goto('/dashboard/commercial/leads');
    await expect(pageA2.getByText(`Intake Company ${marker}`, { exact: true }).first()).toBeVisible();
    await pageB.goto('/dashboard/commercial/leads');
    await expect(pageB.getByText(`Intake Company ${marker}`, { exact: true }).first()).toBeVisible();

    const secondaryLogin = await login(contextC, 'secondary.owner@acceptance.invalid', credentials);
    const pageC = secondaryLogin.page;
    expect(secondaryLogin.sessionValue).not.toBe(ownerRelogin.sessionValue);
    const secondaryLead = await appFetch(pageC, '/tenant/commercial/leads', {
      method: 'POST',
      headers: { 'Idempotency-Key': randomUUID() },
      body: {
        companyName: `Secondary ${marker}`,
        title: `Secondary ${marker}`,
        firstName: 'Secondary',
        lastName: marker,
        email: `secondary.${marker.toLowerCase()}@example.invalid`,
        stage: 'new',
        tenant: 'doflow',
      },
    });
    expect(secondaryLead.ok).toBe(true);
    const secondaryId = secondaryLead.json.item.id as string;
    const spoofedSecondaryRead = await appFetch(pageC, `/tenant/crm/opportunities/${lead.id}?tenant=doflow`, {
      headers: { 'x-doflow-tenant-id': 'doflow' },
    });
    expect([403, 404]).toContain(spoofedSecondaryRead.status);
    const secondaryList = await appFetch(pageC, '/tenant/crm/opportunities?tenant=doflow', {
      headers: { 'x-doflow-tenant-id': 'doflow' },
    });
    expect(secondaryList.ok).toBe(true);
    expect(secondaryList.json.items.some((item: any) => item.id === lead.id)).toBe(false);
    expect(secondaryList.json.items.some((item: any) => item.id === secondaryId)).toBe(true);
    const doflowCrossRead = await appFetch(pageA2, `/tenant/crm/opportunities/${secondaryId}?tenant=acceptance-secondary`, {
      headers: { 'x-doflow-tenant-id': 'acceptance_secondary' },
    });
    expect([403, 404]).toContain(doflowCrossRead.status);

    await assertNoAuthoritativeCommercialStorage(pageA2);
    await assertNoAuthoritativeCommercialStorage(pageB);
    await assertNoAuthoritativeCommercialStorage(pageC);

    const sessionKeys = (await redis.keys('doflow:web-session:*')).filter((key: string) => !key.startsWith('doflow:web-session-user:'));
    expect(sessionKeys.length).toBeGreaterThanOrEqual(3);
    const ttls = await Promise.all(sessionKeys.map((key: string) => redis.ttl(key)));
    expect(ttls.every((ttl: number) => ttl > 0)).toBe(true);

    const counts = await db.query(
      `SELECT
        (SELECT count(*)::int FROM doflow.opportunities WHERE id = $1) AS lead_count,
        (SELECT count(*)::int FROM doflow.companies WHERE id = $2) AS customer_count,
        (SELECT count(*)::int FROM doflow.commercial_idempotency WHERE idempotency_key = $3 AND status = 'completed') AS conversion_registry,
        (SELECT count(*)::int FROM doflow.commercial_idempotency WHERE idempotency_key = $4 AND status = 'completed') AS merge_registry,
        (SELECT count(*)::int FROM doflow.commercial_history WHERE correlation_id = $5) AS conversion_history,
        (SELECT count(*)::int FROM doflow.commercial_history WHERE correlation_id = $6) AS merge_history,
        (SELECT count(*)::int FROM doflow.commercial_outbox WHERE correlation_id = $5) AS conversion_outbox,
        (SELECT count(*)::int FROM doflow.commercial_outbox WHERE correlation_id = $6) AS merge_outbox,
        (SELECT count(*)::int FROM doflow.lead_intake_submissions WHERE submission_id = $7) AS intake_submissions,
        (SELECT count(*)::int FROM doflow.commercial_attributions WHERE metadata->>'submission_id' = $7::text) AS intake_attributions,
        (SELECT count(*)::int FROM acceptance_secondary.opportunities WHERE id = $8) AS secondary_count,
        (SELECT count(*)::int FROM acceptance_secondary.opportunities WHERE id = $1) AS leaked_to_secondary,
        (SELECT count(*)::int FROM doflow.opportunities WHERE id = $8) AS leaked_to_doflow`,
      [lead.id, conversion.clientId, conversionKey, mergeKey, conversion.correlationId, merge.correlationId, submissionId, secondaryId],
    );
    expect(counts.rows[0]).toMatchObject({
      lead_count: 1,
      customer_count: 1,
      conversion_registry: 1,
      merge_registry: 1,
      conversion_history: 1,
      merge_history: 1,
      conversion_outbox: 1,
      merge_outbox: 1,
      intake_submissions: 1,
      intake_attributions: 1,
      secondary_count: 1,
      leaked_to_secondary: 0,
      leaked_to_doflow: 0,
    });

    const rawIp = await db.query(
      `SELECT count(*)::int AS raw_ip_count
       FROM doflow.lead_intake_submissions
       WHERE submission_id = $1
         AND concat_ws(' ', attribution::text, form_data::text, landing_url, source_origin)
           ~ '([0-9]{1,3}\\.){3}[0-9]{1,3}'`,
      [submissionId],
    );
    expect(rawIp.rows[0].raw_ip_count).toBe(0);

    const beforeLogout = sessionKeys.length;
    const logout = await appFetch(pageB, '/auth/logout', { method: 'POST' });
    expect(logout.ok).toBe(true);
    expect((await appFetch(pageB, '/auth/me')).status).toBe(401);
    const blankContext = await browser.newContext();
    const blankPage = await blankContext.newPage();
    await blankPage.goto('/login');
    expect((await appFetch(blankPage, '/auth/me')).status).toBe(401);
    await blankContext.close();
    const afterLogoutKeys = (await redis.keys('doflow:web-session:*')).filter((key: string) => !key.startsWith('doflow:web-session-user:'));
    expect(afterLogoutKeys.length).toBe(beforeLogout - 1);

    await writeFile(resultPath, JSON.stringify({
      marker,
      postgres: counts.rows[0],
      redis: { sessionsBeforeLogout: beforeLogout, sessionsAfterLogout: afterLogoutKeys.length, ttlPositive: true },
      refresh: true,
      newBrowserContext: true,
      frontendRestart: true,
      backendRestart: true,
      conversionIdempotent: true,
      mergeIdempotent: true,
      intakeIdempotent: true,
      crossTenantIsolated: true,
      localStorageAuthoritativeCollections: 0,
    }, null, 2));
  } finally {
    redis.disconnect();
    await db.end().catch(() => undefined);
    await contextA.close().catch(() => undefined);
    await contextA2?.close().catch(() => undefined);
    await contextB.close().catch(() => undefined);
    await contextC.close().catch(() => undefined);
  }
});
