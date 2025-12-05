'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

type Role = 'admin' | 'manager' | 'editor' | 'viewer' | 'user';

type AuditEntry = {
  id: number;
  action: string;
  actor_email: string | null;
  actor_role: string | null;
  target_email: string | null;
  metadata: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
};

type AuditResponse = {
  entries: AuditEntry[];
};

export default function AuditPage() {
  const [tenantHost, setTenantHost] = useState('');
  const [token, setToken] = useState<string | null>(null);

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<Role | null>(null);

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTenantHost(window.location.host);
      const storedToken = window.localStorage.getItem('doflow_token');
      setToken(storedToken);
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadAudit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadAudit = async () => {
    if (!token) {
      setError('Token mancante, esegui il login.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/tenant/admin/audit`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
        cache: 'no-store',
      });

      const text = await res.text();
      if (!res.ok) {
        setError(`Errore caricamento audit: ${text}`);
        return;
      }

      const data = JSON.parse(text) as AuditResponse;
      setEntries(data.entries);

      // hack veloce: prendo info utente corrente dalla prima entry se c'è
      // (in futuro meglio un endpoint dedicato)
      if (!currentUserEmail && entries.length > 0) {
        // nulla, teniamo semplice; la topbar mostra solo tenant
      }
    } catch (e) {
      if (e instanceof Error) {
        setError(e.message);
      } else {
        setError('Errore sconosciuto durante il caricamento audit');
      }
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

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-6">
      <div className="w-full max-w-5xl flex flex-col gap-4">
        {/* HEADER */}
        <header className="flex flex-col gap-2 border-b border-zinc-800 pb-3 mb-2">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>
              Tenant: <span className="font-mono">{tenantHost}</span>
            </span>
            {currentUserEmail && (
              <span>
                Utente:{' '}
                <span className="font-mono">{currentUserEmail}</span>{' '}
                ({currentUserRole})
              </span>
            )}
          </div>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Audit log</h1>
            <button
              onClick={handleLogout}
              className="text-xs px-3 py-1 border rounded border-zinc-700 hover:bg-zinc-800"
            >
              Logout
            </button>
          </div>
          <nav className="flex gap-3 text-sm mt-1">
            <Link href="/admin/users" className="text-gray-400 hover:underline">
              Utenti
            </Link>
            <Link href="/admin/audit" className="underline">
              Audit log
            </Link>
          </nav>
        </header>

        {!token && (
          <p className="text-xs text-red-400">
            Nessun token trovato: effettua il login dalla pagina /login.
          </p>
        )}

        <div className="flex items-center justify-between mb-2">
          <h2 className="text-lg font-semibold">
            Ultime azioni (max 100 per tenant)
          </h2>
          <button
            onClick={() => void loadAudit()}
            disabled={loading}
            className="text-xs px-3 py-1 border rounded disabled:opacity-50"
          >
            {loading ? 'Aggiornamento...' : 'Ricarica'}
          </button>
        </div>

        {error && (
          <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">
            {error}
          </div>
        )}

        {entries.length === 0 ? (
          <p className="text-sm text-gray-400">
            Nessuna voce di audit trovata per questo tenant.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 pr-2">ID</th>
                  <th className="text-left py-2 pr-2">Azione</th>
                  <th className="text-left py-2 pr-2">Attore</th>
                  <th className="text-left py-2 pr-2">Target</th>
                  <th className="text-left py-2 pr-2">IP</th>
                  <th className="text-left py-2 pr-2">Metadata</th>
                  <th className="text-left py-2 pr-2">Data</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => (
                  <tr key={e.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-2">{e.id}</td>
                    <td className="py-2 pr-2 font-mono">{e.action}</td>
                    <td className="py-2 pr-2">
                      {e.actor_email ?? '-'}{' '}
                      {e.actor_role ? `(${e.actor_role})` : ''}
                    </td>
                    <td className="py-2 pr-2">
                      {e.target_email ?? '-'}
                    </td>
                    <td className="py-2 pr-2 text-gray-500">
                      {e.ip ?? '-'}
                    </td>
                    <td className="py-2 pr-2 max-w-xs">
                      <pre className="whitespace-pre-wrap break-words text-[10px] text-gray-400">
                        {e.metadata
                          ? JSON.stringify(e.metadata)
                          : '{}'}
                      </pre>
                    </td>
                    <td className="py-2 pr-2 text-gray-400">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
