import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const referenceRoot = path.join(root, "doflow-gestionale-reference");
const frontendRoot = path.join(root, "apps/frontend/src/app");
const failures = [];
const evidence = {};

function read(relative) {
  return readFileSync(path.join(root, relative), "utf8");
}

function fail(message) {
  failures.push(message);
}

function major(version) {
  const match = String(version || "").match(/(\d+)/);
  return match ? Number(match[1]) : null;
}

function collectPageRoutes(directory) {
  const routes = [];
  function visit(current) {
    for (const entry of readdirSync(current)) {
      const absolute = path.join(current, entry);
      if (statSync(absolute).isDirectory()) visit(absolute);
      else if (entry === "page.tsx" || entry === "page.ts" || entry === "page.jsx" || entry === "page.js") {
        const relative = path.relative(directory, path.dirname(absolute)).split(path.sep);
        const visible = relative.filter((segment) => !(segment.startsWith("(") && segment.endsWith(")")));
        routes.push(`/${visible.join("/")}`.replace(/\/$/, "") || "/");
      }
    }
  }
  visit(directory);
  return routes.sort();
}

const rootPackage = JSON.parse(read("package.json"));
const frontendPackage = JSON.parse(read("apps/frontend/package.json"));
const stack = {
  next: frontendPackage.dependencies?.next,
  react: frontendPackage.dependencies?.react,
  reactDom: frontendPackage.dependencies?.["react-dom"],
  tailwind: frontendPackage.devDependencies?.tailwindcss || frontendPackage.dependencies?.tailwindcss,
  shadcn: frontendPackage.dependencies?.shadcn,
  typescript: frontendPackage.devDependencies?.typescript,
  eslint: frontendPackage.devDependencies?.eslint,
  postcss: frontendPackage.devDependencies?.postcss,
  packageManager: rootPackage.packageManager,
};
evidence.stack = stack;
for (const [name, expected] of [["next", 16], ["react", 19], ["reactDom", 19], ["tailwind", 4]]) {
  if (major(stack[name]) !== expected) fail(`${name} major is ${stack[name] || "missing"}, expected ${expected}`);
}

const referenceRoutes = collectPageRoutes(path.join(referenceRoot, "src/app"));
const currentRoutes = collectPageRoutes(frontendRoot);
const routeEquivalents = new Map([
  ["/activities/[activityId]", "/dashboard/attivita?activityId=[activityId]"],
  ["/projects/[projectId]", "/dashboard/progetti/[projectId]"],
]);
const routeExists = (route) => currentRoutes.includes(route.split("?")[0]);
const missingRoutes = referenceRoutes.filter((route) => !routeExists(routeEquivalents.get(route) || route));
if (missingRoutes.length) fail(`reference route equivalents missing: ${missingRoutes.join(", ")}`);
evidence.routes = {
  reference: referenceRoutes.length,
  current: currentRoutes.length,
  mappedEquivalents: routeEquivalents.size,
  missing: missingRoutes,
};

if (!currentRoutes.includes("/commercial/site-proposals")) fail("Builder canonical route is missing");
const clientPortalRoutes = currentRoutes.filter((route) => route === "/client" || route.startsWith("/client/") || route === "/client-portal" || route.startsWith("/client-portal/"));
if (clientPortalRoutes.length) fail(`Client Portal routes present: ${clientPortalRoutes.join(", ")}`);

const projectDetail = read("apps/frontend/src/features/commercial/components/commercial-project-detail-page.tsx");
const tabTokens = ['value="overview"', 'value="activities"', 'value="phases"', 'value="production"', 'value="documents"', 'value="payments"', 'value="timeline"'];
let lastTab = -1;
for (const token of tabTokens) {
  const index = projectDetail.indexOf(token, lastTab + 1);
  if (index < 0) fail(`canonical project tab missing or out of order: ${token}`);
  lastTab = index;
}

const tenantLayout = read("apps/frontend/src/app/(tenant)/layout.tsx");
for (const redirect of ["/leads", "/pipeline", "/projects", "/activities", "/quotes", "/contracts", "/orders", "/payments", "/invoices", "/notifications"]) {
  if (!tenantLayout.includes(`[\"${redirect}\"`)) fail(`legacy Doflow redirect missing: ${redirect}`);
}
if (!tenantLayout.includes('pathname.startsWith("/commercial/site-proposals")')) fail("Builder is not exempted from legacy redirects");

const jwtStorage = read("apps/frontend/src/lib/jwt.ts");
if (existsSync(path.join(root, "apps/frontend/src/lib/auth-storage.ts")) || /localStorage|sessionStorage|atob|parseJwt|getAuthToken/.test(jwtStorage)) {
  fail("browser token authority remains in auth-storage/jwt compatibility runtime");
}
const browserAuthAudit = spawnSync(process.execPath, [path.join(root, "scripts", "browser-auth-authority-audit.mjs")], { cwd: root, encoding: "utf8" });
evidence.browserAuthAudit = String(browserAuthAudit.stdout || "").trim();
if (browserAuthAudit.status !== 0) fail("browser auth authority audit failed");
const customerSurfaces = [
  "apps/frontend/src/features/commercial/components/client-quick-sheet.tsx",
  "apps/frontend/src/features/commercial/components/commercial-client-detail-page.tsx",
  "apps/frontend/src/features/commercial/components/lead-detail/lead-detail-page.tsx",
].map(read).join("\n");
const provider = read(
  "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx",
);
const logoMutation = provider.match(
  /async updateCustomerLogo[\s\S]*?updateCustomerProfile/,
)?.[0] ?? "";
if (
  customerSurfaces.includes("Salvato localmente sul cliente canonico") ||
  !/await commercialApi\.updateCompany/.test(logoMutation) ||
  !/version: customer\.version/.test(logoMutation)
) {
  fail("customer logo mutation remains explicitly client-only");
}

const orchestrator = read("scripts/commercial-core-isolated-stack.mjs");
for (const forbidden of ["api.doflow.it", "app.doflow.it"]) {
  if (orchestrator.includes(forbidden)) fail(`final isolated orchestrator references ${forbidden}`);
}
for (const required of ["DB_SYNC: \"false\"", "localhost:55432", "redisPort: 56379", "localhost:3401", "localhost:3100", "runFinalAcceptance", "public.doflow_migrations"]) {
  if (!orchestrator.includes(required)) fail(`final isolated orchestrator invariant missing: ${required}`);
}
if (orchestrator.includes("FROM public.migrations")) {
  fail("final isolated orchestrator queries the default TypeORM migration table instead of doflow_migrations");
}

const runtimeAudits = [
  "delivery-core-provider-audit.mjs",
  "commerce-cash-runtime-audit.mjs",
  "document-revenue-runtime-audit.mjs",
  "collaboration-runtime-audit.mjs",
  "automation-performance-runtime-audit.mjs",
];
const auditResults = [];
for (const audit of runtimeAudits) {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", audit)], { cwd: root, encoding: "utf8" });
  auditResults.push({ audit, status: result.status, output: String(result.stdout || "").trim() });
  if (result.status !== 0) fail(`${audit} failed`);
}
evidence.runtimeAudits = auditResults;

const report = {
  status: failures.length ? "BLOCKED" : "PASS",
  failures,
  evidence,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
