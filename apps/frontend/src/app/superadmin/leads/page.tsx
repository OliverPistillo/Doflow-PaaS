// Percorso: apps/frontend/src/app/superadmin/leads/page.tsx

"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
  Loader2, RefreshCw, Search, Plus, MoreHorizontal,
  UserPlus, Target, TrendingUp, Zap, Mail, Phone,
  Building2, Globe, ArrowRight, Filter, Pencil,
  Trash2, ChevronDown,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { apiFetch } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import { ExportButton } from "@/components/ui/export-button";

// ─── Types ────────────────────────────────────────────────────────────────────

type Lead = {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  source: string;
  status: string;
  notes: string | null;
  score: number;
  assignedTo: string | null;
  createdAt: string;
};

type LeadStats = {
  total: number;
  new: number;
  qualified: number;
  won: number;
  lost: number;
  conversionRate: number;
  avgScore: number;
  last30Days: number;
  bySource: { source: string; count: number }[];
  byStatus: { status: string; count: number }[];
};

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  NEW:       { label: "Nuovo",       color: "hsl(210 70% 55%)", bg: "bg-blue-500/10 text-blue-600 border-blue-500/20" },
  CONTACTED: { label: "Contattato",  color: "hsl(280 60% 55%)", bg: "bg-violet-500/10 text-violet-600 border-violet-500/20" },
  QUALIFIED: { label: "Qualificato", color: "hsl(40 80% 55%)",  bg: "bg-amber-500/10 text-amber-600 border-amber-500/20" },
  PROPOSAL:  { label: "Proposta",    color: "hsl(200 70% 50%)", bg: "bg-cyan-500/10 text-cyan-600 border-cyan-500/20" },
  WON:       { label: "Vinto",       color: "hsl(150 60% 45%)", bg: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20" },
  LOST:      { label: "Perso",       color: "hsl(0 70% 55%)",   bg: "bg-red-500/10 text-red-600 border-red-500/20" },
};

const SOURCE_COLORS: Record<string, string> = {
  META: "hsl(210 70% 55%)",
  TIKTOK: "hsl(340 70% 55%)",
  GOOGLE: "hsl(40 80% 55%)",
  WEBSITE: "hsl(150 60% 45%)",
  REFERRAL: "hsl(280 60% 55%)",
  MANUAL: "hsl(var(--muted-foreground))",
  OTHER: "hsl(var(--muted-foreground))",
};

const STATUS_FLOW = ["NEW", "CONTACTED", "QUALIFIED", "PROPOSAL", "WON"];

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

