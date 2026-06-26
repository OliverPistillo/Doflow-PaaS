// Percorso: apps/frontend/src/app/(tenant)/notifications/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Bell, CheckCheck, Info, AlertTriangle,
  XCircle, CheckCircle2, Megaphone, Eye, RefreshCw,
} from "lucide-react";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { useNotifications } from "@/hooks/useNotifications";
import {
  PageShell,
  PageHeader,
  LoadingState,
  EmptyState,
} from "@/components/ui/page-shell";
import { cn } from "@/lib/utils";

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

  const unreadCount = notifs.filter(n => !n.isRead).length;

  return (
    <PageShell>
      <PageHeader
        title="Notifiche"
        description={`${notifs.length} notifiche totali · ${unreadCount} da leggere`}
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={load}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            Aggiorna
          </Button>
        }
      />

      {loading ? (
        <LoadingState rows={6} />
      ) : notifs.length === 0 ? (
        <EmptyState
          title="Nessuna notifica"
          message="Il tuo centro notifiche è vuoto. Ti avviseremo quando ci saranno novità."
          icon={Bell}
          action={
            <Button variant="outline" onClick={load} className="gap-2">
              <RefreshCw className="h-4 w-4" />
              Controlla ora
            </Button>
          }
        />
      ) : (
        <div className="space-y-3 max-w-3xl animate-in fade-in slide-in-from-bottom-2 duration-500">
          {notifs.map(n => {
            const tc = TYPE_CONFIG[n.type] || TYPE_CONFIG.INFO;
            const IconComp = tc.icon;
            return (
              <div
                key={n.id}
                className={cn(
                  "df-glass-panel df-glass-panel-hover overflow-hidden transition-all duration-200",
                  !n.isRead ? "border-l-4" : "opacity-80"
                )}
                style={!n.isRead ? { borderLeftColor: tc.color } : undefined}
              >
                <CardContent className="p-4 flex items-start gap-4">
                  <div
                    className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `color-mix(in srgb, ${tc.color} 12%, transparent)`, color: tc.color }}
                  >
                    <IconComp className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h4 className={cn(
                        "font-bold text-[15px] leading-snug truncate",
                        n.isRead ? "text-muted-foreground" : "text-foreground"
                      )}>
                        {n.title}
                      </h4>
                      {!n.isRead && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                    </div>
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{n.message}</p>
                    <div className="flex items-center gap-2 mt-2">
                       <span className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground/60">
                        {new Date(n.createdAt).toLocaleString("it-IT", {
                          day: '2-digit', month: '2-digit', year: 'numeric',
                          hour: '2-digit', minute: '2-digit'
                        })}
                      </span>
                    </div>
                  </div>
                  {!n.isRead && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-9 w-9 shrink-0 hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => markRead(n.id)}
                          aria-label="Segna come letta"
                        >
                          <Eye className="h-4 w-4" aria-hidden="true" />
                          <span className="sr-only">Segna come letta</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="top">
                        Segna come letta
                      </TooltipContent>
                    </Tooltip>
                  )}
                </CardContent>
              </div>
            );
          })}
        </div>
      )}
    </PageShell>
  );
}
