import { expect, test, type BrowserContext, type Page, type Request } from '@playwright/test';
import { createHmac } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const credentialPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const runtimeConfigPath = path.join(root, '.visual-runtime', 'commercial-core-stack.json');
const resultPath = path.join(root, '.visual-runtime', 'final-global-visual-result.json');
const actualDir = path.join(root, 'docs', 'design-references', 'doflow-crm-projects', 'actual', 'final-rc');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Client: PgClient } = backendRequire('pg');

type Credentials = { email: string; password: string; mfaSecret: string };
type Theme = 'light' | 'dark';
type Viewport = { label: string; width: number; height: number };
type RouteEntry = { slug: string; path: string };

const desktop: Viewport = { label: 'desktop-1440x900', width: 1440, height: 900 };
const responsive: Viewport[] = [
  { label: 'mobile-390x900', width: 390, height: 900 },
  { label: 'tablet-768x900', width: 768, height: 900 },
];
const themes: Theme[] = ['light', 'dark'];
const activeApiRequests = new WeakMap<Page, Set<Request>>();
const lastApiActivity = new WeakMap<Page, number>();

function monitorApiRequests(page: Page) {
  if (activeApiRequests.has(page)) return;
  const active = new Set<Request>();
  activeApiRequests.set(page, active);
  lastApiActivity.set(page, Date.now());
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    active.clear();
    lastApiActivity.set(page, Date.now());
  });
  const isApiRequest = (request: Request) => {
    try {
      return request.resourceType() !== 'websocket' && new URL(request.url()).pathname.startsWith('/api/');
    } catch {
      return false;
    }
  };
  page.on('request', (request) => {
    if (!isApiRequest(request)) return;
    active.add(request);
    lastApiActivity.set(page, Date.now());
  });
  const settle = (request: Request) => {
    if (!active.delete(request)) return;
    lastApiActivity.set(page, Date.now());
  };
  page.on('requestfinished', settle);
  page.on('requestfailed', settle);
}

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

async function loginWithMfa(context: BrowserContext, email: string, credentials: Credentials, superadmin = false, existingPage?: Page) {
  const page = existingPage ?? await context.newPage();
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/auth/')) console.log(`[final-visual] auth request ${request.method()} ${new URL(request.url()).pathname}`);
  });
  page.on('response', (response) => {
    if (new URL(response.url()).pathname.startsWith('/api/auth/')) console.log(`[final-visual] auth response ${response.status()} ${new URL(response.url()).pathname}`);
  });
  page.on('requestfailed', (request) => {
    if (new URL(request.url()).pathname.startsWith('/api/auth/')) console.log(`[final-visual] auth request failed ${new URL(request.url()).pathname}: ${request.failure()?.errorText}`);
  });
  if (existingPage) {
    expect(new URL(page.url()).pathname).toBe('/login');
  } else {
    await page.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
  }
  await page.getByLabel('Email').fill(email, { timeout: 20_000 });
  await page.getByLabel('Password', { exact: true }).fill(credentials.password, { timeout: 20_000 });
  await page.getByRole('button', { name: 'Accedi', exact: true }).click({ timeout: 20_000 });
  await expect(page).toHaveURL(/\/(?:doflow|public)\/mfa$/, { timeout: 60_000 });
  await page.getByLabel('Codice di verifica a 6 cifre').fill(await stableTotp(page, credentials.mfaSecret), { timeout: 20_000 });
  await page.getByRole('button', { name: 'Verifica Codice' }).click({ timeout: 20_000 });
  await expect(page).toHaveURL(superadmin ? /\/superadmin$/ : /\/dashboard$/, { timeout: 60_000 });
  expect((await context.cookies()).find((cookie) => cookie.name === 'doflow_session')?.httpOnly).toBe(true);
  return page;
}

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((selected) => {
    localStorage.setItem('doflow_theme', selected);
    localStorage.setItem('theme', selected);
    document.documentElement.classList.toggle('dark', selected === 'dark');
    document.documentElement.classList.toggle('light', selected === 'light');
    document.documentElement.style.colorScheme = selected;
  }, theme);
}

async function closeContextBounded(context: BrowserContext) {
  await Promise.race([
    context.close(),
    new Promise<void>((resolve) => setTimeout(resolve, 10_000)),
  ]);
}

