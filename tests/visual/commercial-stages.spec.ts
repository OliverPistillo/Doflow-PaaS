import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import path from 'node:path';
import {
  canonicalizeCommercialStageItem,
  commercialConversion,
  commercialStageLabel,
  COMMERCIAL_OUTCOME_STAGES,
  COMMERCIAL_POSITIVE_STAGES,
  COMMERCIAL_STAGE_ALIASES,
  DOFLOW_PIPELINE_GROUPS,
  isOpenCommercialStage,
  LEGACY_PIPELINE_GROUPS,
  normalizeCommercialStage,
  normalizeCommercialStageQuery,
} from '../../apps/frontend/src/lib/commercial-stage-model';

const frontendOrigin = process.env.DOFLOW_VISUAL_FRONTEND_URL || 'http://localhost:3100';
const actualDir = path.resolve('docs', 'design-references', 'doflow-crm-projects', 'actual');
const blockedRequests = new WeakMap<Page, Array<{ method: string; pathname: string }>>();
const expectedLabels = ['Nuovo', 'Contattato', 'Qualificato', 'Appuntamento', 'Preventivo', 'Chiuso'];

async function installReadOnlyFirewall(page: Page) {
  const blocked: Array<{ method: string; pathname: string }> = [];
  blockedRequests.set(page, blocked);
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const allowed = url.origin === frontendOrigin && ['GET', 'HEAD', 'OPTIONS'].includes(method);
    if (allowed) return route.continue();
    blocked.push({ method, pathname: url.pathname });
    return route.abort('blockedbyclient');
  });
}

async function assertDoflowSession(page: Page) {
  const identity = await page.evaluate(async () => {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
      headers: { 'x-doflow-web': '1' },
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const user = payload?.user || {};
    return {
      tenant: String(user.tenantSlug || user.tenantId || '').toLowerCase(),
      role: String(user.role || '').toLowerCase(),
      authStage: String(user.authStage || '').toUpperCase(),
    };
  });
  expect(identity?.tenant).toBe('doflow');
  expect(['owner', 'admin', 'manager', 'superadmin', 'super_admin']).toContain(identity?.role);
  expect(['FULL', '']).toContain(identity?.authStage);
}

async function opportunityTotal(page: Page) {
  return page.evaluate(async () => {
    const response = await fetch('/api/tenant/crm/opportunities?limit=100&offset=0', {
      method: 'GET',
      credentials: 'include',
      headers: {
        'x-doflow-web': '1',
        'x-doflow-tenant-id': 'doflow',
      },
    });
    if (!response.ok) throw new Error(`Censimento opportunità fallito (${response.status})`);
    const payload = await response.json();
    return Number(payload?.total || 0);
  });
}

async function assertCanonicalPipeline(page: Page) {
  await page.goto('/pipeline', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('.doflow-topbar')).toBeVisible();
  await assertDoflowSession(page);
  const pipeline = page.locator('[data-commercial-pipeline]');
  await expect(pipeline).toBeVisible();
  const columns = pipeline.locator('[data-commercial-stage]');
  await expect(columns).toHaveCount(6);
  await expect.poll(async () => columns.evaluateAll((elements) => elements.map((element) => element.getAttribute('data-commercial-stage'))))
    .toEqual(COMMERCIAL_POSITIVE_STAGES);
  await expect.poll(async () => columns.getByRole('heading', { level: 2 }).allTextContents()).toEqual(expectedLabels);
  await expect(page.getByText('Vinti', { exact: true })).toHaveCount(0);
  for (const legacyLabel of ['Brief inviato', 'Brief ricevuto', 'Follow-up', 'Call fissata', 'Preventivo inviato']) {
    await expect(columns.getByText(legacyLabel, { exact: true })).toHaveCount(0);
  }

  const total = await opportunityTotal(page);
  let visibleRecords = await page.locator('[data-commercial-deal]').count();
  visibleRecords += await page.locator('[data-commercial-unmapped] button[data-visual-sensitive]').count();
  const outcomesToggle = page.getByRole('button', { name: 'Mostra esiti', exact: true });
  if (await outcomesToggle.count()) {
    await outcomesToggle.click();
    visibleRecords += await page.locator('[data-commercial-outcome]').count();
    await page.getByRole('button', { name: 'Nascondi esiti', exact: true }).click();
  }
  expect(visibleRecords).toBe(total);

  const scrollState = await page.locator('[data-commercial-pipeline-scroll]').evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
  }));
  expect(scrollState.scrollWidth).toBeGreaterThan(scrollState.clientWidth);
}

