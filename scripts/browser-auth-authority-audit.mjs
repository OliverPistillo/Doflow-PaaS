import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const root = process.cwd();
const frontendRoot = path.join(root, "apps", "frontend", "src");
const failures = [];
const files = [];

function visit(directory) {
  for (const entry of readdirSync(directory)) {
    const absolute = path.join(directory, entry);
    if (statSync(absolute).isDirectory()) visit(absolute);
    else if (/\.(?:ts|tsx|js|mjs)$/.test(entry)) files.push(absolute);
  }
}

function relative(file) {
  return path.relative(root, file).split(path.sep).join("/");
}

function reject(file, source, pattern, message) {
  if (pattern.test(source)) failures.push(`${relative(file)}: ${message}`);
}

visit(frontendRoot);

const auxiliaryBrowserSurfaces = [
  path.join(root, "scripts", "visual-gate.mjs"),
  ...readdirSync(path.join(root, "tests", "visual"))
    .filter((entry) => /\.spec\.ts$/.test(entry) && entry !== "auth-final.spec.ts")
    .map((entry) => path.join(root, "tests", "visual", entry)),
];

const authStoragePath = path.join(frontendRoot, "lib", "auth-storage.ts");
if (existsSync(authStoragePath)) failures.push("apps/frontend/src/lib/auth-storage.ts: legacy browser auth storage exists");

for (const file of files) {
  const name = relative(file);
  const source = readFileSync(file, "utf8");
  if (name === "apps/frontend/src/proxy.ts") continue; // server-only CRON_SECRET authentication

  reject(file, source, /Authorization\s*[:=][^\n]*Bearer|headers\.Authorization\s*=|authorization\s*:\s*[`'"]Bearer/i, "browser Authorization bearer construction");
  reject(file, source, /\b(?:get|set|store|replace|clear)AuthToken\b|\bdoflow_token\b/i, "legacy browser auth-token utility");
  reject(file, source, /(?:localStorage|sessionStorage)\.(?:getItem|setItem)\([^\n]*(?:token|jwt|bearer|auth)/i, "auth material in browser storage");
  reject(file, source, /indexedDB[^\n]*(?:token|jwt|bearer|auth)|(?:token|jwt|bearer|auth)[^\n]*indexedDB/i, "auth material in IndexedDB");
  reject(file, source, /\batob\s*\([^)]*(?:split\s*\(\s*[`'"]\.[`'"]|replace\s*\(\s*\/\-)/i, "browser JWT decoding");
  reject(file, source, /[?&](?:access_?token|jwt|bearer)=|searchParams\.(?:set|append)\(\s*[`'"](?:access_?token|jwt|bearer)/i, "auth token in URL query");
  reject(file, source, /[?&]token=\$\{|searchParams\.(?:set|append)\(\s*[`'"]token/i, "generic browser token in URL query");
  reject(file, source, /new\s+WebSocket\s*\([^\n]*(?:token|jwt|bearer)/i, "WebSocket URL contains auth material");
}

for (const file of auxiliaryBrowserSurfaces) {
  const source = readFileSync(file, "utf8");
  reject(file, source, /Authorization\s*[:=][^\n]*Bearer|headers\.Authorization\s*=|authorization\s*:\s*[`'"]Bearer/i, "visual/browser Authorization bearer construction");
  reject(file, source, /\bdoflow_token\b|session\.token|readBearerIdentity/i, "visual/browser bearer storage fallback");
}

const jwtStrategy = readFileSync(path.join(root, "apps", "backend", "src", "auth", "jwt.strategy.ts"), "utf8");
if (/fromUrlQueryParameter\s*\(\s*[`'"]token/.test(jwtStrategy)) {
  failures.push("jwt.strategy.ts: auth token query extractor is forbidden");
}

const apiSource = readFileSync(path.join(frontendRoot, "lib", "api.ts"), "utf8");
if (!/credentials:\s*[`'"]include[`'"]/.test(apiSource)) failures.push("api.ts: credentials include missing");
if (!/X-Doflow-Web/.test(apiSource)) failures.push("api.ts: browser-session discriminator missing");
if (!/X-CSRF-Token/.test(apiSource)) failures.push("api.ts: CSRF header missing");

const jwtCompatibility = readFileSync(path.join(frontendRoot, "lib", "jwt.ts"), "utf8");
if (/localStorage|sessionStorage|indexedDB|\batob\b|parseJwt|getAuthToken|Authorization|Bearer/.test(jwtCompatibility)) {
  failures.push("jwt.ts: compatibility profile cache still contains token authority");
}

process.stdout.write(`${JSON.stringify({
  status: failures.length ? "BLOCKED" : "PASS",
  filesScanned: files.length + auxiliaryBrowserSurfaces.length + 1,
  preservedNonBrowserBearer: ["apps/frontend/src/proxy.ts: CRON_SECRET server-only"],
  failures,
}, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
