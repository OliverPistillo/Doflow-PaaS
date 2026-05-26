'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { Mail, ArrowLeft, Loader2 } from 'lucide-react';

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
      <div className="w-full max-w-md space-y-4">
        <div className="flex justify-center">
          <Link
            href="/login"
            className="flex items-center gap-2 text-xs font-semibold text-zinc-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={14} />
            Torna al login
          </Link>
        </div>

        <div className="border border-zinc-800 rounded-lg p-8 bg-black/60 shadow-xl">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold mb-2">Password dimenticata</h1>
            <p className="text-sm text-zinc-400">
              Ti invieremo un link per reimpostare la password.
            </p>
          </div>

          {done ? (
            <div className="text-sm text-green-400 text-center bg-green-500/10 border border-green-500/20 rounded-lg p-4">
              Se l&apos;indirizzo esiste nel sistema, riceverai a breve un&apos;email
              con il link di reset.
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={15} aria-hidden />
                  <input
                    id="email"
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 rounded bg-black border border-zinc-700 text-sm focus:border-white transition-colors outline-none"
                    placeholder="nome@azienda.it"
                    disabled={submitting}
                  />
                </div>
              </div>

              {error && (
                <div role="alert" className="text-xs text-red-400 border border-red-500/40 rounded px-3 py-2 flex items-center gap-2">
                  <span className="w-1 h-1 rounded-full bg-red-500" />
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || !email}
                className="w-full px-4 py-2.5 rounded bg-white text-black text-sm font-bold disabled:opacity-50 hover:bg-zinc-200 transition-colors flex items-center justify-center gap-2"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Invio in corso...
                  </>
                ) : (
                  'Invia link di reset'
                )}
              </button>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
