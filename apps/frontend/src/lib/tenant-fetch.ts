// src/lib/tenant-fetch.ts
export function getTenantHeader(): Record<string, string> {
  if (typeof window === 'undefined') return {};
  return { 'x-doflow-tenant-id': window.location.host };
}
