import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import test from "node:test"

import {
  auditLegacyReachability,
  auditSemanticTokens,
} from "./audit-doflow-ui-purity.mjs"

function withSourceTree(files, run) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "doflow-ui-purity-"))
  try {
    for (const [relative, source] of Object.entries(files)) {
      const file = path.join(root, relative)
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, source)
    }
    return run(root)
  } finally {
    fs.rmSync(root, { force: true, recursive: true })
  }
}

test("semantic audit includes the generic tenant dashboard graph", () => {
  withSourceTree({
    "app/globals.css": "",
    "app/(tenant)/dashboard/page.tsx": 'import Widget from "./widget"; export default function Page() { return <Widget /> }',
    "app/(tenant)/dashboard/widget.tsx": 'export default function Widget() { return <section className="bg-white text-slate-900" /> }',
  }, (root) => {
    const { findings } = auditSemanticTokens(root)
    assert(findings.some((item) => item.includes("app/(tenant)/dashboard/widget.tsx") && item.includes("fixed white background")))
    assert(findings.some((item) => item.includes("app/(tenant)/dashboard/widget.tsx") && item.includes("legacy slate text")))
  })
})

test("semantic audit checks reachable globals.css selectors and ignores dead selectors", () => {
  withSourceTree({
    "app/globals.css": ".runtime-card { background: #fff; border-radius: 12px; }\n.dead-card { background: #fff; border-radius: 12px; }",
    "app/page.tsx": 'export default function Page() { return <div className="runtime-card" /> }',
  }, (root) => {
    const { findings } = auditSemanticTokens(root)
    assert.equal(findings.length, 2)
    assert(findings.every((item) => item.includes("app/globals.css:1:")))
    assert(findings.some((item) => item.includes("fixed structural CSS color")))
    assert(findings.some((item) => item.includes("fixed structural CSS radius")))
  })
})

test("legacy audit rejects physical df tokens, df selectors, and old Superadmin wrappers in globals.css", () => {
  withSourceTree({
    "app/globals.css": ":root { --df-card: #fff; }\n.df-card { color: var(--df-card); }\n.dashboard-content, .glass-card { display: block; }",
    "app/page.tsx": "export default function Page() { return null }",
  }, (root) => {
    const { findings } = auditLegacyReachability(root)
    assert(findings.some((item) => item.includes("legacy --df-* token remains in global CSS")))
    assert(findings.some((item) => item.includes("legacy .df-* selector remains in global CSS")))
    assert(findings.some((item) => item.includes("legacy Superadmin visual wrapper remains in global CSS")))
  })
})
