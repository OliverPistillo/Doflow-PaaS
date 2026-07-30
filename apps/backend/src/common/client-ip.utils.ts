import { isIP } from 'node:net';
import type { Request } from 'express';

export const ANONYMOUS_CLIENT_IP = 'anonymous-client-ip';

export type TrustProxySetting = boolean | number | string | string[];

const TRUST_PROXY_ALIASES = new Set(['loopback', 'linklocal', 'uniquelocal']);

function isValidCidr(value: string): boolean {
  const [address, prefix, extra] = value.split('/');
  if (!address || !prefix || extra !== undefined || !/^\d+$/.test(prefix)) return false;
  const family = isIP(address);
  if (!family) return false;
  const bits = Number(prefix);
  return Number.isInteger(bits) && bits >= 0 && bits <= (family === 4 ? 32 : 128);
}

function isValidTrustProxyToken(value: string): boolean {
  if (TRUST_PROXY_ALIASES.has(value)) return true;
  if (isIP(value)) return true;
  return isValidCidr(value);
}

export function parseTrustProxy(value?: string | null): TrustProxySetting {
  const raw = String(value || '').trim();
  if (!raw) return false;

  const lower = raw.toLowerCase();
  if (['false', '0', 'off'].includes(lower)) return false;
  if (['true', '1', 'on'].includes(lower)) return true;
  if (/^\d+$/.test(raw)) return Number(raw);

  const values = raw.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean);
  if (values.length === 0) return false;

  const invalid = values.find((item) => !isValidTrustProxyToken(item));
  if (invalid) {
    throw new Error(`TRUST_PROXY non valido: "${invalid}". Usa false, true, un numero di hop, alias Express o CIDR/IP validi.`);
  }

  return values.length === 1 ? values[0] : values;
}

export function normalizeIpAddress(value: unknown): string | null {
  if (Array.isArray(value) || typeof value !== 'string') return null;

  let candidate = value.trim();
  if (!candidate || candidate.includes(',') || /\s/.test(candidate)) return null;
  if (/^\[[^\]]+\]:\d+$/.test(candidate)) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) return null;
  if (/^\[[^\]]+\]$/.test(candidate)) {
    candidate = candidate.slice(1, -1);
  }

  const mapped = candidate.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/i);
  if (mapped && isIP(mapped[1]) === 4) return mapped[1];

  return isIP(candidate) ? candidate : null;
}

function headerValue(req: Request, name: string): string | string[] | undefined {
  const headers = req.headers as Record<string, string | string[] | undefined>;
  return headers[name.toLowerCase()];
}

function immediatePeerTrusted(req: Request, remoteAddress: string): boolean {
  const trustProxy = req.app?.get?.('trust proxy fn');
  if (typeof trustProxy !== 'function') return false;

  try {
    return trustProxy(remoteAddress, 0) === true;
  } catch {
    return false;
  }
}

export function getClientIpForRateLimit(req: Request): string {
  const socketIp = normalizeIpAddress(req.socket?.remoteAddress);
  const trustedPeer = socketIp ? immediatePeerTrusted(req, socketIp) : false;

  if (trustedPeer) {
    const cloudflareIp = normalizeIpAddress(headerValue(req, 'cf-connecting-ip'));
    if (cloudflareIp) return cloudflareIp;
  }

  const requestIp = normalizeIpAddress(req.ip);
  if (requestIp) return requestIp;
  if (socketIp) return socketIp;
  return ANONYMOUS_CLIENT_IP;
}
