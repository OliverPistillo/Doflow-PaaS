import assert from "node:assert/strict"
import { spawnSync } from "node:child_process"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  PURITY_SUCCESS,
  auditBuilderContract,
  auditCompatibilitySidebarContract,
  auditDoflowUiPurity,
  auditIdentityAdminContract,
  auditSidebarContract,
  auditTenantLayoutContract,
  auditThemeContract,
  builderItemArrayDepth,
  collectGraphSymbols,
  isInactiveDoflowEdge,
  scanCodeForLegacy,
  scanCssForLegacy,
  traceReachableGraph,
} from "../../scripts/audit-doflow-ui-purity.mjs"

const root = path.resolve(import.meta.dirname, "..", "..")
const frontendSource = path.join(root, "apps", "frontend", "src")

function read(relative) {
  return fs.readFileSync(path.join(frontendSource, relative), "utf8")
}

test("Doflow route graph proves the exact zero-reachable-residue gate", () => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "audit-doflow-ui-purity.mjs")], {
    cwd: root,
    encoding: "utf8",
  })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.equal(result.stderr, "")
  assert.equal(result.stdout.trim(), PURITY_SUCCESS)
})

test("the real Doflow graph covers routes, CSS and the sidebar primitive", () => {
  const result = auditDoflowUiPurity({ repositoryRoot: root })
  const visited = new Set([...result.visited].map((file) => path.relative(frontendSource, file).split(path.sep).join("/")))
  for (const required of [
    "app/globals.css",
    "app/(tenant)/layout.tsx",
    "components/ui/sidebar.tsx",
    "components/app-sidebar.tsx",
    "components/dashboard-header.tsx",
    "components/theme-toggle.tsx",
    "app/(tenant)/dashboard/page.tsx",
    "app/(tenant)/dashboard/commercial/page.tsx",
    "app/(tenant)/commercial/site-proposals/page.tsx",
    "app/(tenant)/dashboard/clienti/page.tsx",
    "app/(tenant)/dashboard/progetti/page.tsx",
    "app/(tenant)/dashboard/team-space/page.tsx",
    "app/(tenant)/dashboard/automazioni/page.tsx",
    "app/(tenant)/dashboard/impostazioni/page.tsx",
  ]) {
    assert.ok(visited.has(required), `missing reachable graph entry: ${required}`)
  }
  for (const compatibilityOnly of [
    "components/layout/legacy-tenant-shell.tsx",
    "components/layout/roomy-sidebar.tsx",
    "components/layout/tenant-sidebar.tsx",
    "components/layout/tenant-sidebar-section.tsx",
    "app/superadmin/components/super-admin-sidebar.tsx",
  ]) {
    assert.equal(visited.has(compatibilityOnly), false, `compatibility module leaked into Doflow graph: ${compatibilityOnly}`)
  }
  assert.equal(result.findings.length, 0, result.findings.join("\n"))
})

test("tenant layout is a graph root and exempts only the exact non-Doflow fallback edge", () => {
  const layoutPath = path.join(frontendSource, "app", "(tenant)", "layout.tsx")
  assert.equal(isInactiveDoflowEdge(frontendSource, layoutPath, "@/components/layout/legacy-tenant-shell"), true)
  assert.equal(isInactiveDoflowEdge(frontendSource, layoutPath, "@/components/layout/tenant-sidebar"), false)
  assert.equal(isInactiveDoflowEdge(frontendSource, layoutPath, "@/components/layout/legacy-tenant-shell-extra"), false)

  const tenantLayout = read("app/(tenant)/layout.tsx")
  assert.deepEqual(auditTenantLayoutContract({ tenantLayout }), [])
  const bad = tenantLayout.replace(
    'import("@/components/layout/legacy-tenant-shell")',
    'import("@/components/layout/tenant-sidebar")',
  )
  const findings = auditTenantLayoutContract({ tenantLayout: bad })
  assert.ok(findings.some((finding) => finding.includes("exactly one explicit non-Doflow")))
  assert.ok(findings.some((finding) => finding.includes("additional legacy compatibility imports")))
})

