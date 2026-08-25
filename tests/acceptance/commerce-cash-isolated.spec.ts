import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createHash, createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const runtimeConfigPath = path.join(root, '.visual-runtime', 'commercial-core-stack.json');
const credentialPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const resultPath = path.join(root, '.visual-runtime', 'commerce-cash-acceptance-result.json');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Client: PgClient } = backendRequire('pg');
const Redis = backendRequire('ioredis').default;

type Credentials = { email: string; password: string; mfaSecret: string };
type AppResult = { status: number; ok: boolean; json: any; text: string };

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/=+$/g, '');
  let bits = '';
  for (const character of normalized) bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  return Buffer.from(bytes);
}

function totp(secret: string) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

async function stableTotp(page: Page, secret: string) {
  const remaining = 30_000 - (Date.now() % 30_000);
  if (remaining < 5_000) await page.waitForTimeout(remaining + 150);
  return totp(secret);
}

async function login(context: BrowserContext, email: string, credentials: Credentials, withMfa = false) {
  const page = await context.newPage();
  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Accedi', exact: true }).click();
  if (withMfa) {
    await page.waitForURL(/\/doflow\/mfa$/);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page.getByLabel('Codice di verifica a 6 cifre').fill(await stableTotp(page, credentials.mfaSecret));
      await page.getByRole('button', { name: 'Verifica Codice' }).click();
      try {
        await page.waitForURL(/\/dashboard$/, { timeout: 5_000 });
        break;
      } catch (error) {
        if (attempt === 1) throw error;
      }
    }
  }
  await page.waitForURL(/\/dashboard$/);
  const cookies = await context.cookies();
  const session = cookies.find((cookie) => cookie.name === 'doflow_session');
  expect(session?.httpOnly).toBe(true);
  return { page, sessionId: session!.value };
}

async function appFetch(page: Page, pathname: string, options: { method?: string; body?: unknown; headers?: Record<string, string> } = {}): Promise<AppResult> {
  return page.evaluate(async ({ pathValue, request }) => {
    const method = request.method ?? 'GET';
    const csrf = document.cookie.split(';').map((part) => part.trim()).find((part) => part.startsWith('doflow_csrf='))?.slice('doflow_csrf='.length);
    const headers: Record<string, string> = { ...(request.body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(request.headers ?? {}) };
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method.toUpperCase()) && csrf) headers['X-CSRF-Token'] = decodeURIComponent(csrf);
    const response = await fetch(`/api${pathValue}`, { method, headers, credentials: 'include', body: request.body === undefined ? undefined : JSON.stringify(request.body) });
    const text = await response.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { /* status and body retained */ }
    return { status: response.status, ok: response.ok, json, text };
  }, { pathValue: pathname, request: options });
}

const write = (page: Page, pathname: string, method: 'POST' | 'PATCH' | 'DELETE', body: unknown, key = randomUUID()) =>
  appFetch(page, pathname, { method, body, headers: { 'Idempotency-Key': key } });

function restart(service: 'frontend' | 'backend') {
  const result = spawnSync(process.execPath, [path.join(root, 'scripts/commercial-core-isolated-stack.mjs'), `restart-${service}`], { cwd: root, encoding: 'utf8', windowsHide: true });
  if (result.status !== 0) throw new Error(`Unable to restart isolated ${service}: ${result.stderr || result.stdout}`);
}

