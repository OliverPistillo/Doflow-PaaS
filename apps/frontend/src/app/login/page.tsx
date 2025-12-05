'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type LoginOkResponse = {
  token: string;
};

type LoginErrorResponse = {
  error: string;
};

type LoginResponse = LoginOkResponse | LoginErrorResponse;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('login@app.doflow.it');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tenantHost, setTenantHost] = useState<string>('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setTenantHost(window.location.host);
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const text = await res.text();

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const json = JSON.parse(text) as Partial<LoginErrorResponse>;
          if (json.error) {
            msg = json.error;
          }
        } catch {
          // ignore parse error, keep default msg
        }
        throw new Error(msg);
      }

      const data = JSON.parse(text) as LoginResponse;

      if ('error' in data) {
        throw new Error(data.error);
      }

      if (!('token' in data) || !data.token) {
        throw new Error('Token mancante nella risposta');
      }

      if (typeof window !== 'undefined') {
        window.localStorage.setItem('doflow_token', data.token);
      }

      router.push('/dashboard');
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = () => {
    router.push('/forgot-password');
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white px-4">
      <div className="w-full max-w-md">
        {/* Logo + info tenant */}
        <div className="flex flex-col items-center mb-6">
          <Image
            src="/logo-doflow.svg"
            alt="Doflow"
            width={80}
            height={80}
            className="mb-3"
          />
          <p className="text-[11px] text-zinc-500">
            Tenant corrente:{' '}
            <span className="font-mono text-zinc-200">
              {tenantHost || '...'}
            </span>
          </p>
        </div>

        {/* Card login con gradiente blu a rilievo */}
        <div className="relative rounded-2xl border border-blue-500/40 bg-gradient-to-br from-blue-500/80 via-indigo-500 to-blue-700 shadow-[0_0_60px_rgba(37,99,235,0.7)] overflow-hidden">
          <div className="absolute inset-0 pointer-events-none opacity-40 mix-blend-soft-light bg-[radial-gradient(circle_at_0_0,rgba(255,255,255,0.3),transparent_60%),radial-gradient(circle_at_100%_0,rgba(255,255,255,0.25),transparent_55%)]" />
          <div className="relative z-10 px-5 pt-5 pb-4 border-b border-white/20">
            <h1 className="text-xl font-semibold text-white text-center">
              Accedi a Doflow
            </h1>
            <p className="text-xs text-blue-50/80 text-center mt-1">
              Multi-tenant workspace access
            </p>
          </div>

          <div className="relative z-10 bg-black/80 backdrop-blur-xl px-5 py-5">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <label
                  htmlFor="email"
                  className="block text-xs text-zinc-200"
                >
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full px-3 py-2 text-sm rounded-md border border-zinc-700 bg-black/70 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  placeholder="tu@azienda.it"
                />
              </div>

              <div className="space-y-1">
                <label
                  htmlFor="password"
                  className="block text-xs text-zinc-200"
                >
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  className="w-full px-3 py-2 text-sm rounded-md border border-zinc-700 bg-black/70 text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-blue-400"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="Inserisci la tua password"
                />
              </div>

              {error && (
                <div className="text-[11px] text-red-200 bg-red-900/40 border border-red-500/40 rounded px-3 py-2">
                  {error}
                </div>
              )}

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-[11px] text-blue-200 hover:text-white hover:underline"
                >
                  Password dimenticata?
                </button>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full mt-1 px-4 py-2 rounded-full bg-white text-black text-sm font-semibold disabled:opacity-60"
              >
                {loading ? 'Accesso...' : 'Accedi'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  );
}
