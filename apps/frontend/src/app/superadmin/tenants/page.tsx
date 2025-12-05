'use client';

import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

type TenantRow = {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ListResponse = {
  tenants: TenantRow[];
};

export default function SuperadminTenantsPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const [newSlug, setNewSlug] = useState('');
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setToken(window.localStorage.getItem('doflow_token'));
    }
  }, []);

  useEffect(() => {
    if (!token) return;
    void loadTenants();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadTenants = async () => {
    if (!token) {
      setError('Token mancante. Effettua il login come SUPER_ADMIN.');
      return;
    }
    setLoading(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`${API_BASE}/superadmin/tenants`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const text = await res.text();
      if (!res.ok) {
        setError(text || 'Errore caricamento tenants');
        return;
      }

      const data = JSON.parse(text) as ListResponse;
      setTenants(data.tenants);
    } catch {
      setError('Errore di rete caricando i tenants');
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) {
      setError('Token mancante. Effettua il login come SUPER_ADMIN.');
      return;
    }
    if (!newSlug || !newName) {
      setError('Slug e nome sono obbligatori.');
      return;
    }

    setCreating(true);
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(`${API_BASE}/superadmin/tenants`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          slug: newSlug,
          name: newName,
          isActive: true,
        }),
      });

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok || data?.error) {
        setError(data?.error ?? text ?? 'Errore creazione tenant');
        return;
      }

      setInfo(`Tenant creato: ${data.tenant.slug}`);
      setNewSlug('');
      setNewName('');
      await loadTenants();
    } catch {
      setError('Errore di rete creando il tenant');
    } finally {
      setCreating(false);
    }
  };

  const handleToggle = async (tenantId: string) => {
    if (!token) {
      setError('Token mancante. Effettua il login come SUPER_ADMIN.');
      return;
    }
    setError(null);
    setInfo(null);

    try {
      const res = await fetch(
        `${API_BASE}/superadmin/tenants/${encodeURIComponent(
          tenantId,
        )}/toggle-active`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      );

      const text = await res.text();
      const data = text ? JSON.parse(text) : null;

      if (!res.ok || data?.error) {
        setError(data?.error ?? text ?? 'Errore aggiornamento stato tenant');
        return;
      }

      setInfo(
        `Tenant ${
          data.tenant.slug
        } ora è ${data.tenant.is_active ? 'ATTIVO' : 'DISATTIVATO'}`,
      );
      await loadTenants();
    } catch {
      setError('Errore di rete aggiornando lo stato del tenant');
    }
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full max-w-5xl flex flex-col gap-6">
        <header className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold">
              Superadmin – Gestione Tenant
            </h1>
            <p className="text-sm text-zinc-400">
              Solo utenti con ruolo <span className="font-mono">SUPER_ADMIN</span>.
            </p>
          </div>
        </header>

        {error && (
          <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">
            {error}
          </div>
        )}
        {info && (
          <div className="text-sm text-green-400 border border-green-500/40 rounded px-3 py-2">
            {info}
          </div>
        )}

        <section className="border border-zinc-800 rounded-lg p-4 flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Crea nuovo tenant</h2>
          <form onSubmit={handleCreate} className="flex flex-col gap-3">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-zinc-400">
                  Slug (es. cliente1)
                </label>
                <input
                  className="px-3 py-2 rounded bg-black border border-zinc-700 text-sm"
                  value={newSlug}
                  onChange={(e) =>
                    setNewSlug(e.target.value.toLowerCase())
                  }
                  placeholder="slug-tenant"
                />
              </div>
              <div className="flex-1 flex flex-col gap-1">
                <label className="text-xs text-zinc-400">
                  Nome visualizzato
                </label>
                <input
                  className="px-3 py-2 rounded bg-black border border-zinc-700 text-sm"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Nome Tenant"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={creating}
                className="px-4 py-2 rounded bg-white text-black text-sm font-medium disabled:opacity-50"
              >
                {creating ? 'Creazione...' : 'Crea tenant'}
              </button>
            </div>
          </form>
          <p className="text-[11px] text-zinc-500">
            Il tenant verrà inserito in <span className="font-mono">public.tenants</span>.
            La logica di provisioning schema rimane centralizzata nel backend.
          </p>
        </section>

        <section className="border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold">Tenant esistenti</h2>
            <button
              onClick={() => void loadTenants()}
              disabled={loading}
              className="text-xs px-3 py-1 border border-zinc-700 rounded disabled:opacity-50"
            >
              {loading ? 'Aggiornamento...' : 'Ricarica'}
            </button>
          </div>

          {tenants.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nessun tenant registrato in public.tenants.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr className="border-b border-zinc-800 text-xs text-zinc-400">
                    <th className="text-left py-2 pr-2">Slug</th>
                    <th className="text-left py-2 pr-2">Nome</th>
                    <th className="text-left py-2 pr-2">Stato</th>
                    <th className="text-left py-2 pr-2">Creato il</th>
                    <th className="text-left py-2 pr-2">Azioni</th>
                  </tr>
                </thead>
                <tbody>
                  {tenants.map((t) => (
                    <tr
                      key={t.id}
                      className="border-b border-zinc-900 last:border-0"
                    >
                      <td className="py-2 pr-2 font-mono text-xs">
                        {t.slug}
                      </td>
                      <td className="py-2 pr-2">{t.name}</td>
                      <td className="py-2 pr-2">
                        <span
                          className={
                            t.is_active
                              ? 'text-green-400 text-xs'
                              : 'text-red-400 text-xs'
                          }
                        >
                          {t.is_active ? 'ATTIVO' : 'DISATTIVATO'}
                        </span>
                      </td>
                      <td className="py-2 pr-2 text-xs text-zinc-400">
                        {new Date(t.created_at).toLocaleString()}
                      </td>
                      <td className="py-2 pr-2">
                        <button
                          onClick={() => void handleToggle(t.id)}
                          className="text-xs px-3 py-1 border border-zinc-700 rounded hover:bg-zinc-900"
                        >
                          Toggle stato
                        </button>
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
