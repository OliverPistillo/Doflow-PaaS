import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(path.join(root, file), "utf8");

const quoteRequests = read("apps/frontend/src/app/superadmin/sales/quote-requests/page.tsx");
const salesPipeline = read("apps/frontend/src/app/superadmin/sales/pipeline/page.tsx");
const tenants = read("apps/frontend/src/app/superadmin/tenants/page.tsx");
const users = read("apps/frontend/src/app/superadmin/users/page.tsx");
const finance = read("apps/frontend/src/app/superadmin/finance/dashboard/page.tsx");
const salesDashboard = read("apps/frontend/src/app/superadmin/sales/dashboard/sales-dashboard-client.tsx");
const delivery = read("apps/frontend/src/app/superadmin/delivery/status/page.tsx");

test("SuperAdmin sheets have accessible Radix titles and descriptions", () => {
  for (const source of [quoteRequests, salesPipeline]) {
    assert.match(source, /<SheetTitle\b/);
    assert.match(source, /<SheetDescription\b/);
  }
});

test("wide SuperAdmin tables retain all columns behind a horizontal scroll region", () => {
  for (const [source, minimumWidth] of [
    [quoteRequests, "760px"],
    [salesPipeline, "720px"],
    [tenants, "960px"],
  ]) {
    assert.match(source, /overflow-x-auto/);
    assert.match(source, new RegExp(`min-w-\\[${minimumWidth}\\]`));
  }
  assert.ok((users.match(/overflow-x-auto/g) ?? []).length >= 2);
  assert.match(users, /min-w-\[640px\]/);
  assert.match(users, /min-w-\[760px\]/);
});

test("SuperAdmin drill-down controls are keyboard and touch reachable", () => {
  assert.match(quoteRequests, /aria-label=\{`Apri la richiesta/);
  assert.match(quoteRequests, /sm:group-focus-within:opacity-100/);
  assert.match(quoteRequests, /aria-label=\{`Azioni per la richiesta/);
  assert.doesNotMatch(quoteRequests, /<tr[^>]+onClick=/);

  assert.match(salesPipeline, /aria-expanded=\{Boolean\(expanded\[stage\.id\]\)\}/);
  assert.match(salesPipeline, /sm:group-focus-within:opacity-100/);
  assert.match(users, /aria-label=\{`Apri gli utenti di/);

  for (const source of [finance, salesDashboard]) {
    assert.match(source, /role="button"/);
    assert.match(source, /tabIndex=\{0\}/);
    assert.match(source, /event\.key === "Enter" \|\| event\.key === " "/);
    assert.match(source, /focus-visible:ring-2/);
  }

  assert.match(delivery, /aria-expanded=\{Boolean\(expanded\[group\.id\]\)\}/);
  assert.match(delivery, /aria-controls=\{`delivery-group-/);
  assert.match(delivery, /aria-label=\{`Modifica \$\{task\.name\}`\}/);
});

test("SuperAdmin Recharts surfaces use semantic dark-mode colors", () => {
  assert.match(finance, /backgroundColor: 'hsl\(var\(--popover\)\)'/);
  assert.match(finance, /color: 'hsl\(var\(--popover-foreground\)\)'/);
  assert.match(users, /stroke="hsl\(var\(--border\)\)"/);
  assert.match(users, /fill: "hsl\(var\(--muted-foreground\)\)"/);
  assert.match(users, /backgroundColor: "hsl\(var\(--popover\)\)"/);
  assert.match(users, /stroke="hsl\(var\(--chart-1\)\)"/);
});
