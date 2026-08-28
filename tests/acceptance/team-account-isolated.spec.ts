import { expect, test, type BrowserContext, type Page, type Request, type Route } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const runtimeConfigPath = path.join(root, '.visual-runtime', 'commercial-core-stack.json');
const credentialPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Client: PgClient } = backendRequire('pg');

type RuntimeConfig = { databaseUrl: string };
type Credentials = { email: string; password: string; mfaSecret: string };
type ApiResult = { status: number; ok: boolean; json: any; text: string };

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/=+$/g, '');
  let bits = '';
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new Error('Invalid isolated MFA secret.');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes: number[] = [];
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
    if (attempt === 3) throw new Error(`Isolated MFA verification failed with HTTP ${response.status()}.`);
  }
}

async function login(
  context: BrowserContext,
  email: string,
  credentials: Credentials,
  withMfa = false,
) {
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
  return page;
}

async function expectLoginDenied(
  context: BrowserContext,
  email: string,
  password: string,
) {
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(password);
  const responsePromise = page.waitForResponse(
    (response) => response.url().includes('/api/auth/login') && response.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  const response = await responsePromise;
  expect([401, 403]).toContain(response.status());
  await expect(page).toHaveURL(/\/login$/);
  await page.close();
}

async function appFetch(
  page: Page,
  pathname: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<ApiResult> {
  return page.evaluate(async ({ pathValue, request }) => {
    const method = request.method ?? 'GET';
    const csrf = document.cookie
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith('doflow_csrf='))
      ?.slice('doflow_csrf='.length);
    const headers: Record<string, string> = {
      ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(request.headers ?? {}),
    };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && csrf) {
      headers['X-CSRF-Token'] = decodeURIComponent(csrf);
    }
    const response = await fetch(`/api${pathValue}`, {
      method,
      headers,
      credentials: 'include',
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* status assertions carry the evidence */ }
    return { status: response.status, ok: response.ok, json, text };
  }, { pathValue: pathname, request: options });
}

function inviteToken(inviteLink: string) {
  const parsed = new URL(inviteLink);
  const token = parsed.searchParams.get('token');
  if (!token) throw new Error('Synthetic invite response did not contain a token.');
  return token;
}

async function anonymousPage(context: BrowserContext) {
  const page = await context.newPage();
  await page.goto('/login');
  return page;
}

test('Team e account completa il lifecycle tenant-safe su stack PostgreSQL/Redis isolato', async ({ browser }) => {
  const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8')) as RuntimeConfig;
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  expect(['localhost', '127.0.0.1']).toContain(new URL(config.databaseUrl).hostname);

  const marker = randomUUID();
  const email = `team.${marker}@acceptance.invalid`;
  const revokedEmail = `revoked.${marker}@acceptance.invalid`;
  const expiredEmail = `expired.${marker}@acceptance.invalid`;
  const secondaryShadowId = randomUUID();
  const ownerContext = await browser.newContext();
  const inviteContext = await browser.newContext();
  const userContext = await browser.newContext();
  const reactivatedContext = await browser.newContext();
  const adminContext = await browser.newContext();
  const secondaryContext = await browser.newContext();
  const deniedContexts: BrowserContext[] = [];
  const db = new PgClient({ connectionString: config.databaseUrl });

  try {
    await db.connect();
    const ownerPage = await login(ownerContext, credentials.email, credentials, true);
    const listed = await appFetch(ownerPage, '/tenant/team/members?limit=100');
    expect(listed.status).toBe(200);
    const ownerMember = listed.json.items.find((item: any) => item.email === credentials.email);
    const otherOwner = listed.json.items.find((item: any) => item.email === 'final.owner@acceptance.invalid');
    expect(ownerMember?.tenant_role).toBe('owner');
    expect(otherOwner?.tenant_role).toBe('owner');

    await db.query(`UPDATE doflow.team_members SET tenant_role = 'user' WHERE id = $1`, [otherOwner.id]);
    const reconciledOwners = await appFetch(ownerPage, '/tenant/team/members?limit=100');
    const reconciledOwner = reconciledOwners.json.items.find((item: any) => item.id === otherOwner.id);
    expect(reconciledOwner?.tenant_role).toBe('owner');
    const storedOwnerRole = await db.query(`SELECT tenant_role FROM doflow.team_members WHERE id = $1`, [otherOwner.id]);
    expect(storedOwnerRole.rows[0]?.tenant_role).toBe('owner');

    const options = await appFetch(ownerPage, '/tenant/team/options');
    expect(options.status).toBe(200);
    expect(options.json.tenantRoles).toEqual(['admin', 'manager', 'editor', 'user', 'viewer']);
    expect(options.json.tenantRoles).not.toEqual(expect.arrayContaining(['owner', 'superadmin', 'super_admin', 'ceo']));

    for (const protectedMember of [ownerMember, otherOwner]) {
      expect((await appFetch(ownerPage, `/tenant/team/members/${protectedMember.id}`, { method: 'DELETE' })).status).toBe(403);
      expect((await appFetch(ownerPage, `/tenant/team/members/${protectedMember.id}`, {
        method: 'PATCH', body: { tenant_role: 'viewer' },
      })).status).toBe(403);
    }
    expect((await appFetch(ownerPage, `/tenant/team/members/${ownerMember.id}/module-permissions`, {
      method: 'PATCH', body: { permissions: [{ module_key: 'projects', can_view: false }] },
    })).status).toBe(403);
    expect((await appFetch(ownerPage, `/tenant/doflow/identity/users/${ownerMember.user_id}/roles`, {
      method: 'PATCH', body: { roles: ['web_developer'] },
    })).status).toBe(403);

    for (const role of ['owner', 'superadmin', 'super_admin', 'ceo']) {
      const denied = await appFetch(ownerPage, '/tenant/team/members', {
        method: 'POST',
        body: { email: `${role}.${marker}@acceptance.invalid`, display_name: `Denied ${role}`, tenant_role: role, send_invite: true },
      });
      expect([400, 403]).toContain(denied.status);
    }

    const skills = await appFetch(ownerPage, '/tenant/team/skills');
    expect(skills.status).toBe(200);
    expect(skills.json.items.length).toBeGreaterThan(1);
    const stagedSkillId = String(skills.json.items[0].id);

    const created = await appFetch(ownerPage, '/tenant/team/members', {
      method: 'POST',
      body: {
        email,
        display_name: 'Synthetic Lifecycle Member',
        tenant_role: 'user',
        operational_role: 'developer',
        capacity_hours_per_week: 32,
        send_invite: true,
        doflow_identity: {
          roles: ['web_developer'],
          capabilities: ['canViewAllLeads'],
        },
        module_permissions: [
          { module_key: 'projects', can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false },
          { module_key: 'crm', can_view: true, can_create: false, can_update: false, can_delete: false, can_manage: false },
        ],
        skill_ids: [stagedSkillId],
      },
    });
    expect(created.status).toBe(201);
    const memberId = String(created.json.member.id);
    const firstToken = inviteToken(String(created.json.invite.invite_link));
    expect(created.json.member.status).toBe('invited');

    await db.query(
      `INSERT INTO acceptance_secondary.team_members
         (id, email, display_name, tenant_role, operational_role, status, created_at, updated_at)
       VALUES ($1, $2, 'Secondary shadow', 'viewer', 'generic', 'active', now(), now())`,
      [secondaryShadowId, email],
    );

    const resent = await appFetch(ownerPage, `/tenant/team/members/${memberId}/invite`, { method: 'POST' });
    expect(resent.status).toBe(201);
    const validToken = inviteToken(String(resent.json.invite_link));
    expect(firstToken !== validToken).toBe(true);

    const invitePage = await anonymousPage(inviteContext);
    expect([400, 409]).toContain((await appFetch(invitePage, '/auth/accept-invite', {
      method: 'POST', body: { token: firstToken, password: credentials.password, tenant: 'doflow' },
    })).status);
    expect((await appFetch(invitePage, '/auth/accept-invite', {
      method: 'POST', body: { token: validToken, password: credentials.password, tenant: 'acceptance-secondary' },
    })).status).toBe(400);
    const accepted = await appFetch(invitePage, '/auth/accept-invite', {
      method: 'POST', body: { token: validToken, password: credentials.password, tenant: 'doflow' },
    });
    expect(accepted.status).toBe(201);
    expect([400, 409]).toContain((await appFetch(invitePage, '/auth/accept-invite', {
      method: 'POST', body: { token: validToken, password: credentials.password, tenant: 'doflow' },
    })).status);

    const accountRows = await db.query(
      `SELECT u.id::text, u.role, u.is_active, tm.status, tm.user_id::text
         FROM doflow.users u
         JOIN doflow.team_members tm ON tm.user_id = u.id AND tm.deleted_at IS NULL
        WHERE lower(u.email) = lower($1)`,
      [email],
    );
    expect(accountRows.rows).toHaveLength(1);
    const userId = String(accountRows.rows[0].id);
    expect(accountRows.rows[0]).toMatchObject({ role: 'user', is_active: true, status: 'active', user_id: userId });

    const userPage = await login(userContext, email, credentials);
    const stagedIdentity = await appFetch(ownerPage, '/tenant/doflow/identity');
    const stagedAssignment = stagedIdentity.json.assignments.find((item: any) => item.userId === userId);
    expect(stagedAssignment.roles).toEqual(['web_developer']);
    expect(stagedAssignment.explicitCapabilities).toEqual(['canViewAllLeads']);
    expect(stagedAssignment.capabilities).toEqual(expect.arrayContaining([
      'canViewAllLeads', 'canViewAutomations',
    ]));
    const stagedAccess = await appFetch(userPage, '/tenant/team/me/module-permissions');
    expect(stagedAccess.status).toBe(200);
    expect(stagedAccess.json.modules.projects.can_view).toBe(false);
    expect(stagedAccess.json.modules.crm.can_view).toBe(true);
    const stagedMember = await appFetch(ownerPage, `/tenant/team/members?search=${encodeURIComponent(email)}`);
    expect(stagedMember.json.items).toHaveLength(1);
    expect(stagedMember.json.items[0].skill_items.map((item: any) => item.id)).toContain(stagedSkillId);
    expect(stagedMember.json.items[0].metadata?.pending_doflow_identity).toBeUndefined();

    const automationRules = await appFetch(userPage, '/tenant/automations/rules');
    expect(automationRules.status).toBe(200);
    const syntheticRuleId = '4f52eac3-aee6-4d27-ab51-48632ca2df2a';
    const syntheticRunId = '33333333-3333-4333-8333-333333333333';
    const readOnlyAutomationMutations: Array<{ path: string; method: string; body?: unknown }> = [
      { path: '/tenant/automations/rules', method: 'POST', body: { name: 'Forbidden mutation' } },
      { path: `/tenant/automations/rules/${syntheticRuleId}`, method: 'PATCH', body: { name: 'Forbidden mutation' } },
      { path: `/tenant/automations/rules/${syntheticRuleId}`, method: 'DELETE' },
      { path: `/tenant/automations/rules/${syntheticRuleId}/enable`, method: 'PATCH' },
      { path: `/tenant/automations/rules/${syntheticRuleId}/disable`, method: 'PATCH' },
      { path: `/tenant/automations/rules/${syntheticRuleId}/run`, method: 'POST', body: {} },
      { path: `/tenant/automations/runs/${syntheticRunId}/retry`, method: 'POST' },
    ];
    for (const mutation of readOnlyAutomationMutations) {
      expect((await appFetch(userPage, mutation.path, {
        method: mutation.method,
        body: mutation.body,
      })).status).toBe(403);
    }

    expect((await appFetch(userPage, '/tenant/team/members', {
      method: 'POST', body: { email: `forbidden.${marker}@acceptance.invalid`, display_name: 'Forbidden' },
    })).status).toBe(403);

    expect((await appFetch(ownerPage, `/tenant/team/members/${memberId}`, {
      method: 'PATCH',
      body: {
        display_name: 'Synthetic Lifecycle Edited',
        tenant_role: 'editor',
        operational_role: 'developer',
        capacity_hours_per_week: 36,
        availability_status: 'busy',
      },
    })).status).toBe(200);
    expect((await appFetch(ownerPage, `/tenant/team/members/${memberId}`, {
      method: 'PATCH', body: { email: `changed.${marker}@acceptance.invalid` },
    })).status).toBe(400);
    expect((await appFetch(ownerPage, `/tenant/team/members/${memberId}`, {
      method: 'PATCH', body: { tenant_role: 'owner' },
    })).status).toBe(400);

    expect((await appFetch(ownerPage, `/tenant/doflow/identity/users/${userId}/roles`, {
      method: 'PATCH', body: { roles: ['web_developer'] },
    })).status).toBe(200);
    expect((await appFetch(ownerPage, `/tenant/doflow/identity/users/${userId}/capabilities`, {
      method: 'PATCH', body: { capabilities: ['canViewAllLeads'] },
    })).status).toBe(200);
    const identity = await appFetch(ownerPage, '/tenant/doflow/identity');
    const assignment = identity.json.assignments.find((item: any) => item.userId === userId);
    expect(assignment.roles).toEqual(['web_developer']);
    expect(assignment.explicitCapabilities).toEqual(['canViewAllLeads']);
    expect(assignment.capabilities).toEqual(expect.arrayContaining(['canViewAllLeads', 'canViewAutomations']));
    expect(assignment.capabilities).not.toContain('canUseBuilder');

    const permissionUpdate = await appFetch(ownerPage, `/tenant/team/members/${memberId}/module-permissions`, {
      method: 'PATCH',
      body: { permissions: [
        { module_key: 'projects', can_view: false, can_create: false, can_update: false, can_delete: false, can_manage: false },
        { module_key: 'crm', can_view: true, can_create: true, can_update: true, can_delete: false, can_manage: false },
      ] },
    });
    expect(permissionUpdate.status).toBe(200);
    expect(permissionUpdate.json.items).toHaveLength(2);

    expect((await appFetch(ownerPage, `/tenant/team/members/${memberId}/skills`, {
      method: 'POST', body: { skill_id: skills.json.items[1].id, level: 'senior' },
    })).status).toBe(201);
    const workload = await appFetch(ownerPage, `/tenant/team/members/${memberId}/workload`);
    expect(workload.status).toBe(200);
    expect(Number(workload.json.capacity_hours_per_week)).toBe(36);
    const activity = await appFetch(ownerPage, `/tenant/team/members/${memberId}/activity`);
    expect(activity.status).toBe(200);
    expect(activity.json.items.map((item: any) => item.action)).toEqual(expect.arrayContaining([
      'profile_created', 'member_invited', 'member_access_updated', 'skill_added',
    ]));

    await ownerPage.goto('/dashboard/team-space?tab=team-accounts');
    const dismissTour = ownerPage.getByRole('button', { name: 'Esplora in autonomia', exact: true });
    if (await dismissTour.isVisible().catch(() => false)) await dismissTour.click();
    await expect(ownerPage.getByRole('heading', { name: 'Team e account' })).toBeVisible();
    await expect(ownerPage.getByText('Synthetic Lifecycle Edited', { exact: true }).first()).toBeVisible();

    const postPermissionPage = await login(reactivatedContext, email, credentials);
    const effectiveAccess = await appFetch(postPermissionPage, '/tenant/team/me/module-permissions');
    expect(effectiveAccess.status).toBe(200);
    expect(effectiveAccess.json.modules.projects.can_view).toBe(false);
    expect(effectiveAccess.json.modules.crm.can_view).toBe(true);

    expect((await appFetch(ownerPage, `/tenant/team/members/${memberId}`, {
      method: 'PATCH', body: { status: 'suspended' },
    })).status).toBe(200);
    expect((await appFetch(postPermissionPage, '/auth/me')).status).toBe(401);
    const suspendedLoginContext = await browser.newContext();
    deniedContexts.push(suspendedLoginContext);
    await expectLoginDenied(suspendedLoginContext, email, credentials.password);

    expect((await appFetch(ownerPage, `/tenant/team/members/${memberId}`, {
      method: 'PATCH', body: { status: 'active' },
    })).status).toBe(200);
    const activeContext = await browser.newContext();
    deniedContexts.push(activeContext);
    const activePage = await login(activeContext, email, credentials);
    expect((await appFetch(activePage, '/auth/me')).status).toBe(200);

    const revoked = await appFetch(ownerPage, '/tenant/team/members', {
      method: 'POST',
      body: { email: revokedEmail, display_name: 'Revoked Pending', tenant_role: 'viewer', send_invite: true },
    });
    expect(revoked.status).toBe(201);
    const revokedToken = inviteToken(String(revoked.json.invite.invite_link));
    expect((await appFetch(ownerPage, `/tenant/team/members/${revoked.json.member.id}`, { method: 'DELETE' })).status).toBe(200);
    expect([400, 409]).toContain((await appFetch(invitePage, '/auth/accept-invite', {
      method: 'POST', body: { token: revokedToken, password: credentials.password, tenant: 'doflow' },
    })).status);

    const expired = await appFetch(ownerPage, '/tenant/team/members', {
      method: 'POST',
      body: { email: expiredEmail, display_name: 'Expired Pending', tenant_role: 'viewer', send_invite: true },
    });
    expect(expired.status).toBe(201);
    const expiredToken = inviteToken(String(expired.json.invite.invite_link));
    await db.query(`UPDATE doflow.invites SET expires_at = now() - interval '1 hour' WHERE lower(email) = lower($1) AND accepted_at IS NULL`, [expiredEmail]);
    expect([400, 409]).toContain((await appFetch(invitePage, '/auth/accept-invite', {
      method: 'POST', body: { token: expiredToken, password: credentials.password, tenant: 'doflow' },
    })).status);
    expect((await appFetch(ownerPage, `/tenant/team/members/${expired.json.member.id}`, { method: 'DELETE' })).status).toBe(200);

    const secondaryPage = await login(secondaryContext, 'secondary.owner@acceptance.invalid', credentials);
    const secondaryMembers = await appFetch(secondaryPage, '/tenant/team/members?limit=100');
    const secondaryOwner = secondaryMembers.json.items.find((item: any) => item.email === 'secondary.owner@acceptance.invalid');
    expect(listed.json.items.some((item: any) => item.email === 'secondary.owner@acceptance.invalid')).toBe(false);
    expect((await appFetch(ownerPage, `/tenant/team/members/${secondaryOwner.id}`)).status).toBe(404);
    expect((await appFetch(ownerPage, `/tenant/team/members/${secondaryOwner.id}/module-permissions`)).status).toBe(404);
    expect((await appFetch(ownerPage, `/tenant/team/members/${secondaryOwner.id}/workload`)).status).toBe(404);
    expect((await appFetch(ownerPage, `/tenant/team/members/${secondaryOwner.id}/activity`)).status).toBe(404);
    expect((await appFetch(ownerPage, `/tenant/team/members/${secondaryOwner.id}/skills`, {
      method: 'POST', body: { skill_id: skills.json.items[0].id },
    })).status).toBe(404);
    expect((await appFetch(ownerPage, `/tenant/doflow/identity/users/${secondaryOwner.user_id}/capabilities`, {
      method: 'PATCH', body: { capabilities: ['canViewAllLeads'] },
    })).status).toBe(404);
    expect([400, 404]).toContain((await appFetch(ownerPage, `/tenant/team/members/${secondaryOwner.id}`, {
      method: 'PATCH',
      headers: { 'X-Tenant-Id': 'acceptance_secondary', 'X-Tenant-Schema': 'acceptance_secondary' },
      body: { display_name: 'Cross tenant denied', tenant_id: 'acceptance_secondary', schema: 'acceptance_secondary' },
    })).status);
    expect([400, 404]).toContain((await appFetch(ownerPage, `/tenant/team/members/${secondaryOwner.id}?tenant=acceptance_secondary`, {
      method: 'DELETE', headers: { 'X-Tenant-Id': 'acceptance_secondary' },
    })).status);
    expect((await appFetch(secondaryPage, `/tenant/team/members/${memberId}`)).status).toBe(404);

    const adminPage = await login(adminContext, 'final.admin@acceptance.invalid', credentials);
    expect((await appFetch(adminPage, `/tenant/team/members/${ownerMember.id}`, { method: 'DELETE' })).status).toBe(403);
    expect((await appFetch(adminPage, '/tenant/team/members', {
      method: 'POST', body: { email: `admin-owner.${marker}@acceptance.invalid`, display_name: 'Denied owner', tenant_role: 'owner' },
    })).status).toBe(400);
    expect((await appFetch(adminPage, '/tenant/team/members', {
      method: 'POST', body: { email: `admin-admin.${marker}@acceptance.invalid`, display_name: 'Denied admin', tenant_role: 'admin' },
    })).status).toBe(403);

    for (const emailAddress of [
      'visual.manager@acceptance.invalid',
      'visual.editor@acceptance.invalid',
      'visual.viewer@acceptance.invalid',
    ]) {
      const deniedContext = await browser.newContext();
      deniedContexts.push(deniedContext);
      const deniedPage = await login(deniedContext, emailAddress, credentials);
      expect((await appFetch(deniedPage, '/tenant/team/members', {
        method: 'POST', body: { email: `denied.${randomUUID()}@acceptance.invalid`, display_name: 'Denied mutation' },
      })).status).toBe(403);
    }

    await expect(ownerPage.locator('[data-team-account-admin="server"]')).toBeVisible();
    if (await dismissTour.isVisible().catch(() => false)) await dismissTour.click();
    const protectedSuperadmin = ownerPage.locator('button').filter({ hasText: 'final.tenant-superadmin@acceptance.invalid' });
    await protectedSuperadmin.click();
    await expect(ownerPage.locator('[data-slot="card-title"]').filter({ hasText: 'Final Tenant Scoped Superadmin' }))
      .toContainText('Account protetto');
    await expect(ownerPage.getByRole('button', { name: 'Rimuovi', exact: true })).toHaveCount(0);

    const syntheticMember = ownerPage.locator('button').filter({ hasText: email });
    await expect(syntheticMember).toBeVisible();
    await syntheticMember.click();
    await expect(ownerPage.locator('[data-slot="card-title"]').filter({ hasText: 'Synthetic Lifecycle Edited' }))
      .toBeVisible();

    const deleteUrl = `/api/tenant/team/members/${memberId}`;
    const observedDeletes: Request[] = [];
    const observeDelete = (request: Request) => {
      if (request.method() === 'DELETE' && new URL(request.url()).pathname === deleteUrl) {
        observedDeletes.push(request);
      }
    };
    ownerPage.on('request', observeDelete);
    const deleteResponsePromise = ownerPage.waitForResponse(
      (response) => response.request().method() === 'DELETE'
        && new URL(response.url()).pathname === deleteUrl,
    );
    await ownerPage.getByRole('button', { name: 'Rimuovi', exact: true }).click();
    await ownerPage.getByRole('button', { name: 'Rimuovi dal tenant', exact: true }).click();
    const deleteResponse = await deleteResponsePromise;
    expect(deleteResponse.status()).toBe(200);
    await expect(deleteResponse.json()).resolves.toMatchObject({ success: true, member_id: memberId });
    await expect.poll(() => observedDeletes.length).toBe(1);
    const deleteHeaders = await observedDeletes[0].allHeaders();
    expect(deleteHeaders['x-doflow-web']).toBe('1');
    expect(deleteHeaders['x-csrf-token']).toBeTruthy();
    expect(deleteHeaders.cookie).toContain('doflow_session=');
    expect(deleteHeaders.cookie).toContain('doflow_csrf=');
    expect(deleteHeaders).not.toHaveProperty('x-doflow-tenant-id');
    ownerPage.off('request', observeDelete);

    await expect(syntheticMember).toHaveCount(0);
    expect((await appFetch(activePage, '/auth/me')).status).toBe(401);
    const removedLoginContext = await browser.newContext();
    deniedContexts.push(removedLoginContext);
    await expectLoginDenied(removedLoginContext, email, credentials.password);

    const state = await db.query(
      `SELECT
         (SELECT is_active FROM doflow.users WHERE id = $1) AS tenant_active,
         (SELECT deleted_at IS NOT NULL FROM doflow.team_members WHERE id = $2) AS member_archived,
         (SELECT is_active FROM public.users WHERE id = $1) AS public_active,
         (SELECT count(*)::int FROM doflow.doflow_user_roles WHERE user_id = $1) AS role_count,
         (SELECT count(*)::int FROM doflow.doflow_user_capabilities WHERE user_id = $1) AS capability_count,
         (SELECT count(*)::int FROM doflow.team_module_permissions WHERE team_member_id = $2 AND deleted_at IS NULL) AS module_count,
         (SELECT count(*)::int FROM acceptance_secondary.team_members WHERE id = $3 AND deleted_at IS NULL) AS secondary_count`,
      [userId, memberId, secondaryShadowId],
    );
    expect(state.rows[0]).toMatchObject({
      tenant_active: false,
      member_archived: true,
      public_active: true,
      role_count: 0,
      capability_count: 0,
      module_count: 0,
      secondary_count: 1,
    });
    const syncAfterRemoval = await appFetch(ownerPage, '/tenant/team/members/sync-users', { method: 'POST' });
    expect([200, 201]).toContain(syncAfterRemoval.status);
    const afterRemoval = await appFetch(ownerPage, `/tenant/team/members?search=${encodeURIComponent(email)}`);
    expect(afterRemoval.status).toBe(200);
    expect(afterRemoval.json.items).toHaveLength(0);
    const evidenceViewport = ownerPage.viewportSize();
    const screenshotPath = path.join(
      root,
      `docs/design-references/doflow-crm-projects/actual/team-account-removal-local-${evidenceViewport?.width}x${evidenceViewport?.height}.png`,
    );
    await mkdir(path.dirname(screenshotPath), { recursive: true });
    await ownerPage.screenshot({ path: screenshotPath, fullPage: true });
    const removalAudit = await db.query(
      `SELECT count(*)::int AS count FROM doflow.audit_log WHERE action = 'team_member_removed' AND target = $1`,
      [memberId],
    );
    expect(removalAudit.rows[0].count).toBe(1);

    const rejectedEmail = `delete-error.${marker}@acceptance.invalid`;
    const rejectedMember = await appFetch(ownerPage, '/tenant/team/members', {
      method: 'POST',
      body: { email: rejectedEmail, display_name: 'Rejected Removal', tenant_role: 'viewer', send_invite: true },
    });
    expect(rejectedMember.status).toBe(201);
    const rejectedDeleteUrl = `/api/tenant/team/members/${rejectedMember.json.member.id}`;
    await ownerPage.goto('/dashboard/team-space?tab=team-accounts');
    if (await dismissTour.isVisible().catch(() => false)) await dismissTour.click();
    const rejectedMemberButton = ownerPage.locator('button').filter({ hasText: rejectedEmail });
    await expect(rejectedMemberButton).toBeVisible();
    await rejectedMemberButton.click();
    await expect(ownerPage.locator('[data-slot="card-title"]').filter({ hasText: 'Rejected Removal' }))
      .toBeVisible();

    let rejectedDeleteCount = 0;
    const rejectRemoval = async (route: Route) => {
      if (route.request().method() !== 'DELETE') {
        await route.continue();
        return;
      }
      rejectedDeleteCount += 1;
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({ message: 'Rimozione sintetica rifiutata dal backend' }),
      });
    };
    await ownerPage.route(`**${rejectedDeleteUrl}`, rejectRemoval);
    const rejectedResponsePromise = ownerPage.waitForResponse(
      (response) => response.request().method() === 'DELETE'
        && new URL(response.url()).pathname === rejectedDeleteUrl,
    );
    await ownerPage.getByRole('button', { name: 'Rimuovi', exact: true }).click();
    await ownerPage.getByRole('button', { name: 'Rimuovi dal tenant', exact: true }).click();
    const rejectedResponse = await rejectedResponsePromise;
    expect(rejectedResponse.status()).toBe(409);
    await expect.poll(() => rejectedDeleteCount).toBe(1);
    await expect(ownerPage.getByText('Rimozione sintetica rifiutata dal backend', { exact: true }))
      .toBeVisible();
    await expect(rejectedMemberButton).toBeVisible();
    await ownerPage.unroute(`**${rejectedDeleteUrl}`, rejectRemoval);
    expect((await appFetch(ownerPage, `/tenant/team/members/${rejectedMember.json.member.id}`, { method: 'DELETE' })).status).toBe(200);
  } finally {
    await Promise.allSettled([
      ownerContext.close(), inviteContext.close(), userContext.close(), reactivatedContext.close(),
      adminContext.close(), secondaryContext.close(), ...deniedContexts.map((context) => context.close()),
    ]);
    await db.end().catch(() => undefined);
  }
});
