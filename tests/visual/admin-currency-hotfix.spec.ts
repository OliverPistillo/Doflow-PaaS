import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import path from 'node:path';
import {
  financeMoney,
  normalizeCurrencyCode,
} from '../../apps/frontend/src/components/tenant-administration/administration-model';

const frontendOrigin = process.env.DOFLOW_VISUAL_FRONTEND_URL || 'http://localhost:3100';
const actualDir = path.resolve('docs', 'design-references', 'doflow-crm-projects', 'actual');
const blockedRequests = new WeakMap<Page, Array<{ method: string; pathname: string }>>();
const renderErrors = new WeakMap<Page, string[]>();

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const INVOICE_ID = '22222222-2222-4222-8222-222222222222';
const CONTRACT_ID = '33333333-3333-4333-8333-333333333333';
const SERVICE_ID = '44444444-4444-4444-8444-444444444444';
const RENEWAL_ID = '55555555-5555-4555-8555-555555555555';
const malformedCurrency = '1200€';

const company = { id: COMPANY_ID, name: 'Azienda Fixture' };
const invoice = {
  id: INVOICE_ID,
  invoice_number: 'INV-FIXTURE',
  title: 'Fattura fixture',
  status: 'issued',
  total: 1200,
  paid_total: 0,
  remaining_total: 1200,
  currency: malformedCurrency,
  issue_date: '2026-08-01',
  due_date: '2026-09-01',
  company_id: COMPANY_ID,
};
const contract = {
  id: CONTRACT_ID,
  contract_number: 'CTR-FIXTURE',
  title: 'Contratto fixture',
  status: 'active',
  signature_status: 'completed',
  priority: 'medium',
  contract_type: 'maintenance',
  amount: 1200,
  currency: malformedCurrency,
  company_id: COMPANY_ID,
  due_date: '2026-09-01',
};
const recurringService = {
  id: SERVICE_ID,
  name: 'Servizio fixture',
  category: 'maintenance',
  status: 'active',
  billing_cycle: 'yearly',
  amount: 1200,
  currency: malformedCurrency,
  company_id: COMPANY_ID,
  next_due_date: '2026-09-01',
  auto_renew: true,
};
const renewal = {
  id: RENEWAL_ID,
  recurring_service_id: SERVICE_ID,
  company_id: COMPANY_ID,
  title: 'Rinnovo fixture',
  status: 'upcoming',
  amount: 1200,
  currency: malformedCurrency,
  due_date: '2026-09-01',
};

const moduleAccess = Object.fromEntries(
  ['finance', 'contracts', 'crm', 'documents'].map((key) => [key, {
    can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true,
  }]),
);
const list = (items: unknown[]) => ({ items, total: items.length, limit: 100, offset: 0 });

async function installReadOnlyFixture(page: Page) {
  const blocked: Array<{ method: string; pathname: string }> = [];
  const errors: string[] = [];
  blockedRequests.set(page, blocked);
  renderErrors.set(page, errors);
  page.on('pageerror', (error) => {
    if (/RangeError|Invalid currency|Application error/i.test(error.message)) errors.push(error.message);
  });
  page.on('console', (message) => {
    if (message.type() === 'error' && /RangeError|Invalid currency|Application error/i.test(message.text())) errors.push(message.text());
  });
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    if (url.origin !== frontendOrigin || !['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      blocked.push({ method, pathname: url.pathname });
      return route.abort('blockedbyclient');
    }
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/tenant/team/me/module-permissions') {
      return json({ role: 'owner', audience: 'executive', modules: moduleAccess });
    }
    if (url.pathname === '/api/tenant/crm/companies') return json(list([company]));
    if (url.pathname === '/api/tenant/finance/summary') {
      return json({ total_invoiced: 1200, total_paid: 0, total_outstanding: 1200, invoices_overdue_count: 0, renewals_upcoming_30d: 1 });
    }
    if (url.pathname === '/api/tenant/finance/invoices') return json(list([invoice]));
    if (url.pathname === '/api/tenant/finance/deadlines') return json(list([]));
    if (url.pathname === '/api/tenant/finance/renewals') return json(list([renewal]));
    if (url.pathname === '/api/tenant/finance/recurring-services') return json(list([recurringService]));
    if (url.pathname === '/api/tenant/contracts/summary') {
      return json({ contracts: { totalContracts: 1, signedContracts: 1, waitingSignatureContracts: 0, expiringContracts: 1, overdueContracts: 0 } });
    }
    if (url.pathname === '/api/tenant/contracts') return json(list([contract]));
    return route.continue();
  });
}

async function assertPageHealthy(page: Page, route: string, heading: string, screenshotName: string) {
  await page.setViewportSize({ width: 1675, height: 939 });
  await page.goto(route, { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: heading, exact: true })).toBeVisible();
  await expect(page.getByText('Application error', { exact: false })).toHaveCount(0);
  expect(renderErrors.get(page) || []).toEqual([]);
  const masks: Locator[] = [
    page.locator('[data-record-sensitive]'),
    page.locator('[data-sidebar="footer"]:visible'),
    page.locator('header').getByRole('button', { name: 'Menu utente' }),
    page.locator('header').getByRole('link', { name: 'Notifiche' }),
  ];
  await page.screenshot({ path: path.join(actualDir, screenshotName), animations: 'disabled', mask: masks, maskColor: '#E2E8F0' });
}

test.beforeEach(async ({ page }) => installReadOnlyFixture(page));
test.afterEach(async ({ page }) => {
  await page.waitForTimeout(75);
  expect(blockedRequests.get(page) || [], 'Il gate currency ha osservato una richiesta mutativa o cross-origin.').toEqual([]);
  expect(renderErrors.get(page) || []).toEqual([]);
});

test('formatter currency: normalizza input validi e usa EUR per legacy malformati', () => {
  const eur = financeMoney(1200, 'EUR');
  expect(normalizeCurrencyCode('EUR')).toBe('EUR');
  expect(normalizeCurrencyCode('eur')).toBe('EUR');
  expect(normalizeCurrencyCode(' EUR ')).toBe('EUR');
  for (const currency of [malformedCurrency, '', null, undefined]) {
    expect(() => financeMoney(1200, currency)).not.toThrow();
    expect(financeMoney(1200, currency)).toBe(eur);
  }
  expect(() => financeMoney('1200', undefined)).not.toThrow();
  expect(financeMoney('1200', undefined)).toBe(eur);
});

test('/finance non cade con una currency legacy malformata', async ({ page }) => {
  await assertPageHealthy(page, '/finance', 'Amministrazione', 'admin-currency-overview.png');
});

test('/finance/invoices non cade con una currency legacy malformata', async ({ page }) => {
  await assertPageHealthy(page, '/finance/invoices', 'Fatture e incassi', 'admin-currency-invoices.png');
});

test('/contracts non cade con una currency legacy malformata', async ({ page }) => {
  await assertPageHealthy(page, '/contracts', 'Contratti', 'admin-currency-contracts.png');
});

test('/finance/renewals non cade con una currency legacy malformata', async ({ page }) => {
  await assertPageHealthy(page, '/finance/renewals', 'Rinnovi', 'admin-currency-renewals.png');
});
