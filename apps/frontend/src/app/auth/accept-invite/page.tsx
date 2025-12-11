'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

// URL Backend (fallback sicuro se la var d'ambiente manca)
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.doflow.it';

export default function AcceptInvitePage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setToken(params.get('token'));
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !password) return;

    setLoading(true);
    setError(null);

    try {
      // Chiamata all'API di conferma
      const res = await fetch(`${API_BASE}/api/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });

      const text = await res.text();

      if (!res.ok) {
        throw new Error(text || 'Errore durante l\'accettazione dell\'invito');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Errore sconosciuto');
      }
    } finally {
      setLoading(false);
    }
  };

  if (!token) {
    return (
      <main className="min-h-screen flex items-center justify-center p-6 bg-black text-white">
        <p>Token mancante o link non valido.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-black text-white">
      <div className="w-full max-w-md border border-zinc-800 rounded-lg p-6 bg-zinc-900/50">
        <h1 className="text-2xl font-bold mb-4 text-center">Benvenuto in Doflow</h1>
        
        {success ? (
          <div className="text-center space-y-2">
            <p className="text-green-400">Account creato con successo!</p>
            <p className="text-sm text-gray-400">Verrai reindirizzato al login...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-gray-300 text-center mb-4">
              Imposta la tua password per completare la registrazione.
            </p>
            
            <div className="space-y-1">
              <label className="text-xs uppercase text-gray-500">Nuova Password</label>
              <input
                type="password"
                required
                minLength={8}
                className="w-full bg-black border border-zinc-700 rounded px-3 py-2"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error && (
              <p className="text-xs text-red-400 p-2 border border-red-900/50 rounded bg-red-900/10">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-white text-black font-bold py-2 rounded hover:bg-gray-200 disabled:opacity-50"
            >
              {loading ? 'Attivazione...' : 'Imposta Password e Accedi'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}