"use client";

import { useState, useMemo } from "react";
import {
  Package, PackageX, Plus, Search, AlertTriangle, ArrowUpDown,
  TrendingUp, TrendingDown, Edit2, BarChart2, Warehouse, ArrowUp,
  ArrowDown, RefreshCw, SlidersHorizontal, Download,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type StockStatus = "ok" | "sottoscorta" | "critico" | "esaurito";

interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  category: string;
  location: string;
  qty: number;
  minQty: number;
  maxQty: number;
  unit: string;
  value: number;
  lastMovement: string;
  status: StockStatus;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const INVENTORY: InventoryItem[] = [
  { id: 1,  sku: "PRD-HST-001", name: "Hosting Cloud Premium",       category: "Infrastruttura", location: "Mag. Digitale", qty: 200, minQty: 50,  maxQty: 500, unit: "licenza", value: 49,   lastMovement: "2026-02-18", status: "ok" },
  { id: 2,  sku: "PRD-CRM-001", name: "Licenza CRM DoFlow",           category: "Software",       location: "Mag. Digitale", qty: 150, minQty: 20,  maxQty: 300, unit: "licenza", value: 29,   lastMovement: "2026-02-20", status: "ok" },
  { id: 3,  sku: "PRD-ECM-001", name: "Plugin E-commerce",            category: "Software",       location: "Mag. Digitale", qty: 8,   minQty: 15,  maxQty: 100, unit: "licenza", value: 199,  lastMovement: "2026-02-10", status: "sottoscorta" },
  { id: 4,  sku: "HW-MNT-27",   name: "Monitor 27\" 4K LG",          category: "Hardware",       location: "Magazzino A",   qty: 3,   minQty: 5,   maxQty: 20,  unit: "pz",      value: 449,  lastMovement: "2026-02-19", status: "sottoscorta" },
  { id: 5,  sku: "HW-LAP-14",   name: "MacBook Pro 14\" M4",          category: "Hardware",       location: "Magazzino A",   qty: 2,   minQty: 2,   maxQty: 10,  unit: "pz",      value: 2499, lastMovement: "2026-02-05", status: "critico" },
  { id: 6,  sku: "HW-DOCK-01",  name: "Docking Station USB-C",        category: "Hardware",       location: "Magazzino A",   qty: 12,  minQty: 5,   maxQty: 30,  unit: "pz",      value: 89,   lastMovement: "2026-02-14", status: "ok" },
  { id: 7,  sku: "HW-HEAD-01",  name: "Cuffie Sony WH-1000XM5",       category: "Hardware",       location: "Magazzino A",   qty: 0,   minQty: 3,   maxQty: 15,  unit: "pz",      value: 329,  lastMovement: "2026-01-28", status: "esaurito" },
  { id: 8,  sku: "OFF-CHAIR-01",name: "Sedia ergonomica Herman Miller",category: "Arredamento",   location: "Magazzino B",   qty: 4,   minQty: 2,   maxQty: 10,  unit: "pz",      value: 1290, lastMovement: "2026-02-01", status: "ok" },
  { id: 9,  sku: "OFF-DESK-01", name: "Scrivania sit-stand Flexispot", category: "Arredamento",   location: "Magazzino B",   qty: 6,   minQty: 3,   maxQty: 15,  unit: "pz",      value: 549,  lastMovement: "2026-01-20", status: "ok" },
  { id: 10, sku: "NET-SW-48",   name: "Switch di rete 48 porte",       category: "Networking",    location: "Magazzino A",   qty: 1,   minQty: 2,   maxQty: 5,   unit: "pz",      value: 890,  lastMovement: "2026-02-12", status: "sottoscorta" },
];

const CATEGORIES = ["Hardware", "Software", "Infrastruttura", "Arredamento", "Networking"];

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<StockStatus, { label: string; color: string; bg: string; border: string }> = {
  ok:           { label: "Disponibile",  color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40",  border: "border-emerald-200" },
  sottoscorta:  { label: "Sottoscorta",  color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-950/40",     border: "border-amber-200" },
  critico:      { label: "Critico",      color: "text-rose-600",    bg: "bg-rose-100 dark:bg-rose-950/40",       border: "border-rose-300" },
  esaurito:     { label: "Esaurito",     color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/40",     border: "border-slate-200" },
};

const CAT_COLORS: Record<string, string> = {
  Hardware: "#6366f1", Software: "#10b981", Infrastruttura: "#3b82f6",
  Arredamento: "#f59e0b", Networking: "#8b5cf6",
};

const fmt = (n: number) => `€ ${n.toLocaleString("it-IT")}`;

// ─── Item detail dialog ───────────────────────────────────────────────────────

function ItemDetail({ item, onClose }: { item: InventoryItem; onClose: () => void }) {
  const sc = STATUS_CFG[item.status];
  const stockPct = Math.min(100, Math.round((item.qty / item.maxQty) * 100));
  const minPct   = Math.round((item.minQty / item.maxQty) * 100);

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
              <Package className="h-5 w-5 text-indigo-600" />
            </div>
            <div>
              <DialogTitle className="text-base">{item.name}</DialogTitle>
              <p className="text-xs text-muted-foreground font-mono mt-0.5">{item.sku}</p>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4">
          {/* Status */}
          <Badge variant="outline" className={cn("text-xs", sc.color, "border-current/30", sc.bg)}>
            {sc.label}
          </Badge>

          {/* Stock level visual */}
          <div>
            <div className="flex justify-between text-xs mb-1.5">
              <span className="text-muted-foreground">Quantità attuale</span>
              <span className="font-bold tabular-nums">{item.qty} / {item.maxQty} {item.unit}</span>
            </div>
            <div className="relative h-3 bg-muted rounded-full overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all", item.status === "ok" ? "bg-emerald-500" : item.status === "sottoscorta" ? "bg-amber-500" : item.status === "critico" ? "bg-rose-500" : "bg-slate-400")}
                style={{ width: `${stockPct}%` }}
              />
              {/* Min marker */}
              <div className="absolute top-0 bottom-0 w-0.5 bg-rose-400" style={{ left: `${minPct}%` }} title={`Minimo: ${item.minQty}`} />
            </div>
            <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
              <span>0</span>
              <span className="text-rose-500">min {item.minQty}</span>
              <span>max {item.maxQty}</span>
            </div>
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-2 text-sm">
            {[
              { label: "Categoria",         value: item.category },
              { label: "Ubicazione",        value: item.location },
              { label: "Unità",             value: item.unit },
              { label: "Valore unitario",   value: fmt(item.value) },
              { label: "Valore totale",     value: fmt(item.qty * item.value) },
              { label: "Ultima movimentazione", value: new Date(item.lastMovement).toLocaleDateString("it-IT") },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium">{r.value}</span>
              </div>
            ))}
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Chiudi</Button>
          <Button variant="outline" size="sm">
            <ArrowDown className="mr-1.5 h-3.5 w-3.5 text-rose-500" /> Scarico
          </Button>
          <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
            <ArrowUp className="mr-1.5 h-3.5 w-3.5" /> Carico
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [search, setSearch]       = useState("");
  const [catFilter, setCat]       = useState("Tutti");
  const [statusFilter, setStatus] = useState("Tutti");
  const [selected, setSelected]   = useState<InventoryItem | null>(null);

  const filtered = useMemo(() => INVENTORY.filter(i => {
    if (catFilter    !== "Tutti" && i.category !== catFilter) return false;
    if (statusFilter !== "Tutti" && i.status   !== statusFilter) return false;
    if (search && !`${i.name} ${i.sku} ${i.category}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [search, catFilter, statusFilter]);

  const totalValue  = INVENTORY.reduce((s, i) => s + i.qty * i.value, 0);
  const alertCount  = INVENTORY.filter(i => ["sottoscorta","critico","esaurito"].includes(i.status)).length;
  const stockedOut  = INVENTORY.filter(i => i.status === "esaurito").length;

  // Chart data: category total value
  const chartData = CATEGORIES.map(cat => ({
    cat: cat.slice(0, 8),
    value: INVENTORY.filter(i => i.category === cat).reduce((s, i) => s + i.qty * i.value, 0),
    color: CAT_COLORS[cat],
  })).filter(d => d.value > 0);

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-5">

      {selected && <ItemDetail item={selected} onClose={() => setSelected(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Magazzino</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {INVENTORY.length} articoli · {alertCount} alert · {fmt(totalValue)} valore totale
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" /> Esporta</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
            <Plus className="mr-1.5 h-4 w-4" /> Nuovo articolo
          </Button>
        </div>
      </div>

      {/* KPI + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Articoli totali",  value: String(INVENTORY.length), icon: Package,    color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/30" },
            { label: "Valore magazzino", value: fmt(totalValue),           icon: BarChart2,  color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { label: "Alert scorte",     value: String(alertCount),        icon: AlertTriangle, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-950/30" },
            { label: "Esauriti",         value: String(stockedOut),        icon: PackageX,   color: "text-rose-600",    bg: "bg-rose-50 dark:bg-rose-950/30" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className="text-base font-bold tabular-nums">{s.value}</p>
              </div>
            </div>
          ))}

          {/* Alert cards */}
          {INVENTORY.filter(i => ["critico","esaurito"].includes(i.status)).map(i => {
            const sc = STATUS_CFG[i.status];
            return (
              <div
                key={i.id}
                className={cn("sm:col-span-4 flex items-center gap-3 rounded-xl px-4 py-2.5 border cursor-pointer transition-colors hover:opacity-90", sc.bg, sc.border)}
                onClick={() => setSelected(i)}
              >
                <AlertTriangle className={cn("h-4 w-4 shrink-0", sc.color)} />
                <div className="flex-1 min-w-0">
                  <span className={cn("text-sm font-semibold", sc.color)}>{i.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">{i.sku}</span>
                </div>
                <Badge variant="outline" className={cn("text-[10px] shrink-0", sc.color, "border-current/30")}>{sc.label}</Badge>
                <span className="text-xs font-bold tabular-nums">{i.qty} {i.unit}</span>
              </div>
            );
          })}
        </div>

        {/* Category chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Valore per categoria</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={chartData} margin={{ top: 0, right: 5, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="cat" tick={{ fontSize: 9 }} />
                <YAxis tickFormatter={v => `€${(v/1000).toFixed(0)}k`} tick={{ fontSize: 9 }} />
                <Tooltip formatter={(v: any) => fmt(v)} labelFormatter={l => l} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {chartData.map((d, i) => <Cell key={i} fill={d.color} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca articoli, SKU..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={catFilter} onValueChange={setCat}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            {["Tutti", ...CATEGORIES].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatus}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Stato scorte" /></SelectTrigger>
          <SelectContent>
            {(["Tutti","ok","sottoscorta","critico","esaurito"] as const).map(s => (
              <SelectItem key={s} value={s}>{s === "Tutti" ? "Tutti gli stati" : STATUS_CFG[s as StockStatus]?.label ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        {/* Header */}
        <div className="hidden sm:grid grid-cols-[32px_1fr_90px_auto_120px_100px_80px] gap-3 px-4 py-2.5 border-b border-border/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
          <div />
          <div>Articolo</div>
          <div>SKU</div>
          <div className="text-center">Scorta</div>
          <div className="text-right">Valore unit.</div>
          <div className="text-right">Valore tot.</div>
          <div className="text-center">Stato</div>
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <Package className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm">Nessun articolo trovato.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(item => {
              const sc = STATUS_CFG[item.status];
              const stockPct = Math.min(100, Math.round((item.qty / item.maxQty) * 100));

              return (
                <div
                  key={item.id}
                  className="grid grid-cols-[32px_1fr] sm:grid-cols-[32px_1fr_90px_auto_120px_100px_80px] gap-3 items-center px-4 py-3 hover:bg-muted/20 cursor-pointer transition-colors"
                  onClick={() => setSelected(item)}
                >
                  {/* Icon */}
                  <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", sc.bg)}>
                    <Package className={cn("h-3.5 w-3.5", sc.color)} />
                  </div>

                  {/* Name */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">{item.name}</p>
                    <p className="text-xs text-muted-foreground">{item.category} · {item.location}</p>
                  </div>

                  {/* SKU */}
                  <p className="hidden sm:block text-xs font-mono text-muted-foreground truncate">{item.sku}</p>

                  {/* Stock bar */}
                  <div className="hidden sm:block w-28">
                    <div className="flex items-center justify-between text-[10px] mb-1">
                      <span className="tabular-nums font-semibold">{item.qty}</span>
                      <span className="text-muted-foreground">/{item.maxQty} {item.unit}</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className={cn("h-full rounded-full",
                          item.status === "ok"          ? "bg-emerald-500" :
                          item.status === "sottoscorta" ? "bg-amber-500"   :
                          item.status === "critico"     ? "bg-rose-500"    : "bg-slate-400",
                        )}
                        style={{ width: `${stockPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Values */}
                  <p className="hidden sm:block text-sm font-medium tabular-nums text-right">{fmt(item.value)}</p>
                  <p className="hidden sm:block text-sm font-bold tabular-nums text-right">{fmt(item.qty * item.value)}</p>

                  {/* Status */}
                  <div className="hidden sm:flex justify-center">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", sc.color, "border-current/30", sc.bg)}>
                      {sc.label}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-border/50 bg-muted/20 text-sm">
          <span className="text-muted-foreground">{filtered.length} articoli</span>
          <span className="font-bold tabular-nums">
            {fmt(filtered.reduce((s, i) => s + i.qty * i.value, 0))}
          </span>
        </div>
      </Card>
    </div>
  );
}
