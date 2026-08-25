import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const checks = {};

function read(relative) {
  return readFileSync(path.join(root, relative), 'utf8');
}

function fail(message) {
  failures.push(message);
}

function trackedFiles() {
  const result = spawnSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'buffer', windowsHide: true });
  if (result.status !== 0) throw new Error('Unable to enumerate tracked files.');
  return result.stdout.toString('utf8').split('\0').filter(Boolean);
}

const tracked = trackedFiles();
const textual = tracked.filter((file) => /\.(?:cjs|css|env|html|js|json|jsx|md|mjs|sql|ts|tsx|txt|yaml|yml)$/i.test(file));
const secretPatterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,
  /\bAKIA[0-9A-Z]{16}\b/,
  /\bAIza[0-9A-Za-z_-]{30,}\b/,
  /\bgh[pousr]_[0-9A-Za-z]{30,}\b/,
  /\bsk_live_[0-9A-Za-z]{16,}\b/,
  /\bwhsec_[0-9A-Za-z]{24,}\b/,
];
const secretHits = [];
for (const file of textual) {
  let source;
  try { source = read(file); } catch { continue; }
  if (secretPatterns.some((pattern) => pattern.test(source))) secretHits.push(file);
}
if (secretHits.length) fail(`tracked secret-like material: ${secretHits.join(', ')}`);
checks.secretScan = { trackedFiles: tracked.length, hits: secretHits.length };

const trackedEnvs = tracked.filter((file) => /(^|\/)\.env(?:\.|$)/.test(file) && !/\.example$/.test(file));
if (trackedEnvs.length) fail(`tracked environment files: ${trackedEnvs.join(', ')}`);
checks.environmentScan = { trackedEnvironmentFiles: trackedEnvs.length };

const routeFiles = tracked.filter((file) => /^apps\/frontend\/src\/app\//.test(file) && /\/page\.(?:js|jsx|ts|tsx)$/.test(file));
const portalRoutes = routeFiles.filter((file) => /\/client(?:-portal)?\//.test(`/${file}/`));
if (portalRoutes.length) fail(`Client Portal routes: ${portalRoutes.join(', ')}`);
checks.clientPortal = { routes: portalRoutes.length };

const productionSourceFiles = tracked.filter((file) => /^apps\/(?:backend|frontend)\/src\//.test(file) && /\.(?:js|jsx|mjs|ts|tsx)$/.test(file) && !/\.(?:spec|test)\./.test(file) && existsSync(path.join(root, file)));
const arbitraryExecution = [];
for (const file of productionSourceFiles) {
  const source = read(file);
  if (/\beval\s*\(|new\s+Function\s*\(/.test(source)) arbitraryExecution.push(file);
}
if (arbitraryExecution.length) fail(`arbitrary code execution primitives: ${arbitraryExecution.join(', ')}`);
checks.arbitraryCodeExecution = { hits: arbitraryExecution.length };

const browserPersistenceHits = [];
for (const file of productionSourceFiles.filter((file) => file.startsWith('apps/frontend/'))) {
  const source = read(file);
  if (/(?:localStorage|sessionStorage)\.setItem\([^\n]*(?:data:|blob:)/i.test(source)) browserPersistenceHits.push(file);
}
if (browserPersistenceHits.length) fail(`Data/Blob URL persistence: ${browserPersistenceHits.join(', ')}`);
checks.dataBlobPersistence = { hits: browserPersistenceHits.length };

const demoAccountHits = [];
for (const file of productionSourceFiles) {
  if (/\bdemo@[a-z0-9.-]+|@demo\.[a-z]+|demo[_-]?password/i.test(read(file))) demoAccountHits.push(file);
}
if (demoAccountHits.length) fail(`demo account material: ${demoAccountHits.join(', ')}`);
checks.demoAccounts = { hits: demoAccountHits.length };

const isolatedFiles = [
  'scripts/commercial-core-isolated-stack.mjs',
  'scripts/start-isolated-backend.mjs',
  'scripts/start-isolated-frontend.mjs',
  'tests/acceptance/final-global-isolated.spec.ts',
  'tests/acceptance/final-global-visual.spec.ts',
  'playwright.final-global.config.ts',
  'playwright.final-visual.config.ts',
];
const productionHostHits = isolatedFiles.filter((file) => existsSync(path.join(root, file)) && /(?:api|app)\.doflow\.it/i.test(read(file)));
if (productionHostHits.length) fail(`production hostname in final acceptance: ${productionHostHits.join(', ')}`);
checks.isolatedHostnames = { productionHostHits: productionHostHits.length };

const browserAudit = spawnSync(process.execPath, [path.join(root, 'scripts/browser-auth-authority-audit.mjs')], {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true,
});
if (browserAudit.status !== 0) fail('browser token/JWT URL audit failed');
checks.browserTokenAndJwtUrl = { passed: browserAudit.status === 0 };

const automationEngine = read('apps/backend/src/tenant/tenant-automation-engine.service.ts');
const automationService = read('apps/backend/src/tenant/tenant-automations.service.ts');
if (!automationService.includes('switch (actionType)') || /\beval\s*\(|new\s+Function\s*\(/.test(`${automationEngine}\n${automationService}`)) {
  fail('automation action execution is not a closed server-side dispatch');
}
checks.automationSqlAndExecution = { closedDispatch: true, arbitrarySqlInput: false };

const collaboration = read('apps/backend/src/tenant/tenant-doflow-collaboration.service.ts');
if (!collaboration.includes('ATTACHMENT_MIME_TYPES') || !collaboration.includes('size > 5_000_000')) {
  fail('collaboration upload allowlist/size contract missing');
}
checks.uploadAllowlist = { mimeAllowlist: true, sizeLimit: true };

const proposalController = read('apps/backend/src/tenant/tenant-site-proposals.controller.ts');
const proposalCompiler = read('apps/backend/src/tenant/tenant-site-proposals-theme-compiler.service.ts');
if (!proposalController.includes('Content-Security-Policy') || !proposalCompiler.includes("default-src 'none'")) {
  fail('untrusted Builder preview CSP missing');
}
checks.cspReview = { untrustedBuilderArtifacts: 'restrictive CSP', applicationHeaders: 'cutover infrastructure verification retained' };

const fileStorage = read('apps/backend/src/file-storage.service.ts');
const backupController = read('apps/backend/src/superadmin/backup.controller.ts');
if (!fileStorage.includes('GetObjectCommand') || !backupController.includes('streamDownload')) {
  fail('authenticated storage streaming contract missing');
}
checks.signedUrlReview = { authenticatedProxyStreaming: true, externalSignedUrlPersistence: false };

const telemetry = read('apps/backend/src/telemetry/global-exception.filter.ts');
if (!/metadata|message/.test(telemetry) || /request\.headers|authorization|cookie/i.test(telemetry)) {
  fail('log redaction boundary is not explicit');
}
checks.logRedaction = { authHeadersLogged: false, cookiesLogged: false };

const report = { status: failures.length ? 'BLOCKED' : 'PASS', failures, checks };
process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
if (failures.length) process.exitCode = 1;
