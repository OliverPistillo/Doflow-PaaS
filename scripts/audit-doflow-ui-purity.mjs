import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { pathToFileURL } from "node:url"

export const PURITY_SUCCESS = "DOFLOW FRONTEND LEGACY RESIDUE = 0 REACHABLE"

const MODULE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".mts",
  ".cts",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".sass",
  ".json",
]
const NEXT_ROUTE_FILE = /^(?:page|layout|template|loading|error|not-found)\.(?:ts|tsx|js|jsx)$/
const REQUIRED_ROUTE_ENTRIES = [
  "app/(tenant)/dashboard/page.tsx",
  "app/(tenant)/dashboard/commercial/page.tsx",
  "app/(tenant)/commercial/site-proposals/page.tsx",
  "app/(tenant)/dashboard/clienti/page.tsx",
  "app/(tenant)/dashboard/progetti/page.tsx",
  "app/(tenant)/dashboard/team-space/page.tsx",
  "app/(tenant)/dashboard/automazioni/page.tsx",
  "app/(tenant)/dashboard/impostazioni/page.tsx",
]
const REQUIRED_GRAPH_ROOTS = [
  "app/layout.tsx",
  "app/(tenant)/layout.tsx",
  "app/globals.css",
  "components/layout/doflow-daniele-shell.tsx",
  "components/app-sidebar.tsx",
  "components/dashboard-header.tsx",
  "components/theme-toggle.tsx",
  "components/ui/sidebar.tsx",
  "components/tenant-site-proposals/site-proposals-access-gate.tsx",
]

