'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';

// URL Backend fisso
const API_BASE = 'https://api.doflow.it';

// Tipi di ruolo supportati
type Role = 'superadmin' | 'owner' | 'admin' | 'manager' | 'editor' | 'viewer' | 'user';

type User = {
  id: number;
  email: string;
  role: string; // Usiamo string per essere flessibili
  created_at: string;
};

type UsersResponse = {
  currentUser: {
    sub: number;
    email: string;
    tenantId: string;
    role: string; // Il backend potrebbe mandarlo maiuscolo o minuscolo
  };
  users: User[];
};

type InviteResponse = {
  status?: string;
  error?: string;
};

const ALL_ROLES: string[] = ['admin', 'manager', 'editor', 'viewer', 'user'];

export default function AdminUsersPage() {
  const [tenantHost, setTenantHost] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('viewer');

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
        } catch { /* ignore */ }
        throw new Error(msg);
      }

      const data = JSON.parse(text) as UsersResponse;

      setUsers(data.users ?? []);
      setCurrentUserRole(data.currentUser.role);
      setCurrentUserEmail(data.currentUser.email);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Errore sconosciuto';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (userId: number, newRole: string) => {
    if (!ensureToken()) return;
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`${API_BASE}/api/tenant/admin/users/${userId}/role`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) throw new Error(`Errore cambio ruolo: ${res.status}`);

      setInfo('Ruolo aggiornato.');
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!ensureToken()) return;
    if (!confirm('Sei sicuro di voler eliminare questo utente?')) return;

    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`${API_BASE}/api/tenant/admin/users/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Errore eliminazione: ${text}`);
      }

      setInfo('Utente eliminato.');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureToken()) return;
    if (!inviteEmail.trim()) {
      setError('Inserisci una email.');
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/tenant/admin/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      if (!res.ok) throw new Error(`Errore invito: ${res.status}`);

      setInfo(`Invito inviato a ${inviteEmail}.`);
      setInviteEmail('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore invito');
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

  // --- LOGICA PERMESSI ROBUSTA (Case Insensitive) ---
  const normalizedRole = (currentUserRole || '').toLowerCase();
  
  const canManageUsers =
    normalizedRole === 'superadmin' ||
    normalizedRole === 'owner' ||
    normalizedRole === 'admin' ||
    normalizedRole === 'manager';

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-6">
      <div className="w-full max-w-5xl flex flex-col gap-4">
        {/* HEADER */}
        <header className="flex flex-col gap-2 border-b border-zinc-800 pb-3 mb-2">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>Tenant: <span className="font-mono">{tenantHost}</span></span>
            {currentUserEmail && (
              <span>
                Utente: <span className="font-mono">{currentUserEmail}</span> ({currentUserRole})
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Pannello Admin</h1>
            <button onClick={handleLogout} className="text-xs px-3 py-1 border rounded border-zinc-700 hover:bg-zinc-800">Logout</button>
          </div>
          <nav className="flex gap-3 text-sm mt-1">
            <Link href="/admin/users" className="underline">Utenti</Link>
            <Link href="/admin/audit" className="text-gray-400 hover:underline">Audit log</Link>
          </nav>
        </header>

        {/* Form Invito */}
        {canManageUsers && (
          <section className="border rounded-lg p-4 flex flex-col gap-3">
            <h2 className="text-lg font-semibold">Invita nuovo utente</h2>
            <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-2">
              <input
                className="border rounded px-3 py-2 flex-1 text-black"
                placeholder="email dell'utente"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
              <select
                className="border rounded px-3 py-2 text-black"
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
              >
                {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button type="submit" disabled={loading} className="px-4 py-2 rounded bg-white text-black font-semibold disabled:opacity-50">
                {loading ? '...' : 'Invita'}
              </button>
            </form>
          </section>
        )}

        {/* Messaggi */}
        {info && <div className="text-sm text-green-400 border border-green-500/40 rounded px-3 py-2">{info}</div>}
        {error && <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">{error}</div>}

        {/* Tabella */}
        <section className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Utenti</h2>
            <button onClick={() => void loadUsers()} disabled={loading} className="text-xs px-3 py-1 border rounded">Ricarica</button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-2">Email</th>
                  <th className="text-left py-2 pr-2">Ruolo</th>
                  <th className="text-left py-2 pr-2">Creato il</th>
                  <th className="text-left py-2 pr-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-2 font-mono text-xs">{u.email}</td>
                    <td className="py-2 pr-2">
                      <select
                        className="border rounded px-2 py-1 text-xs text-black"
                        value={u.role}
                        onChange={(e) => handleChangeRole(u.id, e.target.value)}
                        disabled={!canManageUsers || loading}
                      >
                        {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>
                    <td className="py-2 pr-2 text-xs text-gray-400">{new Date(u.created_at).toLocaleString()}</td>
                    <td className="py-2 pr-2">
                      {canManageUsers && (
                        <button
                          onClick={() => handleDeleteUser(u.id)}
                          className="text-xs text-red-400 hover:text-red-300 underline"
                        >
                          Elimina
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}