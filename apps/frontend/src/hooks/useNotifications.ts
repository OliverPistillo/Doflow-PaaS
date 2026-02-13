'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

export type HelloEvent = {
  type: 'hello';
  payload: { tenantId: string; userId: string };
};

// --- AGGIORNAMENTO v3.5: Supporto 'system_alert' ---
export type NotificationEvent = {
  type: 'tenant_notification' | 'user_notification' | 'system_alert';
  channel: string;
  payload: any;
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
    // Safety check: esegui solo lato client e se abilitato
    if (!enabled || typeof window === 'undefined') return;

    const token = window.localStorage.getItem('doflow_token');

    // 🚫 Zero Trust: Senza token non tentiamo nemmeno la connessione
    if (!token) {
      console.warn('[WS Hook] Token mancante. Connessione realtime saltata.');
      return;
    }

    // Costruzione URL dinamica e sicura
    const wsBase = process.env.NEXT_PUBLIC_WS_URL ?? 'ws://localhost:3001/ws';
    // Se l'URL base è relativo o non ha protocollo, lo aggiustiamo
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    let finalUrl = wsBase;
    
    if (!wsBase.startsWith('ws')) {
        finalUrl = `${protocol}//${window.location.hostname}${wsBase.startsWith(':') ? wsBase : ':3001/ws'}`;
    }

    const url = `${finalUrl}?token=${encodeURIComponent(token)}`;
    
    console.log(`[WS Hook] Connecting to ${finalUrl}...`);

    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('[WS Hook] Connected 🟢');
      setConnected(true);
      setError(null);
    };

    ws.onclose = (ev) => {
      console.log('[WS Hook] Disconnected 🔴', ev.code, ev.reason);
      setConnected(false);
      // Codici 4xxx sono errori applicativi (es. Token scaduto)
      if (ev.code >= 4000) {
        setError(`Disconnesso: ${ev.reason || 'Sessione scaduta'}`);
      }
    };

    ws.onerror = (ev) => {
      console.error('[WS Hook] Error ⚠️', ev);
      setError('Errore di connessione WebSocket');
    };

    ws.onmessage = (msg) => {
      try {
        const data = JSON.parse(msg.data as string) as RealtimeEvent;
        
        // In Dev logghiamo tutto, in Prod solo errori
        if (process.env.NODE_ENV === 'development') {
            console.log('[WS] <', data.type);
        }

        setEvents((prev) => {
            // Manteniamo solo gli ultimi 50 eventi per non saturare la memoria del browser
            const newEvents = [...prev, data];
            return newEvents.slice(-50);
        });

        if (onEvent) {
          onEvent(data);
        }
      } catch (e) {
        console.warn('[WS Hook] Received non-JSON message', msg.data);
      }
    };

    // Cleanup alla distruzione del componente
    return () => {
      if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
        ws.close();
      }
      wsRef.current = null;
    };
  }, [enabled, onEvent]);

  // Utility per inviare messaggi (es. Ping manuale)
  const sendMessage = useCallback((data: any) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify(data));
    } else {
        console.warn('[WS Hook] Impossibile inviare: Socket non connesso');
    }
  }, []);

  return {
    events,
    connected,
    error,
    sendMessage
  };
}