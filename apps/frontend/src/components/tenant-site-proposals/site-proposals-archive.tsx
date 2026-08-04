"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArchiveRestore, ChevronLeft, RefreshCw, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { CommercialEmptyState, CommercialPageHeader, CommercialSectionCard } from "@/components/tenant-commercial/commercial-ui";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { deleteSiteProposal, deleteSiteProposals, listSiteProposals, listTemplates, restoreSiteProposal, restoreSiteProposals, type SiteProposal, type SiteProposalTemplate } from "@/lib/tenant-site-proposals-api";
import { formatDate, getErrorMessage, hasPermanentProposalDeleteRole, proposalStatusLabel } from "./site-proposal-utils";

const PAGE_SIZE = 25;

export function SiteProposalsArchive() {
  const { canDelete } = useTenantAccess();
  const canRestore = canDelete("crm");
  const canPermanentlyDelete = canDelete("crm") && hasPermanentProposalDeleteRole();
  const [items, setItems] = useState<SiteProposal[]>([]);
  const [templates, setTemplates] = useState<SiteProposalTemplate[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [template, setTemplate] = useState("all");
  const [offset, setOffset] = useState(0);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [restoreTarget, setRestoreTarget] = useState<SiteProposal | "bulk" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SiteProposal | "bulk" | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const requestRef = useRef(0);

  useEffect(() => {
    const timer = window.setTimeout(() => { setDebouncedSearch(search); setOffset(0); setSelectedIds(new Set()); }, 300);
    return () => window.clearTimeout(timer);
  }, [search]);

  const load = useCallback(async () => {
    const request = ++requestRef.current;
    setSelectedIds(new Set());
    setLoading(true);
    setError(null);
    try {
      const [list, templateList] = await Promise.all([
        listSiteProposals({ scope: "archived", limit: PAGE_SIZE, offset, search: debouncedSearch, templateSlug: template === "all" ? undefined : template }),
        listTemplates(),
      ]);
      if (request !== requestRef.current) return;
      setItems(list.items);
      setTotal(list.total);
      setTemplates(templateList);
    } catch (value) { if (request === requestRef.current) setError(getErrorMessage(value)); }
    finally { if (request === requestRef.current) setLoading(false); }
  }, [debouncedSearch, offset, template]);

  useEffect(() => { void load(); }, [load]);

  const toggle = (id: string, checked: boolean) => setSelectedIds((current) => {
    const next = new Set(current);
    if (checked) next.add(id); else next.delete(id);
    return next;
  });
  const allPageSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const somePageSelected = items.some((item) => selectedIds.has(item.id));
  const togglePage = (checked: boolean) => setSelectedIds(checked ? new Set(items.map((item) => item.id)) : new Set());

  const restore = async () => {
    if (!restoreTarget) return;
    setBusy(true);
    try {
      if (restoreTarget === "bulk") await restoreSiteProposals([...selectedIds]);
      else await restoreSiteProposal(restoreTarget.id);
      toast.success(restoreTarget === "bulk" ? `${selectedIds.size} proposte ripristinate.` : "Proposta ripristinata.");
      setRestoreTarget(null);
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
    <CommercialPageHeader title="Archivio proposte" description="Consulta, ripristina o elimina definitivamente le proposte archiviate." />
    <Button asChild variant="outline"><Link href="/commercial/site-proposals"><ChevronLeft className="mr-2 h-4 w-4" />Torna alle proposte</Link></Button>
    <CommercialSectionCard title="Proposte archiviate">
      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_220px_auto]"><div className="relative"><Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 pl-9" placeholder="Cerca proposta archiviata" aria-label="Cerca proposta archiviata" /></div><Select value={template} onValueChange={(value) => { setTemplate(value); setOffset(0); setSelectedIds(new Set()); }}><SelectTrigger className="h-11"><SelectValue placeholder="Template" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i template</SelectItem>{templates.map((item) => <SelectItem key={item.slug} value={item.slug}>{item.name}</SelectItem>)}</SelectContent></Select><Button variant="outline" className="h-11" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Aggiorna</Button></div>
      {selectedIds.size > 0 ? <div className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 p-3"><strong className="mr-auto text-sm text-indigo-950">{selectedIds.size} proposte selezionate</strong>{canRestore ? <Button size="sm" variant="outline" onClick={() => setRestoreTarget("bulk")}><ArchiveRestore className="mr-2 h-4 w-4" />Ripristina</Button> : null}{canPermanentlyDelete ? <Button size="sm" variant="destructive" onClick={() => { setDeleteConfirmation(""); setDeleteTarget("bulk"); }}><Trash2 className="mr-2 h-4 w-4" />Elimina definitivamente</Button> : null}<Button size="sm" variant="ghost" onClick={() => setSelectedIds(new Set())}>Deseleziona</Button></div> : null}
      {error ? <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div> : null}
      {loading ? <div className="space-y-2">{Array.from({ length: 5 }).map((_, index) => <Skeleton key={index} className="h-16 w-full" />)}</div> : items.length === 0 ? <CommercialEmptyState>Nessuna proposta archiviata.</CommercialEmptyState> : <>
        <div className="hidden overflow-x-auto md:block"><table className="w-full min-w-[980px] text-left text-sm"><thead className="border-b text-xs uppercase text-slate-500"><tr><th className="p-3"><Checkbox aria-label="Seleziona tutte le proposte archiviate della pagina" checked={allPageSelected ? true : somePageSelected ? "indeterminate" : false} onCheckedChange={(checked) => togglePage(checked === true)} /></th><th className="p-3">Proposta</th><th className="p-3">Template</th><th className="p-3">Stato precedente</th><th className="p-3">Versione</th><th className="p-3">Data archiviazione</th><th className="p-3">Ultima generazione</th><th className="p-3">Azioni</th></tr></thead><tbody>{items.map((item) => { const selected = selectedIds.has(item.id); return <tr key={item.id} className={`border-b last:border-0 ${selected ? "bg-indigo-50" : ""}`}><td className="p-3"><Checkbox aria-label={`Seleziona ${item.display_name}`} checked={selected} onCheckedChange={(checked) => toggle(item.id, checked === true)} /></td><td className="p-3 font-medium text-slate-950">{item.display_name}</td><td className="p-3">Tema Colsova <span className="text-xs text-slate-500">{item.template_version}</span></td><td className="p-3"><Badge className="bg-slate-100 text-slate-700">{proposalStatusLabel[item.archived_from_status || ""] || (item.last_generated_at ? "Generata" : "Bozza")}</Badge></td><td className="p-3">v{item.current_version}</td><td className="p-3 text-slate-500">{formatDate(item.deleted_at)}</td><td className="p-3 text-slate-500">{formatDate(item.last_generated_at)}</td><td className="p-3"><div className="flex justify-end gap-1">{canRestore ? <Button size="icon" variant="ghost" aria-label={`Ripristina ${item.display_name}`} onClick={() => setRestoreTarget(item)}><ArchiveRestore className="h-4 w-4" /></Button> : null}{canPermanentlyDelete ? <Button size="icon" variant="ghost" className="text-rose-600" aria-label={`Elimina definitivamente ${item.display_name}`} onClick={() => setDeleteTarget(item)}><Trash2 className="h-4 w-4" /></Button> : null}</div></td></tr>; })}</tbody></table></div>
        <div className="grid gap-3 md:hidden">{items.map((item) => { const selected = selectedIds.has(item.id); return <article key={item.id} className={`rounded-xl border p-4 ${selected ? "border-indigo-300 bg-indigo-50" : "border-slate-200"}`}><div className="flex items-start gap-3"><Checkbox aria-label={`Seleziona ${item.display_name}`} checked={selected} onCheckedChange={(checked) => toggle(item.id, checked === true)} /><div className="min-w-0 flex-1"><h2 className="font-semibold text-slate-950">{item.display_name}</h2><p className="mt-1 text-xs text-slate-500">Tema Colsova · v{item.current_version}</p><p className="mt-2 text-xs text-slate-500">Stato precedente: {proposalStatusLabel[item.archived_from_status || ""] || (item.last_generated_at ? "Generata" : "Bozza")}</p><p className="mt-1 text-xs text-slate-500">Archiviata {formatDate(item.deleted_at)}</p><div className="mt-3 flex flex-wrap gap-2">{canRestore ? <Button size="sm" variant="outline" onClick={() => setRestoreTarget(item)}>Ripristina</Button> : null}{canPermanentlyDelete ? <Button size="sm" variant="destructive" onClick={() => setDeleteTarget(item)}>Elimina</Button> : null}</div></div></div></article>; })}</div>
        <div className="mt-4 flex items-center justify-between text-sm"><span className="text-slate-500">{total} risultati</span><div className="flex gap-2"><Button variant="outline" size="sm" disabled={offset === 0 || loading} onClick={() => { setSelectedIds(new Set()); setOffset(Math.max(0, offset - PAGE_SIZE)); }}>Precedente</Button><Button variant="outline" size="sm" disabled={offset + PAGE_SIZE >= total || loading} onClick={() => { setSelectedIds(new Set()); setOffset(offset + PAGE_SIZE); }}>Successiva</Button></div></div>
      </>}
    </CommercialSectionCard>
    <AlertDialog open={Boolean(restoreTarget)} onOpenChange={(open) => !open && setRestoreTarget(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Ripristina {restoreTarget === "bulk" ? `${selectedIds.size} proposte` : "proposta"}</AlertDialogTitle><AlertDialogDescription>{restoreTarget === "bulk" ? "Le proposte selezionate torneranno nella lista attiva con lo stato precedente." : `“${restoreTarget ? restoreTarget.display_name : ""}” tornerà nella lista attiva con lo stato precedente.`}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => void restore()}>Ripristina</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={Boolean(deleteTarget)} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmation(""); } }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Elimina definitivamente {deleteTarget === "bulk" ? `${selectedIds.size} proposte` : "la proposta"}</AlertDialogTitle><AlertDialogDescription>La proposta, tutte le versioni, le generazioni e i relativi file HTML e ZIP verranno eliminati definitivamente. L’operazione non può essere annullata.{deleteTarget !== "bulk" && deleteTarget ? ` Proposta: “${deleteTarget.display_name}”.` : ""}</AlertDialogDescription></AlertDialogHeader>{deleteTarget === "bulk" ? <div><label htmlFor="delete-archived-confirmation" className="text-sm font-medium">Digita ELIMINA per confermare</label><Input id="delete-archived-confirmation" className="mt-2" value={deleteConfirmation} onChange={(event) => setDeleteConfirmation(event.target.value)} autoComplete="off" /></div> : null}<AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={busy || (deleteTarget === "bulk" && deleteConfirmation !== "ELIMINA")} onClick={() => void permanentlyDelete()}>Elimina definitivamente</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
