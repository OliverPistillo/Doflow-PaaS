import { spawn } from 'node:child_process';

const backendUrl = process.env.DOFLOW_ACCEPTANCE_BACKEND_URL ?? 'http://localhost:3401';
const parsedBackend = new URL(backendUrl);
if (!['localhost', '127.0.0.1'].includes(parsedBackend.hostname)) {
  throw new Error('Isolated frontend refuses a non-local backend.');
}

const env = {
  ...process.env,
  INTERNAL_BACKEND_URL: backendUrl,
  NEXT_PUBLIC_API_URL: '',
  HOSTNAME: 'localhost',
  PORT: process.env.DOFLOW_ACCEPTANCE_FRONTEND_PORT ?? '3100',
};

const isWindows = process.platform === 'win32';
const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
const args = isWindows
  ? ['/d', '/s', '/c', 'pnpm -C apps/frontend start']
  : ['-C', 'apps/frontend', 'start'];
const child = spawn(command, args, {
  cwd: new URL('..', import.meta.url),
  env,
  stdio: 'inherit',
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}

child.on('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exitCode = code ?? 1;
});
