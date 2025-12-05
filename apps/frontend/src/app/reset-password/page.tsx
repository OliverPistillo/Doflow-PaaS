'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const sp = new URLSearchParams(window.location.search);
    const t = sp.get('token');

    setToken(t);
    setInitializing(false);
  }, []);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Token mancante o non valido');
      return;
    }

    if (password !== password2) {
      setError('Le password non coincidono');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch(`${API_BASE}/auth/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const text = await res.text();
      if (!res.ok) {
        try {
          const data = JSON.parse(text) as { error?: string };
          setError(data.error ?? 'Errore reset password');
        } catch {
          setError(text || 'Errore reset password');
        }
        setSubmitting(false);
        return;
      }

      setDone(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch {
      setError('Errore di rete');
    } finally {
      setSubmitting(false);
    }
  };

  if (initializing) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="text-sm text-zinc-400">
          Caricamento link di reset...
        </div>
      </main>
    );
  }

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md border border-zinc-800 rounded-lg p-6 bg-black/60">
          <h1 className="text-2xl font-bold mb-2">Reimposta password</h1>
          <p className="text-sm text-red-400 mb-4">
            Link non valido o mancante. Richiedi nuovamente la reimpostazione
            della password.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-zinc-800 rounded-lg p-6 bg-black/60">
        <h1 className="text-2xl font-bold mb-2">Reimposta password</h1>

        {done ? (
          <p className="text-sm text-green-400">
            Password aggiornata. Verrai reindirizzato alla pagina di login...
          </p>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm">Nuova password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="px-3 py-2 rounded bg-black border border-zinc-700 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm">Ripeti password</label>
              <input
                type="password"
                required
                minLength={8}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="px-3 py-2 rounded bg-black border border-zinc-700 text-sm"
              />
            </div>

            {error && (
              <div className="text-xs text-red-400 border border-red-500/40 rounded px-3 py-2">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="w-full px-4 py-2 rounded bg-white text-black text-sm font-medium disabled:opacity-50"
            >
              {submitting ? 'Salvataggio...' : 'Salva nuova password'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
