// Percorso: C:\Doflow\apps\frontend\src\app\superadmin\finance\invoices\page.tsx

"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Filter, Plus, Loader2, Download, Receipt, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { useConfirm } from "@/hooks/useConfirm";
import { InvoiceCreateSheet } from "../dashboard/components/InvoiceCreateSheet";
import { ClientRow, ClientGroup } from "./components/ClientRow";
import { Invoice } from "./components/InvoiceRow";

// ─── Inner (logic) ────────────────────────────────────────────────────────────

function InvoicesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [rawInvoices, setRawInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading]         = useState(true);
  const { ConfirmDialog, confirm }    = useConfirm();

  const [isSheetOpen, setIsSheetOpen]     = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);

  const [search, setSearch]           = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [initialized, setInitialized] = useState(false);

  // Init from URL params
  useEffect(() => {
    const qs = searchParams.get("search");
    const qst = searchParams.get("status");
    if (qs)  setSearch(qs);
    if (qst) setStatusFilter(qst);
    setInitialized(true);
  }, [searchParams]);

  // Fetch with debounce
  const loadInvoices = async () => {
    if (!initialized) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      const res = await apiFetch<Invoice[]>(`/superadmin/finance/invoices?${params.toString()}`);
      
      // Protezione: Assicuriamo che res sia un array
      if (Array.isArray(res)) {
        setRawInvoices(res);
      } else {
        console.error("API non ha ritornato un array per le fatture:", res);
        setRawInvoices([]);
      }
    } catch (e) {
      console.error("Errore caricamento fatture", e);
      setRawInvoices([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadInvoices, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, initialized]);

  const openCreate = () => {
    router.push("/superadmin/finance/invoices/new");
  };

  const openEdit = (invoice: Invoice) => { setEditingInvoice(invoice); setIsSheetOpen(true); };

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title:        "Eliminare questa fattura?",
      description:  "L'operazione è irreversibile.",
      confirmLabel: "Elimina",
      variant:      "destructive",
    });
    if (!ok) return;
    try {
      await apiFetch(`/superadmin/finance/invoices/${id}`, { method: "DELETE" });
      loadInvoices();
    } catch {
      console.error("Errore eliminazione");
    }
  };

  const handleDownloadInvoice = async (id: string, invoiceNumber: string) => {
    try {
      const token = localStorage.getItem("doflow_token");
      // getApiBaseUrl() garantisce sempre la base corretta con /api incluso
      // Es. in prod: "https://api.doflow.it/api", in locale: "/api"
      const baseUrl = getApiBaseUrl();
      const url = `${baseUrl}/superadmin/finance/invoices/${id}/pdf`;
      
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        throw new Error(`Errore download PDF (${response.status}): ${errText}`);
      }
      
      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = `Fattura_${invoiceNumber}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(objectUrl);
    } catch (e: any) {
      console.error("Errore download PDF:", e);
      alert(`Impossibile scaricare il PDF: ${e?.message || "Errore sconosciuto"}`);
    }
  };

  const handleSendEmail = async (id: string, invoiceNumber: string) => {
    const email = prompt(`A quale indirizzo email vuoi inviare la fattura N. ${invoiceNumber}?`, "cliente@example.com");
    if (!email) return;

    try {
      await apiFetch(`/superadmin/finance/invoices/${id}/send`, {
        method: "POST",
        body: JSON.stringify({ email })
      });
      alert(`Fattura inviata con successo a ${email}!`);
    } catch (e) {
      console.error("Errore invio email", e);
      alert("Errore durante l'invio dell'email.");
    }
  };

  // Group by client (protetto)
  const groupedClients = useMemo(() => {
    if (!Array.isArray(rawInvoices)) return [];
    
    const groups: Record<string, ClientGroup> = {};
    rawInvoices.forEach((inv) => {
      const name = inv.clientName || "Sconosciuto";
      if (!groups[name]) {
        groups[name] = { clientId: name, name, totalVolume: 0, invoices: [], status: "Attivo" };
      }
      groups[name].invoices.push(inv);
      groups[name].totalVolume += Number(inv.amount) || 0;
    });
    return Object.values(groups).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [rawInvoices]);

  const handleExport = () => {
    if (rawInvoices.length === 0) return;
    const csv =
      "Cliente,Numero,Data,Importo,Stato\n" +
      rawInvoices
        .map((i) => `"${i.clientName}",${i.invoiceNumber},${i.issueDate},${i.amount},${i.status}`)
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: "fatture_export.csv" });
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── Summary counts ──────────────────────────────────────────────────────────
  const summary = useMemo(() => {
    if (!Array.isArray(rawInvoices)) return { paid: 0, pending: 0, overdue: 0, total: 0 };

    const paid    = rawInvoices.filter((i) => i.status === "paid").reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const pending = rawInvoices.filter((i) => i.status === "pending").length;
    const overdue = rawInvoices.filter((i) => i.status === "overdue").length;
    return { paid, pending, overdue, total: rawInvoices.length };
  }, [rawInvoices]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  return (
    <div className="dashboard-content animate-fadeIn">
      <ConfirmDialog />

      {/* ── Action bar ─────────────────────────────────────────────── */}
      <div className="flex justify-end gap-2 mb-6">
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
        <Button onClick={openCreate} className="bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
          <Plus className="h-4 w-4" /> Nuova Fattura
        </Button>
      </div>

      {/* ── Summary Strip ──────────────────────────────────────────────────── */}
      {!loading && rawInvoices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Totale fatture",  value: String(summary.total),        color: "text-foreground",         bg: "bg-muted/40" },
            { label: "Incassato",       value: fmt(summary.paid),             color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { label: "In scadenza",     value: String(summary.pending),       color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-950/30" },
            { label: "Scadute",         value: String(summary.overdue),       color: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-950/30" },
          ].map((s) => (
            <div key={s.label} className={`rounded-xl border border-border/40 px-4 py-3 ${s.bg}`}>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.label}</p>
              <p className={`text-xl font-black mt-0.5 tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Toolbar Filtri ─────────────────────────────────────────────────── */}
      <div className="bg-card border border-border/60 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-center shadow-xs">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-9 bg-background border-border/60"
            placeholder="Cerca cliente o n. fattura…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] border-border/60">
              <SelectValue placeholder="Tutti gli stati" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="paid">Pagate</SelectItem>
              <SelectItem value="pending">In Scadenza</SelectItem>
              <SelectItem value="overdue">Scadute</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Lista Clienti ──────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Header colonne */}
        <div className="grid grid-cols-[30px_2fr_1fr_1fr_1fr] px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40 bg-muted/30 rounded-t-lg">
          <div />
          <div>Cliente</div>
          <div className="text-right pr-8">Volume Totale</div>
          <div>N. Fatture</div>
          <div>Stato</div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary h-8 w-8" />
          </div>
        ) : groupedClients.length === 0 ? (
          <div className="text-center py-16 bg-card border border-dashed border-border/60 rounded-xl">
            <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">Nessuna fattura trovata.</p>
            <Button
              variant="link"
              onClick={() => { setSearch(""); setStatusFilter("all"); }}
              className="mt-1"
            >
              Resetta filtri
            </Button>
          </div>
        ) : (
          groupedClients.map((client) => (
            <ClientRow
              key={client.clientId}
              client={client}
              onAddInvoice={openCreate}
              onEditInvoice={openEdit}
              onDeleteInvoice={handleDelete}
              onDownloadInvoice={handleDownloadInvoice}
              onSendInvoice={handleSendEmail}
            />
          ))
        )}
      </div>

      {/* Sheet Creazione/Modifica */}
      <InvoiceCreateSheet
        isOpen={isSheetOpen}
        onClose={() => setIsSheetOpen(false)}
        onSuccess={loadInvoices}
        invoiceToEdit={editingInvoice}
      />
    </div>
  );
}

// ─── Page with Suspense ───────────────────────────────────────────────────────

export default function InvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="animate-spin h-10 w-10 text-primary" />
        </div>
      }
    >
      <InvoicesContent />
    </Suspense>
  );
}