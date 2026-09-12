import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const origin = 'http://localhost:3100';
const actual = path.resolve('docs/design-references/doflow-crm-projects/actual');
const owner = { id: '10000000-0000-4000-8000-000000000001', user_id: '20000000-0000-4000-8000-000000000001', email: 'owner@acceptance.invalid', display_name: 'Owner sintetico', tenant_role: 'owner', status: 'active', capacity_hours_per_week: 40 };
const pending = { id: '10000000-0000-4000-8000-000000000002', user_id: null, email: 'invited@acceptance.invalid', display_name: 'Invitato sintetico', tenant_role: 'user', status: 'invited', capacity_hours_per_week: 40 };
const syntheticLink = `${origin}/accept-invite?token=synthetic-not-valid&tenant=doflow`;

async function fixture(page: Page, options: { emailSent?: boolean; refreshFails?: boolean; httpError?: boolean; networkError?: boolean; denied?: boolean; tenant?: string } = {}) {
  let mutations = 0;
  const tenant = options.tenant || 'doflow';
  const members = [owner, pending];
  const capabilities = options.denied ? [] : ['canViewProjects', 'canManageRoles'];
  await page.context().addCookies([{ name: 'doflow_csrf', value: 'synthetic-csrf', url: origin }]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator.clipboard, 'writeText', { configurable: true, value: async (value: string) => { (window as any).__copiedInvite = value; } });
  });
  await page.routeWebSocket('**/*', (socket) => {
    const url = new URL(socket.url());
    if (url.host === 'localhost:3100' && url.pathname.startsWith('/_next/')) socket.connectToServer();
    // Application sockets stay mocked; no server connection is opened.
  });
  await page.route('**/*', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin !== origin) return route.abort('blockedbyclient');
    if (!url.pathname.startsWith('/api/')) return route.continue();
    const send = (body: unknown, status = 200) => route.fulfill({ status, json: body });
    const pathname = url.pathname;
    const list = (items: unknown[] = []) => ({ items, total: items.length, limit: 100, offset: 0 });
    if (request.method() === 'POST' && (pathname === '/api/tenant/team/members' || pathname === `/api/tenant/team/members/${pending.id}/invite`)) {
      mutations++;
      // Shared hosts use the authenticated cookie principal, never a forged tenant header.
      expect(request.headers()['x-doflow-tenant-id']).toBeUndefined();
      expect(request.headers()['x-doflow-web']).toBe('1');
      expect(request.headers()['x-csrf-token']).toBe('synthetic-csrf');
      await new Promise((resolve) => setTimeout(resolve, 250));
      if (options.networkError) return route.abort('timedout');
      if (options.httpError) return send({ message: 'Permesso negato dal server' }, 403);
      const invite = { email_sent: options.emailSent === true, invite_link: syntheticLink, expires_at: '2030-01-08T12:00:00.000Z' };
      if (pathname.endsWith('/invite')) return send(invite);
      const body = request.postDataJSON();
      expect(body.send_invite).toBe(true);
      const member = { ...pending, id: '10000000-0000-4000-8000-000000000003', display_name: body.display_name, email: body.email };
      members.push(member);
      return send({ member, invite }, 201);
    }
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) return send({ ok: true });
    if (pathname === '/api/auth/me') return send({ user: { id: owner.user_id, email: owner.email, role: options.denied ? 'user' : 'owner', tenantId: tenant, tenantSlug: tenant, authStage: 'FULL', mfa_pending: false } });
    if (pathname === '/api/tenant/doflow/identity') return send({ capabilities, preferences: {}, assignments: [{ userId: owner.user_id, roles: options.denied ? [] : ['administrator'], capabilities, explicitCapabilities: [] }] });
    if (pathname === '/api/tenant/team/members') return options.refreshFails && mutations ? send({ message: 'Refresh sintetico non disponibile' }, 503) : send(list(members));
    if (pathname === '/api/tenant/team/options') return send({ tenantRoles: ['admin', 'user'], operationalRoles: ['generic'], availabilityStatuses: ['available'] });
    if (pathname === '/api/tenant/team/me/module-permissions') return send({ role: 'owner', audience: 'executive', modules: Object.fromEntries(['dashboard', 'team', 'settings'].map((key) => [key, { can_view: true, can_create: true, can_update: true, can_delete: true, can_manage: true }])) });
    if (pathname === '/api/tenant/preferences') return send({ onboardingStatus: 'completed', completedTourIds: ['main'], suggestionsEnabled: false, animationsEnabled: false });
    if (pathname === '/api/tenant/backend-contracts/inbox/state') return send({ conversations: [], drafts: [], receipts: [], filters: {}, adapters: { email: { outboundConfigured: false, inboundConfigured: false }, whatsapp: { mode: 'web_handoff' } } });
    if (pathname === '/api/tenant/collaboration/calls/status') return send({ enabled: false });
    if (pathname === '/api/tenant/bonus') return send({ wallet: {}, policy: { rules: {} }, ledger: [], requests: [], pendingRequests: [], periods: [] });
    return send(list());
  });
  await page.goto('/dashboard/team-space?tab=team-accounts');
  if (!options.denied && tenant === 'doflow') await expect(page.getByRole('heading', { name: 'Team e account', exact: true })).toBeVisible();
  return { mutations: () => mutations };
}

