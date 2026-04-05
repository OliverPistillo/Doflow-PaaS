'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

type Project = {
  id: number;
  name: string;
  description: string | null;
  status: string;
  owner_email: string | null;
  created_at: string;
};

type ProjectsResponse = {
  projects: Project[];
};

export default function ProjectsPage() {
  const [tenantHost, setTenantHost] = useState('');
  const [token, setToken] = useState<string | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTenantHost(window.location.host);
      setToken(window.localStorage.getItem('doflow_token'));
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadProjects = async () => {
    if (!token) {
      setError('Token mancante, effettua il login.');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_BASE}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
        cache: 'no-store',
      });
      const text = await res.text();
      if (!res.ok) {
        setError(text);
        return;
      }
      const data = JSON.parse(text) as ProjectsResponse;
      setProjects(data.projects);
    } catch (e) {
      setError('Errore nel caricamento progetti');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    if (!token) {
      setError('Token mancante, effettua il login.');
      return;
    }
    if (!name) {
      setError('Inserisci un nome progetto.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/projects`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ name, description }),
      });
      const data = await res.json();
      if (!res.ok || data.error) {
        setError(data.error ?? 'Errore creazione progetto');
        return;
      }
      setName('');
      setDescription('');
      await loadProjects();
    } catch (e) {
      setError('Errore creazione progetto');
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

  const handleCopyId = (id: number) => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      void navigator.clipboard.writeText(String(id));
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center gap-6 p-6">
      <div className="w-full max-w-5xl flex flex-col gap-4">
        <header className="flex flex-col gap-2 border-b border-zinc-800 pb-3 mb-2">
          <div className="flex justify-between items-center text-xs text-gray-400">
            <span>
              Tenant: <span className="font-mono">{tenantHost}</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-xs px-3 py-1 border rounded border-zinc-700 hover:bg-zinc-800"
            >
              Logout
            </button>
          </div>
          <div className="flex justify-between items-center">
            <h1 className="text-2xl font-bold">Progetti</h1>
            <nav className="flex gap-3 text-sm">
              <Link href="/projects" className="underline">
                Progetti
              </Link>
              <Link href="/admin/users" className="text-gray-400 hover:underline">
                Admin utenti
              </Link>
              <Link href="/admin/audit" className="text-gray-400 hover:underline">
                Audit log
              </Link>
            </nav>
          </div>
        </header>

        {!token && (
          <p className="text-xs text-red-400">
            Nessun token trovato: vai su /login.
          </p>
        )}

        {error && (
          <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">
            {error}
          </div>
        )}

        <section className="border rounded-lg p-4 flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Crea nuovo progetto</h2>
          <div className="flex flex-col md:flex-row gap-2">
            <input
              className="border rounded px-3 py-2 flex-1"
              placeholder="Nome progetto"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <input
              className="border rounded px-3 py-2 flex-1"
              placeholder="Descrizione (opzionale)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
            <button
              onClick={handleCreate}
              disabled={loading}
              className="px-4 py-2 rounded bg-black text-white disabled:opacity-50"
            >
              {loading ? 'Creazione...' : 'Crea'}
            </button>
          </div>
        </section>

        <section className="border rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Elenco progetti</h2>
            <button
              onClick={() => void loadProjects()}
              disabled={loading}
              className="text-xs px-3 py-1 border rounded disabled:opacity-50"
            >
              {loading ? 'Aggiornamento...' : 'Ricarica'}
            </button>
          </div>

          {projects.length === 0 ? (
            <p className="text-sm text-gray-400">
              Nessun progetto presente per questo tenant.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {projects.map((p) => (
                <li
                  key={p.id}
                  className="border border-zinc-800 rounded px-3 py-2 flex justify-between items-center"
                >
                  <div>
                    <div className="font-semibold">{p.name}</div>
                    {p.description && (
                      <div className="text-xs text-gray-400">
                        {p.description}
                      </div>
                    )}
                    <div className="text-[11px] text-gray-500">
                      Owner: {p.owner_email ?? '—'} ·{' '}
                      {new Date(p.created_at).toLocaleString()}
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500 flex items-center gap-2">
                      <span>
                        ID:{' '}
                        <span className="font-mono">
                          {p.id}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => handleCopyId(p.id)}
                        className="text-[10px] px-2 py-0.5 border border-zinc-700 rounded hover:bg-zinc-800"
                      >
                        Copia ID
                      </button>
                    </div>
                  </div>
                  <Link
                    href={`/projects/${p.id}`}
                    className="text-xs px-3 py-1 border rounded border-zinc-700 hover:bg-zinc-800"
                  >
                    Task →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
