import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const runtimeConfigPath = path.join(root, '.visual-runtime', 'commercial-core-stack.json');
const credentialPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const resultPath = path.join(root, '.visual-runtime', 'delivery-core-acceptance-result.json');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Client: PgClient } = backendRequire('pg');
const Redis = backendRequire('ioredis').default;

type RuntimeConfig = { databaseUrl: string; redisHost: string; redisPort: number };
type Credentials = { email: string; password: string; mfaSecret: string };
type AppResult = { status: number; ok: boolean; json: any; text: string };

async function login(context: BrowserContext, email: string, credentials: Credentials) {
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  await page.waitForURL(/\/dashboard$/);
  const cookies = await context.cookies();
  const session = cookies.find((cookie) => cookie.name === 'doflow_session');
  const csrf = cookies.find((cookie) => cookie.name === 'doflow_csrf');
  expect(session?.httpOnly).toBe(true);
  expect(csrf?.httpOnly).toBe(false);
  expect(await page.evaluate(() => localStorage.getItem('doflow_token'))).toBeNull();
  return { page, sessionValue: session!.value };
}

async function appFetch(
  page: Page,
  pathname: string,
  options: { method?: string; body?: unknown; headers?: Record<string, string> } = {},
): Promise<AppResult> {
  return page.evaluate(async ({ pathValue, request }) => {
    const method = request.method ?? 'GET';
    const csrf = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('doflow_csrf='))?.slice('doflow_csrf='.length);
    const headers: Record<string, string> = {
      ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }),
      ...(request.headers ?? {}),
    };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
    const response = await fetch(`/api${pathValue}`, {
      method, headers, credentials: 'include',
      body: request.body === undefined ? undefined : JSON.stringify(request.body),
    });
    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* status and text remain available */ }
    return { status: response.status, ok: response.ok, json, text };
  }, { pathValue: pathname, request: options });
}

const idem = () => randomUUID();
const write = (page: Page, pathname: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown, key = idem()) =>
  appFetch(page, pathname, { method, body, headers: { 'Idempotency-Key': key } });

function restart(service: 'frontend' | 'backend') {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/commercial-core-isolated-stack.mjs'), `restart-${service}`], {
    cwd: root, encoding: 'utf8', windowsHide: true,
  });
  if (result.status !== 0) throw new Error(`Unable to restart isolated ${service}: ${result.stderr || result.stdout}`);
}

async function workspace(page: Page, projectId: string) {
  const response = await appFetch(page, `/tenant/delivery/projects/${projectId}`);
  expect(response.ok, response.text).toBe(true);
  return response.json;
}

async function assertNoDeliveryStorage(page: Page) {
  const keys = await page.evaluate(() => Object.keys(localStorage).filter((key) => /project|task|timer|delivery|qa|work.?session/i.test(key)));
  expect(keys).toEqual([]);
  expect(await page.evaluate(() => localStorage.getItem('doflow_token'))).toBeNull();
}

