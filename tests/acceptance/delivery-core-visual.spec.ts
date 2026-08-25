import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const credentialPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const resultPath = path.join(root, '.visual-runtime', 'delivery-core-acceptance-result.json');
const actualDir = path.join(root, 'docs', 'design-references', 'doflow-crm-projects', 'actual', 'delivery-core');

type Credentials = { password: string };
type AcceptanceResult = { projectId: string };
type Viewport = { width: number; height: number; label: string };
type Theme = 'light' | 'dark';
const canonicalProjectTabs = [
  { id: 'overview', label: 'Panoramica' },
  { id: 'activities', label: 'Attività' },
  { id: 'phases', label: 'Fasi' },
  { id: 'production', label: 'Produzione e QA' },
  { id: 'documents', label: 'Documenti' },
  { id: 'payments', label: 'Pagamenti' },
  { id: 'timeline', label: 'Timeline' },
] as const;

const viewports: Viewport[] = [
  { width: 390, height: 900, label: 'mobile' },
  { width: 768, height: 900, label: 'tablet' },
  { width: 1440, height: 900, label: 'desktop' },
];

async function login(context: BrowserContext, email: string, credentials: Credentials) {
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
  return page;
}

async function setTheme(page: Page, theme: Theme) {
  await page.evaluate((value) => localStorage.setItem('doflow_theme', value), theme);
}

async function navigate(page: Page, pathname: string) {
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await page.goto(pathname, { waitUntil: 'domcontentloaded' });
      if (response?.ok()) return;
      lastError = new Error(`Navigazione ${pathname}: HTTP ${response?.status() ?? 'nessuna risposta'}`);
    } catch (error) {
      lastError = error;
    }
    await page.waitForTimeout(500 * (attempt + 1));
  }
  throw lastError;
}

async function assertNoPageOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    page: document.documentElement.scrollWidth,
  }));
  expect(dimensions.page).toBeLessThanOrEqual(dimensions.viewport + 1);
}

async function capture(page: Page, name: string, viewport: Viewport, theme: Theme) {
  await page.waitForTimeout(350);
  await expect(page.locator('html')).toHaveClass(new RegExp(`(?:^|\\s)${theme}(?:\\s|$)`));
  await assertNoPageOverflow(page);
  await page.screenshot({
    path: path.join(actualDir, `${name}-${viewport.label}-${theme}.png`),
    animations: 'disabled',
    fullPage: false,
  });
}

function monitorPage(page: Page, allowedMutations: RegExp[] = []) {
  const consoleErrors: string[] = [];
  const failedDeliveryResponses: string[] = [];
  const unexpectedMutations: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && !message.text().startsWith('Failed to load resource:')) consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));
  page.on('response', (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith('/api/tenant/delivery/') && response.status() >= 400) {
      failedDeliveryResponses.push(`${response.status()} ${url.pathname}`);
    }
  });
  page.on('request', (request) => {
    const method = request.method();
    if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return;
    const pathname = new URL(request.url()).pathname;
    if (allowedMutations.some((pattern) => pattern.test(`${method} ${pathname}`))) return;
    unexpectedMutations.push(`${method} ${pathname}`);
  });
  return { consoleErrors, failedDeliveryResponses, unexpectedMutations };
}

async function assertCanonicalProjectTabs(page: Page) {
  const projectTabs = page.getByRole('tablist').first().getByRole('tab');
  await expect(projectTabs).toHaveCount(canonicalProjectTabs.length);
  await expect(projectTabs).toHaveText(canonicalProjectTabs.map((tab) => tab.label));
}

