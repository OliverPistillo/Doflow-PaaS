'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE =
  process.env.NEXT_PUBLIC_API_URL && process.env.NEXT_PUBLIC_API_URL.length > 0
    ? process.env.NEXT_PUBLIC_API_URL
    : '/api';

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
        setLoading(false);
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
          console.error('Errore /auth/me:', res.status, text);
          setError(text || 'Errore caricamento profilo');

          if (res.status === 401 || res.status === 403) {
            router.push('/login');
          }

          setLoading(false);
          return;
        }

        try {
          const data = JSON.parse(text) as MeResponse;
          setMe(data);
        } catch (e) {
          console.error('Errore parse JSON /auth/me:', e, text);
          setError('Risposta non valida dal server');
        }
      } catch (e) {
        console.error('Errore di rete /auth/me:', e);
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

  if (error && !me) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-black">
        <p className="text-sm text-red-400">
          Impossibile caricare i dati utente: {error}
        </p>
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

  // NIENTE DashboardLayout qui.
  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-zinc-100">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold">Doflow Dashboard (bare)</h1>
        <p className="text-sm text-zinc-400">
          Utente: <span className="font-mono">{me.email}</span>
        </p>
        <p className="text-sm text-zinc-400">
          Ruolo: <span className="font-mono">{me.role}</span> | Tenant:{' '}
          <span className="font-mono">{me.tenantId}</span>
        </p>
      </div>
    </main>
  );
}
