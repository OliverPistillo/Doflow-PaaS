'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '';

export default function ResetPasswordPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);
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
      const res = await fetch(`${API_BASE}/api/auth/reset-password`, {
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
      }, 2500);
    } catch {
      setError('Errore di rete');
    } finally {
      setSubmitting(false);
    }
  };

  if (initializing) {
    return (
      <div className="doflow-app-frame">
        <main className="min-h-screen flex items-center justify-center p-6">
          <div className="flex flex-col items-center gap-3 animate-pulse">
            <Loader2 className="h-8 w-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Caricamento in corso...</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="doflow-app-frame">
      <main className="min-h-screen flex items-center justify-center p-6">
        <div className="w-full max-w-md space-y-4">
          <div className="flex justify-center">
            <Button variant="ghost" size="sm" asChild className="gap-2 text-muted-foreground hover:text-foreground">
              <Link href="/login">
                <ArrowLeft size={14} />
                Torna al login
              </Link>
            </Button>
          </div>

          <div className="df-glass-panel p-8 animate-fadeInUp">
            <div className="text-center mb-6 space-y-2">
              <h1 className="text-2xl font-bold">Reimposta password</h1>
              <p className="text-sm text-muted-foreground">
                Scegli una nuova password sicura per il tuo account.
              </p>
            </div>

            {!token ? (
              <div className="space-y-6 text-center py-4">
                <div className="flex justify-center">
                  <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Link non valido o scaduto. Per favore richiedi un nuovo link di reset.
                  </p>
                </div>
                <Button asChild className="w-full">
                  <Link href="/forgot-password">Richiedi nuovo link</Link>
                </Button>
              </div>
            ) : done ? (
              <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500 py-4">
                <div className="flex justify-center">
                  <div className="df-icon-bubble h-16 w-16">
                    <CheckCircle2 className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h2 className="text-xl font-semibold">Password aggiornata!</h2>
                  <p className="text-sm text-muted-foreground">
                    La tua password è stata resettata con successo. Verrai reindirizzato al login tra pochi istanti.
                  </p>
                </div>
                <div className="flex justify-center">
                  <Loader2 className="h-5 w-5 text-primary animate-spin" />
                </div>
              </div>
            ) : (
              <form onSubmit={onSubmit} className="space-y-5">
                <div className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password">Nuova password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={15} />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pl-10 pr-10"
                        placeholder="••••••••"
                        disabled={submitting}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground z-10"
                            onClick={() => setShowPassword(!showPassword)}
                            aria-label={showPassword ? 'Nascondi' : 'Mostra'}
                          >
                            {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {showPassword ? 'Nascondi password' : 'Mostra password'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="password2">Ripeti password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" size={15} />
                      <Input
                        id="password2"
                        type={showPassword2 ? 'text' : 'password'}
                        required
                        minLength={8}
                        value={password2}
                        onChange={(e) => setPassword2(e.target.value)}
                        className="pl-10 pr-10"
                        placeholder="••••••••"
                        disabled={submitting}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent text-muted-foreground hover:text-foreground z-10"
                            onClick={() => setShowPassword2(!showPassword2)}
                            aria-label={showPassword2 ? 'Nascondi' : 'Mostra'}
                          >
                            {showPassword2 ? <EyeOff size={16} /> : <Eye size={16} />}
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent side="top">
                          {showPassword2 ? 'Nascondi password' : 'Mostra password'}
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </div>

                {error && (
                  <div role="alert" className="text-xs text-destructive border border-destructive/40 rounded px-3 py-2 flex items-center gap-2 bg-destructive/5 animate-in fade-in slide-in-from-top-1">
                    <AlertCircle size={14} className="shrink-0" />
                    {error}
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={submitting || !password || !password2}
                  className="w-full"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Salvataggio...
                    </>
                  ) : (
                    'Salva nuova password'
                  )}
                </Button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
