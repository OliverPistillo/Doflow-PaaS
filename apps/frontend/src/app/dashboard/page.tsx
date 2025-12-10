'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API_BASE = process.env.NEXT_PUBLIC_API_URL || '/api';

type MeResponse = unknown; // <-- per ora lasciamo unknown, così non litiga con TS

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
          console.log('ME RESPONSE RAW:', data);
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

  // stato OK → mostriamo il JSON grezzo
  const { me } = state;

  return (
    <main className="min-h-screen flex items-center justify-center bg-black text-zinc-100">
      <div className="space-y-3 text-center max-w-lg">
        <h1 className="text-2xl font-semibold">DoFlow Dashboard (autenticata)</h1>

        <div className="text-left text-xs bg-zinc-900/60 rounded-md p-3 font-mono whitespace-pre-wrap break-all">
          <div className="text-zinc-500 mb-1">Raw JSON /auth/me:</div>
          {JSON.stringify(me, null, 2)}
        </div>

        <p className="text-xs text-zinc-500 mt-2">
          Sopra vedi ESATTAMENTE il JSON che arriva da <code>/auth/me</code>.
          Copialo e incollalo qui in chat, così ti preparo il tipo giusto e
          reintroduciamo il layout.
        </p>
      </div>
    </main>
  );
}
