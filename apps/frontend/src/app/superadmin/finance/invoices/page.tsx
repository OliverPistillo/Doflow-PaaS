"use client";

import React, { useState, useEffect, useMemo } from "react";
import { ChevronDown, ChevronRight, Search, Filter, CreditCard, Plus, Loader2, FileText, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { InvoiceCreateSheet } from "../dashboard/components/InvoiceCreateSheet"; // Riutilizziamo la sheet creata prima

// --- TIPI ---
type Invoice = {
  id: string;
  invoiceNumber: string;
  clientName: string; // Campo fondamentale per il raggruppamento
  amount: number;
  issueDate: string;
  dueDate: string;
  status: "paid" | "pending" | "overdue";
  // Campi opzionali o calcolati
  service?: string; 
  notes?: string;
  paymentMethod?: string;
  paymentDate?: string;
};

// Struttura visuale raggruppata
type ClientGroup = {
  clientId: string;
  name: string;
  totalVolume: number; // Calcolato al volo
  invoices: Invoice[];
  status: "Attivo" | "Inattivo";
};

// --- STILI ---
const STATUS_STYLES: Record<string, string> = {
  paid: "bg-emerald-100 text-emerald-700 hover:bg-emerald-200 border-0",
  pending: "bg-amber-100 text-amber-700 hover:bg-amber-200 border-0",
  overdue: "bg-red-100 text-red-700 hover:bg-red-200 border-0"
};

const STATUS_LABELS: Record<string, string> = {
  paid: "Pagata",
  pending: "In Attesa",
  overdue: "Scaduta"
};

export default function InvoicesPage() {
  // Stati Dati
  const [rawInvoices, setRawInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Stati UI
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  // Stati Filtri
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // --- 1. FETCH DATI ---
  const loadInvoices = async () => {
    setLoading(true);
    try {
      // Costruiamo la query string
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);

      const res = await apiFetch<Invoice[]>(`/superadmin/finance/invoices?${params.toString()}`);
      setRawInvoices(res);
      
      // Espandi automaticamente il primo gruppo se c'è una ricerca attiva
      if (search && res.length > 0) {
         setExpanded({ [res[0].clientName]: true });
      }
    } catch (e) {
      console.error("Errore caricamento fatture", e);
    } finally {
      setLoading(false);
    }
  };

  // Debounce o ricarica al cambio filtri
  useEffect(() => {
    const timer = setTimeout(() => {
        loadInvoices();
    }, 300); // 300ms delay per non spammare il server mentre scrivi
    return () => clearTimeout(timer);
  }, [search, statusFilter]);

  // --- 2. RAGGRUPPAMENTO PER CLIENTE (CRM Logic) ---
  const groupedClients = useMemo(() => {
    const groups: Record<string, ClientGroup> = {};

    rawInvoices.forEach(inv => {
        const clientName = inv.clientName || "Cliente Sconosciuto";
        
        if (!groups[clientName]) {
            groups[clientName] = {
                clientId: clientName, // Usiamo il nome come ID temporaneo
                name: clientName,
                totalVolume: 0,
                invoices: [],
                status: "Attivo" 
            };
        }
        
        groups[clientName].invoices.push(inv);
        groups[clientName].totalVolume += Number(inv.amount);
    });

    // Converti oggetto in array e ordina per volume d'affari (Clienti migliori in alto)
    return Object.values(groups).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [rawInvoices]);

  const toggle = (id: string) => setExpanded(prev => ({ ...prev, [id]: !prev[id] }));

  // Export CSV veloce della vista corrente
  const handleExport = () => {
      if(rawInvoices.length === 0) return;
      const csv = "Cliente,Numero,Data,Importo,Stato\n" + 
      rawInvoices.map(i => `"${i.clientName}",${i.invoiceNumber},${i.issueDate},${i.amount},${i.status}`).join("\n");
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fatture_export.csv`;
      a.click();
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto animate-in fade-in duration-500">
      
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Elenco Clienti & Fatturazione</h1>
          <p className="text-slate-500 text-sm">CRM finanziario: gestisci clienti, visualizza fatture e pagamenti.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="bg-white" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => setIsSheetOpen(true)}>
                <Plus className="h-4 w-4 mr-2" /> Nuova Fattura
            </Button>
        </div>
      </div>

      {/* FILTRI TOOLBAR */}
      <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-col sm:flex-row gap-4 items-center">
         <div className="relative flex-1 w-full">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
             <Input 
                className="pl-9 bg-slate-50 border-slate-200" 
                placeholder="Cerca per nome cliente o n. fattura..." 
                value={search}
                onChange={(e) => setSearch(e.target.value)}
             />
         </div>
         <div className="flex items-center gap-2 w-full sm:w-auto">
             <Filter className="h-4 w-4 text-slate-500" />
             <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]">
                    <SelectValue placeholder="Tutti gli stati" />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tutti gli stati</SelectItem>
                    <SelectItem value="paid">Pagate</SelectItem>
                    <SelectItem value="pending">In Attesa</SelectItem>
                    <SelectItem value="overdue">Scadute</SelectItem>
                </SelectContent>
             </Select>
         </div>
      </div>

      {/* LISTA CLIENTI / FATTURE */}
      <div className="space-y-4">
        {/* Header Table */}
        <div className="grid grid-cols-[30px_2fr_1fr_1fr_1fr] px-4 py-2 text-xs font-bold text-slate-500 uppercase border-b bg-slate-50/50 rounded-t-lg">
            <div></div>
            <div>Cliente</div>
            <div className="text-right pr-8">Volume Totale</div>
            <div>N. Fatture</div>
            <div>Stato Cliente</div>
        </div>

        {loading ? (
             <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600 h-8 w-8" /></div>
        ) : groupedClients.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed rounded-lg">
                <p className="text-slate-500">Nessuna fattura trovata con i filtri correnti.</p>
                <Button variant="link" onClick={() => {setSearch(""); setStatusFilter("all")}}>Resetta filtri</Button>
            </div>
        ) : (
            groupedClients.map((client) => (
            <div key={client.clientId} className="border rounded-lg bg-white overflow-hidden shadow-sm group">
                {/* Riga Cliente */}
                <div 
                    className="grid grid-cols-[30px_2fr_1fr_1fr_1fr] px-4 py-4 items-center hover:bg-slate-50/50 transition-colors cursor-pointer select-none" 
                    onClick={() => toggle(client.clientId)}
                >
                <div className="flex justify-center">
                    {expanded[client.clientId] ? <ChevronDown className="h-4 w-4 text-slate-400" /> : <ChevronRight className="h-4 w-4 text-slate-400" />}
                </div>
                <div>
                    <div className="font-bold text-lg text-slate-800">{client.name}</div>
                    <div className="text-xs text-slate-500 font-mono hidden sm:block">ID: {client.clientId.substring(0, 8)}...</div>
                </div>
                <div className="font-mono font-bold text-slate-700 text-right pr-8">
                    €{client.totalVolume.toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-slate-600 pl-2">
                    <Badge variant="outline">{client.invoices.length} docs</Badge>
                </div>
                <div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 border-green-200">
                        {client.status}
                    </Badge>
                </div>
                </div>

                {/* Area Fatture Espansa */}
                {expanded[client.clientId] && (
                <div className="bg-slate-50/50 border-t p-4 animate-in slide-in-from-top-2 duration-200">
                    <div className="ml-0 sm:ml-8 space-y-3">
                        {client.invoices.map((inv) => (
                            <div key={inv.id} className="bg-white border rounded-md p-4 text-sm shadow-sm hover:shadow-md transition-all flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                                
                                {/* Info Sinistra */}
                                <div className="flex items-center gap-4">
                                    <div className="h-10 w-10 bg-slate-100 rounded flex items-center justify-center text-slate-500">
                                        <FileText className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <div className="font-bold text-slate-700 flex items-center gap-2">
                                            Fattura #{inv.invoiceNumber}
                                            <Badge className={`text-[10px] px-1.5 py-0 h-5 ${STATUS_STYLES[inv.status]}`}>
                                                {STATUS_LABELS[inv.status]}
                                            </Badge>
                                        </div>
                                        <div className="text-xs text-slate-500 mt-0.5">
                                            Emessa: {new Date(inv.issueDate).toLocaleDateString('it-IT')} • Scadenza: {new Date(inv.dueDate).toLocaleDateString('it-IT')}
                                        </div>
                                    </div>
                                </div>

                                {/* Info Destra */}
                                <div className="flex items-center gap-6 w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-3 sm:pt-0">
                                    <div className="text-right">
                                        <div className="font-mono font-bold text-lg text-slate-900">
                                            €{Number(inv.amount).toLocaleString('it-IT', { minimumFractionDigits: 2 })}
                                        </div>
                                        <div className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Importo</div>
                                    </div>
                                    
                                    <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600">
                                        <ChevronRight className="h-4 w-4" />
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="mt-4 ml-8">
                        <Button variant="ghost" size="sm" className="text-slate-500 text-xs" onClick={() => setIsSheetOpen(true)}>
                            <Plus className="h-3 w-3 mr-1" /> Aggiungi nuova fattura a questo cliente
                        </Button>
                    </div>
                </div>
                )}
            </div>
            ))
        )}
      </div>

      {/* Componente Sheet per Creazione */}
      <InvoiceCreateSheet 
         isOpen={isSheetOpen} 
         onClose={() => setIsSheetOpen(false)} 
         onSuccess={loadInvoices} 
      />
    </div>
  );
}