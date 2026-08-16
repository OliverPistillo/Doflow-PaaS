import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { isInternalDoflowTenant } from '../../apps/frontend/src/lib/tenant-url';
import { isUnifiedRecordPanelId } from '../../apps/frontend/src/components/doflow-record-panel/unified-record-panel';

const frontendOrigin = process.env.DOFLOW_VISUAL_FRONTEND_URL || 'http://localhost:3100';
const actualDir = path.resolve('docs', 'design-references', 'doflow-crm-projects', 'actual');
const blockedRequests = new WeakMap<Page, Array<{ method: string; pathname: string }>>();

const COMPANY_ID = '11111111-1111-4111-8111-111111111111';
const CONTACT_ID = '22222222-2222-4222-8222-222222222222';
const OPPORTUNITY_ID = '33333333-3333-4333-8333-333333333333';
const PROJECT_ID = '44444444-4444-4444-8444-444444444444';
const TASK_ID = '55555555-5555-4555-8555-555555555555';
const DOCUMENT_ID = '66666666-6666-4666-8666-666666666666';
const MEMBER_ID = '77777777-7777-4777-8777-777777777777';
const QUOTE_ID = '88888888-8888-4888-8888-888888888888';
const CONTRACT_ID = '99999999-9999-4999-8999-999999999999';

const company = {
  id: COMPANY_ID,
  name: 'Azienda Visuale',
  status: 'active_client',
  source: 'Referral',
  email: 'cliente@example.test',
  phone: '+39 320 000 0000',
  industry: 'Servizi digitali',
  owner_user_id: MEMBER_ID,
  updated_at: '2026-08-16T10:00:00.000Z',
};

const contact = {
  id: CONTACT_ID,
  company_id: COMPANY_ID,
  first_name: 'Referente',
  last_name: 'Cliente',
  email: 'referente@example.test',
  phone: '+39 320 111 1111',
  is_primary: true,
};

const opportunity = {
  id: OPPORTUNITY_ID,
  company_id: COMPANY_ID,
  company_name: company.name,
  contact_id: CONTACT_ID,
  contact_name: `${contact.first_name} ${contact.last_name}`,
  contact_email: contact.email,
  contact_phone: contact.phone,
  title: 'Nuovo sito istituzionale',
  service_type: 'Sito web',
  lead_source: 'referral',
  value_estimate: 2500,
  probability: 70,
  stage: 'qualified',
  assigned_to: MEMBER_ID,
  next_action: 'Confermare il perimetro del progetto',
  next_action_at: '2026-08-18T09:00:00.000Z',
  updated_at: '2026-08-16T10:00:00.000Z',
};

const activity = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  company_id: COMPANY_ID,
  opportunity_id: OPPORTUNITY_ID,
  type: 'call',
  title: 'Call di allineamento',
  description: 'Raccolte le priorità operative del cliente.',
  completed_at: '2026-08-16T09:30:00.000Z',
  updated_at: '2026-08-16T09:30:00.000Z',
};

const project = {
  id: PROJECT_ID,
  name: 'Progetto Website',
  company_id: COMPANY_ID,
  company_name: company.name,
  contact_id: CONTACT_ID,
  contact_name: `${contact.first_name} ${contact.last_name}`,
  type: 'website',
  status: 'development',
  priority: 'high',
  progress: 68,
  project_manager_id: MEMBER_ID,
  project_manager_email: 'responsabile@example.test',
  due_date: '2026-08-28T00:00:00.000Z',
  updated_at: '2026-08-16T11:00:00.000Z',
};

const task = {
  id: TASK_ID,
  project_id: PROJECT_ID,
  title: 'Completare responsive mobile',
  status: 'in_progress',
  priority: 'high',
  assignee_email: 'responsabile@example.test',
  due_at: '2026-08-20T00:00:00.000Z',
};

const document = {
  id: DOCUMENT_ID,
  title: 'Materiali progetto',
  original_filename: 'materiali.pdf',
  category: 'project_asset',
  visibility: 'internal',
  status: 'active',
  created_at: '2026-08-15T10:00:00.000Z',
};

const moduleAccess = Object.fromEntries([
  'dashboard', 'crm', 'briefing', 'quotes', 'projects', 'calendar', 'documents', 'notifications', 'team',
  'knowledge', 'contracts', 'paperwork', 'finance', 'reports', 'automations', 'credentials', 'settings',
].map((key) => [key, { can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true }]));

