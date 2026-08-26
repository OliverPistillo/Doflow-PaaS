import fs from "node:fs"
import path from "node:path"
import process from "node:process"

const root = process.cwd()
const sourceRoot = path.join(root, "apps", "frontend", "src")
const entries = [
  path.join(sourceRoot, "components", "layout", "doflow-daniele-shell.tsx"),
  path.join(sourceRoot, "components", "tenant-site-proposals", "site-proposals-access-gate.tsx"),
  path.join(sourceRoot, "components", "auth", "login-experience.tsx"),
  path.join(sourceRoot, "components", "auth", "auth-shell.tsx"),
]

function walk(directory, accept) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target, accept) : accept(target) ? [target] : []
  })
}

entries.push(
  ...walk(path.join(sourceRoot, "app", "(tenant)", "dashboard"), (file) => /\.(?:ts|tsx)$/.test(file)),
  ...walk(path.join(sourceRoot, "app", "(tenant)", "commercial", "site-proposals"), (file) => /\.(?:ts|tsx)$/.test(file)),
)

const extensions = [".ts", ".tsx", ".js", ".jsx"]
function resolveImport(from, request) {
  if (!request.startsWith("@/") && !request.startsWith(".")) return null
  const base = request.startsWith("@/") ? path.join(sourceRoot, request.slice(2)) : path.resolve(path.dirname(from), request)
  const candidates = [base, ...extensions.map((extension) => `${base}${extension}`), ...extensions.map((extension) => path.join(base, `index${extension}`))]
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null
}

const visited = new Set()
const queue = [...new Set(entries)]
const findings = []
const banned = [
  { label: "TenantSidebar", pattern: /\bTenantSidebar\b/ },
  { label: "LegacyTenantLayout", pattern: /\bLegacyTenantLayout\b/ },
  { label: "ThemeSettingsDrawer", pattern: /\bThemeSettingsDrawer\b/ },
  { label: "legacy doflow-topbar class", pattern: /className\s*=\s*["'`][^"'`]*\bdoflow-topbar\b/ },
  { label: "authoritative fixture import", pattern: /(?:from\s+|import\s*\()["'][^"']*(?:fixtures?|demo-data)[^"']*["']/i },
  { label: "Client Portal", pattern: /(?:ClientPortal|client-portal|["']\/client\/)/i },
  { label: "business localStorage", pattern: /localStorage\.(?:getItem|setItem)\([^\n]*(?:lead|customer|project|catalog|sale|order|payment|refund|invoice|contract)/i },
]

while (queue.length) {
  const file = queue.shift()
  if (!file || visited.has(file) || !file.startsWith(sourceRoot)) continue
  visited.add(file)
  const source = fs.readFileSync(file, "utf8")
  for (const rule of banned) {
    if (rule.pattern.test(source)) findings.push(`${path.relative(root, file)}: ${rule.label}`)
  }
  const imports = source.matchAll(/(?:from\s+|import\s*\()["']([^"']+)["']/g)
  for (const match of imports) {
    const resolved = resolveImport(file, match[1])
    if (resolved && !visited.has(resolved)) queue.push(resolved)
  }
}

const shell = fs.readFileSync(path.join(sourceRoot, "components", "layout", "doflow-daniele-shell.tsx"), "utf8")
const builder = fs.readFileSync(path.join(sourceRoot, "components", "tenant-site-proposals", "site-proposals-access-gate.tsx"), "utf8")
for (const marker of ["data-doflow-shell=\"daniele-design\"", "data-doflow-theme=\"default\"", "data-doflow-ui-generation=\"replacement\""]) {
  if (!shell.includes(marker)) findings.push(`missing shell marker: ${marker}`)
}
if (!builder.includes("data-builder-shell=\"daniele-design\"")) findings.push("missing Builder shell marker")

if (findings.length) {
  console.error("DOFLOW UI PURITY BLOCKED")
  for (const finding of findings) console.error(`- ${finding}`)
  process.exit(1)
}

console.log(`DOFLOW UI PURITY GO (${visited.size} source modules checked, ${entries.length} route entries)`)
