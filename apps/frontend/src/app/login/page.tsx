// apps/frontend/src/app/login/page.tsx
'use client';

import * as React from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

type LoginOkResponse = { token: string };
type LoginErrorResponse = { error: string };
type LoginResponse = LoginOkResponse | LoginErrorResponse;

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.doflow.it';

const SLIDES = [
  { src: '/login-cover-1.webp', alt: 'Doflow cover 1' },
  { src: '/login-cover-2.webp', alt: 'Doflow cover 2' },
  { src: '/login-cover-3.webp', alt: 'Doflow cover 3' },
] as const;

function cn(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ');
}

function getHost(): string {
  if (typeof window === 'undefined') return '';
  return window.location.host;
}

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');

  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [tenantHost, setTenantHost] = React.useState('');
  const [slide, setSlide] = React.useState(0);

  // host label
  React.useEffect(() => {
    setTenantHost(getHost());
  }, []);

  // autoplay carousel
  React.useEffect(() => {
    const id = window.setInterval(() => {
      setSlide((s) => (s + 1) % SLIDES.length);
    }, 4500);
    return () => window.clearInterval(id);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
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
        } catch {}
        throw new Error(msg);
      }

      const data = JSON.parse(text) as LoginResponse;
      if ('error' in data) throw new Error(data.error);
      if (!('token' in data) || !data.token) throw new Error('Token mancante nella risposta');

      window.localStorage.setItem('doflow_token', data.token);

      // qui puoi decidere se /dashboard o /superadmin/dashboard leggendo il ruolo dal token
      router.push('/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Errore di rete');
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-background">
      <div className="relative min-h-screen lg:grid lg:grid-cols-2">
        {/* LEFT: Cover carousel */}
        <div className="relative hidden lg:block">
          <div className="absolute inset-0">
            {SLIDES.map((s, i) => (
              <div
                key={s.src}
                className={cn(
                  'absolute inset-0 transition-opacity duration-700',
                  i === slide ? 'opacity-100' : 'opacity-0',
                )}
              >
                <Image
                  src={s.src}
                  alt={s.alt}
                  fill
                  priority={i === 0}
                  className="object-cover"
                  sizes="(min-width: 1024px) 50vw, 0vw"
                />
                {/* overlay per contrasto */}
                <div className="absolute inset-0 bg-black/40" />
              </div>
            ))}
          </div>

          {/* Brand */}
          <div className="relative z-10 flex h-full flex-col justify-between p-10">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-white/10 p-2 backdrop-blur">
                <Image
                  src="/logo-transparent-svg.svg"
                  alt="Doflow"
                  width={28}
                  height={28}
                  className="h-7 w-7"
                />
              </div>
              <div className="text-white">
                <div className="text-sm font-semibold leading-none">Doflow</div>
                <div className="text-xs text-white/70">Multi-tenant control</div>
              </div>
            </div>

            {/* Dots + microcopy */}
            <div className="space-y-4">
              <p className="max-w-md text-white/90 text-sm">
                Accedi alla tua organizzazione e continua a lavorare su progetti, utenti e tenant.
              </p>

              <div className="flex items-center gap-2">
                {SLIDES.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Slide ${i + 1}`}
                    onClick={() => setSlide(i)}
                    className={cn(
                      'h-2.5 w-2.5 rounded-full ring-1 ring-white/40 transition',
                      i === slide ? 'bg-white' : 'bg-white/30 hover:bg-white/50',
                    )}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT: Login card */}
        <div className="flex items-center justify-center p-6 lg:p-10">
          <Card className="w-full max-w-sm p-6">
            <div className="space-y-2">
              <h1 className="text-xl font-semibold tracking-tight">Accedi</h1>
              <p className="text-sm text-muted-foreground">
                Inserisci le tue credenziali per continuare.
              </p>
              <p className="text-xs text-muted-foreground font-mono">
                Tenant: {tenantHost || '...'}
              </p>
            </div>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="nome@azienda.it"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                />
              </div>

              {error ? (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              ) : null}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? 'Accesso…' : 'Login'}
              </Button>

              <div className="text-center">
                <button
                  type="button"
                  onClick={() => router.push('/forgot-password')}
                  className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-4"
                >
                  Recupera password
                </button>
              </div>
            </form>
          </Card>
        </div>
      </div>
    </main>
  );
}
