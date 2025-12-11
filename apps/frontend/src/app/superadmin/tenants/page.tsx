'use client';

import { useEffect, useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

// Usa la variabile d'ambiente o fallback vuoto (chiamata relativa)
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

type Tenant = {
  id: string;
  name: string;
  slug?: string | null;
  schema?: string | null;
  isActive?: boolean | null;
  createdAt?: string | null;
};

type State =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ok'; tenants: Tenant[] };

export default function SuperadminTenantsPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [errorCreate, setErrorCreate] = useState<string | null>(null);

  // Carica lista tenants
  useEffect(() => {
    let cancelled = false;

    const loadTenants = async () => {
      try {
        const token = window.localStorage.getItem('doflow_token');
        if (!token) {
          router.push('/login');
          return;
        }

        const res = await fetch(`${API_BASE}/api/superadmin/tenants`, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
        });

        const text = await res.text();

        if (!res.ok) {
          console.error('Errore GET /superadmin/tenants:', res.status, text);
          if (res.status === 401 || res.status === 403) {
            router.push('/login');
            return;
          }
          if (!cancelled) {
            setState({
              status: 'error',
              message: text || 'Errore caricamento tenants',
            });
          }
          return;
        }

        // --- CORREZIONE CRASH ---
        // Il backend restituisce un oggetto { tenants: [...] }
        let data: { tenants: Tenant[] };
        try {
          data = JSON.parse(text);
        } catch (e) {
          console.error('Errore parse JSON tenants:', e, text);
          if (!cancelled) {
            setState({
              status: 'error',
              message: 'Risposta non valida dal server',
            });
          }
          return;
        }

        if (!cancelled) {
          // Estraiamo l'array .tenants
          setState({ status: 'ok', tenants: data.tenants || [] });
        }
      } catch (e) {
        console.error('Errore rete /superadmin/tenants:', e);
        if (!cancelled) {
          setState({
            status: 'error',
            message: 'Errore di rete caricando i tenants',
          });
        }
      }
    };

    void loadTenants();

    return () => {
      cancelled = true;
    };
  }, [router]);

  const handleCreateTenant = async (e: FormEvent) => {
    e.preventDefault();
    setErrorCreate(null);

    if (!name.trim()) {
      setErrorCreate('Il nome del tenant è obbligatorio.');
      return;
    }

    setCreating(true);

    try {
      const token = window.localStorage.getItem('doflow_token');
      if (!token) {
        router.push('/login');
        return;
      }

      const res = await fetch(`${API_BASE}/api/superadmin/tenants`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          slug: slug.trim() || undefined,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        console.error('Errore POST /superadmin/tenants:', res.status, text);
        if (res.status === 401 || res.status === 403) {
          router.push('/login');
          return;
        }
        setErrorCreate(text || 'Errore creazione tenant');
        return;
      }

      // Reset form
      setName('');
      setSlug('');

      // Ricarico lista
      setState({ status: 'loading' });
      
      const reloadRes = await fetch(`${API_BASE}/api/superadmin/tenants`, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      const reloadText = await reloadRes.text();
      if (reloadRes.ok) {
        // --- CORREZIONE CRASH ANCHE QUI ---
        const reloadData = JSON.parse(reloadText) as { tenants: Tenant[] };
        setState({ status: 'ok', tenants: reloadData.tenants || [] });
      } else {
        setState({
          status: 'error',
          message: reloadText || 'Errore ricaricando i tenants',
        });
      }
    } catch (e) {
      console.error('Errore rete creazione tenant:', e);
      setErrorCreate('Errore di rete durante la creazione del tenant');
    } finally {
      setCreating(false);
    }
  };

  // RENDER

  if (state.status === 'loading') {
    return (
      <main className="p-6 text-sm text-zinc-300">
        Caricamento tenants...
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="p-6 space-y-3 text-sm text-zinc-300">
        <h1 className="text-xl font-semibold mb-2">Tenants</h1>
        <p className="text-red-400">
          Errore caricando i tenants: {state.message}
        </p>
      </main>
    );
  }

  const { tenants } = state;

  return (
    <main className="p-6 space-y-6 text-sm text-zinc-200">
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Tenants</h1>
        <p className="text-xs text-zinc-400">
          Gestisci i tenants globali: creazione, stato, e overview multi-tenant.
        </p>
      </div>

      {/* Form creazione tenant */}
      <section className="border border-zinc-800 rounded-lg p-4 bg-zinc-950/70 space-y-3">
        <h2 className="text-sm font-semibold">Crea nuovo tenant</h2>
        <form
          className="flex flex-col gap-3 sm:flex-row sm:items-end"
          onSubmit={handleCreateTenant}
        >
          <div className="flex-1 space-y-1">
            <label className="block text-[11px] uppercase text-zinc-500">
              Nome tenant
            </label>
            <input
              className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
              placeholder="Es. Acme Corp"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="flex-1 space-y-1">
            <label className="block text-[11px] uppercase text-zinc-500">
              Slug / subdominio (opzionale)
            </label>
            <input
              className="w-full bg-black border border-zinc-800 rounded px-2 py-1 text-sm outline-none focus:border-blue-500"
              placeholder="Es. acme"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
            />
            <p className="text-[10px] text-zinc-500">
              Usato per URL come <span className="font-mono">acme.doflow.it</span>{' '}
              o schema DB <span className="font-mono">acme</span>, a seconda della
              configurazione.
            </p>
          </div>

          <div className="space-y-1">
            <button
              type="submit"
              disabled={creating}
              className="px-3 py-1.5 rounded bg-blue-600 text-xs font-semibold hover:bg-blue-500 disabled:opacity-50"
            >
              {creating ? 'Creazione...' : 'Crea tenant'}
            </button>
          </div>
        </form>
        {errorCreate && (
          <p className="text-xs text-red-400 mt-1">{errorCreate}</p>
        )}
      </section>

      {/* Tabella tenants */}
      <section className="border border-zinc-800 rounded-lg overflow-hidden bg-zinc-950/70">
        <table className="w-full text-xs">
          <thead className="bg-zinc-900/80 border-b border-zinc-800">
            <tr>
              <th className="text-left px-3 py-2 font-medium text-zinc-400">
                Nome
              </th>
              <th className="text-left px-3 py-2 font-medium text-zinc-400">
                Slug
              </th>
              <th className="text-left px-3 py-2 font-medium text-zinc-400">
                Schema
              </th>
              <th className="text-left px-3 py-2 font-medium text-zinc-400">
                Stato
              </th>
              <th className="text-left px-3 py-2 font-medium text-zinc-400">
                Creato il
              </th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td
                  colSpan={5}
                  className="px-3 py-4 text-center text-zinc-500"
                >
                  Nessun tenant creato.
                </td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr
                  key={t.id}
                  className="border-t border-zinc-900 hover:bg-zinc-900/60"
                >
                  <td className="px-3 py-2 font-medium text-zinc-100">
                    {t.name}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-300">
                    {t.slug || '—'}
                  </td>
                  <td className="px-3 py-2 font-mono text-zinc-300">
                    {t.schema || '—'}
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                        t.isActive ?? true
                          ? 'bg-emerald-900/60 text-emerald-300'
                          : 'bg-zinc-800 text-zinc-400'
                      }`}
                    >
                      {t.isActive ?? true ? 'ATTIVO' : 'DISABILITATO'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">
                    {t.createdAt
                      ? new Date(t.createdAt).toLocaleString()
                      : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>
    </main>
  );
}