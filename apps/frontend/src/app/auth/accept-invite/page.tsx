'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.doflow.it';

function nextPathByRole(role: string) {
  const r = (role || '').toLowerCase();
  if (r === 'superadmin' || r === 'owner') return '/superadmin/tenants';
  if (r === 'admin' || r === 'manager') return '/admin/users';
  return '/projects';
}

// 1. Definiamo i tipi di risposta attesi
type AcceptInviteSuccess = {
  token: string;
  user: { id: number | string; email: string; role: string; tenantId?: string };
};

type AcceptInviteError = { error: string };

export default function AcceptInvitePage() {
  const router = useRouter();

  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setInviteToken(params.get('token'));
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!inviteToken) return setError('Token mancante o link non valido.');
    if (password.length < 8) return setError('La password deve avere almeno 8 caratteri.');
    if (password !== password2) return setError('Le password non coincidono.');

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token: inviteToken, password }),
      });

      const text = await res.text();
      
      // 2. Usiamo l'unione di tipi invece di any
      let data: AcceptInviteSuccess | AcceptInviteError | null = null;
      try {
        data = JSON.parse(text);
      } catch {
        // ok, gestiamo sotto
      }

      if (!res.ok) {
        // 3. Controllo sicuro con "in" per estrarre l'errore
        const msg =
          (data && 'error' in data ? data.error : null) ||
          text ||
          `Errore accettazione invito (HTTP ${res.status})`;
        throw new Error(msg);
      }

      // 4. Controllo sicuro per confermare che sia una risposta di successo
      if (!data || !('token' in data) || !data.token || !data.user) {
        throw new Error('Risposta backend non valida (token/user mancanti).');
      }

      localStorage.setItem('doflow_token', data.token);

      const target = nextPathByRole(data.user.role);
      router.push(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
    }
  };

  if (!inviteToken) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-white p-6">
        <div className="max-w-md w-full border border-border rounded-lg p-6 bg-muted/50">
          <h1 className="text-xl font-semibold mb-2">Link non valido</h1>
          <p className="text-sm text-muted-foreground">
            Token mancante. Richiedi un nuovo invito all’amministratore.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6 bg-black text-white">
      <div className="w-full max-w-md border border-border rounded-lg p-6 bg-muted/50">
        <h1 className="text-2xl font-bold mb-2 text-center">Attiva account</h1>
        <p className="text-sm text-muted-foreground/50 text-center mb-6">
          Imposta una password per completare la registrazione.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-xs uppercase text-muted-foreground">Password</label>
            <input
              type="password"
              minLength={8}
              required
              className="w-full bg-black border border-border rounded px-3 py-2"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs uppercase text-muted-foreground">Ripeti password</label>
            <input
              type="password"
              minLength={8}
              required
              className="w-full bg-black border border-border rounded px-3 py-2"
              value={password2}
              onChange={(e) => setPassword2(e.target.value)}
            />
          </div>

          {error && (
            <div className="text-xs text-red-400 border border-red-900/50 rounded p-2 bg-red-900/10">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-white text-black font-bold py-2 rounded hover:bg-muted/20 disabled:opacity-50"
          >
            {loading ? 'Attivazione...' : 'Attiva e entra'}
          </button>
        </form>
      </div>
    </main>
  );
}