test('Commerce & Cash Core è PostgreSQL-authoritative, idempotente e isolato', async ({ browser }) => {
  const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8')) as { databaseUrl: string; redisHost: string; redisPort: number };
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  expect(new URL(config.databaseUrl).hostname).toBe('localhost');

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextDenied = await browser.newContext();
  const contextC = await browser.newContext();
  let contextA2: BrowserContext | undefined;
  const db = new PgClient({ connectionString: config.databaseUrl });
  const redis = new Redis({ host: config.redisHost, port: config.redisPort, lazyConnect: true });
  const marker = `CASH-${Date.now()}`;
  const companyId = randomUUID();
  const opportunityId = randomUUID();

  try {
    await db.connect();
    await redis.connect();
    await db.query(`INSERT INTO doflow.companies (id, name, status, source, owner_user_id, created_by, updated_by) VALUES ($1,$2,'active_client','acceptance_fixture',$3,$3,$3)`, [companyId, `Cliente ${marker}`, 'a0000000-0000-4000-8000-000000000001']);
    await db.query(`INSERT INTO doflow.opportunities (id, company_id, title, service_type, stage, assigned_to, created_by, updated_by) VALUES ($1,$2,$3,'software','won',$4,$4,$4)`, [opportunityId, companyId, `Opportunità ${marker}`, 'a0000000-0000-4000-8000-000000000001']);

    const owner = await login(contextA, credentials.email, credentials, true);
    const manager = await login(contextB, 'visual.manager@acceptance.invalid', credentials);
    const denied = await login(contextDenied, 'visual.viewer@acceptance.invalid', credentials);
    const secondary = await login(contextC, 'secondary.owner@acceptance.invalid', credentials);
    expect(new Set([owner.sessionId, manager.sessionId, denied.sessionId, secondary.sessionId]).size).toBe(4);
    const pageA = owner.page;

    const category = await write(pageA, '/tenant/doflow/commerce/categories', 'POST', { name: `Categoria ${marker}`, description: 'Fixture sintetica', sortOrder: 7 });
    expect(category.ok, category.text).toBe(true);
    const serviceBody = {
      name: `Servizio ${marker}`, category: 'Software', categoryId: category.json.id,
      description: 'Descrizione snapshot originale', price: 800, currency: 'EUR', unit: 'progetto', taxRate: 22,
      billingType: 'mixed', status: 'active', availability: 'available', deposit: 1000, balance: 1305.8, installments: 2,
      projectTemplate: { name: `Template ${marker}`, projectType: 'software', phases: ['Analisi', 'Delivery', 'QA'] },
      promotions: [{ name: 'Promo acceptance', kind: 'percentage', value: 10, active: true, combinable: false }],
      extras: [{ name: 'Extra acceptance', price: 50, active: true }],
      billingPlans: [{ name: 'Piano annuale', description: 'Piano sintetico', oneTimePrice: 900, recurringPrice: 100, recurrence: 'annual', renewal: 'optional', included: ['Setup'], active: true }],
    };
    const service = await write(pageA, '/tenant/doflow/commerce/services', 'POST', serviceBody);
    expect(service.ok, service.text).toBe(true);
    const planId = service.json.billing_plans[0].id;
    const promotionId = service.json.promotions[0].id;
    const extraId = service.json.extras[0].id;

    const sale = await write(pageA, '/tenant/doflow/commerce/sales', 'POST', {
      customerId: companyId, leadId: opportunityId, opportunityId, serviceId: service.json.id,
      salespersonId: 'a0000000-0000-4000-8000-000000000002',
      origin: 'Commerciale', value: 2305.8, cost: 100, currency: 'EUR', date: '2026-08-22',
      status: 'Vinta', dealId: `DEAL-${marker}`, notes: 'Vendita acceptance',
    });
    expect(sale.ok, sale.text).toBe(true);

    const orderBody = {
      customerId: companyId, saleId: sale.json.id, leadId: opportunityId, opportunityId,
      salespersonId: 'a0000000-0000-4000-8000-000000000002',
      dealId: `DEAL-${marker}`, items: [{ serviceId: service.json.id, planId, promotionId, extraIds: [extraId], quantity: 2 }],
      deposit: 1000, installments: 2, administrativeStatus: 'Confermato', orderDate: '2026-08-22', dueDate: '2026-09-22', notes: 'Ordine acceptance',
    };
    const orderKey = randomUUID();
    const order = await write(pageA, '/tenant/doflow/commerce/orders', 'POST', orderBody, orderKey);
    expect(order.ok, order.text).toBe(true);
    expect(Number(order.json.total)).toBe(2305.8);
    expect(Number(order.json.tax_total)).toBe(415.8);
    expect(order.json.code).toMatch(/^DF-\d+$/);
    const repeatedOrder = await write(pageA, '/tenant/doflow/commerce/orders', 'POST', orderBody, orderKey);
    expect(repeatedOrder.ok).toBe(true);
    expect(repeatedOrder.json.id).toBe(order.json.id);
    expect((await db.query(`SELECT COUNT(*)::int AS count FROM doflow.orders WHERE idempotency_key = $1`, [orderKey])).rows[0].count).toBe(1);

    const forbiddenBrowserTotals = await write(pageA, '/tenant/doflow/commerce/orders', 'POST', { ...orderBody, total: 1 }, randomUUID());
    expect(forbiddenBrowserTotals.status).toBe(400);
    const zeroQuantity = await write(pageA, '/tenant/doflow/commerce/orders', 'POST', { ...orderBody, items: [{ serviceId: service.json.id, quantity: 0 }] });
    expect(zeroQuantity.status).toBe(400);
    const negativePrice = await write(pageA, '/tenant/doflow/commerce/services', 'POST', { ...serviceBody, name: `Negativo ${marker}`, price: -1 });
    expect(negativePrice.status).toBe(400);

    const updateService = await write(pageA, `/tenant/doflow/commerce/services/${service.json.id}`, 'PATCH', { version: service.json.version, price: 9999, taxRate: 5, description: 'Catalogo modificato dopo ordine' });
    expect(updateService.ok, updateService.text).toBe(true);
    const snapshot = await appFetch(pageA, `/tenant/doflow/commerce/orders/${order.json.id}`);
    expect(snapshot.json.items[0]).toMatchObject({ service_description_snapshot: 'Descrizione snapshot originale', tax_rate_snapshot: '22.0000', catalog_version_snapshot: '1' });
    expect(Number(snapshot.json.items[0].unit_price_snapshot)).toBe(1050);
    expect(Number(snapshot.json.total)).toBe(2305.8);
    expect((await write(pageA, `/tenant/doflow/commerce/services/${service.json.id}`, 'DELETE', { version: updateService.json.version })).ok).toBe(true);
    expect(Number((await appFetch(pageA, `/tenant/doflow/commerce/orders/${order.json.id}`)).json.total)).toBe(2305.8);

    const projectKey = randomUUID();
    const project = await write(pageA, `/tenant/doflow/commerce/orders/${order.json.id}/project`, 'POST', {}, projectKey);
    expect(project.ok, project.text).toBe(true);
    const repeatedProject = await write(pageA, `/tenant/doflow/commerce/orders/${order.json.id}/project`, 'POST', {}, projectKey);
    expect(repeatedProject.json.projectId).toBe(project.json.projectId);
    const differentKeyProject = await write(pageA, `/tenant/doflow/commerce/orders/${order.json.id}/project`, 'POST', {}, randomUUID());
    expect(differentKeyProject.json).toMatchObject({ projectId: project.json.projectId, existing: true });
    expect((await db.query(`SELECT COUNT(*)::int AS count FROM doflow.projects WHERE order_id = $1`, [order.json.id])).rows[0].count).toBe(1);

    const depositKey = randomUUID();
    const deposit = await write(pageA, '/tenant/doflow/commerce/payments', 'POST', { orderId: order.json.id, amount: 1000, effectiveDate: '2026-08-22', method: 'Bonifico', reference: `DEP-${marker}`, status: 'confirmed', notes: 'Acconto' }, depositKey);
    expect(deposit.ok, deposit.text).toBe(true);
    const repeatedDeposit = await write(pageA, '/tenant/doflow/commerce/payments', 'POST', { orderId: order.json.id, amount: 1000, effectiveDate: '2026-08-22', method: 'Bonifico', reference: `DEP-${marker}`, status: 'confirmed', notes: 'Acconto' }, depositKey);
    expect(repeatedDeposit.json.payment.id).toBe(deposit.json.payment.id);
    const afterDeposit = await appFetch(pageA, `/tenant/doflow/commerce/orders/${order.json.id}`);
    expect(Number(afterDeposit.json.net_collected)).toBe(1000);
    expect(Number(afterDeposit.json.residual)).toBe(1305.8);

    const concurrent = await Promise.all([
      write(pageA, '/tenant/doflow/commerce/payments', 'POST', { orderId: order.json.id, amount: 1305.8, effectiveDate: '2026-08-23', method: 'Carta', reference: `BAL-A-${marker}`, status: 'confirmed' }),
      write(pageA, '/tenant/doflow/commerce/payments', 'POST', { orderId: order.json.id, amount: 1305.8, effectiveDate: '2026-08-23', method: 'Carta', reference: `BAL-B-${marker}`, status: 'confirmed' }),
    ]);
    expect(concurrent.filter((result) => result.ok)).toHaveLength(1);
    expect(concurrent.filter((result) => !result.ok)).toHaveLength(1);
    const balance = concurrent.find((result) => result.ok)!;
    const paidOrder = await appFetch(pageA, `/tenant/doflow/commerce/orders/${order.json.id}`);
    expect(paidOrder.json.payment_status).toBe('paid');
    expect(Number(paidOrder.json.residual)).toBe(0);

    const refund = await write(pageA, '/tenant/doflow/commerce/refunds', 'POST', { originalPaymentId: balance.json.payment.id, amount: 200, effectiveDate: '2026-08-24', method: 'Carta', reference: `REF-${marker}`, status: 'confirmed', refundReason: 'Rimborso parziale acceptance' });
    expect(refund.ok, refund.text).toBe(true);
    const refundedOrder = await appFetch(pageA, `/tenant/doflow/commerce/orders/${order.json.id}`);
    expect(Number(refundedOrder.json.refunded_total)).toBe(200);
    expect(Number(refundedOrder.json.net_collected)).toBe(2105.8);
    expect(Number(refundedOrder.json.residual)).toBe(200);
    expect(refundedOrder.json.payment_status).toBe('refunded_partial');
    const overRefund = await write(pageA, '/tenant/doflow/commerce/refunds', 'POST', { originalPaymentId: balance.json.payment.id, amount: 9999, reference: `OVER-${marker}`, status: 'confirmed', refundReason: 'Non valido' });
    expect(overRefund.ok).toBe(false);
    const zeroPayment = await write(pageA, '/tenant/doflow/commerce/payments', 'POST', { orderId: order.json.id, amount: 0, reference: `ZERO-${marker}`, status: 'confirmed' });
    expect(zeroPayment.status).toBe(400);
    const wrongCurrency = await write(pageA, '/tenant/doflow/commerce/payments', 'POST', { orderId: order.json.id, amount: 1, currency: 'USD', reference: `CUR-${marker}`, status: 'confirmed' });
    expect(wrongCurrency.status).toBe(400);

    const managerOrders = await appFetch(manager.page, '/tenant/doflow/commerce/orders');
    expect(managerOrders.ok).toBe(true);
    expect(managerOrders.json.items.some((item: any) => item.id === order.json.id)).toBe(true);
    const managerEconomics = await appFetch(manager.page, '/tenant/doflow/commerce/economics/summary');
    expect(managerEconomics.ok).toBe(true);
    expect(Number(managerEconomics.json.net_collected)).toBeGreaterThan(0);

    for (const pathValue of ['/tenant/doflow/commerce/services', '/tenant/doflow/commerce/orders', '/tenant/doflow/commerce/payments', '/tenant/doflow/commerce/economics/summary']) {
      const response = await appFetch(denied.page, pathValue);
      expect(response.status).toBe(403);
      expect(response.text).not.toContain('2305.8');
    }
    expect((await write(denied.page, '/tenant/doflow/commerce/payments', 'POST', { orderId: order.json.id, amount: 1, reference: 'DENIED', status: 'confirmed' })).status).toBe(403);
    expect((await write(denied.page, `/tenant/doflow/commerce/orders/${order.json.id}/project`, 'POST', {})).status).toBe(403);

    for (const pathValue of ['/tenant/doflow/commerce/services?tenant=doflow', `/tenant/doflow/commerce/orders/${order.json.id}?tenant=doflow`, '/tenant/doflow/commerce/payments']) {
      const response = await appFetch(secondary.page, pathValue, { headers: { 'x-doflow-tenant-id': 'doflow' } });
      expect(response.status).toBe(403);
      expect(response.text).not.toContain('"company_id"');
      expect(response.text).not.toContain('"total"');
      expect(response.text).not.toContain('2305.8');
    }
    expect((await write(secondary.page, '/tenant/doflow/commerce/orders', 'POST', { ...orderBody, tenant: 'doflow' })).status).toBe(403);

    const badCsrf = await pageA.evaluate(async (orderId) => {
      const response = await fetch('/api/tenant/doflow/commerce/payments', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'invalid' }, body: JSON.stringify({ orderId, amount: 1, reference: 'BAD-CSRF', status: 'confirmed' }) });
      return response.status;
    }, order.json.id);
    expect(badCsrf).toBe(401);
    expect((await db.query(`SELECT COUNT(*)::int AS count FROM doflow.payments WHERE reference = 'BAD-CSRF'`)).rows[0].count).toBe(0);

    await pageA.reload({ waitUntil: 'domcontentloaded' });
    expect((await appFetch(pageA, `/tenant/doflow/commerce/orders/${order.json.id}`)).ok).toBe(true);
    await contextA.close();
    contextA2 = await browser.newContext();
    const ownerAgain = await login(contextA2, credentials.email, credentials, true);
    expect((await appFetch(ownerAgain.page, `/tenant/doflow/commerce/orders/${order.json.id}`)).ok).toBe(true);
    restart('frontend');
    await ownerAgain.page.reload({ waitUntil: 'domcontentloaded' });
    expect((await appFetch(ownerAgain.page, `/tenant/doflow/commerce/orders/${order.json.id}`)).ok).toBe(true);
    restart('backend');
    expect((await appFetch(ownerAgain.page, `/tenant/doflow/commerce/orders/${order.json.id}`)).ok).toBe(true);

    const localKeys = await ownerAgain.page.evaluate(() => Object.keys(localStorage).filter((key) => /service|catalog|sale|order|payment|refund|commerce/i.test(key)));
    expect(localKeys).toEqual([]);
    const dbProof = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM doflow.orders WHERE id = $1)::int AS orders,
        (SELECT COUNT(*) FROM doflow.order_items WHERE order_id = $1)::int AS items,
        (SELECT COUNT(*) FROM doflow.payments WHERE order_id = $1 AND payment_type = 'payment')::int AS payments,
        (SELECT COUNT(*) FROM doflow.payments WHERE order_id = $1 AND payment_type = 'refund')::int AS refunds,
        (SELECT COUNT(*) FROM doflow.payment_allocations WHERE order_id = $1)::int AS allocations,
        (SELECT COUNT(*) FROM doflow.commerce_idempotency WHERE status = 'completed')::int AS idempotency,
        (SELECT COUNT(*) FROM doflow.commerce_history WHERE aggregate_id = $1 OR metadata->>'order_id' = $1::text)::int AS history,
        (SELECT COUNT(*) FROM doflow.audit_log WHERE target = $1::text)::int AS audit,
        (SELECT COUNT(*) FROM doflow.commerce_outbox WHERE aggregate_id = $1 OR payload->>'order_id' = $1::text)::int AS outbox,
        (SELECT COUNT(*) FROM doflow.projects WHERE order_id = $1)::int AS projects
    `, [order.json.id]);
    expect(dbProof.rows[0]).toMatchObject({ orders: 1, items: 1, refunds: 1, projects: 1 });
    expect(dbProof.rows[0].payments).toBe(2);
    expect(dbProof.rows[0].allocations).toBe(3);
    expect(dbProof.rows[0].idempotency).toBeGreaterThan(0);
    expect(dbProof.rows[0].history).toBeGreaterThan(0);
    expect(dbProof.rows[0].audit).toBeGreaterThan(0);
    expect(dbProof.rows[0].outbox).toBeGreaterThan(0);
    expect((await db.query(`SELECT COUNT(*)::int AS count FROM doflow.commerce_history WHERE aggregate_id = $1 AND event_type = 'commerce_order_project_generated'`, [order.json.id])).rows[0].count).toBe(1);

    const sessionKey = `doflow:web-session:${createHash('sha256').update(denied.sessionId).digest('hex')}`;
    expect(await redis.exists(sessionKey)).toBe(1);
    await redis.del(sessionKey);
    expect((await appFetch(denied.page, '/tenant/doflow/commerce/orders')).status).toBe(401);

    await writeFile(resultPath, JSON.stringify({ marker, orderId: order.json.id, projectId: project.json.projectId, total: Number(refundedOrder.json.total), net: Number(refundedOrder.json.net_collected), residual: Number(refundedOrder.json.residual), db: dbProof.rows[0] }), { mode: 0o600 });
  } finally {
    await Promise.allSettled([contextA.close(), contextB.close(), contextDenied.close(), contextC.close(), contextA2?.close()]);
    redis.disconnect();
    await db.end().catch(() => undefined);
  }
});
