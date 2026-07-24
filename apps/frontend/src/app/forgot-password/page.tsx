'use client';

import * as React from 'react';
import { useState, FormEvent } from 'react';
import Link from 'next/link';
import { Mail, ArrowLeft, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';

import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { apiFetch } from "@/lib/api";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        auth: false,
        body: JSON.stringify({ email }),
      });
      setDone(true);
    } catch (err: any) {
      setError(err?.message || 'Errore durante la richiesta di reset');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen doflow-app-frame flex items-center justify-center p-4 lg:p-6">
      <div className="w-full max-w-md df-glass-panel rounded-[32px] p-8 lg:p-10 overflow-hidden relative">
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-extrabold tracking-tight">Password dimenticata</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ti invieremo un link per reimpostare la password.
            </p>
          </div>

          {done ? (
            <div className="flex flex-col items-center justify-center py-10 animate-fadeInUp" role="status">
              <div className="df-icon-bubble h-20 w-20 mb-6">
                <CheckCircle2 className="h-10 w-10" aria-hidden="true" />
              </div>
              <p className="text-xl font-bold tracking-tight text-center px-4">Link inviato!</p>
              <p className="text-sm text-muted-foreground mt-2 text-center px-6 leading-relaxed">
                Se l'indirizzo esiste nel sistema, riceverai a breve un'email con le istruzioni.
              </p>
              <Button asChild variant="link" className="mt-8 text-primary font-semibold">
                <Link href="/login" className="flex items-center gap-2">
                  <ArrowLeft size={14} />
                  Torna al login
                </Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="space-y-5">
              <div className="grid gap-2">
                <Label htmlFor="email">Indirizzo Email</Label>
                <div className="relative">
                  <Mail size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" aria-hidden />
                  <Input
                    id="email"
                    type="email"
                    required
                    placeholder="nome@azienda.it"
                    className="pl-9"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    autoFocus
                  />
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
                disabled={submitting || !email}
                className="w-full h-12 text-base font-bold"
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Invio in corso...
                  </>
                ) : (
                  'Invia link di reset'
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
