"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Filter, Plus, Loader2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch } from "@/lib/api";
import { useConfirm } from "@/hooks/useConfirm";
import { InvoiceCreateSheet } from "../dashboard/components/InvoiceCreateSheet";
import { ClientRow, ClientGroup } from "./components/ClientRow";
import { Invoice } from "./components/InvoiceRow";

// --- COMPONENTE INTERNO (Logica) ---
function InvoicesContent() {
  const searchParams = useSearchParams();
  
  // Dati
  const [rawInvoices, setRawInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const { ConfirmDialog, confirm } = useConfirm();
  
  // Modali
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  
  // Filtri (Inizializzati vuoti, poi popolati dall'URL)
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [initialized, setInitialized] = useState(false);

  // 1. INIZIALIZZAZIONE DA URL (Eseguito una volta sola al mount)
  useEffect(() => {
    const querySearch = searchParams.get("search");
    const queryStatus = searchParams.get("status");

    if (querySearch) setSearch(querySearch);
    if (queryStatus) setStatusFilter(queryStatus);
    
    setInitialized(true);
  }, [searchParams]);

  // 2. FETCH DATI (Eseguito quando cambiano i filtri o inizializzazione completata)
  const loadInvoices = async () => {
    if (!initialized) return; // Aspetta che i parametri URL siano letti

    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);

      const res = await apiFetch<Invoice[]>(`/superadmin/finance/invoices?${params.toString()}`);
      setRawInvoices(res);
    } catch (e) {
      console.error("Errore caricamento fatture", e);
    } finally {
      setLoading(false);
    }
  };

  // Debounce sul fetch
  useEffect(() => {
    const timer = setTimeout(() => { loadInvoices(); }, 300);
    return () => clearTimeout(timer);
  }, [search, statusFilter, initialized]);

  // 3. GESTIONE AZIONI
  const openCreate = () => {
     setEditingInvoice(null);
     setIsSheetOpen(true);
  };

  const openEdit = (inv: Invoice) => {
     setEditingInvoice(inv);
     setIsSheetOpen(true);
  };

  const handleDelete = async (id: string) => {
      const ok = await confirm({
        title: "Eliminare questa fattura?",
        description: "L'operazione è irreversibile.",
        confirmLabel: "Elimina",
        variant: "destructive",
      });
      if (!ok) return;
      try {
          await apiFetch(`/superadmin/finance/invoices/${id}`, { method: "DELETE" });
          loadInvoices();
      } catch (e) {
          console.error("Errore eliminazione", e);
          alert("Impossibile eliminare la fattura.");
      }
  };

  // 4. LOGICA RAGGRUPPAMENTO
  const groupedClients = useMemo(() => {
    const groups: Record<string, ClientGroup> = {};
    rawInvoices.forEach(inv => {
        const clientName = inv.clientName || "Sconosciuto";
        if (!groups[clientName]) {
            groups[clientName] = { 
                clientId: clientName, 
                name: clientName, 
                totalVolume: 0, 
                invoices: [], 
                status: "Attivo" 
            };
        }
        groups[clientName].invoices.push(inv);
        groups[clientName].totalVolume += Number(inv.amount);
    });
    return Object.values(groups).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [rawInvoices]);

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
      <ConfirmDialog />
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between gap-4 items-end">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Elenco Clienti & Fatturazione</h1>
          <p className="text-slate-500 text-sm">CRM finanziario: gestisci clienti, visualizza fatture e pagamenti.</p>
        </div>
        <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" className="bg-white" onClick={handleExport}>
                <Download className="h-4 w-4 mr-2" /> Export
            </Button>
            <Button className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={openCreate}>
                <Plus className="h-4 w-4 mr-2" /> Nuova Fattura
            </Button>
        </div>
      </div>

      {/* Toolbar Filtri */}
      <div className="bg-white p-4 rounded-lg border shadow-sm flex flex-col sm:flex-row gap-4 items-center">
         <div className="relative flex-1 w-full">
             <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
             <Input 
                className="pl-9 bg-slate-50 border-slate-200" 
                placeholder="Cerca cliente o n. fattura..." 
                value={search} 
                onChange={(e) => setSearch(e.target.value)} 
             />
         </div>
         <div className="flex items-center gap-2 w-full sm:w-auto">
             <Filter className="h-4 w-4 text-slate-500" />
             <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-[180px]"><SelectValue placeholder="Tutti gli stati" /></SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">Tutti gli stati</SelectItem>
                    <SelectItem value="paid">Pagate</SelectItem>
                    <SelectItem value="pending">In Attesa</SelectItem>
                    <SelectItem value="overdue">Scadute</SelectItem>
                </SelectContent>
             </Select>
         </div>
      </div>

      {/* Lista Clienti */}
      <div className="space-y-4">
        {/* Intestazione */}
        <div className="grid grid-cols-[30px_2fr_1fr_1fr_1fr] px-4 py-2 text-xs font-bold text-slate-500 uppercase border-b bg-slate-50/50 rounded-t-lg">
            <div></div><div>Cliente</div><div className="text-right pr-8">Volume Totale</div><div>N. Fatture</div><div>Stato Cliente</div>
        </div>

        {loading ? (
             <div className="flex justify-center py-20"><Loader2 className="animate-spin text-indigo-600 h-8 w-8" /></div>
        ) : groupedClients.length === 0 ? (
            <div className="text-center py-16 bg-white border border-dashed rounded-lg">
                <p className="text-slate-500">Nessuna fattura trovata.</p>
                <Button variant="link" onClick={() => {setSearch(""); setStatusFilter("all")}}>Resetta filtri</Button>
            </div>
        ) : (
            groupedClients.map((client) => (
                <ClientRow 
                    key={client.clientId} 
                    client={client} 
                    onAddInvoice={openCreate}
                    onEditInvoice={openEdit}
                    onDeleteInvoice={handleDelete}
                />
            ))
        )}
      </div>

      {/* Sheet Creazione/Modifica */}
      <InvoiceCreateSheet 
         isOpen={isSheetOpen} 
         onClose={() => setIsSheetOpen(false)} 
         onSuccess={loadInvoices}
         invoiceToEdit={editingInvoice} // Passiamo la fattura da modificare
      />
    </div>
  );
}

// --- PAGINA PRINCIPALE CON SUSPENSE ---
export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-indigo-600" /></div>}>
      <InvoicesContent />
    </Suspense>
  );
}