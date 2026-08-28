'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  archiveTenantNotification,
  getTenantNotificationSummary,
  listTenantNotifications,
  markAllTenantNotificationsRead,
  markTenantNotificationRead,
  markTenantNotificationUnread,
  markTenantNotificationsSeen,
  type NotificationSummary,
  type TenantNotification,
} from '@/lib/tenant-notifications-api';
import { mapTenantNotifications } from '@/lib/doflow-notifications';
import { useNotifications, type RealtimeEvent } from '@/hooks/useNotifications';

const EMPTY_SUMMARY: NotificationSummary = {
  newNotifications: 0,
  unreadNotifications: 0,
  urgentNotifications: 0,
  taskOverdueNotifications: 0,
  assignedTaskNotifications: 0,
  financeNotifications: 0,
  todayDigestAvailable: false,
};

export function useDoflowNotifications() {
  const [records, setRecords] = useState<TenantNotification[]>([]);
  const [summary, setSummary] = useState<NotificationSummary>(EMPTY_SUMMARY);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reloadSequence = useRef(0);
  const markSeenPending = useRef(false);

  const reload = useCallback(async () => {
    const requestId = ++reloadSequence.current;
    try {
      const [list, nextSummary] = await Promise.all([
        listTenantNotifications({ limit: 100, sortBy: 'created_at', sortDir: 'desc' }),
        getTenantNotificationSummary(),
      ]);
      if (requestId !== reloadSequence.current) return;
      setRecords(list.items || []);
      if (!markSeenPending.current) setSummary(nextSummary);
      setError(null);
    } catch (cause) {
      if (requestId !== reloadSequence.current) return;
      setError(cause instanceof Error ? cause.message : 'Notifiche non disponibili');
    } finally {
      if (requestId === reloadSequence.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void reload(); }, 0);
    return () => window.clearTimeout(timer);
  }, [reload]);
  const onRealtime = useCallback((event: RealtimeEvent) => {
    if (event.type === 'user_notification' || event.type === 'tenant_notification') void reload();
  }, [reload]);
  const realtime = useNotifications({ onEvent: onRealtime });

  const optimistic = useCallback(async (
    transform: (current: TenantNotification[]) => TenantNotification[],
    request: () => Promise<unknown>,
  ) => {
    const previous = records;
    setRecords(transform(previous));
    try {
      await request();
      await reload();
    } catch (cause) {
      setRecords(previous);
      setError(cause instanceof Error ? cause.message : 'Aggiornamento notifica non riuscito');
      throw cause;
    }
  }, [records, reload]);

  const markRead = useCallback((id: string, read: boolean) => optimistic(
    (current) => current.map((item) => item.id === id ? { ...item, status: read ? 'read' : 'unread' } : item),
    () => read ? markTenantNotificationRead(id) : markTenantNotificationUnread(id),
  ), [optimistic]);
  const archive = useCallback((id: string) => optimistic(
    (current) => current.map((item) => item.id === id ? { ...item, status: 'archived' } : item),
    () => archiveTenantNotification(id),
  ), [optimistic]);
  const markAllRead = useCallback(() => optimistic(
    (current) => current.map((item) => item.status === 'unread' ? { ...item, status: 'read' } : item),
    markAllTenantNotificationsRead,
  ), [optimistic]);
  const markSeen = useCallback(async () => {
    if (markSeenPending.current) return;
    markSeenPending.current = true;
    reloadSequence.current += 1;
    const previous = summary;
    setSummary((current) => ({ ...current, newNotifications: 0 }));
    try {
      await markTenantNotificationsSeen();
    } catch (cause) {
      markSeenPending.current = false;
      reloadSequence.current += 1;
      setSummary(previous);
      setError(cause instanceof Error ? cause.message : 'Stato notifiche non aggiornato');
      return;
    }
    markSeenPending.current = false;
    await reload();
  }, [reload, summary]);

  return {
    notifications: mapTenantNotifications(records), summary, loading, error, reload,
    markRead, archive, markAllRead, markSeen, connected: realtime.connected, realtimeError: realtime.error,
  };
}
