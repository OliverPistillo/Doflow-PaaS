import { spawn } from 'node:child_process';
import { createHmac } from 'node:crypto';
import { access, chmod, cp, lstat, mkdir, readFile, readdir, readlink, rm, stat, symlink, unlink } from 'node:fs/promises';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const packageRunner = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'corepack';
const frontendPort = 3100;
const frontendUrl = `http://localhost:${frontendPort}`;
const isolated = process.argv.includes('--isolated') || process.env.DOFLOW_VISUAL_ISOLATED === '1';
const backendUrl = isolated
  ? (process.env.DOFLOW_VISUAL_BACKEND_URL || 'http://localhost:3401')
  : 'https://api.doflow.it';
const authDir = path.join(root, '.visual-auth');
const storageStatePath = path.join(authDir, 'storage-state.json');
const acceptanceCredentialPath = path.join(authDir, 'acceptance-credentials.json');
const visualRuntimeDir = path.join(root, '.visual-runtime');
const standaloneDir = path.join(root, 'apps', 'frontend', '.next', 'standalone');
const staticDir = path.join(root, 'apps', 'frontend', '.next', 'static');
const publicDir = path.join(root, 'apps', 'frontend', 'public');
const headed = process.argv.includes('--headed');
const clearAuth = process.argv.includes('--clear-auth');
const children = new Set();
const authorizedRoles = new Set(['owner', 'admin', 'superadmin', 'super_admin']);

class VisualBlockedError extends Error {}
class VisualNoGoError extends Error {}