export default function LeadsPage() {
  const { toast } = useToast();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [stats, setStats] = useState<LeadStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterSource, setFilterSource] = useState<string>("ALL");
  const [editDialog, setEditDialog] = useState<{ open: boolean; lead: Partial<Lead> | null }>({ open: false, lead: null });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filterStatus !== "ALL") params.set("status", filterStatus);
      if (filterSource !== "ALL") params.set("source", filterSource);
      if (search) params.set("search", search);

      const [l, s] = await Promise.all([
        apiFetch<Lead[]>(`/superadmin/leads?${params}`),
        apiFetch<LeadStats>("/superadmin/leads/stats"),
      ]);
      setLeads(Array.isArray(l) ? l : []);
      setStats(s);
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [toast, filterStatus, filterSource, search]);

  useEffect(() => { load(); }, [load]);

  const handleSave = async () => {
    if (!editDialog.lead) return;
    setSaving(true);
    try {
      const lead = editDialog.lead;
      if (lead.id) {
        await apiFetch(`/superadmin/leads/${lead.id}`, { method: "PUT", body: JSON.stringify(lead) });
      } else {
        await apiFetch("/superadmin/leads", { method: "POST", body: JSON.stringify(lead) });
      }
      setEditDialog({ open: false, lead: null });
      await load();
      toast({ title: "Lead salvato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await apiFetch(`/superadmin/leads/${id}`, { method: "DELETE" });
      await load();
      toast({ title: "Lead eliminato" });
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  const handleStatusChange = async (id: string, status: string) => {
    try {
      await apiFetch(`/superadmin/leads/${id}/status`, { method: "PUT", body: JSON.stringify({ status }) });
      await load();
    } catch (e: any) {
      toast({ title: "Errore", description: e.message, variant: "destructive" });
    }
  };

  if (loading && !stats) {
    return (
      <div className="flex flex-col justify-center items-center py-32 gap-4">
        <Loader2 className="animate-spin text-primary h-12 w-12" />
        <p className="text-muted-foreground text-sm font-medium animate-pulse">Caricamento lead...</p>
      </div>
    );
  }

  const sourcePie = (stats?.bySource || []).map(s => ({
    ...s, fill: SOURCE_COLORS[s.source] || "gray",
  }));

  return (
    <div className="space-y-6">
      {/* KPI Row */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard title="Lead Totali" value={stats.total} sub={`${stats.last30Days} ultimi 30gg`} icon={UserPlus} color="hsl(var(--chart-1))" />
          <KpiCard title="Nuovi" value={stats.new} icon={Zap} color="hsl(var(--chart-2))" />
          <KpiCard title="Conversion Rate" value={`${stats.conversionRate}%`} sub={`${stats.won} vinti / ${stats.lost} persi`} icon={Target} color="hsl(var(--chart-3))" />
          <KpiCard title="Score Medio" value={stats.avgScore} sub="su 100" icon={TrendingUp} color="hsl(var(--chart-4))" />
        </div>
      )}

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap items-center">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Cerca lead..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder="Stato" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutti gli stati</SelectItem>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterSource} onValueChange={setFilterSource}>
            <SelectTrigger className="w-[130px]"><SelectValue placeholder="Fonte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Tutte le fonti</SelectItem>
              {["META","TIKTOK","GOOGLE","WEBSITE","REFERRAL","MANUAL"].map(s => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex gap-2">
          <ExportButton entity="leads" />
          <Button variant="outline" size="sm" onClick={load}><RefreshCw className="h-4 w-4 mr-2" />Aggiorna</Button>
          <Button size="sm" onClick={() => setEditDialog({ open: true, lead: { fullName: "", source: "MANUAL", status: "NEW", score: 0 } })}>
            <Plus className="h-4 w-4 mr-2" />Nuovo Lead
          </Button>
        </div>
      </div>

      {/* Content: Pipeline + Source Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Lead List */}
        <div className="lg:col-span-3 space-y-2">
          {leads.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-16 text-center text-muted-foreground">
                <UserPlus className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p className="font-medium">Nessun lead trovato</p>
                <p className="text-xs mt-1">Crea il primo lead o modifica i filtri</p>
              </CardContent>
            </Card>
          ) : (
            leads.map(lead => {
              const sc = STATUS_CONFIG[lead.status] || STATUS_CONFIG.NEW;
              return (
                <Card key={lead.id} className="glass-card group hover:-translate-y-0.5 transition-all duration-200">
                  <CardContent className="p-4 flex items-center gap-4">
                    {/* Score circle */}
                    <div className="h-11 w-11 rounded-full flex items-center justify-center shrink-0 text-sm font-black border-2"
                      style={{
                        borderColor: lead.score >= 70 ? "hsl(150 60% 45%)" : lead.score >= 40 ? "hsl(40 80% 55%)" : "hsl(var(--border))",
                        color: lead.score >= 70 ? "hsl(150 60% 45%)" : lead.score >= 40 ? "hsl(40 80% 55%)" : "hsl(var(--muted-foreground))",
                      }}>
                      {lead.score}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-foreground text-sm truncate">{lead.fullName}</h4>
                        <Badge variant="outline" className={`text-[10px] shrink-0 ${sc.bg}`}>{sc.label}</Badge>
                        <Badge variant="outline" className="text-[10px] shrink-0" style={{ borderColor: SOURCE_COLORS[lead.source] + "40", color: SOURCE_COLORS[lead.source] }}>{lead.source}</Badge>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                        {lead.email && <span className="flex items-center gap-1 truncate"><Mail className="h-3 w-3" />{lead.email}</span>}
                        {lead.phone && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{lead.phone}</span>}
                        {lead.company && <span className="flex items-center gap-1 truncate"><Building2 className="h-3 w-3" />{lead.company}</span>}
                      </div>
                    </div>

                    {/* Date */}
                    <span className="text-xs text-muted-foreground tabular-nums shrink-0 hidden sm:block">
                      {new Date(lead.createdAt).toLocaleDateString("it-IT")}
                    </span>

                    {/* Actions */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Cambia stato</DropdownMenuLabel>
                        {STATUS_FLOW.map(s => (
                          <DropdownMenuItem key={s} onClick={() => handleStatusChange(lead.id, s)} disabled={lead.status === s}>
                            <div className="w-2 h-2 rounded-full mr-2" style={{ backgroundColor: STATUS_CONFIG[s]?.color }} />
                            {STATUS_CONFIG[s]?.label}
                          </DropdownMenuItem>
                        ))}
                        <DropdownMenuItem onClick={() => handleStatusChange(lead.id, "LOST")} disabled={lead.status === "LOST"}>
                          <div className="w-2 h-2 rounded-full mr-2 bg-red-500" />Perso
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={() => setEditDialog({ open: true, lead: { ...lead } })}>
                          <Pencil className="h-4 w-4 mr-2" />Modifica
                        </DropdownMenuItem>
                        <DropdownMenuItem className="text-destructive" onClick={() => handleDelete(lead.id)}>
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

        {/* Source Distribution */}
        <Card className="glass-card h-fit">
          <CardContent className="p-6">
            <h3 className="font-bold text-foreground mb-1 text-sm">Lead per Fonte</h3>
            <p className="text-xs text-muted-foreground mb-4">Distribuzione sorgente acquisizione</p>
            {sourcePie.length > 0 ? (
              <>
                <ResponsiveContainer width="100%" height={180}>
                  <PieChart>
                    <Pie data={sourcePie} dataKey="count" nameKey="source" cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} strokeWidth={0}>
                      {sourcePie.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                    <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid hsl(var(--border))", background: "hsl(var(--card))" }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="space-y-2 mt-3">
                  {sourcePie.map(s => (
                    <div key={s.source} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2">
                        <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: s.fill }} />
                        <span className="text-muted-foreground">{s.source}</span>
                      </div>
                      <span className="font-bold text-foreground tabular-nums">{s.count}</span>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-muted-foreground text-xs">Nessun dato</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={o => { if (!o) setEditDialog({ open: false, lead: null }); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editDialog.lead?.id ? "Modifica Lead" : "Nuovo Lead"}</DialogTitle>
            <DialogDescription>Inserisci i dati del contatto.</DialogDescription>
          </DialogHeader>
          {editDialog.lead && (
            <div className="space-y-4 py-2">
              <div>
                <Label>Nome Completo *</Label>
                <Input value={editDialog.lead.fullName || ""} onChange={e => setEditDialog(p => ({ ...p, lead: { ...p.lead!, fullName: e.target.value } }))} placeholder="Mario Rossi" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Email</Label>
                  <Input value={editDialog.lead.email || ""} onChange={e => setEditDialog(p => ({ ...p, lead: { ...p.lead!, email: e.target.value } }))} placeholder="email@azienda.it" />
                </div>
                <div>
                  <Label>Telefono</Label>
                  <Input value={editDialog.lead.phone || ""} onChange={e => setEditDialog(p => ({ ...p, lead: { ...p.lead!, phone: e.target.value } }))} placeholder="+39 ..." />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Azienda</Label>
                  <Input value={editDialog.lead.company || ""} onChange={e => setEditDialog(p => ({ ...p, lead: { ...p.lead!, company: e.target.value } }))} />
                </div>
                <div>
                  <Label>Score (0-100)</Label>
                  <Input type="number" min={0} max={100} value={editDialog.lead.score ?? 0} onChange={e => setEditDialog(p => ({ ...p, lead: { ...p.lead!, score: Number(e.target.value) } }))} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Fonte</Label>
                  <Select value={editDialog.lead.source || "MANUAL"} onValueChange={v => setEditDialog(p => ({ ...p, lead: { ...p.lead!, source: v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["META","TIKTOK","GOOGLE","WEBSITE","REFERRAL","MANUAL","OTHER"].map(s => (
                        <SelectItem key={s} value={s}>{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Stato</Label>
                  <Select value={editDialog.lead.status || "NEW"} onValueChange={v => setEditDialog(p => ({ ...p, lead: { ...p.lead!, status: v } }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, lead: null })}>Annulla</Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Salva
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
