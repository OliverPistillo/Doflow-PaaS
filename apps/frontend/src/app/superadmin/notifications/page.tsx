// Percorso: apps/frontend/src/app/superadmin/notifications/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, RefreshCw, Search, Plus, Bell, BellOff,
  CheckCircle2, AlertTriangle, XCircle, Info, Megaphone,
  MoreHorizontal, Trash2, CheckCheck, Eye, Send,
  Filter, Mail, Globe,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type Notification = {
  id: string;
  title: string;
  message: string;
  type: string;
  channel: string;
  targetTenantId: string | null;
  targetUserEmail: string | null;
  sender: string;
  isRead: boolean;
  readAt: string | null;
  actionUrl: string | null;
  createdAt: string;
};

type NotifStats = {
  total: number;
  unread: number;
  todayCount: number;
  byType: { type: string; count: number }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }> = {
  INFO:      { label: "Info",       icon: Info,           color: "hsl(210 70% 55%)", bg: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  WARNING:   { label: "Warning",    icon: AlertTriangle,  color: "hsl(40 80% 55%)",  bg: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  ERROR:     { label: "Errore",     icon: XCircle,        color: "hsl(0 70% 55%)",   bg: "bg-red-500/10 text-red-600 border-red-500/20" },
  SUCCESS:   { label: "Successo",   icon: CheckCircle2,   color: "hsl(150 60% 45%)", bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  BROADCAST: { label: "Broadcast",  icon: Megaphone,      color: "hsl(280 60% 55%)", bg: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
};

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ title, value, icon: Icon, color }: {
  title: string; value: string | number;
  icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <Card className="glass-card transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl overflow-hidden relative">
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500" style={{ backgroundColor: color }} />
      <CardContent className="p-6 relative z-10 flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-foreground mt-3 tracking-tight tabular-nums">{value}</h3>
        </div>
        <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-muted/50 transition-all duration-300 group-hover:scale-110 shadow-sm"
          style={{ color, border: `1px solid color-mix(in srgb, ${color} 20%, transparent)` }}>
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const { toast } = useToast();
  const [notifs, setNotifs] = useState<Notification[]>([]);
  const [stats, setStats] = useState<NotifStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("ALL");
  const [filterRead, setFilterRead] = useState("ALL");
  const [createDialog, setCreateDialog] = useState(false);
  const [broadcastDialog, setBroadcastDialog] = useState(false);
  const [formData, setFormData] = useState({ title: "", message: "", type: "INFO", channel: "PLATFORM", targetTenantId: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterType !== "ALL") params.set("type", filterType);
      if (filterRead !== "ALL") params.set("isRead", filterRead);
      if (search) params.set("search", search);

      const [n, s] = await Promise.all([
        apiFetch<Notification[]>(`/superadmin/notifications?${params}`),
        apiFetch<NotifStats>("/superadmin/notifications/stats"),
      ]);
      setNotifs(Array.isArray(n) ? n : []);
      setStats(s);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, filterType, filterRead, search]);

  useEffect(() => { load(); }, [load]);

  const handleMarkRead = async (id: string) => {
    try {
      await apiFetch(`/superadmin/notifications/${id}/read`, { method: "PATCH" });
      await load();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await apiFetch("/superadmin/notifications/read-all", { method: "PATCH" });
      await load();
      toast({ title: "Tutte segnate come lette" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/superadmin/notifications/${id}`, { method: "DELETE" });
      await load();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const handleCreate = async () => {
    setSaving(true);
    try {
      await apiFetch("/superadmin/notifications", { method: "POST", body: JSON.stringify(formData) });
      setCreateDialog(false);
      setFormData({ title: "", message: "", type: "INFO", channel: "PLATFORM", targetTenantId: "" });
      await load();
      toast({ title: "Notifica inviata" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleBroadcast = async () => {
    setSaving(true);
    try {
      await apiFetch("/superadmin/notifications/broadcast", {
        method: "POST",
        body: JSON.stringify({ title: formData.title, message: formData.message, type: formData.type }),
      });
      setBroadcastDialog(false);
      setFormData({ title: "", message: "", type: "INFO", channel: "PLATFORM", targetTenantId: "" });
      await load();
      toast({ title: "Broadcast inviato a tutti i tenant" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Caricamento notifiche...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <KpiCard title="Totali" value={stats.total} icon={Bell} color="hsl(var(--chart-1))" />
          <KpiCard title="Non lette" value={stats.unread} icon={BellOff} color={stats.unread > 0 ? "hsl(0 70% 55%)" : "hsl(var(--chart-2))"} />
          <KpiCard title="Oggi" value={stats.todayCount} icon={Megaphone} color="hsl(var(--chart-3))" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca notifiche..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutti i tipi</SelectItem>
              {Object.entries(TYPE_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterRead} onValueChange={setFilterRead}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutte</SelectItem>
              <SelectItem value="false">Non lette</SelectItem>
              <SelectItem value="true">Lette</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          {stats && stats.unread > 0 && (
            <Button variant="outline" size="sm" onClick={handleMarkAllRead}><CheckCheck className="h-4 w-4 mr-2" />Segna tutte lette</Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setBroadcastDialog(true)}><Megaphone className="h-4 w-4 mr-2" />Broadcast</Button>
          <Button size="sm" onClick={() => setCreateDialog(true)}><Plus className="h-4 w-4 mr-2" />Nuova</Button>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Notification List */}
      <div className="space-y-2">
        {notifs.length === 0 ? (
          <Card className="glass-card">
            <CardContent className="py-16 text-center text-muted-foreground">
              <Bell className="h-10 w-10 mx-auto mb-3 opacity-40" />
              <p className="font-medium">Nessuna notifica</p>
            </CardContent>
          </Card>
        ) : (
          notifs.map(n => {
            const tc = TYPE_CONFIG[n.type] || TYPE_CONFIG.INFO;
            const IconComp = tc.icon;
            return (
              <Card key={n.id} className={`glass-card group hover:-translate-y-0.5 transition-all duration-200 ${!n.isRead ? "border-l-2" : ""}`}
                style={!n.isRead ? { borderLeftColor: tc.color } : undefined}>
                <CardContent className="p-4 flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                    style={{ backgroundColor: `color-mix(in srgb, ${tc.color} 12%, transparent)`, color: tc.color }}>
                    <IconComp className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className={`font-bold text-sm ${n.isRead ? "text-muted-foreground" : "text-foreground"}`}>{n.title}</h4>
                      <Badge variant="outline" className={`text-[10px] ${tc.bg}`}>{tc.label}</Badge>
                      {!n.isRead && <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />}
                      {n.targetTenantId && <Badge variant="outline" className="text-[10px]">Tenant: {n.targetTenantId.slice(0, 8)}...</Badge>}
                      {n.channel === "ALL" && <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-600 border-violet-500/20">Broadcast</Badge>}
                    </div>
                    <p className={`text-xs mt-1 line-clamp-2 ${n.isRead ? "text-muted-foreground/70" : "text-muted-foreground"}`}>{n.message}</p>
                    <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground/60">
                      <span>{new Date(n.createdAt).toLocaleString("it-IT")}</span>
                      <span>·</span>
                      <span>{n.sender}</span>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {!n.isRead && (
                        <DropdownMenuItem onClick={() => handleMarkRead(n.id)}>
                          <Eye className="h-4 w-4 mr-2" />Segna come letta
                        </DropdownMenuItem>
                      )}
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(n.id)}>
                        <Trash2 className="h-4 w-4 mr-2" />Elimina
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Create Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuova Notifica</DialogTitle>
            <DialogDescription>Invia una notifica a un tenant o utente specifico.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Titolo *</Label>
              <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Aggiornamento piattaforma" />
            </div>
            <div>
              <Label>Messaggio *</Label>
              <Textarea value={formData.message} onChange={e => setFormData(p => ({ ...p, message: e.target.value }))} rows={3} placeholder="Descrivi la notifica..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tipo</Label>
                <Select value={formData.type} onValueChange={v => setFormData(p => ({ ...p, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Canale</Label>
                <Select value={formData.channel} onValueChange={v => setFormData(p => ({ ...p, channel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PLATFORM">Solo piattaforma</SelectItem>
                    <SelectItem value="REALTIME">Push real-time</SelectItem>
                    <SelectItem value="EMAIL">Email</SelectItem>
                    <SelectItem value="ALL">Tutti i canali</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Tenant ID (vuoto = globale)</Label>
              <Input value={formData.targetTenantId} onChange={e => setFormData(p => ({ ...p, targetTenantId: e.target.value }))} placeholder="UUID tenant o lascia vuoto" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Annulla</Button>
            <Button onClick={handleCreate} disabled={saving || !formData.title || !formData.message}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}Invia
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Broadcast Dialog */}
      <Dialog open={broadcastDialog} onOpenChange={setBroadcastDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Megaphone className="h-5 w-5 text-primary" />Broadcast Globale</DialogTitle>
            <DialogDescription>Invia un messaggio a tutti i tenant attivi contemporaneamente.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Titolo *</Label>
              <Input value={formData.title} onChange={e => setFormData(p => ({ ...p, title: e.target.value }))} placeholder="Manutenzione programmata" />
            </div>
            <div>
              <Label>Messaggio *</Label>
              <Textarea value={formData.message} onChange={e => setFormData(p => ({ ...p, message: e.target.value }))} rows={4} placeholder="Il messaggio che tutti i tenant riceveranno..." />
            </div>
            <div>
              <Label>Tipo</Label>
              <Select value={formData.type} onValueChange={v => setFormData(p => ({ ...p, type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="INFO">Info</SelectItem>
                  <SelectItem value="WARNING">Warning</SelectItem>
                  <SelectItem value="SUCCESS">Successo</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastDialog(false)}>Annulla</Button>
            <Button onClick={handleBroadcast} disabled={saving || !formData.title || !formData.message}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Megaphone className="h-4 w-4 mr-2" />}Invia a tutti
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
