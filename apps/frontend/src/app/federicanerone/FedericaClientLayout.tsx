'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';

type LayoutRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
type JwtPayload = { email?: string; role?: string };

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
    };
  } catch {
    return null;
  }
}

function mapRoleToLayoutRole(role?: string): LayoutRole {
  const r = (role ?? '').toLowerCase();
  if (r === 'owner' || r === 'superadmin' || r === 'super_admin') return 'SUPER_ADMIN';
  if (r === 'admin') return 'ADMIN';
  if (r === 'manager') return 'MANAGER';
  return 'USER';
}

function assertFedericaHostOrRedirect(router: ReturnType<typeof useRouter>) {
  if (typeof window === 'undefined') return;
  const host = window.location.host.toLowerCase();
  if (!host.startsWith('federicanerone.')) {
    router.push('/admin');
  }
}

export default function FedericaClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const [email, setEmail] = React.useState('utente');
  const [role, setRole] = React.useState<LayoutRole>('USER');
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // 0) Gate: solo federicanerone.*
    assertFedericaHostOrRedirect(router);

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
    setRole(mapRoleToLayoutRole(payload?.role));

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground animate-pulse">Caricamento…</p>
      </div>
    );
  }

  return <DashboardLayout role={role} userEmail={email}>{children}</DashboardLayout>;
}
