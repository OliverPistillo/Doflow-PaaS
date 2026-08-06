"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Archive, Eye, FilePlus2, Palette, RefreshCw, Search, Sparkles, Trash2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CommercialEmptyState, CommercialKpiCard, CommercialPageHeader, CommercialSectionCard } from "@/components/tenant-commercial/commercial-ui";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { archiveSiteProposal, archiveSiteProposals, deleteSiteProposal, deleteSiteProposals, listSiteProposals, listTemplates, type ProposalStatus, type SiteProposal, type SiteProposalTemplate } from "@/lib/tenant-site-proposals-api";
import { formatDate, getErrorMessage, hasPermanentProposalDeleteRole, proposalStatusLabel } from "./site-proposal-utils";
import { SiteProposalProgress } from "./site-proposal-progress";

const PAGE_SIZE = 25;
function statusTone(status: string) { return status === "generated" ? "bg-emerald-100 text-emerald-700" : status === "error" ? "bg-rose-100 text-rose-700" : status === "ready" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-700"; }

export function SiteProposalsList() {
  const { canCreate, canDelete } = useTenantAccess();
  const canArchive = canDelete("crm");
  const canPermanentlyDelete = canDelete("crm") && hasPermanentProposalDeleteRole();
  const [items, setItems] = useState<SiteProposal[]>([]);
  const [templates, setTemplates] = useState<SiteProposalTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [archiveTotal, setArchiveTotal] = useState(0);
  const [counts, setCounts] = useState({ total: 0, draftReady: 0, generated: 0, error: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [template, setTemplate] = useState("all");
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [archiveTarget, setArchiveTarget] = useState<SiteProposal | "bulk" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiteProposal | "bulk" | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search); setOffset(0); setSelectedIds(new Set()); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async (silent = false) => {
    const request = ++requestRef.current;
    if (!silent) setSelectedIds(new Set());
    if (!silent) setLoading(true);
    setError(null);
    try {
      const filter = { scope: "active" as const, limit: PAGE_SIZE, offset, search: debouncedSearch, status: status === "all" ? undefined : status as ProposalStatus, templateSlug: template === "all" ? undefined : template };
      const [list, all, draft, ready, generated, failed, archived, templateList] = await Promise.all([
        listSiteProposals(filter),
        listSiteProposals({ scope: "active", limit: 1 }),
        listSiteProposals({ scope: "active", limit: 1, status: "draft" }),
        listSiteProposals({ scope: "active", limit: 1, status: "ready" }),
        listSiteProposals({ scope: "active", limit: 1, status: "generated" }),
        listSiteProposals({ scope: "active", limit: 1, status: "error" }),
        listSiteProposals({ scope: "archived", limit: 1 }),
        listTemplates(),
      ]);
      if (request !== requestRef.current) return;
      setItems(list.items);
      setTotal(list.total);
      setArchiveTotal(archived.total);
      setTemplates(templateList);
      setCounts({ total: all.total, draftReady: draft.total + ready.total, generated: generated.total, error: failed.total });
    } catch (value) {
      if (request === requestRef.current) setError(getErrorMessage(value));
    } finally {
      if (request === requestRef.current && !silent) setLoading(false);
    }
  }, [debouncedSearch, offset, status, template]);

  useEffect(() => { void load(); }, [load]);
  const hasActivePreparation = items.some((item) => ["queued","running"].includes(item.preparationStatus || item.preparation_status || ""));
  useEffect(() => { if (!hasActivePreparation) return; let timer: number | undefined; let cancelled = false; const poll = async () => { await load(true); if (!cancelled) timer = window.setTimeout(poll, document.visibilityState === "hidden" ? 6000 : 1800); }; timer = window.setTimeout(poll, 1800); return () => { cancelled = true; if (timer) window.clearTimeout(timer); }; }, [hasActivePreparation, load]);

  const toggle = (id: string, checked: boolean) => setSelectedIds((current) => {
    const next = new Set(current);
    if (checked) next.add(id); else next.delete(id);
    return next;
  });
  const allPageSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const somePageSelected = items.some((item) => selectedIds.has(item.id));
  const togglePage = (checked: boolean) => setSelectedIds(checked ? new Set(items.map((item) => item.id)) : new Set());

  const archive = async () => {
    if (!archiveTarget) return;
    setBusy(true);
    try {
      if (archiveTarget === "bulk") await archiveSiteProposals([...selectedIds]);
      else await archiveSiteProposal(archiveTarget.id);
      toast.success(archiveTarget === "bulk" ? `${selectedIds.size} proposte archiviate.` : "Proposta archiviata.");
      setArchiveTarget(null);
      await load();
    } catch (value) { toast.error(getErrorMessage(value)); }
    finally { setBusy(false); }
  };

  const permanentlyDelete = async () => {
    if (!deleteTarget) return;
    setBusy(true);
    try {
      if (deleteTarget === "bulk") {
        const result = await deleteSiteProposals([...selectedIds]);
        if (result.failed.length) toast.error(`${result.deleted} eliminate, ${result.failed.length} non eliminate.`);
        else toast.success(`${result.deleted} proposte eliminate definitivamente.`);
      } else {
        await deleteSiteProposal(deleteTarget.id);
        toast.success("Proposta eliminata definitivamente.");
      }
      setDeleteTarget(null);
      setDeleteConfirmation("");
      await load();
    } catch (value) { toast.error(getErrorMessage(value)); }
    finally { setBusy(false); }
  };

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <CommercialPageHeader title="Proposte web" description="Crea, personalizza e genera proposte dimostrative mobile-first per i prospect." ctaLabel={canCreate("crm") ? "Nuova proposta" : undefined} ctaHref={canCreate("crm") ? "/commercial/site-proposals/new" : undefined} />
    <div className="flex justify-end gap-2"><Button asChild variant="outline"><Link href="/commercial/site-proposals/themes"><Palette className="mr-2 h-4 w-4" />Temi</Link></Button><Button asChild variant="outline"><Link href="/commercial/site-proposals/archive"><Archive className="mr-2 h-4 w-4" />{archiveTotal ? `Archivio (${archiveTotal})` : "Archivio"}</Link></Button></div>
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><CommercialKpiCard label="Totale" value={loading ? "…" : counts.total} icon={FilePlus2} tone="violet" /><CommercialKpiCard label="Bozze e pronte" value={loading ? "…" : counts.draftReady} icon={Eye} tone="blue" /><CommercialKpiCard label="Generate" value={loading ? "…" : counts.generated} icon={Sparkles} tone="green" /><CommercialKpiCard label="Errori" value={loading ? "…" : counts.error} icon={TriangleAlert} tone="orange" /></div>
    <CommercialSectionCard title="Elenco proposte">
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_180px_180px_auto]"><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 pl-9" placeholder="Cerca proposta" aria-label="Cerca proposta" /></div><Select value={status} onValueChange={(value) => { setStatus(value); setOffset(0); setSelectedIds(new Set()); }}><SelectTrigger className="h-11"><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem>{Object.entries(proposalStatusLabel).filter(([key]) => key !== "archived").map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select><Select value={template} onValueChange={(value) => { setTemplate(value); setOffset(0); setSelectedIds(new Set()); }}><SelectTrigger className="h-11"><SelectValue placeholder="Template" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i template</SelectItem>{templates.map((item) => <SelectItem key={item.slug} value={item.slug}>{item.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" className="h-11" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Aggiorna</Button></div>
      {selectedIds.size > 0 ? <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3"><strong className="mr-auto text-sm text-indigo-950">{selectedIds.size} proposte selezionate</strong>{canArchive ? <Button size="sm" variant="outline" onClick={() => setArchiveTarget("bulk")}><Archive className="mr-2 h-4 w-4" />Archivia</Button> : null}{canPermanentlyDelete ? <Button size="sm" variant="destructive" onClick={() => { setDeleteConfirmation(""); setDeleteTarget("bulk"); }}><Trash2 className="mr-2 h-4 w-4" />Elimina definitivamente</Button> : null}<Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Deseleziona</Button></div> : null}
      {error ? <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700"><span>{error}</span><Button variant="ghost" size="sm" onClick={() => void load()}>Riprova</Button></div> : null}
      {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : items.length === 0 ? <CommercialEmptyState>Nessuna proposta corrisponde ai filtri selezionati.</CommercialEmptyState> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="p-3"><Checkbox aria-label="Seleziona tutte le proposte della pagina" checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false} onCheckedChange={(checked) => togglePage(checked === true)} /></th><th className="p-3">Proposta</th><th className="p-3">Template</th><th className="p-3">Stato e avanzamento</th><th className="p-3">Cliente CRM</th><th className="p-3">Versione</th><th className="p-3">Aggiornamento</th><th className="p-3" /></tr></thead><tbody>{items.map((item) => { const selected = selectedIds.has(item.id); const active = ["queued","running"].includes(item.preparationStatus || item.preparation_status || ""); return <tr key={item.id} className={`border-b last:border-0 ${selected ? "bg-indigo-50" : ""}`}><td className="p-3"><Checkbox aria-label={`Seleziona ${item.display_name}`} checked={selected} onCheckedChange={(checked) => toggle(item.id, checked === true)} /></td><td className="p-3"><Link className="font-medium text-slate-950 hover:text-indigo-600" href={`/commercial/site-proposals/${item.id}`}>{item.display_name}</Link><p className="mt-1 text-xs text-slate-500">{item.last_generated_at ? "Generata" : "Nessuna generazione"}</p></td><td className="p-3">{item.template_slug} <span className="text-xs text-slate-500">{item.template_version}</span></td><td className="p-3"><Badge className={statusTone(item.status)}>{proposalStatusLabel[item.status] || item.status}</Badge>{active ? <div className="mt-2"><SiteProposalProgress value={item} compact /></div> : null}</td><td className="p-3">{item.company_id ? "Collegata" : "—"}</td><td className="p-3">v{item.current_version}</td><td className="p-3 text-slate-500">{formatDate(item.updated_at)}</td><td className="p-3"><div className="flex justify-end gap-1"><Button asChild size="icon" variant="ghost" aria-label={`Apri ${item.display_name}`}><Link href={`/commercial/site-proposals/${item.id}`}><Eye className="h-4 w-4" /></Link></Button>{canArchive ? <Button size="icon" variant="ghost" aria-label={`Archivia ${item.display_name}`} onClick={() => setArchiveTarget(item)}><Archive className="h-4 w-4" /></Button> : null}{canPermanentlyDelete ? <Button size="icon" variant="ghost" className="text-rose-600" aria-label={`Elimina definitivamente ${item.display_name}`} onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /></Button> : null}</div></td></tr>; })}</tbody></table></div>
        <div className="grid gap-3 md:hidden">{items.map((item) => { const selected = selectedIds.has(item.id); const active = ["queued","running"].includes(item.preparationStatus || item.preparation_status || ""); return <article key={item.id} className={`rounded-xl border p-4 ${selected ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}><div className="flex items-start gap-3"><Checkbox aria-label={`Seleziona ${item.display_name}`} checked={selected} onCheckedChange={(checked) => toggle(item.id, checked === true)} /><div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><Link className="font-semibold text-slate-950" href={`/commercial/site-proposals/${item.id}`}>{item.display_name}</Link><p className="mt-1 text-xs text-slate-500">{item.template_slug} · v{item.current_version}</p></div><Badge className={statusTone(item.status)}>{proposalStatusLabel[item.status] || item.status}</Badge></div>{active ? <div className="mt-3"><SiteProposalProgress value={item} compact /></div> : null}<p className="mt-3 text-xs text-slate-500">Aggiornata {formatDate(item.updated_at)}</p><div className="mt-3 flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={`/commercial/site-proposals/${item.id}`}>Apri</Link></Button>{canArchive ? <Button size="sm" variant="outline" onClick={() => setArchiveTarget(item)}>Archivia</Button> : null}{canPermanentlyDelete ? <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(item)}>Elimina</Button> : null}</div></div></div></article>; })}</div>
        <div className="mt-4 flex items-center justify-between text-sm"><span className="text-slate-500">{total} risultati</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={offset === 0 || loading} onClick={() => { setSelectedIds(new Set()); setOffset(Math.max(0, offset - PAGE_SIZE)); }}>Precedente</Button><Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => { setSelectedIds(new Set()); setOffset(offset + PAGE_SIZE); }}>Successiva</Button></div></div>
      </>}
    </CommercialSectionCard>
    <AlertDialog open={Boolean(archiveTarget)} onOpenChange={(open) => !open && setArchiveTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archivia {archiveTarget === "bulk" ? `${selectedIds.size} proposte` : "proposta"}</AlertDialogTitle><AlertDialogDescription>Le proposte selezionate verranno spostate nell’Archivio. Potrai ripristinarle successivamente.{archiveTarget !== "bulk" && archiveTarget ? ` Proposta: “${archiveTarget.display_name}”.` : ""}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction onClick={() => void archive()} disabled={busy}>Archivia</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmation(""); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Elimina definitivamente {deleteTarget === "bulk" ? `${selectedIds.size} proposte` : "la proposta"}</AlertDialogTitle><AlertDialogDescription>La proposta, tutte le versioni, le generazioni e i relativi file HTML e ZIP verranno eliminati definitivamente. L’operazione non può essere annullata.{deleteTarget !== "bulk" && deleteTarget ? ` Proposta: “${deleteTarget.display_name}”.` : ""}</AlertDialogDescription></AlertDialogHeader>{deleteTarget === "bulk" ? <div><label htmlFor="delete-proposals-confirmation" className="text-sm font-medium">Digita ELIMINA per confermare</label><Input id="delete-proposals-confirmation" className="mt-2" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" /></div> : null}<AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy || (deleteTarget === "bulk" && deleteConfirmation !== "ELIMINA")} onClick={() => void permanentlyDelete()}>Elimina definitivamente</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
