"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, FileText, Search } from "lucide-react";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { listDocumentsForEntity } from "@/lib/tenant-documents-api";
import { contractsApi, type Contract, type ContractChecklistItem, type ContractSigner, type ContractsSummary } from "@/lib/tenant-contracts-api";
import { apiFetch } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  CONTRACT_STATUSES,
  CONTRACT_TYPES,
  dateValue,
  type AdministrationList,
  type AdministrationRow,
} from "./administration-model";
import { AdministrationError, AdministrationLoading, AdministrationPageHeader } from "./administration-ui";
import { ContractsKpis } from "./contracts-kpis";
import { ContractsTable } from "./contracts-table";
import { ContractDetailPanel } from "./contract-detail-panel";

export function ContractsWorkspace() {
  const { canView, canCreate } = useTenantAccess();
  const [summary, setSummary] = useState<ContractsSummary | null>(null);
  const [allRows, setAllRows] = useState<Contract[]>([]);
  const [companies, setCompanies] = useState<AdministrationRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [expiry, setExpiry] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Contract | null>(null);
  const [signers, setSigners] = useState<ContractSigner[]>([]);
  const [checklist, setChecklist] = useState<ContractChecklistItem[]>([]);
  const [documentCount, setDocumentCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pageSize = 7;

  useEffect(() => {
    let active = true;
    if (!canView("contracts")) {
      setLoading(false);
      return;
    }
    const timer = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, string | number> = { limit: 100, sort: "updated_at" };
        if (search.trim()) params.search = search.trim();
        if (status !== "all") params.status = status;
        const [summaryData, listData, companyData] = await Promise.all([
          contractsApi.summary().catch(() => null),
          contractsApi.list(params),
          canView("crm") ? apiFetch<AdministrationList>("/tenant/crm/companies?limit=100") : Promise.resolve({ items: [] }),
        ]);
        if (!active) return;
        setSummary(summaryData);
        setAllRows(listData.items || []);
        setCompanies(companyData.items || []);
        setPage(1);
      } catch (reason) {
        if (active) {
          setAllRows([]);
          setError(reason instanceof Error ? reason.message : "Caricamento contratti non riuscito.");
        }
      } finally {
        if (active) setLoading(false);
      }
    }, 250);
    return () => { active = false; window.clearTimeout(timer); };
  }, [canView, search, status]);

  const filteredRows = useMemo(() => {
    const today = new Date();
    const end = new Date(today);
    end.setDate(end.getDate() + (expiry === "30" ? 30 : expiry === "90" ? 90 : 36500));
    return allRows.filter((row) => {
      if (type !== "all" && row.contract_type !== type) return false;
      if (expiry !== "all") {
        const date = dateValue(row.end_date || row.renewal_date || row.due_date);
        if (!date || date < today || date > end) return false;
      }
      return true;
    });
  }, [allRows, expiry, type]);

  const pages = Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const visibleRows = filteredRows.slice((page - 1) * pageSize, page * pageSize);

  const selectContract = async (row: AdministrationRow) => {
    const contract = row as Contract;
    setSelected(contract);
    setDetailLoading(true);
    const results = await Promise.allSettled([
      contractsApi.get(contract.id),
      contractsApi.signers(contract.id),
      contractsApi.checklist(contract.id),
      canView("documents") ? listDocumentsForEntity("contract", contract.id, { limit: 100 }) : Promise.resolve({ items: [], total: 0 }),
    ] as const);
    setSelected(results[0].status === "fulfilled" ? results[0].value : contract);
    setSigners(results[1].status === "fulfilled" ? results[1].value.items || [] : []);
    setChecklist(results[2].status === "fulfilled" ? results[2].value.items || [] : []);
    setDocumentCount(results[3].status === "fulfilled" ? Number(results[3].value.total ?? results[3].value.items.length) : 0);
    setDetailLoading(false);
  };

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <AdministrationPageHeader title="Contratti" description="Gestisci stato, firme, scadenze e documentazione contrattuale." ctaLabel="Nuovo contratto" ctaHref="/contracts/new" canCreate={canCreate("contracts")}>
        <Button asChild variant="outline" className="h-11 rounded-xl"><Link href="/contracts/templates"><FileText className="mr-2 h-4 w-4" /> Modelli</Link></Button>
      </AdministrationPageHeader>
      <ContractsKpis summary={summary as AdministrationRow | null} rows={allRows} canViewFinance={canView("finance")} />
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-white p-4 lg:flex-row">
        <div className="relative min-w-0 flex-1"><Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca contratto o cliente..." className="h-11 rounded-xl border-slate-200 pl-11" /></div>
        <Select value={status} onValueChange={setStatus}><SelectTrigger className="h-11 w-full rounded-xl border-slate-200 lg:w-48"><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem>{CONTRACT_STATUSES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={type} onValueChange={(value) => { setType(value); setPage(1); }}><SelectTrigger className="h-11 w-full rounded-xl border-slate-200 lg:w-48"><SelectValue placeholder="Tipologia" /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le tipologie</SelectItem>{CONTRACT_TYPES.map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select>
        <Select value={expiry} onValueChange={(value) => { setExpiry(value); setPage(1); }}><SelectTrigger className="h-11 w-full rounded-xl border-slate-200 lg:w-44"><SelectValue placeholder="Scadenza" /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le scadenze</SelectItem><SelectItem value="30">Entro 30 giorni</SelectItem><SelectItem value="90">Entro 90 giorni</SelectItem></SelectContent></Select>
      </div>
      <AdministrationError message={error} />
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0 rounded-2xl border border-slate-200/80 bg-white">
          {loading ? <AdministrationLoading /> : <ContractsTable rows={visibleRows} companies={companies} selectedId={selected?.id} canViewFinance={canView("finance")} onSelect={selectContract} />}
          {!loading && filteredRows.length > 0 ? <div className="flex items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>{Math.min((page - 1) * pageSize + 1, filteredRows.length)}–{Math.min(page * pageSize, filteredRows.length)} di {filteredRows.length}</span><div className="flex items-center gap-2"><Button size="icon" variant="outline" className="h-8 w-8" disabled={page <= 1} onClick={() => setPage((value) => value - 1)}><ChevronLeft className="h-4 w-4" /></Button><span>Pagina {page} di {pages}</span><Button size="icon" variant="outline" className="h-8 w-8" disabled={page >= pages} onClick={() => setPage((value) => value + 1)}><ChevronRight className="h-4 w-4" /></Button></div></div> : null}
        </section>
        <ContractDetailPanel contract={selected} companies={companies} signers={signers} checklist={checklist} documentCount={documentCount} canViewFinance={canView("finance")} loading={detailLoading} onClose={() => setSelected(null)} />
      </div>
    </main>
  );
}
