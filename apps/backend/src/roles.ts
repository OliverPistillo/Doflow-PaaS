export type Role = 'superadmin' | 'owner' | 'admin' | 'manager' | 'editor' | 'viewer' | 'user';

// Definiamo i livelli di potere
const ROLE_LEVELS: Record<string, number> = {
  superadmin: 100, // Il livello più alto
  owner: 90,       // Alias potente
  admin: 50,
  manager: 40,
  editor: 30,
  viewer: 20,
  user: 10,
};

export function hasRoleAtLeast(userRole: string | undefined | null, requiredRole: string): boolean {
  if (!userRole) return false;

  // 1. Normalizziamo tutto in minuscolo per evitare problemi (SUPERADMIN -> superadmin)
  const current = userRole.toLowerCase().trim();
  const required = requiredRole.toLowerCase().trim();

  // 2. Se l'utente è superadmin, ha accesso a TUTTO a prescindere
  if (current === 'superadmin' || current === 'owner') {
    return true;
  }

  // 3. Recuperiamo i livelli numerici
  const currentLevel = ROLE_LEVELS[current] || 0; // Se ruolo sconosciuto, livello 0
  const requiredLevel = ROLE_LEVELS[required] || 0;

  // 4. Confrontiamo i livelli
  return currentLevel >= requiredLevel;
}