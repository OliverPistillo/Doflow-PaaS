import { spawn } from 'node:child_process';
import { access, chmod, mkdir, readFile, rm } from 'node:fs/promises';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';
const packageRunner = isWindows ? (process.env.ComSpec || 'cmd.exe') : 'corepack';
const frontendPort = 3100;
const frontendUrl = `http://localhost:${frontendPort}`;
const backendUrl = 'https://api.doflow.it';
const authDir = path.join(root, '.visual-auth');
const storageStatePath = path.join(authDir, 'storage-state.json');
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
    cwd: root,
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

function spawnPnpm(args, options = {}) {
  const runnerArgs = isWindows
    ? ['/d', '/s', '/c', 'corepack', 'pnpm@10.24.0', ...args]
    : ['pnpm@10.24.0', ...args];
  return spawnProcess(packageRunner, runnerArgs, options);
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

function parseJwt(token) {
  try {
    const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
    return payload && typeof payload === 'object' ? payload : null;
  } catch {
    return null;
  }
}

function validateToken(token) {
  const payload = parseJwt(token);
  if (!payload) return null;

  const tenant = String(payload.tenantSlug || payload.tenantId || payload.tenant_id || '').toLowerCase();
  const role = String(payload.role || '').toLowerCase();
  const authStage = String(payload.authStage || '').toUpperCase();
  const pending = payload.mfa_pending === true || ['MFA_PENDING', 'MFA_SETUP_NEEDED'].includes(authStage);
  const complete = !pending && (authStage === 'FULL' || authStage === '');
  const expiresAt = typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  const fresh = expiresAt === null || expiresAt > Date.now() + 60_000;

  if (tenant !== 'doflow' || !authorizedRoles.has(role) || !complete || !fresh) return null;
  return { tenant, role, authStage: authStage || 'FULL', expiresAt };
}

async function readStoredSession() {
  try {
    const state = JSON.parse(await readFile(storageStatePath, 'utf8'));
    const originState = state.origins?.find((entry) => entry.origin === frontendUrl);
    const token = originState?.localStorage?.find((entry) => entry.name === 'doflow_token')?.value;
    const identity = typeof token === 'string' ? validateToken(token) : null;
    return identity ? { token, identity } : null;
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
          const token = await candidate.evaluate(() => window.localStorage.getItem('doflow_token'));
          const identity = typeof token === 'string' ? validateToken(token) : null;
          if (identity) {
            authenticated = identity;
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
    log(`Autenticazione verificata in memoria: tenant ${saved.identity.tenant}, ruolo autorizzato, stage ${saved.identity.authStage}.`);
    log('Storage state temporaneo salvato in .visual-auth/ (ignorato da Git e mai stampato).');
    return saved;
  } finally {
    await context.close();
    await browser.close();
  }
}

async function verifyRemoteSession(session) {
  let response;
  try {
    response = await fetch(`${frontendUrl}/api/auth/me`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${session.token}`,
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
  const tenant = String(body?.user?.tenantId || body?.user?.tenantSlug || '').toLowerCase();
  const role = String(body?.user?.role || '').toLowerCase();
  const stage = String(body?.user?.authStage || session.identity.authStage || '').toUpperCase();
  if (tenant !== 'doflow' || !authorizedRoles.has(role) || !['FULL', ''].includes(stage)) {
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

  let session = headed ? null : await readStoredSession();
  if (!headed && !session) {
    throw new VisualBlockedError('authentication required');
  }

  const chromium = await ensureChromium();
  await assertPortAvailable();

  const frontendEnv = {
    ...process.env,
    NODE_ENV: 'development',
    INTERNAL_BACKEND_URL: backendUrl,
    NEXT_PUBLIC_API_URL: '',
    DOFLOW_VISUAL_SERVER_MODE: '1',
    DOFLOW_VISUAL_FRONTEND_URL: frontendUrl,
  };
  log(`Avvio frontend locale su ${frontendUrl} con proxy /api verso ${backendUrl}...`);
  const frontendProcess = spawnPnpm(
    ['-C', 'apps/frontend', 'exec', 'next', 'dev', '-H', 'localhost', '-p', String(frontendPort)],
    { env: frontendEnv },
  );

  try {
    await waitFor(`${frontendUrl}/login`, 'frontend locale', frontendProcess);
    await waitFor(`${frontendUrl}/api/health/system`, 'proxy Next/backend remoto', frontendProcess);

    if (headed) session = await captureManualAuthentication(chromium);
    await verifyRemoteSession(session);
    log(`Esecuzione suite Playwright ${headed ? 'headed' : 'headless'} con firewall read-only...`);
    await runVisualTests(session, headed);
    log('Screenshot privacy-safe salvati in docs/design-references/doflow-crm-projects/actual/.');
  } finally {
    await stopProcess(frontendProcess);
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
