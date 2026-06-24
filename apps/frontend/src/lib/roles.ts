// apps/frontend/src/lib/roles.ts
export type LayoutRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

export function mapBackendRoleToLayout(role?: string): LayoutRole {
  const r = (role ?? '').toLowerCase();

  if (r === 'superadmin' || r === 'super_admin') return 'SUPER_ADMIN';
  if (r === 'owner' || r === 'admin') return 'ADMIN';
  if (r === 'manager') return 'MANAGER';

  return 'USER';
}
