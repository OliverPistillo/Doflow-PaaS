export const ASSIGNABLE_TENANT_ROLES = [
  'admin',
  'manager',
  'editor',
  'user',
  'viewer',
] as const;

export const PROTECTED_TENANT_ROLES = [
  'owner',
  'superadmin',
  'super_admin',
  'ceo',
] as const;

export type AssignableTenantRole = (typeof ASSIGNABLE_TENANT_ROLES)[number];

export function normalizedTenantRole(value: unknown): string {
  return String(value ?? '').trim().toLowerCase();
}

export function isAssignableTenantRole(value: unknown): value is AssignableTenantRole {
  return (ASSIGNABLE_TENANT_ROLES as readonly string[]).includes(normalizedTenantRole(value));
}

export function isProtectedTenantRole(value: unknown): boolean {
  return (PROTECTED_TENANT_ROLES as readonly string[]).includes(normalizedTenantRole(value));
}
