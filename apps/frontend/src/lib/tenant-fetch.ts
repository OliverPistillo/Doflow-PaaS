// apps/frontend/src/lib/tenant-fetch.ts

function getTenantFromHost(): string | null {
  if (typeof window === "undefined") return null;

  const host = window.location.host.toLowerCase().split(":")[0];
  const parts = host.split(".");
  const sub = parts[0];

  if (!sub) return null;

  // host riservati -> public
  if (["app", "admin", "api", "www", "localhost"].includes(sub)) return "public";

  // dominio doflow standard -> subdomain = tenant slug
  if (host.endsWith(".doflow.it") && /^[a-z0-9_]+$/i.test(sub)) {
    return sub.toLowerCase();
  }

  // custom domain -> non possiamo conoscere lo slug lato client
  return null;
}

function getTenantFromPathname(pathname: string): string | null {
  const seg = pathname.split("?")[0].split("/").filter(Boolean)[0];
  if (!seg) return null;

  const reserved = [
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
  ];

  if (reserved.includes(seg)) return null;
  if (!/^[a-z0-9_]+$/i.test(seg)) return null;
  return seg.toLowerCase();
}

function isAuthOrPublicPath(pathname: string): boolean {
  const p = pathname.split("?")[0];
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
 * Regola finale:
 * - app/admin -> public SEMPRE
 * - subdomain tenant (*.doflow.it) -> SEMPRE quel tenant (anche su /login)
 * - path mode su app: /{tenant}/... -> tenant
 * - custom domain -> null (backend fa lookup)
 */
export function getTenantIdForRequest(): string | null {
  if (typeof window === "undefined") return "public";

  const hostTenant = getTenantFromHost();
  const pathname = window.location.pathname;

  // app/admin/api/www/localhost -> public fisso
  if (hostTenant === "public") return "public";

  // se sei su tenant subdomain, usa SEMPRE il tenant anche su /login
  // (le auth routes non manderanno header perché api.ts le esclude)
  if (hostTenant) return hostTenant;

  // custom domain: se è una pagina public/auth puoi mandare public, altrimenti lascia null
  if (isAuthOrPublicPath(pathname)) return "public";

  // fallback: path mode /{tenant}/...
  const pathTenant = getTenantFromPathname(pathname);
  if (pathTenant) return pathTenant;

  // custom domain senza slug: lascia decidere al backend tramite host lookup
  return null;
}

export function getTenantHeader(): Record<string, string> {
  const tid = getTenantIdForRequest();
  return tid ? { "x-doflow-tenant-id": tid } : {};
}
