const DEFAULT_APP_URL = "https://app.doflow.it";
const DEFAULT_TENANT_BASE_DOMAIN = "doflow.it";
const INTERNAL_DOFLOW_TENANT = "doflow";

function cleanUrl(value: string | undefined | null): string | null {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, "");
}

function cleanDomain(value: string | undefined | null): string {
  return String(value ?? DEFAULT_TENANT_BASE_DOMAIN)
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "")
    .replace(/^app\./, "");
}

export function normalizeTenantSlug(value: string | undefined | null): string {
  return String(value ?? "").trim().toLowerCase();
}

export function isInternalDoflowTenant(tenantSlug: string | undefined | null): boolean {
  return normalizeTenantSlug(tenantSlug) === INTERNAL_DOFLOW_TENANT;
}

export function getPrimaryAppUrl(): string {
  return (
    cleanUrl(process.env.NEXT_PUBLIC_APP_URL) ||
    cleanUrl(process.env.FRONTEND_URL) ||
    cleanUrl(process.env.APP_URL) ||
    cleanUrl(process.env.APP_BASE_URL) ||
    DEFAULT_APP_URL
  );
}

export function getTenantAppUrl(tenantSlug: string | undefined | null): string {
  const slug = normalizeTenantSlug(tenantSlug);
  if (!slug || slug === "public" || isInternalDoflowTenant(slug)) {
    return getPrimaryAppUrl();
  }

  const baseDomain = cleanDomain(
    process.env.NEXT_PUBLIC_BASE_DOMAIN || process.env.TENANT_BASE_DOMAIN,
  );
  return `https://${slug}.${baseDomain}`;
}

export function getTenantLoginUrl(
  tenantSlug: string,
  accessToken: string,
  next?: string,
): string {
  const url = new URL("/login", getTenantAppUrl(tenantSlug));
  url.searchParams.set("accessToken", accessToken);
  if (next) url.searchParams.set("next", next);
  return url.toString();
}
