// Percorso: apps/frontend/src/app/superadmin/tickets/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, RefreshCw, Search, Plus, MoreHorizontal,
  Ticket, Clock, CheckCircle2, AlertTriangle, XCircle,
  MessageSquare, Send, Shield, Timer, BarChart3,
  Pencil, Trash2, ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuSeparator, DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/ui/export-button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Reply = { author: string; message: string; timestamp: string; isInternal: boolean };

type TicketRow = {
  id: string;
  ticketCode: string;
  subject: string;
  description: string;
  category: string;
  priority: string;
  status: string;
  tenantId: string;
  tenantName: string | null;
  reporterEmail: string;
  assignedTo: string | null;
  replies: Reply[];
  slaHours: number | null;
  resolvedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type TicketStats = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  closed: number;
  avgResolutionHours: number;
  slaBreached: number;
  slaCompliance: number;
  byPriority: { priority: string; count: number }[];
  byCategory: { category: string; count: number }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  OPEN:          { label: "Aperto",        color: "hsl(210 70% 55%)", bg: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  IN_PROGRESS:   { label: "In corso",      color: "hsl(280 60% 55%)", bg: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  WAITING_REPLY: { label: "Attesa risposta",color: "hsl(40 80% 55%)",  bg: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  RESOLVED:      { label: "Risolto",       color: "hsl(150 60% 45%)", bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  CLOSED:        { label: "Chiuso",        color: "hsl(var(--muted-foreground))", bg: "bg-muted text-muted-foreground border-border" },
};

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  LOW:      { label: "Bassa",    color: "hsl(210 30% 60%)", bg: "bg-slate-500/10 text-slate-500 border-slate-500/20" },
  MEDIUM:   { label: "Media",    color: "hsl(40 80% 55%)",  bg: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  HIGH:     { label: "Alta",     color: "hsl(20 80% 55%)",  bg: "bg-orange-500/10 text-orange-600 border-orange-500/20" },
  CRITICAL: { label: "Critica",  color: "hsl(0 70% 55%)",   bg: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const CATEGORY_LABELS: Record<string, string> = {
  BUG: "Bug", FEATURE_REQUEST: "Feature Request", BILLING: "Fatturazione",
  ACCESS: "Accesso", PERFORMANCE: "Performance", GENERAL: "Generale",
};

// ─── KpiCard ──────────────────────────────────────────────────────────────────

function KpiCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string;
  icon: React.ComponentType<{ className?: string }>; color: string;
}) {
  return (
    <Card className="glass-card transition-all duration-300 group hover:-translate-y-1 hover:shadow-2xl overflow-hidden relative">
      <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20 blur-2xl group-hover:opacity-40 transition-opacity duration-500" style={{ backgroundColor: color }} />
      <CardContent className="p-6 relative z-10 flex justify-between items-start">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">{title}</p>
          <h3 className="text-3xl font-black text-foreground mt-3 tracking-tight tabular-nums">{value}</h3>
          {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
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

export default function TicketsPage() {
  const { toast } = useToast();
  const [tickets, setTickets] = useState<TicketRow[]>([]);
  const [stats, setStats] = useState<TicketStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [filterPriority, setFilterPriority] = useState("ALL");
  const [createDialog, setCreateDialog] = useState(false);
  const [detailSheet, setDetailSheet] = useState<TicketRow | null>(null);
  const [replyText, setReplyText] = useState("");
  const [replyInternal, setReplyInternal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    subject: "", description: "", category: "GENERAL", priority: "MEDIUM",
    tenantId: "", tenantName: "", reporterEmail: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterPriority !== "ALL") params.set("priority", filterPriority);
      if (search) params.set("search", search);

      const [t, s] = await Promise.all([
        apiFetch<TicketRow[]>(`/superadmin/tickets?${params}`),
        apiFetch<TicketStats>("/superadmin/tickets/stats"),
      ]);
      setTickets(Array.isArray(t) ? t : []);
      setStats(s);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, filterStatus, filterPriority, search]);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async () => {
    setSaving(true);
    try {
      await apiFetch("/superadmin/tickets", { method: "POST", body: JSON.stringify(formData) });
      setCreateDialog(false);
      setFormData({ subject: "", description: "", category: "GENERAL", priority: "MEDIUM", tenantId: "", tenantName: "", reporterEmail: "" });
      await load();
      toast({ title: "Ticket creato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiFetch(`/superadmin/tickets/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) });
      await load();
      if (detailSheet?.id === id) {
        const updated = await apiFetch<TicketRow>(`/superadmin/tickets/${id}`);
        setDetailSheet(updated);
      }
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const handleReply = async () => {
    if (!detailSheet || !replyText.trim()) return;
    setSaving(true);
    try {
      await apiFetch(`/superadmin/tickets/${detailSheet.id}/reply`, {
        method: "POST",
        body: JSON.stringify({ author: "superadmin", message: replyText, isInternal: replyInternal }),
      });
      setReplyText("");
      const updated = await apiFetch<TicketRow>(`/superadmin/tickets/${detailSheet.id}`);
      setDetailSheet(updated);
      await load();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/superadmin/tickets/${id}`, { method: "DELETE" });
      setDetailSheet(null);
      await load();
      toast({ title: "Ticket eliminato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const getSlaStatus = (ticket: TicketRow) => {
    if (!ticket.slaHours || ticket.status === "RESOLVED" || ticket.status === "CLOSED") return null;
    const hoursOpen = (Date.now() - new Date(ticket.createdAt).getTime()) / (1000 * 60 * 60);
    const pct = Math.min((hoursOpen / ticket.slaHours) * 100, 100);
    return { hoursOpen: Math.round(hoursOpen * 10) / 10, pct, breached: hoursOpen > ticket.slaHours };
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Caricamento ticket...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          <KpiCard title="Totali" value={stats.total} icon={Ticket} color="hsl(var(--chart-1))" />
          <KpiCard title="Aperti" value={stats.open + stats.inProgress} sub={`${stats.open} nuovi, ${stats.inProgress} in corso`} icon={Clock} color="hsl(var(--chart-2))" />
          <KpiCard title="Risolti" value={stats.resolved} icon={CheckCircle2} color="hsl(150 60% 45%)" />
          <KpiCard title="Tempo Medio" value={`${stats.avgResolutionHours}h`} icon={Timer} color="hsl(var(--chart-4))" />
          <KpiCard title="SLA Compliance" value={`${stats.slaCompliance}%`} sub={`${stats.slaBreached} violazioni`} icon={Shield} color={stats.slaCompliance >= 90 ? "hsl(150 60% 45%)" : "hsl(0 70% 55%)"} />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca ticket..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutti gli stati</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterPriority} onValueChange={setFilterPriority}>
            <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutte</SelectItem>
              {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <ExportButton entity="tickets" />
          <Button size="sm" onClick={() => setCreateDialog(true)}><Plus className="h-4 w-4 mr-2" />Nuovo Ticket</Button>
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* Ticket List */}
      <div className="space-y-2">
        {tickets.length === 0 ? (
          <Card className="glass-card"><CardContent className="py-16 text-center text-muted-foreground">
            <Ticket className="h-10 w-10 mx-auto mb-3 opacity-40" /><p className="font-medium">Nessun ticket</p>
          </CardContent></Card>
        ) : (
          tickets.map(t => {
            const sc = STATUS_CONFIG[t.status] || STATUS_CONFIG.OPEN;
            const pc = PRIORITY_CONFIG[t.priority] || PRIORITY_CONFIG.MEDIUM;
            const sla = getSlaStatus(t);
            return (
              <Card key={t.id} className="glass-card group hover:-translate-y-0.5 transition-all duration-200 cursor-pointer"
                onClick={() => { setDetailSheet(t); setReplyText(""); }}>
                <CardContent className="p-4 flex items-center gap-4">
                  <div className="shrink-0 text-center">
                    <p className="text-xs font-mono font-bold text-primary">{t.ticketCode}</p>
                    <Badge variant="outline" className={`text-[9px] mt-1 ${pc.bg}`}>{pc.label}</Badge>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="font-bold text-foreground text-sm truncate">{t.subject}</h4>
                      <Badge variant="outline" className={`text-[10px] ${sc.bg}`}>{sc.label}</Badge>
                      <Badge variant="outline" className="text-[10px]">{CATEGORY_LABELS[t.category] || t.category}</Badge>
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      <span>{t.tenantName || t.tenantId.slice(0, 8)}</span>
                      <span>·</span>
                      <span>{t.reporterEmail}</span>
                      {t.replies.length > 0 && (
                        <span className="flex items-center gap-1"><MessageSquare className="h-3 w-3" />{t.replies.length}</span>
                      )}
                    </div>
                  </div>
                  {sla && (
                    <div className="shrink-0 w-20 text-right">
                      <p className={`text-[10px] font-bold ${sla.breached ? "text-red-500" : "text-muted-foreground"}`}>
                        {sla.hoursOpen}h / {t.slaHours}h
                      </p>
                      <Progress value={sla.pct} className={`h-1.5 mt-1 ${sla.breached ? "[&>div]:bg-red-500" : ""}`} />
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground tabular-nums shrink-0 hidden sm:block">
                    {new Date(t.createdAt).toLocaleDateString("it-IT")}
                  </span>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                        onClick={e => e.stopPropagation()}>
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" onClick={e => e.stopPropagation()}>
                      <DropdownMenuLabel>Cambia stato</DropdownMenuLabel>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <DropdownMenuItem key={k} onClick={() => handleStatusChange(t.id, k)} disabled={t.status === k}>
                          <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: v.color }} />{v.label}
                        </DropdownMenuItem>
                      ))}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(t.id)}>
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

      {/* Detail Sheet */}
      <Sheet open={!!detailSheet} onOpenChange={o => { if (!o) setDetailSheet(null); }}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {detailSheet && (
            <>
              <SheetHeader>
                <SheetTitle className="flex items-center gap-2">
                  <span className="text-primary font-mono">{detailSheet.ticketCode}</span>
                  <Badge variant="outline" className={`text-[10px] ${(STATUS_CONFIG[detailSheet.status] || STATUS_CONFIG.OPEN).bg}`}>
                    {(STATUS_CONFIG[detailSheet.status] || STATUS_CONFIG.OPEN).label}
                  </Badge>
                </SheetTitle>
                <SheetDescription>{detailSheet.subject}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div><span className="text-muted-foreground">Tenant:</span> <span className="font-semibold text-foreground">{detailSheet.tenantName || detailSheet.tenantId.slice(0, 8)}</span></div>
                  <div><span className="text-muted-foreground">Reporter:</span> <span className="font-semibold text-foreground">{detailSheet.reporterEmail}</span></div>
                  <div><span className="text-muted-foreground">Priorità:</span> <Badge variant="outline" className={`text-[10px] ${(PRIORITY_CONFIG[detailSheet.priority] || PRIORITY_CONFIG.MEDIUM).bg}`}>{(PRIORITY_CONFIG[detailSheet.priority] || PRIORITY_CONFIG.MEDIUM).label}</Badge></div>
                  <div><span className="text-muted-foreground">Categoria:</span> <span className="font-semibold text-foreground">{CATEGORY_LABELS[detailSheet.category] || detailSheet.category}</span></div>
                  <div><span className="text-muted-foreground">SLA:</span> <span className="font-semibold text-foreground">{detailSheet.slaHours ? `${detailSheet.slaHours}h` : "N/A"}</span></div>
                  <div><span className="text-muted-foreground">Creato:</span> <span className="font-semibold text-foreground tabular-nums">{new Date(detailSheet.createdAt).toLocaleString("it-IT")}</span></div>
                </div>

                {/* Description */}
                <Card className="glass-card">
                  <CardContent className="p-4">
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Descrizione</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{detailSheet.description}</p>
                  </CardContent>
                </Card>

                {/* Replies */}
                <div>
                  <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-2">Conversazione ({detailSheet.replies.length})</p>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto">
                    {detailSheet.replies.map((r, i) => (
                      <div key={i} className={`p-3 rounded-xl text-sm ${r.isInternal ? "bg-amber-500/5 border border-amber-500/20" : "bg-muted/50 border border-border"}`}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-bold text-foreground">{r.author}</span>
                          <div className="flex items-center gap-1.5">
                            {r.isInternal && <Badge variant="outline" className="text-[9px] bg-amber-500/10 text-amber-600">Nota interna</Badge>}
                            <span className="text-[10px] text-muted-foreground tabular-nums">{new Date(r.timestamp).toLocaleString("it-IT")}</span>
                          </div>
                        </div>
                        <p className="text-foreground/80 whitespace-pre-wrap">{r.message}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Reply Form */}
                <div className="space-y-2 border-t border-border pt-4">
                  <Textarea value={replyText} onChange={e => setReplyText(e.target.value)} rows={3} placeholder="Scrivi una risposta..." />
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                      <input type="checkbox" checked={replyInternal} onChange={e => setReplyInternal(e.target.checked)} className="rounded" />
                      Nota interna (non visibile al tenant)
                    </label>
                    <Button size="sm" onClick={handleReply} disabled={saving || !replyText.trim()}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Send className="h-4 w-4 mr-2" />}Rispondi
                    </Button>
                  </div>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Create Dialog */}
      <Dialog open={createDialog} onOpenChange={setCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nuovo Ticket</DialogTitle>
            <DialogDescription>Crea un ticket di supporto per un tenant.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Oggetto *</Label>
              <Input value={formData.subject} onChange={e => setFormData(p => ({ ...p, subject: e.target.value }))} placeholder="Login non funzionante" />
            </div>
            <div>
              <Label>Descrizione *</Label>
              <Textarea value={formData.description} onChange={e => setFormData(p => ({ ...p, description: e.target.value }))} rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Tenant ID *</Label>
                <Input value={formData.tenantId} onChange={e => setFormData(p => ({ ...p, tenantId: e.target.value }))} placeholder="UUID" />
              </div>
              <div>
                <Label>Email reporter *</Label>
                <Input value={formData.reporterEmail} onChange={e => setFormData(p => ({ ...p, reporterEmail: e.target.value }))} placeholder="admin@tenant.it" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Categoria</Label>
                <Select value={formData.category} onValueChange={v => setFormData(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORY_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Priorità</Label>
                <Select value={formData.priority} onValueChange={v => setFormData(p => ({ ...p, priority: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialog(false)}>Annulla</Button>
            <Button onClick={handleCreate} disabled={saving || !formData.subject || !formData.tenantId || !formData.reporterEmail}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Crea Ticket
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
