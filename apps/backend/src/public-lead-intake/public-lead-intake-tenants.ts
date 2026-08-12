const DEFAULT_PUBLIC_LEAD_INTAKE_TENANTS = ['doflow'];

export function publicLeadIntakeTenants(value = process.env.PUBLIC_LEAD_INTAKE_TENANTS): Set<string> {
  const configured = String(value || '')
    .split(',')
    .map((item) => item.trim().toLowerCase())
    .filter(Boolean);

  return new Set(configured.length > 0 ? configured : DEFAULT_PUBLIC_LEAD_INTAKE_TENANTS);
}

export function isPublicLeadIntakeTenantEnabled(tenant: string): boolean {
  return publicLeadIntakeTenants().has(String(tenant || '').trim().toLowerCase());
}