async function privacySafeScreenshot(page: Page, filename: string) {
  const masks: Locator[] = [
    page.locator('[data-visual-sensitive]'),
    page.locator('[data-sidebar="footer"]:visible'),
    page.locator('header').getByRole('button', { name: 'Menu utente' }),
    page.locator('header').getByRole('link', { name: 'Notifiche' }),
  ];
  await page.screenshot({
    path: path.join(actualDir, filename),
    animations: 'disabled',
    mask: masks,
    maskColor: '#E2E8F0',
  });
}

test.beforeEach(async ({ page }) => {
  await installReadOnlyFirewall(page);
});

test.afterEach(async ({ page }) => {
  await page.waitForTimeout(100);
  expect(blockedRequests.get(page) || [], 'Il gate commerciale ha osservato una richiesta mutativa o cross-origin.').toEqual([]);
});

test('modello frontend: alias, ordine, esiti, KPI, query param e sconosciuti', () => {
  for (const [legacy, canonical] of Object.entries(COMMERCIAL_STAGE_ALIASES)) {
    expect(normalizeCommercialStage(legacy)).toEqual(expect.objectContaining({ mapped: true, stage: canonical }));
  }
  expect(COMMERCIAL_POSITIVE_STAGES).toEqual(['new', 'contacted', 'qualified', 'appointment', 'quote', 'closed_won']);
  expect(COMMERCIAL_OUTCOME_STAGES).toEqual(['lost', 'paused']);
  expect(DOFLOW_PIPELINE_GROUPS.map((group) => group.label)).toEqual(expectedLabels);
  expect(LEGACY_PIPELINE_GROUPS.map((group) => group.id)).toEqual(['new', 'contacted', 'quote', 'won']);
  expect(normalizeCommercialStageQuery('quote_sent', true)).toBe('quote');
  expect(normalizeCommercialStageQuery('won', true)).toBe('closed_won');
  expect(normalizeCommercialStageQuery('not_known', true)).toBe('all');
  expect(commercialStageLabel('closed_won', true)).toBe('Chiuso');
  expect(commercialStageLabel('accepted', true)).toBe('Chiuso');
  expect(canonicalizeCommercialStageItem({ id: '1', stage: 'not_known' })).toEqual({ id: '1', stage: 'not_known', commercial_stage_unmapped: true });
  expect(isOpenCommercialStage('quote_sent', true)).toBe(true);
  expect(isOpenCommercialStage('closed_won', true)).toBe(false);
  expect(commercialConversion([{ stage: 'accepted' }, { stage: 'lost' }, { stage: 'paused' }], true)).toBe(50);
});

test('pipeline desktop: sei fasi canoniche e screenshot mascherato', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await assertCanonicalPipeline(page);
  await privacySafeScreenshot(page, 'commercial-stages-desktop.png');
});

test('pipeline tablet: ordine, scroll e screenshot mascherato', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await assertCanonicalPipeline(page);
  await privacySafeScreenshot(page, 'commercial-stages-tablet.png');
});

test('pipeline mobile: leggibilità, scroll e screenshot mascherato', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await assertCanonicalPipeline(page);
  await privacySafeScreenshot(page, 'commercial-stages-mobile.png');
});
