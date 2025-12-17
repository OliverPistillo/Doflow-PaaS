'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';
import { mapBackendRoleToLayout } from '@/lib/roles';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'https://api.doflow.it';

type MeResponse = {
  user: {
    id: string;
    email: string;
    role: string;
    tenantId: string;
  };
};

type State =
  | { status: 'loading' }
  | { status: 'no-token' }
  | { status: 'error'; message: string }
  | { status: 'ok'; me: MeResponse };

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const loadMe = async () => {
      try {
        const token = window.localStorage.getItem('doflow_token');

        if (!token) {
          if (!cancelled) setState({ status: 'no-token' });
          router.push('/login');
          return;
        }

        const res = await fetch(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        const text = await res.text();

        if (!res.ok) {
          if (!cancelled) {
            setState({
              status: 'error',
              message: text || 'Errore caricamento profilo',
            });
          }
          if (res.status === 401 || res.status === 403) {
            router.push('/login');
          }
          return;
        }

        const data = JSON.parse(text) as MeResponse;

        if (!cancelled) {
          setState({ status: 'ok', me: data });
        }
      } catch {
        if (!cancelled) {
          setState({ status: 'error', message: 'Errore di rete' });
        }
      }
    };

    void loadMe();
    return () => {
      cancelled = true;
    };
  }, [router]);

  // RENDER STATES

  if (state.status === 'loading') {
    return <Centered text="Caricamento dashboard..." />;
  }

  if (state.status === 'no-token') {
    return <Centered text="Nessun token trovato, reindirizzamento..." />;
  }

  if (state.status === 'error') {
    return (
      <Centered
        title="Errore Dashboard"
        text={state.message}
        error
      />
    );
  }

  // OK
  const { user } = state.me;
  const layoutRole = mapBackendRoleToLayout(user.role);

  return (
    <DashboardLayout role={layoutRole} userEmail={user.email}>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">DoFlow Dashboard</h1>

        <p className="text-sm text-zinc-400">
          Utente: <span className="font-mono">{user.email}</span>
        </p>

        <p className="text-sm text-zinc-400">
          Ruolo backend:{' '}
          <span className="font-mono">{user.role}</span> → UI:{' '}
          <span className="font-mono">{layoutRole}</span>
        </p>

        <p className="text-sm text-zinc-400">
          Tenant: <span className="font-mono">{user.tenantId}</span>
        </p>
      </div>
    </DashboardLayout>
  );
}

// helper minimale
function Centered({
  text,
  title,
  error,
}: {
  text: string;
  title?: string;
  error?: boolean;
}) {
  return (
    <main className="min-h-screen flex items-center justify-center bg-background text-foreground">
      <div className="text-center space-y-2">
        {title && <h1 className="text-xl font-semibold">{title}</h1>}
        <p className={`text-sm ${error ? 'text-red-400' : 'text-zinc-400'}`}>
          {text}
        </p>
      </div>
    </main>
  );
}
