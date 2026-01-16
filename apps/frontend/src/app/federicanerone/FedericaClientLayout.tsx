'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { FedericaSidebar } from '@/components/federica-sidebar';
import { SidebarProvider, SidebarInset } from '@/components/ui/sidebar';

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
      tenantId: typeof (parsed as any).tenantId === 'string' ? (parsed as any).tenantId : undefined,
      tenant_id: typeof (parsed as any).tenant_id === 'string' ? (parsed as any).tenant_id : undefined,
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
    const url = new URL(window.location.href);
    const tokenFromQuery = url.searchParams.get('token');

    if (tokenFromQuery && tokenFromQuery.length > 20) {
      window.localStorage.setItem('doflow_token', tokenFromQuery);
      url.searchParams.delete('token');
      window.history.replaceState({}, '', url.toString());
    }

    const token = window.localStorage.getItem('doflow_token');
    if (!token) {
      router.push('/login');
      return;
    }

    const payload = parseJwtPayload(token);
    if (payload?.email) setEmail(payload.email);

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
    <SidebarProvider>
      <FedericaSidebar />

      {/* SidebarInset è il wrapper “giusto” per il contenuto quando usi Sidebar */}
      <SidebarInset>
        <main className="p-6">
          <div className="mb-4 text-xs text-muted-foreground">
            Logged: <span className="font-mono">{email}</span>
          </div>
          {children}
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
