import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const runtimeConfigPath = path.join(root, '.visual-runtime', 'commercial-core-stack.json');
const credentialPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const resultPath = path.join(root, '.visual-runtime', 'automation-performance-acceptance-result.json');
const actualDir = path.join(root, 'docs', 'design-references', 'doflow-crm-projects', 'actual');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Client: PgClient } = backendRequire('pg');
type Credentials = { email: string; password: string; mfaSecret: string };
type Result = { status: number; ok: boolean; json: any; text: string };

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = '';
  for (const character of value.toUpperCase().replace(/=+$/g, '')) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const bytes: number[] = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  return Buffer.from(bytes);
}
function totp(secret: string) {
  const buffer = Buffer.alloc(8); buffer.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}
async function api(page: Page, pathname: string, options: { method?: string; body?: unknown; key?: string } = {}): Promise<Result> {
  return page.evaluate(async ({ pathname, options }) => {
    const method = options.method || 'GET';
    const csrf = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('doflow_csrf='))?.slice('doflow_csrf='.length);
    const headers: Record<string, string> = {};
    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method) && csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
    if (options.key) headers['Idempotency-Key'] = options.key;
    const response = await fetch(`/api${pathname}`, { method, headers, credentials: 'include', body: options.body === undefined ? undefined : JSON.stringify(options.body) });
    const text = await response.text(); let json: any = null; try { json = text ? JSON.parse(text) : null; } catch {}
    return { status: response.status, ok: response.ok, json, text };
  }, { pathname, options });
}
async function login(context: BrowserContext, email: string, credentials: Credentials, withMfa = false) {
  const page = await context.newPage(); await page.goto('/login');
  await page.getByLabel('Email').fill(email); await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  if (withMfa) {
    await expect(page).toHaveURL(/\/doflow\/mfa$/);
    if (30_000 - (Date.now() % 30_000) < 5_000) await page.waitForTimeout(5_200);
    await page.getByLabel('Codice di verifica a 6 cifre').fill(totp(credentials.mfaSecret));
    await page.getByRole('button', { name: 'Verifica Codice' }).click();
  }
  await expect.poll(async () => (await api(page, '/auth/me')).json?.user?.authStage).toBe('FULL');
  await page.goto('/dashboard'); await expect(page).toHaveURL(/\/dashboard$/);
  return page;
}
async function openAutomationDashboard(page: Page, marker: string) {
  await page.goto('/dashboard/automazioni');
  await expect(page.getByRole('heading', { name: 'Automazioni e Performance' })).toBeVisible({ timeout: 60_000 });
  await expect(page.getByText(marker).first()).toBeVisible({ timeout: 60_000 });
}
function restart(kind: 'backend' | 'frontend' | 'redis') {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/commercial-core-isolated-stack.mjs'), `restart-${kind}`], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `restart ${kind} failed`);
}
test('Phase 4B is queued, append-only, PostgreSQL-authoritative and tenant-isolated', async ({ browser }) => {
  const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8')) as { databaseUrl: string };
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  const db = new PgClient({ connectionString: config.databaseUrl });
  const contextA = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const contextB = await browser.newContext({ viewport: { width: 1440, height: 900 } }); const contextC = await browser.newContext(); const contextD = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const pageErrors: string[] = [];
  const ownerConsoleErrors: string[] = [];
  const limitedForbiddenGets: string[] = [];
  contextB.on('response', (response) => {
    if (response.request().method() === 'GET' && response.status() === 403) {
      limitedForbiddenGets.push(new URL(response.url()).pathname);
    }
  });
  let fresh: BrowserContext | undefined;
  const marker = `AUTO4B-${Date.now()}`; const idempotencyKey = `run:${marker}`; const adjustmentKey = `points:${marker}`;
  try {
    await db.connect();
    const owner = await login(contextA, credentials.email, credentials, true);
    const limited = await login(contextB, 'visual.editor@acceptance.invalid', credentials);
    const secondary = await login(contextC, 'secondary.owner@acceptance.invalid', credentials);
    const noView = await login(contextD, 'visual.viewer@acceptance.invalid', credentials);
    for (const page of [owner, limited, secondary, noView]) page.on('pageerror', (error) => pageErrors.push(error.message));
    owner.on('console', (message) => {
      if (message.type() === 'error') ownerConsoleErrors.push(message.text());
    });

    // Keep the scenario rerunnable after a prior interrupted run: the failure
    // branch requires this synthetic adapter to start disabled.
    const disabledAdapter = await api(owner, '/tenant/doflow/performance/adapters/acceptance-synthetic', {
      method: 'PATCH', body: { enabled: false },
    });
    expect(disabledAdapter.ok, disabledAdapter.text).toBe(true);

    const created = await api(owner, '/tenant/automations/rules', { method: 'POST', body: {
      name: `Deal sopra soglia · ${marker}`, description: 'Acceptance BullMQ', category: 'general', trigger_type: 'manual_run',
      conditions: [], actions: [{ type: 'noop' }], is_enabled: true, run_mode: 'manual', priority: 'medium',
    }});
    expect(created.ok, created.text).toBe(true); const ruleId = created.json.id;
    expect(created.json.optimistic_version).toBe(1);
    const updated = await api(owner, `/tenant/automations/rules/${ruleId}`, { method: 'PATCH', body: { description: 'Versione 2', optimistic_version: 1, change_reason: 'Acceptance versioning' } });
    expect(updated.ok, updated.text).toBe(true);
    const afterUpdate = await api(owner, `/tenant/automations/rules/${ruleId}`);
    expect(afterUpdate.json.optimistic_version).toBe(2);
    expect(afterUpdate.json.current_version).toBe(2);
    const stale = await api(owner, `/tenant/automations/rules/${ruleId}`, { method: 'PATCH', body: { description: 'stale', optimistic_version: 1 } });
    expect(stale.status, stale.text).toBe(409);

    const [first, duplicate] = await Promise.all([
      api(owner, `/tenant/automations/rules/${ruleId}/run`, { method: 'POST', body: { marker }, key: idempotencyKey }),
      api(owner, `/tenant/automations/rules/${ruleId}/run`, { method: 'POST', body: { marker }, key: idempotencyKey }),
    ]);
    expect(first.ok, first.text).toBe(true); expect(duplicate.json.id).toBe(first.json.id); expect([first.json.existing, duplicate.json.existing]).toContain(true);
    await expect.poll(async () => (await api(owner, `/tenant/automations/runs/${first.json.id}`)).json?.status, { timeout: 30_000 }).toBe('success');

    const failingRule = await api(owner, '/tenant/automations/rules', { method: 'POST', body: {
      name: `${marker}-failure`, category: 'general', trigger_type: 'manual_run', conditions: [],
      actions: [{ type: 'invoke_adapter', adapter: 'acceptance_synthetic' }], is_enabled: true, run_mode: 'manual', priority: 'medium',
    }});
    expect(failingRule.ok, failingRule.text).toBe(true);
    const failedRun = await api(owner, `/tenant/automations/rules/${failingRule.json.id}/run`, { method: 'POST', body: {}, key: `fail:${marker}` });
    await expect.poll(async () => (await api(owner, `/tenant/automations/runs/${failedRun.json.id}`)).json?.status, { timeout: 30_000 }).toBe('dead_letter');
    const enabledAdapter = await api(owner, '/tenant/doflow/performance/adapters/acceptance-synthetic', { method: 'PATCH', body: { enabled: true } });
    expect(enabledAdapter.ok, enabledAdapter.text).toBe(true);
    const retriedRun = await api(owner, `/tenant/automations/runs/${failedRun.json.id}/retry`, { method: 'POST', body: {}, key: `retry:${marker}` });
    expect(retriedRun.ok, retriedRun.text).toBe(true);
    await expect.poll(async () => (await api(owner, `/tenant/automations/runs/${retriedRun.json.id}`)).json?.status, { timeout: 30_000 }).toBe('success');

    const initialPerformance = await api(owner, '/tenant/doflow/performance'); expect(initialPerformance.ok, initialPerformance.text).toBe(true);
    const policy = initialPerformance.json.pointPolicy; const policyUpdate = await api(owner, '/tenant/doflow/performance/point-policy', { method: 'PATCH', body: { formula: policy, reason: 'Acceptance policy version' } });
    expect(policyUpdate.ok, policyUpdate.text).toBe(true); expect(policyUpdate.json.version).toBeGreaterThan(initialPerformance.json.policy.version);
    const adjustmentBody = { userId: 'a0000000-0000-4000-8000-000000000003', amount: 7, reason: 'Rettifica acceptance motivata' };
    const adjustment = await api(owner, '/tenant/doflow/performance/point-ledger/adjustments', { method: 'POST', body: adjustmentBody, key: adjustmentKey });
    const adjustmentAgain = await api(owner, '/tenant/doflow/performance/point-ledger/adjustments', { method: 'POST', body: adjustmentBody, key: adjustmentKey });
    expect(adjustment.ok, adjustment.text).toBe(true); expect(adjustmentAgain.json.id).toBe(adjustment.json.id);

    const month = String((await db.query(`SELECT to_char(month_value,'YYYY-MM') AS period
      FROM generate_series(date_trunc('month', now()) - interval '1 month', date_trunc('month', now()) - interval '24 months', interval '-1 month') month_value
      WHERE NOT EXISTS (SELECT 1 FROM doflow.ranking_snapshots s WHERE s.period=to_char(month_value,'YYYY-MM') AND s.role='developer')
      LIMIT 1`)).rows[0].period);
    const eventId = randomUUID();
    await db.query(`INSERT INTO doflow.point_ledger (user_id,policy_id,policy_version,event_type,source_record_type,operation_id,amount,state,effective_at,reason,metadata)
      SELECT $1,id,current_version,'qa_first_pass','task',$2,10,'approved',$3::date,'Acceptance business event','{}'::jsonb FROM doflow.point_policies WHERE status='active' ORDER BY valid_from DESC LIMIT 1`,
      ['a0000000-0000-4000-8000-000000000003', eventId, `${month}-15`]);
    const preview = await api(owner, `/tenant/doflow/performance/rankings/preview?period=${month}&role=developer`); expect(preview.ok, preview.text).toBe(true); expect(preview.json.rows.length).toBeGreaterThan(0);
    const snapshot = await api(owner, `/tenant/doflow/performance/rankings/${month}/developer/consolidate`, { method: 'POST', body: { reason: 'Consolidamento acceptance' } });
    expect(snapshot.ok, snapshot.text).toBe(true);
    const duplicateSnapshot = await api(owner, `/tenant/doflow/performance/rankings/${month}/developer/consolidate`, { method: 'POST', body: {} }); expect(duplicateSnapshot.status).toBe(409);
    const revoked = await api(owner, `/tenant/doflow/performance/rankings/snapshots/${snapshot.json.id}/revoke`, { method: 'POST', body: { reason: 'Revoca acceptance motivata' } }); expect(revoked.ok, revoked.text).toBe(true);

    const startsAt = `${month}-01T00:00:00.000Z`; const end = new Date(`${month}-01T00:00:00.000Z`); end.setUTCMonth(end.getUTCMonth() + 1);
    const goal = await api(owner, '/tenant/doflow/goals', { method: 'POST', body: { title: `${marker} Mission`, description: 'Obiettivo server', targetType: 'user', targetId: adjustmentBody.userId, metric: 'completed_activities', targetValue: 5, unit: 'number', startsAt, endsAt: end.toISOString(), status: 'active' } });
    expect(goal.ok, goal.text).toBe(true);

    const limitedState = await api(limited, '/tenant/doflow/performance'); expect(limitedState.ok, limitedState.text).toBe(true);
    expect(limitedState.json.pointLedger.every((entry: any) => entry.userId === adjustmentBody.userId)).toBe(true);
    expect(limitedState.json.goals.every((item: any) => item.targetId === adjustmentBody.userId)).toBe(true);
    expect(limitedState.json.pointPolicy).toBeNull(); expect(limitedState.json.policy).toBeNull(); expect(limitedState.json.adapters).toEqual([]);
    const limitedRules = await api(limited, '/tenant/automations/rules'); expect(limitedRules.status, limitedRules.text).toBe(200); expect(limitedRules.json.items.some((rule: any) => String(rule.name).includes('Deal sopra soglia'))).toBe(true);
    expect((await api(limited, '/tenant/automations/rules', { method: 'POST', body: { name: 'forbidden' } })).status).toBe(403);
    expect((await api(limited, `/tenant/automations/rules/${ruleId}`, { method: 'PATCH', body: { description: 'forbidden', optimistic_version: 2 } })).status).toBe(403);
    expect((await api(limited, `/tenant/automations/rules/${ruleId}`, { method: 'DELETE' })).status).toBe(403);
    expect((await api(limited, `/tenant/automations/rules/${ruleId}/disable`, { method: 'PATCH' })).status).toBe(403);
    expect((await api(limited, `/tenant/automations/rules/${ruleId}/enable`, { method: 'PATCH' })).status).toBe(403);
    expect((await api(limited, `/tenant/automations/rules/${ruleId}/run`, { method: 'POST', body: {}, key: randomUUID() })).status).toBe(403);
    expect((await api(limited, `/tenant/automations/runs/${failedRun.json.id}/retry`, { method: 'POST', body: {}, key: randomUUID() })).status).toBe(403);
    expect((await api(limited, '/tenant/doflow/performance/point-policy', { method: 'PATCH', body: { formula: policy, reason: 'forbidden' } })).status).toBe(403);
    expect((await api(limited, '/tenant/doflow/performance/point-ledger/adjustments', { method: 'POST', body: adjustmentBody, key: randomUUID() })).status).toBe(403);
    expect((await api(noView, '/tenant/automations/rules')).status).toBe(403);
    expect((await api(secondary, '/tenant/doflow/performance')).status).toBe(403);
    const crossRule = await api(secondary, `/tenant/automations/rules/${ruleId}`); expect([403, 404]).toContain(crossRule.status);

    await openAutomationDashboard(owner, marker);
    await mkdir(actualDir, { recursive: true });
    await owner.screenshot({ path: path.join(actualDir, 'phase4b-automations-1440x900-light.png') });
    await owner.goto('/automations/rules'); await expect(owner.getByRole('heading', { name: 'Automazioni' })).toBeVisible(); await expect(owner.getByText(marker).first()).toBeVisible();
    await owner.screenshot({ path: path.join(actualDir, 'phase4b-rules-1440x900-default.png') });
    await owner.goto(`/automations/rules/${ruleId}`); await expect(owner.getByRole('heading', { name: marker })).toBeVisible();
    await owner.screenshot({ path: path.join(actualDir, 'phase4b-rule-editor-1440x900-light.png') });
    await openAutomationDashboard(owner, marker);
    await owner.getByRole('tab', { name: 'Punti' }).click(); await expect(owner.getByText('Rettifica acceptance motivata').first()).toBeVisible();
    await owner.screenshot({ path: path.join(actualDir, 'phase4b-points-1440x900-light.png') });
    await expect(owner.locator('html[data-tenant-ui="universal"] [data-app-ui-generation="universal-v1"]')).toHaveCount(1); await expect(owner.locator('html')).not.toHaveClass(/dark/); await owner.getByRole('tab', { name: 'Classifiche' }).click(); await owner.getByRole('tab', { name: 'Sviluppatori' }).click();
    await expect(owner.getByText('Calcolo server in corso…')).toBeHidden({ timeout: 30_000 }); await expect(owner.getByText(new RegExp(`${month}.*revocata`))).toBeVisible();
    await owner.screenshot({ path: path.join(actualDir, 'phase4b-rankings-1440x900-default.png') });
    await owner.goto('/automations/runs'); await expect(owner.getByRole('heading', { name: 'Monitoraggio' })).toBeVisible(); await expect(owner.getByText('dead letter', { exact: false }).first()).toBeVisible();
    await owner.screenshot({ path: path.join(actualDir, 'phase4b-runs-1440x900-default.png') });
    await owner.goto(`/automations/runs/${failedRun.json.id}`); await expect(owner.getByRole('heading', { name: 'Dettaglio run' })).toBeVisible(); await expect(owner.getByRole('button', { name: 'Retry' })).toBeVisible();
    await owner.screenshot({ path: path.join(actualDir, 'phase4b-run-error-retry-1440x900-default.png') });
    await openAutomationDashboard(owner, marker);
    for (const viewport of [{ width: 768, height: 900 }, { width: 390, height: 900 }]) {
      await owner.setViewportSize(viewport); await owner.getByRole('tab', { name: 'Missione' }).click(); await expect(owner.getByText(`${marker} Mission`)).toBeVisible();
      await owner.screenshot({ path: path.join(actualDir, `phase4b-mission-${viewport.width}x${viewport.height}-default.png`) });
    }
    let limitedRulesGets = 0;
    limited.on('request', (request) => {
      if (request.method() === 'GET' && new URL(request.url()).pathname === '/api/tenant/automations/rules') limitedRulesGets += 1;
    });
    await limited.goto('/automations/rules'); await expect(limited.getByRole('heading', { name: 'Automazioni' })).toBeVisible(); await expect(limited.getByText('Deal sopra soglia', { exact: false }).first()).toBeVisible({ timeout: 30_000 }); await expect(limited.getByText(marker).first()).toBeVisible(); await expect(limited.getByRole('link', { name: 'Nuova automazione' })).toHaveCount(0); await expect(limited.locator('main').getByRole('button', { name: /^(Pausa|Attiva|Esegui test)$/ })).toHaveCount(0); expect(limitedForbiddenGets, `Unexpected limited-user GET 403 responses: ${limitedForbiddenGets.join(', ')}`).toEqual([]); await expect(limited.locator('main[data-secondary-status]')).toHaveAttribute('data-secondary-status', 'ready'); await expect(limited.getByText('Non disponi dei permessi per caricare questo workspace.')).toHaveCount(0); expect(limitedRulesGets).toBeGreaterThan(0);
    await limited.goto(`/automations/rules/${ruleId}`);
    await expect(limited.getByRole('heading', { name: new RegExp(marker) })).toBeVisible();
    await expect(limited.getByRole('button', { name: /Salva configurazione|Run|Retry/ })).toHaveCount(0);
    await limited.getByRole('tab', { name: 'Configurazione' }).click();
    const limitedConfiguration = limited.getByRole('tabpanel', { name: 'Configurazione' });
    await expect(limitedConfiguration.locator('input').first()).toBeDisabled();
    await expect(limitedConfiguration.locator('input:not([disabled]), textarea:not([disabled]), select:not([disabled])')).toHaveCount(0);
    await limited.goto('/automations/runs'); await expect(limited.getByRole('heading', { name: 'Accesso non autorizzato' })).toBeVisible(); await expect(limited.getByRole('button', { name: 'Retry' })).toHaveCount(0); await limited.goBack(); await expect(limited.getByRole('heading', { name: new RegExp(marker) })).toBeVisible();
    await noView.goto('about:blank');
    const noViewRuleGets: string[] = []; noView.on('request', (request) => { const pathname = new URL(request.url()).pathname; if (request.method() === 'GET' && pathname.startsWith('/api/tenant/automations/rules')) noViewRuleGets.push(pathname); });
    await noView.goto('/automations/rules'); await expect(noView.getByRole('heading', { name: 'Accesso non autorizzato' })).toBeVisible(); await expect(noView.getByRole('link', { name: 'Automazioni' })).toHaveCount(0); expect(noViewRuleGets, `Unexpected no-view rule requests: ${noViewRuleGets.join(', ')}`).toEqual([]);
    await limited.screenshot({ path: path.join(actualDir, 'phase4b-access-limited-1440x900-default.png') });

    restart('redis'); restart('frontend'); restart('backend');
    fresh = await browser.newContext(); const ownerFresh = await login(fresh, credentials.email, credentials, true);
    const persistedRule = await api(ownerFresh, `/tenant/automations/rules/${ruleId}`); expect(persistedRule.ok, persistedRule.text).toBe(true);
    const persisted = await api(ownerFresh, '/tenant/doflow/performance'); expect(persisted.json.pointLedger.some((entry: any) => entry.id === adjustment.json.id)).toBe(true);
    expect(persisted.json.rankingSnapshots.some((item: any) => item.id === snapshot.json.id && item.status === 'revoked')).toBe(true);

    const counts = (await db.query(`SELECT
      (SELECT COUNT(*) FROM doflow.automation_rules WHERE name LIKE $1) AS rules,
      (SELECT COUNT(*) FROM doflow.automation_runs WHERE rule_id=$2) AS runs,
      (SELECT COUNT(*) FROM doflow.automation_rule_versions WHERE rule_id=$2) AS versions,
      (SELECT COUNT(*) FROM doflow.automation_execution_registry WHERE run_id=$3) AS executions,
      (SELECT COUNT(*) FROM doflow.automation_dead_letters WHERE run_id=$4) AS dead_letters,
      (SELECT COUNT(*) FROM doflow.point_ledger WHERE id=$5) AS ledger,
      (SELECT COUNT(*) FROM doflow.ranking_snapshots WHERE id=$6) AS snapshots,
      (SELECT COUNT(*) FROM doflow.audit_log WHERE action IN ('point_policy_version_created','point_ledger_adjusted','ranking_consolidated')) AS audits`,
      [`%${marker}%`, ruleId, first.json.id, failedRun.json.id, adjustment.json.id, snapshot.json.id])).rows[0];
    expect(Number(counts.rules)).toBe(2); expect(Number(counts.runs)).toBe(1); expect(Number(counts.versions)).toBe(2);
    expect(Number(counts.executions)).toBeGreaterThanOrEqual(2); expect(Number(counts.dead_letters)).toBe(1); expect(Number(counts.ledger)).toBe(1); expect(Number(counts.snapshots)).toBe(1); expect(Number(counts.audits)).toBeGreaterThanOrEqual(3);
    await mkdir(path.dirname(resultPath), { recursive: true });
    expect(pageErrors).toEqual([]);
    const expectedOwnerConsoleErrors = ownerConsoleErrors.filter((message) =>
      message.includes('status of 409 (Conflict)')
      || (message.includes("WebSocket connection to 'ws://localhost:3401/ws' failed") && message.includes('ERR_CONNECTION_REFUSED')),
    );
    const unexpectedOwnerConsoleErrors = ownerConsoleErrors.filter((message) => !expectedOwnerConsoleErrors.includes(message));
    expect(unexpectedOwnerConsoleErrors).toEqual([]);
    expect(expectedOwnerConsoleErrors.filter((message) => message.includes('status of 409 (Conflict)'))).toHaveLength(2);
    await writeFile(resultPath, JSON.stringify({ marker, contextA: 'owner/MFA/persistence', contextB: 'own-only/redacted/forbidden mutations', contextC: 'tenant isolated', restarts: ['redis','frontend','backend'], pageErrors, expectedOwnerConsoleErrors, unexpectedOwnerConsoleErrors, counts }, null, 2));
  } finally {
    await contextA.close(); await contextB.close(); await contextC.close(); await contextD.close(); if (fresh) await fresh.close(); await db.end().catch(() => undefined);
  }
});