async function navigate(page: Page, pathname: string, theme: Theme) {
  monitorApiRequests(page);
  // `goBack()` can leave an aborted provider read without a terminal browser
  // event. A new document is a fresh observation boundary, so do not let a
  // stale request from the previous history entry block the next route.
  activeApiRequests.get(page)?.clear();
  lastApiActivity.set(page, Date.now());
  const response = await page.goto(pathname, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  expect(response?.status() ?? 200, pathname).toBeLessThan(500);
  await setTheme(page, theme);
  await expect(page.locator('body')).toBeVisible();
  expect(new URL(page.url()).pathname, pathname).not.toBe('/login');
  await expect(page.locator('main').first(), pathname).toBeVisible({ timeout: 60_000 });
  // A full navigation remounts the tenant providers. Wait for their authorized
  // API reads to finish and remain quiet, while ignoring persistent browser
  // transports that make Playwright's generic `networkidle` nondeterministic.
  await page.waitForTimeout(750);
  await expect.poll(() => {
    const active = activeApiRequests.get(page)?.size ?? 0;
    const quietFor = Date.now() - (lastApiActivity.get(page) ?? 0);
    return active === 0 && quietFor >= 750;
  }, { timeout: 60_000, message: `authorized API reads did not settle for ${pathname}` }).toBe(true);
}

async function assertNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1);
}

