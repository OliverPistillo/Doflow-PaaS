import { expect, test, type Locator, type Page, type Route } from '@playwright/test';
import path from 'node:path';

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

const company = { id: COMPANY_ID, name: 'Azienda Visuale', status: 'active_client', email: 'cliente@example.test', phone: '+39 320 000 0000', industry: 'Servizi digitali', owner_user_id: MEMBER_ID, updated_at: '2026-08-16T10:00:00.000Z' };
const contact = { id: CONTACT_ID, company_id: COMPANY_ID, first_name: 'Referente', last_name: 'Cliente', email: 'referente@example.test', phone: '+39 320 111 1111', is_primary: true };
const opportunity = { id: OPPORTUNITY_ID, company_id: COMPANY_ID, company_name: company.name, contact_id: CONTACT_ID, contact_name: 'Referente Cliente', contact_email: contact.email, contact_phone: contact.phone, title: 'Nuovo sito istituzionale', service_type: 'Sito web', value_estimate: 2500, stage: 'qualified', assigned_to: MEMBER_ID, updated_at: '2026-08-16T10:00:00.000Z' };
const project = { id: PROJECT_ID, name: 'Progetto Website', company_id: COMPANY_ID, company_name: company.name, contact_id: CONTACT_ID, type: 'website', status: 'development', priority: 'high', progress: 68, project_manager_id: MEMBER_ID, project_manager_email: 'responsabile@example.test', due_date: '2026-08-28T00:00:00.000Z', updated_at: '2026-08-16T11:00:00.000Z' };
const tasks = [
  { id: TASK_ID, project_id: PROJECT_ID, project_name: project.name, project_status: project.status, company_name: company.name, title: 'Completare responsive mobile', status: 'in_progress', priority: 'high', assignee_id: MEMBER_ID, assignee_label: 'Responsabile progetto', due_at: '2026-08-20T00:00:00.000Z' },
  { id: '55555555-5555-4555-8555-555555555556', project_id: PROJECT_ID, project_name: project.name, project_status: project.status, company_name: company.name, title: 'Verifica contenuti finali', status: 'ready', priority: 'medium', assignee_id: MEMBER_ID, assignee_label: 'Responsabile progetto', due_at: '2026-08-24T00:00:00.000Z' },
];
const documents = [{ id: DOCUMENT_ID, entity_id: PROJECT_ID, entity_type: 'project', project_name: project.name, project_status: project.status, company_name: company.name, title: 'Materiali progetto', original_filename: 'materiali.pdf', category: 'project_asset', visibility: 'internal', status: 'active', version_number: 2, size_bytes: 840000, uploaded_by: MEMBER_ID, uploaded_by_label: 'Responsabile progetto', created_at: '2026-08-15T10:00:00.000Z' }];
const globalTimeline = [
  { id: 'activity:aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1', project_id: PROJECT_ID, project_name: project.name, company_name: company.name, project_status: 'development', type: 'call', author_user_id: MEMBER_ID, author_label: 'Responsabile progetto', created_at: '2026-08-17T10:24:00.000Z', title: 'Chiamata di avanzamento', status: 'completed', source: 'commercial_activity' },
  { id: 'audit:42', project_id: PROJECT_ID, project_name: project.name, company_name: company.name, project_status: 'development', type: 'status_change', author_user_id: MEMBER_ID, author_label: 'Responsabile progetto', created_at: '2026-08-16T15:55:00.000Z', title: 'Fase progetto aggiornata', status: 'project_status_changed', source: 'audit_log' },
  { id: 'document:43', project_id: PROJECT_ID, project_name: project.name, company_name: company.name, project_status: 'development', type: 'file', author_user_id: MEMBER_ID, author_label: 'Responsabile progetto', created_at: '2026-08-15T10:00:00.000Z', title: 'Materiali progetto', status: 'uploaded', source: 'document_activity' },
];
const performanceItem = { user_id: MEMBER_ID, display_name: 'Responsabile progetto', operational_role: 'project_manager', opportunities_assigned: 6, activities_completed: 8, follow_ups_overdue: 2, appointments: 3, calls: 4, won: 3, lost: 1, won_value: 12000, conversion_rate: 75, projects_managed: 4, tasks_assigned: 10, tasks_completed: 7, tasks_overdue: 2, task_completion_rate: 70, projects_delivered: 2, projects_late: 1, timeline_created: 18, timeline_completed: 15, average_activity_close_hours: 12.5, open_workload: 5 };
const performance = { period: { dateFrom: '2026-07-19', dateTo: '2026-08-17' }, permissions: { canViewFinance: true }, criteria: { consultants: 'active_team_members', opportunityOutcomes: 'stage_updated_in_period', projectDelivery: 'delivered_at_in_period', overdue: 'currently_open_and_past_due', economics: 'visible' }, summary: { consultants: 1, opportunitiesAssigned: 6, activitiesCompleted: 8, tasksCompleted: 7, projectsDelivered: 2, openWorkload: 5, conversionRate: 75, wonValue: 12000 }, items: [performanceItem] };

