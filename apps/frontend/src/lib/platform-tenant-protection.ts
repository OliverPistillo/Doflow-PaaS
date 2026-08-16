export type PlatformTenantIdentity = {
  slug?: string | null;
  schemaName?: string | null;
  schema_name?: string | null;
};

function normalize(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isProtectedPlatformTenant(tenant: PlatformTenantIdentity): boolean {
  const slug = normalize(tenant.slug);
  const schema = normalize(tenant.schemaName ?? tenant.schema_name);

  return slug === 'doflow' || schema === 'doflow' || schema === 'public';
}
