'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export type HelloEvent = { type: 'hello'; payload: { tenantId: string; userId: string } };
export type HeartbeatEvent = { type: 'heartbeat'; timestamp: string };
export type NotificationEvent = {
  type: 'tenant_notification' | 'user_notification' | 'system_alert';
  channel: string;
  payload: Record<string, unknown>;
};
export type RealtimeEvent = HelloEvent | HeartbeatEvent | NotificationEvent;

interface UseNotificationsOptions {
  enabled?: boolean;
  onEvent?: (event: RealtimeEvent) => void;
}

function websocketUrl() {
  const configured = process.env.NEXT_PUBLIC_WS_URL?.trim();
  if (configured) return configured.replace(/^http:/, 'ws:').replace(/^https:/, 'wss:');
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

function eventId(event: RealtimeEvent) {
  if ('payload' in event && event.payload && typeof event.payload === 'object') {
    const value = (event.payload as Record<string, unknown>).eventId;
    return typeof value === 'string' ? value : null;
  }
  return null;
}

export function useNotifications(options: UseNotificationsOptions = {}) {
  const { enabled = true, onEvent } = options;
  const [events, setEvents] = useState<RealtimeEvent[]>([]);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const callbackRef = useRef(onEvent);
  const seenRef = useRef(new Set<string>());

  useEffect(() => { callbackRef.current = onEvent; }, [onEvent]);

  useEffect(() => {
    if (!enabled || typeof window === 'undefined') return;
    let disposed = false;
    let retry = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const connect = () => {
      if (disposed || !navigator.onLine) return;
      const ws = new WebSocket(websocketUrl());
      wsRef.current = ws;
      ws.onopen = () => { retry = 0; setConnected(true); setError(null); };
      ws.onmessage = (message) => {
        try {
          const event = JSON.parse(String(message.data)) as RealtimeEvent;
          if (event.type === 'heartbeat') return;
          const id = eventId(event);
          if (id && seenRef.current.has(id)) return;
          if (id) {
            seenRef.current.add(id);
            if (seenRef.current.size > 500) seenRef.current = new Set(Array.from(seenRef.current).slice(-250));
          }
          setEvents((previous) => [...previous, event].slice(-50));
          callbackRef.current?.(event);
        } catch {
          setError('Evento realtime non valido');
        }
      };
      ws.onerror = () => setError('Realtime temporaneamente non disponibile');
      ws.onclose = (event) => {
        setConnected(false);
        if (disposed) return;
        if (event.code === 4001 || event.code === 4002 || event.code === 4003) {
          setError(event.reason || 'Sessione realtime non valida');
          return;
        }
        const delay = Math.min(30_000, 1_000 * 2 ** retry++);
        timer = setTimeout(connect, delay + Math.floor(Math.random() * 250));
      };
    };
    const online = () => {
      if (!disposed && (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED)) connect();
    };
    window.addEventListener('online', online);
    connect();
    return () => {
      disposed = true;
      if (timer) clearTimeout(timer);
      window.removeEventListener('online', online);
      wsRef.current?.close(1000, 'component unmounted');
      wsRef.current = null;
    };
  }, [enabled]);

  const sendMessage = useCallback((data: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.send(JSON.stringify(data));
  }, []);

  return { events, connected, error, sendMessage };
}