function log(message) {
  process.stdout.write(`[visual:gate] ${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function spawnProcess(command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || root,
    stdio: options.stdio || 'inherit',
    env: options.env || process.env,
    windowsHide: true,
  });
  children.add(child);
  child.once('exit', () => children.delete(child));
  return child;
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawnProcess(command, args, options);
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (timer) clearTimeout(timer);
      if (error) reject(error);
      else resolve();
    };
    const timer = options.timeoutMs
      ? setTimeout(() => {
          void stopProcess(child).finally(() => {
            finish(new Error(`${command} ${args.join(' ')} timed out after ${options.timeoutMs}ms`));
          });
        }, options.timeoutMs)
      : undefined;

    child.once('error', finish);
    child.once('exit', (code, signal) => {
      if (code === 0) finish();
      else finish(new Error(`${command} ${args.join(' ')} exited with ${code ?? signal}`));
    });
  });
}

function pnpm(args, options = {}) {
  const runnerArgs = isWindows
    ? ['/d', '/s', '/c', 'corepack', 'pnpm@10.24.0', ...args]
    : ['pnpm@10.24.0', ...args];
  return run(packageRunner, runnerArgs, options);
}

async function stopProcess(child) {
  if (!child || child.exitCode !== null) return;
  if (isWindows) {
    await new Promise((resolve) => {
      const killer = spawn('taskkill.exe', ['/pid', String(child.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true,
      });
      killer.once('exit', resolve);
      killer.once('error', resolve);
    });
    return;
  }
  child.kill('SIGTERM');
}

async function assertPortAvailable() {
  await new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.once('error', () => reject(new VisualBlockedError(`localhost:${frontendPort} non disponibile`)));
    server.listen({ host: 'localhost', port: frontendPort, exclusive: true }, () => {
      server.close(resolve);
    });
  });
}

async function prepareVisualRuntime(frontendEnv) {
  await rm(visualRuntimeDir, { recursive: true, force: true });
  log('Build frontend standalone per il server mode visuale...');
  await pnpm(['-C', 'apps/frontend', 'build'], {
    env: frontendEnv,
    timeoutMs: 30 * 60_000,
  });

  try {
    await access(path.join(standaloneDir, 'apps', 'frontend', 'server.js'));
    await access(staticDir);
    await access(publicDir);
  } catch {
    throw new VisualBlockedError('output standalone frontend incompleto');
  }

  await mkdir(path.join(visualRuntimeDir, 'apps', 'frontend', '.next'), { recursive: true });
  await hydrateTracedDependencies(standaloneDir);
  // Keep relative pnpm links relative while copying. Without verbatimSymlinks,
  // fs.cp materializes Windows links against the build directory and the
  // supposedly isolated runtime still resolves modules from .next/standalone.
  await cp(standaloneDir, visualRuntimeDir, { recursive: true, verbatimSymlinks: true });
  await isolateStandaloneDependencyLinks(visualRuntimeDir);
  await cp(staticDir, path.join(visualRuntimeDir, 'apps', 'frontend', '.next', 'static'), {
    recursive: true,
  });
  await cp(publicDir, path.join(visualRuntimeDir, 'apps', 'frontend', 'public'), {
    recursive: true,
  });
}

async function hydrateTracedDependencies(targetStandaloneDir) {
  // Next 16's Windows file trace may retain only the CJS half of @swc/helpers,
  // although the standalone server imports its ESM helpers at runtime.
  const packageStore = path.join(targetStandaloneDir, 'node_modules', '.pnpm');
  const entries = await readdir(packageStore);
  let hydrated = 0;
  for (const entry of entries.filter((name) => name.startsWith('@swc+helpers@'))) {
    const source = path.join(root, 'node_modules', '.pnpm', entry, 'node_modules', '@swc', 'helpers');
    const destination = path.join(packageStore, entry, 'node_modules', '@swc', 'helpers');
    try {
      await access(source);
      await cp(source, destination, { recursive: true, force: true });
      hydrated += 1;
    } catch {
      throw new VisualBlockedError('dipendenza standalone @swc/helpers incompleta');
    }
  }
  if (hydrated > 0) log(`Output standalone completato: ${hydrated} pacchetto @swc/helpers idratato.`);
}

async function isolateStandaloneDependencyLinks(sourceDir) {
  const workspaceModulesDir = path.join(root, 'node_modules');
  let recreated = 0;

  async function visit(currentSourceDir) {
    const entries = await readdir(currentSourceDir, { withFileTypes: true });
    for (const entry of entries) {
      const sourcePath = path.join(currentSourceDir, entry.name);
      const sourceStats = await lstat(sourcePath);
      if (sourceStats.isSymbolicLink()) {
        const rawTarget = await readlink(sourcePath);
        const absoluteTarget = path.resolve(path.dirname(sourcePath), rawTarget);
        const targetRelativeToRuntime = path.relative(sourceDir, absoluteTarget);
        if (!targetRelativeToRuntime.startsWith('..') && !path.isAbsolute(targetRelativeToRuntime)) {
          continue;
        }
        const targetRelativeToModules = path.relative(workspaceModulesDir, absoluteTarget);
        if (targetRelativeToModules.startsWith('..') || path.isAbsolute(targetRelativeToModules)) {
          throw new VisualBlockedError('link standalone esterno al workspace node_modules');
        }
        const isolatedTarget = path.join(sourceDir, 'node_modules', targetRelativeToModules);
        await access(isolatedTarget);
        const targetStats = await stat(absoluteTarget);
        await unlink(sourcePath);
        await symlink(
          path.relative(path.dirname(sourcePath), isolatedTarget),
          sourcePath,
          targetStats.isDirectory() ? 'dir' : 'file',
        );
        recreated += 1;
        continue;
      }
      if (sourceStats.isDirectory()) await visit(sourcePath);
    }
  }

  await visit(sourceDir);
  log(`Output standalone isolato: ${recreated} link dipendenza resi interni.`);
}

async function waitFor(url, label, frontendProcess, timeoutMs = 180_000) {
  const deadline = Date.now() + timeoutMs;
  let lastStatus = null;
  while (Date.now() < deadline) {
    if (frontendProcess?.exitCode !== null) {
      throw new VisualBlockedError(`${label} terminato prima di essere pronto`);
    }
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(5_000) });
      lastStatus = response.status;
      if (response.status < 500) return;
    } catch {
      // Keep polling without logging response data.
    }
    await sleep(1_000);
  }
  throw new VisualBlockedError(`${label} non disponibile${lastStatus ? ` (HTTP ${lastStatus})` : ''}`);
}

function validateIdentity(payload) {
  const user = payload?.user || payload;
  const tenant = String(user?.tenantSlug || user?.tenantId || user?.tenant_id || '').toLowerCase();
  const role = String(user?.role || '').toLowerCase();
  const authStage = String(user?.authStage || '').toUpperCase();
  const pending = user?.mfa_pending === true || ['MFA_PENDING', 'MFA_SETUP_NEEDED'].includes(authStage);
  const complete = !pending && (authStage === 'FULL' || authStage === '');

  if (tenant !== 'doflow' || !authorizedRoles.has(role) || !complete) return null;
  return { tenant, role, authStage: authStage || 'FULL' };
}

async function readStoredSession() {
  try {
    const state = JSON.parse(await readFile(storageStatePath, 'utf8'));
    const nowSeconds = Date.now() / 1000;
    const sessionCookie = state.cookies?.find((entry) =>
      ['doflow_session', '__Host-doflow_session'].includes(entry.name) &&
      String(entry.domain || '').replace(/^\./, '') === 'localhost' &&
      (entry.expires === -1 || Number(entry.expires) > nowSeconds + 60),
    );
    return sessionCookie ? { kind: 'cookie', identity: null } : null;
  } catch {
    return null;
  }
}

async function ensureChromium() {
  let playwright;
  try {
    playwright = await import('@playwright/test');
  } catch {
    throw new VisualBlockedError('Playwright non disponibile');
  }

  try {
    await access(playwright.chromium.executablePath());
  } catch {
    log('Installazione Chromium Playwright nella cache locale...');
    try {
      await pnpm(['exec', 'playwright', 'install', 'chromium'], { timeoutMs: 600_000 });
    } catch {
      throw new VisualBlockedError('Chromium non eseguibile');
    }
  }
  return playwright.chromium;
}

function apiDecision(request, authFlow) {
  const url = new URL(request.url());
  if (!url.pathname.startsWith('/api/')) return { allowed: true };
  if (url.origin !== frontendUrl) {
    return { allowed: false, reason: 'accesso API diretto vietato' };
  }

  const method = request.method().toUpperCase();
  if (['GET', 'HEAD', 'OPTIONS'].includes(method)) return { allowed: true };

  const isAuthMutation =
    url.pathname === '/api/auth/login' ||
    url.pathname.startsWith('/api/auth/mfa/') ||
    url.pathname === '/api/auth/refresh';
  if (authFlow && method === 'POST' && isAuthMutation) return { allowed: true };

  return { allowed: false, reason: 'mutazione non consentita in server mode' };
}

async function captureManualAuthentication(chromium) {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({
    baseURL: frontendUrl,
    colorScheme: 'light',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  });
  const blocked = [];

  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const decision = apiDecision(request, true);
    if (decision.allowed) {
      await route.continue();
      return;
    }
    const entry = { method: request.method().toUpperCase(), pathname: new URL(request.url()).pathname, reason: decision.reason };
    blocked.push(entry);
    process.stderr.write(`[visual:gate] BLOCKED ${entry.method} ${entry.pathname}: ${entry.reason}\n`);
    await route.abort('blockedbyclient');
  });

  try {
    const page = await context.newPage();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    log('Chromium aperto su http://localhost:3100/login. Completa login e MFA nella finestra; il gate riprenderà automaticamente.');

    const deadline = Date.now() + 20 * 60_000;
    let authenticated = null;
    while (Date.now() < deadline && !authenticated) {
      for (const candidate of context.pages().reverse()) {
        try {
          const payload = await candidate.evaluate(async () => {
            const response = await fetch('/api/auth/me', { credentials: 'include' });
            if (!response.ok) return null;
            return response.json();
          });
          const cookieIdentity = validateIdentity(payload);
          if (cookieIdentity) {
            authenticated = cookieIdentity;
            break;
          }
        } catch {
          // Ignore transient navigation contexts.
        }
      }
      if (!authenticated) await sleep(1_000);
    }

    if (!authenticated) throw new VisualBlockedError('autenticazione non completata entro il tempo disponibile');
    if (blocked.length > 0) throw new VisualNoGoError('il firewall ha bloccato richieste mutative inattese durante l’autenticazione');

    await mkdir(authDir, { recursive: true });
    await context.storageState({ path: storageStatePath });
    try {
      await chmod(storageStatePath, 0o600);
    } catch {
      // Windows ACLs are inherited from the user profile/workspace.
    }

    const saved = await readStoredSession();
    if (!saved) throw new VisualBlockedError('sessione autenticata non salvabile in modo valido');
    saved.identity = authenticated;
    log(`Autenticazione verificata in memoria: tenant ${saved.identity.tenant}, ruolo autorizzato, stage ${saved.identity.authStage}.`);
    log('Storage state temporaneo salvato in .visual-auth/ (ignorato da Git e mai stampato).');
    return saved;
  } finally {
    await context.close();
    await browser.close();
  }
}

function decodeBase32(value) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const normalized = String(value || '').toUpperCase().replace(/=+$/g, '');
  let bits = '';
  for (const character of normalized) {
    const index = alphabet.indexOf(character);
    if (index < 0) throw new VisualBlockedError('secret MFA isolated non valido');
    bits += index.toString(2).padStart(5, '0');
  }
  const bytes = [];
  for (let offset = 0; offset + 8 <= bits.length; offset += 8) {
    bytes.push(Number.parseInt(bits.slice(offset, offset + 8), 2));
  }
  return Buffer.from(bytes);
}

function currentTotp(secret) {
  const counter = Math.floor(Date.now() / 30_000);
  const buffer = Buffer.alloc(8);
  buffer.writeBigUInt64BE(BigInt(counter));
  const digest = createHmac('sha1', decodeBase32(secret)).update(buffer).digest();
  const offset = digest[digest.length - 1] & 0x0f;
  const binary = (
    ((digest[offset] & 0x7f) << 24)
    | ((digest[offset + 1] & 0xff) << 16)
    | ((digest[offset + 2] & 0xff) << 8)
    | (digest[offset + 3] & 0xff)
  );
  return String(binary % 1_000_000).padStart(6, '0');
}

async function captureIsolatedAuthentication(chromium) {
  let credentials;
  try {
    credentials = JSON.parse(await readFile(acceptanceCredentialPath, 'utf8'));
  } catch {
    throw new VisualBlockedError('credenziali acceptance isolate non disponibili');
  }
  if (!credentials?.email || !credentials?.password || !credentials?.mfaSecret) {
    throw new VisualBlockedError('credenziali acceptance isolate incomplete');
  }

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    baseURL: frontendUrl,
    colorScheme: 'light',
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
  });
  const blocked = [];
  await context.route('**/api/**', async (route) => {
    const request = route.request();
    const decision = apiDecision(request, true);
    if (decision.allowed) return route.continue();
    blocked.push({
      method: request.method().toUpperCase(),
      pathname: new URL(request.url()).pathname,
      reason: decision.reason,
    });
    await route.abort('blockedbyclient');
  });

  try {
    const page = await context.newPage();
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.getByLabel('Email').fill(credentials.email);
    await page.getByLabel('Password', { exact: true }).fill(credentials.password);
    await page.getByRole('button', { name: 'Accedi', exact: true }).click();
    await page.waitForURL(/\/doflow\/mfa$/);
    await page.getByLabel('Codice di verifica a 6 cifre').fill(currentTotp(credentials.mfaSecret));
    await page.getByRole('button', { name: 'Verifica Codice' }).click();
    await page.waitForURL(/\/dashboard$/);

    const payload = await page.evaluate(async () => {
      const response = await fetch('/api/auth/me', { credentials: 'include' });
      return response.ok ? response.json() : null;
    });
    const identity = validateIdentity(payload);
    if (!identity) throw new VisualBlockedError('autenticazione acceptance isolata non valida');
    if (blocked.length > 0) throw new VisualNoGoError('richieste inattese bloccate durante auth isolata');

    await mkdir(authDir, { recursive: true });
    await context.storageState({ path: storageStatePath });
    try { await chmod(storageStatePath, 0o600); } catch { /* Windows ACL inherited. */ }
    log('Autenticazione isolata completata tramite login reale, MFA TOTP e cookie HttpOnly.');
    return { kind: 'cookie', identity };
  } finally {
    await context.close();
    await browser.close();
  }
}

async function verifyRemoteSession(session) {
  let state;
  try {
    state = JSON.parse(await readFile(storageStatePath, 'utf8'));
  } catch {
    throw new VisualBlockedError('sessione autenticata locale non leggibile');
  }
  const cookieHeader = (state.cookies || [])
    .filter((cookie) => String(cookie.domain || '').replace(/^\./, '') === 'localhost')
    .map((cookie) => `${cookie.name}=${cookie.value}`)
    .join('; ');
  if (!cookieHeader) throw new VisualBlockedError('authentication required');

  let response;
  try {
    response = await fetch(`${frontendUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        Cookie: cookieHeader,
        'x-doflow-web': '1',
        'x-doflow-tenant-id': 'doflow',
      },
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new VisualBlockedError('backend remoto non raggiungibile tramite il proxy locale');
  }

  if ([401, 403].includes(response.status)) {
    throw new VisualBlockedError('authentication required');
  }
  if (!response.ok) {
    throw new VisualBlockedError(`proxy/backend remoto non disponibile (HTTP ${response.status})`);
  }

  let body;
  try {
    body = await response.json();
  } catch {
    throw new VisualBlockedError('risposta auth non valida dal backend remoto');
  }
  const identity = validateIdentity(body);
  if (!identity) {
    throw new VisualBlockedError('authentication required');
  }
  log('Sessione server verificata tramite /api/auth/me: tenant doflow, ruolo autorizzato, autenticazione completa.');
}

