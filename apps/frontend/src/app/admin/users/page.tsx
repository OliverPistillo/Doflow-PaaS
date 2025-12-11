'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';

type Role = 'admin' | 'manager' | 'editor' | 'viewer' | 'user';

type User = {
  id: number;
  email: string;
  role: Role;
  created_at: string;
};

type UsersResponse = {
  currentUser: {
    sub: number;
    email: string;
    tenantId: string;
    role: Role;
  };
  users: User[];
};

type InviteResponse = {
  status?: string;
  error?: string;
};

const ALL_ROLES: Role[] = ['admin', 'manager', 'editor', 'viewer', 'user'];

// --- MODIFICA 1: URL Hardcoded del Backend ---
const API_BASE = 'https://api.doflow.it';

export default function AdminUsersPage() {
  const [tenantHost, setTenantHost] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<Role>('viewer');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTenantHost(window.location.host);
      const storedToken = window.localStorage.getItem('doflow_token');
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const ensureToken = () => {
    if (!token) {
      setError('Token mancante, esegui di nuovo il login.');
      return false;
    }
    return true;
  };

  const loadUsers = async () => {
    if (!ensureToken()) return;

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      // --- MODIFICA 2: Aggiunto /api nel percorso ---
      const res = await fetch(`${API_BASE}/api/tenant/admin/users`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const text = await res.text();

      if (!res.ok) {
        let msg = `Errore caricamento utenti: HTTP ${res.status}`;
        try {
          const json = JSON.parse(text) as Partial<{ error: string }>;
          if (json.error) msg = json.error;
        } catch {
          // ignore parse error
        }
        throw new Error(msg);
      }

      const data = JSON.parse(text) as UsersResponse;

      setUsers(data.users ?? []);
      setCurrentUserRole(data.currentUser.role);
      setCurrentUserEmail(data.currentUser.email);
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Errore sconosciuto durante il caricamento utenti';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (userId: number, newRole: Role) => {
    if (!ensureToken()) return;

    setError(null);
    setInfo(null);

    try {
      // --- MODIFICA 3: Aggiunto /api nel percorso ---
      const res = await fetch(`${API_BASE}/api/tenant/admin/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      const text = await res.text();
      let json: { status?: string; error?: string } = {};

      try {
        json = JSON.parse(text) as { status?: string; error?: string };
      } catch {
        // ignore
      }

      if (!res.ok || json.error) {
        const msg = json.error ?? `Errore aggiornamento ruolo: HTTP ${res.status}`;
        throw new Error(msg);
      }

      setInfo('Ruolo aggiornato con successo.');
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Errore sconosciuto durante il cambio ruolo';
      setError(msg);
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();

    if (!ensureToken()) return;
    if (!inviteEmail.trim()) {
      setError('Inserisci una email da invitare.');
      return;
    }

    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      // --- MODIFICA 4: Aggiunto /api nel percorso ---
      const res = await fetch(`${API_BASE}/api/tenant/admin/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      const text = await res.text();
      let json: InviteResponse = {};

      try {
        json = JSON.parse(text) as InviteResponse;
      } catch {
        // ignore
      }

      if (!res.ok || json.error) {
        const msg = json.error ?? `Errore invio invito: HTTP ${res.status}`;
        throw new Error(msg);
      }

      setInfo(`Invito inviato a ${inviteEmail} con ruolo ${inviteRole}.`);
      setInviteEmail('');
    } catch (e: unknown) {
      const msg =
        e instanceof Error ? e.message : 'Errore sconosciuto durante la creazione invito';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('doflow_token');
      window.location.href = '/login';
    }
  };

  const canManageUsers =
    currentUserRole === 'admin' || currentUserRole === 'manager';

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-6">
      <div className="w-full max-w-5xl flex flex-col gap-4">
        {/* HEADER */}
        <header className="flex flex-col gap-2 border-b border-zinc-800 pb-3 mb-2">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>
              Tenant: <span className="font-mono">{tenantHost}</span>
            </span>
            <span>
              {currentUserEmail && (
                <>
                  Utente:{' '}
                  <span className="font-mono">{currentUserEmail}</span>{' '}
                  ({currentUserRole})
                </>
              )}
            </span>
          </div>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Pannello Admin</h1>
            <button
              onClick={handleLogout}
              className="text-xs px-3 py-1 border rounded border-zinc-700 hover:bg-zinc-800"
            >
              Logout
            </button>
          </div>
          <nav className="flex gap-3 text-sm mt-1">
            <Link href="/admin/users" className="underline">
              Utenti
            </Link>
            <Link href="/admin/audit" className="text-gray-400 hover:underline">
              Audit log
            </Link>
          </nav>
        </header>

        <p className="text-sm text-gray-400">
          Ruoli supportati: admin, manager, editor, viewer, user.
        </p>
        {!token && (
          <p className="text-xs text-red-400">
            Nessun token trovato: effettua il login dalla pagina /login.
          </p>
        )}

        {/* Sezione invito utente */}
        {canManageUsers && (
          <section className="border rounded-lg p-4 flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Invita nuovo utente</h2>
            <form
              onSubmit={handleInvite}
              className="flex flex-col md:flex-row gap-2"
            >
              <input
                className="border rounded px-3 py-2 flex-1"
                placeholder="email dell'utente"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <select
                className="border rounded px-3 py-2"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as Role)}
              >
                {ALL_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
              >
                {loading ? 'Invio...' : 'Invita'}
              </button>
            </form>
            <p className="text-xs text-gray-400">
              L&apos;utente riceve un token di invito e completa la
              registrazione tramite /auth/accept-invite.
            </p>
          </section>
        )}

        {/* Messaggi */}
        {info && (
          <div className="text-sm text-green-400 border border-green-500/40 rounded px-3 py-2">
            {info}
          </div>
        )}
        {error && (
          <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">
            {error}
          </div>
        )}

        {/* Tabella utenti */}
        <section className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Utenti del tenant</h2>
            <button
              onClick={() => void loadUsers()}
              disabled={loading}
              className="text-xs px-3 py-1 border rounded disabled:opacity-50"
            >
              {loading ? 'Aggiornamento...' : 'Ricarica'}
            </button>
          </div>

          {users.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nessun utente trovato per questo tenant.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 pr-2">ID</th>
                    <th className="text-left py-2 pr-2">Email</th>
                    <th className="text-left py-2 pr-2">Ruolo</th>
                    <th className="text-left py-2 pr-2">Creato il</th>
                    <th className="text-left py-2 pr-2">Azione</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b last:border-b-0">
                      <td className="py-2 pr-2">{u.id}</td>
                      <td className="py-2 pr-2 font-mono text-xs">
                        {u.email}
                      </td>
                      <td className="py-2 pr-2">
                        <select
                          className="border rounded px-2 py-1 text-xs"
                          value={u.role}
                          onChange={(e) =>
                            handleChangeRole(u.id, e.target.value as Role)
                          }
                          disabled={!canManageUsers || loading}
                        >
                          {ALL_ROLES.map((r) => (
                            <option key={r} value={r}>
                              {r}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-2 pr-2 text-xs text-gray-400">
                        {new Date(u.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-2 text-xs text-gray-400">
                        {u.role === 'admin'
                          ? 'Admin'
                          : canManageUsers
                          ? 'Modificabile'
                          : 'Sola lettura'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}