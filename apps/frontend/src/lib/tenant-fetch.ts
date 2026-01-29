// apps/frontend/src/lib/tenant-fetch.ts

function getTenantFromHost(): string | null {
  if (typeof window === "undefined") return null;

  const host = window.location.host.toLowerCase().split(":")[0];
  const parts = host.split(".");
  const sub = parts[0];

  // host riservati
  if (!sub || ["app", "admin", "api", "www", "localhost"].includes(sub)) return "public";

  // dominio doflow standard
  if (host.endsWith(".doflow.it")) {
    if (/^[a-z0-9_]+$/i.test(sub)) return sub.toLowerCase();
  }

  // custom domain: qui NON possiamo sapere lo slug senza chiamare il backend
  // quindi NON forziamo un tenant; lasciamo null e il backend userà host-mode
  return null;
}

function getTenantFromPathname(pathname: string): string | null {
  const seg = pathname.split("?")[0].split("/").filter(Boolean)[0];
  if (!seg) return null;

  // rotte che NON sono tenant
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
 * Regola enterprise:
 * - su app/admin: tenant header = public SEMPRE
 * - su tenant subdomain: tenant = subdomain
 * - altrimenti (custom domain): NON inviare tenant header, lascia decidere al backend
 */
export function getTenantIdForRequest(): string | null {
  if (typeof window === "undefined") return "public";

  const hostTenant = getTenantFromHost();
  const pathname = window.location.pathname;

  // App/Admin: public fisso (evita "tenant fantasma" dal token)
  if (hostTenant === "public") return "public";

  // se è un percorso auth/public, non mandare tenant (o manda public)
  // qui scegliamo: manda public, così la tenancy middleware non cerca tenant
  if (isAuthOrPublicPath(pathname)) return "public";

  // tenant da host (subdomain) ha priorità: è il caso "federicanerone.doflow.it"
  if (hostTenant) return hostTenant;

  // fallback: se sei su app.doflow.it ma sei in /{tenant}/... (multi-tenant path mode)
  const pathTenant = getTenantFromPathname(pathname);
  if (pathTenant) return pathTenant;

  // custom domain senza slug: meglio non inviare header, backend fa lookup dominio
  return null;
}

export function getTenantHeader(): Record<string, string> {
  const tid = getTenantIdForRequest();
  return tid ? { "x-doflow-tenant-id": tid } : {};
}
