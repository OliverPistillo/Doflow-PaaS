// Read-only diagnostics. Never bootstraps Nest, connects to SMTP/DB, or emits
// environment values, recipients, message bodies, arbitrary errors or tokens.
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const readline = require('node:readline');

const codes = new Set(['EAUTH', 'ECONNECTION', 'ECONNREFUSED', 'ECONNRESET', 'EDNS', 'ENOTFOUND', 'EAI_AGAIN', 'ETIMEDOUT', 'ESOCKET', 'ETLS', 'EENVELOPE', 'EMESSAGE', 'ESTREAM', 'ESMTPRECIPIENTS']);
function summarizeConfig(env) {
  const present = (key) => typeof env[key] === 'string' && env[key].trim().length > 0;
  const port = Number(env.MAIL_PORT);
  const secure = String(env.MAIL_SECURE ?? 'false').trim().toLowerCase();
  let originValid = false;
  try {
    const url = new URL(env.FRONTEND_URL || env.APP_URL || '');
    originValid = url.protocol === 'https:' && !url.username && !url.password && !['localhost', '127.0.0.1', '[::1]', '0.0.0.0'].includes(url.hostname);
  } catch { /* Report only a validity bit. */ }
  const timeout = (key, fallback) => {
    const raw = env[key];
    if (raw == null || String(raw).trim() === '') return { configured: false, effective_ms: fallback };
    const value = Number(raw);
    return { configured: true, numeric: Number.isFinite(value), effective_ms: Number.isFinite(value) ? Math.max(1000, Math.min(60000, Math.trunc(value))) : fallback };
  };
  const teamRaw = Number(env.TEAM_INVITE_EMAIL_TIMEOUT_MS || env.MAIL_SOCKET_TIMEOUT_MS || 15000);
  return {
    MAIL_HOST: { present: present('MAIL_HOST'), syntax_valid: /^[a-z0-9._:[\]-]+$/i.test(env.MAIL_HOST || '') },
    MAIL_PORT: { present: present('MAIL_PORT'), valid: Number.isInteger(port) && port > 0 && port <= 65535 },
    MAIL_SECURE: { present: present('MAIL_SECURE'), valid: ['', 'true', 'false'].includes(secure), implicit_tls: secure === 'true', canonical_spelling: env.MAIL_SECURE == null || ['', 'true', 'false'].includes(env.MAIL_SECURE) },
    MAIL_USER: { present: present('MAIL_USER') },
    MAIL_PASSWORD: { present: present('MAIL_PASSWORD') },
    MAIL_FROM_NAME: { present: present('MAIL_FROM_NAME'), required: false },
    frontend_origin: { present: present('FRONTEND_URL') || present('APP_URL'), production_syntax_valid: originValid },
    DB_SYNC_is_false: env.DB_SYNC === 'false',
    deprecated_SMTP_names_present: Object.keys(env).some((key) => /^SMTP_(HOST|PORT|USER|PASS|FROM)$/.test(key)),
    timeouts: {
      connection: timeout('MAIL_CONNECTION_TIMEOUT_MS', 10000),
      greeting: timeout('MAIL_GREETING_TIMEOUT_MS', 10000),
      socket: timeout('MAIL_SOCKET_TIMEOUT_MS', 15000),
      team: { configured: present('TEAM_INVITE_EMAIL_TIMEOUT_MS'), numeric: Number.isFinite(teamRaw), effective_ms: Number.isFinite(teamRaw) ? Math.max(1000, Math.min(60000, Math.trunc(teamRaw))) : 15000 },
    },
  };
}

function sanitizeLog(raw) {
  const line = raw.replace(/\u001b\[[0-9;]*m/g, '');
  let event;
  if (/Team invite phase=/.test(line)) event = 'team_invite';
  else if (/Invite.*missing_smtp_config/.test(line)) event = 'invite_config_unavailable';
  else if (/Invite email failed/.test(line)) event = 'invite_smtp_failed';
  else if (/Invite email accepted/.test(line)) event = 'invite_smtp_accepted';
  else if (/Email inviata a/.test(line)) event = 'legacy_mail_success_uncorrelated';
  else if (/\/api\/tenant\/(team\/members|users)\b/.test(line)) event = 'team_endpoint_mentioned';
  else return null;
  const result = { event };
  const timestamp = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2}))/)?.[1];
  if (timestamp) result.timestamp = timestamp;
  const phase = line.match(/\bphase=(post_commit|smtp_result|smtp_late|application_timeout|activity)\b/)?.[1];
  if (phase) result.phase = phase;
  const outcome = line.match(/\boutcome=(email_started|accepted|not_confirmed|unknown|failed)\b/)?.[1];
  if (outcome) result.outcome = outcome;
  const tenant = line.match(/\btenant=([a-z0-9_-]{1,63})(?:\s|$)/i)?.[1];
  if (tenant) result.tenant = tenant === 'doflow' ? 'doflow' : '[other_tenant]';
  const operation = line.match(/\boperation_id=([a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12})\b/i)?.[1];
  if (operation) result.operation_id = operation;
  const code = line.match(/\bcode=([A-Z0-9_]+)\b/)?.[1];
  if (codes.has(code)) result.code = code;
  const response = line.match(/\bresponseCode=([1-5]\d{2})\b/)?.[1];
  if (response) result.response_code = Number(response);
  const duration = line.match(/\bduration_ms=(\d{1,9})\b/)?.[1];
  if (duration) result.duration_ms = Number(duration);
  return result;
}

async function main() {
  if (process.argv[2] === 'logs') {
    let matched = 0;
    for await (const line of readline.createInterface({ input: process.stdin, crlfDelay: Infinity })) {
      const safe = sanitizeLog(line);
      if (safe) { console.log(JSON.stringify(safe)); matched++; }
    }
    console.log(JSON.stringify({ matched_events: matched }));
    return;
  }
  if (process.argv[2] !== 'config') throw new Error();
  const pid = process.argv[3];
  const backendDir = process.argv[4];
  if (!/^[1-9]\d*$/.test(pid || '') || !path.isAbsolute(backendDir || '')) throw new Error();
  const startupEnv = Object.fromEntries(fs.readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0').filter(Boolean).map((item) => {
    const index = item.indexOf('=');
    return [item.slice(0, index), item.slice(index + 1)];
  }));
  const envFile = path.join(backendDir, '.env');
  const exists = fs.existsSync(envFile);
  const fileEnv = exists ? createRequire(path.join(backendDir, 'package.json'))('dotenv').parse(fs.readFileSync(envFile)) : {};
  console.log(JSON.stringify({
    source: 'startup environment plus current backend .env; not a runtime-memory inspection',
    env_file_present: exists,
    env_file_modified_utc: exists ? fs.statSync(envFile).mtime.toISOString() : null,
    config: summarizeConfig({ ...fileEnv, ...startupEnv }),
  }, null, 2));
}

module.exports = { summarizeConfig, sanitizeLog };
if (require.main === module) main().catch(() => { console.error('READ_ONLY_DIAGNOSTIC_UNAVAILABLE: verify mode, PID, backend directory and read permissions.'); process.exitCode = 1; });
