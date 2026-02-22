"use client";

import { useState } from "react";
import {
  Plus, Search, Building2, Calendar, MoreHorizontal,
  TrendingUp, DollarSign, Target, Users, Filter,
  List, KanbanSquare, Edit2, Trash2, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// ─── Types ───────────────────────────────────────────────────────────────────

type Stage = "nuovo" | "contatto" | "proposta" | "negoziazione" | "vinto" | "perso";
type Priority = "low" | "medium" | "high";

interface Deal {
  id: number; title: string; company: string; contact: string;
  value: number; stage: Stage; probability: number; closeDate: string;
  owner: string; tags: string[]; priority: Priority;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const INIT_DEALS: Deal[] = [
  { id: 1, title: "Piattaforma e-commerce StartupIO", company: "StartupIO", contact: "Francesca Romano", value: 28000, stage: "proposta", probability: 60, closeDate: "2026-03-15", owner: "Marco R.", tags: ["Web"], priority: "high" },
  { id: 2, title: "Migrazione cloud BigCorp", company: "BigCorp SpA", contact: "Alessandro Galli", value: 95000, stage: "negoziazione", probability: 75, closeDate: "2026-04-01", owner: "Giulia B.", tags: ["Cloud"], priority: "high" },
  { id: 3, title: "Redesign brand DesignStudio", company: "DesignStudio Srl", contact: "Elena Ferri", value: 12000, stage: "vinto", probability: 100, closeDate: "2026-02-10", owner: "Marco R.", tags: ["Branding"], priority: "medium" },
  { id: 4, title: "App mobile InnovateIT", company: "InnovateIT", contact: "Roberto Mazza", value: 45000, stage: "contatto", probability: 30, closeDate: "2026-05-01", owner: "Luca P.", tags: ["Mobile"], priority: "medium" },
  { id: 5, title: "Campagna digital MediaGroup", company: "MediaGroup Italia", contact: "Chiara Lombardi", value: 18500, stage: "proposta", probability: 50, closeDate: "2026-03-20", owner: "Sara M.", tags: ["Marketing"], priority: "low" },
  { id: 6, title: "CRM integrato SmartFactory", company: "SmartFactory", contact: "Davide Colombo", value: 67000, stage: "negoziazione", probability: 80, closeDate: "2026-03-30", owner: "Giulia B.", tags: ["CRM"], priority: "high" },
  { id: 7, title: "Sito web DigitalWave", company: "DigitalWave Srl", contact: "Marco Ferretti", value: 8500, stage: "vinto", probability: 100, closeDate: "2026-02-05", owner: "Luca P.", tags: ["Web"], priority: "low" },
  { id: 8, title: "Consulenza AI BigCorp", company: "BigCorp SpA", contact: "Alessandro Galli", value: 120000, stage: "contatto", probability: 20, closeDate: "2026-06-01", owner: "Marco R.", tags: ["AI"], priority: "high" },
  { id: 9, title: "Portale dipendenti MediaGroup", company: "MediaGroup Italia", contact: "Chiara Lombardi", value: 32000, stage: "nuovo", probability: 10, closeDate: "2026-06-15", owner: "Sara M.", tags: ["HR"], priority: "medium" },
  { id: 10, title: "Automazione NexusLab", company: "NexusLab", contact: "Valentina Ricci", value: 22000, stage: "nuovo", probability: 15, closeDate: "2026-05-20", owner: "Giulia B.", tags: ["Automation"], priority: "low" },
  { id: 11, title: "Piano SEO StartupIO", company: "StartupIO", contact: "Francesca Romano", value: 6000, stage: "perso", probability: 0, closeDate: "2026-02-01", owner: "Luca P.", tags: ["SEO"], priority: "low" },
];

const STAGES: { key: Stage; label: string; color: string; dotColor: string }[] = [
  { key: "nuovo",       label: "Nuovo",        color: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",   dotColor: "bg-slate-400" },
  { key: "contatto",    label: "Contattato",   color: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",       dotColor: "bg-sky-500" },
  { key: "proposta",    label: "Proposta",     color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300", dotColor: "bg-amber-500" },
  { key: "negoziazione",label: "Negoziazione", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300", dotColor: "bg-orange-500" },
  { key: "vinto",       label: "Vinto",        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300", dotColor: "bg-emerald-500" },
  { key: "perso",       label: "Perso",        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",       dotColor: "bg-red-500" },
];

const PRIORITY_COLORS: Record<Priority, string> = {
  low:    "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300",
  medium: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  high:   "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
};
const PRIORITY_LABEL: Record<Priority, string> = { low: "Bassa", medium: "Media", high: "Alta" };

const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);

// ─── Component ────────────────────────────────────────────────────────────────

export default function DealsPage() {
  const [deals, setDeals]             = useState<Deal[]>(INIT_DEALS);
  const [view, setView]               = useState<"kanban" | "list">("kanban");
  const [search, setSearch]           = useState("");
  const [draggedId, setDraggedId]     = useState<number | null>(null);
  const [dragOverStage, setDragOver]  = useState<Stage | null>(null);
  const [showCreate, setShowCreate]   = useState(false);
  const [newDeal, setNewDeal]         = useState({ title: "", company: "", value: "", stage: "nuovo" as Stage });
  const { toast } = useToast();

  const filtered = deals.filter((d) => {
    if (!search) return true;
    return d.title.toLowerCase().includes(search.toLowerCase()) || d.company.toLowerCase().includes(search.toLowerCase());
  });

  const stageDeals = (s: Stage) => filtered.filter((d) => d.stage === s);
  const pipelineTotal = filtered.filter((d) => !["vinto","perso"].includes(d.stage)).reduce((sum, d) => sum + d.value, 0);
  const wonTotal = filtered.filter((d) => d.stage === "vinto").reduce((sum, d) => sum + d.value, 0);
  const weightedTotal = filtered.filter((d) => !["vinto","perso"].includes(d.stage)).reduce((sum, d) => sum + d.value * d.probability / 100, 0);

  const moveStage = (id: number, stage: Stage) =>
    setDeals((ds) => ds.map((d) => d.id === id ? { ...d, stage, probability: stage === "vinto" ? 100 : stage === "perso" ? 0 : d.probability } : d));

  const deleteDeal = (id: number) => { setDeals((ds) => ds.filter((d) => d.id !== id)); toast({ title: "Deal eliminata" }); };

  const handleCreate = () => {
    if (!newDeal.title.trim()) return;
    const d: Deal = { id: Date.now(), title: newDeal.title, company: newDeal.company, contact: "", value: Number(newDeal.value) || 0, stage: newDeal.stage, probability: 20, closeDate: new Date(Date.now() + 30 * 86400000).toISOString().slice(0,10), owner: "Tu", tags: [], priority: "medium" };
    setDeals((ds) => [d, ...ds]);
    setNewDeal({ title: "", company: "", value: "", stage: "nuovo" });
    setShowCreate(false);
    toast({ title: "Deal creata", description: d.title });
  };

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6 pt-4 animate-in fade-in duration-500">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Pipeline Vendite</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {filtered.filter((d) => !["vinto","perso"].includes(d.stage)).length} deal attive · Pipeline {fmt(pipelineTotal)}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setView(view === "kanban" ? "list" : "kanban")}>
            {view === "kanban" ? <List className="h-4 w-4 mr-1.5" /> : <KanbanSquare className="h-4 w-4 mr-1.5" />}
            {view === "kanban" ? "Lista" : "Kanban"}
          </Button>
          <Button onClick={() => setShowCreate(true)} className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
            <Plus className="h-4 w-4 mr-1.5" /> Nuova Deal
          </Button>
        </div>
      </div>

      {/* KPI Strip */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Pipeline Totale", value: fmt(pipelineTotal), icon: DollarSign, color: "indigo" },
          { label: "Deal Vinte", value: fmt(wonTotal), icon: TrendingUp, color: "emerald" },
          { label: "Valore Pesato", value: fmt(weightedTotal), icon: Target, color: "amber" },
          { label: "Deal Attive", value: String(filtered.filter((d) => !["vinto","perso"].includes(d.stage)).length), icon: Users, color: "sky" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3 px-4">
              <div className={`h-8 w-8 rounded-lg bg-${color}-100 dark:bg-${color}-900/20 flex items-center justify-center mb-2`}>
                <Icon className={`h-4 w-4 text-${color}-600 dark:text-${color}-400`} />
              </div>
              <div className="text-xl font-bold">{value}</div>
              <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Cerca deal..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* KANBAN VIEW */}
      {view === "kanban" ? (
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STAGES.map(({ key, label, color, dotColor }) => {
            const sDeals = stageDeals(key);
            const total = sDeals.reduce((s, d) => s + d.value, 0);
            return (
              <div
                key={key}
                className={cn("flex-shrink-0 w-64 rounded-xl transition-colors", dragOverStage === key ? "bg-indigo-50 dark:bg-indigo-950/20" : "")}
                onDragOver={(e) => { e.preventDefault(); setDragOver(key); }}
                onDragLeave={() => setDragOver(null)}
                onDrop={() => { if (draggedId != null) { moveStage(draggedId, key); setDraggedId(null); setDragOver(null); } }}
              >
                {/* Column header */}
                <div className="flex items-center justify-between px-2 py-3 sticky top-0">
                  <div className="flex items-center gap-2">
                    <div className={cn("h-2 w-2 rounded-full", dotColor)} />
                    <span className="text-sm font-semibold">{label}</span>
                    <span className="text-xs font-medium text-muted-foreground bg-muted px-1.5 py-0.5 rounded-full">{sDeals.length}</span>
                  </div>
                  <span className="text-xs font-medium text-muted-foreground">{fmt(total)}</span>
                </div>

                {/* Cards */}
                <div className="flex flex-col gap-2 px-1">
                  {sDeals.map((deal) => {
                    const daysLeft = Math.ceil((new Date(deal.closeDate).getTime() - Date.now()) / 86400000);
                    const isOverdue = daysLeft < 0;
                    return (
                      <div
                        key={deal.id}
                        draggable
                        onDragStart={() => setDraggedId(deal.id)}
                        onDragEnd={() => { setDraggedId(null); setDragOver(null); }}
                        className={cn(
                          "bg-card border rounded-xl p-3.5 cursor-grab active:cursor-grabbing transition-all duration-150",
                          draggedId === deal.id ? "opacity-50 border-indigo-400" : "hover:border-indigo-300 dark:hover:border-indigo-700",
                        )}
                      >
                        <div className="flex justify-between items-start gap-2 mb-2">
                          <p className="text-sm font-semibold leading-snug flex-1">{deal.title}</p>
                          <span className={cn("text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0", PRIORITY_COLORS[deal.priority])}>
                            {PRIORITY_LABEL[deal.priority]}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
                          <Building2 className="h-3 w-3" /> {deal.company}
                        </div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-base font-bold">{fmt(deal.value)}</span>
                          <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">{deal.probability}%</span>
                        </div>
                        <Progress
                          value={deal.probability}
                          className={cn("h-1 mb-3", deal.probability >= 70 ? "[&>div]:bg-emerald-500" : deal.probability >= 40 ? "[&>div]:bg-amber-500" : "[&>div]:bg-indigo-500")}
                        />
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Avatar className="h-5 w-5">
                              <AvatarFallback className="text-[9px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                                {deal.owner.split(" ").map((w) => w[0]).join("")}
                              </AvatarFallback>
                            </Avatar>
                            <span className="text-[11px] text-muted-foreground">{deal.owner}</span>
                          </div>
                          <span className={cn("text-[11px] flex items-center gap-1", isOverdue ? "text-red-500 font-semibold" : "text-muted-foreground")}>
                            <Calendar className="h-3 w-3" />
                            {isOverdue ? "Scaduto" : `${daysLeft}g`}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  {sDeals.length === 0 && (
                    <div className="border-2 border-dashed rounded-xl p-6 text-center">
                      <p className="text-xs text-muted-foreground">Trascina qui</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        /* LIST VIEW */
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  {["Deal", "Azienda", "Valore", "Fase", "Probabilità", "Chiusura", "Owner", ""].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((deal) => {
                  const stage = STAGES.find((s) => s.key === deal.stage)!;
                  return (
                    <tr key={deal.id} className="border-b hover:bg-muted/30 transition-colors group">
                      <td className="px-4 py-3">
                        <div className="font-medium">{deal.title}</div>
                        <div className="flex gap-1 mt-1">
                          {deal.tags.map((t) => (
                            <span key={t} className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{t}</span>
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{deal.company}</td>
                      <td className="px-4 py-3 font-bold">{fmt(deal.value)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("text-xs font-semibold px-2 py-1 rounded-full", stage.color)}>{stage.label}</span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Progress value={deal.probability} className="h-1.5 w-16 [&>div]:bg-indigo-500" />
                          <span className="text-xs font-semibold">{deal.probability}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {new Date(deal.closeDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <Avatar className="h-6 w-6">
                            <AvatarFallback className="text-[10px] bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
                              {deal.owner.split(" ").map((w) => w[0]).join("")}
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">{deal.owner}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem><Edit2 className="mr-2 h-4 w-4" /> Modifica</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => deleteDeal(deal.id)} className="text-red-600 focus:text-red-600">
                              <Trash2 className="mr-2 h-4 w-4" /> Elimina
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-[440px]">
          <DialogHeader>
            <DialogTitle>Nuova Deal</DialogTitle>
            <DialogDescription>Aggiungi una nuova opportunità alla pipeline.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Titolo *</Label>
              <Input placeholder="Es. Progetto e-commerce AcmeCorp" value={newDeal.title} onChange={(e) => setNewDeal({ ...newDeal, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label>Azienda</Label>
                <Input placeholder="Nome azienda" value={newDeal.company} onChange={(e) => setNewDeal({ ...newDeal, company: e.target.value })} />
              </div>
              <div className="grid gap-2">
                <Label>Valore €</Label>
                <Input type="number" placeholder="0" value={newDeal.value} onChange={(e) => setNewDeal({ ...newDeal, value: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Fase</Label>
              <Select value={newDeal.stage} onValueChange={(v) => setNewDeal({ ...newDeal, stage: v as Stage })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STAGES.map((s) => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Annulla</Button>
            <Button onClick={handleCreate} disabled={!newDeal.title.trim()} className="bg-indigo-600 hover:bg-indigo-700 text-white">Crea Deal</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
