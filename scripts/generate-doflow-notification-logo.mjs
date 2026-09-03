import { createHash } from "node:crypto"
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const sourcePath = resolve(repoRoot, "apps/desktop/src-tauri/icons/icon.png")
const outputPath = resolve(repoRoot, "apps/desktop/src-tauri/icons/notification-app-logo.png")
const expectedSha256 = "882116585a3bf34d595b57663748681c42f2c02983a0de3e8b1554a7876b3dfa"

const bytes = readFileSync(sourcePath)
const sha256 = createHash("sha256").update(bytes).digest("hex")
if (sha256 !== expectedSha256) {
  throw new Error("The canonical Windows brand tile is not the validated deterministic input")
}

writeFileSync(outputPath, bytes)
console.log(`Doflow notification logo generated: ${sha256}`)