async function runVisualTests(session, useHeadedBrowser) {
  const env = {
    ...process.env,
    DOFLOW_VISUAL_FRONTEND_URL: frontendUrl,
    DOFLOW_VISUAL_STORAGE_STATE: storageStatePath,
    DOFLOW_VISUAL_SERVER_MODE: '1',
  };
  const args = ['exec', 'playwright', 'test', '--config=playwright.visual.config.ts'];
  if (useHeadedBrowser) args.push('--headed');
  try {
    await pnpm(args, { env, timeoutMs: 30 * 60_000 });
  } catch {
    throw new VisualNoGoError('la suite Playwright ha rilevato una differenza funzionale, responsive o di sicurezza');
  }
}

async function main() {
  if (clearAuth) {
    await rm(authDir, { recursive: true, force: true });
    log('Sessione visuale locale rimossa.');
    return;
  }

  let session = headed || isolated ? null : await readStoredSession();
  if (!headed && !isolated && !session) {
    throw new VisualBlockedError('authentication required');
  }

  const chromium = await ensureChromium();
  await assertPortAvailable();

  const frontendEnv = {
    ...process.env,
    NODE_ENV: 'production',
    INTERNAL_BACKEND_URL: backendUrl,
    NEXT_PUBLIC_API_URL: '',
    DOFLOW_VISUAL_SERVER_MODE: '1',
    DOFLOW_VISUAL_FRONTEND_URL: frontendUrl,
    PORT: String(frontendPort),
    HOSTNAME: 'localhost',
  };
  await prepareVisualRuntime(frontendEnv);
  log(`Avvio frontend standalone su ${frontendUrl} con proxy /api verso ${backendUrl}...`);
  const frontendProcess = spawnProcess(process.execPath, ['apps/frontend/server.js'], {
    cwd: visualRuntimeDir,
    env: frontendEnv,
  });

  try {
    await waitFor(`${frontendUrl}/login`, 'frontend locale', frontendProcess);
    await waitFor(`${frontendUrl}/api/health/system`, 'proxy Next/backend remoto', frontendProcess);

    if (isolated) session = await captureIsolatedAuthentication(chromium);
    else if (headed) session = await captureManualAuthentication(chromium);
    await verifyRemoteSession(session);
    log(`Esecuzione suite Playwright ${headed ? 'headed' : 'headless'} con firewall read-only...`);
    await runVisualTests(session, headed);
    log('Screenshot privacy-safe salvati in docs/design-references/doflow-crm-projects/actual/.');
  } finally {
    await stopProcess(frontendProcess);
    await rm(visualRuntimeDir, { recursive: true, force: true });
  }
}

let exitCode = 0;
try {
  await main();
  if (!clearAuth) process.stdout.write('VISUAL GO — FASE 1 navigation shell\n');
} catch (error) {
  if (error instanceof VisualNoGoError) {
    exitCode = 1;
    process.stderr.write(`[visual:gate] ${error.message}\nVISUAL NO-GO — FASE 1 navigation shell\n`);
  } else {
    exitCode = 2;
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`[visual:gate] ${message}\nVISUAL BLOCKED — FASE 1 navigation shell\n`);
    if (message.includes('authentication required')) {
      process.stderr.write('VISUAL BLOCKED — authentication required\nEsegui pnpm visual:gate:headed e completa login/MFA nella finestra Chromium.\n');
    }
  }
} finally {
  await Promise.all([...children].map((child) => stopProcess(child)));
}

process.exitCode = exitCode;
