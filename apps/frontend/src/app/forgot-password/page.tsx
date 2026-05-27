'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
    <div className="doflow-app-frame">
      <main className="flex items-center justify-center p-6 min-h-screen">
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
            {done ? (
              <div className="text-center space-y-6 animate-in fade-in zoom-in duration-500">
                <div className="flex justify-center">
                  <div className="df-icon-bubble h-16 w-16">
                    <Mail className="h-8 w-8 text-primary" aria-hidden="true" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h1 className="text-2xl font-bold">Controlla la tua email</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Se l&apos;indirizzo esiste nel sistema, riceverai a breve un&apos;email con il link per reimpostare la password.
                  </p>
                </div>
                <Button variant="outline" asChild className="w-full">
                  <Link href="/login">Torna al login</Link>
                </Button>
              </div>
            ) : (
              <>
                <div className="text-center mb-6 space-y-2">
                  <h1 className="text-2xl font-bold">Password dimenticata</h1>
                  <p className="text-sm text-muted-foreground">
                    Ti invieremo un link per reimpostare la password.
                  </p>
                </div>

                <form onSubmit={onSubmit} className="space-y-4">
                  <div className="flex flex-col gap-1.5">
                    <Label htmlFor="email" className="text-[13px] font-medium">Email</Label>
                    <div className="relative">
                      <Mail
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10"
                        size={15}
                        aria-hidden
                      />
                      <Input
                        id="email"
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pl-10"
                        placeholder="nome@azienda.it"
                        disabled={submitting}
                      />
                    </div>
                  </div>

                  {error && (
                    <div role="alert" className="text-xs text-destructive border border-destructive/40 rounded px-3 py-2 flex items-center gap-2 bg-destructive/5">
                      <span className="w-1 h-1 rounded-full bg-destructive" />
                      {error}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={submitting || !email}
                    className="w-full"
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Invio in corso...
                      </>
                    ) : (
                      'Invia link di reset'
                    )}
                  </Button>
                </form>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
