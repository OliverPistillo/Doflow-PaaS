'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/dashboard/layout';
import { getTenantHeader } from '@/lib/tenant-fetch';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.doflow.it';

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

type LayoutRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

function mapRoleToLayoutRole(role: string | null): LayoutRole {
  const r = (role || '').toLowerCase();
  if (r === 'owner' || r === 'superadmin' || r === 'super_admin') return 'SUPER_ADMIN';
  if (r === 'admin') return 'ADMIN';
  if (r === 'manager') return 'MANAGER';
  return 'USER';
}

function ActionBadge({ action }: { action: string }) {
  const a = action.toUpperCase();

  const styles: Record<string, string> = {
    USER_INVITED: 'bg-blue-600/20 text-blue-300',
    USER_ROLE_CHANGED: 'bg-yellow-600/20 text-yellow-300',
    USER_DISABLED: 'bg-red-600/20 text-red-300',
    LOGIN_SUCCESS: 'bg-green-600/20 text-green-300',
    LOGIN_FAILED: 'bg-red-600/20 text-red-300',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${styles[a] || 'bg-zinc-700/30 text-zinc-300'}`}>
      {action}
    </span>
  );
}

export default function AdminAuditPage() {
  const [token, setToken] = useState<string | null>(null);

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
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
    if (!token) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/api/tenant/admin/audit`, {
        headers: {
          Authorization: `Bearer ${token}`,
          ...getTenantHeader(),
        },
        cache: 'no-store',
      });

      const text = await res.text();
      if (!res.ok) throw new Error(text || `Errore audit`);

      const data = JSON.parse(text) as AuditResponse;
      setEntries(data.entries ?? []);

      // opzionale: se vuoi valorizzare user email/role, prendi dal JWT decodificato o da un endpoint /me
      // per ora lascio invariato: UI ok, non blocca nulla.
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore caricamento audit');
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

  const layoutRole: LayoutRole = mapRoleToLayoutRole(currentUserRole);

  return (
    <DashboardLayout role={layoutRole} userEmail={currentUserEmail || 'admin'}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Audit log</h1>
            <p className="text-xs text-zinc-500 mt-1">Storico delle azioni effettuate nel tenant</p>
          </div>

          <button onClick={handleLogout} className="text-xs px-3 py-1 border rounded border-zinc-700 hover:bg-zinc-800">
            Logout
          </button>
        </div>

        <nav className="flex gap-3 text-sm">
          <Link href="/admin/users" className="text-gray-400 hover:underline">
            Utenti
          </Link>
          <Link href="/admin/audit" className="underline">
            Audit log
          </Link>
        </nav>

        {loading && <div className="text-sm text-zinc-400">Caricamento eventi...</div>}

        {error && <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">{error}</div>}

        {!loading && !error && (
          <section className="border border-zinc-800 rounded-lg p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-2 pr-2">Data</th>
                    <th className="text-left py-2 pr-2">Azione</th>
                    <th className="text-left py-2 pr-2">Attore</th>
                    <th className="text-left py-2 pr-2">Target</th>
                    <th className="text-left py-2 pr-2">IP</th>
                    <th className="text-left py-2 pr-2">Metadata</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-b border-zinc-800 last:border-b-0">
                      <td className="py-2 pr-2 text-gray-400">{new Date(e.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-2">
                        <ActionBadge action={e.action} />
                      </td>
                      <td className="py-2 pr-2 font-mono">
                        {e.actor_email ?? '-'}
                        {e.actor_role && <span className="text-[10px] text-zinc-400 ml-1">({e.actor_role})</span>}
                      </td>
                      <td className="py-2 pr-2 font-mono">{e.target_email ?? '-'}</td>
                      <td className="py-2 pr-2 text-gray-500">{e.ip ?? '-'}</td>
                      <td className="py-2 pr-2 max-w-xs">
                        <pre className="whitespace-pre-wrap break-words text-[10px] text-gray-400">
                          {e.metadata ? JSON.stringify(e.metadata, null, 2) : '{}'}
                        </pre>
                      </td>
                    </tr>
                  ))}

                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-xs text-zinc-500">
                        Nessun evento audit disponibile.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
