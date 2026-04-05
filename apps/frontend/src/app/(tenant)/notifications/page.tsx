// Percorso: apps/frontend/src/app/(tenant)/notifications/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, Bell, CheckCheck, Info, AlertTriangle,
  XCircle, CheckCircle2, Megaphone, Eye,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";

type Notification = {
  id: string; title: string; message: string; type: string;
  channel: string; isRead: boolean; actionUrl: string | null;
  sender: string; createdAt: string;
};

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<{ className?: string }>; color: string }> = {
  INFO:      { icon: Info,          color: "hsl(210 70% 55%)" },
  WARNING:   { icon: AlertTriangle, color: "hsl(40 80% 55%)" },
  ERROR:     { icon: XCircle,       color: "hsl(0 70% 55%)" },
  SUCCESS:   { icon: CheckCircle2,  color: "hsl(150 60% 45%)" },
  BROADCAST: { icon: Megaphone,     color: "hsl(280 60% 55%)" },
};

export default function NotificationsPage() {
  const { toast } = useToast();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch<Notification[]>("/tenant/self-service/notifications");
      setNotifs(Array.isArray(res) ? res : []);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  // 🔗 WebSocket: aggiorna feed in tempo reale
  useNotifications({
    onEvent: (event) => {
      if (event.type === "tenant_notification" || event.type === "system_alert") {
        const payload = (event as any).payload;
        if (payload?.type === "platform_notification" && payload?.payload) {
          const p = payload.payload;
          const newNotif: Notification = {
            id: p.id || `ws-${Date.now()}`,
            title: p.title || "Nuova notifica",
            message: p.message || "",
            type: p.notificationType || "INFO",
            channel: "REALTIME",
            isRead: false,
            actionUrl: p.actionUrl || null,
            sender: "SYSTEM",
            createdAt: p.createdAt || new Date().toISOString(),
          };
          setNotifs(prev => [newNotif, ...prev]);
        }
      }
    },
  });

  const markRead = async (id: string) => {
    try {
      await apiFetch(`/tenant/self-service/notifications/${id}/read`, { method: "PATCH" });
      setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    } catch { /* silent */ }
  };

  if (loading) {
    return (
      <div className="flex-1 p-4 md:p-6 flex justify-center items-center py-32">
        <Loader2 className="animate-spin text-primary h-10 w-10" />
      </div>
    );
  }

  const unread = notifs.filter(n => !n.isRead).length;

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2"><Bell className="h-6 w-6 text-primary" />Notifiche</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{notifs.length} notifiche · {unread} non lette</p>
        </div>
      </div>

      <div className="space-y-2 max-w-3xl">
        {notifs.map(n => {
          const tc = TYPE_CONFIG[n.type] || TYPE_CONFIG.INFO;
          const IconComp = tc.icon;
          return (
            <Card key={n.id} className={`transition-all duration-200 ${!n.isRead ? "border-l-2" : "opacity-70"}`}
              style={!n.isRead ? { borderLeftColor: tc.color } : undefined}>
              <CardContent className="p-4 flex items-start gap-3">
                <div className="h-9 w-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                  style={{ backgroundColor: `color-mix(in srgb, ${tc.color} 12%, transparent)`, color: tc.color }}>
                  <IconComp className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className={`font-semibold text-sm ${n.isRead ? "text-muted-foreground" : "text-foreground"}`}>{n.title}</h4>
                    {!n.isRead && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                  <span className="text-[10px] text-muted-foreground/60 mt-1 block">{new Date(n.createdAt).toLocaleString("it-IT")}</span>
                </div>
                {!n.isRead && (
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => markRead(n.id)}>
                    <Eye className="h-4 w-4 text-muted-foreground" />
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
        {notifs.length === 0 && (
          <Card><CardContent className="py-16 text-center text-muted-foreground">
            <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p className="font-medium">Nessuna notifica</p>
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
