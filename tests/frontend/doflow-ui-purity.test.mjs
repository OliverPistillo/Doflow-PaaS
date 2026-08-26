import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  ARCADE_SUCCESS,
  LEGACY_SUCCESS,
  SEMANTIC_SUCCESS,
  auditArcadeReachability,
  auditLegacyReachability,
  auditSemanticTokens,
  auditShellContracts,
  discoverEntries,
  runAudit,
  traceReachableGraph,
} from "../../scripts/audit-doflow-ui-purity.mjs"

const repositoryRoot = path.resolve(import.meta.dirname, "..", "..")
const frontendSource = path.join(repositoryRoot, "apps", "frontend", "src")

test("global route graph roots auth, tenant, Builder and platform surfaces", () => {
  const entries = discoverEntries(frontendSource).map((file) => path.relative(frontendSource, file).replaceAll("\\", "/"))
  assert.ok(entries.includes("app/layout.tsx"))
  assert.ok(entries.includes("app/(tenant)/layout.tsx"))
  assert.ok(entries.includes("app/superadmin/layout.tsx"))
  assert.ok(entries.includes("app/login/page.tsx"))
  assert.ok(entries.includes("app/(tenant)/commercial/site-proposals/page.tsx"))

  const reachable = new Set([...traceReachableGraph(frontendSource)].map((file) => path.relative(frontendSource, file).replaceAll("\\", "/")))
  assert.ok(reachable.has("components/layout/tenant-app-shell.tsx"))
  assert.ok(reachable.has("components/layout/platform-app-shell.tsx"))
  assert.ok(reachable.has("components/ui/sidebar.tsx"))
  assert.ok(reachable.has("components/auth/auth-shell.tsx"))
})

test("graph traversal follows re-exports, dynamic imports and CSS imports", (context) => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), "universal-ui-graph-"))
  context.after(() => fs.rmSync(fixture, { recursive: true, force: true }))
  fs.mkdirSync(path.join(fixture, "nested"), { recursive: true })
  fs.writeFileSync(path.join(fixture, "entry.tsx"), 'import "./styles.css"\nexport { value } from "./barrel"\nvoid import("./dynamic")\n')
  fs.writeFileSync(path.join(fixture, "styles.css"), '@import "./nested/reachable.css";\n')
  fs.writeFileSync(path.join(fixture, "nested", "reachable.css"), ':root { color: black; }\n')
  fs.writeFileSync(path.join(fixture, "barrel.ts"), 'export { value } from "./nested/value"\n')
  fs.writeFileSync(path.join(fixture, "nested", "value.ts"), 'export const value = true\n')
  fs.writeFileSync(path.join(fixture, "dynamic.ts"), 'export const dynamic = true\n')
  const visited = new Set([...traceReachableGraph(fixture, [path.join(fixture, "entry.tsx")])].map((file) => path.relative(fixture, file).replaceAll("\\", "/")))
  assert.deepEqual(visited, new Set(["entry.tsx", "styles.css", "barrel.ts", "dynamic.ts", "nested/reachable.css", "nested/value.ts"]))
})

test("universal shell contracts preserve tenant access, platform authorization and Builder capability", () => {
  assert.deepEqual(auditShellContracts(frontendSource), [])
})

test("excluded arcade surface has zero frontend reachability", () => {
  assert.deepEqual(auditArcadeReachability(frontendSource), [])
  assert.equal(ARCADE_SUCCESS, "FLOW ARCADE FRONTEND REACHABILITY = 0")
})

test("reachable legacy visuals and structural colors are rejected", () => {
  assert.deepEqual(auditLegacyReachability(frontendSource).findings, [])
  assert.deepEqual(auditSemanticTokens(frontendSource).findings, [])
  assert.equal(LEGACY_SUCCESS, "GLOBAL FRONTEND LEGACY VISUAL RESIDUE = 0 REACHABLE")
  assert.equal(SEMANTIC_SUCCESS, "UNIVERSAL UI SEMANTIC TOKEN COMPLIANCE = PASS")
})

test("combined purity gate is green", () => {
  const result = runAudit(frontendSource)
  assert.deepEqual(result.legacyFindings, [])
  assert.deepEqual(result.semanticFindings, [])
  assert.deepEqual(result.arcadeFindings, [])
})
