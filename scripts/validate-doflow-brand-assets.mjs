import { createHash } from "node:crypto"
import { existsSync, readFileSync, readdirSync } from "node:fs"
import { dirname, extname, relative, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..")
const manifestPath = resolve(repoRoot, "scripts/doflow-brand-assets.manifest.json")
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"))

function fail(message) {
  throw new Error(`Doflow brand asset validation failed: ${message}`)
}

function read(relativePath) {
  const path = resolve(repoRoot, relativePath)
  if (!existsSync(path)) fail(`missing ${relativePath}`)
  return readFileSync(path)
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex")
}

function assertHash(relativePath, expected) {
  const actual = sha256(read(relativePath))
  if (actual !== expected) fail(`${relativePath} has unexpected bytes`)
}

function pngDimensions(bytes, relativePath) {
  const signature = "89504e470d0a1a0a"
  if (bytes.subarray(0, 8).toString("hex") !== signature || bytes.subarray(12, 16).toString("ascii") !== "IHDR") {
    fail(`${relativePath} is not a PNG`)
  }
  return [bytes.readUInt32BE(16), bytes.readUInt32BE(20)]
}

if (manifest.schemaVersion !== 1) fail("unsupported manifest schema")
const authorityByRole = new Map(manifest.authority.assets.map((asset) => [asset.role, asset]))
for (const copy of manifest.canonicalCopies) {
  const authority = authorityByRole.get(copy.authorityRole)
  if (!authority) fail(`unknown authority role ${copy.authorityRole}`)
  const bytes = read(copy.path)
  if (bytes.byteLength !== authority.bytes || sha256(bytes) !== authority.sha256) {
    fail(`${copy.path} is not an exact authority copy`)
  }
  const source = bytes.toString("utf8")
  if (!source.includes(`viewBox="${authority.viewBox}"`) || /<script\b|<image\b|\b(?:href|xlink:href)=/i.test(source)) {
    fail(`${copy.path} has invalid SVG geometry or external content`)
  }
}

assertHash(manifest.staticTile.path, manifest.staticTile.sha256)
const tile = read(manifest.staticTile.path).toString("utf8")
if (!tile.includes(`viewBox="${manifest.staticTile.viewBox}"`) || !tile.includes('fill="#fefefe"') || !tile.includes('fill="#05070e"')) {
  fail("static tile mapping is invalid")
}

const notificationResource = manifest.notificationResource
if (!notificationResource?.mapping || notificationResource.bundleDestination !== "notification-app-logo.png") {
  fail("notification resource mapping is missing or invalid")
}
const notificationBytes = read(notificationResource.path)
const notificationSource = read(notificationResource.sourcePath)
if (!notificationBytes.equals(notificationSource) || sha256(notificationBytes) !== notificationResource.sha256) {
  fail("notification resource is not the exact deterministic Windows brand tile")
}
const [notificationWidth, notificationHeight] = pngDimensions(notificationBytes, notificationResource.path)
if (notificationWidth !== notificationResource.width || notificationHeight !== notificationResource.height) {
  fail(`notification resource dimensions are ${notificationWidth}x${notificationHeight}`)
}

for (const asset of manifest.derivedAssets) {
  const bytes = read(asset.path)
  if (asset.format === "png") {
    const [width, height] = pngDimensions(bytes, asset.path)
    if (width !== asset.width || height !== asset.height) fail(`${asset.path} dimensions are ${width}x${height}`)
  } else if (asset.format === "ico") {
    if (bytes.readUInt16LE(0) !== 0 || bytes.readUInt16LE(2) !== 1 || bytes.readUInt16LE(4) !== asset.images) {
      fail(`${asset.path} is not the expected multi-image ICO`)
    }
  } else {
    fail(`${asset.path} has unsupported format ${asset.format}`)
  }
  if (sha256(bytes) !== asset.sha256) fail(`${asset.path} is not a deterministic generated output`)
}

for (const removedConvention of [
  "apps/frontend/src/app/favicon.ico",
  "apps/frontend/src/app/icon.png",
  "apps/frontend/src/app/apple-icon.png",
  "apps/desktop/src-tauri/icons/doflow_favicon_source.png",
]) {
  if (existsSync(resolve(repoRoot, removedConvention))) fail(`${removedConvention} would create competing or obsolete ownership`)
}

const layout = read("apps/frontend/src/app/layout.tsx").toString("utf8")
if (!layout.includes('id={DOFLOW_FAVICON_LINK_ID}') || /\bicons\s*:\s*\{/.test(layout)) {
  fail("Next layout must have one explicit favicon owner and no metadata icon competitor")
}
const siteManifest = JSON.parse(read("apps/frontend/public/site.webmanifest").toString("utf8"))
if (siteManifest.icons?.map((icon) => icon.src).join(",") !== "/icon-192.png,/icon-512.png") {
  fail("PWA manifest icon mapping is unstable")
}

const wordmarkPatterns = /(?:doflow-logo\.svg|\/logo_doflow_(?:nero|bianco)(?:\.png|\.svg)|\/doflow_logo\.svg)/
function walkSources(directory) {
  return readdirSync(resolve(repoRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const child = `${directory}/${entry.name}`
    if (entry.isDirectory()) return walkSources(child)
    if (!new Set([".css", ".html", ".ts", ".tsx"]).has(extname(entry.name))) return []
    if (/\.(?:test|spec)\.[^.]+$/.test(entry.name)) return []
    return [relative(repoRoot, resolve(repoRoot, child)).replaceAll("\\", "/")]
  })
}

function walkFiles(directory) {
  return readdirSync(resolve(repoRoot, directory), { withFileTypes: true }).flatMap((entry) => {
    const child = `${directory}/${entry.name}`
    if (entry.isDirectory()) return walkFiles(child)
    return [relative(repoRoot, resolve(repoRoot, child)).replaceAll("\\", "/")]
  })
}

const declaredLegacy = manifest.legacyAssetGroups.flatMap((group) => {
  if (group.classification !== "legacy-reference-non-canonical" || !group.reason) {
    fail(`invalid legacy classification for ${group.scope || "unknown scope"}`)
  }
  return group.assets
})
const discoveredLegacy = [
  "apps/desktop/src-tauri/icons/icon.icns",
  ...walkFiles("apps/desktop/src-tauri/icons/android"),
  ...walkFiles("apps/desktop/src-tauri/icons/ios"),
]
if (new Set(declaredLegacy).size !== declaredLegacy.length) fail("duplicate legacy asset declaration")
if (
  declaredLegacy.slice().sort().join("\n") !== discoveredLegacy.slice().sort().join("\n")
) {
  fail("legacy macOS/Android/iOS inventory is incomplete or stale")
}
for (const path of declaredLegacy) read(path)

const tauriConfig = JSON.parse(read("apps/desktop/src-tauri/tauri.conf.json").toString("utf8"))
const configuredIcons = [
  ...(tauriConfig.bundle?.icon || []),
  tauriConfig.bundle?.windows?.nsis?.installerIcon,
].filter(Boolean).map((path) => `apps/desktop/src-tauri/${path}`)
for (const path of declaredLegacy) {
  if (configuredIcons.includes(path)) fail(`legacy asset became an active bundle input: ${path}`)
}
for (const path of configuredIcons) {
  if (!manifest.derivedAssets.some((asset) => asset.path === path)) {
    fail(`active bundle icon is not a deterministic canonical output: ${path}`)
  }
}
const resourceMap = tauriConfig.bundle?.resources
if (
  !resourceMap
  || Array.isArray(resourceMap)
  || resourceMap[notificationResource.path.replace("apps/desktop/src-tauri/", "")] !== notificationResource.bundleDestination
) {
  fail("Tauri bundle does not install the canonical notification resource at the runtime path")
}
const desktopBuildContract = [
  read("apps/desktop/src-tauri/tauri.conf.json"),
  read("apps/desktop/src-tauri/tauri.release.conf.json"),
  read(".github/workflows/desktop-release.yml"),
].map((bytes) => bytes.toString("utf8")).join("\n")
if (/icons\/(?:icon\.icns|android\/|ios\/)|tauri\s+(?:android|ios)\s+build/i.test(desktopBuildContract)) {
  fail("current Windows build or release contract references a legacy non-Windows asset")
}
for (const excluded of manifest.excludedLocalAssets) {
  if (!excluded.reason || desktopBuildContract.includes(excluded.path.replace("apps/desktop/src-tauri/", ""))) {
    fail(`excluded local asset became a build input: ${excluded.path}`)
  }
}

const activeSources = [
  ...walkSources("apps/desktop/src"),
  "apps/desktop/calls.html",
  "apps/desktop/index.html",
  ...walkSources("apps/frontend/src"),
]
const allowlist = new Set(manifest.wordmarkAllowlist.map((entry) => entry.path))
for (const path of activeSources) {
  if (wordmarkPatterns.test(read(path).toString("utf8")) && !allowlist.has(path)) fail(`unapproved wordmark use in ${path}`)
}
for (const path of allowlist) {
  if (!activeSources.includes(path) || !wordmarkPatterns.test(read(path).toString("utf8"))) fail(`stale wordmark allowlist entry ${path}`)
}

console.log(`Doflow brand assets: PASS (${manifest.canonicalCopies.length} authority copies, ${manifest.derivedAssets.length} deterministic outputs)`)
