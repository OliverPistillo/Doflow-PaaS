import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = process.cwd();
const read = (file) => readFileSync(`${root}/${file}`, "utf8");

const provider = read(
  "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx",
);
const providerTypes = read(
  "apps/frontend/src/features/commercial/commercial-provider-types.ts",
);
const layout = read("apps/frontend/src/app/(tenant)/layout.tsx");
const tenantShell = read(
  "apps/frontend/src/components/layout/tenant-app-shell.tsx",
);

const bootstrap = provider.slice(
  provider.indexOf("  useEffect(() => {"),
  provider.indexOf("  const permissionScope"),
);

test("the Doflow shell keeps main mounted while workspace data is pending", () => {
  assert.match(layout, /<TenantAppShell session=\{session\}>\{children\}<\/TenantAppShell>/);
  assert.match(tenantShell, /function DoflowWorkspace/);
  assert.match(tenantShell, /data-app-shell-ready="true"/);
  assert.match(
    tenantShell,
    /data-workspace-ready=\{workspaceReady \? "true" : "false"\}/,
  );
  assert.match(tenantShell, /data-workspace-status=\{workspaceStatus\}/);
  assert.match(tenantShell, /data-secondary-status=\{secondaryStatus\}/);
  assert.match(tenantShell, /inert=\{workspaceReady \? undefined : true\}/);
  assert.match(tenantShell, /aria-hidden=\{workspaceReady \? undefined : true\}/);
  assert.doesNotMatch(provider, /if \(!hasHydrated\)\s*return/);
});

