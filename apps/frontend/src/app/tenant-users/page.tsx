'use client';

import { useEffect, useState } from 'react';
import { getTenantHeader } from '@/lib/tenant-fetch';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.doflow.it';

type User = {
  id: number;
  email: string;
  created_at: string;
  schema: string;
};

export default function TenantUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getToken = () =>
    typeof window !== 'undefined' ? window.localStorage.getItem('doflow_token') : null;

  const loadUsers = async () => {
    setError(null);

    const token = getToken();
    if (!token) {
      setError('Non autenticato: fai login prima.');
      setUsers([]);
      return;
    }

    try {
      // Nota: usiamo fetch nativa qui, ma potresti usare tenantFetch importata se vuoi risparmiare codice
      const res = await fetch(`${API_BASE}/api/tenant/users`, {
        cache: 'no-store',
        headers: {
          Authorization: `Bearer ${token}`,
          ...getTenantHeader(), // Ora questa chiamata è sicura
        },
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Errore caricamento utenti');
      }

      const data = await res.json();
      setUsers(data.users ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    }
  };

  useEffect(() => {
    void loadUsers();
  }, []);

  const handleCreate = async () => {
    if (!email) return;
    setLoading(true);
    setError(null);

    const token = getToken();
    if (!token) {
      setError('Non autenticato: fai login prima.');
      setLoading(false);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/tenant/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
          ...getTenantHeader(),
        },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || 'Errore creazione utente');
      }

      setEmail('');
      await loadUsers();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen p-6 flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Tenant Users</h1>

      <div className="flex gap-2 items-center">
        <input
          className="border rounded px-3 py-2 flex-1 max-w-xs"
          placeholder="email utente"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button
          onClick={handleCreate}
          disabled={loading || !email}
          className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
        >
          {loading ? 'Creazione...' : 'Crea utente'}
        </button>
      </div>

      {error && <div className="text-red-600 text-sm">{error}</div>}

      <div className="border rounded p-4 max-w-xl">
        <h2 className="font-semibold mb-2">Utenti del tenant corrente</h2>
        {users.length === 0 && !error && <p className="text-sm text-gray-500">Nessun utente.</p>}
        <ul className="space-y-1 text-sm">
          {users.map((u) => (
            <li key={u.id} className="flex justify-between gap-4">
              <span>{u.email}</span>
              <span className="text-gray-500">schema: {u.schema}</span>
            </li>
          ))}
        </ul>
      </div>
    </main>
  );
}