test("graph traversal follows re-exports, dynamic imports and side-effect CSS but ignores disconnected legacy", (context) => {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), "doflow-purity-"))
  context.after(() => fs.rmSync(fixtureRoot, { recursive: true, force: true }))
  fs.mkdirSync(path.join(fixtureRoot, "nested"), { recursive: true })
  fs.writeFileSync(path.join(fixtureRoot, "entry.tsx"), 'import "./styles.css"\nexport { value } from "./barrel"\nvoid import("./dynamic")\n')
  fs.writeFileSync(path.join(fixtureRoot, "barrel.ts"), 'export { value } from "./nested/value"\n')
  fs.writeFileSync(path.join(fixtureRoot, "nested", "value.ts"), 'export const value = "safe"\n')
  fs.writeFileSync(path.join(fixtureRoot, "dynamic.ts"), 'export const dynamic = true\n')
  fs.writeFileSync(path.join(fixtureRoot, "styles.css"), '@import "./nested/reachable.css";\n')
  fs.writeFileSync(path.join(fixtureRoot, "nested", "reachable.css"), ':root { color: black; }\n')
  fs.writeFileSync(path.join(fixtureRoot, "unused-legacy.tsx"), 'export const unused = "df-card"\n')

  const graph = traceReachableGraph({ sourceRoot: fixtureRoot, entries: [path.join(fixtureRoot, "entry.tsx")] })
  const visited = new Set([...graph.visited].map((file) => path.relative(fixtureRoot, file).split(path.sep).join("/")))
  assert.deepEqual(visited, new Set(["entry.tsx", "styles.css", "barrel.ts", "dynamic.ts", "nested/reachable.css", "nested/value.ts"]))
  assert.equal(visited.has("unused-legacy.tsx"), false)
})

test("CSS audit rejects global legacy tokens and classes while allowing explicitly auth-scoped compatibility", () => {
  const symbols = collectGraphSymbols(['<div className="df-card" style={{ color: "var(--df-accent)" }} />'])
  const findings = scanCssForLegacy(`
    :root { --df-accent: #55f; }
    .df-card { border-radius: 24px; }
    .df-auth-page { --df-auth-text: white; }
    [data-sidebar-kind="tenant-legacy"] .df-card { box-shadow: none; }
  `, "styles.css", symbols)
  assert.ok(findings.some((finding) => finding.includes("custom property")))
  assert.ok(findings.some((finding) => finding.includes("df-* selector")))
  assert.equal(findings.some((finding) => finding.includes("df-auth")), false)
  assert.equal(findings.length, 2, findings.join("\n"))
})

test("code audit catches prior shell, Client Portal and authoritative browser business state", () => {
  const findings = scanCodeForLegacy(`
    import { TenantSidebar, ThemeSettingsDrawer } from "./legacy"
    const loader = <div data-doflow-prepaint="daniele-default" />
    const route = "/client-portal/projects"
    localStorage.setItem("project", JSON.stringify(project))
  `)
  assert.ok(findings.some((finding) => finding.includes("TenantSidebar")))
  assert.ok(findings.some((finding) => finding.includes("ThemeSettingsDrawer")))
  assert.ok(findings.some((finding) => finding.includes("Client Portal")))
  assert.ok(findings.some((finding) => finding.includes("localStorage")))
  assert.ok(findings.some((finding) => finding.includes("visual marker")))
})

test("theme contract requires next-themes, a real header toggle and no shell hard-lock", () => {
  const actualFindings = auditThemeContract({
    rootLayout: read("app/layout.tsx"),
    shell: read("components/layout/doflow-daniele-shell.tsx"),
    header: read("components/dashboard-header.tsx"),
    toggle: read("components/theme-toggle.tsx"),
  })
  assert.deepEqual(actualFindings, [])

  const bad = auditThemeContract({
    rootLayout: '<ThemeProvider attribute="class" forcedTheme="light">',
    shell: 'document.documentElement.classList.remove("dark");',
    header: '<Button aria-label="Tema predefinito Doflow" aria-pressed="true"><Sun /></Button>',
    toggle: 'export function ThemeToggle(){ return <Sun /> }',
  })
  assert.ok(bad.some((finding) => finding.includes("force a single theme")))
  assert.ok(bad.some((finding) => finding.includes("hard-lock")))
  assert.ok(bad.some((finding) => finding.includes("static decorative")))
  assert.ok(bad.some((finding) => finding.includes("next-themes")))
})

test("sidebar contract locks canonical expanded, mobile and icon widths plus collapsed tooltips", () => {
  const actualFindings = auditSidebarContract({
    primitive: read("components/ui/sidebar.tsx"),
    shell: read("components/layout/doflow-daniele-shell.tsx"),
    appSidebar: read("components/app-sidebar.tsx"),
  })
  assert.deepEqual(actualFindings, [])

  const bad = auditSidebarContract({
    primitive: 'const SIDEBAR_WIDTH="280px"; const SIDEBAR_WIDTH_MOBILE="280px"; const SIDEBAR_WIDTH_ICON="72px"; // Figma shadow-card',
    shell: 'style={{ "--sidebar-width": "248px" }}',
    appSidebar: '<Sidebar collapsible="offcanvas" />',
  })
  assert.ok(bad.some((finding) => finding.includes("SIDEBAR_WIDTH must be 16rem")))
  assert.ok(bad.some((finding) => finding.includes("legacy/Figma")))
  assert.ok(bad.some((finding) => finding.includes("must not override")))
})

