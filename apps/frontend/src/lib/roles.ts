// apps/frontend/src/lib/roles.ts
export type LayoutRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

export function mapBackendRoleToLayout(role?: string): LayoutRole {
  const r = (role ?? '').toLowerCase();

  if (r === 'superadmin' || r === 'owner') return 'SUPER_ADMIN';
  if (r === 'admin') return 'ADMIN';
  if (r === 'manager') return 'MANAGER';
  return 'USER';
}