test("workspace bootstrap has explicit success, failure, retry and cancellation", () => {
  assert.match(providerTypes, /WorkspaceReadinessStatus = "loading" \| "ready" \| "error"/);
  assert.match(providerTypes, /workspaceError: WorkspaceReadinessError \| null/);
  assert.match(providerTypes, /secondaryStatus: WorkspaceReadinessStatus/);
  assert.match(providerTypes, /secondaryError: WorkspaceReadinessError \| null/);
  assert.match(providerTypes, /retryWorkspace: \(\) => void/);
  assert.match(providerTypes, /retrySecondary: \(\) => void/);
  assert.match(provider, /const retryWorkspace = useCallback/);
  assert.match(bootstrap, /new AbortController\(\)/);
  assert.match(bootstrap, /deliveryApi\.workspace\(project\.id, signal\)/);
  assert.match(bootstrap, /setWorkspaceStatus\("ready"\)/);
  assert.match(bootstrap, /setWorkspaceStatus\("error"\)/);
  assert.match(bootstrap, /controller\.abort\(\)/);
  assert.doesNotMatch(bootstrap, /\.finally\(/);
  assert.doesNotMatch(bootstrap, /\.catch\(\(\) => \(\{ items: \[\]/);
  assert.equal(bootstrap.match(/setTimeout/g)?.length, 2);
  assert.match(bootstrap, /secondaryTimeoutId/);
  assert.match(bootstrap, /clearTimeout\(timeoutId\)/);
  assert.doesNotMatch(bootstrap, /setInterval/);
});

test("core readiness completes before secondary loading and never reapplies core state", () => {
  assert.match(bootstrap, /const applyCoreSnapshot/);
  assert.match(bootstrap, /const applySecondarySnapshot/);
  assert.match(
    bootstrap,
    /setWorkspaceStatus\("ready"\);[\s\S]*secondaryLoader\.current = startSecondary/,
  );
  assert.match(
    bootstrap,
    /applyWorkspaceSnapshot\(snapshot, deliveryWorkspaces, false\)/,
  );
  assert.match(bootstrap, /if \(applyCoreState\) \{[\s\S]*setProjects\(mappedProjects\)/);
  assert.match(bootstrap, /else \{[\s\S]*setLeads\(\(items\) =>/);
});

test("an inaccessible project detail cannot fail the entire authorized workspace", () => {
  assert.match(bootstrap, /const loadDeliveryWorkspaces = async/);
  assert.match(bootstrap, /return \[await deliveryApi\.workspace\(project\.id, signal\)\]/);
  assert.match(bootstrap, /signal\.aborted \|\| isAbortError\(error\)/);
  assert.match(bootstrap, /error instanceof ApiError && \[403, 404\]\.includes\(error\.status\)/);
  assert.match(bootstrap, /return workspaces\.flat\(\)/);
});

test("core bootstrap requests only the bounded contexts authorized for the identity", () => {
  assert.match(
    provider,
    /identity\.hasCapability\("canViewAllLeads"\)[\s\S]*identity\.hasCapability\("canViewAssignedLeads"\)/,
  );
  assert.match(
    bootstrap,
    /canReadLeads\s*\?\s*commercialApi\.opportunities\([\s\S]*Promise\.resolve<CommercialList<CommercialOpportunity>>\(\{[\s\S]*items: \[\]/,
  );
  assert.match(
    bootstrap,
    /canReadCustomers\s*\?\s*commercialApi\.companies\([\s\S]*CommercialList<CommercialCompany>/,
  );
  assert.match(
    bootstrap,
    /canReadCustomers\s*\?\s*commercialApi\.contacts\([\s\S]*CommercialList<CommercialContact>/,
  );
  assert.match(
    bootstrap,
    /canReadActivities\s*\?\s*commercialApi\.activities\([\s\S]*CommercialList<CommercialActivity>/,
  );
  assert.match(
    bootstrap,
    /canReadCustomers\s*\?\s*commercialApi\.communications\([\s\S]*CommercialList</,
  );
  assert.match(
    bootstrap,
    /canReadProjects\s*\?\s*deliveryApi\.listProjects\([\s\S]*ReturnType<typeof deliveryApi\.listProjects>/,
  );
  for (const capabilityFlag of [
    "canReadActivities",
    "canReadCustomers",
    "canReadLeads",
    "canReadProjects",
  ]) {
    assert.match(bootstrap, new RegExp(`identity\\.users,[\\s\\S]*${capabilityFlag},`));
  }
  assert.doesNotMatch(
    bootstrap,
    /(commercialApi|deliveryApi)\.[a-zA-Z]+\([^)]*\)\.catch/,
  );
});

test("optional authority failures use one named, abort-aware fallback boundary", () => {
  assert.match(bootstrap, /const captureSecondary = async/);
  assert.match(bootstrap, /secondarySignal\.aborted \|\| isAbortError\(error\)/);
  assert.match(bootstrap, /error instanceof ApiError && error\.status === 401/);
  assert.match(bootstrap, /capturedError \?\?= workspaceReadinessError\(error\)/);
  assert.match(bootstrap, /redacted: true/);
  assert.match(bootstrap, /setSecondaryStatus\([\s\S]*\? "error" : "ready"/);
  assert.doesNotMatch(bootstrap, /\.catch\(\(\) => \(\{ items: \[\]/);
});

test("readiness errors remain controlled and retry does not reload the page", () => {
  assert.match(tenantShell, /workspaceError\?\.status === 401/);
  assert.match(tenantShell, /workspaceError\?\.status === 403/);
  assert.match(tenantShell, /router\.replace\(`\/login\?next=/);
  assert.match(tenantShell, /onClick=\{retryWorkspace\}/);
  assert.match(tenantShell, /Riprova caricamento/);
  assert.match(tenantShell, /secondaryStatus !== "ready"/);
  assert.match(tenantShell, /Caricamento dei dati secondari/);
  assert.match(tenantShell, /onClick=\{retrySecondary\}/);
  assert.match(tenantShell, /Riprova dati secondari/);
  assert.doesNotMatch(tenantShell, /window\.location\.reload|router\.refresh/);
});

test("every provider bootstrap client accepts an AbortSignal", () => {
  const clients = [
    read("apps/frontend/src/lib/tenant-commercial-api.ts"),
    read("apps/frontend/src/lib/tenant-delivery-api.ts"),
    read("apps/frontend/src/lib/tenant-automations-api.ts"),
    read("apps/frontend/src/lib/tenant-performance-api.ts"),
    read("apps/frontend/src/lib/tenant-document-revenue-api.ts"),
    read("apps/frontend/src/lib/tenant-documents-api.ts"),
  ].join("\n");

  assert.match(clients, /signal\?: AbortSignal/);
  for (const name of [
    "opportunities",
    "companies",
    "contacts",
    "activities",
    "communications",
    "listProjects",
    "workspace",
    "rules",
    "runs",
    "state",
    "listDocuments",
  ]) {
    assert.match(clients, new RegExp(`${name}[\\s\\S]{0,180}\\{ signal \\}`), name);
  }
});
