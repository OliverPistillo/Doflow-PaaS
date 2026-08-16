import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import path from 'node:path';

import {
  DOFLOW_TENANT_NAVIGATION,
  moduleKeyForTenantPath,
  navigationVisibilityMatchesTenant,
} from '../../apps/frontend/src/config/tenant-navigation';

const frontendOrigin = process.env.DOFLOW_VISUAL_FRONTEND_URL || 'http://localhost:3100';
const actualDir = path.resolve(
  'docs',
  'design-references',
  'doflow-crm-projects',
  'actual',
);

const hiddenNavigationLabels = ['Calendario', 'Milestone', 'Documenti'];
const authorizedRoles = ['owner', 'admin', 'superadmin', 'super_admin'];
const blockedRequests = new WeakMap<Page, Array<{ method: string; pathname: string; reason: string }>>();
const builderRoutes = [
  '/commercial/site-proposals',
  '/commercial/site-proposals/new',
  '/commercial/site-proposals/themes',
  '/commercial/site-proposals/archive',
  '/commercial/site-proposals/imports/00000000-0000-4000-8000-000000000000',
  '/commercial/site-proposals/00000000-0000-4000-8000-000000000000',
];

function apiRequestDecision(route: Route) {
  const request = route.request();
  const url = new URL(request.url());
  if (!url.pathname.startsWith('/api/')) return { allowed: true, method: request.method(), pathname: url.pathname };
  if (url.origin !== frontendOrigin) {
    return {
      allowed: false,
      method: request.method().toUpperCase(),
      pathname: url.pathname,
      reason: 'accesso API diretto vietato',
    };
  }
  const method = request.method().toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return { allowed: true, method, pathname: url.pathname };
  return { allowed: false, method, pathname: url.pathname, reason: 'mutazione vietata dal gate read-only' };
}

async function installReadOnlyFirewall(page: Page) {
  const entries: Array<{ method: string; pathname: string; reason: string }> = [];
  blockedRequests.set(page, entries);
  await page.route('**/api/**', async (route) => {
    const decision = apiRequestDecision(route);
    if (decision.allowed) {
      await route.continue();
      return;
    }
    const entry = {
      method: decision.method,
      pathname: decision.pathname,
      reason: decision.reason || 'richiesta non consentita',
    };
    entries.push(entry);
    console.error(`[visual:gate] BLOCKED ${entry.method} ${entry.pathname}: ${entry.reason}`);
    await route.abort('blockedbyclient');
  });
}

function visibleSidebar(page: Page) {
  return page.locator('[data-sidebar="sidebar"]:visible');
}

async function assertDoflowSession(page: Page) {
  const identity = await page.evaluate(() => {
    const token = window.localStorage.getItem('doflow_token');
    if (!token) return null;
    try {
      const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return {
        tenant: String(payload.tenantSlug || payload.tenantId || payload.tenant_id || '').toLowerCase(),
        role: String(payload.role || '').toLowerCase(),
        authStage: String(payload.authStage || '').toUpperCase(),
        mfaPending: payload.mfa_pending === true,
      };
    } catch {
      return null;
    }
  });
  expect(identity?.tenant).toBe('doflow');
  expect(authorizedRoles).toContain(identity?.role);
  expect(identity?.mfaPending).toBe(false);
  expect(['FULL', '']).toContain(identity?.authStage);
}

async function waitForShell(page: Page) {
  await expect(page.locator('.doflow-topbar')).toBeVisible();
  await expect(visibleSidebar(page)).toBeVisible();
  await assertDoflowSession(page);
}

async function openSection(page: Page, name: string) {
  const sidebar = visibleSidebar(page);
  const button = sidebar.getByRole('button', { name, exact: true });
  await expect(button).toBeVisible();
  if ((await button.getAttribute('aria-expanded')) !== 'true') await button.click();
  await expect(button).toHaveAttribute('aria-expanded', 'true');
}

async function expectSectionLinks(page: Page, sectionId: string, labels: string[]) {
  const section = visibleSidebar(page).locator(`#tenant-sidebar-section-${sectionId}`);
  const links = section.getByRole('link');
  await expect(links).toHaveCount(labels.length);
  await expect.poll(async () => links.allTextContents()).toEqual(labels);
}

