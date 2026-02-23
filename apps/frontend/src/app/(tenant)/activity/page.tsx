"use client";

import { useState, useMemo } from "react";
import { Activity, Search, Filter, Download, Users, FileText, ShoppingCart,
  CheckSquare, Mail, DollarSign, Package, UserPlus, Pencil, Trash2, Eye,
  ChevronDown, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type ActionType =
  | "lead_created" | "deal_won" | "deal_lost" | "quote_sent" | "quote_accepted"
  | "invoice_sent" | "invoice_paid" | "contact_added" | "task_completed"
  | "order_created" | "note_added" | "email_sent" | "product_updated"
  | "user_login";

interface ActivityEvent {
  id: string;
  type: ActionType;
  user: { name: string; initials: string; color: string };
  entity: string;
  entityType: string;
  detail?: string;
  timestamp: string;
  relativeTime: string;
  module: string;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const EVENTS: ActivityEvent[] = [
  { id: "e01", type: "deal_won",       user: { name: "Luca Ferretti",    initials: "LF", color: "bg-indigo-500"  }, entity: "Contratto Enterprise Luxor Media", entityType: "Deal",     detail: "€ 95.000",                       timestamp: "2026-02-23T13:47:00", relativeTime: "2 min fa",   module: "CRM" },
  { id: "e02", type: "quote_accepted", user: { name: "Sara Colombo",     initials: "SC", color: "bg-emerald-500" }, entity: "PRV-2026-008",                    entityType: "Preventivo", detail: "Accettato da Luxor Media — € 18.400", timestamp: "2026-02-23T13:30:00", relativeTime: "19 min fa",  module: "Preventivi" },
  { id: "e03", type: "lead_created",   user: { name: "Marco Rinaldi",    initials: "MR", color: "bg-violet-500"  }, entity: "Roberta Silvestri",               entityType: "Lead",     detail: "Tech Solutions S.r.l.",           timestamp: "2026-02-23T13:12:00", relativeTime: "37 min fa",  module: "CRM" },
  { id: "e04", type: "task_completed", user: { name: "Anna De Luca",     initials: "AD", color: "bg-rose-500"    }, entity: "Configurare integrazione Slack",  entityType: "Task",     detail: "Progetto: DoFlow Internal",      timestamp: "2026-02-23T12:55:00", relativeTime: "54 min fa",  module: "Task" },
  { id: "e05", type: "invoice_paid",   user: { name: "Luca Ferretti",    initials: "LF", color: "bg-indigo-500"  }, entity: "FT-2026-029",                    entityType: "Fattura",  detail: "Pagato € 6.840 da Brera Design", timestamp: "2026-02-23T12:30:00", relativeTime: "1 ora fa",   module: "Fatturazione" },
  { id: "e06", type: "email_sent",     user: { name: "Sara Colombo",     initials: "SC", color: "bg-emerald-500" }, entity: "Follow-up demo Q2",               entityType: "Email",    detail: "A: marco@nextech.it",           timestamp: "2026-02-23T11:58:00", relativeTime: "1 ora fa",   module: "Comunicazione" },
  { id: "e07", type: "order_created",  user: { name: "Giorgio Esposito", initials: "GE", color: "bg-orange-500"  }, entity: "ORD-2026-044",                   entityType: "Ordine",   detail: "Manifattura Lombarda — € 12.300", timestamp: "2026-02-23T11:20:00", relativeTime: "2 ore fa",   module: "Ordini" },
  { id: "e08", type: "contact_added",  user: { name: "Marco Rinaldi",    initials: "MR", color: "bg-violet-500"  }, entity: "Federico Gatti",                 entityType: "Contatto", detail: "CFO @ Alpine Ventures",         timestamp: "2026-02-23T10:45:00", relativeTime: "3 ore fa",   module: "CRM" },
  { id: "e09", type: "deal_lost",      user: { name: "Luca Ferretti",    initials: "LF", color: "bg-indigo-500"  }, entity: "Fornitura annuale Tecno Sud",    entityType: "Deal",     detail: "Motivo: budget non approvato",  timestamp: "2026-02-23T10:10:00", relativeTime: "3 ore fa",   module: "CRM" },
  { id: "e10", type: "quote_sent",     user: { name: "Anna De Luca",     initials: "AD", color: "bg-rose-500"    }, entity: "PRV-2026-009",                   entityType: "Preventivo", detail: "A: Nextech S.r.l. — € 28.900", timestamp: "2026-02-23T09:40:00", relativeTime: "4 ore fa",   module: "Preventivi" },
  { id: "e11", type: "invoice_sent",   user: { name: "Giorgio Esposito", initials: "GE", color: "bg-orange-500"  }, entity: "FT-2026-031",                   entityType: "Fattura",  detail: "A: Alpine Ventures — € 9.600", timestamp: "2026-02-23T09:15:00", relativeTime: "4 ore fa",   module: "Fatturazione" },
  { id: "e12", type: "product_updated",user: { name: "Sara Colombo",     initials: "SC", color: "bg-emerald-500" }, entity: "Piano Enterprise DoFlow",        entityType: "Prodotto", detail: "Prezzo aggiornato: € 299/mese", timestamp: "2026-02-23T08:50:00", relativeTime: "5 ore fa",   module: "Catalogo" },
  { id: "e13", type: "note_added",     user: { name: "Luca Ferretti",    initials: "LF", color: "bg-indigo-500"  }, entity: "Alpine Ventures",                entityType: "Azienda",  detail: "Riunione fissata per 03/03",    timestamp: "2026-02-22T17:30:00", relativeTime: "Ieri 17:30", module: "CRM" },
  { id: "e14", type: "task_completed", user: { name: "Marco Rinaldi",    initials: "MR", color: "bg-violet-500"  }, entity: "Aggiornare listino prezzi 2026", entityType: "Task",     detail: "Completato in anticipo",        timestamp: "2026-02-22T16:00:00", relativeTime: "Ieri 16:00", module: "Task" },
  { id: "e15", type: "lead_created",   user: { name: "Anna De Luca",     initials: "AD", color: "bg-rose-500"    }, entity: "Claudio Mantovani",              entityType: "Lead",     detail: "Impresa Costruzioni Verona",    timestamp: "2026-02-22T14:20:00", relativeTime: "Ieri 14:20", module: "CRM" },
  { id: "e16", type: "deal_won",       user: { name: "Giorgio Esposito", initials: "GE", color: "bg-orange-500"  }, entity: "Gestione logistics Q1",          entityType: "Deal",     detail: "€ 24.000",                     timestamp: "2026-02-22T11:05:00", relativeTime: "Ieri 11:05", module: "CRM" },
  { id: "e17", type: "invoice_paid",   user: { name: "Sara Colombo",     initials: "SC", color: "bg-emerald-500" }, entity: "FT-2026-025",                   entityType: "Fattura",  detail: "Pagato € 14.200 da Nextech",   timestamp: "2026-02-22T10:30:00", relativeTime: "Ieri 10:30", module: "Fatturazione" },
  { id: "e18", type: "email_sent",     user: { name: "Luca Ferretti",    initials: "LF", color: "bg-indigo-500"  }, entity: "Newsletter Febbraio 2026",       entityType: "Campagna", detail: "Inviata a 340 contatti",        timestamp: "2026-02-21T15:00:00", relativeTime: "2 giorni fa", module: "Comunicazione" },
];

// ─── Action config ────────────────────────────────────────────────────────────

const ACTION_CONFIG: Record<ActionType, { label: string; icon: React.ComponentType<{className?: string}>; color: string; bg: string }> = {
  lead_created:    { label: "Nuovo Lead",         icon: UserPlus,    color: "text-indigo-600",  bg: "bg-indigo-100 dark:bg-indigo-950/40" },
  deal_won:        { label: "Deal Vinto",          icon: DollarSign,  color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40" },
  deal_lost:       { label: "Deal Perso",          icon: X,           color: "text-rose-600",    bg: "bg-rose-100 dark:bg-rose-950/40" },
  quote_sent:      { label: "Preventivo Inviato",  icon: FileText,    color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-950/40" },
  quote_accepted:  { label: "Preventivo Accettato",icon: CheckSquare, color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40" },
  invoice_sent:    { label: "Fattura Inviata",     icon: FileText,    color: "text-violet-600",  bg: "bg-violet-100 dark:bg-violet-950/40" },
  invoice_paid:    { label: "Fattura Pagata",      icon: DollarSign,  color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40" },
  contact_added:   { label: "Contatto Aggiunto",   icon: Users,       color: "text-blue-600",    bg: "bg-blue-100 dark:bg-blue-950/40" },
  task_completed:  { label: "Task Completato",     icon: CheckSquare, color: "text-teal-600",    bg: "bg-teal-100 dark:bg-teal-950/40" },
  order_created:   { label: "Ordine Creato",       icon: ShoppingCart,color: "text-orange-600",  bg: "bg-orange-100 dark:bg-orange-950/40" },
  note_added:      { label: "Nota Aggiunta",       icon: Pencil,      color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/40" },
  email_sent:      { label: "Email Inviata",       icon: Mail,        color: "text-sky-600",     bg: "bg-sky-100 dark:bg-sky-950/40" },
  product_updated: { label: "Prodotto Modificato", icon: Package,     color: "text-purple-600",  bg: "bg-purple-100 dark:bg-purple-950/40" },
  user_login:      { label: "Accesso",             icon: Eye,         color: "text-gray-500",    bg: "bg-gray-100 dark:bg-gray-800/40" },
};

const ALL_USERS  = ["Tutti", "Luca Ferretti", "Sara Colombo", "Marco Rinaldi", "Anna De Luca", "Giorgio Esposito"];
const ALL_MODULES = ["Tutti", "CRM", "Preventivi", "Fatturazione", "Task", "Ordini", "Comunicazione", "Catalogo"];

// ─── Stat summary ─────────────────────────────────────────────────────────────

const STATS = [
  { label: "Azioni oggi",   value: "42",  icon: Activity,    color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/30" },
  { label: "Deal chiusi",   value: "5",   icon: DollarSign,  color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
  { label: "Task completati",value: "18", icon: CheckSquare, color: "text-teal-600",    bg: "bg-teal-50 dark:bg-teal-950/30" },
  { label: "Utenti attivi", value: "5",   icon: Users,       color: "text-violet-600",  bg: "bg-violet-50 dark:bg-violet-950/30" },
];

// ─── Component ────────────────────────────────────────────────────────────────

export default function Page() {
  const [search, setSearch]   = useState("");
  const [userFilter, setUser] = useState("Tutti");
  const [modFilter, setMod]   = useState("Tutti");

  const filtered = useMemo(() => EVENTS.filter((e) => {
    if (userFilter !== "Tutti" && e.user.name !== userFilter) return false;
    if (modFilter  !== "Tutti" && e.module !== modFilter)     return false;
    if (search && !`${e.entity} ${e.entityType} ${e.detail ?? ""} ${e.user.name}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [search, userFilter, modFilter]);

  // Group by day label
  const groups = useMemo(() => {
    const map = new Map<string, ActivityEvent[]>();
    for (const ev of filtered) {
      const day = ev.timestamp.startsWith("2026-02-23") ? "Oggi" : ev.timestamp.startsWith("2026-02-22") ? "Ieri" : "2 giorni fa";
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(ev);
    }
    return map;
  }, [filtered]);

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Feed Attività</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Timeline di tutte le azioni del team in tempo reale</p>
        </div>
        <Button variant="outline" size="sm">
          <Download className="mr-1.5 h-4 w-4" /> Esporta CSV
        </Button>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {STATS.map((s) => (
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
          <Input
            placeholder="Cerca attività..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={userFilter} onValueChange={setUser}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Utente" />
          </SelectTrigger>
          <SelectContent>
            {ALL_USERS.map((u) => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={modFilter} onValueChange={setMod}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Modulo" />
          </SelectTrigger>
          <SelectContent>
            {ALL_MODULES.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Timeline */}
      <div className="space-y-6">
        {groups.size === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <Activity className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground">Nessuna attività trovata con i filtri selezionati.</p>
            </CardContent>
          </Card>
        )}

        {Array.from(groups.entries()).map(([day, events]) => (
          <div key={day}>
            {/* Day label */}
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">{day}</span>
              <div className="flex-1 border-t border-border/40" />
              <span className="text-xs text-muted-foreground">{events.length} azioni</span>
            </div>

            {/* Events list */}
            <Card className="overflow-hidden">
              <div className="divide-y divide-border/50">
                {events.map((ev, idx) => {
                  const cfg = ACTION_CONFIG[ev.type];
                  const Icon = cfg.icon;
                  return (
                    <div
                      key={ev.id}
                      className="flex items-start gap-4 px-5 py-3.5 hover:bg-muted/30 transition-colors group"
                    >
                      {/* Action icon */}
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5", cfg.bg)}>
                        <Icon className={cn("h-3.5 w-3.5", cfg.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-foreground">{ev.entity}</span>
                          <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", cfg.color, "border-current/30")}>
                            {cfg.label}
                          </Badge>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 font-normal">
                            {ev.module}
                          </Badge>
                        </div>
                        {ev.detail && (
                          <p className="text-xs text-muted-foreground mt-0.5">{ev.detail}</p>
                        )}
                      </div>

                      {/* User + time */}
                      <div className="flex items-center gap-2 shrink-0">
                        <div className="hidden sm:flex items-center gap-1.5">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className={cn("text-[9px] font-bold text-white", ev.user.color)}>
                              {ev.user.initials}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">{ev.user.name.split(" ")[0]}</span>
                        </div>
                        <span className="text-xs text-muted-foreground/60 tabular-nums">{ev.relativeTime}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        ))}
      </div>
    </div>
  );
}
