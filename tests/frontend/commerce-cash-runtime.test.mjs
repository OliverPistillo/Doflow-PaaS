import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");
const api = read("apps/frontend/src/lib/tenant-commerce-api.ts");
const provider = read(
  "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx",
);
const forms = read(
  "apps/frontend/src/features/commercial/components/commerce-form-dialogs.tsx",
);
const operations = read(
  "apps/frontend/src/features/commercial/components/commerce-operations-page.tsx",
);
const project = read(
  "apps/frontend/src/features/commercial/components/commercial-project-detail-page.tsx",
);
const customer = read(
  "apps/frontend/src/features/commercial/components/client-operations-tabs.tsx",
);
const dashboard = read(
  "apps/frontend/src/features/dashboard/synchronized-dashboard-overview.tsx",
);
const commerce = read(
  "apps/frontend/src/features/commercial/commercial-commerce.ts",
);

test("commerce client queries every Phase 3A aggregate and carries idempotency", () => {
  for (const endpoint of [
    "/services",
    "/sales",
    "/orders",
    "/payments",
    "/refunds",
    "/economics/summary",
    "/economics`",
    "/project",
  ]) {
    assert.match(
      api,
      new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.match(api, /"Idempotency-Key"/);
});

test("provider mutations are API-first, DTO-sanitized and persist customer finance with rollback", () => {
  for (const [apiCall, projection] of [
    ["commerceApi.createService", "setServices"],
    ["commerceApi.createSale", "setSales"],
    ["commerceApi.createOrder", "setOrders"],
    ["commerceApi.createPayment", "reloadCommerceState"],
  ]) {
    assert.ok(provider.indexOf(apiCall) >= 0, apiCall);
    assert.ok(
      provider.indexOf(apiCall) <
        provider.indexOf(projection, provider.indexOf(apiCall)),
      `${apiCall} precedes ${projection}`,
    );
  }
  const createOrder = provider.slice(
    provider.indexOf("async addOrder(input)"),
    provider.indexOf("async updateOrder(", provider.indexOf("async addOrder(input)")),
  );
  assert.match(createOrder, /const orderPayload =/);
  assert.match(createOrder, /items: input\.items\.map/);
  assert.match(createOrder, /commerceApi\.createOrder\(\s*orderPayload/);
  assert.doesNotMatch(
    createOrder,
    /unitPrice:|subtotal:|taxTotal:|total:|balance:|grossCollected:|refundedTotal:|netCollected:|residual:|paymentStatus:|projectId:/,
  );
  const customerFinance = provider.slice(
    provider.indexOf("updateCustomerFinance("),
    provider.indexOf("syncCustomerActivityDependency(", provider.indexOf("updateCustomerFinance(")),
  );
  assert.match(customerFinance, /backendContractsApi\.customer\.updateFinance/);
  assert.match(customerFinance, /previousFinance/);
  assert.match(customerFinance, /optimisticVersion/);
  assert.match(customerFinance, /\.catch\([\s\S]*setCustomers\(/);
  assert.doesNotMatch(customerFinance, /BLOCKED — MISSING PERSISTENCE CONTRACT/);
  assert.match(provider, /Array\.isArray\(customerResult\.value\.care\)/);
  assert.match(provider, /Array\.isArray\(customerResult\.value\.finance\)/);
  assert.match(provider, /Array\.isArray\(customerResult\.value\.documents\)/);
  assert.doesNotMatch(
    provider + commerce,
    /localStorage|calculateCommerceEconomics|calculateOrderFinancials|createOrderItemSnapshot/,
  );
});

test("order draft is transient and form success waits for the server", () => {
  assert.match(forms, /createOrderDraftItem/);
  assert.match(forms, /estimateOrderDraftTotal/);
  assert.match(forms, /Boolean\(await store\.addOrder\(input\)\)/);
  assert.match(forms, /await store\.updateOrder/);
  assert.match(forms, /name="invoicedAmount"[\s\S]{0,180}readOnly/);
  const updateOrder = provider.slice(
    provider.indexOf("async updateOrder(orderId, updates)"),
    provider.indexOf("async archiveOrder(", provider.indexOf("async updateOrder(orderId, updates)")),
  );
  assert.match(updateOrder, /commerceApi\.updateOrder/);
  assert.match(updateOrder, /version: current\.version/);
  assert.match(updateOrder, /items: updates\.items\.map/);
  assert.doesNotMatch(updateOrder, /unitPrice:|subtotal:|taxTotal:|total:|balance:|paymentStatus:/);
  assert.doesNotMatch(forms, /BLOCKED — MISSING PERSISTENCE CONTRACT/);
  assert.doesNotMatch(
    forms,
    /name="total"|name="taxTotal"|name="residual"|name="paymentStatus"/,
  );
});

test("loading, error, denied and invalidation surfaces exist without fixture fallback", () => {
  assert.match(operations, /economicsLoading/);
  assert.match(operations, /aria-busy=\{economicsLoading\}/);
  assert.match(operations, /setEconomicsStatus\("error"\)/);
  assert.match(operations, /Dati economici non disponibili/);
  assert.match(provider, /reloadCommerceState/);
  assert.doesNotMatch(
    [operations, project, customer, dashboard].join("\n"),
    /fallback fixture|demoOrder|mockPayment|fixturePayment/i,
  );
});

test("commerce tables tolerate date-only, ISO and missing backend dates", () => {
  assert.match(
    operations,
    /function formatCommerceDate\(value\?: string \| Date \| null\)/,
  );
  assert.match(
    operations,
    /new Date\(\/\^\\d\{4\}-\\d\{2\}-\\d\{2\}\$\/\.test\(value\) \? `\$\{value\}T12:00:00` : value\)/,
  );
  assert.match(
    operations,
    /Number\.isNaN\(parsed\.getTime\(\)\) \? "—" : date\.format\(parsed\)/,
  );
  assert.match(operations, /formatCommerceDate\(item\.orderDate\)/);
  assert.match(
    operations,
    /formatCommerceDate\(item\.effectiveDate \?\? item\.date\)/,
  );
  assert.doesNotMatch(
    operations,
    /new Date\(`\$\{item\.(?:orderDate|effectiveDate|date)\}T12:00:00`\)/,
  );
});

test("commerce surfaces consume server projections while preserving seven project tabs", () => {
  assert.match(api, /projectEconomics/);
  assert.match(api, /customerEconomics/);
  assert.match(provider, /commerceApi\.state/);
  assert.match(operations, /commerceApi[\s\S]*\.economics\(periodStart \|\| undefined\)/);
  assert.match(dashboard, /commerceApi\s*\.economics/);
  assert.match(
    project,
    /\[\s*"overview",\s*"activities",\s*"phases",\s*"production",\s*"documents",\s*"payments",\s*"timeline",?\s*\]/,
  );
  assert.doesNotMatch(
    [project, customer, dashboard, operations, commerce].join("\n"),
    /calculateCommerceEconomics|calculateOrderFinancials|Fatturato registrato/,
  );
});
