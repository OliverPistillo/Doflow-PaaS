'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState, FormEvent } from 'react';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle
} from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.doflow.it';

function nextPathByRole(role: string) {
  const r = (role || '').toLowerCase();
  if (r === 'superadmin' || r === 'owner') return '/superadmin/tenants';
  if (r === 'admin' || r === 'manager') return '/admin/users';
  return '/projects';
}

type AcceptInviteSuccess = {
  token: string;
  user: { id: number | string; email: string; role: string; tenantId?: string };
};

type AcceptInviteError = { error: string };

export default function AcceptInvitePage() {
  const router = useRouter();

  const [initializing, setInitializing] = useState(true);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setInviteToken(params.get('token'));
      setInitializing(false);
    }
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!inviteToken) return setError('Token mancante o link non valido.');
    if (password.length < 8) return setError('La password deve avere almeno 8 caratteri.');
    if (password !== password2) return setError('Le password non coincidono.');

    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/auth/accept-invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        body: JSON.stringify({ token: inviteToken, password }),
      });

      const text = await res.text();
      
      let data: AcceptInviteSuccess | AcceptInviteError | null = null;
      try {
        data = JSON.parse(text);
      } catch {
        // ok
      }

      if (!res.ok) {
        const msg =
          (data && 'error' in data ? data.error : null) ||
          text ||
          `Errore accettazione invito (HTTP ${res.status})`;
        throw new Error(msg);
      }

      if (!data || !('token' in data) || !data.token || !data.user) {
        throw new Error('Risposta backend non valida (token/user mancanti).');
      }

      localStorage.setItem('doflow_token', data.token);

      const target = nextPathByRole(data.user.role);
      router.push(target);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Errore sconosciuto');
    } finally {
      setLoading(false);
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
          <div className="df-glass-panel p-8 animate-fadeInUp">
            {!inviteToken ? (
              <div className="text-center space-y-6 py-4">
                <div className="flex justify-center">
                  <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center">
                    <AlertCircle className="h-6 w-6 text-destructive" />
                  </div>
                </div>
                <div className="space-y-2">
                  <h1 className="text-xl font-bold">Link non valido</h1>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    Token mancante. Richiedi un nuovo invito all’amministratore.
                  </p>
                </div>
              </div>
            ) : (
              <>
                <div className="text-center mb-6 space-y-2">
                  <h1 className="text-2xl font-bold">Attiva account</h1>
                  <p className="text-sm text-muted-foreground">
                    Imposta una password per completare la registrazione.
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-4">
                    <div className="flex flex-col gap-1.5">
                      <Label htmlFor="password">Password</Label>
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
                          disabled={loading}
                          autoFocus
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
                          disabled={loading}
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
                    disabled={loading || !password || !password2}
                    className="w-full"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Attivazione...
                      </>
                    ) : (
                      'Attiva e entra'
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
