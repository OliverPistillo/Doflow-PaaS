import { expect, test, type BrowserContext, type Page } from '@playwright/test';
import { createHmac, randomUUID } from 'node:crypto';
import { createRequire } from 'node:module';
import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(__dirname, '../..');
const runtimeConfigPath = path.join(root, '.visual-runtime', 'commercial-core-stack.json');
const credentialPath = path.join(root, '.visual-auth', 'acceptance-credentials.json');
const resultPath = path.join(root, '.visual-runtime', 'document-revenue-acceptance-result.json');
const backendRequire = createRequire(path.join(root, 'apps/backend/package.json'));
const { Client: PgClient } = backendRequire('pg');

type Credentials = { email: string; password: string; mfaSecret: string };
type AppResult = { status: number; ok: boolean; json: any; text: string };

function decodeBase32(value: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = value.toUpperCase().replace(/=+$/g, '');
  let bits = '';
  for (const character of normalized) {
    bits += alphabet.indexOf(character).toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function totp(secret: string) {
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const digest = createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);
  return String(binary % 1_000_000).padStart(6, '0');
}

async function stableTotp(page: Page, secret: string) {
  const remaining = 30_000 - (Date.now() % 30_000);
  if (remaining < 5_000) await page.waitForTimeout(remaining + 150);
  return totp(secret);
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
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await page
        .getByLabel('Codice di verifica a 6 cifre')
        .fill(await stableTotp(page, credentials.mfaSecret));
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
  return page;
}

async function appFetch(
  page: Page,
  pathname: string,
  options: {
    method?: string;
    body?: unknown;
    headers?: Record<string, string>;
  } = {},
): Promise<AppResult> {
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
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      // Status and raw body are retained for diagnostics.
    }
    return { status: response.status, ok: response.ok, json, text };
  }, { pathValue: pathname, request: options });
}

const write = (
  page: Page,
  pathname: string,
  method: 'POST' | 'PATCH' | 'DELETE',
  body: unknown,
  key = randomUUID(),
) => appFetch(page, pathname, {
  method,
  body,
  headers: { 'Idempotency-Key': key },
});

function restart(service: 'frontend' | 'backend') {
  const result = spawnSync(
    process.execPath,
    [path.join(root, 'scripts/commercial-core-isolated-stack.mjs'), `restart-${service}`],
    { cwd: root, encoding: 'utf8', windowsHide: true },
  );
  if (result.status !== 0) {
    throw new Error(
      `Unable to restart isolated ${service}: ${result.stderr || result.stdout}`,
    );
  }
}

