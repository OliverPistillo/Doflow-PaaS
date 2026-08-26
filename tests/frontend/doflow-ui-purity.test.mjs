import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"
import { spawnSync } from "node:child_process"

const root = path.resolve(import.meta.dirname, "..", "..")

test("Doflow replacement route graph is free of legacy shell authority", () => {
  const result = spawnSync(process.execPath, [path.join(root, "scripts", "audit-doflow-ui-purity.mjs")], { cwd: root, encoding: "utf8" })
  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`)
  assert.match(result.stdout, /DOFLOW UI PURITY GO/)
})

test("replacement, Builder and legacy tenant markers remain explicit", () => {
  const shell = fs.readFileSync(path.join(root, "apps/frontend/src/components/layout/doflow-daniele-shell.tsx"), "utf8")
  const tenantLayout = fs.readFileSync(path.join(root, "apps/frontend/src/app/(tenant)/layout.tsx"), "utf8")
  const builder = fs.readFileSync(path.join(root, "apps/frontend/src/components/tenant-site-proposals/site-proposals-access-gate.tsx"), "utf8")
  const legacy = fs.readFileSync(path.join(root, "apps/frontend/src/components/layout/legacy-tenant-shell.tsx"), "utf8")
  const header = fs.readFileSync(path.join(root, "apps/frontend/src/components/dashboard-header.tsx"), "utf8")
  const automationAccess = fs.readFileSync(path.join(root, "apps/frontend/src/components/tenant-automation-center/automation-center-model.ts"), "utf8")
  assert.match(shell, /data-doflow-shell="daniele-design"/)
  assert.match(shell, /data-doflow-theme="default"/)
  assert.match(shell, /data-doflow-ui-generation="replacement"/)
  assert.match(tenantLayout, /data-doflow-prepaint="daniele-default"/)
  assert.match(builder, /data-builder-shell="daniele-design"/)
  assert.match(legacy, /data-sidebar-kind="tenant-legacy"/)
  assert.match(header, /\bh-16 min-h-16\b/)
  assert.doesNotMatch(header, /h-\[73px\]/)
  assert.match(automationAccess, /hasCapability\("canViewAutomations"\)/)
})

test("canonical target navigation remains complete", () => {
  const sidebar = fs.readFileSync(path.join(root, "apps/frontend/src/components/app-sidebar.tsx"), "utf8")
  for (const label of ["Panoramica", "Inbox", "Team Space", "Commerciale", "Clienti", "Lavoro", "Vendite", "Calendario", "Supporto", "Documenti", "Flow Arcade", "Automazioni", "Impostazioni", "Aiuto e tutorial", "Builder"]) {
    assert.match(sidebar, new RegExp(`title: \\"${label}\\"`), label)
  }
})
