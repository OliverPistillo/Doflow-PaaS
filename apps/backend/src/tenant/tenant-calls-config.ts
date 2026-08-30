export type TenantCallsConfig = {
  masterEnabled: boolean;
  guestEnabled: boolean;
  livekitUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  publicMeetingUrl: string;
  tokenTtlSeconds: number;
  ringingTimeoutSeconds: number;
  connectTimeoutSeconds: number;
  guestInviteTtlSeconds: number;
  callMaximumSeconds: number;
};

function flag(value: unknown, fallback = false) {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized) return fallback;
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function boundedInteger(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) return fallback;
  return Math.max(minimum, Math.min(maximum, parsed));
}

export function tenantCallsConfig(environment: NodeJS.ProcessEnv = process.env): TenantCallsConfig {
  return {
    masterEnabled: flag(environment.LIVEKIT_ENABLED) && flag(environment.DESKTOP_CALLS_ENABLED),
    guestEnabled: flag(environment.DESKTOP_CALLS_GUEST_ENABLED),
    livekitUrl: String(environment.LIVEKIT_URL || '').trim(),
    livekitApiKey: String(environment.LIVEKIT_API_KEY || '').trim(),
    livekitApiSecret: String(environment.LIVEKIT_API_SECRET || '').trim(),
    publicMeetingUrl: String(environment.DESKTOP_CALLS_PUBLIC_MEETING_URL || 'https://app.doflow.it/meeting')
      .trim()
      .replace(/\/$/, ''),
    tokenTtlSeconds: boundedInteger(environment.LIVEKIT_TOKEN_TTL_SECONDS, 300, 60, 900),
    ringingTimeoutSeconds: boundedInteger(environment.DESKTOP_CALL_RING_TIMEOUT_SECONDS, 45, 15, 120),
    connectTimeoutSeconds: boundedInteger(environment.DESKTOP_CALL_CONNECT_TIMEOUT_SECONDS, 90, 30, 300),
    guestInviteTtlSeconds: boundedInteger(environment.DESKTOP_CALL_GUEST_TTL_SECONDS, 3600, 300, 86_400),
    callMaximumSeconds: boundedInteger(environment.DESKTOP_CALL_MAXIMUM_SECONDS, 14_400, 300, 43_200),
  };
}

export function livekitConfigured(config: TenantCallsConfig) {
  if (!config.livekitUrl || !config.livekitApiKey || !config.livekitApiSecret) return false;
  try {
    const url = new URL(config.livekitUrl);
    const loopback = ['localhost', '127.0.0.1', '::1'].includes(url.hostname.toLowerCase());
    return (url.protocol === 'wss:' || (loopback && url.protocol === 'ws:'))
      && !url.username
      && !url.password
      && !url.search
      && !url.hash;
  } catch {
    return false;
  }
}