const moduleAccess = Object.fromEntries(['dashboard', 'crm', 'briefing', 'quotes', 'projects', 'calendar', 'documents', 'notifications', 'team', 'knowledge', 'contracts', 'paperwork', 'finance', 'reports', 'automations', 'credentials', 'settings'].map((key) => [key, { can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true }]));
function list(items: unknown[]) { return { items, total: items.length, limit: 100, offset: 0 }; }

async function installFixture(page: Page) {
  const blocked: Array<{ method: string; pathname: string }> = [];
  blockedRequests.set(page, blocked);
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request(); const url = new URL(request.url()); const method = request.method().toUpperCase();
    if (url.origin !== frontendOrigin || !['GET', 'HEAD', 'OPTIONS'].includes(method)) { blocked.push({ method, pathname: url.pathname }); return route.abort('blockedbyclient'); }
    const json = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (url.pathname === '/api/tenant/team/me/module-permissions') return json({ role: 'owner', audience: 'executive', modules: moduleAccess });
    if (url.pathname === '/api/tenant/team/members') return json(list([{ id: MEMBER_ID, user_id: MEMBER_ID, display_name: 'Responsabile progetto', email: 'responsabile@example.test' }]));
    if (url.pathname === '/api/tenant/timeline/projects') return json(list(globalTimeline.filter((item) => !url.searchParams.get('types') || item.type === url.searchParams.get('types'))));
    if (url.pathname === '/api/tenant/timeline') return json({ items: globalTimeline.slice(0, 2), next_cursor: null, has_more: false });
    if (url.pathname === '/api/tenant/projects/tasks') return json(list(tasks));
    if (url.pathname === `/api/tenant/projects/${PROJECT_ID}`) return json(project);
    if (url.pathname === `/api/tenant/projects/${PROJECT_ID}/tasks`) return json(list(tasks));
    if (url.pathname.startsWith(`/api/tenant/projects/${PROJECT_ID}/`)) return json(list([]));
    if (url.pathname === '/api/tenant/projects') return json(list([project]));
    if (url.pathname.startsWith('/api/tenant/documents/entity/')) return json(list(documents));
    if (url.pathname === '/api/tenant/documents') return json(list(documents));
    if (url.pathname === '/api/tenant/reports/consultant-performance') return json(url.searchParams.get('user_id') ? { ...performance, details: { activities: [{ id: 'a1', title: 'Follow-up completato', type: 'follow_up', completed_at: '2026-08-16T12:00:00.000Z' }], projects: [project], opportunities: [opportunity] } } : performance);
    if (url.pathname === '/api/tenant/crm/pipeline') return json({ model: 'doflow-canonical-v1', stages: ['new', 'contacted', 'qualified', 'appointment', 'quote', 'closed_won'].map((stage) => ({ stage, label: stage, count: stage === 'qualified' ? 1 : 0, totalValue: stage === 'qualified' ? 2500 : 0, items: stage === 'qualified' ? [opportunity] : [] })) });
    if (url.pathname === `/api/tenant/crm/opportunities/${OPPORTUNITY_ID}`) return json(opportunity);
    if (url.pathname === '/api/tenant/crm/opportunities') return json(list([opportunity]));
    if (url.pathname === `/api/tenant/crm/companies/${COMPANY_ID}`) return json(company);
    if (url.pathname === '/api/tenant/crm/companies') return json(list([company]));
    if (url.pathname === `/api/tenant/crm/contacts/${CONTACT_ID}`) return json(contact);
    if (url.pathname === '/api/tenant/crm/contacts') return json(list([contact]));
    if (url.pathname === '/api/tenant/crm/activities') return json(list([]));
    if (url.pathname === '/api/tenant/record-operations/materials') return json({ items: [] });
    if (url.pathname === '/api/tenant/record-operations/administration') return json({ summary: { total_invoiced: 3200, total_paid: 1200, total_remaining: 2000 }, quotes: [], contracts: [], invoices: [], payments: [], deadlines: [], recurring_services: [], renewals: [] });
    if (url.pathname === '/api/tenant/quotes' || url.pathname === '/api/tenant/contracts' || url.pathname === '/api/tenant/finance/invoices') return json(list([]));
    return route.continue();
  });
}

