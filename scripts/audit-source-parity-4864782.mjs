import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import ts from "typescript";

const root = process.cwd();
const referenceRoot = "C:\\Doflow-Reference-4864782";
const expectedReference = "4864782abc0a6a548b616262be1fe7b6366f622e";
const expectedParent = "b9a08eea2acaabf23ed56c75111f714c551374f8";
const manifestPath = path.join(
  root,
  "docs/design-references/doflow-crm-projects/SOURCE_PARITY_4864782.csv",
);

const failures = [];
const blockers = [];
const explainedVisualDifferences = [];
const visualMismatchDetails = [];

function fail(message) {
  failures.push(message);
}

function block(message) {
  blockers.push(message);
}

function git(cwd, args) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.status !== 0) {
    fail(`git ${args.join(" ")} failed in ${cwd}`);
    return "";
  }
  return String(result.stdout || "").trim();
}

function walk(directory) {
  const result = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...walk(absolute));
    else if (entry.isFile()) result.push(absolute);
  }
  return result;
}

function slash(value) {
  return value.split(path.sep).join("/");
}

function sha256(absolute) {
  return createHash("sha256").update(readFileSync(absolute)).digest("hex");
}

function targetFor(referenceFile) {
  let target;
  if (referenceFile.startsWith("src/app/dashboard/")) {
    target = `apps/frontend/src/app/(tenant)/${referenceFile.slice("src/app/".length)}`;
  } else if (referenceFile.startsWith("src/app/activities/")) {
    target = `apps/frontend/src/app/(tenant)/${referenceFile.slice("src/app/".length)}`;
  } else if (referenceFile.startsWith("src/app/projects/")) {
    target = `apps/frontend/src/app/(tenant)/${referenceFile.slice("src/app/".length)}`
      .replace("/[projectId]/", "/[id]/");
  } else if (referenceFile.startsWith("src/")) {
    target = `apps/frontend/${referenceFile}`;
  } else {
    target = `apps/frontend/${referenceFile}`;
  }
  return target.replace("/flowboard/[boardId]/", "/flowboard/[id]/");
}

