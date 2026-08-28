import { expect, test, type BrowserContext, type Locator, type Page } from '@playwright/test';
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
    const observePipelineMutation = (request: { method(): string; url(): string }) => {
      if (request.method() === 'PATCH' && /\/api\/tenant\/commercial\/pipeline\//.test(request.url())) pipelineMutations.push(request.url());
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
    expect((await crossColumnResponse).ok()).toBe(true);
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
