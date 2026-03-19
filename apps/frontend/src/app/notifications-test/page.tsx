'use client';

import { useState } from 'react';
import { useNotifications } from '@/hooks/useNotifications';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? '/api';

export default function NotificationsTestPage() {
  const { events, connected, error } = useNotifications();
  const [message, setMessage] = useState('Ping realtime da Doflow');

  const sendTenantPing = async () => {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('doflow_token')
        : null;

    if (!token) {
      alert('Nessun token, effettua login prima.');
      return;
    }

    await fetch(`${API_BASE}/realtime-test/tenant`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });
  };

  const sendUserPing = async () => {
    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('doflow_token')
        : null;

    if (!token) {
      alert('Nessun token, effettua login prima.');
      return;
    }

    await fetch(`${API_BASE}/realtime-test/user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ message }),
    });
  };

  return (
    <main className="min-h-screen flex flex-col items-center p-6">
      <div className="w-full max-w-3xl flex flex-col gap-4">
        <header className="border-b border-zinc-800 pb-4 mb-2 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">
              Test Notifiche Realtime (Redis + WS)
            </h1>
            <p className="text-sm text-zinc-400">
              Stato WebSocket:{' '}
              <span
                className={
                  connected ? 'text-green-400' : 'text-red-400'
                }
              >
                {connected ? 'connesso' : 'disconnesso'}
              </span>
            </p>
          </div>
        </header>

        {error && (
          <div className="text-sm text-red-400 border border-red-500/40 rounded px-3 py-2">
            {error}
          </div>
        )}

        <section className="border rounded-lg p-4 flex flex-col gap-3">
          <h2 className="text-lg font-semibold">Invia ping di test</h2>
          <input
            className="border border-zinc-700 rounded px-3 py-2 text-sm bg-transparent"
            placeholder="Messaggio di test"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              onClick={sendTenantPing}
              className="px-4 py-2 text-sm rounded bg-zinc-900 border border-zinc-700 hover:bg-zinc-800"
            >
              Ping TENANT
            </button>
            <button
              onClick={sendUserPing}
              className="px-4 py-2 text-sm rounded bg-zinc-900 border border-zinc-700 hover:bg-zinc-800"
            >
              Ping USER
            </button>
          </div>
        </section>

        <section className="border rounded-lg p-4">
          <h2 className="text-lg font-semibold mb-2">Eventi ricevuti</h2>
          {events.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Nessun evento ancora ricevuto.
            </p>
          ) : (
            <ul className="flex flex-col gap-2 text-xs font-mono bg-black/40 rounded p-2 max-h-80 overflow-auto">
              {events
                .slice()
                .reverse()
                .map((ev, idx) => (
                  <li
                    key={idx}
                    className="border border-zinc-800 rounded px-2 py-1"
                  >
                    {JSON.stringify(ev)}
                  </li>
                ))}
            </ul>
          )}
        </section>
      </div>
    </main>
  );
}
