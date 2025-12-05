'use client';

import { useEffect, useRef, useState } from 'react';

export type HelloEvent = {
  type: 'hello';
  payload: { tenantId: string; userId: string };
};

export type NotificationEvent = {
  type: 'tenant_notification' | 'user_notification';
  channel: string;
  payload: unknown;
};

export type RealtimeEvent = HelloEvent | NotificationEvent;

interface UseNotificationsOptions {
  enabled?: boolean;
  onEvent?: (event: RealtimeEvent) => void;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, onEvent } = options;

  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!enabled) return;

    const token =
      typeof window !== 'undefined'
        ? window.localStorage.getItem('doflow_token')
        : null;

    // 🚫 niente setState qui: se non c'è token, semplicemente non connettiamo il WS
    if (!token) {
      console.warn(
        '[WS hook] nessun token JWT trovato (doflow_token). WebSocket disattivato.',
      );
      return;
    }

    const wsBase =
      process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';
    const url = `${wsBase}?token=${encodeURIComponent(token)}`;

    console.log('[WS hook] stored token from localStorage =', token);
    console.log('[WS hook] connecting to', url);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS hook] WebSocket open');
      setConnected(true);
      setError(null);
    };

    ws.onclose = (ev) => {
      console.log('[WS hook] WebSocket close', ev.code, ev.reason);
      setConnected(false);
      if (ev.code >= 4000) {
        setError(`Connessione chiusa (${ev.code}): ${ev.reason}`);
      }
    };

    ws.onerror = (ev) => {
      console.error('[WS hook] WebSocket error', ev);
      setError('Errore WebSocket');
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data as string) as RealtimeEvent;
        console.log('[WS hook] message', data);
        setEvents((prev) => [...prev.slice(-99), data]);
        if (onEvent) {
          onEvent(data);
        }
      } catch (e) {
        console.warn('[WS hook] non-JSON message', msg.data, e);
      }
    };

    return () => {
      ws.close();
      wsRef.current = null;
    };
  }, [enabled, onEvent]);

  return {
    events,
    connected,
    error,
  };
}
