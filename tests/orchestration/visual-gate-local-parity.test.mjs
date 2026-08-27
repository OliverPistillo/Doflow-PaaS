import assert from "node:assert/strict"
import fs from "node:fs"
import path from "node:path"
import test from "node:test"

const root = path.resolve(import.meta.dirname, "..", "..")
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8")

test("visual gate pre-deploy delegates only to the deterministic 4864782 harness", () => {
  const gate = read("scripts/visual-gate.mjs")
  assert.match(gate, /playwright\.reference-4864782\.config\.ts/)
  assert.match(gate, /DOFLOW_VISUAL_LOCAL_PARITY/)
  assert.doesNotMatch(gate, /api\.doflow\.it|captureManualAuthentication|acceptance-credentials|currentTotp/)
  assert.doesNotMatch(gate, /storage-state\.json|\/api\/auth\/login|\/api\/auth\/me/)
})

test("production auth QA is separated and names the production origin", () => {
  const gate = read("scripts/visual-gate.mjs")
  assert.match(gate, /--production-auth-qa/)
  assert.match(gate, /PRODUCTION AUTH MUST RUN ON PRODUCTION ORIGIN/)
  assert.match(gate, /https:\/\/app\.doflow\.it/)
})

test("package scripts expose local parity and the explicit post-deploy boundary", () => {
  const packageJson = JSON.parse(read("package.json"))
  assert.equal(packageJson.scripts["visual:gate"], "node scripts/visual-gate.mjs")
  assert.equal(packageJson.scripts["visual:gate:headed"], "node scripts/visual-gate.mjs --headed")
  assert.equal(packageJson.scripts["visual:gate:test"], "playwright test --config=playwright.reference-4864782.config.ts")
  assert.equal(packageJson.scripts["visual:production-auth-qa"], "node scripts/visual-gate.mjs --production-auth-qa")
})

test("auth composition remains the approved d3cc801 authority", () => {
  const auth = read("apps/frontend/src/components/auth/login-experience.tsx")
  assert.match(auth, /Accedi a Doflow/)
  assert.match(auth, /Dal primo contatto alla consegna, tutto nello stesso flusso\./)
  assert.doesNotMatch(auth, /Bentornato|flow-login-journey/)
})
