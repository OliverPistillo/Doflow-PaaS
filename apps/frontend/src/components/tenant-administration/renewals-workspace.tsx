"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Search, Settings2 } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RENEWAL_STATUSES,
  addDays,
  dateValue,
  relationName,
  startOfDay,
  type AdministrationList,
  type AdministrationRow,
} from "./administration-model";
import { AdministrationError, AdministrationLoading, AdministrationPageHeader } from "./administration-ui";
import { RenewalsKpis } from "./renewals-kpis";
import { RenewalsTable } from "./renewals-table";
import { RenewalsFollowUpPanel } from "./renewals-follow-up-panel";

export function RenewalsWorkspace() {
  const { canView, canCreate, canUpdate, canDelete } = useTenantAccess();
  const [rows, setRows] = useState<AdministrationRow[]>([]);
  const [services, setServices] = useState<AdministrationRow[]>([]);
  const [companies, setCompanies] = useState<AdministrationRow[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [type, setType] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<AdministrationRow | null>(null);
  const [form, setForm] = useState<AdministrationRow>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 7;

  const load = async () => {
    if (!canView("finance")) return;
    setLoading(true);
    setError(null);
    try {
      const [renewalData, serviceData, companyData] = await Promise.all([
        apiFetch<AdministrationList>("/tenant/finance/renewals?limit=100&sortBy=due_date&sortOrder=asc"),
        apiFetch<AdministrationList>("/tenant/finance/recurring-services?limit=100&sortBy=next_due_date&sortOrder=asc"),
        canView("crm") ? apiFetch<AdministrationList>("/tenant/crm/companies?limit=100") : Promise.resolve({ items: [] }),
      ]);
      setRows(renewalData.items || []);
      setServices(serviceData.items || []);
      setCompanies(companyData.items || []);
      setTotal(Number(renewalData.total || 0));
    } catch (reason) {
      setRows([]);
      setError(reason instanceof Error ? reason.message : "Caricamento rinnovi non riuscito.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!canView("finance")) {
      setLoading(false);
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView]);

  const categories = useMemo(() => Array.from(new Set(services.map((service) => String(service.category || "")).filter(Boolean))).sort(), [services]);
  const filteredRows = useMemo(() => {
    const today = startOfDay();
    const end = period === "30" ? addDays(today, 30) : period === "60" ? addDays(today, 60) : null;
    return rows.filter((row) => {
      const service = services.find((item) => item.id === row.recurring_service_id);
      const client = relationName(row.company_id || service?.company_id, companies);
      const haystack = `${row.title || ""} ${service?.name || ""} ${client}`.toLowerCase();
      if (search.trim() && !haystack.includes(search.trim().toLowerCase())) return false;
      if (status !== "all" && row.status !== status) return false;
      if (type !== "all" && service?.category !== type) return false;
      if (period !== "all") {
        const date = dateValue(row.due_date);
        if (period === "expired") {
          if (!date || date >= today || ["paid", "cancelled"].includes(row.status)) return false;
        } else if (!date || !end || date < today || date > end) return false;
      }
      return true;
    });
  }, [companies, period, rows, search, services, status, type]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const open = (row?: AdministrationRow) => {
    setEditing(row || {});
    setForm(row ? {
      title: row.title || "",
      status: row.status || "upcoming",
      amount: row.amount ?? "",
      due_date: String(row.due_date || "").slice(0, 10),
      recurring_service_id: row.recurring_service_id || "",
      company_id: row.company_id || "",
    } : { title: "", status: "upcoming", amount: "", due_date: "", recurring_service_id: "", company_id: "" });
  };

  const save = async () => {
    if (!editing) return;
    const body = Object.fromEntries(Object.entries(form).filter(([, value]) => value !== "" && value !== undefined));
    if (editing.id) {
      if (!canUpdate("finance")) return;
      await apiFetch(`/tenant/finance/renewals/${editing.id}`, { method: "PATCH", body: JSON.stringify(body) });
    } else {
      if (!canCreate("finance")) return;
      await apiFetch("/tenant/finance/renewals", { method: "POST", body: JSON.stringify(body) });
    }
    setEditing(null);
    await load();
  };

  const remove = async (row: AdministrationRow) => {
    if (!canDelete("finance") || !window.confirm("Eliminare questo rinnovo?")) return;
    await apiFetch(`/tenant/finance/renewals/${row.id}`, { method: "DELETE" });
    await load();
  };

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <AdministrationPageHeader title="Rinnovi" description="Controlla servizi ricorrenti, scadenze e prossime azioni." canCreate={false}>
        <Button asChild variant="outline" className="h-11 rounded-xl"><Link href="/finance/recurring-services"><Settings2 className="mr-2 h-4 w-4" /> Servizi ricorrenti</Link></Button>
        {canCreate("finance") ? <Button className="h-11 rounded-xl bg-indigo-600 px-5 hover:bg-indigo-700" onClick={() => open()}>Nuovo rinnovo</Button> : null}
      </AdministrationPageHeader>
      <RenewalsKpis rows={rows} services={services} truncated={total > rows.length} />
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 lg:flex-row">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cerca cliente o servizio..." className="h-11 rounded-xl border-slate-200 pl-11" /></div>
        <Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger className="h-11 w-full rounded-xl border-slate-200 lg:w-48"><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem>{RENEWAL_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={period} onValueChange={(value) => { setPeriod(value); setPage(1); }}><SelectTrigger className="h-11 w-full rounded-xl border-slate-200 lg:w-44"><SelectValue placeholder="Periodo" /></SelectTrigger><SelectContent><SelectItem value="all">Tutto il periodo</SelectItem><SelectItem value="30">Entro 30 giorni</SelectItem><SelectItem value="60">Entro 60 giorni</SelectItem><SelectItem value="expired">Scaduti</SelectItem></SelectContent></Select>
        <Select value={type} onValueChange={(value) => { setType(value); setPage(1); }}><SelectTrigger className="h-11 w-full rounded-xl border-slate-200 lg:w-48"><SelectValue placeholder="Tipologia" /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le tipologie</SelectItem>{categories.map((category) => <SelectItem key={category} value={category}>{category}</SelectItem>)}</SelectContent></Select>
      </div>
      <AdministrationError message={error} />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white">
          {loading ? <AdministrationLoading /> : <RenewalsTable rows={visibleRows} services={services} companies={companies} canUpdate={canUpdate("finance")} canDelete={canDelete("finance")} onEdit={open} onDelete={remove} />}
          {!loading && filteredRows.length > 0 ? <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>{Math.min((page - 1) * pageSize + 1, filteredRows.length)}–{Math.min(page * pageSize, filteredRows.length)} di {filteredRows.length}{total > rows.length ? " · primi 100 caricati" : ""}</span><div className="flex items-center gap-2"><Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><span>Pagina {page} di {pages}</span><Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div> : null}
        </section>
        <RenewalsFollowUpPanel rows={filteredRows} services={services} companies={companies} />
      </div>
      <Dialog open={editing !== null} onOpenChange={(openDialog) => { if (!openDialog) setEditing(null); }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing?.id ? "Modifica rinnovo" : "Nuovo rinnovo"}</DialogTitle></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Titolo" wide><Input value={form.title || ""} onChange={(event) => setForm((old) => ({ ...old, title: event.target.value }))} /></Field>
            <Field label="Stato"><Select value={form.status || "upcoming"} onValueChange={(value) => setForm((old) => ({ ...old, status: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{RENEWAL_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></Field>
            <Field label="Prossimo rinnovo"><Input type="date" value={form.due_date || ""} onChange={(event) => setForm((old) => ({ ...old, due_date: event.target.value }))} /></Field>
            <Field label="Importo"><Input type="number" value={form.amount ?? ""} onChange={(event) => setForm((old) => ({ ...old, amount: event.target.value }))} /></Field>
            <Field label="Servizio ricorrente"><Select value={form.recurring_service_id || "none"} onValueChange={(value) => setForm((old) => ({ ...old, recurring_service_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nessun servizio</SelectItem>{services.map((service) => <SelectItem key={service.id} value={service.id}>{service.name}</SelectItem>)}</SelectContent></Select></Field>
            {canView("crm") ? <Field label="Cliente"><Select value={form.company_id || "none"} onValueChange={(value) => setForm((old) => ({ ...old, company_id: value === "none" ? "" : value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nessun cliente</SelectItem>{companies.map((company) => <SelectItem key={company.id} value={company.id}>{company.name}</SelectItem>)}</SelectContent></Select></Field> : null}
          </div>
          <DialogFooter><Button onClick={save} disabled={!form.title || !form.due_date}>Salva</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}

function Field({ label, wide, children }: { label: string; wide?: boolean; children: React.ReactNode }) {
  return <div className={wide ? "grid gap-2 sm:col-span-2" : "grid gap-2"}><Label>{label}</Label>{children}</div>;
}
