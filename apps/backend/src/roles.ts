export type Role = 'admin' | 'manager' | 'editor' | 'viewer' | 'user';

// Mappa di priorità: numeri più alti = più permessi
export const ROLE_RANK: Record<Role, number> = {
  admin: 4,
  manager: 3,
  editor: 2,
  user: 2,   // "user" trattato come "editor" per retrocompatibilità
  viewer: 1,
};

export function hasRoleAtLeast(
  userRole: string | undefined | null,
  required: Role,
): boolean {
  if (!userRole) return false;

  const normalized = (userRole as Role) in ROLE_RANK ? (userRole as Role) : 'viewer';
  return ROLE_RANK[normalized] >= ROLE_RANK[required];
}