const CODE_RULES = [
  { label: "legacy TenantSidebar component", pattern: /\bTenantSidebar\b/gi },
  { label: "legacy LegacyTenantLayout component", pattern: /\bLegacyTenantLayout\b/gi },
  { label: "legacy LegacyTenantShell component", pattern: /\bLegacyTenantShell\b/gi },
  { label: "legacy ThemeSettingsDrawer component", pattern: /\bThemeSettingsDrawer\b/gi },
  { label: "legacy doflow-topbar class", pattern: /(?<!--)\bdoflow-topbar\b/gi },
  { label: "legacy df-* class or token", pattern: /\bdf-(?!auth(?:-|\b)|login(?:-|\b))[a-z0-9-]+\b/gi },
  { label: "legacy --df-* custom property", pattern: /--df-(?!auth(?:-|\b))[a-z0-9-]+\b/gi },
  { label: "late Daniele visual token", pattern: /--daniele-[a-z0-9-]+\b/gi },
  { label: "Figma-era visual primitive", pattern: /\bfigma\b/gi },
  { label: "legacy rounded-card primitive", pattern: /\brounded-card\b/gi },
  { label: "legacy rounded-nav primitive", pattern: /\brounded-nav\b/gi },
  { label: "legacy shadow-card primitive", pattern: /\bshadow-card\b/gi },
  {
    label: "superseded default/Daniele visual marker",
    pattern: /data-(?:doflow-(?:theme|prepaint|shell)|builder-shell)\s*=\s*["'](?:default|daniele-(?:default|design))["']/gi,
  },
  {
    label: "authoritative fixture or demo-data import",
    pattern: /(?:from\s+|import\s*\()["'][^"']*(?:fixtures?|demo-data)[^"']*["']/gi,
  },
  {
    label: "removed Client Portal surface",
    pattern: /(?:\bClientPortal\b|client-portal|["']\/client(?:\/|["'])|["']\/client-portal(?:\/|["']))/gi,
  },
  {
    label: "authoritative business state in localStorage",
    pattern: /(?:window\.)?localStorage\.(?:getItem|setItem)\([^\n]*(?:lead|customer|project|catalog|sale|order|payment|refund|invoice|contract)/gi,
  },
]

function walk(directory, accept) {
  if (!fs.existsSync(directory)) return []
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const target = path.join(directory, entry.name)
    return entry.isDirectory() ? walk(target, accept) : accept(target) ? [target] : []
  })
}

function unixRelative(root, file) {
  return path.relative(root, file).split(path.sep).join("/")
}

function isInside(parent, candidate) {
  const relative = path.relative(parent, candidate)
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative))
}

function lineNumber(source, offset) {
  return source.slice(0, Math.max(0, offset)).split(/\r?\n/).length
}

function addFinding(findings, seen, file, source, offset, label) {
  const location = `${file}:${lineNumber(source, offset)}`
  const finding = `${location}: ${label}`
  if (!seen.has(finding)) {
    seen.add(finding)
    findings.push(finding)
  }
}

export function extractImportRequests(source, extension = ".tsx") {
  const requests = new Set()
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/g,
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/g,
    /\bimport\s*["']([^"']+)["']/g,
  ]
  if ([".css", ".scss", ".sass"].includes(extension)) {
    patterns.push(/@import\s+(?:url\(\s*)?["']([^"']+)["']/g)
  }
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) requests.add(match[1])
  }
  return [...requests]
}

export function resolveLocalImport(sourceRoot, from, request) {
  if (!request.startsWith("@/") && !request.startsWith(".")) return null
  const cleanRequest = request.split(/[?#]/, 1)[0]
  const base = cleanRequest.startsWith("@/")
    ? path.join(sourceRoot, cleanRequest.slice(2))
    : path.resolve(path.dirname(from), cleanRequest)
  if (!isInside(sourceRoot, base)) return null
  const candidates = [
    base,
    ...MODULE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...MODULE_EXTENSIONS.map((extension) => path.join(base, `index${extension}`)),
  ]
  return candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile()) ?? null
}

export function isInactiveDoflowEdge(sourceRoot, from, request) {
  const relative = unixRelative(sourceRoot, from)
  // The tenant layout is itself part of the authenticated Doflow graph. Only
  // its explicit non-Doflow fallback shell edge is inactive for Doflow.
  if (
    relative === "app/(tenant)/layout.tsx" &&
    request === "@/components/layout/legacy-tenant-shell"
  ) {
    return true
  }
  // `/dashboard` is shared by all tenants. Doflow takes RoleAwareDashboard;
  // DashboardClient is the explicitly retained non-Doflow branch.
  return relative === "app/(tenant)/dashboard/page.tsx" && request === "./dashboard-client"
}

export function traceReachableGraph({ sourceRoot, entries, skipEdge = () => false }) {
  const visited = new Set()
  const parents = new Map()
  const queue = [...new Set(entries.map((entry) => path.resolve(entry)))]

  while (queue.length) {
    const file = queue.shift()
    if (!file || visited.has(file) || !isInside(sourceRoot, file) || !fs.existsSync(file)) continue
    visited.add(file)
    const extension = path.extname(file).toLowerCase()
    if (![".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".css", ".scss", ".sass"].includes(extension)) continue
    const source = fs.readFileSync(file, "utf8")
    for (const request of extractImportRequests(source, extension)) {
      if (skipEdge(file, request)) continue
      const resolved = resolveLocalImport(sourceRoot, file, request)
      if (!resolved || visited.has(resolved)) continue
      if (!parents.has(resolved)) parents.set(resolved, { from: file, request })
      queue.push(resolved)
    }
  }

  return { visited, parents }
}

function cssBlocks(source) {
  const blocks = []
  const stack = []
  let boundary = 0
  let quote = null
  let comment = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (comment) {
      if (character === "*" && next === "/") {
        comment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (character === "\\") index += 1
      else if (character === quote) quote = null
      continue
    }
    if (character === "/" && next === "*") {
      comment = true
      index += 1
      continue
    }
    if (character === '"' || character === "'") {
      quote = character
      continue
    }
    if (character === "{") {
      const rawHeader = source.slice(boundary, index)
      const leading = rawHeader.length - rawHeader.trimStart().length
      const block = {
        header: rawHeader.replace(/\/\*[\s\S]*?\*\//g, " ").trim(),
        headerStart: boundary + leading,
        open: index,
        close: source.length,
        parent: stack.at(-1) ?? null,
      }
      blocks.push(block)
      stack.push(block)
      boundary = index + 1
    } else if (character === "}") {
      const block = stack.pop()
      if (block) block.close = index
      boundary = index + 1
    } else if (character === ";") {
      boundary = index + 1
    }
  }
  return blocks
}

function cssAncestors(block) {
  const ancestors = []
  let current = block
  while (current) {
    ancestors.unshift(current.header)
    current = current.parent
  }
  return ancestors
}

function classTokensFromSource(source) {
  const classes = new Set(["dark", "light"])
  for (const literal of source.matchAll(/["'`]([^"'`\r\n]+)["'`]/g)) {
    for (const token of literal[1].split(/\s+/)) {
      const normalized = token
        .replace(/^[^a-z_.-]+/i, "")
        .replace(/[^a-z0-9_-]+$/gi, "")
      if (/^[a-z_][a-z0-9_-]*$/i.test(normalized)) classes.add(normalized)
    }
  }
  return classes
}

export function collectGraphSymbols(sources) {
  const classes = new Set(["dark", "light"])
  const dataAttributes = new Set()
  const dataValues = new Set()
  const cssVariables = new Set()
  for (const source of sources) {
    for (const value of classTokensFromSource(source)) classes.add(value)
    for (const match of source.matchAll(/\b(data-[a-z0-9-]+)(?:\s*=\s*["']([^"']+)["'])?/gi)) {
      const attribute = match[1].toLowerCase()
      dataAttributes.add(attribute)
      if (match[2]) dataValues.add(`${attribute}=${match[2].toLowerCase()}`)
    }
    for (const match of source.matchAll(/setAttribute\(\s*["'](data-[a-z0-9-]+)["']\s*,\s*["']([^"']+)["']\s*\)/gi)) {
      const attribute = match[1].toLowerCase()
      dataAttributes.add(attribute)
      dataValues.add(`${attribute}=${match[2].toLowerCase()}`)
    }
    for (const match of source.matchAll(/var\(\s*(--[a-z0-9-]+)\b/gi)) cssVariables.add(match[1].toLowerCase())
  }
  return { classes, dataAttributes, dataValues, cssVariables }
}

function selectorCouldMatchDoflow(selector, symbols) {
  const branches = selector.split(/,(?![^()]*\))/)
  return branches.some((branch) => {
    for (const negative of branch.matchAll(/:not\(\s*\[(data-[a-z0-9-]+)\s*=\s*["']([^"']+)["']\s*\]\s*\)/gi)) {
      if (symbols.dataValues.has(`${negative[1].toLowerCase()}=${negative[2].toLowerCase()}`)) return false
    }
    for (const attribute of branch.matchAll(/\[(data-[a-z0-9-]+)(?:\s*=\s*["']([^"']+)["'])?[^\]]*\]/gi)) {
      const key = attribute[1].toLowerCase()
      if (branch.slice(Math.max(0, attribute.index - 6), attribute.index).includes(":not(")) continue
      if (!symbols.dataAttributes.has(key)) return false
      if (attribute[2] && !symbols.dataValues.has(`${key}=${attribute[2].toLowerCase()}`)) return false
    }
    for (const classMatch of branch.matchAll(/\.([a-z_][a-z0-9_-]*)/gi)) {
      if (!symbols.classes.has(classMatch[1])) return false
    }
    return true
  })
}

function isCanonicalComponentLayer(block) {
  return cssAncestors(block).some((header) => /^@layer\s+components\b/i.test(header))
}

export function scanCssForLegacy(source, file = "styles.css", symbols = collectGraphSymbols([])) {
  const findings = []
  const seen = new Set()
  const blocks = cssBlocks(source)

  for (const block of blocks) {
    const selector = block.header
    if (!selector || selector.startsWith("@") || !selectorCouldMatchDoflow(selector, symbols)) continue
    const body = source.slice(block.open + 1, block.close)
    const selectorOffset = block.headerStart
    if (/\.df-[a-z0-9-]+\b/i.test(selector)) {
      addFinding(findings, seen, file, source, selectorOffset, "legacy df-* selector matches the Doflow graph")
    }
    if (/\.doflow-(?:app-frame|main(?:-[a-z0-9-]+)?|topbar|page(?:-[a-z0-9-]+)?|content(?:-[a-z0-9-]+)?|sidebar(?:-[a-z0-9-]+)?)\b/i.test(selector)) {
      addFinding(findings, seen, file, source, selectorOffset, "legacy Doflow wrapper selector matches the Doflow graph")
    }
    if (/\[data-(?:doflow|builder)-shell\s*=\s*["']daniele-design["']\]/i.test(selector)) {
      addFinding(findings, seen, file, source, selectorOffset, "superseded Daniele-design CSS selector matches the Doflow graph")
    }
    for (const match of body.matchAll(/var\(\s*(--(?:df|daniele)-[a-z0-9-]+)\b/gi)) {
      addFinding(findings, seen, file, source, block.open + 1 + match.index, "legacy visual custom property is consumed by Doflow CSS")
    }
    for (const match of body.matchAll(/(--(?:df|daniele)-[a-z0-9-]+)\s*:/gi)) {
      if (!symbols.cssVariables.has(match[1].toLowerCase())) continue
      addFinding(findings, seen, file, source, block.open + 1 + match.index, "legacy visual custom property referenced by the Doflow graph is defined globally")
    }
    const primitiveSelector = /\[data-sidebar(?:=|\])|\[data-slot\s*=\s*["'](?:sidebar|button|card|input|progress)/i.test(selector)
    const canonicalDoflowScope = /\[data-tenant-ui\s*=\s*["']doflow-reference["']\]/i.test(selector)
    const legacyOverride = /!important|var\(\s*--(?:df|daniele)-|var\(\s*--(?:radius-nav|shadow-card)|backdrop-filter/i.test(body)
    if (primitiveSelector && !canonicalDoflowScope && (!isCanonicalComponentLayer(block) || legacyOverride)) {
      addFinding(findings, seen, file, source, selectorOffset, "unscoped generic primitive CSS override matches the Doflow graph")
    }
  }
  return findings
}

export function scanCodeForLegacy(source, file = "module.tsx", options = {}) {
  const findings = []
  const seen = new Set()
  for (const rule of CODE_RULES) {
    if (options.allowLegacyTenantShell === true && rule.label === "legacy LegacyTenantShell component") continue
    for (const match of source.matchAll(rule.pattern)) {
      addFinding(findings, seen, file, source, match.index, rule.label)
    }
  }
  return findings
}

function sourceHas(source, pattern) {
  return pattern.test(source)
}

function contractFinding(file, label) {
  return `${file}: ${label}`
}

export function auditThemeContract({ rootLayout, shell, header, toggle }, files = {}) {
  const names = {
    rootLayout: files.rootLayout ?? "app/layout.tsx",
    shell: files.shell ?? "components/layout/doflow-daniele-shell.tsx",
    header: files.header ?? "components/dashboard-header.tsx",
    toggle: files.toggle ?? "components/theme-toggle.tsx",
  }
  const findings = []
  if (!sourceHas(rootLayout, /<ThemeProvider\b[\s\S]*?attribute\s*=\s*["']class["']/)) {
    findings.push(contractFinding(names.rootLayout, "ThemeProvider must drive the html class attribute"))
  }
  if (/\bforcedTheme\s*=/.test(rootLayout)) {
    findings.push(contractFinding(names.rootLayout, "ThemeProvider must not force a single theme"))
  }
  if (!/from\s+["']next-themes["']/.test(toggle) || !/\buseTheme\s*\(/.test(toggle)) {
    findings.push(contractFinding(names.toggle, "ThemeToggle must use next-themes useTheme()"))
  }
  if (!/\bresolvedTheme\b/.test(toggle) || !/\bsetTheme\s*\(/.test(toggle)) {
    findings.push(contractFinding(names.toggle, "ThemeToggle must read resolvedTheme and call setTheme"))
  }
  if (!/["']dark["']/.test(toggle) || !/["']light["']/.test(toggle)) {
    findings.push(contractFinding(names.toggle, "ThemeToggle must support both dark and light"))
  }
  if (!/\bSun\b/.test(toggle) || !/\bMoon\b/.test(toggle) || !/aria-label\s*=/.test(toggle)) {
    findings.push(contractFinding(names.toggle, "ThemeToggle must expose Sun/Moon state and an accessible label"))
  }
  if (!/from\s+["']@\/components\/(?:theme\/)?theme-toggle["']/.test(header) || !/<ThemeToggle\b/.test(header)) {
    findings.push(contractFinding(names.header, "DashboardHeader must render the real ThemeToggle"))
  }
  if (/aria-label\s*=\s*["'][^"']*tema predefinito/i.test(header) || /aria-pressed\s*=\s*["']true["'][\s\S]{0,160}<Sun\b/i.test(header)) {
    findings.push(contractFinding(names.header, "static decorative theme button is forbidden"))
  }
  const hardLocks = [
    /classList\.remove\(\s*["']dark["']\s*\)/,
    /classList\.toggle\(\s*["']dark["']\s*,\s*false\s*\)/,
    /localStorage\.removeItem\(\s*["'](?:doflow_theme|theme)["']\s*\)/,
  ]
  if (hardLocks.some((pattern) => pattern.test(shell))) {
    findings.push(contractFinding(names.shell, "Doflow shell must not hard-lock or reset the selected theme"))
  }
  return findings
}

export function auditSidebarContract({ primitive, shell, appSidebar }, files = {}) {
  const names = {
    primitive: files.primitive ?? "components/ui/sidebar.tsx",
    shell: files.shell ?? "components/layout/doflow-daniele-shell.tsx",
    appSidebar: files.appSidebar ?? "components/app-sidebar.tsx",
  }
  const findings = []
  const widths = [
    ["SIDEBAR_WIDTH", "16rem"],
    ["SIDEBAR_WIDTH_MOBILE", "18rem"],
    ["SIDEBAR_WIDTH_ICON", "3rem"],
  ]
  for (const [constant, value] of widths) {
    const pattern = new RegExp(`const\\s+${constant}\\s*=\\s*["']${value}["']`)
    if (!pattern.test(primitive)) findings.push(contractFinding(names.primitive, `${constant} must be ${value}`))
  }
  for (const slot of ["sidebar-wrapper", "sidebar", "sidebar-trigger", "sidebar-inset", "sidebar-menu-button"]) {
    if (!primitive.includes(`data-slot="${slot}"`) && !primitive.includes(`data-slot='${slot}'`)) {
      findings.push(contractFinding(names.primitive, `missing canonical data-slot=${slot}`))
    }
  }
  if (/\b(?:280px|72px|rounded-card|rounded-nav|shadow-card|figma)\b/i.test(primitive)) {
    findings.push(contractFinding(names.primitive, "legacy/Figma sidebar primitive residue is forbidden"))
  }
  if (!/state\s*!==\s*["']collapsed["']\s*\|\|\s*isMobile/.test(primitive)) {
    findings.push(contractFinding(names.primitive, "collapsed desktop items must retain tooltip behavior"))
  }
  if (/--sidebar-width(?:-icon)?["']?\s*:/.test(shell) || /--sidebar-width(?:-icon)?\s*\]/.test(shell)) {
    findings.push(contractFinding(names.shell, "Doflow shell must not override canonical sidebar widths"))
  }
  if (!/<Sidebar\b[^>]*collapsible\s*=\s*["']icon["']/.test(appSidebar) || !/<SidebarRail\b/.test(appSidebar)) {
    findings.push(contractFinding(names.appSidebar, "AppSidebar must use canonical icon collapse and SidebarRail"))
  }
  return findings
}

function structuralPairs(source) {
  const tokens = []
  const pairs = new Map()
  const stack = []
  let quote = null
  let lineComment = false
  let blockComment = false

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index]
    const next = source[index + 1]
    if (lineComment) {
      if (character === "\n") lineComment = false
      continue
    }
    if (blockComment) {
      if (character === "*" && next === "/") {
        blockComment = false
        index += 1
      }
      continue
    }
    if (quote) {
      if (character === "\\") index += 1
      else if (character === quote) quote = null
      continue
    }
    if (character === "/" && next === "/") {
      lineComment = true
      index += 1
      continue
    }
    if (character === "/" && next === "*") {
      blockComment = true
      index += 1
      continue
    }
    if (character === '"' || character === "'" || character === "`") {
      quote = character
      continue
    }
    if (character === "{" || character === "[") {
      const token = { character, index }
      tokens.push(token)
      stack.push(token)
    } else if (character === "}" || character === "]") {
      const expected = character === "}" ? "{" : "["
      const open = stack.pop()
      if (open?.character === expected) pairs.set(open.index, index)
    }
  }
  return { tokens, pairs }
}

export function builderItemArrayDepth(source, offset) {
  const { tokens, pairs } = structuralPairs(source)
  return tokens.filter((token) => {
    if (token.character !== "[" || token.index >= offset || (pairs.get(token.index) ?? -1) <= offset) return false
    const prefix = source.slice(Math.max(0, token.index - 80), token.index)
    return /\bitems\s*:\s*$/.test(prefix)
  }).length
}

function enclosingObject(source, offset) {
  const { tokens, pairs } = structuralPairs(source)
  const candidates = tokens.filter((token) => token.character === "{" && token.index < offset && (pairs.get(token.index) ?? -1) > offset)
  const open = candidates.at(-1)
  return open ? source.slice(open.index, pairs.get(open.index) + 1) : ""
}

export function auditBuilderContract({ appSidebar, header, gate }, files = {}) {
  const names = {
    appSidebar: files.appSidebar ?? "components/app-sidebar.tsx",
    header: files.header ?? "components/dashboard-header.tsx",
    gate: files.gate ?? "components/tenant-site-proposals/site-proposals-access-gate.tsx",
  }
  const findings = []
  const matches = [...appSidebar.matchAll(/title\s*:\s*["']Builder["']/g)]
  if (matches.length !== 1) {
    findings.push(contractFinding(names.appSidebar, "navigation must define exactly one Builder item"))
  } else {
    const offset = matches[0].index
    const item = enclosingObject(appSidebar, offset)
    if (builderItemArrayDepth(appSidebar, offset) !== 1) {
      findings.push(contractFinding(names.appSidebar, "Builder must be a top-level navigation item, not a submenu child"))
    }
    if (!/url\s*:\s*["']\/commercial\/site-proposals["']/.test(item)) {
      findings.push(contractFinding(names.appSidebar, "Builder must use /commercial/site-proposals"))
    }
    if (!/capability\s*:\s*["']canUseBuilder["']/.test(item)) {
      findings.push(contractFinding(names.appSidebar, "Builder must be gated by canUseBuilder"))
    }
    if (!/\bicon\s*:/.test(item)) {
      findings.push(contractFinding(names.appSidebar, "Builder top-level item must expose an icon for collapsed mode"))
    }
  }
  if (!/hasCapability\(\s*item\.capability\s*\)/.test(appSidebar)) {
    findings.push(contractFinding(names.appSidebar, "navigation filtering must evaluate item capabilities"))
  }
  if (header.includes("/commercial/site-proposals") && (!/\bhasCapability\b/.test(header) || !/hasCapability\(\s*["']canUseBuilder["']\s*\)/.test(header))) {
    findings.push(contractFinding(names.header, "Builder header shortcut must use canUseBuilder"))
  }
  if (!/hasCapability\(\s*["']canUseBuilder["']\s*\)/.test(gate)) {
    findings.push(contractFinding(names.gate, "Builder route must preserve its canUseBuilder access gate"))
  }
  return findings
}

export function auditTenantLayoutContract({ tenantLayout }, files = {}) {
  const name = files.tenantLayout ?? "app/(tenant)/layout.tsx"
  const findings = []
  const requests = extractImportRequests(tenantLayout)
  const legacyRequest = "@/components/layout/legacy-tenant-shell"
  const doflowImportCount = tenantLayout.match(/import\(\s*["']@\/components\/layout\/doflow-daniele-shell["']\s*\)/g)?.length ?? 0
  const legacyImportCount = tenantLayout.match(/import\(\s*["']@\/components\/layout\/legacy-tenant-shell["']\s*\)/g)?.length ?? 0
  if (doflowImportCount !== 1) {
    findings.push(contractFinding(name, "tenant layout must load exactly one DoflowDanieleShell module"))
  }
  if (legacyImportCount !== 1) {
    findings.push(contractFinding(name, "tenant layout must retain exactly one explicit non-Doflow LegacyTenantShell edge"))
  }
  if (!/const\s+DoflowDanieleShell\s*=\s*dynamic\s*\([\s\S]*?import\(\s*["']@\/components\/layout\/doflow-daniele-shell["']\s*\)/.test(tenantLayout)) {
    findings.push(contractFinding(name, "DoflowDanieleShell must remain an explicit dynamic shell import"))
  }
  if (!/const\s+LegacyTenantShell\s*=\s*dynamic\s*\([\s\S]*?import\(\s*["']@\/components\/layout\/legacy-tenant-shell["']\s*\)/.test(tenantLayout)) {
    findings.push(contractFinding(name, "LegacyTenantShell exemption is valid only for its explicit dynamic fallback import"))
  }
  if (!/if\s*\(\s*tenant\s*===\s*["']doflow["']\s*\)\s*return\s*<DoflowDanieleShell\b/.test(tenantLayout)) {
    findings.push(contractFinding(name, "tenant doflow must select DoflowDanieleShell directly"))
  }
  if (!/return\s*<LegacyTenantShell\b[^>]*>\s*\{children\}\s*<\/LegacyTenantShell>/.test(tenantLayout)) {
    findings.push(contractFinding(name, "LegacyTenantShell must remain only the terminal non-Doflow fallback"))
  }
  const legacyReferences = tenantLayout.match(/\bLegacyTenantShell\b/g)?.length ?? 0
  if (legacyReferences !== 4) {
    findings.push(contractFinding(name, "LegacyTenantShell must have only its loader, export selection and fallback render references"))
  }
  const extraLegacyImports = requests.filter((request) =>
    /(?:legacy-tenant|tenant-sidebar|theme-settings-drawer|roomy-sidebar)/i.test(request) && request !== legacyRequest,
  )
  if (extraLegacyImports.length > 0) {
    findings.push(contractFinding(name, `additional legacy compatibility imports are forbidden: ${extraLegacyImports.join(", ")}`))
  }
  return findings
}

function sourceSection(source, startPattern, endPattern) {
  const start = source.search(startPattern)
  if (start < 0) return ""
  const remainder = source.slice(start)
  const relativeEnd = remainder.search(endPattern)
  return relativeEnd > 0 ? remainder.slice(0, relativeEnd) : remainder
}

export function auditIdentityAdminContract({ provider, admin }, files = {}) {
  const names = {
    provider: files.provider ?? "features/identity/doflow-identity-provider.tsx",
    admin: files.admin ?? "components/team-space/doflow-team-account-admin.tsx",
  }
  const findings = []
  const rolesUpdate = sourceSection(provider, /updateUserRoles\s*:\s*async\b/, /updateUserCapabilities\s*:\s*async\b/)
  const capabilitiesUpdate = sourceSection(provider, /updateUserCapabilities\s*:\s*async\b/, /updateUserAvatar\s*:/)

  if (!/explicitCapabilities\?\s*:\s*DoflowCapability\[\]/.test(provider)) {
    findings.push(contractFinding(names.provider, "identity users and bootstrap must expose explicitCapabilities separately"))
  }
  if (!/function\s+explicitCapabilitiesForAssignment\b[\s\S]*?capabilitiesForRoles\(assignment\.roles\)[\s\S]*?!inherited\.has\(capability\)/.test(provider)) {
    findings.push(contractFinding(names.provider, "legacy assignments must derive explicit capabilities by subtracting inherited role capabilities"))
  }
  if (!/user\.explicitCapabilities\s*\|\|\s*\[\]/.test(rolesUpdate) || !/effectiveCapabilities\(normalized,\s*explicitCapabilities\)/.test(rolesUpdate)) {
    findings.push(contractFinding(names.provider, "role updates must preserve explicit grants and recompute effective capabilities"))
  }
  if (!/await\s+apiFetch\b/.test(rolesUpdate) || !/return\s+true\b/.test(rolesUpdate) || !/return\s+false\b/.test(rolesUpdate)) {
    findings.push(contractFinding(names.provider, "role updates must await the server and resolve a success boolean"))
  }
  if (!/const\s+normalized\s*=\s*normalizeCapabilities\(nextCapabilities\)/.test(capabilitiesUpdate)) {
    findings.push(contractFinding(names.provider, "capability updates must normalize the explicit nextCapabilities input"))
  }
  if (!/explicitCapabilities\s*:\s*normalized/.test(capabilitiesUpdate) || !/effectiveCapabilities\(user\.roles,\s*normalized\)/.test(capabilitiesUpdate)) {
    findings.push(contractFinding(names.provider, "capability updates must store explicit grants separately from their effective union"))
  }
  if (!/await\s+apiFetch\b/.test(capabilitiesUpdate) || !/body\s*:\s*JSON\.stringify\(\{\s*capabilities\s*:\s*normalized\s*\}\)/.test(capabilitiesUpdate)) {
    findings.push(contractFinding(names.provider, "capability updates must await and write only normalized explicit grants"))
  }
  if (!/return\s+true\b/.test(capabilitiesUpdate) || !/return\s+false\b/.test(capabilitiesUpdate)) {
    findings.push(contractFinding(names.provider, "capability updates must resolve a success boolean"))
  }
  if (!/capabilities\s*:\s*identity\?\.explicitCapabilities\s*\|\|\s*\[\]/.test(admin) || /capabilities\s*:\s*identity\?\.capabilities\b/.test(admin)) {
    findings.push(contractFinding(names.admin, "Team account drafts must edit only explicitCapabilities, never the effective union"))
  }
  if (!/const\s*\[\s*rolesSaved\s*,\s*capabilitiesSaved\s*\]\s*=\s*await\s+Promise\.all\s*\(/.test(admin) || !/if\s*\(\s*!rolesSaved\s*\|\|\s*!capabilitiesSaved\s*\)\s*throw\b/.test(admin)) {
    findings.push(contractFinding(names.admin, "Team account save must await and validate both identity mutations"))
  }
  if (!/const\s+inheritedCapabilities\s*=\s*capabilitiesForRoles\(draft\?\.roles\s*\|\|\s*\[\]\)/.test(admin) || !/disabled=\{[^}]*\binherited\b[^}]*\}/.test(admin) || !/>Ereditata<\/Badge>/.test(admin)) {
    findings.push(contractFinding(names.admin, "inherited capabilities must stay visible, labelled and non-editable"))
  }
  if (!/disabled=\{busy\}/.test(admin) || !/busy\s*\?\s*<LoaderCircle\b/.test(admin)) {
    findings.push(contractFinding(names.admin, "Team account save must expose a disabled pending state"))
  }
  if (/\bsetPermissions\b|\bpermissions\.map\s*\(/.test(admin)) {
    findings.push(contractFinding(names.admin, "Team account must not reference the removed flat permission state"))
  }
  if (!/buildModulePermissionPatch\(\s*modulePermissionState\s*,\s*draft\.tenantRole\s*,?\s*\)/.test(admin) || !/setModulePermissionState\b/.test(admin)) {
    findings.push(contractFinding(names.admin, "Team account module permissions must use the server-aware draft policy"))
  }
  return findings
}

export function auditCompatibilitySidebarContract(
  { roomy, tenantSidebar, tenantSection, legacyShell, superadminSidebar, superadminLayout, doflowShell, appSidebar, primitive },
  files = {},
) {
  const names = {
    roomy: files.roomy ?? "components/layout/roomy-sidebar.tsx",
    tenantSidebar: files.tenantSidebar ?? "components/layout/tenant-sidebar.tsx",
    tenantSection: files.tenantSection ?? "components/layout/tenant-sidebar-section.tsx",
    legacyShell: files.legacyShell ?? "components/layout/legacy-tenant-shell.tsx",
    superadminSidebar: files.superadminSidebar ?? "app/superadmin/components/super-admin-sidebar.tsx",
    superadminLayout: files.superadminLayout ?? "app/superadmin/layout.tsx",
    doflowShell: files.doflowShell ?? "components/layout/doflow-daniele-shell.tsx",
    appSidebar: files.appSidebar ?? "components/app-sidebar.tsx",
    primitive: files.primitive ?? "components/ui/sidebar.tsx",
  }
  const findings = []
  if (!/RoomySidebarMenuButton[\s\S]*?["']h-11\b/.test(roomy) || !/["']\[&>svg\]:size-6["']/.test(roomy)) {
    findings.push(contractFinding(names.roomy, "roomy compatibility adapter must preserve 44px items and 24px icons"))
  }
  if (!/RoomySidebarMenuSubButton[\s\S]*?["']h-7\b/.test(roomy) || !/["']h-7[^"']*\[&>svg\]:size-4["']/.test(roomy)) {
    findings.push(contractFinding(names.roomy, "roomy compatibility adapter must preserve 28px subitems and 16px icons"))
  }
  if (!/roomy-sidebar/.test(tenantSidebar) || !/RoomySidebarMenuButton\s+as\s+SidebarMenuButton/.test(tenantSidebar)) {
    findings.push(contractFinding(names.tenantSidebar, "legacy tenant sidebar must consume the roomy menu-button adapter"))
  }
  if (!/roomy-sidebar/.test(tenantSection) || !/RoomySidebarMenuButton\s+as\s+SidebarMenuButton/.test(tenantSection) || !/RoomySidebarMenuSubButton\s+as\s+SidebarMenuSubButton/.test(tenantSection)) {
    findings.push(contractFinding(names.tenantSection, "legacy tenant sidebar sections must consume both roomy adapters"))
  }
  if (!/roomy-sidebar/.test(superadminSidebar) || !/RoomySidebarMenuButton\s+as\s+SidebarMenuButton/.test(superadminSidebar)) {
    findings.push(contractFinding(names.superadminSidebar, "superadmin sidebar must consume the roomy menu-button adapter"))
  }
  if (!/mobileWidth\s*=\s*["']280px["']/.test(legacyShell) || !/--sidebar-width["']?\s*:\s*["']280px["']/.test(legacyShell) || !/--sidebar-width-icon["']?\s*:\s*["']72px["']/.test(legacyShell)) {
    findings.push(contractFinding(names.legacyShell, "legacy tenant shell must preserve 280px/72px compatibility widths"))
  }
  if (!/mobileWidth\s*=\s*["']280px["']/.test(superadminLayout) || !/--sidebar-width["']?\s*:\s*["']220px["']/.test(superadminLayout) || !/--sidebar-width-icon["']?\s*:\s*["']72px["']/.test(superadminLayout)) {
    findings.push(contractFinding(names.superadminLayout, "superadmin shell must preserve 220px/72px compatibility widths and 280px mobile width"))
  }
  for (const [source, file] of [[doflowShell, names.doflowShell], [appSidebar, names.appSidebar], [primitive, names.primitive]]) {
    if (/roomy-sidebar|RoomySidebar|data-sidebar-density\s*=\s*["']roomy["']/.test(source)) {
      findings.push(contractFinding(file, "Doflow canonical sidebar graph must not consume the roomy compatibility adapter"))
    }
  }
  return findings
}

function discoverEntries(sourceRoot) {
  const routeRoots = [
    path.join(sourceRoot, "app", "(tenant)", "dashboard"),
    path.join(sourceRoot, "app", "(tenant)", "commercial", "site-proposals"),
  ]
  const routeEntries = routeRoots.flatMap((directory) => walk(directory, (file) => NEXT_ROUTE_FILE.test(path.basename(file))))
  return [...new Set([...REQUIRED_GRAPH_ROOTS.map((relative) => path.join(sourceRoot, relative)), ...routeEntries])]
}

function readContractSource(sourceRoot, relative, findings) {
  const file = path.join(sourceRoot, relative)
  if (!fs.existsSync(file)) {
    findings.push(`${relative}: required Doflow graph file is missing`)
    return ""
  }
  return fs.readFileSync(file, "utf8")
}

export function auditDoflowUiPurity({ repositoryRoot = process.cwd(), sourceRoot = path.join(repositoryRoot, "apps", "frontend", "src") } = {}) {
  const findings = []
  const entries = discoverEntries(sourceRoot)
  for (const relative of REQUIRED_ROUTE_ENTRIES) {
    if (!fs.existsSync(path.join(sourceRoot, relative))) findings.push(`${relative}: required Doflow route entry is missing`)
  }

  const graph = traceReachableGraph({
    sourceRoot,
    entries,
    skipEdge: (from, request) => isInactiveDoflowEdge(sourceRoot, from, request),
  })
  const reachableSources = [...graph.visited].map((file) => ({
    file,
    extension: path.extname(file).toLowerCase(),
    source: fs.readFileSync(file, "utf8"),
  }))
  const graphSymbols = collectGraphSymbols(
    reachableSources
      .filter(({ extension }) => ![".css", ".scss", ".sass", ".json"].includes(extension))
      .map(({ source }) => source),
  )
  for (const { file, extension, source } of reachableSources) {
    if (extension === ".json") continue
    const display = unixRelative(repositoryRoot, file)
    const isTenantLayout = unixRelative(sourceRoot, file) === "app/(tenant)/layout.tsx"
    findings.push(...([".css", ".scss", ".sass"].includes(extension)
      ? scanCssForLegacy(source, display, graphSymbols)
      : scanCodeForLegacy(source, display, { allowLegacyTenantShell: isTenantLayout })))
  }

  const contractFiles = {
    rootLayout: "app/layout.tsx",
    tenantLayout: "app/(tenant)/layout.tsx",
    shell: "components/layout/doflow-daniele-shell.tsx",
    appSidebar: "components/app-sidebar.tsx",
    header: "components/dashboard-header.tsx",
    toggle: "components/theme-toggle.tsx",
    primitive: "components/ui/sidebar.tsx",
    gate: "components/tenant-site-proposals/site-proposals-access-gate.tsx",
    identityProvider: "features/identity/doflow-identity-provider.tsx",
    teamAdmin: "components/team-space/doflow-team-account-admin.tsx",
    roomy: "components/layout/roomy-sidebar.tsx",
    tenantSidebar: "components/layout/tenant-sidebar.tsx",
    tenantSection: "components/layout/tenant-sidebar-section.tsx",
    legacyShell: "components/layout/legacy-tenant-shell.tsx",
    superadminSidebar: "app/superadmin/components/super-admin-sidebar.tsx",
    superadminLayout: "app/superadmin/layout.tsx",
  }
  const sources = Object.fromEntries(Object.entries(contractFiles).map(([key, relative]) => [key, readContractSource(sourceRoot, relative, findings)]))
  const displayFiles = Object.fromEntries(Object.entries(contractFiles).map(([key, relative]) => [key, unixRelative(repositoryRoot, path.join(sourceRoot, relative))]))

  findings.push(...auditThemeContract(sources, displayFiles))
  findings.push(...auditSidebarContract(sources, displayFiles))
  findings.push(...auditBuilderContract(sources, displayFiles))
  findings.push(...auditTenantLayoutContract(sources, displayFiles))
  findings.push(...auditIdentityAdminContract({ provider: sources.identityProvider, admin: sources.teamAdmin }, {
    provider: displayFiles.identityProvider,
    admin: displayFiles.teamAdmin,
  }))
  findings.push(...auditCompatibilitySidebarContract({
    roomy: sources.roomy,
    tenantSidebar: sources.tenantSidebar,
    tenantSection: sources.tenantSection,
    legacyShell: sources.legacyShell,
    superadminSidebar: sources.superadminSidebar,
    superadminLayout: sources.superadminLayout,
    doflowShell: sources.shell,
    appSidebar: sources.appSidebar,
    primitive: sources.primitive,
  }, displayFiles))

  const compatibilityOnly = [
    "components/layout/legacy-tenant-shell.tsx",
    "components/layout/roomy-sidebar.tsx",
    "components/layout/tenant-sidebar.tsx",
    "components/layout/tenant-sidebar-section.tsx",
    "app/superadmin/components/super-admin-sidebar.tsx",
  ]
  for (const relative of compatibilityOnly) {
    if (graph.visited.has(path.join(sourceRoot, relative))) {
      findings.push(`${unixRelative(repositoryRoot, path.join(sourceRoot, relative))}: compatibility sidebar module is reachable from the Doflow graph`)
    }
  }

  return {
    entries,
    visited: graph.visited,
    findings: [...new Set(findings)].sort(),
  }
}

function isMainModule() {
  if (!process.argv[1]) return false
  return import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href
}

if (isMainModule()) {
  const result = auditDoflowUiPurity()
  if (result.findings.length) {
    console.error(`DOFLOW FRONTEND LEGACY RESIDUE = ${result.findings.length} REACHABLE`)
    for (const finding of result.findings) console.error(`- ${finding}`)
    process.exitCode = 1
  } else {
    console.log(PURITY_SUCCESS)
  }
}
