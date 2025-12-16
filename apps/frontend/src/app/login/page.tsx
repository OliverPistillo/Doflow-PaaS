'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';

type LoginOkResponse = { token: string };
type LoginErrorResponse = { error: string };
type LoginResponse = LoginOkResponse | LoginErrorResponse;

// API base: in prod metti NEXT_PUBLIC_API_URL="https://api.doflow.it"
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.doflow.it';

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [tenantHost, setTenantHost] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') setTenantHost(window.location.host);
  }, []);

  const tenantLabel = useMemo(() => tenantHost || '...', [tenantHost]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ email, password }),
      });

      const text = await res.text();

      if (!res.ok) {
        let msg = `HTTP ${res.status}`;
        try {
          const json = JSON.parse(text) as Partial<LoginErrorResponse>;
          if (json?.error) msg = json.error;
        } catch {
          // ignore
        }
        throw new Error(msg);
      }

      const data = JSON.parse(text) as LoginResponse;
      if ('error' in data) throw new Error(data.error);
      if (!('token' in data) || !data.token) throw new Error('Token mancante nella risposta');

      window.localStorage.setItem('doflow_token', data.token);
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-[#6b6b6b] px-4 py-10 flex items-center justify-center">
      <div className="w-full max-w-5xl">
        {/* CARD PRINCIPALE */}
        <div className="relative overflow-hidden rounded-2xl bg-white shadow-2xl">
          {/* layout: mobile stack / desktop split */}
          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* PANNELLO BLU (sinistra su desktop / top su mobile) */}
            <div className="relative min-h-[240px] md:min-h-[560px] bg-gradient-to-b from-sky-400 to-sky-600 text-white">
              {/* onde morbide */}
              <div className="absolute inset-0 opacity-30 pointer-events-none">
                <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-white/20 blur-2xl" />
                <div className="absolute left-10 top-40 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
                <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-white/20 blur-2xl" />
              </div>

              {/* curva bianca che “mangia” il pannello (come nel mock) */}
              <div
                className="hidden md:block absolute right-[-120px] top-[-80px] h-[720px] w-[520px] rounded-[999px] bg-white"
                aria-hidden
              />
              <div
                className="md:hidden absolute right-[-140px] bottom-[-220px] h-[520px] w-[520px] rounded-[999px] bg-white"
                aria-hidden
              />

              <div className="relative z-10 h-full p-8 md:p-10 flex flex-col justify-between">
                <div className="space-y-3">
                  <p className="text-xs tracking-[0.25em] opacity-90">WELCOME TO</p>

                  <div className="flex items-center gap-3">
                    <Image
                      src="/logo-transparent-svg.svg"
                      alt="Doflow"
                      width={64}
                      height={64}
                      priority
                    />
                    <div className="leading-tight">
                      <div className="text-lg font-semibold">DOFLOW</div>
                      <div className="text-xs opacity-90">Workspace multi-tenant</div>
                    </div>
                  </div>

                  <p className="text-xs leading-relaxed opacity-90 max-w-sm">
                    Accedi al tuo spazio di lavoro. Se sei su un tenant specifico, verrà usato
                    automaticamente dal dominio.
                  </p>
                </div>

                <div className="flex items-end justify-between text-[10px] opacity-90">
                  <div>
                    Tenant: <span className="font-mono">{tenantLabel}</span>
                  </div>
                  <div className="hidden md:block">doflow.it</div>
                </div>
              </div>
            </div>

            {/* FORM (destra su desktop / bottom su mobile) */}
            <div className="relative p-8 md:p-10">
              {/* mini onda azzurra in alto a destra (come nel mock) */}
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-sky-400/20 blur-2xl" aria-hidden />
              <div className="absolute right-[-140px] top-[-160px] h-[320px] w-[320px] rounded-[999px] bg-sky-400/35" aria-hidden />
              <div className="absolute right-[-170px] top-[-180px] h-[340px] w-[340px] rounded-[999px] bg-sky-500/20" aria-hidden />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <Image src="/logo-svg.svg" alt="Doflow" width={34} height={34} />
                    <div>
                      <div className="text-lg font-semibold text-zinc-900">Accedi</div>
                      <div className="text-xs text-zinc-500">Entra nel tuo account</div>
                    </div>
                  </div>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold tracking-wide text-zinc-700">
                      E-MAIL ADDRESS
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      placeholder="Inserisci la tua email"
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold tracking-wide text-zinc-700">
                      PASSWORD
                    </label>
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete="current-password"
                      placeholder="Inserisci la tua password"
                      className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-sky-300"
                    />
                  </div>

                  {error && (
                    <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                      {error}
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => router.push('/forgot-password')}
                      className="text-xs text-sky-700 hover:underline"
                    >
                      Password dimenticata?
                    </button>

                    <div className="text-[10px] text-zinc-400 font-mono">
                      {tenantLabel}
                    </div>
                  </div>

                  <div className="pt-1 flex items-center gap-3">
                    <button
                      type="submit"
                      disabled={loading}
                      className="inline-flex items-center justify-center rounded-full bg-sky-500 px-6 py-2 text-sm font-semibold text-white shadow-sm hover:bg-sky-600 disabled:opacity-60"
                    >
                      {loading ? 'Accesso...' : 'Sign In'}
                    </button>

                    <button
                      type="button"
                      onClick={() => router.push('/auth/accept-invite')}
                      className="inline-flex items-center justify-center rounded-full border border-sky-400 px-6 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                      title="Se hai ricevuto un invito"
                    >
                      Accept Invite
                    </button>
                  </div>

                  <p className="pt-4 text-[11px] text-zinc-400">
                    Se stai entrando in un tenant specifico, usa <span className="font-mono">https://slug.doflow.it</span>.
                  </p>
                </form>
              </div>
            </div>
          </div>
        </div>

        {/* footer piccolo */}
        <div className="mt-4 text-center text-[11px] text-white/70">
          © {new Date().getFullYear()} Doflow
        </div>
      </div>
    </main>
  );
}
