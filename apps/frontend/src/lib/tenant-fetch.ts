// apps/frontend/src/lib/tenant-fetch.ts
const RESERVED = new Set([
  "login",
  "forgot-password",
  "reset-password",
  "superadmin",
  "admin",
  "dashboard",
  "projects",
  "tenant-users",
  "api",
  "_next",
]);

export function getTenantIdFromContext(): string {
  if (typeof window === "undefined") return "public";

  const host = window.location.host.toLowerCase().split(":")[0];
  const path = window.location.pathname || "/";

  // 1) PATH MODE su app.doflow.it: /federicanerone/...
  if (host === "app.doflow.it" || host === "localhost") {
    const first = path.split("?")[0].split("#")[0].split("/").filter(Boolean)[0];
    if (first && !RESERVED.has(first)) return first.toLowerCase();
    return "public";
  }

  // 2) SUBDOMAIN MODE: federicanerone.doflow.it
  const sub = host.split(".")[0];
  if (!sub || ["app", "api", "www", "localhost"].includes(sub)) return "public";
  if (host.endsWith(".doflow.it")) return sub;

  return "public";
}

export function getTenantHeader(): Record<string, string> {
  return { "x-doflow-tenant-id": getTenantIdFromContext() };
}