test('Document & Revenue Core è autoritativo, redatto, idempotente e tenant-isolated', async ({ browser }) => {
  const config = JSON.parse(await readFile(runtimeConfigPath, 'utf8')) as {
    databaseUrl: string;
  };
  const credentials = JSON.parse(await readFile(credentialPath, 'utf8')) as Credentials;
  expect(new URL(config.databaseUrl).hostname).toBe('localhost');

  const contextA = await browser.newContext();
  const contextB = await browser.newContext();
  const contextC = await browser.newContext();
  let contextA2: BrowserContext | undefined;
  const db = new PgClient({ connectionString: config.databaseUrl });
  const marker = `DOC-${Date.now()}`;
  const companyId = randomUUID();
  const opportunityId = randomUUID();

  try {
    await db.connect();
    await db.query(
      `INSERT INTO doflow.companies
         (id, name, status, source, owner_user_id, created_by, updated_by)
       VALUES ($1,$2,'active_client','acceptance_fixture',$3,$3,$3)`,
      [companyId, `Cliente ${marker}`, 'a0000000-0000-4000-8000-000000000001'],
    );
    await db.query(
      `INSERT INTO doflow.opportunities
         (id, company_id, title, service_type, stage, assigned_to, created_by, updated_by)
       VALUES ($1,$2,$3,'software','won',$4,$4,$4)`,
      [
        opportunityId,
        companyId,
        `Opportunità ${marker}`,
        'a0000000-0000-4000-8000-000000000001',
      ],
    );

    const owner = await login(contextA, credentials.email, credentials, true);
    const limited = await login(
      contextB,
      'visual.editor@acceptance.invalid',
      credentials,
    );
    const secondary = await login(
      contextC,
      'secondary.owner@acceptance.invalid',
      credentials,
    );

    const service = await write(owner, '/tenant/doflow/commerce/services', 'POST', {
      name: `Servizio documentale ${marker}`,
      category: 'Software',
      description: 'Snapshot originario documento',
      price: 1000,
      currency: 'EUR',
      unit: 'progetto',
      taxRate: 22,
      billingType: 'mixed',
      status: 'active',
      availability: 'available',
      deposit: 400,
      balance: 820,
      installments: 2,
      billingPlans: [{
        name: 'Piano annuale',
        description: 'Ricorrenza sintetica',
        oneTimePrice: 1000,
        recurringPrice: 300,
        recurrence: 'annual',
        renewal: 'required',
        included: ['Assistenza'],
        active: true,
      }],
    });
    expect(service.ok, service.text).toBe(true);
    const sale = await write(owner, '/tenant/doflow/commerce/sales', 'POST', {
      customerId: companyId,
      leadId: opportunityId,
      opportunityId,
      serviceId: service.json.id,
      salespersonId: 'a0000000-0000-4000-8000-000000000001',
      origin: 'Commerciale',
      value: 1220,
      cost: 0,
      currency: 'EUR',
      date: '2026-08-23',
      status: 'Vinta',
      dealId: `DEAL-${marker}`,
    });
    expect(sale.ok, sale.text).toBe(true);
    const order = await write(owner, '/tenant/doflow/commerce/orders', 'POST', {
      customerId: companyId,
      saleId: sale.json.id,
      leadId: opportunityId,
      opportunityId,
      salespersonId: 'a0000000-0000-4000-8000-000000000001',
      dealId: `DEAL-${marker}`,
      items: [{
        serviceId: service.json.id,
        planId: service.json.billing_plans[0].id,
        quantity: 1,
      }],
      deposit: 400,
      installments: 2,
      administrativeStatus: 'Confermato',
      orderDate: '2026-08-23',
      dueDate: '2026-09-23',
    });
    expect(order.ok, order.text).toBe(true);
    const orderState = await appFetch(owner, `/tenant/doflow/commerce/orders/${order.json.id}`);
    const orderItemId = orderState.json.items[0].id;

    const quoteBody = {
      customerId: companyId,
      leadId: opportunityId,
      opportunityId,
      title: `Preventivo ${marker}`,
      validUntil: '2026-12-31',
      conditions: 'Condizioni sintetiche',
      lines: [{ serviceId: service.json.id, quantity: 1 }],
    };
    const quoteKey = randomUUID();
    const quote = await write(
      owner,
      '/tenant/doflow/document-revenue/quotes',
      'POST',
      quoteBody,
      quoteKey,
    );
    expect(quote.ok, quote.text).toBe(true);
    expect(quote.json.quoteNumber).toMatch(/^PREV-\d+$/);
    const repeatedQuote = await write(
      owner,
      '/tenant/doflow/document-revenue/quotes',
      'POST',
      quoteBody,
      quoteKey,
    );
    expect(repeatedQuote.json.id).toBe(quote.json.id);
    const forbiddenQuoteTotal = await write(
      owner,
      '/tenant/doflow/document-revenue/quotes',
      'POST',
      { ...quoteBody, total: 1 },
    );
    expect(forbiddenQuoteTotal.status).toBe(400);
    const zeroQuantity = await write(
      owner,
      '/tenant/doflow/document-revenue/quotes',
      'POST',
      { ...quoteBody, lines: [{ serviceId: service.json.id, quantity: 0 }] },
    );
    expect(zeroQuantity.status).toBe(400);

    const beforeCatalogChange = await appFetch(
      owner,
      '/tenant/doflow/document-revenue/state',
    );
    const quoteSnapshot = beforeCatalogChange.json.quotes.find(
      (item: any) => item.id === quote.json.id,
    );
    expect(Number(quoteSnapshot.total)).toBe(1220);
    expect(quoteSnapshot.items[0].service_description_snapshot).toBe(
      'Snapshot originario documento',
    );
    await write(owner, `/tenant/doflow/commerce/services/${service.json.id}`, 'PATCH', {
      version: service.json.version,
      price: 9999,
      taxRate: 5,
      description: 'Catalogo modificato',
    });
    const afterCatalogChange = await appFetch(
      owner,
      '/tenant/doflow/document-revenue/state',
    );
    const stableQuote = afterCatalogChange.json.quotes.find(
      (item: any) => item.id === quote.json.id,
    );
    expect(Number(stableQuote.total)).toBe(1220);
    expect(stableQuote.items[0].service_description_snapshot).toBe(
      'Snapshot originario documento',
    );

    expect((await write(owner, `/tenant/doflow/document-revenue/quotes/${quote.json.id}/transition`, 'POST', { status: 'Inviato' })).ok).toBe(true);
    const accepted = await write(owner, `/tenant/doflow/document-revenue/quotes/${quote.json.id}/transition`, 'POST', { status: 'Accettato' });
    expect(accepted.ok, accepted.text).toBe(true);
    expect(accepted.json.saleId).toBeTruthy();
    expect(accepted.json.orderId).toBeTruthy();
    const repeatedAccept = await write(owner, `/tenant/doflow/document-revenue/quotes/${quote.json.id}/transition`, 'POST', { status: 'Accettato' });
    expect(repeatedAccept.json.orderId).toBe(accepted.json.orderId);

    const contractKey = randomUUID();
    const contract = await write(owner, '/tenant/doflow/document-revenue/contracts', 'POST', {
      orderId: order.json.id,
      title: `Contratto ${marker}`,
      signatoryName: 'Firmatario sintetico',
      signatureDueAt: '2026-10-31',
    }, contractKey);
    expect(contract.ok, contract.text).toBe(true);
    const repeatedContract = await write(owner, '/tenant/doflow/document-revenue/contracts', 'POST', {
      orderId: order.json.id,
      title: `Contratto ${marker}`,
    }, contractKey);
    expect(repeatedContract.json.id).toBe(contract.json.id);
    const contractVersionKey = randomUUID();
    const contractVersion = await write(owner, `/tenant/doflow/document-revenue/contracts/${contract.json.id}/versions`, 'POST', {}, contractVersionKey);
    expect(contractVersion.ok, contractVersion.text).toBe(true);
    expect(contractVersion.json.version).toBe(2);
    const repeatedVersion = await write(owner, `/tenant/doflow/document-revenue/contracts/${contract.json.id}/versions`, 'POST', {}, contractVersionKey);
    expect(repeatedVersion.json.versionId).toBe(contractVersion.json.versionId);
    const sendKey = randomUUID();
    const send = await write(owner, `/tenant/doflow/document-revenue/contracts/${contract.json.id}/send`, 'POST', {
      method: 'Consegna manuale',
      kind: 'invio',
      note: 'Nessun provider esterno',
    }, sendKey);
    expect(send.ok, send.text).toBe(true);
    expect((await write(owner, `/tenant/doflow/document-revenue/contracts/${contract.json.id}/send`, 'POST', {
      method: 'Consegna manuale', kind: 'invio', note: 'Nessun provider esterno',
    }, sendKey)).json.attemptId).toBe(send.json.attemptId);
    const signature = await write(owner, `/tenant/doflow/document-revenue/contracts/${contract.json.id}/signatures`, 'POST', {
      method: 'internal_record', signatoryName: 'Firmatario sintetico',
    });
    expect(signature.ok, signature.text).toBe(true);

    const invoiceKey = randomUUID();
    const invoice = await write(owner, '/tenant/doflow/document-revenue/invoices', 'POST', {
      orderId: order.json.id,
      dueAt: '2026-10-31',
      notes: 'Documento locale acceptance',
    }, invoiceKey);
    expect(invoice.ok, invoice.text).toBe(true);
    expect(invoice.json.invoiceNumber).toMatch(/^FAT-LOCAL-\d+$/);
    expect((await write(owner, '/tenant/doflow/document-revenue/invoices', 'POST', {
      orderId: order.json.id,
      dueAt: '2026-10-31',
      notes: 'Documento locale acceptance',
    }, invoiceKey)).json.id).toBe(invoice.json.id);
    expect((await write(owner, '/tenant/doflow/document-revenue/invoices', 'POST', {
      orderId: order.json.id, dueAt: '2026-10-31', total: 1,
    })).status).toBe(400);
    expect((await write(owner, `/tenant/doflow/document-revenue/invoices/${invoice.json.id}/transition`, 'POST', {
      status: 'Emessa esternamente',
    })).ok).toBe(true);
    const credit = await write(owner, `/tenant/doflow/document-revenue/invoices/${invoice.json.id}/credit-notes`, 'POST', {
      amount: 100,
      reason: 'Storno parziale sintetico',
    });
    expect(credit.ok, credit.text).toBe(true);
    expect((await write(owner, `/tenant/doflow/document-revenue/invoices/${invoice.json.id}/credit-notes`, 'POST', {
      amount: 9999, reason: 'Sovra-storno',
    })).ok).toBe(false);

    const renewalKey = randomUUID();
    const renewal = await write(owner, '/tenant/doflow/document-revenue/renewals', 'POST', {
      orderId: order.json.id,
      itemId: orderItemId,
    }, renewalKey);
    expect(renewal.ok, renewal.text).toBe(true);
    expect((await write(owner, '/tenant/doflow/document-revenue/renewals', 'POST', {
      orderId: order.json.id, itemId: orderItemId,
    }, renewalKey)).json.id).toBe(renewal.json.id);
    const reminderKey = randomUUID();
    const reminder = await write(owner, `/tenant/doflow/document-revenue/renewals/${renewal.json.id}/reminders`, 'POST', {}, reminderKey);
    expect(reminder.ok, reminder.text).toBe(true);
    expect((await write(owner, `/tenant/doflow/document-revenue/renewals/${renewal.json.id}/reminders`, 'POST', {}, reminderKey)).json.activityId).toBe(reminder.json.activityId);
    const renewalOrderKey = randomUUID();
    const renewalOrder = await write(owner, `/tenant/doflow/document-revenue/renewals/${renewal.json.id}/order`, 'POST', {}, renewalOrderKey);
    expect(renewalOrder.ok, renewalOrder.text).toBe(true);
    expect((await write(owner, `/tenant/doflow/document-revenue/renewals/${renewal.json.id}/order`, 'POST', {}, renewalOrderKey)).json.orderId).toBe(renewalOrder.json.orderId);

    const limitedState = await appFetch(limited, '/tenant/doflow/document-revenue/state');
    expect(limitedState.ok, limitedState.text).toBe(true);
    expect(limitedState.json.redacted).toBe(true);
    expect(limitedState.text).not.toContain('1220');
    expect(limitedState.text).not.toContain('"snapshot"');
    expect(limitedState.text).not.toContain('"amount"');
    expect((await write(limited, '/tenant/doflow/document-revenue/invoices', 'POST', {
      orderId: order.json.id, dueAt: '2026-10-31',
    })).status).toBe(403);

    const crossTenant = await appFetch(
      secondary,
      '/tenant/doflow/document-revenue/state?tenant=doflow',
      { headers: { 'x-doflow-tenant-id': 'doflow' } },
    );
    expect(crossTenant.status).toBe(403);
    expect(crossTenant.text).not.toContain(quote.json.id);
    expect((await write(secondary, '/tenant/doflow/document-revenue/quotes', 'POST', {
      ...quoteBody, tenant: 'doflow',
    })).status).toBe(403);

    const badCsrf = await owner.evaluate(async (invoiceId) => {
      const response = await fetch(`/api/tenant/doflow/document-revenue/invoices/${invoiceId}/credit-notes`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'invalid' },
        body: JSON.stringify({ amount: 1, reason: 'CSRF invalido' }),
      });
      return response.status;
    }, invoice.json.id);
    expect(badCsrf).toBe(401);

    const ownerState = await appFetch(owner, '/tenant/doflow/document-revenue/state');
    expect(ownerState.json.quotes.some((item: any) => item.id === quote.json.id)).toBe(true);
    expect(ownerState.json.contracts.some((item: any) => item.id === contract.json.id)).toBe(true);
    expect(ownerState.json.invoices.some((item: any) => item.id === invoice.json.id)).toBe(true);
    expect(ownerState.json.renewals.some((item: any) => item.id === renewal.json.id)).toBe(true);
    const summary = await appFetch(owner, '/tenant/doflow/document-revenue/summary');
    expect(summary.ok, summary.text).toBe(true);
    expect(Number(summary.json.creditNotes)).toBeGreaterThanOrEqual(100);

    await owner.reload({ waitUntil: 'domcontentloaded' });
    await contextA.close();
    contextA2 = await browser.newContext();
    const ownerAgain = await login(contextA2, credentials.email, credentials, true);
    expect((await appFetch(ownerAgain, '/tenant/doflow/document-revenue/state')).json.invoices.some((item: any) => item.id === invoice.json.id)).toBe(true);
    restart('frontend');
    await ownerAgain.reload({ waitUntil: 'domcontentloaded' });
    restart('backend');
    expect((await appFetch(ownerAgain, '/tenant/doflow/document-revenue/state')).json.renewals.some((item: any) => item.id === renewal.json.id)).toBe(true);
    const localKeys = await ownerAgain.evaluate(() =>
      Object.keys(localStorage).filter((key) =>
        /quote|preventiv|contract|invoice|fattur|credit|renewal|rinnov/i.test(key),
      ),
    );
    expect(localKeys).toEqual([]);

    const proof = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM doflow.quotes WHERE id = $1)::int AS quotes,
        (SELECT COUNT(*) FROM doflow.quote_items WHERE quote_id = $1)::int AS quote_items,
        (SELECT COUNT(*) FROM doflow.contracts WHERE id = $2)::int AS contracts,
        (SELECT COUNT(*) FROM doflow.contract_versions WHERE contract_id = $2)::int AS contract_versions,
        (SELECT COUNT(*) FROM doflow.contract_send_events WHERE contract_id = $2)::int AS sends,
        (SELECT COUNT(*) FROM doflow.contract_signature_events WHERE contract_id = $2)::int AS signatures,
        (SELECT COUNT(*) FROM doflow.invoices WHERE id = $3)::int AS invoices,
        (SELECT COUNT(*) FROM doflow.invoices WHERE parent_invoice_id = $3)::int AS credit_notes,
        (SELECT COUNT(*) FROM doflow.renewals WHERE id = $4)::int AS renewals,
        (SELECT COUNT(*) FROM doflow.recurring_services WHERE source_order_item_id = $5)::int AS recurring,
        (SELECT COUNT(*) FROM doflow.document_artifacts WHERE aggregate_id IN ($1,$2,$3))::int AS artifacts,
        (SELECT COUNT(*) FROM doflow.commerce_history WHERE aggregate_id IN ($1,$2,$3,$4))::int AS history,
        (SELECT COUNT(*) FROM doflow.audit_log WHERE target IN ($1::text,$2::text,$3::text,$4::text))::int AS audit,
        (SELECT COUNT(*) FROM doflow.commerce_outbox WHERE aggregate_id IN ($1,$2,$3,$4))::int AS outbox
    `, [quote.json.id, contract.json.id, invoice.json.id, renewal.json.id, orderItemId]);
    expect(proof.rows[0]).toMatchObject({
      quotes: 1,
      quote_items: 1,
      contracts: 1,
      contract_versions: 2,
      sends: 1,
      signatures: 1,
      invoices: 1,
      credit_notes: 1,
      renewals: 1,
      recurring: 1,
    });
    expect(proof.rows[0].artifacts).toBeGreaterThanOrEqual(4);
    expect(proof.rows[0].history).toBeGreaterThan(0);
    expect(proof.rows[0].audit).toBeGreaterThan(0);
    expect(proof.rows[0].outbox).toBeGreaterThan(0);

    await writeFile(resultPath, JSON.stringify({
      marker,
      quoteId: quote.json.id,
      contractId: contract.json.id,
      invoiceId: invoice.json.id,
      renewalId: renewal.json.id,
      proof: proof.rows[0],
    }), { mode: 0o600 });
  } finally {
    await Promise.allSettled([
      contextA.close(),
      contextB.close(),
      contextC.close(),
      contextA2?.close(),
    ]);
    await db.end().catch(() => undefined);
  }
});