async function expectActiveLink(page: Page, label: string) {
  const link = visibleSidebar(page)
    .locator('[data-sidebar="menu-sub-button"][aria-current="page"]')
    .filter({ hasText: label });
  await expect(link).toHaveCount(1);
  await expect(link).toHaveAttribute('aria-current', 'page');
  await expect(link).toHaveAttribute('data-active', 'true');
  await expect.poll(async () => link.evaluate((element) => getComputedStyle(element).backgroundColor))
    .not.toBe('rgba(0, 0, 0, 0)');
}

async function expectBuilderOrder(page: Page) {
  const sidebar = visibleSidebar(page);
  const controls = [
    sidebar.getByRole('button', { name: 'Commerciale', exact: true }),
    sidebar.getByRole('link', { name: 'Builder', exact: true }),
    sidebar.getByRole('button', { name: 'Progetti', exact: true }),
  ];
  for (const control of controls) await expect(control).toBeVisible();
  const topPositions = await Promise.all(controls.map((control) => (
    control.evaluate((element) => element.getBoundingClientRect().top)
  )));
  expect(topPositions[0]).toBeLessThan(topPositions[1]);
  expect(topPositions[1]).toBeLessThan(topPositions[2]);
}

async function expectBuilderActive(page: Page) {
  const sidebar = visibleSidebar(page);
  const builder = sidebar.getByRole('link', { name: 'Builder', exact: true });
  const commercial = sidebar.getByRole('button', { name: 'Commerciale', exact: true });
  await expect(builder).toHaveAttribute('aria-current', 'page');
  await expect(builder).toHaveAttribute('data-active', 'true');
  await expect(commercial).not.toHaveAttribute('data-active', 'true');
  await expect.poll(async () => builder.evaluate((element) => getComputedStyle(element).backgroundImage))
    .toContain('gradient');
}

async function expectHiddenNavigation(page: Page) {
  const sidebar = visibleSidebar(page);
  for (const label of hiddenNavigationLabels) {
    await expect(sidebar.getByRole('link', { name: label, exact: true })).toHaveCount(0);
  }
}

async function assertWhiteDoflowShell(page: Page) {
  await expect(page.locator('.doflow-topbar')).toHaveCSS('background-color', 'rgba(255, 255, 255, 0.98)');
  const sidebarBackground = await visibleSidebar(page).evaluate((element) => getComputedStyle(element).backgroundColor);
  expect(sidebarBackground).toMatch(/^rgba?\(255, 255, 255(?:, (?:0\.)?8)?\)$/);
  await expect(visibleSidebar(page).getByRole('link', { name: 'Vai alla dashboard doflow', exact: true })).toBeVisible();
}

async function privacySafeScreenshot(page: Page, filename: string) {
  await page.evaluate(() => {
    document.querySelector('[data-visual-shell-mask]')?.remove();
    const header = document.querySelector('header.doflow-topbar');
    const sidebar = document.querySelector('[data-sidebar="sidebar"]:not([hidden])');
    const headerRect = header?.getBoundingClientRect();
    const sidebarRect = sidebar?.getBoundingClientRect();
    const mobile = window.innerWidth < 768;
    const overlay = document.createElement('div');
    overlay.dataset.visualShellMask = 'true';
    Object.assign(overlay.style, {
      position: 'fixed',
      top: `${mobile ? 0 : Math.max(0, headerRect?.bottom || 0)}px`,
      left: `${Math.max(0, sidebarRect?.right || 0)}px`,
      right: '0',
      bottom: '0',
      zIndex: mobile ? '49' : '19',
      background: mobile ? '#20242A' : '#E2E8F0',
      pointerEvents: 'none',
    });
    document.body.appendChild(overlay);
  });
  const masks: Locator[] = [
    page.locator('[data-sidebar="footer"]:visible'),
    page.locator('header').getByRole('button', { name: 'Menu utente' }),
    page.locator('header').getByRole('link', { name: 'Notifiche' }),
  ];
  try {
    await page.screenshot({
      path: path.join(actualDir, filename),
      animations: 'disabled',
      mask: masks,
      maskColor: '#E2E8F0',
    });
  } finally {
    await page.locator('[data-visual-shell-mask]').evaluateAll((elements) => elements.forEach((element) => element.remove()));
  }
}

