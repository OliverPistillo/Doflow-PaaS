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

test("provider mutations are API-first and never persist commerce collections locally", () => {
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
  assert.doesNotMatch(
    provider,
    /localStorage|updateCustomerFinance|calculateCommerceEconomics|calculateOrderFinancials/,
  );
});

test("order draft is explicitly non-authoritative and server snapshots are immutable in UI", () => {
  assert.match(forms, /Totale stimato \(ricalcolato dal server\)/);
  assert.match(forms, /Snapshot ordine immutabile/);
  assert.match(forms, /readOnly/);
  assert.doesNotMatch(
    forms,
    /name="total"|name="taxTotal"|name="residual"|name="paymentStatus"/,
  );
});

test("loading, error, denied and invalidation surfaces exist without fixture fallback", () => {
  assert.match(operations, /economicsLoading/);
  assert.match(operations, /aria-busy=\{economicsLoading\}/);
  assert.match(operations, /economicsError/);
  assert.match(provider, /reloadCommerceState/);
  assert.doesNotMatch(
    [operations, project, customer, dashboard].join("\n"),
    /fallback fixture|demoOrder|mockPayment|fixturePayment/i,
  );
});

test("project, customer and dashboard consume backend economics while preserving seven project tabs", () => {
  assert.match(project, /commerceApi\s*\.projectEconomics/);
  assert.match(customer, /commerceApi\s*\.customerEconomics/);
  assert.match(dashboard, /commerceApi\s*\.economics/);
  assert.match(
    project,
    /\[\s*"overview",\s*"activities",\s*"phases",\s*"production",\s*"documents",\s*"payments",\s*"timeline",?\s*\]/,
  );
  assert.doesNotMatch(
    dashboard,
    /store\.payments\.filter|store\.orders\.reduce|Fatturato registrato/,
  );
});
