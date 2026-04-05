'use client';

import { useState } from 'react';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const res = await fetch(`${API_BASE}/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });

      if (!res.ok) {
        const txt = await res.text();
        setError(txt);
        setSubmitting(false);
        return;
      }

      setDone(true);
    } catch {
      setError('Errore di rete');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="w-full max-w-md border border-zinc-800 rounded-lg p-6 bg-black/60">
        <h1 className="text-2xl font-bold mb-2">Password dimenticata</h1>
        <p className="text-sm text-zinc-400 mb-4">
          Inserisci l&apos;email del tuo account. Se esiste, ti invieremo un link
          per reimpostare la password.
        </p>

        {done ? (
          <div className="text-sm text-green-400">
            Se l&apos;indirizzo esiste nel sistema, riceverai a breve un&apos;email
            con il link per reimpostare la password.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="space-y-4">
            <div className="flex flex-col gap-1">
              <label className="text-sm">Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
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
              {submitting ? 'Invio in corso...' : 'Invia link'}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
