export type Role = 'superadmin' | 'owner' | 'admin' | 'manager' | 'editor' | 'viewer' | 'user';

// Definiamo i livelli di potere
const ROLE_LEVELS: Record<string, number> = {
  superadmin: 100, // Il livello più alto
  owner: 60,       // Alias potente
  admin: 50,
  manager: 40,
  editor: 30,
  viewer: 20,
  user: 10,
};

export function hasRoleAtLeast(
  userRole: string | undefined | null,
  requiredRole: string,
): boolean {
  if (!userRole) return false;

  const current = userRole.toLowerCase().trim();
  const required = requiredRole.toLowerCase().trim();

  if (current === 'superadmin') return true;
  if (required === 'superadmin') return false;

  const currentLevel = ROLE_LEVELS[current] || 0;
  const requiredLevel = ROLE_LEVELS[required] || 0;

  return currentLevel >= requiredLevel;
}