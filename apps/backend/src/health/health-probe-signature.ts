import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';

const MAX_PROBE_AGE_MS = 45_000;
const MAX_CLOCK_SKEW_MS = 5_000;

export function createHealthProbeSignature(
  secret: string,
  timestamp = Date.now(),
  nonce = randomBytes(16).toString('hex'),
): string {
  if (!secret) throw new Error('JWT_SECRET is not configured');
  const payload = `${timestamp}.${nonce}`;
  const signature = createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}.${signature}`;
}

export function verifyHealthProbeSignature(
  value: string,
  secret: string,
  now = Date.now(),
): boolean {
  if (!secret) return false;
  const [timestampRaw, nonce, signature, ...extra] = value.split('.');
  if (extra.length || !/^\d{13}$/.test(timestampRaw ?? '')) return false;
  if (!/^[a-f0-9]{32}$/.test(nonce ?? '') || !/^[a-f0-9]{64}$/.test(signature ?? '')) return false;

  const timestamp = Number(timestampRaw);
  const age = now - timestamp;
  if (!Number.isSafeInteger(timestamp) || age < -MAX_CLOCK_SKEW_MS || age > MAX_PROBE_AGE_MS) return false;

  const payload = `${timestampRaw}.${nonce}`;
  const expected = Buffer.from(createHmac('sha256', secret).update(payload).digest('hex'), 'hex');
  const received = Buffer.from(signature, 'hex');
  return expected.length === received.length && timingSafeEqual(expected, received);
}