test('Delivery Core resta PostgreSQL-authoritative fra utenti, restart e tenant isolati', async ({ browser }) => {
  const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8')) as RuntimeConfig;
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  expect(new URL(config.databaseUrl).hostname).toBe('localhost');

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  const contextDenied = await browser.newContext();
  const db = new PgClient({ connectionString: config.databaseUrl });
  const redis = new Redis({ host: config.redisHost, port: config.redisPort, lazyConnect: true });
  const marker = `DELIVERY-${Date.now()}`;

  try {
    await db.connect();
    await redis.connect();
    const executor = await login(contextA, 'visual.editor@acceptance.invalid', credentials);
    const supervisor = await login(contextB, 'visual.manager@acceptance.invalid', credentials);
    const secondary = await login(contextC, 'secondary.owner@acceptance.invalid', credentials);
    const denied = await login(contextDenied, 'visual.viewer@acceptance.invalid', credentials);
    expect(new Set([executor.sessionValue, supervisor.sessionValue, secondary.sessionValue, denied.sessionValue]).size).toBe(4);
    const pageA = executor.page;
    const pageB = supervisor.page;
    const pageC = secondary.page;
    const pageDenied = denied.page;

    const companyId = randomUUID();
    const opportunityId = randomUUID();
    await db.query(
      `INSERT INTO doflow.companies
         (id, name, status, source, owner_user_id, created_by, updated_by)
       VALUES ($1, $2, 'active_client', 'acceptance_fixture', $3, $3, $3)`,
      [companyId, `Cliente ${marker}`, 'a0000000-0000-4000-8000-000000000002'],
    );
    await db.query(
      `INSERT INTO doflow.opportunities
         (id, company_id, title, service_type, stage, assigned_to, created_by, updated_by)
       VALUES ($1, $2, $3, 'software', 'won', $4, $4, $4)`,
      [opportunityId, companyId, `Opportunità ${marker}`, 'a0000000-0000-4000-8000-000000000002'],
    );

    const sourceEventId = `acceptance:${marker}`;
    const projectBody = {
      name: `Progetto ${marker}`,
      description: 'Fixture sintetica Delivery Core',
      source_event_id: sourceEventId,
      company_id: companyId,
      opportunity_id: opportunityId,
      status: 'in_progress',
      priority: 'high',
      project_manager_id: 'a0000000-0000-4000-8000-000000000002',
      members: [
        { user_id: 'a0000000-0000-4000-8000-000000000003', role: 'developer', allocation_percent: 60, capacity_minutes_week: 1800 },
        { user_id: 'a0000000-0000-4000-8000-000000000002', role: 'supervisor', allocation_percent: 40, capacity_minutes_week: 1500 },
      ],
      phases: [{ key: 'delivery', title: 'Produzione', weight: 1, responsible_user_id: 'a0000000-0000-4000-8000-000000000002' }],
      tasks: [
        { key: 'build', phase_key: 'delivery', title: 'Sviluppo', status: 'in_progress', assignee_id: 'a0000000-0000-4000-8000-000000000003', estimated_minutes: 90, recurrence_rule: { frequency: 'weekly', interval: 1 } },
        { key: 'qa', phase_key: 'delivery', title: 'Verifica', status: 'ready', assignee_id: 'a0000000-0000-4000-8000-000000000003', estimated_minutes: 45, due_at: '2026-09-01T12:00:00.000Z' },
      ],
      dependencies: [{ predecessor_key: 'build', successor_key: 'qa' }],
    };
    const createKey = idem();
    const created = await write(pageB, '/tenant/delivery/projects', 'POST', projectBody, createKey);
    expect(created.ok, created.text).toBe(true);
    const projectId = created.json.project.id as string;
    const repeatedCreate = await write(pageB, '/tenant/delivery/projects', 'POST', projectBody, createKey);
    expect(repeatedCreate.ok).toBe(true);
    expect(repeatedCreate.json.project.id).toBe(projectId);
    const sourceDeduplicated = await write(pageB, '/tenant/delivery/projects', 'POST', projectBody);
    expect(sourceDeduplicated.ok).toBe(true);
    expect(sourceDeduplicated.json.project.id).toBe(projectId);
    expect(sourceDeduplicated.json.unchanged).toBe(true);

    let view = await workspace(pageA, projectId);
    expect(view.tasks).toHaveLength(2);
    expect(view.members.some((member: any) => member.user_id === 'a0000000-0000-4000-8000-000000000003')).toBe(true);
    const phaseId = view.phases[0].id as string;
    const buildTaskId = view.tasks.find((task: any) => task.title === 'Sviluppo').id as string;
    const qaTaskId = view.tasks.find((task: any) => task.title === 'Verifica').id as string;

    const listA = await appFetch(pageA, '/tenant/delivery/projects');
    expect(listA.ok).toBe(true);
    expect(listA.json.items.some((project: any) => project.id === projectId)).toBe(true);
    const dependencyDuplicate = await write(pageB, `/tenant/delivery/projects/${projectId}/dependencies`, 'POST', { predecessor_task_id: buildTaskId, successor_task_id: qaTaskId });
    expect(dependencyDuplicate.ok).toBe(true);
    expect(dependencyDuplicate.json.unchanged).toBe(true);
    const directCycle = await write(pageB, `/tenant/delivery/projects/${projectId}/dependencies`, 'POST', { predecessor_task_id: qaTaskId, successor_task_id: buildTaskId });
    expect(directCycle.status).toBe(409);
    const selfDependency = await write(pageB, `/tenant/delivery/projects/${projectId}/dependencies`, 'POST', { predecessor_task_id: qaTaskId, successor_task_id: qaTaskId });
    expect(selfDependency.status).toBe(400);

    const checklist = await write(pageB, `/tenant/delivery/projects/${projectId}/tasks/${buildTaskId}/checklist`, 'POST', { title: 'Controllo obbligatorio', required: true });
    expect(checklist.ok).toBe(true);
    view = await workspace(pageA, projectId);
    const buildBeforeTimer = view.tasks.find((task: any) => task.id === buildTaskId);
    expect(buildBeforeTimer.checklist).toHaveLength(1);

    const blockedByDependency = await write(pageA, `/tenant/delivery/projects/${projectId}/tasks/${qaTaskId}/status`, 'PATCH', { version: view.tasks.find((task: any) => task.id === qaTaskId).version, status: 'done' });
    expect(blockedByDependency.status).toBe(409);
    const blockedByChecklist = await write(pageA, `/tenant/delivery/projects/${projectId}/tasks/${buildTaskId}/status`, 'PATCH', { version: buildBeforeTimer.version, status: 'done' });
    expect(blockedByChecklist.status).toBe(409);

    const timerKey = idem();
    const timerBody = { project_id: projectId, task_id: buildTaskId };
    const timer = await write(pageA, '/tenant/delivery/timers/start', 'POST', timerBody, timerKey);
    expect(timer.ok, timer.text).toBe(true);
    const timerId = timer.json.item.id as string;
    const timerRepeat = await write(pageA, '/tenant/delivery/timers/start', 'POST', timerBody, timerKey);
    expect(timerRepeat.json.item.id).toBe(timerId);
    const secondTimer = await write(pageA, '/tenant/delivery/timers/start', 'POST', { project_id: projectId, task_id: qaTaskId });
    expect(secondTimer.status).toBe(409);
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    expect((await appFetch(pageA, '/tenant/delivery/timers/active')).json.item.id).toBe(timerId);
    restart('backend');
    expect((await appFetch(pageA, '/tenant/delivery/timers/active')).json.item.id).toBe(timerId);
    const stopKey = idem();
    const stopBody = { version: timer.json.item.version, stop_key: `stop:${timerId}:acceptance`, description: 'Sessione sintetica' };
    const stopped = await write(pageA, `/tenant/delivery/timers/${timerId}/stop`, 'POST', stopBody, stopKey);
    expect(stopped.ok, stopped.text).toBe(true);
    const stoppedRepeat = await write(pageA, `/tenant/delivery/timers/${timerId}/stop`, 'POST', stopBody, stopKey);
    expect(stoppedRepeat.json.item.id).toBe(timerId);
    expect((await appFetch(pageA, '/tenant/delivery/timers/active')).json.item).toBeNull();

    const checklistDone = await write(pageA, `/tenant/delivery/projects/${projectId}/tasks/${buildTaskId}/checklist/${checklist.json.item.id}`, 'PATCH', { version: checklist.json.item.version, is_done: true });
    expect(checklistDone.ok, checklistDone.text).toBe(true);
    view = await workspace(pageA, projectId);
    const build = view.tasks.find((task: any) => task.id === buildTaskId);
    const completeKey = idem();
    const completeBody = { version: build.version, status: 'done' };
    const completedBuild = await write(pageA, `/tenant/delivery/projects/${projectId}/tasks/${buildTaskId}/status`, 'PATCH', completeBody, completeKey);
    expect(completedBuild.ok).toBe(true);
    expect((await write(pageA, `/tenant/delivery/projects/${projectId}/tasks/${buildTaskId}/status`, 'PATCH', completeBody, completeKey)).json.item.id).toBe(buildTaskId);
    const recurrence = await write(pageB, `/tenant/delivery/projects/${projectId}/tasks/${buildTaskId}/recurrence`, 'POST', { version: completedBuild.json.item.version });
    expect(recurrence.ok, recurrence.text).toBe(true);
    const recurrenceId = recurrence.json.item.id as string;
    const archivedRecurrence = await write(pageB, `/tenant/delivery/projects/${projectId}/tasks/${recurrenceId}`, 'DELETE', { version: recurrence.json.item.version, reason: 'Chiusura fixture ricorrenza' });
    expect(archivedRecurrence.ok).toBe(true);

    view = await workspace(pageB, projectId);
    const qaBeforeDue = view.tasks.find((task: any) => task.id === qaTaskId);
    const dueUpdate = await write(pageB, `/tenant/delivery/projects/${projectId}/tasks/${qaTaskId}`, 'PATCH', { version: qaBeforeDue.version, due_at: '2026-09-02T12:00:00.000Z', reason: 'Ricalendarizzazione acceptance' });
    expect(dueUpdate.ok, dueUpdate.text).toBe(true);
    const staleTask = await write(pageA, `/tenant/delivery/projects/${projectId}/tasks/${qaTaskId}`, 'PATCH', { version: qaBeforeDue.version, description: 'Scrittura obsoleta' });
    expect(staleTask.status).toBe(409);
    view = await workspace(pageA, projectId);
    const qaTask = view.tasks.find((task: any) => task.id === qaTaskId);
    expect(qaTask.due_date_history).toHaveLength(1);
    const completedQaTask = await write(pageA, `/tenant/delivery/projects/${projectId}/tasks/${qaTaskId}/status`, 'PATCH', { version: qaTask.version, status: 'done' });
    expect(completedQaTask.ok, completedQaTask.text).toBe(true);

    view = await workspace(pageA, projectId);
    const submitKey = idem();
    const submitBody = { version: view.project.version, task_id: qaTaskId };
    const submitted = await write(pageA, `/tenant/delivery/projects/${projectId}/qa/submit`, 'POST', submitBody, submitKey);
    expect(submitted.ok, submitted.text).toBe(true);
    expect((await write(pageA, `/tenant/delivery/projects/${projectId}/qa/submit`, 'POST', submitBody, submitKey)).json.item.id).toBe(qaTaskId);
    view = await workspace(pageA, projectId);
    const selfApprove = await write(pageA, `/tenant/delivery/projects/${projectId}/qa/approve`, 'POST', { version: view.project.version, task_id: qaTaskId, note: 'Tentativo auto-approvazione' });
    expect(selfApprove.status).toBe(403);

    view = await workspace(pageB, projectId);
    const changesKey = idem();
    const changesBody = { version: view.project.version, task_id: qaTaskId, note: 'Correggere la verifica sintetica' };
    const changes = await write(pageB, `/tenant/delivery/projects/${projectId}/qa/changes`, 'POST', changesBody, changesKey);
    expect(changes.ok, changes.text).toBe(true);
    expect((await write(pageB, `/tenant/delivery/projects/${projectId}/qa/changes`, 'POST', changesBody, changesKey)).json.item.id).toBe(qaTaskId);
    view = await workspace(pageA, projectId);
    expect(view.project.status).toBe('changes_requested');
    const reopenedQa = view.tasks.find((task: any) => task.id === qaTaskId);
    const reCompleted = await write(pageA, `/tenant/delivery/projects/${projectId}/tasks/${qaTaskId}/status`, 'PATCH', { version: reopenedQa.version, status: 'done' });
    expect(reCompleted.ok).toBe(true);
    view = await workspace(pageA, projectId);
    const resubmitted = await write(pageA, `/tenant/delivery/projects/${projectId}/qa/submit`, 'POST', { version: view.project.version, task_id: qaTaskId });
    expect(resubmitted.ok, resubmitted.text).toBe(true);

    view = await workspace(pageB, projectId);
    for (const item of view.qa) {
      const updated = await write(pageB, `/tenant/delivery/projects/${projectId}/qa/items/${item.id}`, 'PATCH', { version: item.version, completed: true, comment: 'Verificato in acceptance' });
      expect(updated.ok, updated.text).toBe(true);
    }
    view = await workspace(pageB, projectId);
    const approveKey = idem();
    const approveBody = { version: view.project.version, task_id: qaTaskId, note: 'QA acceptance approvata' };
    const approved = await write(pageB, `/tenant/delivery/projects/${projectId}/qa/approve`, 'POST', approveBody, approveKey);
    expect(approved.ok, approved.text).toBe(true);
    expect((await write(pageB, `/tenant/delivery/projects/${projectId}/qa/approve`, 'POST', approveBody, approveKey)).json.item.id).toBe(qaTaskId);

    view = await workspace(pageB, projectId);
    const phase = view.phases.find((item: any) => item.id === phaseId);
    expect((await write(pageB, `/tenant/delivery/projects/${projectId}/phases/${phaseId}`, 'PATCH', { version: phase.version, status: 'completed', reason: 'Fase completata' })).ok).toBe(true);
    for (const next of ['ready_client', 'ready_publish']) {
      view = await workspace(pageB, projectId);
      const transition = await write(pageB, `/tenant/delivery/projects/${projectId}/status`, 'PATCH', { version: view.project.version, status: next });
      expect(transition.ok, transition.text).toBe(true);
    }
    view = await workspace(pageB, projectId);
    const publishKey = idem();
    const publishBody = { version: view.project.version, notes: 'Pubblicazione interna acceptance' };
    const published = await write(pageB, `/tenant/delivery/projects/${projectId}/publish`, 'POST', publishBody, publishKey);
    expect(published.ok, published.text).toBe(true);
    expect((await write(pageB, `/tenant/delivery/projects/${projectId}/publish`, 'POST', publishBody, publishKey)).json.item.id).toBe(projectId);
    view = await workspace(pageB, projectId);
    const deliverKey = idem();
    const deliverBody = { version: view.project.version, notes: 'Consegna acceptance' };
    const delivered = await write(pageB, `/tenant/delivery/projects/${projectId}/deliver`, 'POST', deliverBody, deliverKey);
    expect(delivered.ok, delivered.text).toBe(true);
    expect((await write(pageB, `/tenant/delivery/projects/${projectId}/deliver`, 'POST', deliverBody, deliverKey)).json.item.id).toBe(projectId);
    view = await workspace(pageB, projectId);
    const support = await write(pageB, `/tenant/delivery/projects/${projectId}/support`, 'POST', { version: view.project.version, reason: 'Avvio supporto acceptance' });
    expect(support.ok, support.text).toBe(true);

    const comment = await write(pageA, `/tenant/delivery/projects/${projectId}/comments`, 'POST', { body: 'Commento persistente sintetico', task_id: qaTaskId, visibility: 'internal' });
    expect(comment.ok, comment.text).toBe(true);
    const history = await appFetch(pageA, `/tenant/delivery/projects/${projectId}/history`);
    expect(history.ok).toBe(true);
    expect(history.json.items.some((item: any) => item.event_type === 'qa_approved')).toBe(true);
    const workload = await appFetch(pageB, '/tenant/delivery/workload');
    expect(workload.ok).toBe(true);
    expect(workload.json.items.some((item: any) => item.user_id === 'a0000000-0000-4000-8000-000000000003')).toBe(true);

    expect((await appFetch(pageA, '/tenant/commercial/site-proposals?limit=1')).status).toBe(404);

    // Same-version writes from two authenticated sessions: exactly one wins.
    view = await workspace(pageA, projectId);
    const concurrentTask = view.tasks.find((task: any) => task.id === qaTaskId);
    const concurrent = await Promise.all([
      write(pageA, `/tenant/delivery/projects/${projectId}/tasks/${qaTaskId}`, 'PATCH', { version: concurrentTask.version, description: 'Scrittura concorrente A' }),
      write(pageB, `/tenant/delivery/projects/${projectId}/tasks/${qaTaskId}`, 'PATCH', { version: concurrentTask.version, description: 'Scrittura concorrente B' }),
    ]);
    expect(concurrent.filter((result) => result.ok)).toHaveLength(1);
    expect(concurrent.filter((result) => result.status === 409)).toHaveLength(1);

    restart('frontend');
    await pageA.reload({ waitUntil: 'domcontentloaded' });
    view = await workspace(pageA, projectId);
    expect(view.project.status).toBe('support');
    expect(view.publications).toHaveLength(1);

    const secondaryList = await appFetch(pageC, '/tenant/delivery/projects?tenant=doflow', { headers: { 'x-doflow-tenant-id': 'doflow' } });
    expect(secondaryList.ok).toBe(true);
    expect(secondaryList.json.items.some((project: any) => project.id === projectId)).toBe(false);
    const crossRead = await appFetch(pageC, `/tenant/delivery/projects/${projectId}?tenant=doflow`, { headers: { 'x-doflow-tenant-id': 'doflow' } });
    expect([403, 404]).toContain(crossRead.status);
    expect((await appFetch(pageC, '/tenant/delivery/timers/active')).json.item).toBeNull();

    await Promise.all([assertNoDeliveryStorage(pageA), assertNoDeliveryStorage(pageB), assertNoDeliveryStorage(pageC), assertNoDeliveryStorage(pageDenied)]);
    const sessionKeys = (await redis.keys('doflow:web-session:*')).filter((key: string) => !key.startsWith('doflow:web-session-user:'));
    const ttls = await Promise.all(sessionKeys.map((key: string) => redis.ttl(key)));
    expect(sessionKeys.length).toBeGreaterThanOrEqual(4);
    expect(ttls.every((ttl: number) => ttl > 0)).toBe(true);

    const counts = await db.query(
      `SELECT
        (SELECT count(*)::int FROM doflow.projects WHERE id=$1) project_count,
        (SELECT count(*)::int FROM doflow.tasks WHERE project_id=$1 AND deleted_at IS NULL) active_tasks,
        (SELECT count(*)::int FROM doflow.delivery_time_sessions WHERE project_id=$1 AND status='completed') completed_timers,
        (SELECT count(*)::int FROM doflow.project_workflow_events WHERE project_id=$1) workflow_events,
        (SELECT count(*)::int FROM doflow.audit_log WHERE target=$1::text) audit_events,
        (SELECT count(*)::int FROM doflow.delivery_outbox WHERE aggregate_id=$1) outbox_events,
        (SELECT count(*)::int FROM doflow.notifications WHERE entity_id=$1) notifications,
        (SELECT count(*)::int FROM doflow.project_publications WHERE project_id=$1) publications,
        (SELECT count(*)::int FROM doflow.project_comments WHERE project_id=$1) comments,
        (SELECT count(*)::int FROM doflow.delivery_idempotency WHERE status='completed' AND response::text LIKE $2) idempotency_rows,
        (SELECT count(*)::int FROM acceptance_secondary.projects WHERE id=$1) leaked_project,
        (SELECT count(*)::int FROM acceptance_secondary.notifications WHERE entity_id=$1) leaked_notifications`,
      [projectId, `%${projectId}%`],
    );
    expect(counts.rows[0]).toMatchObject({
      project_count: 1, active_tasks: 2, completed_timers: 1, publications: 1, comments: 1,
      leaked_project: 0, leaked_notifications: 0,
    });
    expect(counts.rows[0].workflow_events).toBeGreaterThan(20);
    expect(counts.rows[0].audit_events).toBe(counts.rows[0].workflow_events);
    expect(counts.rows[0].outbox_events).toBeGreaterThanOrEqual(counts.rows[0].workflow_events);
    expect(counts.rows[0].notifications).toBeGreaterThan(0);
    expect(counts.rows[0].idempotency_rows).toBeGreaterThan(20);

    await writeFile(resultPath, JSON.stringify({
      marker, projectId, postgres: counts.rows[0], redis: { sessions: sessionKeys.length, ttlPositive: true },
      refresh: true, frontendRestart: true, backendRestartWithActiveTimer: true,
      projectIdempotent: true, timerIdempotent: true, qaIdempotent: true,
      optimisticConflict: true, selfApprovalDenied: true, crossTenantIsolated: true,
      builderExtracted: true,
      localStorageAuthoritativeCollections: 0,
    }, null, 2));
  } finally {
    redis.disconnect();
    await db.end().catch(() => undefined);
    await Promise.all([contextA.close(), contextB.close(), contextC.close(), contextDenied.close()].map((promise) => promise.catch(() => undefined)));
  }
});
