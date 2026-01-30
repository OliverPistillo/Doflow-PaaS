// apps/frontend/src/lib/tenant-fetch.ts

/**
 * Reserved path segments: non sono tenant slug.
 */
const RESERVED_SEGMENTS = new Set([
  "login",
  "logout",
  "superadmin",
  "admin",
  "dashboard",
  "forgot-password",
  "reset-password",
  "terms",
  "privacy",
  "auth",
  "api",
  "_next",
  "favicon.ico",
]);

function isValidSlug(s: string): boolean {
  return /^[a-z0-9_]+$/i.test(s);
}

function normalizeHost(hostRaw: string | null): string {
  const host = (hostRaw || "").toLowerCase();
  return host.split(":")[0];
}

function getTenantFromHostString(hostRaw: string | null): string | null {
  const host = normalizeHost(hostRaw);
  if (!host) return null;

  const parts = host.split(".");
  const sub = parts[0];

  if (!sub) return null;

  // host riservati -> public
  if (["app", "admin", "api", "www", "localhost"].includes(sub)) return "public";

  // dominio doflow standard -> subdomain = tenant slug
  if (host.endsWith(".doflow.it") && isValidSlug(sub)) return sub.toLowerCase();

  return null;
}

function getTenantFromPathnameString(pathname: string): string | null {
  const p = (pathname || "").split("?")[0];
  const seg = p.split("/").filter(Boolean)[0];
  if (!seg) return null;

  if (RESERVED_SEGMENTS.has(seg)) return null;
  if (!isValidSlug(seg)) return null;
  return seg.toLowerCase();
}

function isAuthOrPublicPath(pathname: string): boolean {
  const p = (pathname || "").split("?")[0];
  return (
    p === "/" ||
    p.startsWith("/login") ||
    p.startsWith("/forgot-password") ||
    p.startsWith("/reset-password") ||
    p.startsWith("/terms") ||
    p.startsWith("/privacy") ||
    p.startsWith("/auth/")
  );
}

/**
 * Server-side resolution (SAFE VERSION):
 * Poiché questo file è condiviso con i Client Component, non possiamo usare `next/headers` qui.
 * Se sei in un Server Component e ti serve il tenant, passalo esplicitamente o usa un'altra util.
 */
function getTenantIdForRequestServer(): string | null {
  return null; // Fallback safe per evitare crash di build
}

/**
 * Client-side tenant resolution:
 * - app/admin -> public SEMPRE
 * - subdomain tenant (*.doflow.it) -> SEMPRE quel tenant (anche su /login)
 * - path mode su app: /{tenant}/... -> tenant
 * - custom domain -> null (backend fa lookup)
 */
function getTenantIdForRequestClient(): string | null {
  if (typeof window === 'undefined') return null;

  const hostTenant = getTenantFromHostString(window.location.host);
  const pathname = window.location.pathname;

  // app/admin/api/www/localhost -> public fisso
  if (hostTenant === "public") return "public";

  // subdomain tenant -> usa sempre quello
  if (hostTenant) return hostTenant;

  // custom domain: se è public/auth puoi mandare public, altrimenti lascia null
  if (isAuthOrPublicPath(pathname)) return "public";

  // path mode /{tenant}/...
  const pathTenant = getTenantFromPathnameString(pathname);
  if (pathTenant) return pathTenant;

  return null;
}

/**
 * Public API:
 * - Works in SSR and CSR (safe version).
 */
export function getTenantIdForRequest(): string | null {
  if (typeof window === "undefined") return getTenantIdForRequestServer();
  return getTenantIdForRequestClient();
}

export function getTenantHeader(): Record<string, string> {
  const tid = getTenantIdForRequest();
  return tid ? { "x-doflow-tenant-id": tid } : {};
}

/**
 * Wrapper attorno a fetch che inietta automaticamente:
 * 1. Content-Type: application/json
 * 2. x-doflow-tenant-id (risolto dinamicamente)
 */
export const tenantFetch = async (input: RequestInfo | URL, init?: RequestInit) => {
  const tenantHeaders = getTenantHeader();

  const mergedHeaders = {
    "Content-Type": "application/json",
    ...tenantHeaders,
    ...init?.headers,
  };

  return fetch(input, {
    ...init,
    headers: mergedHeaders,
  });
};