/* eslint-disable react-hooks/set-state-in-effect */
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

type LayoutRole = 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

type MeResponse = {
  user: {
    id: string;
    email: string;
    role: string; // es. "owner"
    tenantId: string;
  };
};

type State =
  | { status: 'loading' }
  | { status: 'no-token' }
  | { status: 'error'; message: string }
  | { status: 'ok'; me: MeResponse };

// Mappa i ruoli backend (es. "owner") ai ruoli accettati dal layout
function mapRoleToLayoutRole(role: string): LayoutRole {
  const r = role.toLowerCase();

  if (r === 'owner' || r === 'super_admin' || r === 'superadmin') {
    return 'SUPER_ADMIN';
  }

  if (r === 'admin') {
    return 'ADMIN';
  }

  if (r === 'manager') {
    return 'MANAGER';
  }

  // fallback per qualsiasi altro ruolo
  return 'USER';
}

export default function DashboardPage() {
  const router = useRouter();
  const [state, setState] = useState<State>({ status: 'loading' });

  useEffect(() => {
    let cancelled = false;

    const loadMe = async () => {
      try {
        const token = window.localStorage.getItem('doflow_token');

        if (!token) {
          if (!cancelled) {
            setState({ status: 'no-token' });
          }
          router.push('/login');
          return;
        }

        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        const text = await res.text();

        if (!res.ok) {
          console.error('Errore /auth/me:', res.status, text);

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

        let data: MeResponse;
        try {
          data = JSON.parse(text) as MeResponse;
        } catch (e) {
          console.error('Errore parse JSON /auth/me:', e, text);
          if (!cancelled) {
            setState({
              status: 'error',
              message: 'Risposta non valida dal server',
            });
          }
          return;
        }

        if (!cancelled) {
          setState({ status: 'ok', me: data });
        }
      } catch (e) {
        console.error('Errore di rete /auth/me:', e);
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

  // RENDER

  if (state.status === 'loading') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-zinc-100">
        <p className="text-sm text-zinc-400">Caricamento dashboard...</p>
      </main>
    );
  }

  if (state.status === 'no-token') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-zinc-100">
        <p className="text-sm text-zinc-400">
          Nessun token trovato, reindirizzamento al login...
        </p>
      </main>
    );
  }

  if (state.status === 'error') {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black text-zinc-100">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Errore Dashboard</h1>
          <p className="text-sm text-red-400">
            Impossibile caricare i dati utente:
          </p>
          <p className="text-xs text-zinc-500 whitespace-pre-wrap">
            {state.message}
          </p>
        </div>
      </main>
    );
  }

  // stato OK
  const { me } = state;
  const { user } = me;
  const layoutRole = mapRoleToLayoutRole(user.role);

  return (
    <DashboardLayout role={layoutRole} userEmail={user.email}>
      <div className="space-y-4">
        <h1 className="text-xl font-semibold">DoFlow Dashboard</h1>

        <p className="text-sm text-zinc-400">
          Utente: <span className="font-mono">{user.email}</span>
        </p>
        <p className="text-sm text-zinc-400">
          Ruolo backend:{' '}
          <span className="font-mono">{user.role}</span> → ruolo UI:{' '}
          <span className="font-mono">{layoutRole}</span>
        </p>
        <p className="text-sm text-zinc-400">
          Tenant: <span className="font-mono">{user.tenantId}</span>
        </p>

        <div className="mt-4 text-xs text-zinc-500">
          <p>
            Questa è la dashboard base. Da qui possiamo aggiungere le sezioni per
            SUPER_ADMIN / ADMIN / MANAGER / USER (tenants, utenti, progetti, ecc.).
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}
