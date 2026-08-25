import { randomBytes } from 'node:crypto';
import { spawn } from 'node:child_process';

const databaseUrl = process.env.DOFLOW_ACCEPTANCE_DATABASE_URL
  ?? 'postgresql://doflow_acceptance:doflow_acceptance_local@localhost:55432/doflow_acceptance';
const database = new URL(databaseUrl);
if (!['localhost', '127.0.0.1'].includes(database.hostname)) {
  throw new Error('Isolated backend refuses a non-local PostgreSQL host.');
}

const redisHost = process.env.DOFLOW_ACCEPTANCE_REDIS_HOST ?? 'localhost';
if (!['localhost', '127.0.0.1'].includes(redisHost)) {
  throw new Error('Isolated backend refuses a non-local Redis host.');
}

const storageEndpoint = process.env.DOFLOW_ACCEPTANCE_STORAGE_ENDPOINT
  ?? 'http://localhost:59000';
const storage = new URL(storageEndpoint);
if (!['localhost', '127.0.0.1'].includes(storage.hostname)) {
  throw new Error('Isolated backend refuses a non-local object-storage host.');
}

const env = {
  ...process.env,
  PORT: process.env.DOFLOW_ACCEPTANCE_BACKEND_PORT ?? '3401',
  DATABASE_URL: databaseUrl,
  REDIS_HOST: redisHost,
  REDIS_PORT: process.env.DOFLOW_ACCEPTANCE_REDIS_PORT ?? '56379',
  REDIS_DB: '0',
  DB_SYNC: 'false',
  NODE_ENV: 'test',
  JWT_SECRET: process.env.DOFLOW_ACCEPTANCE_JWT_SECRET ?? randomBytes(48).toString('base64url'),
  CORS_ORIGINS: 'http://localhost:3100,http://handoff-mismatch.localhost:3100',
  CORS_PUBLIC_ORIGINS: '',
  APP_BASE_URL: 'http://localhost:3100',
  FRONTEND_URL: 'http://localhost:3100',
  PUBLIC_API_URL: 'http://localhost:3401',
  SITE_PROPOSALS_AI_ENABLED: 'false',
  GEMINI_API_KEY: '',
  GOOGLE_OAUTH_CLIENT_ID: 'isolated-disabled',
  GOOGLE_OAUTH_CLIENT_SECRET: 'isolated-disabled',
  MAIL_HOST: '',
  MAIL_PORT: '1025',
  MAIL_USER: '',
  MAIL_PASSWORD: '',
  S3_ENDPOINT: storageEndpoint,
  S3_ACCESS_KEY_ID: process.env.DOFLOW_ACCEPTANCE_STORAGE_ACCESS_KEY ?? 'isolated-local',
  S3_SECRET_ACCESS_KEY: process.env.DOFLOW_ACCEPTANCE_STORAGE_SECRET_KEY ?? 'isolated-local',
  S3_BUCKET: 'doflow-acceptance',
  // QuoteRequestService provisions its bucket on boot; share that isolated
  // bucket so the generic storage health probe is deterministic as well.
  S3_BUCKET_QUOTES: 'doflow-acceptance',
  MINIO_ENDPOINT: storageEndpoint,
  MINIO_ACCESS_KEY: process.env.DOFLOW_ACCEPTANCE_STORAGE_ACCESS_KEY ?? 'isolated-local',
  MINIO_SECRET_KEY: process.env.DOFLOW_ACCEPTANCE_STORAGE_SECRET_KEY ?? 'isolated-local',
  MINIO_BACKUP_BUCKET: 'doflow-acceptance-backups',
};

const isWindows = process.platform === 'win32';
const command = isWindows ? (process.env.ComSpec ?? 'cmd.exe') : 'pnpm';
const args = isWindows
  ? ['/d', '/s', '/c', 'pnpm -C apps/backend start']
  : ['-C', 'apps/backend', 'start'];
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
