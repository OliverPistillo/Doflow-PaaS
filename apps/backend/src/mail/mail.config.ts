import type SMTPTransport from 'nodemailer/lib/smtp-transport';

type ConfigReader = { get: (key: string) => unknown };

export const DOFLOW_MAIL_CONFIG = Symbol('DOFLOW_MAIL_CONFIG');

export function mailTimeout(config: ConfigReader, key: string, fallback: number) {
  const raw = config.get(key);
  if (raw == null || String(raw).trim() === '') return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) return fallback;
  return Math.max(1000, Math.min(60000, Math.trunc(value)));
}

// Resolve once for both the transport and the service. An optional, incomplete
// SMTP configuration must never prevent application startup.
export function resolveMailConfig(config: ConfigReader) {
  const host = String(config.get('MAIL_HOST') ?? '').trim();
  const port = Number(config.get('MAIL_PORT'));
  const secureValue = String(config.get('MAIL_SECURE') ?? 'false').trim().toLowerCase();
  const user = String(config.get('MAIL_USER') ?? '').trim();
  const pass = String(config.get('MAIL_PASSWORD') ?? '');
  const name = String(config.get('MAIL_FROM_NAME') ?? '').trim();
  const validPort = Number.isInteger(port) && port >= 1 && port <= 65535;
  const validSecure = ['', 'true', 'false'].includes(secureValue);
  const ready = Boolean(host && user && pass.trim() && validPort && validSecure);
  const options: SMTPTransport.Options = {
    host,
    port: validPort ? port : undefined,
    secure: secureValue === 'true',
    connectionTimeout: mailTimeout(config, 'MAIL_CONNECTION_TIMEOUT_MS', 10000),
    greetingTimeout: mailTimeout(config, 'MAIL_GREETING_TIMEOUT_MS', 10000),
    socketTimeout: mailTimeout(config, 'MAIL_SOCKET_TIMEOUT_MS', 15000),
    auth: { user, pass },
  };
  return { options, ready, from: name ? { name, address: user } : user };
}

export type MailConfig = ReturnType<typeof resolveMailConfig>;
