// Percorso: apps/frontend/src/app/superadmin/finance/invoices/page.tsx
"use client";

import React, { useState, useEffect, useMemo, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { Search, Filter, Plus, Loader2, Download, Receipt, FileText, FileCheck2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { apiFetch, getApiBaseUrl } from "@/lib/api";
import { useConfirm } from "@/hooks/useConfirm";
import { InvoiceCreateSheet } from "../dashboard/components/InvoiceCreateSheet";
import { ClientRow, ClientGroup } from "./components/ClientRow";
import { Invoice } from "./components/InvoiceRow";

function InvoicesContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [rawInvoices, setRawInvoices]   = useState<Invoice[]>([]);
  const [loading, setLoading]           = useState(true);
  const { ConfirmDialog, confirm }      = useConfirm();
  const [isSheetOpen, setIsSheetOpen]   = useState(false);
  const [editingInvoice, setEditingInvoice] = useState<Invoice | null>(null);
  const [search, setSearch]             = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [docTypeFilter, setDocTypeFilter] = useState("all");
  const [initialized, setInitialized]   = useState(false);

  useEffect(() => {
    const qs  = searchParams.get("search");
    const qst = searchParams.get("status");
    if (qs)  setSearch(qs);
    if (qst) setStatusFilter(qst);
    setInitialized(true);
  }, [searchParams]);

  const loadInvoices = async () => {
    if (!initialized) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);
      if (statusFilter && statusFilter !== "all") params.append("status", statusFilter);
      const res = await apiFetch<Invoice[]>(`/superadmin/finance/invoices?${params.toString()}`);
      setRawInvoices(Array.isArray(res) ? res : []);
    } catch { setRawInvoices([]); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    const t = setTimeout(loadInvoices, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, initialized]);

  const openEdit = (invoice: Invoice) => { setEditingInvoice(invoice); setIsSheetOpen(true); };

  const handleDelete = async (id: string) => {
    const ok = await confirm({ title: "Eliminare questo documento?", description: "Operazione irreversibile.", confirmLabel: "Elimina", variant: "destructive" });
    if (!ok) return;
    await apiFetch(`/superadmin/finance/invoices/${id}`, { method: "DELETE" });
    loadInvoices();
  };

  const handleDownload = async (id: string, num: string) => {
    try {
      const token = localStorage.getItem("doflow_token");
      const url   = `${getApiBaseUrl()}/superadmin/finance/invoices/${id}/pdf`;
      const res   = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const a    = Object.assign(document.createElement("a"), {
        href: URL.createObjectURL(blob), download: `Documento_${num || id}.pdf`,
      });
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) { alert(`Download fallito: ${e?.message}`); }
  };

  const handleSend = async (id: string, num: string) => {
    const email = prompt(`Email destinatario per documento N. ${num}:`, "cliente@example.com");
    if (!email) return;
    try {
      await apiFetch(`/superadmin/finance/invoices/${id}/send`, { method: "POST", body: JSON.stringify({ email }) });
      alert(`Inviato a ${email}!`);
    } catch { alert("Errore invio email."); }
  };

  const filteredInvoices = useMemo(() => {
    if (docTypeFilter === "all") return rawInvoices;
    return rawInvoices.filter(i => ((i as any).docType ?? "fattura") === docTypeFilter);
  }, [rawInvoices, docTypeFilter]);

  const groupedClients = useMemo(() => {
    const groups: Record<string, ClientGroup> = {};
    filteredInvoices.forEach(inv => {
      const name = inv.clientName || "Sconosciuto";
      if (!groups[name]) groups[name] = { clientId: name, name, totalVolume: 0, invoices: [], status: "Attivo" };
      groups[name].invoices.push(inv);
      groups[name].totalVolume += Number(inv.amount) || 0;
    });
    return Object.values(groups).sort((a, b) => b.totalVolume - a.totalVolume);
  }, [filteredInvoices]);

  const handleExport = () => {
    if (filteredInvoices.length === 0) return;
    const csv =
      "Tipo,Cliente,Numero,Data,Importo,Stato\n" +
      filteredInvoices
        .map(i =>
          `"${(i as any).docType ?? "fattura"}","${i.clientName}",${i.invoiceNumber || ""},${i.issueDate},${i.amount},${i.status}`
        )
        .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    Object.assign(document.createElement("a"), { href: url, download: "documenti_export.csv" }).click();
    URL.revokeObjectURL(url);
  };

  const summary = useMemo(() => ({
    total:      rawInvoices.length,
    paid:       rawInvoices.filter(i => i.status === "paid").reduce((s, i) => s + (Number(i.amount) || 0), 0),
    pending:    rawInvoices.filter(i => i.status === "pending").length,
    overdue:    rawInvoices.filter(i => i.status === "overdue").length,
    preventivi: rawInvoices.filter(i => (i as any).docType === "preventivo").length,
    fatture:    rawInvoices.filter(i => ((i as any).docType ?? "fattura") === "fattura").length,
  }), [rawInvoices]);

  const fmt = (n: number) =>
    new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(n);

  const TABS = [
    { key: "all",        label: "Tutti",               count: summary.total,      icon: null },
    { key: "preventivo", label: "Preventivi",           count: summary.preventivi, icon: FileText },
    { key: "fattura",    label: "Fatture di Cortesia",  count: summary.fatture,    icon: FileCheck2 },
  ] as const;

  return (
    <div className="dashboard-content animate-fadeIn">
      <ConfirmDialog />

      {/* ── Action bar ── */}
      <div className="flex justify-end gap-2 mb-6">
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" /> Export CSV
        </Button>
        <Button
          variant="outline"
          onClick={() => router.push("/superadmin/finance/preventivi/new")}
          className="gap-2 border-indigo-200 text-indigo-700 hover:bg-indigo-50 hover:border-indigo-300"
        >
          <FileText className="h-4 w-4" /> Nuovo Preventivo
        </Button>
        <Button
          onClick={() => router.push("/superadmin/finance/invoices/new")}
          className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
        >
          <FileCheck2 className="h-4 w-4" /> Nuova Fattura
        </Button>
      </div>

      {/* ── Summary ── */}
      {!loading && rawInvoices.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: "Totale",       value: String(summary.total),  color: "text-foreground",                       bg: "bg-muted/40" },
            { label: "Incassato",    value: fmt(summary.paid),       color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-950/30" },
            { label: "In scadenza",  value: String(summary.pending), color: "text-amber-600 dark:text-amber-400",     bg: "bg-amber-50 dark:bg-amber-950/30" },
            { label: "Scadute",      value: String(summary.overdue), color: "text-rose-600 dark:text-rose-400",       bg: "bg-rose-50 dark:bg-rose-950/30" },
          ].map(s => (
            <div key={s.label} className={`rounded-xl border border-border/40 px-4 py-3 ${s.bg}`}>
              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{s.label}</p>
              <p className={`text-xl font-black mt-0.5 tabular-nums ${s.color}`}>{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* ── Tab tipo documento ── */}
      <div className="flex gap-1 bg-muted/40 p-1 rounded-xl w-fit">
        {TABS.map(({ key, label, count, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setDocTypeFilter(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${
              docTypeFilter === key ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {Icon && <Icon className="h-3.5 w-3.5" />}
            {label}
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
              docTypeFilter === key ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
            }`}>{count}</span>
          </button>
        ))}
      </div>

      {/* ── Filtri ── */}
      <div className="bg-card border border-border/60 rounded-xl p-3 flex flex-col sm:flex-row gap-3 items-center">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input className="pl-9 bg-background border-border/60" placeholder="Cerca cliente o n. documento…"
            value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px] border-border/60"><SelectValue placeholder="Tutti gli stati" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutti gli stati</SelectItem>
              <SelectItem value="paid">Pagata</SelectItem>
              <SelectItem value="pending">In Scadenza</SelectItem>
              <SelectItem value="overdue">Scaduta</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ── Lista ── */}
      <div className="space-y-3">
        <div className="grid grid-cols-[30px_2fr_1fr_1fr_1fr] px-4 py-2 text-[10px] font-bold text-muted-foreground uppercase tracking-wider border-b border-border/40 bg-muted/30 rounded-t-lg">
          <div /><div>Cliente</div><div className="text-right pr-8">Volume</div><div>N. Docs</div><div>Stato</div>
        </div>

        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="animate-spin text-primary h-8 w-8" /></div>
        ) : groupedClients.length === 0 ? (
          <div className="text-center py-16 bg-card border border-dashed border-border/60 rounded-xl">
            <Receipt className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
            <p className="text-muted-foreground font-medium">
              {docTypeFilter === "preventivo" ? "Nessun preventivo." : docTypeFilter === "fattura" ? "Nessuna fattura." : "Nessun documento."}
            </p>
            <Button variant="link" onClick={() => { setSearch(""); setStatusFilter("all"); setDocTypeFilter("all"); }} className="mt-1">
              Resetta filtri
            </Button>
          </div>
        ) : groupedClients.map(client => (
          <ClientRow key={client.clientId} client={client}
            onAddInvoice={() => router.push("/superadmin/finance/invoices/new")}
            onEditInvoice={openEdit} onDeleteInvoice={handleDelete}
            onDownloadInvoice={handleDownload} onSendInvoice={handleSend}
            onRefresh={loadInvoices} />
        ))}
      </div>

      <InvoiceCreateSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)}
        onSuccess={loadInvoices} invoiceToEdit={editingInvoice} />
    </div>
  );
}

export default function InvoicesPage() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center"><Loader2 className="animate-spin h-10 w-10 text-primary" /></div>}>
      <InvoicesContent />
    </Suspense>
  );
}