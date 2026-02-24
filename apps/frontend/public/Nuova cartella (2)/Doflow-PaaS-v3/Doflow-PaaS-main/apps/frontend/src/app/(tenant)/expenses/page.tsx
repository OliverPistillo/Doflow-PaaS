"use client";

import { useState, useMemo } from "react";
import { Receipt, Plus, Search, Download, Filter, Check, X, Clock,
  Wallet, TrendingDown, AlertTriangle, ChevronDown, Upload, Eye,
  CheckCircle2, XCircle, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";

// ─── Types ────────────────────────────────────────────────────────────────────

type ExpenseStatus   = "approvata" | "in_attesa" | "rifiutata";
type ExpenseCategory = "Software" | "Infrastruttura" | "Rappresentanza" | "Trasferta" | "Hardware" | "Formazione" | "Marketing";

interface Expense {
  id: number;
  title: string;
  category: ExpenseCategory;
  amount: number;
  date: string;
  user: string;
  status: ExpenseStatus;
  receipt: boolean;
  notes: string;
  vendor: string;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const EXPENSES: Expense[] = [
  { id: 1,  title: "Licenza Figma Team",            category: "Software",       amount: 144.00, date: "2026-02-18", user: "Marco R.",  status: "approvata", receipt: true,  notes: "Piano annuale team 3 utenti",                   vendor: "Figma Inc." },
  { id: 2,  title: "Hosting AWS — Febbraio",        category: "Infrastruttura", amount: 387.50, date: "2026-02-15", user: "Giulia B.", status: "approvata", receipt: true,  notes: "Server produzione + staging",                   vendor: "Amazon AWS" },
  { id: 3,  title: "Pranzo cliente BigCorp",         category: "Rappresentanza", amount: 85.00,  date: "2026-02-12", user: "Marco R.",  status: "approvata", receipt: true,  notes: "Pranzo di lavoro con Alessandro Galli",         vendor: "Ristorante Da Mario" },
  { id: 4,  title: "Abbonamento GitHub Team",       category: "Software",       amount: 63.00,  date: "2026-02-10", user: "Giulia B.", status: "approvata", receipt: true,  notes: "5 seat × $4/mese",                              vendor: "GitHub" },
  { id: 5,  title: "Google Workspace Business",     category: "Software",       amount: 276.00, date: "2026-02-01", user: "Sara M.",   status: "approvata", receipt: true,  notes: "20 utenti × €11.50 + IVA",                      vendor: "Google" },
  { id: 6,  title: "Viaggio Roma — meeting BigCorp",category: "Trasferta",      amount: 320.00, date: "2026-02-11", user: "Marco R.",  status: "approvata", receipt: true,  notes: "Treno A/R Milano-Roma + metro",                  vendor: "Trenitalia" },
  { id: 7,  title: "Hotel Roma — 1 notte",          category: "Trasferta",      amount: 145.00, date: "2026-02-11", user: "Marco R.",  status: "approvata", receipt: true,  notes: "Pernottamento per meeting BigCorp",              vendor: "Hotel Quirinale" },
  { id: 8,  title: "Licenza Adobe Creative Cloud",  category: "Software",       amount: 599.00, date: "2026-02-05", user: "Luca P.",   status: "approvata", receipt: true,  notes: "Piano all-apps annuale",                        vendor: "Adobe" },
  { id: 9,  title: "Attrezzatura ufficio — monitor",category: "Hardware",       amount: 449.00, date: "2026-02-19", user: "Sara M.",   status: "in_attesa", receipt: true,  notes: "Monitor 27\" 4K per postazione design",         vendor: "Amazon Business" },
  { id: 10, title: "Corso online AI/ML",            category: "Formazione",     amount: 199.00, date: "2026-02-17", user: "Giulia B.", status: "in_attesa", receipt: false, notes: "Corso avanzato machine learning — Coursera",    vendor: "Coursera" },
  { id: 11, title: "Pubblicità LinkedIn",           category: "Marketing",      amount: 500.00, date: "2026-02-08", user: "Luca P.",   status: "approvata", receipt: true,  notes: "Campagna lead generation febbraio",              vendor: "LinkedIn Ads" },
  { id: 12, title: "Taxi aeroporto — evento Milano",category: "Trasferta",      amount: 35.00,  date: "2026-02-20", user: "Marco R.",  status: "rifiutata", receipt: false, notes: "Scontrino non leggibile",                        vendor: "Taxi Milano" },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<ExpenseStatus, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{className?: string}> }> = {
  approvata: { label: "Approvata",  color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40", border: "border-emerald-200", icon: CheckCircle2 },
  in_attesa: { label: "In attesa",  color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-950/40",     border: "border-amber-200",   icon: Clock },
  rifiutata: { label: "Rifiutata",  color: "text-rose-600",    bg: "bg-rose-100 dark:bg-rose-950/40",       border: "border-rose-200",    icon: XCircle },
};

const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
  Software:       "#6366f1",
  Infrastruttura: "#10b981",
  Rappresentanza: "#f59e0b",
  Trasferta:      "#3b82f6",
  Hardware:       "#8b5cf6",
  Formazione:     "#06b6d4",
  Marketing:      "#f43f5e",
};

const AVATAR_COLORS: Record<string, string> = {
  "Marco R.": "bg-indigo-500", "Giulia B.": "bg-emerald-500",
  "Luca P.": "bg-violet-500",  "Sara M.": "bg-rose-500",
};

const CATEGORIES: ExpenseCategory[] = ["Software", "Infrastruttura", "Rappresentanza", "Trasferta", "Hardware", "Formazione", "Marketing"];
const ALL_USERS  = ["Tutti", "Marco R.", "Giulia B.", "Luca P.", "Sara M."];
const ALL_STATUS: Array<"Tutti" | ExpenseStatus> = ["Tutti", "approvata", "in_attesa", "rifiutata"];

// ─── Stats ────────────────────────────────────────────────────────────────────

const fmt = (n: number) => `€ ${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const totalAll    = EXPENSES.reduce((s, e) => s + e.amount, 0);
const totalApproved = EXPENSES.filter(e => e.status === "approvata").reduce((s, e) => s + e.amount, 0);
const totalPending  = EXPENSES.filter(e => e.status === "in_attesa").reduce((s, e) => s + e.amount, 0);

// Chart: by category
const CHART_DATA = CATEGORIES.map(cat => ({
  cat, total: EXPENSES.filter(e => e.category === cat).reduce((s, e) => s + e.amount, 0),
})).filter(d => d.total > 0).sort((a, b) => b.total - a.total);

// ─── Row detail dialog ────────────────────────────────────────────────────────

function ExpenseDetail({ expense, onClose, onApprove, onReject }: {
  expense: Expense;
  onClose: () => void;
  onApprove: (id: number) => void;
  onReject: (id: number) => void;
}) {
  const st = STATUS_CONFIG[expense.status];
  const StIcon = st.icon;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-base">{expense.title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {/* Amount + status */}
          <div className="flex items-center justify-between">
            <span className="text-2xl font-black tabular-nums">{fmt(expense.amount)}</span>
            <Badge variant="outline" className={cn("text-xs", st.color, "border-current/30", st.bg)}>
              <StIcon className="h-3 w-3 mr-1" />{st.label}
            </Badge>
          </div>
          <Separator />
          {/* Details */}
          <div className="space-y-2 text-sm">
            {[
              { label: "Categoria",  value: expense.category },
              { label: "Fornitore",  value: expense.vendor },
              { label: "Data",       value: new Date(expense.date).toLocaleDateString("it-IT") },
              { label: "Richiesto da", value: expense.user },
              { label: "Scontrino",  value: expense.receipt ? "✅ Allegato" : "❌ Mancante" },
            ].map(r => (
              <div key={r.label} className="flex justify-between">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="font-medium">{r.value}</span>
              </div>
            ))}
          </div>
          {expense.notes && (
            <div className="bg-muted/40 rounded-lg px-3 py-2 text-sm text-muted-foreground">{expense.notes}</div>
          )}
          {!expense.receipt && (
            <div className="flex items-start gap-2 text-xs text-amber-600 bg-amber-50 dark:bg-amber-950/20 rounded-lg px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              Scontrino/ricevuta mancante. Richiedere al dipendente prima dell'approvazione.
            </div>
          )}
        </div>
        <DialogFooter className="gap-2">
          <Button variant="outline" size="sm" onClick={onClose}>Chiudi</Button>
          {expense.status === "in_attesa" && (
            <>
              <Button size="sm" variant="outline" className="text-rose-600 border-rose-200" onClick={() => { onReject(expense.id); onClose(); }}>
                <X className="h-3.5 w-3.5 mr-1" /> Rifiuta
              </Button>
              <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={() => { onApprove(expense.id); onClose(); }}>
                <Check className="h-3.5 w-3.5 mr-1" /> Approva
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [expenses, setExpenses] = useState<Expense[]>(EXPENSES);
  const [search, setSearch]     = useState("");
  const [userFilter, setUser]   = useState("Tutti");
  const [statusFilter, setStat] = useState<"Tutti" | ExpenseStatus>("Tutti");
  const [catFilter, setCat]     = useState("Tutti");
  const [selected, setSelected] = useState<Expense | null>(null);

  const filtered = useMemo(() => expenses.filter(e => {
    if (userFilter   !== "Tutti" && e.user     !== userFilter)          return false;
    if (statusFilter !== "Tutti" && e.status   !== statusFilter)        return false;
    if (catFilter    !== "Tutti" && e.category !== catFilter)           return false;
    if (search && !`${e.title} ${e.vendor} ${e.category}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [expenses, search, userFilter, statusFilter, catFilter]);

  const handleApprove = (id: number) => setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: "approvata" as const } : e));
  const handleReject  = (id: number) => setExpenses(prev => prev.map(e => e.id === id ? { ...e, status: "rifiutata" as const } : e));

  const pending = expenses.filter(e => e.status === "in_attesa");

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-5">

      {selected && (
        <ExpenseDetail
          expense={selected}
          onClose={() => setSelected(null)}
          onApprove={handleApprove}
          onReject={handleReject}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Note Spese</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {expenses.length} spese · {fmt(totalAll)} totale · {pending.length} da approvare
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" /> Esporta</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
            <Plus className="mr-1.5 h-4 w-4" /> Aggiungi spesa
          </Button>
        </div>
      </div>

      {/* KPI + chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Totale spese",    value: fmt(totalAll),      icon: Wallet,       color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/30" },
            { label: "Approvate",       value: fmt(totalApproved), icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { label: "In attesa",       value: fmt(totalPending),  icon: Clock,        color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30" },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-3 rounded-xl border border-border/60 bg-card px-4 py-3">
              <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", s.bg)}>
                <s.icon className={cn("h-4 w-4", s.color)} />
              </div>
              <div>
                <p className="text-[11px] text-muted-foreground">{s.label}</p>
                <p className="text-sm font-bold tabular-nums">{s.value}</p>
              </div>
            </div>
          ))}

          {/* Pending alert */}
          {pending.length > 0 && (
            <div className="sm:col-span-3 flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800/40 px-4 py-3">
              <div className="flex items-center gap-2 text-sm">
                <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                <span className="text-amber-900 dark:text-amber-200 font-medium">
                  {pending.length} {pending.length === 1 ? "spesa in attesa" : "spese in attesa"} di approvazione
                </span>
              </div>
              <Button variant="outline" size="sm" className="text-xs border-amber-300 text-amber-700 shrink-0"
                onClick={() => setStat("in_attesa")}>
                Rivedi
              </Button>
            </div>
          )}
        </div>

        {/* By category chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Per categoria</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <ResponsiveContainer width="100%" height={140}>
              <BarChart data={CHART_DATA} layout="vertical" margin={{ left: 0, right: 10 }}>
                <XAxis type="number" tickFormatter={v => `€${(v/1000).toFixed(0)}k`} tick={{ fontSize: 10 }} />
                <YAxis type="category" dataKey="cat" tick={{ fontSize: 10 }} width={80} />
                <Tooltip formatter={(v: any) => fmt(v)} />
                <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                  {CHART_DATA.map((d, i) => (
                    <Cell key={i} fill={CATEGORY_COLORS[d.cat as ExpenseCategory] ?? "#6366f1"} />
                  ))}
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
          <Input placeholder="Cerca spese..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={userFilter} onValueChange={setUser}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Utente" /></SelectTrigger>
          <SelectContent>
            {ALL_USERS.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={v => setStat(v as any)}>
          <SelectTrigger className="w-full sm:w-40"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            {ALL_STATUS.map(s => <SelectItem key={s} value={s}>{s === "Tutti" ? "Tutti gli stati" : STATUS_CONFIG[s as ExpenseStatus]?.label ?? s}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={catFilter} onValueChange={setCat}>
          <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="Categoria" /></SelectTrigger>
          <SelectContent>
            {["Tutti", ...CATEGORIES].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="hidden sm:grid grid-cols-[auto_1fr_auto_auto_auto_auto] gap-4 px-5 py-2.5 border-b border-border/50 text-xs font-semibold uppercase tracking-wide text-muted-foreground/60">
          <div className="w-8" />
          <div>Spesa</div>
          <div className="w-32 text-right">Importo</div>
          <div className="w-28">Stato</div>
          <div className="w-28">Data</div>
          <div className="w-12" />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <Receipt className="h-8 w-8 mb-3 opacity-40" />
            <p>Nessuna spesa trovata.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(e => {
              const st = STATUS_CONFIG[e.status];
              const StIcon = st.icon;
              return (
                <div
                  key={e.id}
                  className="flex items-center gap-4 px-5 py-3 hover:bg-muted/20 transition-colors cursor-pointer group"
                  onClick={() => setSelected(e)}
                >
                  {/* Avatar */}
                  <Avatar className="h-7 w-7 shrink-0">
                    <AvatarFallback className={cn("text-[9px] font-bold text-white", AVATAR_COLORS[e.user] ?? "bg-slate-500")}>
                      {e.user.split(" ").map(p => p[0]).join("")}
                    </AvatarFallback>
                  </Avatar>

                  {/* Title */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{e.title}</p>
                      {!e.receipt && (
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" title="Scontrino mancante" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{e.vendor} · {e.user}</p>
                  </div>

                  {/* Amount */}
                  <div className="hidden sm:block w-32 text-right">
                    <p className="font-bold tabular-nums text-sm">{fmt(e.amount)}</p>
                    <p className="text-xs text-muted-foreground">{e.category}</p>
                  </div>

                  {/* Status */}
                  <div className="hidden sm:block w-28">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", st.color, "border-current/30", st.bg)}>
                      <StIcon className="h-2.5 w-2.5 mr-1" />{st.label}
                    </Badge>
                  </div>

                  {/* Date */}
                  <div className="hidden sm:block w-28 text-xs text-muted-foreground tabular-nums">
                    {new Date(e.date).toLocaleDateString("it-IT")}
                  </div>

                  {/* Actions */}
                  {e.status === "in_attesa" && (
                    <div className="flex items-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/30"
                        onClick={ev => { ev.stopPropagation(); handleApprove(e.id); }}
                      >
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                        onClick={ev => { ev.stopPropagation(); handleReject(e.id); }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Total row */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-muted/20">
          <span className="text-sm font-semibold text-muted-foreground">{filtered.length} spese filtrate</span>
          <span className="font-bold tabular-nums">
            {fmt(filtered.reduce((s, e) => s + e.amount, 0))}
          </span>
        </div>
      </Card>
    </div>
  );
}
