"use client";

import { useState } from "react";
import {
  Plus, Search, FileText, MoreHorizontal, Download,
  Eye, Edit2, Trash2, Send, CheckCircle2, Clock, X,
  DollarSign, TrendingUp, FileCheck, FileClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

type QuoteStatus = "bozza" | "inviato" | "accettato" | "rifiutato" | "scaduto";

interface QuoteItem { desc: string; qty: number; price: number; }
interface Quote {
  id: string; title: string; company: string; contact: string;
  status: QuoteStatus; issueDate: string; expiryDate: string;
  subtotal: number; vat: number; total: number; items: QuoteItem[];
}

const INIT: Quote[] = [
  { id: "PRV-2026-001", title: "Piattaforma e-commerce StartupIO", company: "StartupIO", contact: "Francesca Romano", status: "inviato", issueDate: "2026-02-10", expiryDate: "2026-03-10", subtotal: 23500, vat: 5170, total: 28670, items: [{ desc: "Sviluppo frontend", qty: 1, price: 12000 }, { desc: "Backend e API", qty: 1, price: 8000 }, { desc: "Design UX/UI", qty: 1, price: 3500 }] },
  { id: "PRV-2026-002", title: "Migrazione cloud BigCorp", company: "BigCorp SpA", contact: "Alessandro Galli", status: "accettato", issueDate: "2026-01-20", expiryDate: "2026-02-20", subtotal: 77868, vat: 17131, total: 95000, items: [{ desc: "Assessment infrastruttura", qty: 1, price: 15000 }, { desc: "Migrazione servizi cloud", qty: 1, price: 45000 }, { desc: "Formazione team", qty: 40, price: 446 }] },
  { id: "PRV-2026-003", title: "Redesign brand DesignStudio", company: "DesignStudio Srl", contact: "Elena Ferri", status: "accettato", issueDate: "2025-12-20", expiryDate: "2026-01-20", subtotal: 9836, vat: 2164, total: 12000, items: [{ desc: "Brand strategy", qty: 1, price: 3000 }, { desc: "Logo e visual identity", qty: 1, price: 4500 }, { desc: "Brand guidelines", qty: 1, price: 2336 }] },
  { id: "PRV-2026-004", title: "App mobile InnovateIT", company: "InnovateIT", contact: "Roberto Mazza", status: "bozza", issueDate: "2026-02-18", expiryDate: "2026-03-18", subtotal: 36885, vat: 8115, total: 45000, items: [{ desc: "Sviluppo iOS", qty: 1, price: 15000 }, { desc: "Sviluppo Android", qty: 1, price: 15000 }, { desc: "Design UI/UX mobile", qty: 1, price: 6885 }] },
  { id: "PRV-2026-005", title: "Campagna digital MediaGroup", company: "MediaGroup Italia", contact: "Chiara Lombardi", status: "inviato", issueDate: "2026-02-05", expiryDate: "2026-03-05", subtotal: 15164, vat: 3336, total: 18500, items: [{ desc: "Strategia digital", qty: 1, price: 5000 }, { desc: "Content creation", qty: 6, price: 1200 }, { desc: "Gestione campagne Ads", qty: 3, price: 1055 }] },
  { id: "PRV-2026-006", title: "CRM integrato SmartFactory", company: "SmartFactory", contact: "Davide Colombo", status: "inviato", issueDate: "2026-02-12", expiryDate: "2026-03-12", subtotal: 54918, vat: 12082, total: 67000, items: [{ desc: "Implementazione CRM", qty: 1, price: 30000 }, { desc: "Integrazione ERP", qty: 1, price: 18000 }, { desc: "Training e supporto", qty: 1, price: 6918 }] },
  { id: "PRV-2026-007", title: "Sito web DigitalWave", company: "DigitalWave Srl", contact: "Marco Ferretti", status: "accettato", issueDate: "2025-12-01", expiryDate: "2025-12-31", subtotal: 6967, vat: 1533, total: 8500, items: [{ desc: "Sviluppo sito web", qty: 1, price: 5000 }, { desc: "Copywriting", qty: 1, price: 1967 }] },
  { id: "PRV-2026-008", title: "Piano SEO StartupIO", company: "StartupIO", contact: "Francesca Romano", status: "rifiutato", issueDate: "2025-12-10", expiryDate: "2026-01-10", subtotal: 4918, vat: 1082, total: 6000, items: [{ desc: "Audit SEO", qty: 1, price: 1500 }, { desc: "Ottimizzazione on-page", qty: 1, price: 2000 }, { desc: "Link building", qty: 3, price: 473 }] },
];

const STATUS_CONFIG: Record<QuoteStatus, { label: string; color: string; icon: typeof Clock }> = {
  bozza:    { label: "Bozza",    color: "bg-muted text-muted-foreground",                                        icon: Edit2 },
  inviato:  { label: "Inviato",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",  icon: Send },
  accettato:{ label: "Accettato",color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  rifiutato:{ label: "Rifiutato",color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",          icon: X },
  scaduto:  { label: "Scaduto",  color: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",     icon: Clock },
};

const fmt = (n: number) => new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", minimumFractionDigits: 0 }).format(n);

export default function QuotesPage() {
  const [quotes, setQuotes]           = useState<Quote[]>(INIT);
  const [search, setSearch]           = useState("");
  const [statusFilter, setFilter]     = useState<"all" | QuoteStatus>("all");
  const [selected, setSelected]       = useState<Quote | null>(null);
  const { toast } = useToast();

  const filtered = quotes.filter((q) => {
    if (statusFilter !== "all" && q.status !== statusFilter) return false;
    if (search && !q.title.toLowerCase().includes(search.toLowerCase()) && !q.company.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const totalValue = quotes.reduce((s, q) => s + q.total, 0);
  const acceptedValue = quotes.filter((q) => q.status === "accettato").reduce((s, q) => s + q.total, 0);
  const pendingValue = quotes.filter((q) => q.status === "inviato").reduce((s, q) => s + q.total, 0);

  return (
    <div className="flex-1 space-y-5 p-4 md:p-6 pt-4 animate-in fade-in duration-500">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Preventivi</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{quotes.length} preventivi totali</p>
        </div>
        <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Nuovo Preventivo
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Valore Totale", value: fmt(totalValue), icon: DollarSign, color: "indigo" },
          { label: "Accettati", value: fmt(acceptedValue), icon: FileCheck, color: "emerald" },
          { label: "In Attesa", value: fmt(pendingValue), icon: FileClock, color: "amber" },
          { label: "Tasso Accettazione", value: `${Math.round((quotes.filter((q) => q.status === "accettato").length / quotes.length) * 100)}%`, icon: TrendingUp, color: "sky" },
        ].map(({ label, value, icon: Icon, color }) => (
          <Card key={label}><CardContent className="pt-4 pb-3 px-4">
            <div className={`h-8 w-8 rounded-lg bg-${color}-100 dark:bg-${color}-900/20 flex items-center justify-center mb-2`}>
              <Icon className={`h-4 w-4 text-${color}-600 dark:text-${color}-400`} />
            </div>
            <div className="text-xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
          </CardContent></Card>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Cerca preventivi..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setFilter(v as typeof statusFilter)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Numero</TableHead>
              <TableHead>Titolo</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Stato</TableHead>
              <TableHead>Emissione</TableHead>
              <TableHead>Scadenza</TableHead>
              <TableHead>Totale</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={8} className="h-32 text-center text-muted-foreground">Nessun preventivo trovato</TableCell></TableRow>
            )}
            {filtered.map((q) => {
              const sc = STATUS_CONFIG[q.status];
              const StatusIcon = sc.icon;
              const isExpired = new Date(q.expiryDate) < new Date() && q.status === "inviato";
              return (
                <TableRow key={q.id} className="group cursor-pointer" onClick={() => setSelected(q)}>
                  <TableCell className="font-mono text-sm font-medium">{q.id}</TableCell>
                  <TableCell>
                    <div className="font-medium">{q.title}</div>
                    <div className="text-xs text-muted-foreground">{q.contact}</div>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">{q.company}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded-full ${sc.color}`}>
                      <StatusIcon className="h-3 w-3" />{sc.label}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(q.issueDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                  </TableCell>
                  <TableCell className={`text-sm ${isExpired ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>
                    {new Date(q.expiryDate).toLocaleDateString("it-IT", { day: "2-digit", month: "short" })}
                  </TableCell>
                  <TableCell className="font-bold">{fmt(q.total)}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8 opacity-0 group-hover:opacity-100" onClick={(e) => e.stopPropagation()}>
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setSelected(q); }}><Eye className="mr-2 h-4 w-4" /> Visualizza</DropdownMenuItem>
                        <DropdownMenuItem><Download className="mr-2 h-4 w-4" /> PDF</DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setQuotes((qs) => qs.filter((x) => x.id !== q.id)); toast({ title: "Preventivo eliminato" }); }} className="text-red-600 focus:text-red-600">
                          <Trash2 className="mr-2 h-4 w-4" /> Elimina
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      {/* Quote Detail Sheet */}
      <Sheet open={!!selected} onOpenChange={() => setSelected(null)}>
        <SheetContent className="sm:max-w-lg overflow-y-auto">
          {selected && (
            <>
              <SheetHeader className="mb-6">
                <div className="flex items-start justify-between">
                  <div>
                    <SheetTitle className="text-lg">{selected.title}</SheetTitle>
                    <SheetDescription>{selected.id} · {selected.company}</SheetDescription>
                  </div>
                  <span className={`text-xs font-semibold px-2 py-1 rounded-full ${STATUS_CONFIG[selected.status].color}`}>
                    {STATUS_CONFIG[selected.status].label}
                  </span>
                </div>
              </SheetHeader>

              <div className="space-y-5">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Emissione</p>
                    <p className="font-semibold">{new Date(selected.issueDate).toLocaleDateString("it-IT")}</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-xs text-muted-foreground mb-1">Scadenza</p>
                    <p className="font-semibold">{new Date(selected.expiryDate).toLocaleDateString("it-IT")}</p>
                  </div>
                </div>

                <Separator />

                <div>
                  <h4 className="text-sm font-semibold mb-3">Voci</h4>
                  <div className="space-y-2">
                    {selected.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between text-sm py-2 border-b last:border-0">
                        <div>
                          <p className="font-medium">{item.desc}</p>
                          <p className="text-xs text-muted-foreground">Qtà {item.qty} × {fmt(item.price)}</p>
                        </div>
                        <p className="font-semibold">{fmt(item.qty * item.price)}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-2 text-sm">
                  <div className="flex justify-between"><span className="text-muted-foreground">Imponibile</span><span className="font-medium">{fmt(selected.subtotal)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">IVA 22%</span><span className="font-medium">{fmt(selected.vat)}</span></div>
                  <div className="flex justify-between text-base font-bold border-t pt-2"><span>Totale</span><span className="text-indigo-600 dark:text-indigo-400">{fmt(selected.total)}</span></div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white"><Download className="mr-1.5 h-4 w-4" /> Scarica PDF</Button>
                  <Button size="sm" variant="outline" className="flex-1"><Send className="mr-1.5 h-4 w-4" /> Invia</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