function list(items: unknown[]) {
  return { items, total: items.length, limit: 100, offset: 0 };
}

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

    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/tenant/team/me/module-permissions') return json({ role: 'owner', audience: 'executive', modules: moduleAccess });
    if (url.pathname === '/api/tenant/team/members') return json(list([{ id: MEMBER_ID, user_id: MEMBER_ID, email: 'responsabile@example.test', display_name: 'Responsabile progetto' }]));
    if (url.pathname === '/api/tenant/crm/pipeline') {
      return json({ model: 'doflow-canonical-v1', stages: ['new', 'contacted', 'qualified', 'appointment', 'quote', 'closed_won'].map((stage) => ({ stage, label: stage, count: stage === 'qualified' ? 1 : 0, totalValue: stage === 'qualified' ? 2500 : 0, items: stage === 'qualified' ? [opportunity] : [] })) });
    }
    if (url.pathname === `/api/tenant/crm/opportunities/${OPPORTUNITY_ID}`) return json(opportunity);
    if (url.pathname === '/api/tenant/crm/opportunities') return json(list([opportunity]));
    if (url.pathname === `/api/tenant/crm/companies/${COMPANY_ID}`) return json(company);
    if (url.pathname === '/api/tenant/crm/companies') return json(list([company]));
    if (url.pathname === `/api/tenant/crm/contacts/${CONTACT_ID}`) return json(contact);
    if (url.pathname === '/api/tenant/crm/contacts') return json(list([contact]));
    if (url.pathname === '/api/tenant/crm/activities') return json(list([activity]));
    if (url.pathname === '/api/tenant/quotes') return json(list([{ id: QUOTE_ID, quote_number: 'PREV-001', title: 'Preventivo Website', status: 'accepted', company_id: COMPANY_ID, opportunity_id: OPPORTUNITY_ID }]));
    if (url.pathname === '/api/tenant/contracts') return json(list([{ id: CONTRACT_ID, contract_number: 'CON-001', title: 'Contratto Website', status: 'active', signature_status: 'signed', priority: 'medium', contract_type: 'project', company_id: COMPANY_ID, opportunity_id: OPPORTUNITY_ID }]));
    if (url.pathname === '/api/tenant/finance/invoices') return json(list([{ id: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', invoice_number: 'INV-001', title: 'Fattura acconto', status: 'issued' }]));
    if (url.pathname.startsWith('/api/tenant/documents/entity/')) return json(list([document]));
    if (url.pathname === '/api/tenant/projects') return json(list([project]));
    if (url.pathname === `/api/tenant/projects/${PROJECT_ID}`) return json(project);
    if (url.pathname === `/api/tenant/projects/${PROJECT_ID}/tasks`) return json(list([task]));
    if (url.pathname.startsWith(`/api/tenant/projects/${PROJECT_ID}/`)) return json(list([]));
    return route.continue();
  });
}

async function screenshot(page: Page, filename: string) {
  const masks: Locator[] = [
    page.locator('[data-record-sensitive]'),
    page.locator('[data-visual-sensitive]'),
    page.locator('[data-sidebar="footer"]:visible'),
    page.locator('header').getByRole('button', { name: 'Menu utente' }),
    page.locator('header').getByRole('link', { name: 'Notifiche' }),
  ];
  await page.screenshot({ path: path.join(actualDir, filename), animations: 'disabled', mask: masks, maskColor: '#E2E8F0' });
}

async function expectPanel(page: Page, title: string) {
  const panel = page.locator('[data-unified-record-panel]');
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('heading', { name: title })).toBeVisible();
  return panel;
}

test.beforeEach(async ({ page }) => {
  await installReadOnlyFixture(page);
});

test.afterEach(async ({ page }) => {
  await page.waitForTimeout(100);
  expect(blockedRequests.get(page) || [], 'Il pannello operativo ha osservato una richiesta mutativa o cross-origin.').toEqual([]);
});

test('opportunità desktop: shell condivisa, azioni e riepilogo reale', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto(`/pipeline?opportunity=${OPPORTUNITY_ID}`, { waitUntil: 'domcontentloaded' });
  const panel = await expectPanel(page, opportunity.title);
  expect(await panel.evaluate((element) => element.contains(document.activeElement))).toBe(true);
  await expect(panel.getByRole('tab', { name: 'Riepilogo' })).toHaveAttribute('aria-selected', 'true');
  for (const action of ['Chiama', 'WhatsApp', 'Email', 'Nuova attività', 'Altro']) await expect(panel.getByRole('button', { name: action }).or(panel.getByRole('link', { name: action }))).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/pipeline');
  await screenshot(page, 'unified-opportunity-overview-desktop.png');
});

test('cliente desktop: riga apre il pannello senza restringere la tabella', async ({ page }) => {
  await page.setViewportSize({ width: 1672, height: 941 });
  await page.goto('/companies?status=active_client', { waitUntil: 'domcontentloaded' });
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.locator('tbody tr').first().click();
  const panel = await expectPanel(page, company.name);
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await expect(panel.getByText('Dettagli cliente')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/companies');
  expect(new URL(page.url()).searchParams.get('status')).toBe('active_client');
  await screenshot(page, 'unified-client-overview-desktop.png');
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-unified-record-panel]')).toHaveCount(0);
  await page.getByRole('button', { name: `Azioni ${company.name}` }).click();
  await page.getByRole('menuitem', { name: 'Modifica' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog.getByText('Dati fiscali e indirizzo')).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Annulla' })).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Salva cliente' })).toBeVisible();
  await dialog.getByRole('button', { name: 'Annulla' }).click();
});