async function create(page: Page, twice = false) {
  await page.getByRole('button', { name: 'Invita membro', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Invita membro', exact: true });
  await dialog.locator('input[type=email]').fill('new@acceptance.invalid');
  await dialog.locator('input').nth(1).fill('Nuovo sintetico');
  const button = dialog.getByRole('button', { name: 'Crea e invita', exact: true });
  if (twice) await button.evaluate((element: HTMLButtonElement) => { element.click(); element.click(); });
  else await button.click();
}

async function resend(page: Page) {
  await page.getByRole('button', { name: /Invitato sintetico/ }).click();
  await page.getByRole('button', { name: 'Reinvia invito', exact: true }).click();
}

async function copyLink(page: Page) {
  await page.getByRole('button', { name: 'Copia link', exact: true }).click();
  expect(await page.evaluate(() => (window as any).__copiedInvite === 'http://localhost:3100/accept-invite?token=synthetic-not-valid&tenant=doflow')).toBe(true);
}

test('creation retains the manual fallback even when the following refresh fails', async ({ page }) => {
  const state = await fixture(page, { refreshFails: true });
  await create(page);
  await expect(page.getByRole('dialog', { name: 'Invita membro', exact: true })).not.toBeVisible();
  await expect(page.getByText('Invio email non confermato.', { exact: false })).toBeVisible();
  await copyLink(page);
  await expect(page.getByRole('alert').filter({ hasText: /creato/i })).toBeVisible();
  expect(state.mutations()).toBe(1);
});

test('resend retains the manual fallback and blocks duplicate clicks', async ({ page }) => {
  const state = await fixture(page);
  await page.getByRole('button', { name: /Invitato sintetico/ }).click();
  await page.getByRole('button', { name: 'Reinvia invito', exact: true }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); });
  await copyLink(page);
  expect(state.mutations()).toBe(1);
});

test('SMTP acceptance is presented without promising inbox delivery', async ({ page }) => {
  const state = await fixture(page, { emailSent: true });
  await create(page, true);
  await expect(page.getByText(/Email accettata dal servizio di posta/)).toBeVisible();
  await copyLink(page);
  expect(state.mutations()).toBe(1);
});

test('resend keeps the link available when refreshing members fails', async ({ page }) => {
  await fixture(page, { refreshFails: true });
  await resend(page);
  await copyLink(page);
  await expect(page.getByRole('alert').filter({ hasText: 'Invito generato' })).toBeVisible();
});

test('a user without the required capabilities has no invite controls', async ({ page }) => {
  const state = await fixture(page, { denied: true });
  await expect(page.getByRole('heading', { name: 'Accesso non autorizzato' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Invita membro', exact: true })).toHaveCount(0);
  expect(state.mutations()).toBe(0);
});

test('another tenant keeps its existing Team route', async ({ page }) => {
  const state = await fixture(page, { tenant: 'secondary_fixture' });
  await expect(page).toHaveURL(`${origin}/team`);
  await expect(page.locator('[data-team-account-admin]')).toHaveCount(0);
  expect(state.mutations()).toBe(0);
});

test('HTTP errors preserve the draft and do not fabricate an invite link', async ({ page }) => {
  const state = await fixture(page, { httpError: true });
  await create(page);
  await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Permesso negato');
  await expect(page.getByRole('dialog').locator('input[type=email]')).toHaveValue('new@acceptance.invalid');
  await expect(page.getByRole('button', { name: 'Copia link' })).toHaveCount(0);
  expect(state.mutations()).toBe(1);
});

test('network timeout does not automatically retry a mutation', async ({ page }) => {
  const state = await fixture(page, { networkError: true });
  await resend(page);
  await expect(page.getByRole('alert')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reinvia invito', exact: true })).toBeEnabled();
  expect(state.mutations()).toBe(1);
});

test('clipboard denial leaves the selectable link available', async ({ page }) => {
  await fixture(page);
  await resend(page);
  await page.evaluate(() => { Object.defineProperty(navigator.clipboard, 'writeText', { value: async () => { throw new Error('Denied'); } }); });
  await page.getByRole('button', { name: 'Copia link', exact: true }).click();
  await expect(page.getByText(/Copia automatica non disponibile/)).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'Link invito' })).toHaveValue(syntheticLink);
});

for (const viewport of [{ width: 1440, height: 900 }, { width: 1024, height: 768 }, { width: 390, height: 844 }]) {
  test(`invite fallback remains usable at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await fixture(page);
    await mkdir(actual, { recursive: true });
    await page.screenshot({ path: path.join(actual, `team-invite-before-${viewport.width}x${viewport.height}.png`) });
    await resend(page);
    await copyLink(page);
    const panel = page.getByRole('region', { name: 'Invito disponibile' });
    await panel.scrollIntoViewIfNeeded();
    const box = await panel.boundingBox();
    expect(box && box.x >= 0 && box.x + box.width <= viewport.width + 1).toBe(true);
    await page.screenshot({ path: path.join(actual, `team-invite-${viewport.width}x${viewport.height}.png`), mask: [page.getByRole('textbox', { name: 'Link invito' })] });
  });
}
