import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

export const LEGACY_SUCCESS = "GLOBAL FRONTEND LEGACY VISUAL RESIDUE = 0 REACHABLE"
export const SEMANTIC_SUCCESS = "UNIVERSAL UI SEMANTIC TOKEN COMPLIANCE = PASS"
export const ARCADE_SUCCESS = "FLOW ARCADE FRONTEND REACHABILITY = 0"

const SCRIPT_DIR = path.dirname(fileURLToPath(import.meta.url))
const REPOSITORY_ROOT = path.resolve(SCRIPT_DIR, "..")
const FRONTEND_SOURCE = path.join(REPOSITORY_ROOT, "apps", "frontend", "src")
const CODE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]
const STYLE_EXTENSIONS = [".css", ".scss", ".sass"]
const RESOLVABLE_EXTENSIONS = [...CODE_EXTENSIONS, ...STYLE_EXTENSIONS, ".json"]
const NEXT_ROUTE_FILE = /^(?:page|layout|template|loading|error|not-found)\.(?:ts|tsx|js|jsx)$/
const PERSONAL_RUNTIME_NAME = ["dani", "ele"].join("")

const REQUIRED_GRAPH_ROOTS = [
  "app/layout.tsx",
  "app/globals.css",
  "app/(tenant)/layout.tsx",
  "app/superadmin/layout.tsx",
  "components/layout/tenant-app-shell.tsx",
  "components/layout/platform-app-shell.tsx",
  "components/ui/sidebar.tsx",
]

const FORBIDDEN_FILES = [
  "components/layout/legacy-tenant-shell.tsx",
  "components/layout/roomy-sidebar.tsx",
  "components/layout/tenant-sidebar.tsx",
  "components/layout/tenant-sidebar-section.tsx",
  "components/layout/theme-settings-drawer.tsx",
]

const SEMANTIC_SCOPE = [
  "app/(tenant)/dashboard/",
  "app/(tenant)/commercial/site-proposals/",
  "app/superadmin/",
  "app/login/",
  "app/signup/",
  "app/register/",
  "app/forgot-password/",
  "app/reset-password/",
  "app/auth/",
  "app/[tenant]/mfa/",
  "components/auth/",
  "components/flow-experience/",
  "components/layout/",
  "components/tenant-bonus/",
  "components/tenant-collaboration/",
  "components/tenant-company-intelligence/",
  "components/tenant-flowboard/",
  "components/tenant-inbox/",
  "components/tenant-site-proposals/",
  "components/ui/",
  "components/app-sidebar.tsx",
  "components/dashboard-header.tsx",
  "components/team-switcher.tsx",
  "features/commercial/components/quote-preview-page.tsx",
]

const STRUCTURAL_COLOR_PATTERNS = [
  { label: "fixed white background", pattern: /\bbg-white(?:\/\d+)?\b/g },
  { label: "legacy slate text", pattern: /\btext-slate-\d+(?:\/\d+)?\b/g },
  { label: "legacy slate border", pattern: /\bborder-slate-\d+(?:\/\d+)?\b/g },
  { label: "legacy indigo structural color", pattern: /\b(?:bg|text|border)-indigo-\d+(?:\/\d+)?\b/g },
  { label: "legacy radius alias", pattern: /\brounded-(?:card|nav)\b/g },
  { label: "legacy shadow alias", pattern: /\bshadow-card\b/g },
]

