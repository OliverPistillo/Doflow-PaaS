'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/dashboard/layout';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

type MeResponse = {
  email: string;
  role: 'SUPER_ADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
  tenantId: string;
};

export default function DashboardPage() {
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadMe = async () => {
      const token =
        typeof window !== 'undefined'
          ? window.localStorage.getItem('doflow_token')
          : null;

      if (!token) {
        router.push('/login');
        return;
      }

      try {
        const res = await fetch(`${API_BASE}/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
          cache: 'no-store',
        });

        const text = await res.text();
        if (!res.ok) {
          setError(text || 'Errore caricamento profilo');
          if (res.status === 401 || res.status === 403) {
            router.push('/login');
          }
          setLoading(false);
          return;
        }

        const data = JSON.parse(text) as MeResponse;
        setMe(data);
      } catch {
        setError('Errore di rete');
      } finally {
        setLoading(false);
      }
    };

    void loadMe();
  }, [router]);

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-sm text-zinc-400">Caricamento dashboard...</p>
      </main>
    );
  }

  if (!me) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-sm text-red-400">
          Impossibile caricare i dati utente.
        </p>
      </main>
    );
  }

  return (
    <DashboardLayout role={me.role} userEmail={me.email}>
      {me.role === 'SUPER_ADMIN' && <SuperAdminDashboard tenantId={me.tenantId} />}
      {me.role === 'ADMIN' && <AdminDashboard tenantId={me.tenantId} />}
      {me.role === 'MANAGER' && <ManagerDashboard tenantId={me.tenantId} />}
      {me.role === 'USER' && <UserDashboard tenantId={me.tenantId} />}
    </DashboardLayout>
  );
}

function SuperAdminDashboard({ tenantId }: { tenantId: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard Super Admin</h1>
      <p className="text-sm text-zinc-400">
        Gestisci tenant, utenti globali, ruoli e configurazioni di sistema.
      </p>
      {/* Qui in futuro: card riassuntive, grafici usage, elenco tenants */}
    </div>
  );
}

function AdminDashboard({ tenantId }: { tenantId: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard Admin Tenant</h1>
      <p className="text-sm text-zinc-400">
        Gestisci utenti, ruoli e configurazioni per il tenant{' '}
        <span className="font-mono">{tenantId}</span>.
      </p>
    </div>
  );
}

function ManagerDashboard({ tenantId }: { tenantId: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">Dashboard Manager</h1>
      <p className="text-sm text-zinc-400">
        Vista progetti, team e carico di lavoro per il tuo tenant{' '}
        <span className="font-mono">{tenantId}</span>.
      </p>
    </div>
  );
}

function UserDashboard({ tenantId }: { tenantId: string }) {
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold">La mia Dashboard</h1>
      <p className="text-sm text-zinc-400">
        I tuoi task, attività recenti e notifiche per il tenant{' '}
        <span className="font-mono">{tenantId}</span>.
      </p>
    </div>
  );
}
