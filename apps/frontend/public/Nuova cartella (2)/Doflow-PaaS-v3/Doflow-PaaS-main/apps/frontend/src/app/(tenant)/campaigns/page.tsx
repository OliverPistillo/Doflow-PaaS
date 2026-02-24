"use client";

import { useState, useMemo } from "react";
import { Megaphone, Plus, Search, Send, Eye, MousePointerClick, Users,
  BarChart2, Mail, Play, Pause, Edit2, Trash2, Copy, ChevronRight,
  TrendingUp, CheckCircle2, Clock, XCircle, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type CampaignStatus = "bozza" | "programmata" | "attiva" | "completata" | "in_pausa";
type CampaignType   = "newsletter" | "promozionale" | "onboarding" | "followup" | "riattivazione";

interface Campaign {
  id: string;
  name: string;
  subject: string;
  type: CampaignType;
  status: CampaignStatus;
  audience: string;
  recipients: number;
  sent?: number;
  opened?: number;
  clicked?: number;
  unsubscribed?: number;
  sentDate?: string;
  scheduledDate?: string;
  createdBy: string;
  tags: string[];
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const CAMPAIGNS: Campaign[] = [
  {
    id: "c01", name: "Newsletter Febbraio 2026", subject: "📊 Le novità di DoFlow | Febbraio 2026",
    type: "newsletter", status: "completata", audience: "Tutti i clienti", recipients: 340,
    sent: 340, opened: 184, clicked: 62, unsubscribed: 3,
    sentDate: "2026-02-01", createdBy: "Sara M.", tags: ["Newsletter", "Mensile"],
  },
  {
    id: "c02", name: "Promozione Piano Enterprise", subject: "🚀 Passa a Enterprise — offerta esclusiva",
    type: "promozionale", status: "attiva", audience: "Clienti Piano Pro", recipients: 148,
    sent: 148, opened: 71, clicked: 29, unsubscribed: 1,
    sentDate: "2026-02-15", createdBy: "Luca P.", tags: ["Promo", "Upgrade"],
  },
  {
    id: "c03", name: "Onboarding nuovi clienti — Febbraio", subject: "👋 Benvenuto! Inizia con DoFlow",
    type: "onboarding", status: "completata", audience: "Nuovi clienti (ultimi 30gg)", recipients: 12,
    sent: 12, opened: 10, clicked: 8, unsubscribed: 0,
    sentDate: "2026-02-10", createdBy: "Sara M.", tags: ["Onboarding"],
  },
  {
    id: "c04", name: "Followup lead freddi Q1", subject: "Ci sei ancora? Riprendiamo da dove eravamo",
    type: "followup", status: "programmata", audience: "Lead inattivi > 60gg", recipients: 87,
    scheduledDate: "2026-02-28 09:00", createdBy: "Marco R.", tags: ["Lead", "Followup"],
  },
  {
    id: "c05", name: "Riattivazione clienti inattivi", subject: "Ci manchi! Torna su DoFlow con uno sconto",
    type: "riattivazione", status: "bozza", audience: "Clienti inattivi > 90gg", recipients: 54,
    createdBy: "Luca P.", tags: ["Retention"],
  },
  {
    id: "c06", name: "Newsletter Gennaio 2026", subject: "🎉 Buon 2026 — novità e aggiornamenti",
    type: "newsletter", status: "completata", audience: "Tutti i clienti", recipients: 328,
    sent: 328, opened: 172, clicked: 48, unsubscribed: 5,
    sentDate: "2026-01-05", createdBy: "Sara M.", tags: ["Newsletter", "Mensile"],
  },
  {
    id: "c07", name: "Campagna Q2 — Nuovi servizi", subject: "💼 Scopri i nuovi servizi DoFlow Q2",
    type: "promozionale", status: "in_pausa", audience: "Prospect attivi", recipients: 220,
    sent: 100, opened: 41, clicked: 12, unsubscribed: 0,
    sentDate: "2026-02-20", createdBy: "Marco R.", tags: ["Promo", "Q2"],
  },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<CampaignStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{className?: string}> }> = {
  bozza:       { label: "Bozza",        color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/40",    icon: Edit2 },
  programmata: { label: "Programmata",  color: "text-indigo-600",  bg: "bg-indigo-100 dark:bg-indigo-950/40",  icon: Clock },
  attiva:      { label: "Attiva",       color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40",icon: Play },
  completata:  { label: "Completata",   color: "text-teal-600",    bg: "bg-teal-100 dark:bg-teal-950/40",      icon: CheckCircle2 },
  in_pausa:    { label: "In pausa",     color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-950/40",    icon: Pause },
};

const TYPE_CONFIG: Record<CampaignType, { label: string; color: string }> = {
  newsletter:    { label: "Newsletter",    color: "text-indigo-600" },
  promozionale:  { label: "Promozionale",  color: "text-violet-600" },
  onboarding:    { label: "Onboarding",    color: "text-emerald-600" },
  followup:      { label: "Follow-up",     color: "text-amber-600" },
  riattivazione: { label: "Riattivazione", color: "text-rose-600" },
};

const ALL_TYPES   = ["Tutti", "newsletter", "promozionale", "onboarding", "followup", "riattivazione"];
const ALL_STATUSES = ["Tutti", "bozza", "programmata", "attiva", "completata", "in_pausa"];

// ─── Stats ────────────────────────────────────────────────────────────────────

const sentCampaigns = CAMPAIGNS.filter(c => c.sent);
const totalSent     = sentCampaigns.reduce((s, c) => s + (c.sent ?? 0), 0);
const totalOpened   = sentCampaigns.reduce((s, c) => s + (c.opened ?? 0), 0);
const totalClicked  = sentCampaigns.reduce((s, c) => s + (c.clicked ?? 0), 0);

const STATS = [
  { label: "Campagne totali",  value: String(CAMPAIGNS.length),                                 icon: Megaphone,       color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/30" },
  { label: "Email inviate",    value: totalSent.toLocaleString("it-IT"),                         icon: Send,            color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  { label: "Tasso apertura",   value: `${Math.round(totalOpened / totalSent * 100)}%`,           icon: Eye,             color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30" },
  { label: "Tasso click",      value: `${Math.round(totalClicked / totalOpened * 100)}%`,        icon: MousePointerClick, color: "text-violet-600", bg: "bg-violet-50 dark:bg-violet-950/30" },
];

// ─── Campaign Card ────────────────────────────────────────────────────────────

function CampaignCard({ c, onSelect }: { c: Campaign; onSelect: (c: Campaign) => void }) {
  const st = STATUS_CONFIG[c.status];
  const tp = TYPE_CONFIG[c.type];
  const openRate   = c.sent && c.opened ? Math.round(c.opened / c.sent * 100) : null;
  const clickRate  = c.opened && c.clicked ? Math.round(c.clicked / c.opened * 100) : null;
  const StIcon = st.icon;

  return (
    <Card
      className="cursor-pointer hover:shadow-md transition-shadow border-border/60 group"
      onClick={() => onSelect(c)}
    >
      <CardContent className="p-5">
        {/* Header */}
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", st.color, "border-current/30", st.bg)}>
                <StIcon className="h-2.5 w-2.5 mr-1" />
                {st.label}
              </Badge>
              <Badge variant="secondary" className={cn("text-[10px] px-1.5 py-0", tp.color)}>
                {tp.label}
              </Badge>
            </div>
            <h3 className="font-semibold text-sm leading-tight">{c.name}</h3>
            <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.subject}</p>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => { e.stopPropagation(); }}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Audience + date */}
        <div className="flex items-center gap-3 text-xs text-muted-foreground mb-3">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.recipients.toLocaleString()} dest.</span>
          <span className="text-border">·</span>
          {c.sentDate
            ? <span className="flex items-center gap-1"><Send className="h-3 w-3" /> {new Date(c.sentDate).toLocaleDateString("it-IT", { day: "numeric", month: "short" })}</span>
            : c.scheduledDate
            ? <span className="flex items-center gap-1 text-indigo-600"><Clock className="h-3 w-3" /> {c.scheduledDate.split(" ")[0]}</span>
            : <span className="text-muted-foreground/50">—</span>
          }
        </div>

        {/* Metrics */}
        {c.sent && openRate !== null ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">Aperture</span>
              <span className="font-semibold tabular-nums">{openRate}% <span className="text-muted-foreground font-normal">({c.opened})</span></span>
            </div>
            <Progress value={openRate} className="h-1.5" />
            {clickRate !== null && (
              <>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">Click</span>
                  <span className="font-semibold tabular-nums">{clickRate}% <span className="text-muted-foreground font-normal">({c.clicked})</span></span>
                </div>
                <Progress value={clickRate} className="h-1.5" />
              </>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-muted-foreground/50 italic mt-2">
            {c.status === "bozza" ? "In attesa di invio" : c.status === "programmata" ? "Invio programmato" : "Dati non disponibili"}
          </div>
        )}

        {/* Tags */}
        {c.tags.length > 0 && (
          <div className="flex gap-1 mt-3 flex-wrap">
            {c.tags.map(t => <span key={t} className="text-[10px] px-1.5 py-0.5 bg-muted rounded-md text-muted-foreground">{t}</span>)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Detail modal ─────────────────────────────────────────────────────────────

function CampaignDetail({ c, onClose }: { c: Campaign; onClose: () => void }) {
  const st = STATUS_CONFIG[c.status];
  const tp = TYPE_CONFIG[c.type];
  const openRate  = c.sent && c.opened  ? Math.round(c.opened  / c.sent    * 100) : 0;
  const clickRate = c.opened && c.clicked ? Math.round(c.clicked / c.opened * 100) : 0;
  const bounceRate = 0.8; // demo

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
              <Megaphone className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1 min-w-0">
              <DialogTitle className="text-base">{c.name}</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{c.subject}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Status + type */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className={cn("text-xs", st.color, "border-current/30", st.bg)}>{st.label}</Badge>
            <Badge variant="secondary" className={cn("text-xs", tp.color)}>{tp.label}</Badge>
            {c.tags.map(t => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}
          </div>

          {/* Info grid */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Audience</p>
              <p className="font-medium">{c.audience}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Destinatari</p>
              <p className="font-bold text-lg tabular-nums">{c.recipients.toLocaleString()}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">Creata da</p>
              <p className="font-medium">{c.createdBy}</p>
            </div>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-xs text-muted-foreground mb-1">{c.sentDate ? "Data invio" : c.scheduledDate ? "Programmata" : "Data invio"}</p>
              <p className="font-medium">{c.sentDate ?? c.scheduledDate ?? "—"}</p>
            </div>
          </div>

          {/* Metrics (only if sent) */}
          {c.sent && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 mb-3">Performance</p>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: "Recapitate", value: c.sent, pct: 100,          color: "text-indigo-600",  bg: "bg-indigo-50" },
                  { label: "Aperte",     value: c.opened ?? 0,  pct: openRate,  color: "text-emerald-600", bg: "bg-emerald-50" },
                  { label: "Click",      value: c.clicked ?? 0, pct: clickRate, color: "text-amber-600",   bg: "bg-amber-50" },
                  { label: "Disiscritti",value: c.unsubscribed ?? 0, pct: Math.round((c.unsubscribed ?? 0) / (c.sent ?? 1) * 100), color: "text-rose-600", bg: "bg-rose-50" },
                ].map(m => (
                  <div key={m.label} className={cn("rounded-xl p-3 text-center", m.bg, "dark:bg-transparent dark:border dark:border-border/40")}>
                    <p className={cn("text-2xl font-black tabular-nums", m.color)}>{m.pct}%</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{m.label}</p>
                    <p className="text-[11px] font-medium">{m.value.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Chiudi</Button>
          {c.status === "bozza" && (
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Send className="mr-1.5 h-4 w-4" /> Invia campagna
            </Button>
          )}
          {c.status === "attiva" && (
            <Button size="sm" variant="outline" className="text-amber-600 border-amber-300">
              <Pause className="mr-1.5 h-4 w-4" /> Metti in pausa
            </Button>
          )}
          {c.status !== "completata" && (
            <Button size="sm" variant="ghost">
              <Edit2 className="mr-1.5 h-4 w-4" /> Modifica
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [search, setSearch]       = useState("");
  const [typeFilter, setType]     = useState("Tutti");
  const [statusFilter, setStatus] = useState("Tutti");
  const [selected, setSelected]   = useState<Campaign | null>(null);

  const filtered = useMemo(() => CAMPAIGNS.filter(c => {
    if (typeFilter   !== "Tutti" && c.type   !== typeFilter)   return false;
    if (statusFilter !== "Tutti" && c.status !== statusFilter) return false;
    if (search && !`${c.name} ${c.subject} ${c.audience}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [search, typeFilter, statusFilter]);

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-5">

      {selected && <CampaignDetail c={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Campagne Email</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Gestisci e monitora le tue campagne di email marketing</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0" size="sm">
          <Plus className="mr-1.5 h-4 w-4" /> Nuova Campagna
        </Button>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map(s => (
          <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
            <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
              <s.icon className={cn("h-4 w-4", s.color)} />
            </div>
            <div>
              <p className="text-[11px] text-muted-foreground">{s.label}</p>
              <p className="text-lg font-bold tabular-nums">{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca campagne..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={typeFilter} onValueChange={setType}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            {ALL_TYPES.map(t => <SelectItem key={t} value={t}>{t === "Tutti" ? "Tutti i tipi" : TYPE_CONFIG[t as CampaignType]?.label ?? t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44">
            <SelectValue placeholder="Stato" />
          </SelectTrigger>
          <SelectContent>
            {ALL_STATUSES.map(s => <SelectItem key={s} value={s}>{s === "Tutti" ? "Tutti gli stati" : STATUS_CONFIG[s as CampaignStatus]?.label ?? s}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Megaphone className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground">Nessuna campagna trovata.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(c => (
            <CampaignCard key={c.id} c={c} onSelect={setSelected} />
          ))}
        </div>
      )}
    </div>
  );
}
