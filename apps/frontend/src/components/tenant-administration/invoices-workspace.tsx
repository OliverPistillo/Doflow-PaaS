"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  INVOICE_STATUSES,
  type AdministrationList,
  type AdministrationRow,
} from "./administration-model";
import {
  AdministrationError,
  AdministrationLoading,
  AdministrationPageHeader,
} from "./administration-ui";
import { InvoicesKpis } from "./invoices-kpis";
import { InvoicesTable } from "./invoices-table";
import { InvoicePaymentPanel } from "./invoice-payment-panel";

function datePeriod(period: string) {
  if (period === "all") return {};
  const now = new Date();
  const from = period === "month"
    ? new Date(now.getFullYear(), now.getMonth(), 1)
    : period === "quarter"
      ? new Date(now.getFullYear(), Math.floor(now.getMonth() / 3) * 3, 1)
      : new Date(now.getFullYear(), 0, 1);
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { date_from: iso(from), date_to: iso(now) };
}

export function InvoicesWorkspace() {
  const { canView, canCreate, canUpdate, canDelete } = useTenantAccess();
  const [rows, setRows] = useState<AdministrationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<AdministrationRow | null>(null);
  const [editing, setEditing] = useState<AdministrationRow | null>(null);
  const [form, setForm] = useState<AdministrationRow>({});
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("bank_transfer");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const limit = 100;
  const pageSize = 8;

  const load = async () => {
    if (!canView("finance")) return;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ limit: String(limit), sortBy: "updated_at", sortOrder: "desc" });
    if (search.trim()) params.set("search", search.trim());
    if (status !== "all") params.set("status", status);
    Object.entries(datePeriod(period)).forEach(([key, value]) => params.set(key, value));
    try {
      const data = await apiFetch<AdministrationList>(`/tenant/finance/invoices?${params.toString()}`);
      setRows(data.items || []);
      setTotal(Number(data.total || 0));
      setPage(1);
      if (selected && !data.items.some((row) => row.id === selected.id)) setSelected(null);
    } catch (reason) {
      setRows([]);
      setError(reason instanceof Error ? reason.message : "Caricamento fatture non riuscito.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView("finance")) {
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(() => void load(), 250);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, period, search, status]);

  const loadDetail = async (row: AdministrationRow) => {
    try {
      const detail = await apiFetch<AdministrationRow>(`/tenant/finance/invoices/${row.id}`);
      setSelected(detail);
      setPaymentAmount("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Dettaglio fattura non disponibile.");
    }
  };

  const openEdit = (row: AdministrationRow) => {
    setEditing(row);
    setForm({
      title: row.title || "",
      invoice_number: row.invoice_number || "",
      status: row.status || "draft",
      issue_date: String(row.issue_date || "").slice(0, 10),
      due_date: String(row.due_date || "").slice(0, 10),
      payment_method: row.payment_method || "",
    });
  };

  const saveEdit = async () => {
    if (!editing || !canUpdate("finance")) return;
    await apiFetch(`/tenant/finance/invoices/${editing.id}`, { method: "PATCH", body: JSON.stringify(form) });
    setEditing(null);
    await load();
    if (selected?.id === editing.id) await loadDetail(editing);
  };

  const updateStatus = async (value: string) => {
    if (!selected || !canUpdate("finance")) return;
    await apiFetch(`/tenant/finance/invoices/${selected.id}/status`, { method: "PATCH", body: JSON.stringify({ status: value }) });
    await loadDetail(selected);
    await load();
  };

  const registerPayment = async () => {
    if (!selected || !canUpdate("finance")) return;
    const amount = paymentAmount || selected.remaining_total;
    if (!amount) return;
    await apiFetch(`/tenant/finance/invoices/${selected.id}/payments`, {
      method: "POST",
      body: JSON.stringify({ amount, method: paymentMethod, status: "recorded" }),
    });
    setPaymentAmount("");
    await loadDetail(selected);
    await load();
  };

  const remove = async () => {
    if (!selected || !canDelete("finance") || !window.confirm("Eliminare questa fattura?")) return;
    await apiFetch(`/tenant/finance/invoices/${selected.id}`, { method: "DELETE" });
    setSelected(null);
    await load();
  };

  const pages = Math.max(1, Math.ceil(Math.min(rows.length, limit) / pageSize));
  const visibleRows = useMemo(() => rows.slice((page - 1) * pageSize, page * pageSize), [page, rows]);

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <AdministrationPageHeader title="Fatture e incassi" description="Controlla documenti emessi, pagamenti e scadenze." ctaLabel="Nuova fattura" ctaHref="/finance/invoices/new" canCreate={canCreate("finance")} />
      <InvoicesKpis rows={rows} truncated={total > rows.length} />
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 lg:flex-row">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca fattura o cliente..." className="h-11 rounded-xl border-slate-200 pl-11" /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-11 w-full rounded-xl border-slate-200 lg:w-52"><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem>{INVOICE_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={period} onValueChange={setPeriod}><SelectTrigger className="h-11 w-full rounded-xl border-slate-200 lg:w-44"><SelectValue placeholder="Periodo" /></SelectTrigger><SelectContent><SelectItem value="all">Tutto il periodo</SelectItem><SelectItem value="month">Questo mese</SelectItem><SelectItem value="quarter">Questo trimestre</SelectItem><SelectItem value="year">Quest’anno</SelectItem></SelectContent></Select>
      </div>
      <AdministrationError message={error} />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white">
          {loading ? <AdministrationLoading /> : <InvoicesTable rows={visibleRows} selectedId={selected?.id} canUpdate={canUpdate("finance")} onSelect={loadDetail} onEdit={openEdit} />}
          {!loading && rows.length > 0 ? <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>{Math.min((page - 1) * pageSize + 1, rows.length)}–{Math.min(page * pageSize, rows.length)} di {total || rows.length}{total > rows.length ? " · visualizzati i primi 100" : ""}</span><div className="flex items-center gap-2"><Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><span>Pagina {page} di {pages}</span><Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div> : null}
        </section>
        <InvoicePaymentPanel invoice={selected} canUpdate={canUpdate("finance")} canDelete={canDelete("finance")} amount={paymentAmount} method={paymentMethod} onAmountChange={setPaymentAmount} onMethodChange={setPaymentMethod} onRegisterPayment={registerPayment} onStatusChange={updateStatus} onDelete={remove} onClose={() => setSelected(null)} />
      </div>
      <Dialog open={!!editing} onOpenChange={(open) => { if (!open) setEditing(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>Modifica fattura</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titolo" wide><Input value={form.title || ""} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} /></Field>
            <Field label="Numero"><Input value={form.invoice_number || ""} onChange={(event) => setForm((old) => ({ ...old, invoice_number: event.target.value }))} /></Field>
            <Field label="Stato"><Select value={form.status || "draft"} onValueChange={(value) => setForm((old) => ({ ...old, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{INVOICE_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Emissione"><Input type="date" value={form.issue_date || ""} onChange={(event) => setForm((old) => ({ ...old, issue_date: event.target.value }))} /></Field>
            <Field label="Scadenza"><Input type="date" value={form.due_date || ""} onChange={(event) => setForm((old) => ({ ...old, due_date: event.target.value }))} /></Field>
          </div>
          <DialogFooter><Button onClick={saveEdit} disabled={!form.title}>Salva modifiche</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={wide ? "grid gap-2 sm:col-span-2" : "grid gap-2"}><Label>{label}</Label>{children}</div>;
}