async function accessibilitySmoke(page: Page, requireHeading = true) {
  const audit = await page.evaluate(() => {
    const visible = (element: Element) => {
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return element.getAttribute('aria-hidden') !== 'true'
        && style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && box.width > 0
        && box.height > 0;
    };
    const unnamed: string[] = [];
    for (const element of document.querySelectorAll('button,input,select,textarea,a[href]')) {
      if (!visible(element)) continue;
      const html = element as HTMLElement;
      const name = [
        html.getAttribute('aria-label'),
        html.getAttribute('title'),
        'labels' in element ? [...((element as HTMLInputElement).labels ?? [])].map((label) => label.textContent).join(' ') : null,
        html.innerText,
        html.textContent,
        html.getAttribute('placeholder'),
        html.getAttribute('alt'),
        html.querySelector('img[alt]')?.getAttribute('alt'),
      ].find((value) => value?.trim());
      if (!name) unnamed.push(`${element.tagName.toLowerCase()}${html.id ? `#${html.id}` : ''}:${html.outerHTML.slice(0, 240)}`);
    }
    const missingAlt = [...document.querySelectorAll('img')]
      .filter((element) => visible(element) && !element.hasAttribute('alt')).length;
    const headings = document.querySelectorAll('h1').length;
    return { unnamed, missingAlt, headings };
  });
  expect(audit.unnamed).toEqual([]);
  expect(audit.missingAlt).toBe(0);
  if (requireHeading) expect(audit.headings).toBeGreaterThan(0);
  return audit;
}

test('GLOBAL VISUAL GO: route reference, responsive, temi, interazioni e accessibilità', async ({ browser }) => {
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8')) as { databaseUrl: string };
  const delivery = JSON.parse(await readFile(path.join(root, '.visual-runtime', 'delivery-core-acceptance-result.json'), 'utf8'));
  const commerce = JSON.parse(await readFile(path.join(root, '.visual-runtime', 'commerce-cash-acceptance-result.json'), 'utf8'));
  const db = new PgClient({ connectionString: config.databaseUrl });
  await db.connect();
  const [leadRow] = (await db.query(`SELECT id::text FROM doflow.leads WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`)).rows;
  const [companyRow] = (await db.query(`SELECT id::text FROM doflow.companies WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 1`)).rows;
  await db.end();
  expect(leadRow?.id).toBeTruthy();
  expect(companyRow?.id).toBeTruthy();

  const canonicalRoutes: RouteEntry[] = [
    { slug: 'dashboard', path: '/dashboard' },
    { slug: 'commercial', path: '/dashboard/commercial' },
    { slug: 'leads', path: '/dashboard/commercial/leads' },
    { slug: 'pipeline', path: '/dashboard/commercial/pipeline' },
    { slug: 'duplicates', path: '/dashboard/duplicati' },
    { slug: 'campaigns', path: '/dashboard/campagne' },
    { slug: 'clients', path: '/dashboard/clienti' },
    { slug: 'activities', path: '/dashboard/attivita' },
    { slug: 'projects', path: '/dashboard/progetti' },
    { slug: 'deadlines', path: '/dashboard/scadenze' },
    { slug: 'catalog', path: '/dashboard/catalogo' },
    { slug: 'sales', path: '/dashboard/vendite' },
    { slug: 'orders', path: '/dashboard/ordini' },
    { slug: 'payments', path: '/dashboard/pagamenti' },
    { slug: 'quotes', path: '/dashboard/preventivi' },
    { slug: 'contracts', path: '/dashboard/contratti' },
    { slug: 'invoices', path: '/dashboard/fatture' },
    { slug: 'renewals', path: '/dashboard/rinnovi' },
    { slug: 'documents', path: '/dashboard/documenti' },
    { slug: 'archive', path: '/dashboard/archivio' },
    { slug: 'notifications', path: '/dashboard/notifiche' },
    { slug: 'automations', path: '/dashboard/automazioni' },
    { slug: 'settings', path: '/dashboard/impostazioni' },
    { slug: 'builder', path: '/commercial/site-proposals' },
    { slug: 'lead-detail', path: `/dashboard/commercial/leads/${leadRow.id}` },
    { slug: 'customer-detail', path: `/dashboard/clienti/${companyRow.id}` },
    { slug: 'project-detail', path: `/dashboard/progetti/${delivery.projectId}` },
    { slug: 'order-detail', path: `/dashboard/ordini/${commerce.orderId}` },
  ];
  const critical = new Set([
    'dashboard', 'pipeline', 'lead-detail', 'customer-detail', 'project-detail', 'activities',
    'order-detail', 'quotes', 'invoices', 'notifications', 'automations', 'builder',
  ]);
  const contexts: BrowserContext[] = [];
  const consoleErrors: string[] = [];
  const consoleWarnings: string[] = [];
  const serverErrors: string[] = [];
  let screenshotCount = 0;
  let accessibilityChecks = 0;

  const monitor = (page: Page) => {
    page.on('pageerror', (error) => consoleErrors.push(error.stack || error.message));
    page.on('console', (message) => {
      if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) consoleErrors.push(message.text());
      if (message.type() === 'warning') consoleWarnings.push(message.text());
    });
    page.on('response', (response) => {
      if (response.status() >= 500) serverErrors.push(`${response.status()} ${new URL(response.url()).pathname}`);
    });
  };

  const capture = async (page: Page, slug: string, viewport: Viewport, theme: Theme) => {
    await assertNoPageOverflow(page);
    await page.screenshot({
      path: path.join(actualDir, `${slug}-${viewport.label}-${theme}.png`),
      animations: 'disabled',
      fullPage: false,
      timeout: 60_000,
      mask: [page.locator('input[type="password"]'), page.locator('input[autocomplete="one-time-code"]')],
    });
    screenshotCount += 1;
    console.log(`[final-visual] captured ${screenshotCount}: ${slug}-${viewport.label}-${theme}`);
  };

  await mkdir(actualDir, { recursive: true });
  try {
    const loginContext = await browser.newContext({ viewport: desktop });
    contexts.push(loginContext);
    const loginPage = await loginContext.newPage();
    monitor(loginPage);
    for (const viewport of [...responsive, desktop]) {
      await loginPage.setViewportSize(viewport);
      for (const theme of themes) {
        await loginPage.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
        await setTheme(loginPage, theme);
        await expect(loginPage.getByRole('heading', { level: 1, name: 'Accedi a Doflow' })).toBeVisible();
        await accessibilitySmoke(loginPage);
        accessibilityChecks += 1;
        await capture(loginPage, 'login', viewport, theme);
      }
    }
    const ownerContext = await browser.newContext({ viewport: desktop });
    contexts.push(ownerContext);
    const owner = await loginWithMfa(ownerContext, credentials.email, credentials);
    monitor(owner);
    for (const theme of themes) {
      for (const route of canonicalRoutes) {
        try {
          await navigate(owner, route.path, theme);
        } catch (error) {
          console.error(JSON.stringify({
            route: route.path,
            consoleErrors,
            consoleWarnings,
            serverErrors,
          }, null, 2));
          throw error;
        }
        await accessibilitySmoke(owner);
        accessibilityChecks += 1;
        await capture(owner, route.slug, desktop, theme);
      }
    }

    for (const viewport of responsive) {
      await owner.setViewportSize(viewport);
      for (const theme of themes) {
        for (const route of canonicalRoutes.filter((entry) => critical.has(entry.slug))) {
          await navigate(owner, route.path, theme);
          await accessibilitySmoke(owner);
          accessibilityChecks += 1;
          await capture(owner, route.slug, viewport, theme);
        }
      }
    }

    await owner.setViewportSize(desktop);
    await navigate(owner, `/dashboard/progetti/${delivery.projectId}?tab=overview`, 'light');
    const projectTabs = owner.getByRole('tablist').first().getByRole('tab');
    await expect(projectTabs).toHaveText(['Panoramica', 'Attività', 'Fasi', 'Produzione e QA', 'Documenti', 'Pagamenti', 'Timeline']);
    const overview = owner.getByRole('tab', { name: 'Panoramica', exact: true });
    await overview.focus();
    await owner.keyboard.press('ArrowRight');
    await expect(owner.getByRole('tab', { name: 'Attività', exact: true })).toBeFocused();
    await owner.goBack({ waitUntil: 'domcontentloaded' });
    await expect(owner).toHaveURL(new RegExp(`/dashboard/ordini/${commerce.orderId}$`));

    await navigate(owner, '/dashboard/ordini', 'light');
    await owner.getByRole('button', { name: 'Nuovo ordine', exact: true }).click();
    const orderDialog = owner.getByRole('dialog');
    await expect(orderDialog).toBeVisible();
    await expect(orderDialog).toHaveAttribute('aria-labelledby');
    await expect(orderDialog.getByLabel('Data ordine')).toHaveAttribute('type', 'date');
    await capture(owner, 'order-dialog', desktop, 'light');
    await orderDialog.getByRole('combobox', { name: 'Cliente' }).click();
    const orderCustomerListbox = owner.getByRole('listbox');
    await expect(orderCustomerListbox).toBeVisible();
    await capture(owner, 'order-select', desktop, 'light');
    await orderCustomerListbox.getByRole('option').first().click();
    await expect(orderCustomerListbox).toBeHidden();
    await expect(orderDialog).toBeVisible();
    await owner.keyboard.press('Escape');
    await expect(orderDialog).toBeHidden();

    await navigate(owner, '/dashboard/contratti', 'light');
    await owner.getByRole('button', { name: 'Dettagli', exact: true }).first().click();
    const contractDialog = owner.getByRole('dialog');
    await expect(contractDialog).toBeVisible();
    await expect(contractDialog).toHaveAttribute('aria-labelledby');
    await capture(owner, 'contract-detail', desktop, 'light');
    await owner.keyboard.press('Escape');
    await expect(contractDialog).toBeHidden();

    await navigate(owner, '/dashboard/commercial/pipeline', 'light');
    const dragHandle = owner.getByRole('button', { name: 'Trascina per cambiare stato' }).first();
    await expect(dragHandle).toBeVisible();
    await dragHandle.focus();
    await expect(dragHandle).toBeFocused();
    await expect(owner.getByRole('button', { name: /^Azioni / }).first()).toBeVisible();

    await owner.setViewportSize({ width: 390, height: 900 });
    await navigate(owner, '/dashboard', 'light');
    const sidebarTrigger = owner.locator('[data-sidebar="trigger"]').first();
    await expect(sidebarTrigger).toBeVisible();
    await sidebarTrigger.click();
    await expect(owner.locator('[data-mobile="true"][data-sidebar="sidebar"]')).toBeVisible();
    await owner.keyboard.press('Escape');

    const deniedContext = await browser.newContext({ viewport: desktop });
    contexts.push(deniedContext);
    const denied = await deniedContext.newPage();
    await denied.goto('/login', { waitUntil: 'domcontentloaded', timeout: 60_000 });
    await denied.getByLabel('Email').fill('visual.viewer@acceptance.invalid');
    await denied.getByLabel('Password', { exact: true }).fill(credentials.password);
    await denied.getByRole('button', { name: 'Accedi', exact: true }).click();
    await expect(denied).toHaveURL(/\/dashboard$/, { timeout: 20_000 });
    monitor(denied);
    for (const theme of themes) {
      await navigate(denied, '/dashboard/pagamenti', theme);
      await expect(denied.getByText('Accesso non autorizzato')).toBeVisible();
      await accessibilitySmoke(denied);
      accessibilityChecks += 1;
      await capture(denied, 'access-denied', desktop, theme);
    }

    const platformContext = await browser.newContext({ viewport: desktop });
    contexts.push(platformContext);
    const platform = await loginWithMfa(platformContext, 'platform.superadmin@acceptance.invalid', credentials, true);
    monitor(platform);
    for (const viewport of [desktop, ...responsive]) {
      await platform.setViewportSize(viewport);
      for (const theme of themes) {
        await navigate(platform, '/superadmin', theme);
        await accessibilitySmoke(platform);
        accessibilityChecks += 1;
        await capture(platform, 'superadmin-dashboard', viewport, theme);
      }
    }

    expect(consoleErrors).toEqual([]);
    expect(consoleWarnings).toEqual([]);
    expect(serverErrors).toEqual([]);
    const result = {
      verdict: 'GLOBAL VISUAL GO',
      frontendUrl: 'http://localhost:3100',
      reference: 'doflow-gestionale-reference@e6c3ef5920773afc14b3caff88cfe4027400c54b',
      canonicalRoutes: canonicalRoutes.length + 2,
      desktopLightDarkRoutes: canonicalRoutes.length + 3,
      criticalResponsiveRoutes: critical.size + 2,
      screenshotCount,
      accessibilityChecks,
      interactions: {
        projectTabs: 7,
        keyboard: true,
        escape: true,
        dialogFocusContract: true,
        dragAlternative: true,
        mobileSidebar: true,
        browserBack: true,
        deepLink: true,
        selectAndDateInput: true,
      },
      documentDetailCoverage: {
        quote: 'canonical inline register row',
        contract: 'detail dialog',
        invoice: 'canonical inline register row',
      },
      consoleErrors: 0,
      consoleWarnings: 0,
      unexpected5xx: 0,
      privacy: 'synthetic-only; password and OTP inputs masked',
      outputDirectory: 'docs/design-references/doflow-crm-projects/actual/final-rc',
    };
    await writeFile(resultPath, JSON.stringify(result, null, 2));
  } finally {
    await Promise.allSettled(contexts.map(closeContextBounded));
  }
});