test('visual QA Delivery Core su viewport e temi richiesti', async ({ browser }) => {
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  const result = JSON.parse(await readFile(resultPath, 'utf8')) as AcceptanceResult;
  await mkdir(actualDir, { recursive: true });

  const managerContext = await browser.newContext();
  const viewerContext = await browser.newContext();
  const manager = await login(managerContext, 'visual.manager@acceptance.invalid', credentials);
  const viewer = await login(viewerContext, 'visual.viewer@acceptance.invalid', credentials);
  const managerMonitor = monitorPage(manager, [
    /^POST \/api\/tenant\/delivery\/timers\/start$/,
    /^POST \/api\/tenant\/delivery\/timers\/[^/]+\/stop$/,
  ]);
  const projectName = /^Progetto DELIVERY-/;

  try {
    for (const viewport of viewports) {
      await manager.setViewportSize(viewport);
      await viewer.setViewportSize(viewport);

      for (const theme of ['light', 'dark'] as const) {
        await setTheme(manager, theme);
        await navigate(manager, '/dashboard/progetti');
        await expect(manager.getByRole('heading', { name: 'Progetti e Produzione' })).toBeVisible();
        await expect(manager.getByRole('link', { name: 'Apri progetto' }).first()).toBeVisible();
        await capture(manager, 'projects', viewport, theme);

        await navigate(manager, `/dashboard/progetti/${result.projectId}`);
        await expect(manager.getByRole('heading', { name: projectName })).toBeVisible();
        await assertCanonicalProjectTabs(manager);
        if (viewport.label === 'mobile') {
          const tabScroll = await manager.getByTestId('project-tabs-scroll').evaluate((element) => ({
            clientWidth: element.clientWidth,
            scrollWidth: element.scrollWidth,
            overflowX: getComputedStyle(element).overflowX,
          }));
          expect(tabScroll.scrollWidth).toBeGreaterThan(tabScroll.clientWidth);
          expect(['auto', 'scroll']).toContain(tabScroll.overflowX);
        }
        await capture(manager, 'project-detail', viewport, theme);

        await navigate(manager, '/dashboard/attivita');
        await expect(manager.getByRole('heading', { name: 'Attività', exact: true })).toBeVisible();
        await capture(manager, 'activities', viewport, theme);

        await navigate(manager, '/dashboard/scadenze');
        await expect(manager.getByRole('heading', { name: 'Scadenze', exact: true })).toBeVisible();
        await capture(manager, 'deadlines', viewport, theme);

        await navigate(manager, '/dashboard/progetti');
        await manager.getByRole('tab', { name: 'Carico' }).click();
        await expect(manager.getByText('Carico del team')).toBeVisible();
        await capture(manager, 'workload', viewport, theme);

        await navigate(manager, `/dashboard/progetti/${result.projectId}?tab=production`);
        await expect(manager.getByText('Produzione e tempo')).toBeVisible();
        await expect(manager.getByText('Supervisione, QA e consegna')).toBeVisible();
        await expect(manager.getByText('Desktop verificato').first()).toBeVisible();
        await capture(manager, 'qa-workflow', viewport, theme);

        await setTheme(viewer, theme);
        await navigate(viewer, '/dashboard/progetti');
        await expect(viewer.getByText('Accesso non autorizzato')).toBeVisible();
        await capture(viewer, 'access-denied', viewport, theme);
      }
    }

    await manager.setViewportSize({ width: 1440, height: 900 });
    await setTheme(manager, 'light');
    await navigate(manager, `/dashboard/progetti/${result.projectId}?tab=overview`);
    await assertCanonicalProjectTabs(manager);
    const overviewTab = manager.getByRole('tab', { name: 'Panoramica', exact: true });
    await overviewTab.focus();
    await expect(overviewTab).toBeFocused();
    await manager.keyboard.press('ArrowRight');
    await expect(manager.getByRole('tab', { name: 'Attività', exact: true })).toBeFocused();
    await expect(manager).toHaveURL(new RegExp(`/dashboard/progetti/${result.projectId}\\?tab=activities$`));

    const tabChecks = [
      { id: 'overview', label: 'Panoramica', content: 'Informazioni' },
      { id: 'activities', label: 'Attività', content: 'Attività del progetto' },
      { id: 'phases', label: 'Fasi', content: 'Fasi del progetto' },
      { id: 'production', label: 'Produzione e QA', content: 'Supervisione, QA e consegna' },
      { id: 'documents', label: 'Documenti', content: 'Documenti del progetto' },
      { id: 'payments', label: 'Pagamenti', content: 'Pagamenti del progetto' },
    ] as const;
    for (const tab of tabChecks) {
      await manager.getByRole('tab', { name: tab.label, exact: true }).click();
      await expect(manager).toHaveURL(new RegExp(`/dashboard/progetti/${result.projectId}\\?tab=${tab.id}$`));
      await expect(manager.getByText(tab.content, { exact: true }).first()).toBeVisible();
      await assertNoPageOverflow(manager);
    }
    await expect(manager.getByText('Dati amministrativi non disponibili per il profilo corrente.')).toBeVisible();

    const historyResponse = manager.waitForResponse((response) => response.url().includes(`/api/tenant/delivery/projects/${result.projectId}/history`) && response.status() === 200);
    await manager.getByRole('tab', { name: 'Timeline', exact: true }).click();
    await historyResponse;
    await expect(manager).toHaveURL(new RegExp(`/dashboard/progetti/${result.projectId}\\?tab=timeline$`));
    await expect(manager.getByText('Timeline del progetto', { exact: true })).toBeVisible();
    await expect(manager.locator('[data-history-source="server"]')).toContainText('Commento persistente sintetico');
    await expect(manager.locator('[data-history-source="server"]')).toContainText('QA approvata');
    await expect(manager.getByText('Disponibile nella prossima fase.')).toHaveCount(0);
    await manager.reload({ waitUntil: 'domcontentloaded' });
    await expect(manager.getByRole('tab', { name: 'Timeline', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(manager.locator('[data-history-source="server"]')).toContainText('QA approvata');

    await navigate(manager, '/dashboard/progetti');
    await navigate(manager, `/dashboard/progetti/${result.projectId}?tab=overview`);
    await manager.getByRole('tab', { name: 'Produzione e QA', exact: true }).click();
    await expect(manager).toHaveURL(new RegExp(`\\?tab=production$`));
    await manager.goBack({ waitUntil: 'domcontentloaded' });
    await expect(manager).toHaveURL(/\/dashboard\/progetti$/);

    await navigate(manager, `/dashboard/progetti/${result.projectId}?tab=phases`);
    await manager.getByRole('button', { name: 'Apri fase' }).first().click();
    await expect(manager.getByRole('dialog')).toBeVisible();
    await expect(manager.getByRole('dialog')).toContainText('Fase del progetto');
    await manager.keyboard.press('Escape');
    await expect(manager.getByRole('dialog')).toBeHidden();

    await manager.getByRole('button', { name: 'Configura fasi' }).click();
    await expect(manager.getByRole('dialog')).toContainText('Configura fasi');
    await manager.keyboard.press('Escape');
    await expect(manager.getByRole('dialog')).toBeHidden();

    await navigate(manager, `/dashboard/progetti/${result.projectId}?tab=production`);
    const startTimer = manager.getByRole('button', { name: 'Avvia timer', exact: true });
    await expect(startTimer).toBeVisible();
    await startTimer.focus();
    await expect(startTimer).toBeFocused();
    await startTimer.click();
    await expect(manager.getByRole('button', { name: 'Ferma timer' })).toBeVisible();
    await manager.reload();
    await expect(manager.getByRole('button', { name: 'Ferma timer' })).toBeVisible();
    await manager.getByRole('button', { name: 'Ferma timer' }).click();
    await expect(manager.getByRole('button', { name: 'Avvia timer', exact: true })).toBeVisible();

    await navigate(manager, '/dashboard/progetti');
    await manager.getByRole('tab', { name: 'Kanban' }).click();
    const draggable = manager.getByRole('button', { name: /^Sposta Progetto DELIVERY-/ }).first();
    await expect(draggable).toBeVisible();
    await draggable.focus();
    await expect(draggable).toBeFocused();
    await manager.getByRole('tab', { name: 'Lista' }).click();
    await expect(manager.getByLabel(/^Stato Progetto DELIVERY-/).first()).toBeVisible();
    expect(managerMonitor.consoleErrors).toEqual([]);
    expect(managerMonitor.failedDeliveryResponses).toEqual([]);
    expect(managerMonitor.unexpectedMutations).toEqual([]);
  } finally {
    await managerContext.close();
    await viewerContext.close();
  }
});

test('visual QA del collegamento Builder-progetto', async ({ browser }) => {
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  const result = JSON.parse(await readFile(resultPath, 'utf8')) as AcceptanceResult;
  await mkdir(actualDir, { recursive: true });
  const context = await browser.newContext();
  const page = await login(context, 'visual.manager@acceptance.invalid', credentials);

  try {
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      for (const theme of ['light', 'dark'] as const) {
        await setTheme(page, theme);
        await navigate(page, '/commercial/site-proposals');
        await expect(page.getByRole('heading', { name: 'Proposte web' })).toBeVisible();
        const projectLink = page.getByRole('link', { name: /Apri progetto/ }).first();
        await expect(projectLink).toHaveAttribute('href', `/dashboard/progetti/${result.projectId}`);
        await capture(page, 'builder-project-link', viewport, theme);
      }
    }
  } finally {
    await context.close();
  }
});
