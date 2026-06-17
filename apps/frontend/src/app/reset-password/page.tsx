'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import { Loader2, CheckCircle2, Eye, EyeOff, AlertCircle, ArrowLeft, Lock } from 'lucide-react';
import Link from 'next/link';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api";

export default function ResetPasswordPage() {
  const router = useRouter();

  const [token, setToken] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);

  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPwd1, setShowPwd1] = useState(false);
  const [showPwd2, setShowPwd2] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const sp = new URLSearchParams(window.location.search);
      setToken(sp.get('token'));
      setInitializing(false);
    }
  }, []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!token) return setError('Token mancante o non valido.');
    if (password.length < 8) return setError('La password deve avere almeno 8 caratteri.');
    if (password !== password2) return setError('Le password non coincidono.');

    setSubmitting(true);

    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ token, password }),
      });

      setDone(true);
      setTimeout(() => {
        router.push('/login');
      }, 2000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore durante il reset della password');
    } finally {
      setSubmitting(false);
    }
  };

  if (initializing) {
    return (
      <div className="min-h-screen doflow-app-frame flex items-center justify-center p-6">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!token) {
    return (
      <main className="min-h-screen doflow-app-frame flex items-center justify-center p-6">
        <div className="max-w-md w-full df-glass-panel rounded-[32px] p-8 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight mb-2">Link non valido</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Token mancante o scaduto. Richiedi nuovamente la reimpostazione della password.
            </p>
          </div>
          <Button asChild variant="outline" className="w-full">
            <Link href="/forgot-password" title="Torna alla pagina password dimenticata" className="flex items-center gap-2">
              <ArrowLeft size={16} />
              Nuova richiesta
            </Link>
          </Button>
        </div>
      </main>
    );
  }

  return (
    <div className="min-h-screen doflow-app-frame flex items-center justify-center p-4 lg:p-6">
      <div className="w-full max-w-md df-glass-panel rounded-[32px] p-8 lg:p-10 overflow-hidden relative">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight">Reimposta password</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Scegli una nuova password sicura per il tuo account.
            </p>
          </div>

          {done ? (
            <div className="flex flex-col items-center justify-center py-10 animate-fadeInUp" role="status">
              <div className="df-icon-bubble h-20 w-20 mb-6">
                <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
              </div>
              <p className="text-xl font-bold tracking-tight">Password aggiornata!</p>
              <p className="text-sm text-muted-foreground mt-2">Ti stiamo portando al login...</p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="password">Nuova password</Label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                  <Input
                    id="password"
                    type={showPwd1 ? "text" : "password"}
                    minLength={8}
                    required
                    placeholder="Almeno 8 caratteri"
                    className="pl-9 pr-10"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoFocus
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setShowPwd1(!showPwd1)}
                          aria-label={showPwd1 ? "Nascondi password" : "Mostra password"}
                          className="focus:outline-none p-1 rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {showPwd1 ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {showPwd1 ? "Nascondi password" : "Mostra password"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="password-confirm">Ripeti password</Label>
                <div className="relative">
                  <Lock size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                  <Input
                    id="password-confirm"
                    type={showPwd2 ? "text" : "password"}
                    minLength={8}
                    required
                    placeholder="Conferma password"
                    className="pl-9 pr-10"
                    value={password2}
                    onChange={(e) => setPassword2(e.target.value)}
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors cursor-pointer flex">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          onClick={() => setShowPwd2(!showPwd2)}
                          aria-label={showPwd2 ? "Nascondi password" : "Mostra password"}
                          className="focus:outline-none p-1 rounded-sm focus-visible:ring-2 focus-visible:ring-ring"
                        >
                          {showPwd2 ? <EyeOff size={15} /> : <Eye size={15} />}
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        {showPwd2 ? "Nascondi password" : "Mostra password"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </div>
              </div>

              {error && (
                <div role="alert" className="flex items-center gap-2.5 rounded-xl bg-destructive/10 px-4 py-3 text-[13px] text-destructive border border-destructive/20 animate-fadeIn">
                  <AlertCircle size={15} className="shrink-0" aria-hidden />
                  <span>{error}</span>
                </div>
              )}

              <Button
                type="submit"
                disabled={submitting}
                className="w-full h-12 text-base font-bold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Salvataggio...
                  </>
                ) : (
                  'Salva nuova password'
                )}
              </Button>

              <div className="text-center pt-2">
                <Link
                  href="/login"
                  className="text-xs font-semibold text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  <ArrowLeft size={14} />
                  Torna al login
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
