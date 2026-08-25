import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import path from 'node:path';
import {
  canonicalizeProjectItem,
  DOFLOW_PROJECT_STAGE_OPTIONS,
  isActiveProjectStage,
  isDeliveredProjectStage,
  isRiskProjectStage,
  LEGACY_PROJECT_STAGE_OPTIONS,
  normalizeProjectStage,
  normalizeProjectStageQuery,
  PROJECT_LATERAL_STAGES,
  PROJECT_POSITIVE_STAGES,
  PROJECT_STAGE_ALIASES,
  projectStageLabel,
} from '../../apps/frontend/src/lib/project-stage-model';

const frontendOrigin = process.env.DOFLOW_VISUAL_FRONTEND_URL || 'http://localhost:3100';
const actualDir = path.resolve('docs', 'design-references', 'doflow-crm-projects', 'actual');
const expectedLabels = ['Da avviare', 'Materiali', 'Design', 'Sviluppo', 'Revisione', 'Pubblicazione', 'Consegnato', 'In pausa'];
const legacyLabels = ['Kick-off', 'Raccolta materiali', 'Strategia', 'UX/UI', 'Copy/contenuti', 'Revisione interna', 'Revisione cliente', 'Correzioni', 'SEO/Performance', 'QA', 'Formazione', 'Manutenzione', 'Chiuso', 'Bloccato'];
const blockedRequests = new WeakMap<Page, Array<{ method: string; pathname: string }>>();
const fixtureProjects = [
  { id: 'fixture-review', name: 'Progetto revisione', status: 'client_review', current_phase: 'legacy note', type: 'custom', priority: 'medium', progress: 40 },
  { id: 'fixture-paused', name: 'Progetto in pausa', status: 'blocked', current_phase: null, type: 'custom', priority: 'medium', progress: 55 },
  { id: 'fixture-unknown', name: 'Progetto diagnostico', status: 'unexpected', current_phase: null, type: 'custom', priority: 'medium', progress: 10 },
];

async function installReadOnlyFixture(page: Page) {
  const blocked: Array<{ method: string; pathname: string }> = [];
  blockedRequests.set(page, blocked);
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    if (url.origin !== frontendOrigin || !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      blocked.push({ method, pathname: url.pathname });
      return route.abort('blockedbyclient');
    }
    if (url.pathname === '/api/tenant/projects') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: fixtureProjects, total: fixtureProjects.length, limit: 100, offset: 0 }) });
    }
    if (url.pathname.startsWith('/api/tenant/projects/')) {
      const segments = url.pathname.split('/').filter(Boolean);
      const id = segments[3];
      if (segments.length === 4) {
        const project = fixtureProjects.find((item) => item.id === id);
        return route.fulfill({ status: project ? 200 : 404, contentType: 'application/json', body: JSON.stringify(project || { message: 'not found' }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) });
    }
    if (url.pathname === '/api/tenant/team/members') {
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [], total: 0 }) });
    }
    return route.continue();
  });
}

async function assertDoflowSession(page: Page) {
  const tenant = await page.evaluate(async () => {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
      headers: { 'x-doflow-web': '1' },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const user = payload?.user || {};
    return String(user.tenantSlug || user.tenantId || user.tenant_id || '').toLowerCase();
  });
  expect(tenant).toBe('doflow');
}

