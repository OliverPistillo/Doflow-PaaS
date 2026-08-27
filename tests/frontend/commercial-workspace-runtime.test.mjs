import assert from "node:assert/strict"
import fs from "node:fs"
import test from "node:test"

const workspace = fs.readFileSync(
  "apps/frontend/src/features/commercial/components/commercial-workspace-page.tsx",
  "utf8",
)

test("commercial workspace renders leads without a next-action date", () => {
  assert.match(workspace, /function formatWorkspaceDateTime\(value\?: string \| Date \| null\)/)
  assert.match(workspace, /if \(!value\) return "—"/)
  assert.match(workspace, /Number\.isNaN\(parsed\.getTime\(\)\) \? "—" : dateTime\.format\(parsed\)/)
  assert.match(workspace, /formatWorkspaceDateTime\(lead\.nextActionAt\)/)
  assert.doesNotMatch(workspace, /dateTime\.format\(new Date\(lead\.nextActionAt\)\)/)
})
