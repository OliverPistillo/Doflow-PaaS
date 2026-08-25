import { randomBytes } from 'node:crypto';
import { chmod, mkdir, rm, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const authDir = path.join(root, '.visual-auth');
const credentialPath = path.join(authDir, 'acceptance-credentials.json');
const databaseUrl = process.env.DOFLOW_ACCEPTANCE_DATABASE_URL
  ?? 'postgresql://doflow_acceptance:doflow_acceptance_local@localhost:55432/doflow_acceptance';
const database = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(database.hostname)) {
  throw new Error('Acceptance credential seed refuses a non-local PostgreSQL host.');
}

function base32(buffer) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = '';
  for (const byte of buffer) bits += byte.toString(2).padStart(8, '0');
  let output = '';
  for (let index = 0; index < bits.length; index += 5) {
    output += alphabet[Number.parseInt(bits.slice(index, index + 5).padEnd(5, '0'), 2)];
  }
  return output;
}

const credentials = {
  email: 'visual.owner@acceptance.invalid',
  // Keep synthetic browser credentials keyboard-layout independent: some
  // headed Windows drivers translate base64url punctuation through the
  // active layout. Entropy remains local and ephemeral.
  password: `Aa1${randomBytes(24).toString('hex')}`,
  mfaSecret: base32(randomBytes(20)),
};

await mkdir(authDir, { recursive: true });
await writeFile(credentialPath, JSON.stringify(credentials), { mode: 0o600 });
try { await chmod(credentialPath, 0o600); } catch { /* Windows uses inherited ACLs. */ }

const isWindows = process.platform === 'win32';
const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
const args = isWindows
  ? ['/d', '/s', '/c', 'pnpm -C apps/backend exec tsx src/scripts/seed-acceptance-environment.ts']
  : ['-C', 'apps/backend', 'exec', 'tsx', 'src/scripts/seed-acceptance-environment.ts'];

const child = spawn(command, args, {
  cwd: root,
  stdio: 'inherit',
  env: {
    ...process.env,
    NODE_ENV: 'test',
    DB_SYNC: 'false',
    DATABASE_URL: databaseUrl,
    REDIS_HOST: process.env.DOFLOW_ACCEPTANCE_REDIS_HOST ?? 'localhost',
    REDIS_PORT: process.env.DOFLOW_ACCEPTANCE_REDIS_PORT ?? '56379',
    DOFLOW_ACCEPTANCE_PASSWORD: credentials.password,
    DOFLOW_ACCEPTANCE_MFA_SECRET: credentials.mfaSecret,
  },
});

const exitCode = await new Promise((resolve, reject) => {
  child.once('error', reject);
  child.once('exit', (code) => resolve(code ?? 1));
});
if (exitCode !== 0) {
  await rm(credentialPath, { force: true });
  process.exitCode = exitCode;
} else {
  process.stdout.write('[seed:acceptance] Temporary credentials stored in ignored auth runtime.\n');
}