const STRUCTURAL_CSS_PATTERNS = [
  { label: "fixed structural CSS color", pattern: /\b(?:background(?:-color)?|border(?:-color)?|color)\s*:[^;}]*?(?:#[0-9a-f]{3,8}\b|rgba?\()/gi },
  { label: "fixed structural CSS radius", pattern: /\bborder-radius\s*:\s*(?!var\(|50%\b|999px\b)[0-9.]+(?:px|rem)\b/gi },
  { label: "legacy CSS radius token", pattern: /var\(\s*--radius-(?:card|nav)\b/gi },
  { label: "legacy CSS shadow token", pattern: /var\(\s*--shadow-(?:card|button|sm|md|lg)\b/gi },
]

const GLOBAL_CSS_LEGACY_PATTERNS = [
  { label: "legacy .df-* selector remains in global CSS", pattern: /\.df-[a-z0-9-]+\b/gi },
  { label: "legacy --df-* token remains in global CSS", pattern: /--df-[a-z0-9-]+\b/gi },
  { label: "legacy Superadmin visual wrapper remains in global CSS", pattern: /\.(?:dashboard-content|glass-card)\b/gi },
]

function unixPath(value) {
  return value.split(path.sep).join("/")
}

function relativeTo(root, file) {
  return unixPath(path.relative(root, file))
}

function walkFiles(directory) {
  if (!fs.existsSync(directory)) return []
  const files = []
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...walkFiles(absolute))
    else files.push(absolute)
  }
  return files
}

function read(file) {
  return fs.readFileSync(file, "utf8")
}

function resolveCandidate(base) {
  const candidates = [base]
  for (const extension of RESOLVABLE_EXTENSIONS) candidates.push(`${base}${extension}`)
  for (const extension of RESOLVABLE_EXTENSIONS) candidates.push(path.join(base, `index${extension}`))
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) || null
}

function importRequests(source, extension) {
  const requests = []
  if (STYLE_EXTENSIONS.includes(extension)) {
    for (const match of source.matchAll(/@import\s+(?:url\()?\s*["']([^"']+)["']/g)) requests.push(match[1])
    return requests
  }
  for (const match of source.matchAll(/(?:import|export)\s+(?:[^"']*?\sfrom\s*)?["']([^"']+)["']/g)) requests.push(match[1])
  for (const match of source.matchAll(/import\(\s*["']([^"']+)["']\s*\)/g)) requests.push(match[1])
  for (const match of source.matchAll(/require\(\s*["']([^"']+)["']\s*\)/g)) requests.push(match[1])
  return requests
}

function resolveImport(sourceRoot, importer, request) {
  if (!request || request.startsWith("node:") || request.startsWith("http:") || request.startsWith("https:")) return null
  const clean = request.split(/[?#]/, 1)[0]
  if (!clean.startsWith(".") && !clean.startsWith("@/")) return null
  const base = clean.startsWith("@/")
    ? path.join(sourceRoot, clean.slice(2))
    : path.resolve(path.dirname(importer), clean)
  const resolved = resolveCandidate(base)
  return resolved && resolved.startsWith(sourceRoot) ? resolved : null
}

export function discoverEntries(sourceRoot = FRONTEND_SOURCE) {
  const routeEntries = walkFiles(path.join(sourceRoot, "app")).filter((file) => NEXT_ROUTE_FILE.test(path.basename(file)))
  return [...new Set([
    ...REQUIRED_GRAPH_ROOTS.map((relative) => path.join(sourceRoot, relative)),
    ...routeEntries,
  ])].filter(fs.existsSync)
}

export function traceReachableGraph(sourceRoot = FRONTEND_SOURCE, entries = discoverEntries(sourceRoot)) {
  const visited = new Set()
  const queue = [...entries]
  while (queue.length) {
    const file = queue.shift()
    if (!file || visited.has(file) || !fs.existsSync(file)) continue
    visited.add(file)
    const source = read(file)
    for (const request of importRequests(source, path.extname(file).toLowerCase())) {
      const resolved = resolveImport(sourceRoot, file, request)
      if (resolved && !visited.has(resolved)) queue.push(resolved)
    }
  }
  return visited
}

function finding(file, source, offset, message) {
  const line = source.slice(0, offset).split(/\r?\n/).length
  return `${file}:${line}: ${message}`
}

function scanMatches(source, file, rules) {
  const findings = []
  for (const { label, pattern } of rules) {
    pattern.lastIndex = 0
    for (const match of source.matchAll(pattern)) findings.push(finding(file, source, match.index, label))
  }
  return findings
}

function classSymbols(reachable, sourceRoot) {
  const classes = new Set()
  const variables = new Set()
  const attributes = new Set()
  for (const file of reachable) {
    if (!CODE_EXTENSIONS.includes(path.extname(file).toLowerCase())) continue
    const source = read(file)
    for (const match of source.matchAll(/\b(?:className|class)\s*=\s*(?:\{?\s*)?["'`]([^"'`]+)["'`]/g)) {
      for (const token of match[1].split(/\s+/)) if (/^[a-z_][a-z0-9_-]*$/i.test(token)) classes.add(token)
    }
    for (const match of source.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)) variables.add(match[1].toLowerCase())
    for (const match of source.matchAll(/\b(data-[a-z0-9-]+)\s*=/gi)) attributes.add(match[1].toLowerCase())
  }
  return { attributes, classes, variables, sourceRoot }
}

function cssSelectorIsReachable(selector, symbols) {
  return selector.split(",").some((branch) => {
    const classes = [...branch.matchAll(/\.([a-z_][a-z0-9_-]*)/gi)]
      .map((match) => match[1])
      .filter((name) => name !== "dark")
    const attributes = [...branch.matchAll(/\[(data-[a-z0-9-]+)/gi)].map((match) => match[1].toLowerCase())
    if (classes.length === 0 && attributes.length === 0) return false
    return classes.every((name) => symbols.classes.has(name))
      && attributes.every((name) => symbols.attributes.has(name))
  })
}

function cssSemanticException(selector, label) {
  const artworkOrStatus = /(?:chart|status|badge|logo|mascot|illustration|media|spark|strength|error|success|\bdot\b)/i.test(selector)
  return artworkOrStatus && /color|shadow/i.test(label)
}

function cssSemanticFindings(file, source, symbols) {
  const findings = []
  for (const block of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = block[1]
    const body = block[2]
    if (!cssSelectorIsReachable(selector, symbols)) continue
    for (const rule of [...STRUCTURAL_COLOR_PATTERNS, ...STRUCTURAL_CSS_PATTERNS]) {
      if (cssSemanticException(selector, rule.label)) continue
      rule.pattern.lastIndex = 0
      for (const match of body.matchAll(rule.pattern)) {
        findings.push(finding(file, source, block.index + selector.length + match.index, rule.label))
      }
    }
  }
  return findings
}

function cssBlockFindings(file, source, symbols) {
  const findings = []
  for (const block of source.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = block[1]
    const body = block[2]
    const usedLegacyClass = [...selector.matchAll(/\.((?:df)-[a-z0-9-]+)/gi)]
      .some((match) => symbols.classes.has(match[1]))
    if (usedLegacyClass) findings.push(finding(file, source, block.index, "reachable legacy .df-* selector"))
    for (const match of body.matchAll(/var\(\s*(--df-[a-z0-9-]+)/gi)) {
      if (symbols.variables.has(match[1].toLowerCase()) || usedLegacyClass) {
        findings.push(finding(file, source, block.index + selector.length + match.index, "reachable legacy --df-* token"))
      }
    }
    const sidebarSelector = /\[data-sidebar(?:=|\])/i.test(selector)
    const universalScope = /\[data-tenant-ui=["']universal["']\]/i.test(selector)
    const legacyOverride = /!important|var\(\s*--(?:df|radius-nav|shadow-card)|backdrop-filter/i.test(body)
    if (sidebarSelector && !universalScope && legacyOverride) {
      const selectorClasses = [...selector.matchAll(/\.([a-z_][a-z0-9_-]*)/gi)].map((match) => match[1])
      if (selectorClasses.length === 0 || selectorClasses.some((name) => symbols.classes.has(name))) {
        findings.push(finding(file, source, block.index, "reachable unscoped legacy sidebar override"))
      }
    }
  }
  return findings
}

export function auditLegacyReachability(sourceRoot = FRONTEND_SOURCE) {
  const reachable = traceReachableGraph(sourceRoot)
  const symbols = classSymbols(reachable, sourceRoot)
  const findings = []
  const personalPattern = new RegExp(`\\b${PERSONAL_RUNTIME_NAME}\\b`, "gi")
  const codeRules = [
    { label: "personal-name runtime identifier", pattern: personalPattern },
    { label: "LegacyTenantShell is reachable", pattern: /\bLegacyTenantShell\b/g },
    { label: "ThemeSettingsDrawer is reachable", pattern: /\bThemeSettingsDrawer\b/g },
    { label: "roomy sidebar adapter is reachable", pattern: /\bRoomySidebar\w*\b|roomy-sidebar/gi },
    { label: "legacy tenant sidebar is reachable", pattern: /legacy-tenant-shell|tenant-sidebar-section/gi },
    { label: "reachable legacy .df-* class", pattern: /["'`\s](df-[a-z0-9-]+)\b/gi },
    { label: "reachable legacy --df-* token", pattern: /--df-[a-z0-9-]+\b/gi },
    { label: "reachable legacy Superadmin visual wrapper", pattern: /["'`\s](?:dashboard-content|glass-card)\b/gi },
  ]
  for (const file of reachable) {
    const relative = relativeTo(sourceRoot, file)
    const source = read(file)
    if (STYLE_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
      findings.push(...cssBlockFindings(relative, source, symbols))
      if (relative === "app/globals.css") findings.push(...scanMatches(source, relative, GLOBAL_CSS_LEGACY_PATTERNS))
    }
    else findings.push(...scanMatches(source, relative, codeRules))
  }
  for (const forbidden of FORBIDDEN_FILES) {
    const absolute = path.join(sourceRoot, forbidden)
    if (reachable.has(absolute)) findings.push(`${forbidden}: reachable forbidden visual layer`)
  }
  return { findings: [...new Set(findings)].sort(), reachable }
}

function semanticException(line) {
  return /data-semantic-color-exception=["'](?:qr-code|chart|status|brand-art|media)["']/.test(line)
}

export function auditSemanticTokens(sourceRoot = FRONTEND_SOURCE) {
  const reachable = traceReachableGraph(sourceRoot)
  const symbols = classSymbols(reachable, sourceRoot)
  const findings = []
  for (const file of reachable) {
    const relative = relativeTo(sourceRoot, file)
    if (STYLE_EXTENSIONS.includes(path.extname(file).toLowerCase())) {
      if (relative === "app/globals.css") findings.push(...cssSemanticFindings(relative, read(file), symbols))
      continue
    }
    if (!CODE_EXTENSIONS.includes(path.extname(file).toLowerCase())) continue
    if (!SEMANTIC_SCOPE.some((scope) => relative === scope || relative.startsWith(scope))) continue
    const source = read(file)
    const lines = source.split(/\r?\n/)
    lines.forEach((line, index) => {
      if (semanticException(line)) return
      for (const { label, pattern } of STRUCTURAL_COLOR_PATTERNS) {
        pattern.lastIndex = 0
        if (pattern.test(line)) findings.push(`${relative}:${index + 1}: ${label}`)
      }
    })
  }
  return { findings: [...new Set(findings)].sort(), reachable }
}

export function auditShellContracts(sourceRoot = FRONTEND_SOURCE) {
  const findings = []
  const source = (relative) => read(path.join(sourceRoot, relative))
  const tenantLayout = source("app/(tenant)/layout.tsx")
  const tenantShell = source("components/layout/tenant-app-shell.tsx")
  const platformLayout = source("app/superadmin/layout.tsx")
  const platformShell = source("components/layout/platform-app-shell.tsx")
  const sidebar = source("components/ui/sidebar.tsx")
  const appSidebar = source("components/app-sidebar.tsx")
  const header = source("components/dashboard-header.tsx")
  const builderGate = source("components/tenant-site-proposals/site-proposals-access-gate.tsx")
  const tenantNavigation = source("config/tenant-navigation.ts")

  if (!/import\(["']@\/components\/layout\/tenant-app-shell["']\)/.test(tenantLayout) || !/<TenantAppShell\s+session=\{session\}>/.test(tenantLayout)) findings.push("app/(tenant)/layout.tsx: every normal tenant must use TenantAppShell with its server session")
  if (/LegacyTenantShell|legacy-tenant-shell/.test(tenantLayout)) findings.push("app/(tenant)/layout.tsx: legacy tenant fallback remains")
  if (!/PlanProvider/.test(tenantShell) || !/TenantAccessProvider/.test(tenantShell)) findings.push("components/layout/tenant-app-shell.tsx: future tenants must use Plan and TenantAccess")
  if (!/isDoflow/.test(tenantShell) || !/DoflowIdentityProvider/.test(tenantShell)) findings.push("components/layout/tenant-app-shell.tsx: Doflow extensions must stay explicit and isolated")
  if (!/PlatformAppShell/.test(platformLayout) || !/\/auth\/me/.test(platformLayout) || !/tenant\s*===\s*["']public["']/.test(platformLayout)) findings.push("app/superadmin/layout.tsx: PlatformAppShell must preserve the platform auth boundary")
  if (!/SidebarProvider/.test(platformShell) || !/SuperAdminSidebar/.test(platformShell)) findings.push("components/layout/platform-app-shell.tsx: platform shell must use the shared sidebar primitive")
  if (!/SIDEBAR_WIDTH\s*=\s*["']16rem["']/.test(sidebar) || !/SIDEBAR_WIDTH_MOBILE\s*=\s*["']18rem["']/.test(sidebar) || !/SIDEBAR_WIDTH_ICON\s*=\s*["']3rem["']/.test(sidebar)) findings.push("components/ui/sidebar.tsx: reference 4864782 16rem/18rem/3rem geometry changed")
  const builderItems = [...appSidebar.matchAll(/title\s*:\s*["']Builder["']/g)]
  if (builderItems.length !== 1 || !/title\s*:\s*["']Builder["'][^\n]*url\s*:\s*["']\/commercial\/site-proposals["'][^\n]*capability\s*:\s*["']canUseBuilder["']/.test(appSidebar)) findings.push("components/app-sidebar.tsx: Builder must remain one top-level canUseBuilder item")
  if (/SiteProposalDialog|data-flow-tour=["']flow-builder["']/.test(header)) findings.push("components/dashboard-header.tsx: reference 4864782 keeps Builder out of the header shortcuts")
  if (!/hasCapability\(["']canUseBuilder["']\)/.test(builderGate)) findings.push("components/tenant-site-proposals/site-proposals-access-gate.tsx: Builder route gate must remain capability-gated")
  for (const [route, capability] of [
    ["/dashboard/inbox", "canReadNotifications"],
    ["/dashboard/team-space", "canViewProjects"],
    ["/dashboard/flowboard", "canViewProjects"],
    ["/dashboard/company-intelligence", "canViewAssignedLeads"],
    ["/dashboard/bonus", "canViewOwnPoints"],
  ]) {
    if (!tenantShell.includes(`["${route}", "${capability}"]`)) findings.push(`components/layout/tenant-app-shell.tsx: ${route} must enforce ${capability}`)
  }
  for (const [route, moduleKey] of [
    ["/dashboard/inbox", "notifications"],
    ["/dashboard/team-space", "team"],
    ["/dashboard/flowboard", "projects"],
    ["/dashboard/company-intelligence", "crm"],
    ["/dashboard/bonus", "reports"],
  ]) {
    if (!tenantNavigation.includes(`["${route}", "${moduleKey}"]`)) findings.push(`config/tenant-navigation.ts: ${route} must enforce ${moduleKey} for future tenants`)
  }
  return findings
}

export function auditArcadeReachability(sourceRoot = FRONTEND_SOURCE) {
  const findings = []
  const pattern = /flow[- ]arcade|\/dashboard\/flow-arcade|\bGamepad2\b/gi
  for (const file of walkFiles(sourceRoot).filter((candidate) => CODE_EXTENSIONS.includes(path.extname(candidate).toLowerCase()))) {
    const source = read(file)
    pattern.lastIndex = 0
    if (pattern.test(source)) findings.push(`${relativeTo(sourceRoot, file)}: excluded arcade surface remains`)
  }
  return findings.sort()
}

export function runAudit(sourceRoot = FRONTEND_SOURCE) {
  const legacy = auditLegacyReachability(sourceRoot)
  const semantic = auditSemanticTokens(sourceRoot)
  const contracts = auditShellContracts(sourceRoot)
  const arcade = auditArcadeReachability(sourceRoot)
  return {
    legacyFindings: [...new Set([...legacy.findings, ...contracts])].sort(),
    semanticFindings: semantic.findings,
    arcadeFindings: arcade,
    reachable: legacy.reachable,
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = runAudit()
  for (const item of result.legacyFindings) console.error(`[legacy] ${item}`)
  for (const item of result.semanticFindings) console.error(`[semantic] ${item}`)
  for (const item of result.arcadeFindings) console.error(`[arcade] ${item}`)
  if (result.legacyFindings.length || result.semanticFindings.length || result.arcadeFindings.length) {
    console.error(`GLOBAL FRONTEND LEGACY VISUAL RESIDUE = ${result.legacyFindings.length} REACHABLE`)
    console.error(`UNIVERSAL UI SEMANTIC TOKEN COMPLIANCE = ${result.semanticFindings.length ? "FAIL" : "PASS"}`)
    console.error(`FLOW ARCADE FRONTEND REACHABILITY = ${result.arcadeFindings.length}`)
    process.exitCode = 1
  } else {
    console.log(LEGACY_SUCCESS)
    console.log(SEMANTIC_SUCCESS)
    console.log(ARCADE_SUCCESS)
  }
}
