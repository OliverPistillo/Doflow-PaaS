import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

const read = (file) => fs.readFileSync(file, "utf8");
const api = read("apps/frontend/src/lib/tenant-document-revenue-api.ts");
const provider = read(
  "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx",
);
const documentCycle = read(
  "apps/frontend/src/features/commercial/components/commercial-document-cycle-page.tsx",
);
const contractRenewal = read(
  "apps/frontend/src/features/commercial/components/contract-renewal-operations-page.tsx",
);
const project = read(
  "apps/frontend/src/features/commercial/components/commercial-project-detail-page.tsx",
);

test("Document & Revenue client uses one authority boundary with idempotent mutations", () => {
  for (const endpoint of [
    "/state",
    "/summary",
    "/quotes",
    "/contracts",
    "/invoices",
    "/credit-notes",
    "/renewals",
  ]) {
    assert.match(
      api,
      new RegExp(endpoint.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
    );
  }
  assert.match(api, /"Idempotency-Key"/);
});

test("provider has no legacy parallel reads or client-only Phase 3B persistence", () => {
  assert.doesNotMatch(
    provider,
    /commercialApi\.quotes\(|contractsApi\.list\(|\/tenant\/finance\/(?:invoices|renewals)/,
  );
  assert.doesNotMatch(
    [provider, api].join("\n"),
    /localStorage|sessionStorage|calculateDocumentTotals|contractApiBody/,
  );
  for (const call of [
    "createQuote",
    "updateQuote",
    "quoteVersion",
    "createInvoice",
    "transitionInvoice",
    "creditNote",
    "generateContract",
    "sendContract",
    "signContract",
    "contractVersion",
    "activateRenewal",
    "remindRenewal",
    "renewalOrder",
  ])
    assert.match(provider, new RegExp(`documentRevenueApi\\.${call}`));
});

test("browser never submits authoritative document prices, totals, numbers or signatures", () => {
  const createQuote = provider.slice(
    provider.indexOf("async addQuote("),
    provider.indexOf("async updateQuote("),
  );
  const createInvoice = provider.slice(
    provider.indexOf("async addInvoice("),
    provider.indexOf("async updateInvoice("),
  );
  assert.doesNotMatch(
    createQuote,
    /unitPrice|subtotal|vatRate|vatAmount|total|quoteNumber|actorId/,
  );
  assert.doesNotMatch(
    createInvoice,
    /lines:|taxableAmount|vatRate|vatAmount|total:|invoiceNumber|paidTotal/,
  );
  assert.match(documentCycle, /await store\.(?:addQuote|addInvoice)/);
  assert.match(contractRenewal, /await store\.markContractSigned\(live\.id\)/);
  const signContract = provider.slice(
    provider.indexOf("async markContractSigned("),
    provider.indexOf("async createContractVersion(", provider.indexOf("async markContractSigned(")),
  );
  assert.match(signContract, /documentRevenueApi\.signContract/);
  assert.match(signContract, /method: "internal_record"/);
  assert.doesNotMatch(signContract, /signatureData|signatureImage|signedAt:/);
});

test("customer aggregation and canonical seven project tabs remain server-oriented", () => {
  assert.match(provider, /documentRevenueState\.customerFinance/);
  assert.doesNotMatch(
    provider,
    /companyInvoices\.reduce|companyPayments\.reduce/,
  );
  assert.match(
    project,
    /\[\s*"overview",\s*"activities",\s*"phases",\s*"production",\s*"documents",\s*"payments",\s*"timeline",?\s*\]/,
  );
});