async function gotoAndExpect(page: Page, route: string) {
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await expect(page).toHaveURL(new RegExp(`${route.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await waitForShell(page);
}

test.beforeEach(async ({ page }) => {
  await installReadOnlyFirewall(page);
});

test.afterEach(async ({ page }) => {
  await page.waitForTimeout(250);
  const entries = blockedRequests.get(page) || [];
  expect(entries, 'Il gate ha bloccato richieste mutative o accessi API diretti.').toEqual([]);
});

test('modello Builder: Doflow-only, ordine, ruoli, capability e route esistenti', () => {
  const labels = DOFLOW_TENANT_NAVIGATION.map((section) => section.label);
  expect(labels.slice(0, 4)).toEqual(['Panoramica', 'Commerciale', 'Builder', 'Progetti']);

  const builder = DOFLOW_TENANT_NAVIGATION.find((section) => section.id === 'builder');
  expect(builder).toMatchObject({
    label: 'Builder',
    href: '/commercial/site-proposals',
    moduleKey: 'crm',
    visibility: 'doflow',
  });
  expect(builder?.roles).toEqual(expect.arrayContaining(['owner', 'admin', 'superadmin', 'manager']));
  expect(navigationVisibilityMatchesTenant(builder?.visibility, true)).toBe(true);
  expect(navigationVisibilityMatchesTenant(builder?.visibility, false)).toBe(false);

  const commerciale = DOFLOW_TENANT_NAVIGATION.find((section) => section.id === 'commerciale');
  expect(commerciale?.activeHrefs || []).not.toContain('/commercial/site-proposals');
  expect(commerciale?.inactiveHrefs).toContain('/commercial/site-proposals');
  for (const route of builderRoutes) expect(moduleKeyForTenantPath(route)).toBe('crm');
});

test('desktop commerciale: ordine, active state e screenshot privacy-safe', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await gotoAndExpect(page, '/companies');
  await assertWhiteDoflowShell(page);
  await openSection(page, 'Commerciale');
  await expectSectionLinks(page, 'commerciale', ['Riepilogo', 'Pipeline', 'Clienti', 'Preventivi']);
  await expectActiveLink(page, 'Clienti');
  await expectHiddenNavigation(page);
  await privacySafeScreenshot(page, 'navigation-commercial-desktop.png');
});

test('desktop Builder: top-level, tutte le sottoroute attive e screenshot privacy-safe', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 1675, height: 939 });

  for (const route of builderRoutes) {
    await gotoAndExpect(page, route);
    await expectBuilderOrder(page);
    await expectBuilderActive(page);
  }

  await gotoAndExpect(page, '/commercial/site-proposals');
  await assertWhiteDoflowShell(page);
  await expectBuilderOrder(page);
  await expectBuilderActive(page);
  await privacySafeScreenshot(page, 'builder-sidebar-desktop.png');
});

test('desktop progetti: tutte le route e active state', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1675, height: 939 });
  const routes = [
    ['/projects', 'Panoramica'],
    ['/projects/timeline', 'Flusso'],
    ['/projects/tasks', 'Attività'],
    ['/projects/files', 'File'],
  ] as const;

  for (const [route, activeLabel] of routes) {
    await gotoAndExpect(page, route);
    await openSection(page, 'Progetti');
    await expectSectionLinks(page, 'projects', ['Panoramica', 'Flusso', 'Attività', 'File']);
    await expectActiveLink(page, activeLabel);
    await expectHiddenNavigation(page);
  }

  await gotoAndExpect(page, '/projects');
  await openSection(page, 'Progetti');
  await assertWhiteDoflowShell(page);
  await privacySafeScreenshot(page, 'navigation-projects-desktop.png');
});

test('desktop impostazioni: ordine, route e nessuna navigazione duplicata', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1675, height: 939 });
  const routes = [
    ['/settings', 'Generali'],
    ['/settings/users', 'Utenti e permessi'],
    ['/settings/integrations', 'Integrazioni'],
    ['/settings/security', 'Sicurezza e accessi'],
  ] as const;

  for (const [route, activeLabel] of routes) {
    await gotoAndExpect(page, route);
    await openSection(page, 'Impostazioni');
    await expectSectionLinks(page, 'impostazioni', ['Generali', 'Utenti e permessi', 'Integrazioni', 'Sicurezza e accessi']);
    await expectActiveLink(page, activeLabel);
    await expect(page.locator('main nav').filter({ hasText: 'Utenti e permessi' })).toHaveCount(0);
  }

  await gotoAndExpect(page, '/settings');
  await openSection(page, 'Impostazioni');
  await privacySafeScreenshot(page, 'navigation-settings-desktop.png');
});

test('desktop route legacy: nascoste, read-only e senza figlia errata', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1675, height: 939 });
  const legacyRoutes = [
    ['/projects/milestones', 'Progetti'],
    ['/work', 'Progetti'],
    ['/calendar', 'Progetti'],
    ['/documents', null],
  ] as const;

  for (const [route, expectedSection] of legacyRoutes) {
    await gotoAndExpect(page, route);
    await expectHiddenNavigation(page);
    await expect(visibleSidebar(page).locator('[data-sidebar="menu-sub-button"][aria-current="page"]')).toHaveCount(0);
    if (expectedSection) {
      const section = visibleSidebar(page).getByRole('button', { name: expectedSection, exact: true });
      await expect(section).toHaveAttribute('data-active', 'true');
    }
  }
});

test('tablet: apertura, chiusura, scroll, progetti e impostazioni raggiungibili', async ({ page }) => {
  test.setTimeout(240_000);
  await page.setViewportSize({ width: 1024, height: 768 });
  await gotoAndExpect(page, '/projects/timeline');
  await openSection(page, 'Progetti');
  await expectActiveLink(page, 'Flusso');

  const desktopSidebarRoot = page.locator('.group.peer[data-state]');
  await page.locator('[data-sidebar="trigger"]').click();
  await expect(desktopSidebarRoot).toHaveAttribute('data-state', 'collapsed');
  await page.locator('[data-sidebar="trigger"]').click();
  await expect(desktopSidebarRoot).toHaveAttribute('data-state', 'expanded');

  for (const route of ['/settings', '/settings/users', '/settings/integrations', '/settings/security']) {
    await gotoAndExpect(page, route);
    await openSection(page, 'Impostazioni');
  }
  await gotoAndExpect(page, '/projects/timeline');
  await openSection(page, 'Progetti');
  await visibleSidebar(page).locator('[data-sidebar="content"]').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await privacySafeScreenshot(page, 'navigation-tablet.png');
});

test('tablet Builder: ordine, active state e screenshot privacy-safe', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await gotoAndExpect(page, '/commercial/site-proposals');
  await assertWhiteDoflowShell(page);
  await expectBuilderOrder(page);
  await expectBuilderActive(page);
  await privacySafeScreenshot(page, 'builder-sidebar-tablet.png');
});

test('mobile: drawer, chiusura, scroll e impostazioni raggiungibili', async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 390, height: 844 });

  for (const route of ['/settings', '/settings/users', '/settings/integrations', '/settings/security']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.doflow-topbar')).toBeVisible();
    await assertDoflowSession(page);
    await page.locator('[data-sidebar="trigger"]').click();
    await expect(visibleSidebar(page)).toBeVisible();
    await openSection(page, 'Impostazioni');
    await expectSectionLinks(page, 'impostazioni', ['Generali', 'Utenti e permessi', 'Integrazioni', 'Sicurezza e accessi']);
    await page.keyboard.press('Escape');
    await expect(visibleSidebar(page)).toHaveCount(0);
  }

  await page.goto('/settings/security', { waitUntil: 'domcontentloaded' });
  await page.locator('[data-sidebar="trigger"]').click();
  await openSection(page, 'Impostazioni');
  await expect(visibleSidebar(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await visibleSidebar(page).locator('[data-sidebar="content"]').evaluate((element) => {
    element.scrollTop = element.scrollHeight;
  });
  await expectActiveLink(page, 'Sicurezza e accessi');
  await expectHiddenNavigation(page);
  await privacySafeScreenshot(page, 'navigation-mobile.png');
});

test('mobile Builder: voce raggiungibile, tappabile, attiva e screenshot privacy-safe', async ({ page }) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.doflow-topbar')).toBeVisible();
  await assertDoflowSession(page);
  await page.locator('[data-sidebar="trigger"]').click();
  await expect(visibleSidebar(page)).toBeVisible();
  await expectBuilderOrder(page);

  const builder = visibleSidebar(page).getByRole('link', { name: 'Builder', exact: true });
  await expect(builder).toBeVisible();
  await builder.click();
  await expect(page).toHaveURL(/\/commercial\/site-proposals$/);
  await expect(page.locator('.doflow-topbar')).toBeVisible();

  await page.locator('[data-sidebar="trigger"]').click();
  await expect(visibleSidebar(page)).toBeVisible();
  await expect(visibleSidebar(page)).toHaveCSS('background-color', 'rgb(255, 255, 255)');
  await expectBuilderOrder(page);
  await expectBuilderActive(page);
  await privacySafeScreenshot(page, 'builder-sidebar-mobile.png');
});
