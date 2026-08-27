import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const extractionRoot = "C:\\Doflow-Builder-Extracted";
const failures = [];

const forbiddenRuntime =
  /site-proposals|site-proposal|SiteProposal|SiteProposals|canUseBuilder|\/commercial\/site-proposals/;
const routeRoots = [
  "apps/frontend/src/app/(tenant)/commercial/site-proposals",
  "apps/frontend/src/components/tenant-site-proposals",
];
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"]);

function walk(directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...walk(absolute));
    else files.push(absolute);
  }
  return files;
}

function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

for (const relative of routeRoots) {
  const absolute = path.join(root, relative);
  if (walk(absolute).length) failures.push(`active Builder path remains: ${relative}`);
}

const runtimeFiles = [
  ...walk(path.join(root, "apps/frontend/src")),
  ...walk(path.join(root, "apps/backend/src")),
].filter((file) => codeExtensions.has(path.extname(file)) && !/\.(?:spec|test)\.[^.]+$/i.test(file));
const runtimeHits = runtimeFiles
  .filter((file) => forbiddenRuntime.test(readFileSync(file, "utf8")))
  .map((file) => path.relative(root, file).split(path.sep).join("/"));
if (runtimeHits.length) failures.push(`Builder runtime callers remain: ${runtimeHits.join(", ")}`);

for (const manifest of ["apps/frontend/package.json", "apps/backend/package.json"]) {
  const source = JSON.parse(readFileSync(path.join(root, manifest), "utf8"));
  const dependencies = { ...source.dependencies, ...source.devDependencies };
  const builderOnly = ["axios", "cheerio", "sharp", "yauzl"].filter((name) => name in dependencies);
  if (builderOnly.length) failures.push(`${manifest}: Builder-only dependencies remain: ${builderOnly.join(", ")}`);
}

let extractedFiles = 0;
let extractedBytes = 0;
let extractionVerified = false;
if (!existsSync(extractionRoot)) {
  failures.push(`extraction directory missing: ${extractionRoot}`);
} else {
  const manifestCsv = path.join(extractionRoot, "MANIFEST.csv");
  const manifestSha = path.join(extractionRoot, "MANIFEST.sha256");
  for (const required of ["README.md", "README_REINTEGRATION.md", "SOURCE_BASELINE.txt", "MANIFEST.csv", "MANIFEST.sha256", "repo-tree"]) {
    if (!existsSync(path.join(extractionRoot, required))) failures.push(`extraction artifact missing: ${required}`);
  }
  if (existsSync(manifestCsv) && existsSync(manifestSha)) {
    const rows = readFileSync(manifestCsv, "utf8")
      .split(/\r?\n/)
      .slice(1)
      .filter(Boolean)
      .map((line) => line.match(/^"([^"]+)","([^"]+)","([^"]+)","(\d+)","([a-f0-9]{64})"$/i))
      .filter(Boolean)
      .map((match) => ({ relative: match[1], bytes: Number(match[4]), hash: match[5].toLowerCase() }));
    const shaRows = new Map(
      readFileSync(manifestSha, "utf8")
        .split(/\r?\n/)
        .filter(Boolean)
        .map((line) => {
          const match = line.match(/^([a-f0-9]{64}) \*repo-tree\/(.+)$/i);
          return match ? [match[2].replaceAll("/", path.sep), match[1].toLowerCase()] : [line, "INVALID"];
        }),
    );
    for (const row of rows) {
      const relative = row.relative.replaceAll("/", path.sep);
      const file = path.join(extractionRoot, "repo-tree", relative);
      if (!existsSync(file)) {
        failures.push(`extracted file missing: ${row.relative}`);
        continue;
      }
      const actualBytes = statSync(file).size;
      const actualHash = sha256(file);
      if (actualBytes !== row.bytes || actualHash !== row.hash || shaRows.get(relative) !== row.hash) {
        failures.push(`extracted file verification failed: ${row.relative}`);
      }
      extractedFiles += 1;
      extractedBytes += actualBytes;
    }
    if (rows.length !== shaRows.size) failures.push("extraction manifest row counts differ");
    extractionVerified = failures.every((item) => !item.startsWith("extract"));
  }
  const forbiddenExtractedPaths = walk(extractionRoot)
    .map((file) => path.relative(extractionRoot, file).split(path.sep).join("/"))
    .filter((relative) => /(^|\/)(?:\.env(?:\.|$)|\.visual-auth(?:\/|$)|node_modules(?:\/|$)|\.next(?:\/|$)|.*\.(?:har|trace|log))|(?:cookie|credential|database-dump)(?:\/|$)/i.test(relative));
  if (forbiddenExtractedPaths.length) failures.push(`unsafe extraction paths: ${forbiddenExtractedPaths.join(", ")}`);
}

const diff = spawnSync("git", ["diff", "--unified=0", "--", "apps/backend", "migrations"], {
  cwd: root,
  encoding: "utf8",
  windowsHide: true,
});
const destructiveAddedLines = String(diff.stdout ?? "")
  .split(/\r?\n/)
  .filter((line) => /^\+(?!\+\+)/.test(line) && /\b(?:DROP\s+(?:TABLE|SCHEMA)|TRUNCATE|DELETE\s+FROM)\b/i.test(line));
if (destructiveAddedLines.length) failures.push("destructive Builder database change detected");

const report = {
  status: failures.length ? "BLOCKED" : "PASS",
  extractionDirectory: extractionRoot,
  extractedFiles,
  extractedBytes,
  extractionVerified,
  frontendReachability: runtimeHits.filter((file) => file.startsWith("apps/frontend/")).length,
  backendReachability: runtimeHits.filter((file) => file.startsWith("apps/backend/")).length,
  destructiveDatabaseChanges: destructiveAddedLines.length,
  failures,
};

process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`BUILDER EXTRACTION VERIFIED = ${extractionVerified ? "PASS" : "FAIL"}\n`);
process.stdout.write(`BUILDER FRONTEND REACHABILITY = ${report.frontendReachability}\n`);
process.stdout.write(`BUILDER ACTIVE RUNTIME REFERENCES = ${runtimeHits.length}\n`);
process.stdout.write(`BUILDER BACKEND ACTIVE REFERENCES = ${report.backendReachability}\n`);
process.stdout.write(`BUILDER DB DESTRUCTIVE CHANGES = ${report.destructiveDatabaseChanges}\n`);
if (failures.length) process.exitCode = 1;
