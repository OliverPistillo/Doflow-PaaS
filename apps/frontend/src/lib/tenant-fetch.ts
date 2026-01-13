// apps/frontend/src/lib/tenant-fetch.ts

type JwtPayload = { tenantId?: string; role?: string; email?: string };

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function getTenantFromPathname(pathname: string): string | null {
  const seg = pathname.split("?")[0].split("/").filter(Boolean)[0];
  if (!seg) return null;
  if (["login", "superadmin", "admin", "dashboard"].includes(seg)) return null;
  if (!/^[a-z0-9_]+$/i.test(seg)) return null;
  return seg.toLowerCase();
}

export function getTenantId(): string {
  // 1) se siamo nel browser, prima prova dal path: /{tenant}/...
  if (typeof window !== "undefined") {
    const fromPath = getTenantFromPathname(window.location.pathname);
    if (fromPath) return fromPath;

    // 2) altrimenti prova dal token (tenant dell'utente loggato)
    const token = window.localStorage.getItem("doflow_token");
    if (token) {
      const payload = parseJwtPayload(token);
      if (payload?.tenantId && /^[a-z0-9_]+$/i.test(payload.tenantId)) {
        return payload.tenantId.toLowerCase();
      }
    }

    // 3) fallback host-based
    const host = window.location.host.toLowerCase().split(":")[0];
    const sub = host.split(".")[0];
    if (!sub || ["app", "api", "www", "localhost"].includes(sub)) return "public";
    if (host.endsWith(".doflow.it")) return sub;
  }

  return "public";
}

export function getTenantHeader(): Record<string, string> {
  return { "x-doflow-tenant-id": getTenantId() };
}
