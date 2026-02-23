"use client";

import { useState, useMemo } from "react";
import {
  Receipt, Plus, Search, Download, Send, Eye, Copy, Printer,
  CheckCircle2, Clock, AlertTriangle, XCircle, FileText, Edit2,
  TrendingUp, DollarSign, ExternalLink, MoreHorizontal,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type InvoiceStatus = "bozza" | "inviata" | "pagata" | "parz_pagata" | "scaduta" | "annullata";

interface InvoiceItem { desc: string; qty: number; price: number }

interface Invoice {
  id: string;
  title: string;
  company: string;
  contact: string;
  orderId?: string;
  status: InvoiceStatus;
  issueDate: string;
  dueDate: string;
  paidDate?: string;
  subtotal: number;
  vat: number;
  withholding: number;
  total: number;
  paid: number;
  items: InvoiceItem[];
  paymentMethod: string;
  invoiceNumber: string;
}

// ─── Demo data ────────────────────────────────────────────────────────────────

const INVOICES: Invoice[] = [
  { id: "FT-2026-001", invoiceNumber: "FT-2026/001", title: "Sviluppo sito web DigitalWave",    company: "DigitalWave Srl",     contact: "Marco Ferretti",   orderId: "ORD-2026-006", status: "pagata",       issueDate: "2026-02-05", dueDate: "2026-03-07", paidDate: "2026-02-28", subtotal: 5960,  vat: 1311,  withholding: 0, total: 7271,  paid: 7271,  paymentMethod: "Bonifico bancario",
    items: [{ desc: "Sviluppo Sito Web", qty: 1, price: 5000 }, { desc: "Consulenza UX/UI — 8 ore", qty: 8, price: 120 }] },
  { id: "FT-2026-002", invoiceNumber: "FT-2026/002", title: "Brand Identity DesignStudio",      company: "DesignStudio Srl",    contact: "Elena Ferri",      orderId: "ORD-2026-003", status: "pagata",       issueDate: "2026-02-12", dueDate: "2026-03-14", paidDate: "2026-03-01", subtotal: 9836,  vat: 2164,  withholding: 0, total: 12000, paid: 12000, paymentMethod: "Carta di credito",
    items: [{ desc: "Brand strategy", qty: 1, price: 3000 }, { desc: "Logo e visual identity", qty: 1, price: 4500 }, { desc: "Brand guidelines", qty: 1, price: 2336 }] },
  { id: "FT-2026-003", invoiceNumber: "FT-2026/003", title: "Migrazione cloud BigCorp — Acc.",  company: "BigCorp SpA",         contact: "Alessandro Galli", orderId: "ORD-2026-002", status: "pagata",       issueDate: "2026-01-25", dueDate: "2026-03-25", paidDate: "2026-02-20", subtotal: 24590, vat: 5410,  withholding: 0, total: 30000, paid: 30000, paymentMethod: "Bonifico bancario",
    items: [{ desc: "Acconto 30% — Migrazione cloud", qty: 1, price: 24590 }] },
  { id: "FT-2026-004", invoiceNumber: "FT-2026/004", title: "E-commerce StartupIO — Fase 1",   company: "StartupIO",           contact: "Francesca Romano", orderId: "ORD-2026-001", status: "inviata",      issueDate: "2026-02-18", dueDate: "2026-03-20",                   subtotal: 4098,  vat: 902,   withholding: 0, total: 5000,  paid: 0,     paymentMethod: "Bonifico 30gg",
    items: [{ desc: "Sviluppo frontend e-commerce — Milestone 1", qty: 1, price: 4098 }] },
  { id: "FT-2026-005", invoiceNumber: "FT-2026/005", title: "CRM SmartFactory — Setup",        company: "SmartFactory",        contact: "Davide Colombo",   orderId: "ORD-2026-005", status: "inviata",      issueDate: "2026-02-15", dueDate: "2026-03-17",                   subtotal: 16393, vat: 3607,  withholding: 0, total: 20000, paid: 0,     paymentMethod: "Bonifico 30gg",
    items: [{ desc: "Implementazione CRM", qty: 1, price: 12000 }, { desc: "Formazione team", qty: 1, price: 450 }, { desc: "Licenze CRM 25 utenti — 3 mesi", qty: 75, price: 29 }, { desc: "Configurazione integrazioni", qty: 1, price: 1768 }] },
  { id: "FT-2026-006", invoiceNumber: "FT-2026/006", title: "Campagna digital MediaGroup",     company: "MediaGroup Italia",   contact: "Chiara Lombardi",              status: "scaduta",      issueDate: "2026-01-10", dueDate: "2026-02-09",                   subtotal: 4098,  vat: 902,   withholding: 0, total: 5000,  paid: 0,     paymentMethod: "Bonifico 30gg",
    items: [{ desc: "Strategia digital — Mese 1", qty: 1, price: 4098 }] },
  { id: "FT-2026-007", invoiceNumber: "FT-2026/007", title: "App Mobile InnovateIT — Design",  company: "InnovateIT",          contact: "Roberto Mazza",    orderId: "ORD-2026-007", status: "bozza",        issueDate: "2026-02-20", dueDate: "2026-03-22",                   subtotal: 5656,  vat: 1244,  withholding: 0, total: 6900,  paid: 0,     paymentMethod: "Bonifico 60gg",
    items: [{ desc: "Design UI/UX mobile — Wireframe + Mockup", qty: 1, price: 5656 }] },
  { id: "FT-2026-008", invoiceNumber: "FT-2026/008", title: "Migrazione cloud BigCorp — SAL 2",company: "BigCorp SpA",         contact: "Alessandro Galli", orderId: "ORD-2026-002", status: "parz_pagata",  issueDate: "2026-02-10", dueDate: "2026-04-10",                   subtotal: 28688, vat: 6312,  withholding: 0, total: 35000, paid: 15000, paymentMethod: "Bonifico 60gg",
    items: [{ desc: "Migrazione servizi cloud — Fase 2", qty: 1, price: 28688 }] },
];

// ─── Config ───────────────────────────────────────────────────────────────────

const STATUS_CFG: Record<InvoiceStatus, { label: string; color: string; bg: string; icon: React.ComponentType<{className?: string}> }> = {
  bozza:       { label: "Bozza",          color: "text-slate-600",   bg: "bg-slate-100 dark:bg-slate-800/40",      icon: Edit2 },
  inviata:     { label: "Inviata",         color: "text-indigo-600",  bg: "bg-indigo-100 dark:bg-indigo-950/40",    icon: Send },
  pagata:      { label: "Pagata",          color: "text-emerald-600", bg: "bg-emerald-100 dark:bg-emerald-950/40",  icon: CheckCircle2 },
  parz_pagata: { label: "Parz. pagata",    color: "text-amber-600",   bg: "bg-amber-100 dark:bg-amber-950/40",      icon: Clock },
  scaduta:     { label: "Scaduta",         color: "text-rose-600",    bg: "bg-rose-100 dark:bg-rose-950/40",        icon: AlertTriangle },
  annullata:   { label: "Annullata",       color: "text-slate-500",   bg: "bg-slate-100 dark:bg-slate-800/30",      icon: XCircle },
};

const fmt   = (n: number) => `€ ${n.toLocaleString("it-IT", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const FILTER_TABS: Array<{ key: string; label: string }> = [
  { key: "Tutti",       label: "Tutte" },
  { key: "bozza",      label: "Bozze" },
  { key: "inviata",    label: "Inviate" },
  { key: "pagata",     label: "Pagate" },
  { key: "parz_pagata",label: "Parz. pagate" },
  { key: "scaduta",    label: "Scadute" },
];

// ─── Invoice Sheet ────────────────────────────────────────────────────────────

function InvoiceSheet({ inv, onClose }: { inv: Invoice; onClose: () => void }) {
  const sc    = STATUS_CFG[inv.status];
  const StIcon = sc.icon;
  const overdue = inv.status === "scaduta";
  const daysDue = Math.round((new Date().getTime() - new Date(inv.dueDate).getTime()) / 86400000);

  return (
    <Sheet open onOpenChange={onClose}>
      <SheetContent className="w-full sm:w-[520px] overflow-y-auto">
        <SheetHeader className="pb-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-xl bg-indigo-100 dark:bg-indigo-950/40 flex items-center justify-center shrink-0">
              <Receipt className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-base">{inv.invoiceNumber}</SheetTitle>
              <p className="text-xs text-muted-foreground mt-0.5">{inv.title}</p>
            </div>
            <Badge variant="outline" className={cn("text-xs", sc.color, "border-current/30", sc.bg)}>
              <StIcon className="h-3 w-3 mr-1" />{sc.label}
            </Badge>
          </div>
        </SheetHeader>

        <div className="space-y-5">
          {/* Cliente */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Cliente</p>
              <p className="font-semibold text-sm">{inv.company}</p>
              <p className="text-xs text-muted-foreground">{inv.contact}</p>
            </div>
            {inv.orderId && (
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-1">Ordine</p>
                <p className="font-semibold text-sm font-mono">{inv.orderId}</p>
                <p className="text-xs text-muted-foreground">{inv.paymentMethod}</p>
              </div>
            )}
          </div>

          {/* Dates */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: "Emissione",  value: new Date(inv.issueDate).toLocaleDateString("it-IT") },
              { label: "Scadenza",   value: new Date(inv.dueDate).toLocaleDateString("it-IT"),  warn: overdue },
              { label: "Pagamento",  value: inv.paidDate ? new Date(inv.paidDate).toLocaleDateString("it-IT") : "—" },
            ].map(d => (
              <div key={d.label} className="bg-muted/30 rounded-lg p-2.5">
                <p className="text-[10px] text-muted-foreground">{d.label}</p>
                <p className={cn("text-xs font-bold mt-0.5", d.warn ? "text-rose-600" : "")}>{d.value}</p>
              </div>
            ))}
          </div>

          {overdue && (
            <div className="flex items-center gap-2 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-800/40 rounded-lg px-3 py-2 text-xs text-rose-700 dark:text-rose-300">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              Fattura scaduta da {daysDue} giorni — sollecito raccomandato
            </div>
          )}

          {/* Line items */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground/60 mb-2">Voci</p>
            <div className="space-y-1.5">
              {inv.items.map((item, i) => (
                <div key={i} className="flex items-center justify-between text-sm bg-muted/20 rounded-lg px-3 py-2">
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{item.desc}</p>
                    {item.qty > 1 && <p className="text-[10px] text-muted-foreground">{item.qty}x @ {fmt(item.price)}</p>}
                  </div>
                  <p className="font-semibold tabular-nums text-sm shrink-0 ml-2">{fmt(item.qty * item.price)}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Totals */}
          <div className="space-y-2 bg-muted/20 rounded-xl p-4">
            {[
              { label: "Imponibile", value: fmt(inv.subtotal) },
              { label: `IVA (${Math.round(inv.vat / inv.subtotal * 100)}%)`, value: fmt(inv.vat) },
            ].map(r => (
              <div key={r.label} className="flex justify-between text-sm">
                <span className="text-muted-foreground">{r.label}</span>
                <span className="tabular-nums">{r.value}</span>
              </div>
            ))}
            <Separator className="my-1" />
            <div className="flex justify-between font-black text-base">
              <span>Totale</span>
              <span className="tabular-nums">{fmt(inv.total)}</span>
            </div>
            {inv.status === "parz_pagata" && (
              <>
                <div className="flex justify-between text-sm text-emerald-600 font-medium">
                  <span>Pagato</span>
                  <span className="tabular-nums">{fmt(inv.paid)}</span>
                </div>
                <div className="flex justify-between text-sm text-rose-600 font-semibold">
                  <span>Residuo</span>
                  <span className="tabular-nums">{fmt(inv.total - inv.paid)}</span>
                </div>
                <Progress value={Math.round(inv.paid / inv.total * 100)} className="h-2 mt-1" />
              </>
            )}
          </div>
        </div>

        <SheetFooter className="mt-6 flex-wrap gap-2">
          <Button variant="outline" size="sm"><Printer className="mr-1.5 h-3.5 w-3.5" /> Stampa</Button>
          <Button variant="outline" size="sm"><Download className="mr-1.5 h-3.5 w-3.5" /> PDF</Button>
          {inv.status === "bozza" && (
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white">
              <Send className="mr-1.5 h-3.5 w-3.5" /> Invia fattura
            </Button>
          )}
          {inv.status === "scaduta" && (
            <Button size="sm" className="bg-rose-600 hover:bg-rose-700 text-white">
              <Send className="mr-1.5 h-3.5 w-3.5" /> Invia sollecito
            </Button>
          )}
          {["inviata","parz_pagata"].includes(inv.status) && (
            <Button size="sm" className="bg-emerald-600 hover:bg-emerald-700 text-white">
              <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" /> Segna pagata
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Page() {
  const [tab, setTab]         = useState("Tutti");
  const [search, setSearch]   = useState("");
  const [selected, setSel]    = useState<Invoice | null>(null);

  const totalInvoiced = INVOICES.reduce((s, i) => s + i.total, 0);
  const totalPaid     = INVOICES.filter(i => i.status === "pagata").reduce((s, i) => s + i.total, 0);
  const totalPending  = INVOICES.filter(i => ["inviata","parz_pagata"].includes(i.status)).reduce((s, i) => s + (i.total - i.paid), 0);
  const totalOverdue  = INVOICES.filter(i => i.status === "scaduta").reduce((s, i) => s + i.total, 0);

  const filtered = useMemo(() => INVOICES.filter(inv => {
    if (tab !== "Tutti" && inv.status !== tab) return false;
    if (search && !`${inv.title} ${inv.company} ${inv.invoiceNumber}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  }), [tab, search]);

  return (
    <div className="flex-1 p-4 md:p-6 animate-in fade-in duration-500 space-y-5">

      {selected && <InvoiceSheet inv={selected} onClose={() => setSel(null)} />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Fatture</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {INVOICES.length} fatture · {fmt(totalPaid)} incassato · {fmt(totalPending)} in attesa
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm"><Download className="mr-1.5 h-4 w-4" /> Esporta</Button>
          <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
            <Plus className="mr-1.5 h-4 w-4" /> Nuova Fattura
          </Button>
        </div>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "Totale fatturato",  value: fmt(totalInvoiced), icon: Receipt,      color: "text-indigo-600",  bg: "bg-indigo-50 dark:bg-indigo-950/30" },
          { label: "Incassato",         value: fmt(totalPaid),     icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
          { label: "In attesa",         value: fmt(totalPending),  icon: Clock,        color: "text-amber-600",   bg: "bg-amber-50 dark:bg-amber-950/30" },
          { label: "Scaduto",           value: fmt(totalOverdue),  icon: AlertTriangle,color: "text-rose-600",    bg: "bg-rose-50 dark:bg-rose-950/30" },
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
      </div>

      {/* Tabs + search */}
      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <div className="flex items-center gap-1 bg-muted rounded-xl p-1 overflow-x-auto">
          {FILTER_TABS.map(ft => (
            <button
              key={ft.key}
              onClick={() => setTab(ft.key)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors",
                tab === ft.key ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ft.label}
              <span className="ml-1.5 text-[10px] opacity-60">
                {ft.key === "Tutti" ? INVOICES.length : INVOICES.filter(i => i.status === ft.key).length}
              </span>
            </button>
          ))}
        </div>
        <div className="relative flex-1 sm:max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca fatture..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="hidden md:grid grid-cols-[1fr_140px_100px_110px_110px_80px_36px] gap-3 px-5 py-2.5 border-b border-border/50 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground/60">
          <div>Fattura</div>
          <div>Scadenza</div>
          <div className="text-right">Totale</div>
          <div className="text-right">Pagato</div>
          <div className="text-center">Stato</div>
          <div>Metodo</div>
          <div />
        </div>

        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <Receipt className="h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm">Nessuna fattura trovata.</p>
          </div>
        ) : (
          <div className="divide-y divide-border/40">
            {filtered.map(inv => {
              const sc = STATUS_CFG[inv.status];
              const StIcon = sc.icon;
              const overdue = inv.status === "scaduta";

              return (
                <div
                  key={inv.id}
                  className={cn(
                    "grid grid-cols-1 md:grid-cols-[1fr_140px_100px_110px_110px_80px_36px] gap-3 items-center px-5 py-3.5 cursor-pointer hover:bg-muted/20 transition-colors group",
                    overdue && "border-l-2 border-l-rose-500",
                  )}
                  onClick={() => setSel(inv)}
                >
                  {/* Title */}
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-indigo-600">{inv.invoiceNumber}</span>
                      {overdue && <AlertTriangle className="h-3 w-3 text-rose-500" />}
                    </div>
                    <p className="text-sm font-semibold truncate mt-0.5">{inv.title}</p>
                    <p className="text-xs text-muted-foreground">{inv.company} · {inv.contact}</p>
                  </div>

                  {/* Due date */}
                  <div className="hidden md:block">
                    <p className={cn("text-sm tabular-nums", overdue && "text-rose-600 font-semibold")}>
                      {new Date(inv.dueDate).toLocaleDateString("it-IT")}
                    </p>
                    {inv.paidDate && <p className="text-xs text-emerald-600">Pagata {new Date(inv.paidDate).toLocaleDateString("it-IT")}</p>}
                  </div>

                  {/* Total */}
                  <p className="hidden md:block text-sm font-bold tabular-nums text-right">{fmt(inv.total)}</p>

                  {/* Paid */}
                  <div className="hidden md:block text-right">
                    {inv.status === "parz_pagata" ? (
                      <>
                        <p className="text-sm tabular-nums font-semibold text-emerald-600">{fmt(inv.paid)}</p>
                        <Progress value={Math.round(inv.paid / inv.total * 100)} className="h-1 mt-1" />
                      </>
                    ) : inv.status === "pagata" ? (
                      <p className="text-sm tabular-nums text-emerald-600 font-semibold">{fmt(inv.total)}</p>
                    ) : (
                      <p className="text-sm tabular-nums text-muted-foreground">—</p>
                    )}
                  </div>

                  {/* Status */}
                  <div className="hidden md:flex justify-center">
                    <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", sc.color, "border-current/30", sc.bg)}>
                      <StIcon className="h-2.5 w-2.5 mr-1" />{sc.label}
                    </Badge>
                  </div>

                  {/* Method */}
                  <p className="hidden md:block text-xs text-muted-foreground truncate">{inv.paymentMethod}</p>

                  {/* Actions */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                      <DropdownMenuItem><Eye className="h-3.5 w-3.5 mr-2" /> Visualizza</DropdownMenuItem>
                      <DropdownMenuItem><Download className="h-3.5 w-3.5 mr-2" /> PDF</DropdownMenuItem>
                      <DropdownMenuItem><Copy className="h-3.5 w-3.5 mr-2" /> Duplica</DropdownMenuItem>
                      {inv.status === "bozza" && <DropdownMenuItem><Send className="h-3.5 w-3.5 mr-2" /> Invia</DropdownMenuItem>}
                      {inv.status === "scaduta" && <DropdownMenuItem className="text-rose-600"><Send className="h-3.5 w-3.5 mr-2" /> Sollecita</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-rose-600"><XCircle className="h-3.5 w-3.5 mr-2" /> Annulla</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-5 py-3 border-t border-border/50 bg-muted/20">
          <span className="text-sm text-muted-foreground">{filtered.length} fatture filtrate</span>
          <span className="font-black tabular-nums">{fmt(filtered.reduce((s, i) => s + i.total, 0))}</span>
        </div>
      </Card>
    </div>
  );
}
