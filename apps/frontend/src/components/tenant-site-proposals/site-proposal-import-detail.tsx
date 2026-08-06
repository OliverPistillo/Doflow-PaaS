"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, ChevronLeft, CircleAlert, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  CommercialEmptyState,
  CommercialKpiCard,
  CommercialPageHeader,
  CommercialSectionCard,
} from "@/components/tenant-commercial/commercial-ui";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import {
  confirmImport,
  prepareImportBatch,
  getImportBatch,
  listSiteProposals,
  type SiteProposal,
  type SiteProposalImportBatch,
  type SiteProposalImportRow,
} from "@/lib/tenant-site-proposals-api";
import { formatDate, getErrorMessage, importStatusLabel, shortHash } from "./site-proposal-utils";
import { SiteProposalProgress } from "./site-proposal-progress";

const EMPTY_IMPORT_MESSAGE = "Nessuna riga valida. Correggi le intestazioni o i dati del CSV e avvia un nuovo import.";

function displayValue(value: unknown): string {
  if (Array.isArray(value)) return value.filter(Boolean).join(", ");
  return typeof value === "string" && value.trim() ? value : "—";
}

function PreviewRowDetails({ row }: { row: SiteProposalImportRow }) {
  const canonical = row.canonical;
  const canonicalFields = [
    ["Attività", canonical?.businessName],
    ["Categoria", canonical?.category],
    ["Città", canonical?.city],
    ["Referente pubblico", canonical?.publicContactName],
    ["Ruolo pubblico", canonical?.professionalTitle],
    ["Telefono", canonical?.phone],
    ["Email", canonical?.email],
    ["Sito", canonical?.websiteUrl],
    ["Servizi", canonical?.services],
  ] as const;
  const sourceEntries = Object.entries(row.sourceRow || {}).filter(([, value]) => value.trim()).slice(0, 14);
  const extraEntries = Object.entries(canonical?.extra || {}).filter(([, value]) => value.trim()).slice(0, 14);
  const issues = [...row.errors, ...row.warnings];

  return (
    <div className="grid gap-4 border-t border-slate-200 px-4 py-4 text-sm lg:grid-cols-2">
      <div>
        <h3 className="font-medium text-slate-900">Dati canonici</h3>
        <dl className="mt-2 space-y-2">
          {canonicalFields.map(([label, value]) => (
            <div key={label} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)] gap-2">
              <dt className="text-slate-500">{label}</dt>
              <dd className="break-all text-slate-700" title={displayValue(value)}>{displayValue(value)}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div>
        <h3 className="font-medium text-slate-900">Esito</h3>
        {issues.length ? (
          <ul className="mt-2 space-y-1 text-slate-600">
            {issues.map((issue, index) => <li key={`${issue.code}-${index}`}>{issue.message}</li>)}
          </ul>
        ) : <p className="mt-2 text-slate-600">Nessun errore o warning.</p>}
      </div>
      <details className="rounded-md border border-slate-200 px-3 py-2 lg:col-span-2">
        <summary className="cursor-pointer font-medium text-slate-800">Dati originali</summary>
        {sourceEntries.length ? (
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {sourceEntries.map(([key, value]) => (
              <div key={key} className="min-w-0 rounded bg-slate-50 px-2 py-1.5">
                <dt className="text-xs font-medium text-slate-500">{key}</dt>
                <dd className="mt-0.5 break-all text-slate-700" title={value}>{value}</dd>
              </div>
            ))}
          </dl>
        ) : <p className="mt-2 text-slate-500">Dati originali non disponibili per questo import storico.</p>}
      </details>
      {extraEntries.length ? (
        <details className="rounded-md border border-slate-200 px-3 py-2 lg:col-span-2">
          <summary className="cursor-pointer font-medium text-slate-800">Campi aggiuntivi</summary>
          <dl className="mt-3 grid gap-2 sm:grid-cols-2">
            {extraEntries.map(([key, value]) => (
              <div key={key} className="min-w-0 rounded bg-slate-50 px-2 py-1.5">
                <dt className="text-xs font-medium text-slate-500">{key}</dt>
                <dd className="mt-0.5 break-all text-slate-700" title={value}>{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      ) : null}
      {row.siteConfig ? <p className="text-xs text-slate-500 lg:col-span-2">SiteConfig pronto: 3 trattamenti, 3 punti prodotto, 6 recensioni e 6 FAQ.</p> : null}
    </div>
  );
}

export function SiteProposalImportDetail({ id }: { id: string }) {
  const { canCreate, canManage } = useTenantAccess();
  const [batch, setBatch] = useState<SiteProposalImportBatch | null>(null);
  const [proposals, setProposals] = useState<SiteProposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const current = await getImportBatch(id);
      setBatch(current);
      if (["confirmed", "generated", "partial"].includes(current.status)) {
        const result = await listSiteProposals({ importBatchId: id, limit: 100 });
        setProposals(result.items);
      }
    } catch (value) {
      setError(getErrorMessage(value));
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => { void load(); }, [load]);
  const hasActive = proposals.some((proposal) => ["pending", "queued", "running"].includes(proposal.preparationStatus || proposal.preparation_status || ""));
  useEffect(() => { if (!hasActive) return; let timer: number | undefined; let cancelled = false; const poll = async () => { await load(true); if (!cancelled) timer = window.setTimeout(poll, document.visibilityState === "hidden" ? 6000 : 1800); }; timer = window.setTimeout(poll, 1800); return () => { cancelled = true; if (timer) window.clearTimeout(timer); }; }, [hasActive, load]);

  const confirm = async () => {
    if (!batch || batch.valid_count === 0) {
      toast.error(EMPTY_IMPORT_MESSAGE);
      return;
    }
    setBusy(true);
    try {
      const result = await confirmImport(id);
      setProposals(result.proposals || []);
      toast.success(result.idempotent ? "Import già confermato." : "Import confermato.");
      setConfirmOpen(false);
      await load();
    } catch (value) {
      toast.error(getErrorMessage(value));
    } finally {
      setBusy(false);
    }
  };

  const prepare = async () => {
    setBusy(true);
    try {
      const result = await prepareImportBatch(id, false);
      toast.success(`${result.queued} proposte accodate per la preparazione.`);
      await load();
    } catch (value) {
      toast.error(getErrorMessage(value));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <main className="space-y-4 px-4 py-6 sm:px-6 lg:px-8"><Skeleton className="h-10 w-80" /><Skeleton className="h-64 w-full" /></main>;
  if (!batch) return <main className="px-4 py-6 sm:px-6 lg:px-8"><CommercialEmptyState>{error || "Import non trovato."}</CommercialEmptyState></main>;

  const warnings = batch.rows.reduce((sum, row) => sum + row.warnings.length, 0);
  const noValidRows = batch.status === "preview" && batch.valid_count === 0;
  const statusOf = (proposal: SiteProposal) => proposal.preparationStatus || proposal.preparation_status || "idle";
  const preparation = {
    queued: proposals.filter((item) => ["pending", "queued"].includes(statusOf(item))).length,
    running: proposals.filter((item) => statusOf(item) === "running").length,
    ready: proposals.filter((item) => statusOf(item) === "ready" && item.provider === "gemini").length,
    fallback: proposals.filter((item) => statusOf(item) === "fallback" || (statusOf(item) === "ready" && item.provider === "local")).length,
    failed: proposals.filter((item) => statusOf(item) === "failed").length,
  };
  const hasRecoveryCandidates = proposals.some((item) => statusOf(item) === "idle");
  const averageProgress = proposals.length ? Math.round(proposals.reduce((sum, proposal) => sum + Number(proposal.progressPercent ?? (proposal as SiteProposal & { progress_percent?: number }).progress_percent ?? 0), 0) / proposals.length) : 0;

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <Link href="/commercial/site-proposals/new" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600"><ChevronLeft className="h-4 w-4" />Nuovo import</Link>
      <CommercialPageHeader title={batch.original_filename} description={`Tema per questo batch: ${batch.template_slug} ${batch.template_version} · ${formatDate(batch.created_at)} · hash ${shortHash(batch.source_sha256)}`} />
      <div className="flex flex-wrap items-center gap-3">
        <Badge>{importStatusLabel[batch.status] || batch.status}</Badge>
        <span className="text-sm text-slate-500">{batch.row_count} righe · {batch.valid_count} valide · {batch.invalid_count} non valide</span>
        {noValidRows && canCreate("crm") ? <Button asChild variant="outline"><Link href="/commercial/site-proposals/new">Nuovo import</Link></Button> : null}
        {batch.status === "preview" && canCreate("crm") && !noValidRows ? <Button disabled={busy} onClick={() => setConfirmOpen(true)}><CheckCircle2 className="mr-2 h-4 w-4" />Conferma importazione</Button> : null}
        {["confirmed", "generated", "partial"].includes(batch.status) && canManage("crm") && hasRecoveryCandidates ? <Button disabled={busy} variant="outline" onClick={() => void prepare()}>{busy ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}Riprova accodamento</Button> : null}
      </div>
      {noValidRows ? <div role="alert" className="flex flex-wrap items-center gap-3 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><CircleAlert className="h-4 w-4" />{EMPTY_IMPORT_MESSAGE}</div> : null}
      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CommercialKpiCard label="Righe totali" value={batch.row_count} icon={CircleAlert} tone="violet" />
        <CommercialKpiCard label="Valide" value={batch.valid_count} icon={CheckCircle2} tone="green" />
        <CommercialKpiCard label="Con errori" value={batch.invalid_count} icon={CircleAlert} tone="orange" />
        <CommercialKpiCard label="Warning" value={warnings} icon={CircleAlert} tone="blue" />
      </div>
      {proposals.length ? <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6"><CommercialKpiCard label="Accodate" value={preparation.queued} icon={RefreshCw} tone="violet" /><CommercialKpiCard label="In preparazione" value={preparation.running} icon={Loader2} tone="blue" /><CommercialKpiCard label="Pronte AI" value={preparation.ready} icon={CheckCircle2} tone="green" /><CommercialKpiCard label="Pronte localmente" value={preparation.fallback} icon={CheckCircle2} tone="orange" /><CommercialKpiCard label="Fallite" value={preparation.failed} icon={CircleAlert} tone="orange" /><CommercialKpiCard label="Avanzamento medio" value={`${averageProgress}%`} icon={RefreshCw} tone="blue" /></div> : null}
      <CommercialSectionCard title="Anteprima righe">
        {batch.rows.length === 0 ? <CommercialEmptyState>Nessuna riga disponibile.</CommercialEmptyState> : (
          <div className="space-y-2">
            {batch.rows.map((row) => (
              <details key={row.rowIndex} className="rounded-xl border border-slate-200 bg-white">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3">
                  <span className="min-w-0"><strong className="text-sm text-slate-900">#{row.rowIndex} {row.displayName || "Riga senza nome"}</strong><span className="ml-2 text-xs text-slate-500">{displayValue(row.canonical?.city)}</span>{!row.valid && row.errors[0]?.message ? <span className="mt-1 block text-xs text-rose-700">{row.errors[0].message}</span> : null}</span>
                  <Badge className={row.valid ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"}>{row.valid ? "Valida" : "Non valida"}</Badge>
                </summary>
                <PreviewRowDetails row={row} />
              </details>
            ))}
          </div>
        )}
      </CommercialSectionCard>
      {proposals.length ? <CommercialSectionCard title="Proposte create"><div className="space-y-3">{proposals.map((proposal) => <div key={proposal.id} className="grid items-center gap-3 rounded-xl border border-slate-200 p-3 md:grid-cols-[minmax(12rem,1fr)_minmax(16rem,2fr)_auto]"><div><Link className="font-medium text-indigo-600" href={`/commercial/site-proposals/${proposal.id}`}>{proposal.display_name}</Link><p className="text-xs text-slate-500">Riga {proposal.source_row_index || "—"}</p></div><SiteProposalProgress value={proposal} compact /><Badge className={statusOf(proposal) === "failed" ? "bg-rose-100 text-rose-700" : "bg-slate-100 text-slate-700"}>{statusOf(proposal)}</Badge></div>)}</div></CommercialSectionCard> : null}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Conferma importazione</AlertDialogTitle><AlertDialogDescription>Le righe valide creeranno proposte e verranno accodate automaticamente per personalizzazione e generazione. L’operazione è idempotente.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction disabled={busy || batch.valid_count === 0} onClick={() => void confirm()}>Conferma importazione</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