async function screenshot(page: Page, filename: string) {
  const masks: Locator[] = [page.locator('[data-record-sensitive]'), page.locator('[data-visual-sensitive]'), page.locator('[data-sidebar="footer"]:visible'), page.locator('header').getByRole('button', { name: 'Menu utente' }), page.locator('header').getByRole('link', { name: 'Notifiche' })];
  await page.screenshot({ path: path.join(actualDir, filename), animations: 'disabled', mask: masks, maskColor: '#E2E8F0' });
}

test.beforeEach(async ({ page }) => { await installFixture(page); });
test.afterEach(async ({ page }) => { await page.waitForTimeout(75); expect(blockedRequests.get(page) || [], 'Il gate read-only ha osservato una richiesta mutativa o cross-origin.').toEqual([]); });

test('projects timeline desktop: eventi reali, filtri e pannello senza cambio route', async ({ page }) => {
  await page.setViewportSize({ width: 1675, height: 939 });
  await page.goto('/projects/timeline?type=call', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Flusso progetti' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await page.getByRole('button', { name: project.name }).click();
  await expect(page.locator('[data-unified-record-panel]')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/projects/timeline');
  expect(new URL(page.url()).searchParams.get('type')).toBe('call');
  await screenshot(page, 'project-timeline-desktop.png');
});

test('projects tasks desktop: colonne operative, ordinamento e progetto nel pannello', async ({ page }) => {
  await page.setViewportSize({ width: 1675, height: 939 });
  await page.goto('/projects/tasks?sortBy=due_at&sortOrder=asc', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Attività progetti' })).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(2);
  await expect(page.getByText('Responsabile progetto').first()).toBeVisible();
  await page.getByRole('button', { name: project.name }).first().click();
  await expect(page.locator('[data-unified-record-panel]')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/projects/tasks');
  await screenshot(page, 'project-tasks-desktop.png');
});

test('projects files desktop: metadati reali, nessun UUID e download protetto disponibile', async ({ page }) => {
  await page.setViewportSize({ width: 1675, height: 939 });
  await page.goto('/projects/files', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'File progetti' })).toBeVisible();
  await expect(page.getByText('Materiali progetto')).toBeVisible();
  await expect(page.getByText('v2')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Scarica Materiali progetto' })).toBeVisible();
  await expect(page.getByText(PROJECT_ID)).toHaveCount(0);
  await screenshot(page, 'project-files-global-desktop.png');
});

test('performance consulenti desktop: KPI trasparenti e finance autorizzato', async ({ page }) => {
  await page.setViewportSize({ width: 1675, height: 939 });
  await page.goto('/reports/team', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Performance consulenti' })).toBeVisible();
  await expect(page.getByText('Nessun punteggio sintetico')).toBeVisible();
  await expect(page.getByText('Valore trattative vinte:')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(1);
  await screenshot(page, 'consultant-performance-desktop.png');
});

test('consultant detail: commerciale, delivery e relazioni senza nuova pagina', async ({ page }) => {
  await page.setViewportSize({ width: 1675, height: 939 });
  await page.goto('/reports/team', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Responsabile progetto' }).click();
  const detail = page.getByRole('dialog');
  await expect(detail.getByText('Commerciale', { exact: true })).toBeVisible();
  await expect(detail.getByText('Delivery', { exact: true })).toBeVisible();
  await expect(detail.getByText('Attività recenti')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/reports/team');
  await screenshot(page, 'consultant-detail-desktop.png');
});

test('secondary views tablet: filtri e tabella restano utilizzabili', async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 768 });
  await page.goto('/projects/timeline', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Cerca eventi')).toBeVisible();
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await page.getByLabel('Cerca eventi').fill('Chiamata');
  expect(new URL(page.url()).pathname).toBe('/projects/timeline');
  await screenshot(page, 'secondary-views-tablet.png');
});

test('secondary views mobile: filtri, file e pannello progetto non perdono funzioni', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/projects/files', { waitUntil: 'domcontentloaded' });
  await expect(page.getByLabel('Cerca file')).toBeVisible();
  await page.getByRole('button', { name: project.name }).click();
  const panel = page.locator('[data-unified-record-panel]');
  await expect(panel).toBeVisible();
  const box = await panel.boundingBox();
  expect(Math.round(box?.width || 0)).toBe(390);
  await expect(panel.getByRole('tab', { name: 'File' })).toBeVisible();
  await screenshot(page, 'secondary-views-mobile.png');
});

test('acceptance CRM Projects: pipeline, cliente, progetto, viste globali e performance', async ({ page }) => {
  await page.setViewportSize({ width: 1675, height: 939 });
  await page.goto('/pipeline?acceptance=crm-projects', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Dettagli' }).click();
  await expect(page.locator('[data-unified-record-panel]')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe('/pipeline');
  await page.goto(`/companies?acceptance=crm-projects&company=${COMPANY_ID}&panelTab=activity`, { waitUntil: 'domcontentloaded' });
  let panel = page.locator('[data-unified-record-panel]');
  await expect(panel.getByRole('tab', { name: 'Attività' })).toHaveAttribute('aria-selected', 'true');
  await panel.getByRole('tab', { name: 'File' }).click();
  await expect(panel.getByText('Materiali progetto')).toBeVisible();
  await panel.getByRole('tab', { name: 'Amministrazione' }).click();
  await expect(panel.getByText('Valore progetto')).toBeVisible();
  await page.goto(`/projects?acceptance=crm-projects&project=${PROJECT_ID}&panelTab=flow`, { waitUntil: 'domcontentloaded' });
  panel = page.locator('[data-unified-record-panel]');
  await expect(panel.getByRole('tab', { name: 'Riepilogo' })).toHaveAttribute('aria-selected', 'true');
  await panel.getByRole('tab', { name: 'Attività' }).click();
  await panel.getByRole('tab', { name: 'File' }).click();
  for (const route of ['/projects/timeline', '/projects/tasks', '/projects/files', '/reports/team']) {
    await page.goto(route, { waitUntil: 'domcontentloaded' });
    await expect(page.locator('h1')).toBeVisible();
  }
  await expect(page.getByRole('heading', { name: 'Performance consulenti' })).toBeVisible();
  await screenshot(page, 'crm-projects-acceptance-desktop.png');
});
