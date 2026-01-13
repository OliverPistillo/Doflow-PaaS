// apps/frontend/src/lib/tenant-fetch.ts
export function getTenantIdFromHost(host?: string): string {
  const h =
    (host ??
      (typeof window !== 'undefined' ? window.location.host : '') ??
      '').toLowerCase();

  // federicanerone.doflow.it -> federicanerone
  const base = h.split(':')[0]; // togli porta
  const sub = base.split('.')[0];

  // domini riservati
  if (!sub || ['app', 'api', 'www', 'localhost'].includes(sub)) return 'public';

  // se è doflow.it: usa il subdomain come tenant
  if (base.endsWith('.doflow.it')) return sub;

  // fallback: public
  return 'public';
}

export function getTenantHeader(): Record<string, string> {
  const tenant = getTenantIdFromHost();
  return { 'x-doflow-tenant-id': tenant };
}
