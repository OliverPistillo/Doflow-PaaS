// apps/frontend/src/lib/roles.ts
export type LayoutRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

export function mapBackendRoleToLayout(role?: string): LayoutRole {
  const r = (role ?? '').toLowerCase();

  if (r === 'superadmin' || r === 'super_admin') return 'SUPER_ADMIN';
  if (r === 'owner' || r === 'admin') return 'ADMIN';
  if (r === 'manager') return 'MANAGER';

  return 'USER';
}

export function getTenantRoleLabel(role?: string, context: 'internal' | 'client' = 'internal'): string {
  const r = (role ?? '').toLowerCase().trim();

  if (r === 'superadmin' || r === 'super_admin') return 'Super Admin';
  if (r === 'owner') return 'CEO';
  if (r === 'admin') return 'Admin';
  if (r === 'manager') return 'Project Manager';
  if (r === 'editor' || r === 'user') return 'Dipendente';
  if (r === 'viewer') return context === 'client' ? 'Cliente' : 'Viewer';

  return role || 'Utente';
}
