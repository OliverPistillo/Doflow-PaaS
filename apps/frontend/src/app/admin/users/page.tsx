'use client';

import { useEffect, useState, FormEvent } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard/layout';

// Configurazione Ambiente
const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.doflow.it';
const CONTROL_PLANE_URL = process.env.NEXT_PUBLIC_CONTROL_PLANE_URL || 'https://app.doflow.it';
const PAGE_SIZE = 10;

type UserStatus = 'active' | 'invited' | 'disabled';

type User = {
  id: number;
  email: string;
  role: string;
  created_at: string;
  status?: UserStatus;
};

type UsersResponse = {
  currentUser: {
    sub: string | number;
    email: string;
    tenantId: string;
    role: string;
  };
  users: User[];
};

type Tenant = {
  id: string;
  slug: string;
  name: string;
  schema_name: string;
  is_active: boolean;
};
type TenantsResponse = { tenants: Tenant[] };

const ALL_ROLES: string[] = ['admin', 'manager', 'editor', 'viewer', 'user'];

type LayoutRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

function mapRoleToLayoutRole(role: string | null): LayoutRole {
  const r = (role || '').toLowerCase();
  if (r === 'owner' || r === 'superadmin' || r === 'super_admin') return 'SUPER_ADMIN';
  if (r === 'admin') return 'ADMIN';
  if (r === 'manager') return 'MANAGER';
  return 'USER';
}

function RoleBadge({ role }: { role: string }) {
  const r = role.toLowerCase();
  const styles: Record<string, string> = {
    owner: 'bg-purple-600/20 text-purple-300',
    superadmin: 'bg-purple-600/20 text-purple-300',
    admin: 'bg-blue-600/20 text-blue-300',
    manager: 'bg-green-600/20 text-green-300',
    editor: 'bg-yellow-600/20 text-yellow-300',
    viewer: 'bg-zinc-600/20 text-zinc-300',
    user: 'bg-zinc-600/20 text-zinc-300',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${styles[r] || 'bg-zinc-700/30 text-zinc-300'}`}>
      {role}
    </span>
  );
}

function StatusBadge({ status }: { status: UserStatus }) {
  const styles: Record<UserStatus, string> = {
    active: 'bg-green-600/20 text-green-300',
    invited: 'bg-blue-600/20 text-blue-300',
    disabled: 'bg-red-600/20 text-red-300',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase ${styles[status] || 'bg-zinc-700/30 text-zinc-300'}`}>
      {status}
    </span>
  );
}