test('browser Back does not poison the next visual navigation boundary', async ({ browser }) => {
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  const commerce = JSON.parse(await readFile(path.join(root, '.visual-runtime', 'commerce-cash-acceptance-result.json'), 'utf8'));
  const delivery = JSON.parse(await readFile(path.join(root, '.visual-runtime', 'delivery-core-acceptance-result.json'), 'utf8'));
  const context = await browser.newContext({ viewport: desktop });
  try {
    const page = await loginWithMfa(context, 'visual.owner@acceptance.invalid', credentials);
    monitorApiRequests(page);
    await navigate(page, `/dashboard/ordini/${commerce.orderId}`, 'light');
    await navigate(page, `/dashboard/progetti/${delivery.projectId}?tab=overview`, 'light');
    await page.goBack({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(new RegExp(`/dashboard/ordini/${commerce.orderId}$`));
    await navigate(page, '/dashboard/ordini', 'light');
    await expect(page.getByRole('heading', { name: 'Ordini' })).toBeVisible();
  } finally {
    await closeContextBounded(context);
  }
});

test('order controls and contract detail satisfy the final visual interaction contract', async ({ browser }) => {
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  const context = await browser.newContext({ viewport: desktop });
  try {
    const page = await loginWithMfa(context, 'visual.owner@acceptance.invalid', credentials);
    await navigate(page, '/dashboard/ordini', 'light');
    await page.getByRole('button', { name: 'Nuovo ordine', exact: true }).click();
    const orderDialog = page.getByRole('dialog');
    await expect(orderDialog).toBeVisible();
    await expect(orderDialog.getByLabel('Data ordine')).toHaveAttribute('type', 'date');
    await orderDialog.getByRole('combobox', { name: 'Cliente' }).click();
    const orderCustomerListbox = page.getByRole('listbox');
    await expect(orderCustomerListbox).toBeVisible();
    await orderCustomerListbox.getByRole('option').first().click();
    await expect(orderCustomerListbox).toBeHidden();
    await expect(orderDialog).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(orderDialog).toBeHidden();

    await navigate(page, '/dashboard/contratti', 'light');
    await page.getByRole('button', { name: 'Dettagli', exact: true }).first().click();
    const contractDialog = page.getByRole('dialog');
    await expect(contractDialog).toBeVisible();
    await expect(contractDialog).toHaveAttribute('aria-labelledby');
    await page.keyboard.press('Escape');
    await expect(contractDialog).toBeHidden();
  } finally {
    await closeContextBounded(context);
  }
});

test('superadmin reload establishes a fresh authorized-read boundary', async ({ browser }) => {
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  const context = await browser.newContext({ viewport: desktop });
  try {
    const page = await loginWithMfa(context, 'platform.superadmin@acceptance.invalid', credentials, true);
    monitorApiRequests(page);
    await navigate(page, '/superadmin', 'light');
    await expect(page.getByText('Sincronizzazione Control Room…')).toBeHidden({ timeout: 60_000 });
  } finally {
    await closeContextBounded(context);
  }
});