test("Builder is exactly one capability-gated top-level item and its route gate remains authoritative", () => {
  const appSidebar = read("components/app-sidebar.tsx")
  const actualFindings = auditBuilderContract({
    appSidebar,
    header: read("components/dashboard-header.tsx"),
    gate: read("components/tenant-site-proposals/site-proposals-access-gate.tsx"),
  })
  assert.deepEqual(actualFindings, [])
  const builderOffset = appSidebar.search(/title\s*:\s*["']Builder["']/)
  assert.ok(builderOffset >= 0)
  assert.equal(builderItemArrayDepth(appSidebar, builderOffset), 1)

  const nested = `
    const groups = [{ items: [{ title: "Commerciale", items: [
      { title: "Builder", url: "/commercial/site-proposals", icon: PanelsTopLeft, capability: "canUseBuilder" }
    ] }] }]
    const allowed = !item.capability || hasCapability(item.capability)
  `
  const bad = auditBuilderContract({
    appSidebar: nested,
    header: 'hasCapability("canUseBuilder") && <a href="/commercial/site-proposals" />',
    gate: 'if (!hasCapability("canUseBuilder")) return null',
  })
  assert.ok(bad.some((finding) => finding.includes("top-level")))
})

test("Team-account capability editing keeps explicit grants separate and awaits server booleans", () => {
  const provider = read("features/identity/doflow-identity-provider.tsx")
  const admin = read("components/team-space/doflow-team-account-admin.tsx")
  assert.deepEqual(auditIdentityAdminContract({ provider, admin }), [])

  const badProvider = provider
    .replace("explicitCapabilities: normalized,", "capabilities: normalized,")
    .replace(
      "await apiFetch(\n            `/tenant/doflow/identity/users/${encodeURIComponent(userId)}/capabilities`,",
      "apiFetch(\n            `/tenant/doflow/identity/users/${encodeURIComponent(userId)}/capabilities`,",
    )
  const badAdmin = admin
    .replace("capabilities: identity?.explicitCapabilities || [],", "capabilities: identity?.capabilities || [],")
    .replace("const [rolesSaved, capabilitiesSaved] = await Promise.all([", "const [rolesSaved, capabilitiesSaved] = Promise.all([")
    .concat("\npermissions.map(() => setPermissions([]))")
  const findings = auditIdentityAdminContract({ provider: badProvider, admin: badAdmin })
  assert.ok(findings.some((finding) => finding.includes("store explicit grants separately")))
  assert.ok(findings.some((finding) => finding.includes("await and write only")))
  assert.ok(findings.some((finding) => finding.includes("edit only explicitCapabilities")))
  assert.ok(findings.some((finding) => finding.includes("await and validate both")))
  assert.ok(findings.some((finding) => finding.includes("removed flat permission state")))
})

test("roomy legacy and superadmin geometry remains isolated from the canonical Doflow sidebar", () => {
  const actual = {
    roomy: read("components/layout/roomy-sidebar.tsx"),
    tenantSidebar: read("components/layout/tenant-sidebar.tsx"),
    tenantSection: read("components/layout/tenant-sidebar-section.tsx"),
    legacyShell: read("components/layout/legacy-tenant-shell.tsx"),
    superadminSidebar: read("app/superadmin/components/super-admin-sidebar.tsx"),
    superadminLayout: read("app/superadmin/layout.tsx"),
    doflowShell: read("components/layout/doflow-daniele-shell.tsx"),
    appSidebar: read("components/app-sidebar.tsx"),
    primitive: read("components/ui/sidebar.tsx"),
  }
  assert.deepEqual(auditCompatibilitySidebarContract(actual), [])

  const bad = {
    ...actual,
    roomy: actual.roomy.replace('"h-11 gap-3', '"h-10 gap-3'),
    doflowShell: `${actual.doflowShell}\nimport { RoomySidebarMenuButton } from "@/components/layout/roomy-sidebar"`,
  }
  const findings = auditCompatibilitySidebarContract(bad)
  assert.ok(findings.some((finding) => finding.includes("44px items and 24px icons")))
  assert.ok(findings.some((finding) => finding.includes("must not consume the roomy")))
})