const exclusions = [
  [/^src\/app\/api\/auth\//, "A", "D3CC801 AUTHORITY: reference auth API excluded"],
  [/^src\/app\/api\//, "E", "Nest backend/API authority; Next business API excluded"],
  [/^src\/app\/(login|forgot-password|reset-password)\//, "A", "D3CC801 AUTHORITY: pre-auth page excluded"],
  [/^src\/features\/identity\/(doflow-auth-shell|doflow-login-page|forgot-password-page|reset-password-page)\.tsx$/, "A", "D3CC801 AUTHORITY: pre-auth component excluded"],
  [/^src\/lib\/(auth-server|server-session)\.ts$/, "A", "D3CC801 AUTHORITY: reference session implementation excluded"],
  [/^public\/assets\/auth\//, "A", "D3CC801 AUTHORITY: reference auth artwork excluded"],
  [/^public\/assets\/flow\/mascot\//, "H", "Uncalled duplicate mascot pack excluded; active Flow artwork is resolved through the imported manifest"],
  [/^src\/app\/dashboard\/flow-arcade\//, "B", "Flow Arcade intentionally removed"],
  [/^src\/app\/dashboard\/layout\.tsx$/, "A,E,F", "Reference demo auth/server layout replaced by tenant-secure Doflow adapter composition"],
  [/^src\/features\/chat\/canonical-conversation-migration\.tsx$/, "E,F", "Unsafe demo compatibility mutation excluded from real tenant runtime"],
  [/^src\/features\/commercial\/components\/commercial-app\.tsx$/, "H", "Unreachable legacy demo composition; canonical routes use the copied page surfaces"],
  [/^src\/lib\/(app-releases-server|bonus-repository|calendar-integrations-server|company-intelligence-server|conversation-repository|customer-inbox-server|flow-preferences-server|flowboard-server|presence-server|prisma|team-chat-server|team-space-session)\.ts$/, "E", "Reference Prisma/server repository excluded; Doflow Nest API remains authoritative"],
  [/^src\/app\/(favicon\.ico|layout\.tsx|page\.tsx|not-found\.tsx)$/, "A,F", "Global/auth routing shell remains under Doflow multi-tenant authority"],
  [/^public\/(file|globe|next|vercel|window)\.svg$/, "H", "Unused framework starter asset excluded from the direct port"],
];

function exclusionFor(referenceFile) {
  for (const [pattern, code, reason] of exclusions) {
    if (pattern.test(referenceFile)) return { code, reason };
  }
  return null;
}

const adapterReasons = [
  [/^src\/components\/app-sidebar\.tsx$/, "B,C,F,G,H", "Arcade/Builder removal plus real tenant capabilities and Team Account integration"],
  [/^src\/components\/(entity-image-dialog|global-search|nav-user|team-chat-menu|team-switcher)\.tsx$/, "E,F,H", "Real API, tenant capability, or real-user adapter"],
  [/^src\/features\/chat\/team-space-call-ui\.tsx$/, "D", "LiveKit controls remain hidden while LIVEKIT_ENABLED=false"],
  [/^src\/features\/chat\/team-space-page\.tsx$/, "D,E,G,H", "Real conversations/presence/Team Account adapter with LiveKit hidden"],
  [/^src\/features\/chat\/team-space-(route|sidebar)\.tsx$/, "F,G", "Tenant capability gate and Doflow-only Team Account Admin entry point"],
  [/^src\/features\/.*provider\.tsx$/, "E,F,H", "Provider implementation mapped to authenticated Doflow APIs and real tenant data"],
  [/^src\/features\/identity\//, "E,F,H", "Doflow identity, permission, session, presence, and real-user authority"],
  [/^src\/features\/commercial\//, "E,F,H", "Commercial UI contract backed by real Doflow API adapters and capabilities"],
  [/^src\/features\/(bonus|company-intelligence|flowboard|inbox)\//, "E,F,H", "Reference contract backed by available Doflow APIs; unsupported mutations are explicitly blocked"],
  [/^src\/features\/flow\/flow-experience-provider\.tsx$/, "E,H", "Flow preferences use the Doflow compatibility adapter"],
  [/^src\/lib\/doflow-notifications\.ts$/, "E,H", "Notification DTO mapping uses the real Doflow API"],
  [/^src\/app\/dashboard\/commercial\/leads\//, "E,F,H", "Tenant route and real-data adapter"],
  [/^src\/app\/globals\.css$/, "A,B,F", "Tenant-scoped authenticated theme keeps D3CC801 auth CSS and excludes Arcade CSS"],
  [/^src\/app\/(favicon\.ico|layout\.tsx|page\.tsx)$/, "A,F", "Global multi-tenant/auth authority"],
  [/^src\/app\/(login|forgot-password|reset-password)\//, "A", "D3CC801 AUTHORITY"],
  [/^public\/(file|globe|next|vercel|window)\.svg$/, "H", "Pre-existing unused starter asset"],
];

function adapterReasonFor(referenceFile) {
  for (const [pattern, code, reason] of adapterReasons) {
    if (pattern.test(referenceFile)) return { code, reason };
  }
  return { code: "E,H", reason: "Real Doflow API/data compatibility adapter" };
}

const structuralAllowances = new Map([
  ["src/components/app-sidebar.tsx", "B,C,F,G,H"],
  ["src/components/nav-user.tsx", "E,F,H"],
  ["src/components/team-chat-menu.tsx", "D,E,H"],
  ["src/features/chat/team-space-call-ui.tsx", "D"],
  ["src/features/chat/team-space-page.tsx", "D,E,G,H"],
  ["src/features/chat/team-space-route.tsx", "F,G"],
  ["src/features/chat/team-space-sidebar.tsx", "F,G"],
  ["src/features/commercial/components/calendar-integration-settings.tsx", "E"],
  ["src/features/commercial/components/commercial-dashboard-refined.tsx", "H"],
  ["src/features/commercial/components/commercial-leads-provider.tsx", "E,F,H"],
  ["src/features/commercial/components/commercial-settings-hub.tsx", "E,H"],
  ["src/features/commercial/components/guided-call-sheet.tsx", "H"],
  ["src/features/inbox/customer-inbox-page.tsx", "E,H"],
]);

function jsxSignature(sourceText, filename) {
  const source = ts.createSourceFile(
    filename,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
  const nodes = [];
  const classes = [];

  function tagName(node) {
    return node.getText(source).replace(/\s+/g, "");
  }

  function classStrings(attribute) {
    if (!attribute.initializer) return [];
    if (ts.isStringLiteral(attribute.initializer)) return [attribute.initializer.text];
    const values = [];
    function collect(node) {
      if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
        values.push(node.text);
      } else if (
        ts.isTemplateHead(node) ||
        ts.isTemplateMiddle(node) ||
        ts.isTemplateTail(node)
      ) {
        values.push(node.text);
      }
      ts.forEachChild(node, collect);
    }
    collect(attribute.initializer);
    return values;
  }

  function attributes(node, location) {
    for (const property of node.attributes.properties) {
      if (!ts.isJsxAttribute(property)) continue;
      const name = property.name.getText(source);
      if (name === "className") {
        for (const value of classStrings(property)) classes.push(`${location}:${value}`);
      }
    }
  }

  function visit(node, depth = 0) {
    if (ts.isJsxElement(node)) {
      const tag = tagName(node.openingElement.tagName);
      const location = `${depth}:${tag}`;
      nodes.push(`<${location}>`);
      attributes(node.openingElement, location);
      for (const child of node.children) visit(child, depth + 1);
      nodes.push(`</${location}>`);
      return;
    }
    if (ts.isJsxSelfClosingElement(node)) {
      const tag = tagName(node.tagName);
      const location = `${depth}:${tag}`;
      nodes.push(`<${location}/>`);
      attributes(node, location);
      return;
    }
    if (ts.isJsxFragment(node)) {
      nodes.push(`<${depth}:Fragment>`);
      for (const child of node.children) visit(child, depth + 1);
      nodes.push(`</${depth}:Fragment>`);
      return;
    }
    ts.forEachChild(node, (child) => visit(child, depth));
  }

  visit(source);
  return { nodes, classes };
}

function equalArray(left, right) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function firstArrayMismatch(left, right) {
  const limit = Math.max(left.length, right.length);
  for (let index = 0; index < limit; index += 1) {
    if (left[index] !== right[index]) {
      return { index, reference: left[index] ?? "<end>", doflow: right[index] ?? "<end>", referenceCount: left.length, doflowCount: right.length };
    }
  }
  return null;
}

function csvCell(value) {
  const stringValue = String(value ?? "");
  return `"${stringValue.replaceAll('"', '""')}"`;
}

if (!existsSync(referenceRoot)) fail(`reference checkout missing: ${referenceRoot}`);
if (existsSync(referenceRoot)) {
  const head = git(referenceRoot, ["rev-parse", "HEAD"]);
  const parent = git(referenceRoot, ["rev-parse", "HEAD^"]);
  const dirty = git(referenceRoot, ["status", "--porcelain"]);
  if (head !== expectedReference) fail(`reference HEAD ${head || "missing"}, expected ${expectedReference}`);
  if (parent !== expectedParent) fail(`reference parent ${parent || "missing"}, expected ${expectedParent}`);
  if (dirty) fail("reference checkout is not clean/read-only evidence");
}

const referenceFiles = existsSync(referenceRoot)
  ? [path.join(referenceRoot, "src"), path.join(referenceRoot, "public")]
      .flatMap((directory) => walk(directory))
      .map((absolute) => slash(path.relative(referenceRoot, absolute)))
      .sort()
  : [];
const sourceCount = referenceFiles.filter((file) => file.startsWith("src/")).length;
const publicCount = referenceFiles.filter((file) => file.startsWith("public/")).length;
if (sourceCount !== 273) fail(`reference src inventory changed: ${sourceCount}, expected 273`);
if (publicCount !== 140) fail(`reference public inventory changed: ${publicCount}, expected 140`);

const rows = [];
const mappedTargets = new Set();
for (const referenceFile of referenceFiles) {
  const targetFile = targetFor(referenceFile);
  mappedTargets.add(targetFile);
  const referenceAbsolute = path.join(referenceRoot, ...referenceFile.split("/"));
  const targetAbsolute = path.join(root, ...targetFile.split("/"));
  const excluded = exclusionFor(referenceFile);
  const targetExists = existsSync(targetAbsolute) && statSync(targetAbsolute).isFile();
  const referenceHash = sha256(referenceAbsolute);
  const targetHash = targetExists ? sha256(targetAbsolute) : "";
  let mode;
  let allowlist = "";
  let reason = "";
  let jsxParity = "N/A";
  let classParity = "N/A";

  if (excluded) {
    mode = "EXCLUDED";
    allowlist = excluded.code;
    reason = excluded.reason;
  } else if (!targetExists) {
    mode = "MISSING";
    reason = "Applicable reference file has no Doflow target";
    fail(`${referenceFile} is missing at ${targetFile}`);
  } else if (referenceHash === targetHash) {
    mode = "VERBATIM";
    reason = "SHA-256 identical";
  } else {
    mode = "VISUAL_VERBATIM_DATA_ADAPTER";
    const adapter = adapterReasonFor(referenceFile);
    allowlist = adapter.code;
    reason = adapter.reason;
    if (referenceFile.endsWith(".tsx")) {
      const referenceSignature = jsxSignature(readFileSync(referenceAbsolute, "utf8"), referenceFile);
      const targetSignature = jsxSignature(readFileSync(targetAbsolute, "utf8"), targetFile);
      jsxParity = equalArray(referenceSignature.nodes, targetSignature.nodes) ? "PASS" : "DIFF";
      classParity = equalArray(referenceSignature.classes, targetSignature.classes) ? "PASS" : "DIFF";
      if (jsxParity === "DIFF" || classParity === "DIFF") {
        visualMismatchDetails.push({
          referenceFile,
          jsx: firstArrayMismatch(referenceSignature.nodes, targetSignature.nodes),
          classes: firstArrayMismatch(referenceSignature.classes, targetSignature.classes),
        });
        const structuralAllowance = structuralAllowances.get(referenceFile);
        if (structuralAllowance) {
          explainedVisualDifferences.push({
            referenceFile,
            targetFile,
            jsxParity,
            classParity,
            allowlist: structuralAllowance,
          });
        } else {
          fail(`${referenceFile} has non-allowlisted JSX/class differences (JSX ${jsxParity}, classes ${classParity})`);
        }
      }
    }
  }

  rows.push({
    referenceFile,
    targetFile,
    mode,
    allowlist,
    reason,
    referenceHash,
    targetHash,
    jsxParity,
    classParity,
  });
}

const doflowOnlyReasons = new Map([
  ["apps/frontend/src/app/(tenant)/layout.tsx", ["A,F", "Authenticated schema-per-tenant shell and D3CC801 session authority"]],
  ["apps/frontend/src/components/layout/tenant-app-shell.tsx", ["E,F,G", "Doflow-only provider/data composition; generic tenants retain their prior shell"]],
  ["apps/frontend/src/components/generic-tenant-sidebar.tsx", ["F", "Compatibility shell for non-Doflow tenants"]],
  ["apps/frontend/src/features/commercial/use-commercial-team.ts", ["E,F,H", "Maps the reference TeamMember shape from real authorized tenant users"]],
  ["apps/frontend/src/lib/tenant-feature-api.ts", ["E,F", "Authenticated Doflow Nest API compatibility client"]],
]);

const changedFrontend = new Set([
  ...git(root, ["diff", "--name-only", "--", "apps/frontend"]).split(/\r?\n/),
  ...git(root, ["ls-files", "--others", "--exclude-standard", "--", "apps/frontend"]).split(/\r?\n/),
].filter(Boolean).map((file) => slash(file)));
for (const targetFile of [...changedFrontend].sort()) {
  if (mappedTargets.has(targetFile)) continue;
  const targetAbsolute = path.join(root, ...targetFile.split("/"));
  if (!existsSync(targetAbsolute) || !statSync(targetAbsolute).isFile()) continue;
  const [allowlist, reason] = doflowOnlyReasons.get(targetFile) ?? ["E,F,G,H", "Doflow-only API, capability, or dynamic-data compatibility layer"];
  rows.push({
    referenceFile: "",
    targetFile,
    mode: "DOFLOW_ONLY",
    allowlist,
    reason,
    referenceHash: "",
    targetHash: sha256(targetAbsolute),
    jsxParity: "N/A",
    classParity: "N/A",
  });
}

const criticalVerbatim = [
  "src/components/ui/sidebar.tsx",
  "src/components/nav-main.tsx",
  "src/components/dashboard-header.tsx",
  "src/components/dashboard-shell.tsx",
];
for (const referenceFile of criticalVerbatim) {
  if (rows.find((row) => row.referenceFile === referenceFile)?.mode !== "VERBATIM") {
    fail(`critical shell source is not VERBATIM: ${referenceFile}`);
  }
}
for (const token of [
  'SIDEBAR_WIDTH = "16rem"',
  'SIDEBAR_WIDTH_MOBILE = "18rem"',
  'SIDEBAR_WIDTH_ICON = "3rem"',
]) {
  const sidebar = readFileSync(path.join(root, "apps/frontend/src/components/ui/sidebar.tsx"), "utf8");
  if (!sidebar.includes(token)) fail(`critical sidebar token missing: ${token}`);
}

const frontendSource = walk(path.join(root, "apps/frontend/src"))
  .filter((absolute) => /\.(?:ts|tsx|js|jsx|json)$/.test(absolute))
  .map((absolute) => readFileSync(absolute, "utf8"))
  .join("\n");
const flowManifestAbsolute = path.join(root, "apps/frontend/public/assets/flow/manifest.json");
const flowManifestText = existsSync(flowManifestAbsolute) ? readFileSync(flowManifestAbsolute, "utf8") : "";
const assetOrphans = [];
for (const row of rows.filter((item) => item.referenceFile.startsWith("public/") && item.mode !== "EXCLUDED" && item.mode !== "MISSING")) {
  const url = `/${row.referenceFile.slice("public/".length)}`;
  if (row.referenceFile === "public/assets/flow/manifest.json") {
    if (!frontendSource.includes("public/assets/flow/manifest.json")) assetOrphans.push(row.targetFile);
    continue;
  }
  if (row.referenceFile.startsWith("public/assets/flow/")) {
    const stickerEquivalent = url.replace("/assets/flow/emoji/", "/assets/flow/stickers/emotions/");
    if (!flowManifestText.includes(url) && !flowManifestText.includes(stickerEquivalent)) assetOrphans.push(row.targetFile);
    continue;
  }
  if (!frontendSource.includes(url)) assetOrphans.push(row.targetFile);
}
if (assetOrphans.length) fail(`copied reference assets without caller: ${assetOrphans.join(", ")}`);

const missingPersistenceChecks = [
  ["Calendar integrations", "apps/frontend/src/features/commercial/components/calendar-integration-settings.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT"],
  ["Company Intelligence mutations", "apps/frontend/src/features/company-intelligence/company-intelligence-provider.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT"],
  ["Inbox scheduling/update workflows", "apps/frontend/src/features/inbox/customer-inbox-provider.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT"],
  ["Flowboard templates/project/duplicate contract", "apps/frontend/src/features/flowboard/flowboard-provider.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT"],
  ["Bonus payout", "apps/frontend/src/features/bonus/bonus-provider.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT"],
  ["Chat emoji preferences", "apps/frontend/src/features/chat/chat-rich-content.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT: emoji recents"],
  ["Commerce settings", "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT: CommerceSettings"],
  ["Customer care settings", "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT: CustomerCare"],
  ["Customer finance mutations", "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT: CustomerFinance"],
  ["Customer document metadata", "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT: CustomerDocument"],
  ["Timed presence expiry", "apps/frontend/src/features/identity/doflow-presence-provider.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT: timed presence expiry"],
  ["Guided calls", "apps/frontend/src/features/commercial/components/commercial-leads-provider.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT: GuidedCall"],
  ["Order line and commercial-field updates", "apps/frontend/src/features/commercial/components/commerce-form-dialogs.tsx", "BLOCKED — MISSING PERSISTENCE CONTRACT: order line and commercial-field updates"],
];
for (const [name, relative, marker] of missingPersistenceChecks) {
  const absolute = path.join(root, ...relative.split("/"));
  if (existsSync(absolute) && readFileSync(absolute, "utf8").includes(marker)) {
    block(`${name}: BLOCKED — MISSING PERSISTENCE CONTRACT`);
  }
}
const permissions = readFileSync(path.join(root, "apps/frontend/src/features/identity/permissions.ts"), "utf8");
if (permissions.includes("No persisted, versioned TeamDuty contract")) {
  block("Team Duties version/history: BLOCKED — MISSING PERSISTENCE CONTRACT");
}

const header = [
  "REFERENCE_FILE",
  "DOFLOW_FILE",
  "MODE",
  "ALLOWLIST",
  "REASON",
  "REFERENCE_SHA256",
  "DOFLOW_SHA256",
  "JSX_PARITY",
  "CLASS_PARITY",
];
const csv = [
  header.map(csvCell).join(","),
  ...rows.map((row) => header.map((key) => csvCell(row[
    {
      REFERENCE_FILE: "referenceFile",
      DOFLOW_FILE: "targetFile",
      MODE: "mode",
      ALLOWLIST: "allowlist",
      REASON: "reason",
      REFERENCE_SHA256: "referenceHash",
      DOFLOW_SHA256: "targetHash",
      JSX_PARITY: "jsxParity",
      CLASS_PARITY: "classParity",
    }[key]
  ])).join(",")),
].join("\n") + "\n";
writeFileSync(manifestPath, csv, "utf8");

const counts = Object.fromEntries(
  [...new Set(rows.map((row) => row.mode))]
    .sort()
    .map((mode) => [mode, rows.filter((row) => row.mode === mode).length]),
);
const applicableReference = rows.filter((row) => row.referenceFile && row.mode !== "EXCLUDED");
const verbatim = applicableReference.filter((row) => row.mode === "VERBATIM").length;
const sourceParityPercent = applicableReference.length
  ? Number(((verbatim / applicableReference.length) * 100).toFixed(2))
  : 0;
const sourcePortCoveragePercent = applicableReference.length
  ? Number(((applicableReference.filter((row) => row.mode === "VERBATIM" || row.mode === "VISUAL_VERBATIM_DATA_ADAPTER").length / applicableReference.length) * 100).toFixed(2))
  : 0;
const report = {
  status: failures.length ? "FAIL" : blockers.length ? "BLOCKED" : "PASS",
  reference: {
    root: referenceRoot,
    sha: expectedReference,
    parent: expectedParent,
    sourceFiles: sourceCount,
    publicFiles: publicCount,
    totalCandidates: referenceFiles.length,
  },
  manifest: slash(path.relative(root, manifestPath)),
  counts,
  applicableReferenceFiles: applicableReference.length,
  sourcePortCoveragePercent,
  verbatimSourceParityPercent: sourceParityPercent,
  unexplainedSourceDifferences: failures.length,
  explainedVisualDifferences,
  visualMismatchDetails,
  copiedAssetOrphans: assetOrphans,
  blockers,
  failures,
};
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length || blockers.length) process.exitCode = 1;
