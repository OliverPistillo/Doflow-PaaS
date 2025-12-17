'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
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

function ActionBadge({ action }: { action: string }) {
  const a = action.toUpperCase();

  const styles: Record<string, string> = {
    USER_INVITED: 'bg-blue-500/15 text-blue-700 dark:text-blue-300',
    USER_ROLE_CHANGED: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300',
    USER_DISABLED: 'bg-red-500/15 text-red-700 dark:text-red-300',
    LOGIN_SUCCESS: 'bg-green-500/15 text-green-700 dark:text-green-300',
    LOGIN_FAILED: 'bg-red-500/15 text-red-700 dark:text-red-300',
  };

  return (
    <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${styles[a] || 'bg-muted text-muted-foreground'}`}>
      {action}
    </span>
  );
}

export default function AdminAuditPage() {
  const [token, setToken] = useState<string | null>(null);

  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storedToken = window.localStorage.getItem('doflow_token');
    setToken(storedToken);
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
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore caricamento audit');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Audit log</h1>
          <p className="text-sm text-muted-foreground">
            Storico delle azioni effettuate nel tenant.
          </p>
        </div>

        <Button variant="outline" size="sm" onClick={() => void loadAudit()} disabled={loading}>
          {loading ? 'Carico…' : 'Ricarica'}
        </Button>
      </div>

      <nav className="flex gap-3 text-sm">
        <Link href="/admin/users" className="text-muted-foreground hover:text-foreground">
          Utenti
        </Link>
        <Link href="/admin/audit" className="text-foreground font-medium">
          Audit log
        </Link>
      </nav>

      {error ? (
        <Card className="p-3">
          <div className="text-sm font-medium">Errore</div>
          <div className="text-sm text-muted-foreground mt-1 break-words">{error}</div>
        </Card>
      ) : null}

      <Card className="overflow-hidden">
        <div className="px-4 py-3 border-b border-border flex items-center justify-between">
          <div className="text-sm font-semibold">Eventi</div>
          <div className="text-xs text-muted-foreground">{entries.length}</div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs border-collapse">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="text-left py-2 px-4">Data</th>
                <th className="text-left py-2 px-4">Azione</th>
                <th className="text-left py-2 px-4">Attore</th>
                <th className="text-left py-2 px-4">Target</th>
                <th className="text-left py-2 px-4">IP</th>
                <th className="text-left py-2 px-4">Metadata</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-6 px-4 text-muted-foreground">
                    Caricamento eventi…
                  </td>
                </tr>
              ) : entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 px-4 text-center text-muted-foreground">
                    Nessun evento audit disponibile.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="border-b border-border last:border-b-0">
                    <td className="py-3 px-4 text-muted-foreground">
                      {new Date(e.created_at).toLocaleString()}
                    </td>
                    <td className="py-3 px-4">
                      <ActionBadge action={e.action} />
                    </td>
                    <td className="py-3 px-4 font-mono">
                      {e.actor_email ?? '-'}
                      {e.actor_role ? (
                        <span className="text-[10px] text-muted-foreground ml-1">({e.actor_role})</span>
                      ) : null}
                    </td>
                    <td className="py-3 px-4 font-mono">{e.target_email ?? '-'}</td>
                    <td className="py-3 px-4 text-muted-foreground">{e.ip ?? '-'}</td>
                    <td className="py-3 px-4 max-w-xs">
                      <pre className="whitespace-pre-wrap break-words text-[10px] text-muted-foreground">
                        {e.metadata ? JSON.stringify(e.metadata, null, 2) : '{}'}
                      </pre>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
