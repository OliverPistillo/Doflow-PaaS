'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FedericaSidebar } from '@/components/federica-sidebar';

type JwtPayload = { email?: string; role?: string; tenantId?: string; tenant_id?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null;
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split('.')[1];
    if (!part) return null;

    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed)) return null;

    return {
      email: typeof parsed.email === 'string' ? parsed.email : undefined,
      role: typeof parsed.role === 'string' ? parsed.role : undefined,
      tenantId: typeof parsed.tenantId === 'string' ? parsed.tenantId : undefined,
      tenant_id: typeof parsed.tenant_id === 'string' ? parsed.tenant_id : undefined,
    };
  } catch {
    return null;
  }
}

export default function FedericaClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [email, setEmail] = React.useState('utente');
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // 1) Se arrivo con ?token=..., lo salvo e pulisco l'URL
    const url = new URL(window.location.href);
    const tokenFromQuery = url.searchParams.get('token');

    if (tokenFromQuery && tokenFromQuery.length > 20) {
      window.localStorage.setItem('doflow_token', tokenFromQuery);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    }

    // 2) Token finale
    const token = window.localStorage.getItem('doflow_token');
    if (!token) {
      router.push('/login');
      return;
    }

    // 3) Decodifica
    const payload = parseJwtPayload(token);
    if (payload?.email) setEmail(payload.email);

    // 4) Path-based tenant: se il token NON è federicanerone, fuori
    const tenant = (payload?.tenantId ?? payload?.tenant_id ?? '').toString().toLowerCase();
    if (tenant && tenant !== 'federicanerone') {
      router.push('/dashboard');
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground animate-pulse">Caricamento…</p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <FedericaSidebar />

      <main className="flex-1 p-6">
        {/* opzionale: header minimale */}
        <div className="mb-4 text-xs text-muted-foreground">
          Logged: <span className="font-mono">{email}</span>
        </div>

        {children}
      </main>
    </div>
  );
}