test('progetto desktop: pannello operativo e route completa preservata', async ({ page }) => {
  await page.setViewportSize({ width: 1675, height: 939 });
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: `Apri ${project.name}` }).click();
  const panel = await expectPanel(page, project.name);
  await expect(panel.getByRole('tab', { name: 'Panoramica' })).toHaveAttribute('aria-selected', 'true');
  expect(new URL(page.url()).pathname).toBe('/projects');
  expect(fs.existsSync(path.resolve('apps/frontend/src/app/(tenant)/projects/[id]/page.tsx'))).toBe(true);
  await screenshot(page, 'unified-project-overview-desktop.png');
});

test('deep link, tab URL e Back preservano filtri, ricerca e scroll', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto('/pipeline?campaign=visual', { waitUntil: 'domcontentloaded' });
  const search = page.getByPlaceholder('Cerca...');
  await search.fill('Sito');
  const scroll = page.locator('[data-commercial-pipeline-scroll]');
  await scroll.evaluate((element) => { element.scrollLeft = 180; });
  const before = await scroll.evaluate((element) => element.scrollLeft);
  await page.getByRole('button', { name: 'Dettagli' }).click();
  await expectPanel(page, opportunity.title);
  expect(new URL(page.url()).searchParams.get('campaign')).toBe('visual');
  await page.getByRole('tab', { name: 'File' }).click();
  await expect.poll(() => new URL(page.url()).searchParams.get('panelTab')).toBe('files');
  await page.reload({ waitUntil: 'domcontentloaded' });
  const panel = await expectPanel(page, opportunity.title);
  await expect(panel.getByRole('tab', { name: 'File' })).toHaveAttribute('aria-selected', 'true');

  await page.goto('/pipeline?campaign=visual', { waitUntil: 'domcontentloaded' });
  await search.fill('Sito');
  await scroll.evaluate((element) => { element.scrollLeft = 180; });
  await page.getByRole('button', { name: 'Dettagli' }).click();
  await page.goBack({ waitUntil: 'domcontentloaded' });
  await expect(page.locator('[data-unified-record-panel]')).toHaveCount(0);
  await expect(search).toHaveValue('Sito');
  expect(await scroll.evaluate((element) => element.scrollLeft)).toBe(before);
  expect(new URL(page.url()).pathname).toBe('/pipeline');
  const details = page.getByRole('button', { name: 'Dettagli' });
  await details.click();
  await expectPanel(page, opportunity.title);
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-unified-record-panel]')).toHaveCount(0);
  await expect(details).toBeFocused();
});

test('tablet: pannello adattivo, tab e contenuto restano raggiungibili', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto(`/companies?company=${COMPANY_ID}&panelTab=activity`, { waitUntil: 'domcontentloaded' });
  const panel = await expectPanel(page, company.name);
  await expect(panel.getByRole('tab', { name: 'Attività e comunicazioni' })).toHaveAttribute('aria-selected', 'true');
  const box = await panel.boundingBox();
  expect(box?.width).toBeLessThan(1024);
  await screenshot(page, 'unified-record-panel-tablet.png');
});

test('mobile: pannello full-screen con tutte le funzioni essenziali', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`/projects?project=${PROJECT_ID}&panelTab=flow`, { waitUntil: 'domcontentloaded' });
  const panel = await expectPanel(page, project.name);
  await expect(panel.getByRole('tab', { name: 'Flusso' })).toHaveAttribute('aria-selected', 'true');
  await expect(panel.getByText('Fase corrente')).toBeVisible();
  const box = await panel.boundingBox();
  expect(Math.round(box?.width || 0)).toBe(390);
  await screenshot(page, 'unified-record-panel-mobile.png');
});

test('contratto statico: pannello solo Doflow e route progetto legacy intatta', () => {
  expect(isInternalDoflowTenant('doflow')).toBe(true);
  expect(isInternalDoflowTenant('tenant-legacy')).toBe(false);
  expect(isUnifiedRecordPanelId(PROJECT_ID)).toBe(true);
  expect(isUnifiedRecordPanelId('not-an-id')).toBe(false);
  const source = fs.readFileSync(path.resolve('apps/frontend/src/components/tenant-work/projects-workspace.tsx'), 'utf8');
  expect(source).toContain('doflow ? recordPanel.openRecord');
  expect(fs.readFileSync(path.resolve('apps/frontend/src/components/tenant-projects/projects-core.tsx'), 'utf8')).toContain('router.push(`/projects/${row.id}`)');
});