async function assertCanonicalProjects(page: Page) {
  await page.goto('/projects?status=client_review', { waitUntil: 'domcontentloaded' });
  await assertDoflowSession(page);
  await expect(page.locator('.doflow-topbar')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Progetti', exact: true })).toBeVisible();
  const statusTrigger = page.getByRole('combobox').filter({ hasText: /Revisione|Tutti gli stati/ }).first();
  await expect(statusTrigger).toContainText('Revisione');
  await statusTrigger.click();
  for (const label of expectedLabels) await expect(page.getByRole('option', { name: label, exact: true })).toHaveCount(1);
  for (const label of legacyLabels) await expect(page.getByRole('option', { name: label, exact: true })).toHaveCount(0);
  await page.keyboard.press('Escape');

  await expect(page.locator('tbody tr')).toHaveCount(fixtureProjects.length);
  await expect(page.getByText('Revisione', { exact: true }).last()).toBeVisible();
  await expect(page.getByText('In pausa', { exact: true })).toBeVisible();
  await expect(page.getByText('Da verificare', { exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Fase', exact: true })).toBeVisible();
  await expect(page.getByRole('columnheader', { name: 'Stato', exact: true })).toHaveCount(0);
  await expect(page.getByText('1–3 di 3 progetti', { exact: true })).toBeVisible();
}

async function screenshot(page: Page, filename: string) {
  const masks: Locator[] = [
    page.locator('[data-sidebar="footer"]:visible'),
    page.locator('header').getByRole('button', { name: 'Menu utente' }),
    page.locator('header').getByRole('link', { name: 'Notifiche' }),
  ];
  await page.screenshot({ path: path.join(actualDir, filename), animations: 'disabled', mask: masks, maskColor: '#E2E8F0' });
}

test.beforeEach(async ({ page }) => {
  await installReadOnlyFixture(page);
});

test.afterEach(async ({ page }) => {
  await page.waitForTimeout(100);
  expect(blockedRequests.get(page) || [], 'Il gate progetti ha osservato una richiesta mutativa o cross-origin.').toEqual([]);
});

test('modello frontend: mapping, ordine, query, KPI, current_phase, tenant legacy e unknown', () => {
  for (const [raw, canonical] of Object.entries(PROJECT_STAGE_ALIASES)) {
    expect(normalizeProjectStage(raw)).toEqual(expect.objectContaining({ mapped: true, stage: canonical }));
  }
  expect(PROJECT_POSITIVE_STAGES).toEqual(['to_start', 'materials', 'design', 'development', 'review', 'publishing', 'delivered']);
  expect(PROJECT_LATERAL_STAGES).toEqual(['paused']);
  expect(DOFLOW_PROJECT_STAGE_OPTIONS.map((option) => option.label)).toEqual(expectedLabels);
  expect(LEGACY_PROJECT_STAGE_OPTIONS.some((option) => option.value === 'client_review')).toBe(true);
  expect(normalizeProjectStageQuery('client_review', true)).toBe('review');
  expect(normalizeProjectStageQuery('unexpected', true)).toBe('all');
  expect(projectStageLabel('closed', true)).toBe('Consegnato');
  expect(projectStageLabel('unexpected', true)).toBe('Da verificare');
  expect(canonicalizeProjectItem({ status: 'development', current_phase: 'closed' })).toEqual({ status: 'development', current_phase: 'closed' });
  expect(canonicalizeProjectItem({ status: 'unexpected' })).toEqual({ status: 'unexpected', project_status_unmapped: true });
  expect(isActiveProjectStage('publishing', true)).toBe(true);
  expect(isActiveProjectStage('paused', true)).toBe(false);
  expect(isDeliveredProjectStage('maintenance', true)).toBe(true);
  expect(isRiskProjectStage('blocked', true)).toBe(true);
  expect(projectStageLabel('client_review', false)).toBe('Revisione cliente');
});

test('projects desktop: otto fasi canoniche, record preservati e screenshot', async ({ page }) => {
  await page.setViewportSize({ width: 1675, height: 939 });
  await assertCanonicalProjects(page);
  await screenshot(page, 'project-stages-desktop.png');
});

test('projects tablet: filtri e record canonici restano disponibili', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await assertCanonicalProjects(page);
  await screenshot(page, 'project-stages-tablet.png');
});

test('projects mobile: filtri, paused e unknown restano disponibili', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await assertCanonicalProjects(page);
  await screenshot(page, 'project-stages-mobile.png');
});