export default function AdminUsersPage() {
  const [tenantHost, setTenantHost] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const [mode, setMode] = useState<'loading' | 'public' | 'tenant'>('loading');
  const [tenantSlug, setTenantSlug] = useState<string>('');
  const [tenants, setTenants] = useState<Tenant[]>([]); 

  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);

  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [actionUserId, setActionUserId] = useState<number | null>(null);
  const [userToDelete, setUserToDelete] = useState<User | null>(null);

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<string>('viewer');

  // 1. INIZIALIZZAZIONE
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const host = window.location.host.toLowerCase();
    setTenantHost(host);

    const storedToken = window.localStorage.getItem('doflow_token');
    setToken(storedToken);

    const isLocal = host === 'localhost' || host.startsWith('localhost:');
    const sub = host.split('.')[0]; 
    const isPublic = isLocal || sub === 'app' || sub === 'api';

    setTenantSlug(isPublic ? '' : sub);
    setMode(isPublic ? 'public' : 'tenant');
  }, []);

  // 2. ROUTER
  useEffect(() => {
    if (!token) return;
    if (mode === 'public') void loadTenants();
    if (mode === 'tenant') void loadUsers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, mode]);

  const ensureToken = () => {
    if (!token) {
      setError('Token mancante, esegui di nuovo il login.');
      return false;
    }
    return true;
  };

  const handleLogout = () => {
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem('doflow_token');
      window.location.href = '/login';
    }
  };

  // Helper Headers: Gestisce Json e Slug in modo pulito
  const getTenantHeaders = (withJson = false) => {
    const headers: HeadersInit = {
      Authorization: `Bearer ${token}`,
      'x-doflow-tenant-id': tenantSlug,
    };
    if (withJson) {
      headers['Content-Type'] = 'application/json';
    }
    return headers;
  };

  // --- CONTROL PLANE ---
  const loadTenants = async () => {
    if (!ensureToken()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/superadmin/tenants`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'x-doflow-tenant-id': 'public', // FIX 1: Explicit Public
        },
        cache: 'no-store',
      });

      if (res.status === 401) { handleLogout(); return; }
      if (res.status === 403) throw new Error('Accesso negato. Solo Super Admin.');

      const text = await res.text();
      if (!res.ok) throw new Error(text || `Errore tenants: ${res.status}`);

      const data = JSON.parse(text) as TenantsResponse;
      setTenants(data.tenants ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore caricamento tenant');
    } finally {
      setLoading(false);
    }
  };

  // --- TENANT SPACE ---
  const loadUsers = async () => {
    if (!ensureToken()) return;
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`${API_BASE}/api/tenant/admin/users`, {
        headers: getTenantHeaders(false), // GET -> No Json Type
        cache: 'no-store',
      });

      if (res.status === 401) { handleLogout(); return; }

      const text = await res.text();
      if (!res.ok) {
        let msg = `Errore caricamento: ${res.status}`;
        try { msg = JSON.parse(text).error || msg; } catch {}
        throw new Error(msg);
      }

      const data = JSON.parse(text) as UsersResponse;
      setUsers(data.users ?? []);
      setCurrentUserRole(data.currentUser.role);
      setCurrentUserEmail(data.currentUser.email);
      setPage(1);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  const handleChangeRole = async (userId: number, newRole: string) => {
    if (!ensureToken()) return;
    setError(null);
    setInfo(null);
    setActionUserId(userId);

    try {
      const res = await fetch(`${API_BASE}/api/tenant/admin/users/${userId}/role`, {
        method: 'POST',
        headers: getTenantHeaders(true), // POST -> Json Type
        body: JSON.stringify({ role: newRole }),
      });

      if (!res.ok) throw new Error(`Errore cambio ruolo: ${res.status}`);

      setInfo('Ruolo aggiornato.');
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setActionUserId(null);
    }
  };

  const handleDeleteUser = async (userId: number) => {
    if (!ensureToken()) return;
    setError(null);
    setInfo(null);
    setActionUserId(userId);

    try {
      const res = await fetch(`${API_BASE}/api/tenant/admin/users/${userId}`, {
        method: 'DELETE',
        headers: getTenantHeaders(false), // DELETE -> No Json Body
      });

      if (!res.ok) throw new Error(`Errore eliminazione: ${res.status}`);

      setInfo('Utente eliminato.');
      setUsers((prev) => prev.filter((u) => u.id !== userId));
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setActionUserId(null);
    }
  };

  const handleResendInvite = async (email: string) => {
    if (!ensureToken()) return;
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`${API_BASE}/api/tenant/admin/invite/resend`, {
        method: 'POST',
        headers: getTenantHeaders(true),
        body: JSON.stringify({ email }),
      });

      if (!res.ok) throw new Error('Errore rinvio invito');
      setInfo(`Invito rinviato a ${email}.`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore rinvio invito');
    } finally {
      setLoading(false);
    }
  };

  const handleInvite = async (e: FormEvent) => {
    e.preventDefault();
    if (!ensureToken()) return;
    if (!inviteEmail.trim()) { setError('Inserisci una email.'); return; }

    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`${API_BASE}/api/tenant/admin/invite`, {
        method: 'POST',
        headers: getTenantHeaders(true),
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });

      if (!res.ok) throw new Error(`Errore invito: ${res.status}`);

      setInfo(`Invito inviato a ${inviteEmail}.`);
      setInviteEmail('');
      setInviteRole('viewer');
      void loadUsers();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore invito');
    } finally {
      setLoading(false);
    }
  };

  const normalizedRole = (currentUserRole || '').toLowerCase();
  const canManageUsers =
    normalizedRole === 'superadmin' ||
    normalizedRole === 'owner' ||
    normalizedRole === 'admin' ||
    normalizedRole === 'manager';

  const layoutRole: LayoutRole = mapRoleToLayoutRole(currentUserRole);

  const filteredUsers = users.filter((u) => {
    const q = search.toLowerCase();
    return u.email.toLowerCase().includes(q) || u.role.toLowerCase().includes(q) || (u.status ?? 'active').includes(q);
  });

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [totalPages, page]);

  const paginatedUsers = filteredUsers.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // --- UI STATES ---

  if (mode === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-zinc-100">
        <p className="text-sm text-zinc-400">Inizializzazione...</p>
      </main>
    );
  }

  // FIX 5: Loading Loop protection
  if (mode === 'tenant' && !currentUserRole && !error) {
    return (
      <DashboardLayout role="USER" userEmail="Caricamento...">
        <div className="flex items-center justify-center h-[50vh]">
          <p className="text-sm text-zinc-400 animate-pulse">Caricamento dati tenant...</p>
        </div>
      </DashboardLayout>
    );
  }

  // PUBLIC MODE UI
  if (mode === 'public') {
    return (
      <DashboardLayout role="SUPER_ADMIN" userEmail={currentUserEmail || 'superadmin'}>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Control Plane</h1>
              <p className="text-xs text-zinc-500">Seleziona un&apos;azienda per accedere.</p>
            </div>
            <button onClick={handleLogout} className="text-xs px-3 py-1 border rounded border-zinc-700 hover:bg-zinc-800">
              Logout
            </button>
          </div>

          {error && <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">{error}</div>}

          <section className="border border-zinc-800 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-lg font-semibold">Aziende</h2>
              <button onClick={() => void loadTenants()} disabled={loading} className="text-xs px-3 py-1 border rounded">
                Ricarica
              </button>
            </div>

            <div className="space-y-2">
              {tenants.map((t) => (
                <div key={t.id} className="flex items-center justify-between border border-zinc-800 rounded p-3 bg-zinc-900/40 hover:bg-zinc-900 transition-colors">
                  <div>
                    <div className="font-semibold">{t.name}</div>
                    <div className="text-xs text-zinc-500 font-mono">
                      {t.slug}.doflow.it {!t.is_active && <span className="ml-2 text-red-500">[DISATTIVO]</span>}
                    </div>
                  </div>
                  <button
                    disabled={!t.is_active}
                    onClick={() => (window.location.href = `https://${t.slug}.doflow.it/admin/users`)}
                    className="text-xs px-3 py-1 border rounded bg-white text-black font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-200"
                  >
                    Entra
                  </button>
                </div>
              ))}
              {tenants.length === 0 && !loading && <div className="text-xs text-zinc-500 py-4 text-center">Nessun tenant trovato.</div>}
            </div>
          </section>
        </div>
      </DashboardLayout>
    );
  }

  // TENANT MODE UI
  return (
    <DashboardLayout role={layoutRole} userEmail={currentUserEmail || 'utente'}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Utenti</h1>
            <div className="text-xs text-zinc-500 mt-1">
              Tenant: <span className="font-mono">{tenantHost}</span>
              {currentUserEmail && <> · Utente: <span className="font-mono">{currentUserEmail}</span> ({currentUserRole})</>}
            </div>
          </div>
          <div className="flex gap-2">
            {/* FIX 3: Control Plane Button via Env */}
            <button
              onClick={() => window.location.href = `${CONTROL_PLANE_URL}/admin/users`}
              className="text-xs px-3 py-1 border rounded border-zinc-700 hover:bg-zinc-800"
            >
              Control Plane
            </button>
            <button onClick={handleLogout} className="text-xs px-3 py-1 border rounded border-zinc-700 hover:bg-zinc-800">
              Logout
            </button>
          </div>
        </div>

        <nav className="flex gap-3 text-sm">
          <Link href="/admin/users" className="underline">Utenti</Link>
          <Link href="/admin/audit" className="text-gray-400 hover:underline">Audit log</Link>
        </nav>

        {canManageUsers && (
          <section className="border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
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

        {info && <div className="text-sm text-green-400 border border-green-500/40 rounded px-3 py-2">{info}</div>}
        {error && <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">{error}</div>}

        <section className="border border-zinc-800 rounded-lg p-4">
          {/* ... Resto della Tabella come prima ... */}
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Utenti</h2>
            <button onClick={() => void loadUsers()} disabled={loading} className="text-xs px-3 py-1 border rounded">Ricarica</button>
          </div>

          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-3">
            <input
              type="text"
              placeholder="Cerca per email, ruolo o stato…"
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="border rounded px-3 py-2 text-sm text-black w-full md:max-w-xs"
            />
            <div className="text-xs text-zinc-500">{filteredUsers.length} utenti trovati</div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left py-2 pr-2">Email</th>
                  <th className="text-left py-2 pr-2">Ruolo</th>
                  <th className="text-left py-2 pr-2">Stato</th>
                  <th className="text-left py-2 pr-2">Creato il</th>
                  <th className="text-left py-2 pr-2">Azioni</th>
                </tr>
              </thead>
              <tbody>
                {paginatedUsers.map((u) => {
                  const isActionLoading = actionUserId === u.id;
                  const status: UserStatus = u.status ?? 'active';
                  return (
                    <tr key={u.id} className="border-b border-zinc-800 last:border-b-0">
                      <td className="py-2 pr-2 font-mono text-xs">{u.email}</td>
                      <td className="py-2 pr-2">
                        <div className="flex items-center gap-2">
                          <RoleBadge role={u.role} />
                          <select
                            className="border rounded px-2 py-0.5 text-xs text-black max-w-[100px] opacity-70 hover:opacity-100 transition-opacity"
                            value={u.role}
                            onChange={(e) => handleChangeRole(u.id, e.target.value)}
                            disabled={!canManageUsers || loading || isActionLoading}
                          >
                            {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="py-2 pr-2"><StatusBadge status={status} /></td>
                      <td className="py-2 pr-2 text-xs text-gray-400">{new Date(u.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-2">
                        {canManageUsers && (
                          <>
                            {status === 'invited' && (
                              <button
                                onClick={() => handleResendInvite(u.email)}
                                disabled={loading}
                                className="text-xs text-blue-400 hover:text-blue-300 underline mr-3 disabled:opacity-50"
                              >
                                Rinvia invito
                              </button>
                            )}
                            <button
                              onClick={() => setUserToDelete(u)}
                              disabled={isActionLoading}
                              className="text-xs text-red-400 hover:text-red-300 underline disabled:opacity-50 disabled:no-underline"
                            >
                              {isActionLoading ? 'Attendere...' : 'Elimina'}
                            </button>
                          </>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filteredUsers.length === 0 && !loading && (
                  <tr><td colSpan={5} className="py-4 text-center text-xs text-zinc-500">Nessun utente trovato.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4 text-xs">
            <span className="text-zinc-500">Pagina {page} di {totalPages}</span>
            <div className="flex gap-2">
              <button disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-2 py-1 border rounded disabled:opacity-40">← Precedente</button>
              <button disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-2 py-1 border rounded disabled:opacity-40">Successiva →</button>
            </div>
          </div>
        </section>
      </div>

      {userToDelete && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 animate-in fade-in duration-200">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6 w-full max-w-sm shadow-xl">
            <h3 className="text-lg font-semibold mb-2">Disabilita utente</h3>
            <p className="text-sm text-zinc-400 mb-6">
              Sei sicuro di voler disabilitare e rimuovere l&apos;accesso a:
              <br />
              <span className="font-mono text-white block mt-1 bg-zinc-800/50 p-1 rounded">{userToDelete.email}</span>
            </p>
            <div className="flex justify-end gap-3">
              <button
                className="px-3 py-1.5 text-sm border border-zinc-700 rounded hover:bg-zinc-800 transition-colors"
                onClick={() => setUserToDelete(null)}
              >
                Annulla
              </button>
              <button
                className="px-3 py-1.5 text-sm bg-red-600 hover:bg-red-700 text-white rounded transition-colors font-medium"
                onClick={async () => {
                  await handleDeleteUser(userToDelete.id);
                  setUserToDelete(null);
                }}
              >
                Disabilita
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}