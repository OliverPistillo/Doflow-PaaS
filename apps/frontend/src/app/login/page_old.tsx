'use client';

import { FormEvent, useEffect, useState } from 'react';

type LoginOkResponse = {
  token: string;
};

type LoginErrorResponse = {
  error: string;
};

type LoginResponse = LoginOkResponse | LoginErrorResponse;

export default function LoginPage() {
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
      const res = await fetch('/api/auth/login', {
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
        window.location.href = '/';
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to fetch';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-white">
      <div className="w-full max-w-md px-6">
        <div className="text-center mb-6">
          <p className="text-xs text-zinc-400 mb-1">
            Tenant corrente:{' '}
            <span className="font-mono text-zinc-200">
              {tenantHost || '...'}
            </span>
          </p>
          <h1 className="text-2xl font-bold mb-1">
            Login Doflow (multi-tenant)
          </h1>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-3 border border-zinc-800 rounded-lg p-4 bg-zinc-950/70"
        >
          <div className="space-y-1">
            <label className="block text-sm">Email</label>
            <input
              type="email"
              className="w-full px-3 py-2 text-sm rounded border border-zinc-700 bg-black focus:outline-none focus:ring-1 focus:ring-zinc-400"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-sm">Password</label>
            <input
              type="password"
              className="w-full px-3 py-2 text-sm rounded border border-zinc-700 bg-black focus:outline-none focus:ring-1 focus:ring-zinc-400"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>

          {error && (
            <div className="text-xs text-red-400">
              {error}
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 rounded bg-white text-black text-sm font-semibold disabled:opacity-60"
            >
              {loading ? 'Accesso...' : 'Login'}
            </button>
            <button
              type="button"
              className="flex-1 px-4 py-2 rounded border border-zinc-600 text-sm"
              onClick={() => {
                if (typeof window !== 'undefined') {
                  window.location.href = '/register';
                }
              }}
            >
              Registrati
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}
