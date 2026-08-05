"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Archive, ChevronDown, ChevronLeft, Download, Loader2, RefreshCw, Save, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CommercialEmptyState } from "@/components/tenant-commercial/commercial-ui";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { archiveSiteProposal, deleteSiteProposal, downloadSiteProposalHtml, downloadSiteProposalZip, generateSiteProposal, getSiteProposal, listSiteProposalGenerations, listSiteProposalVersions, prepareSiteProposal, updateSiteProposal, upgradeSiteProposalTemplate, type CommercialAnalysis, type PreparationStatus, type SiteConfig, type SiteProposalDetail as DetailResponse, type SiteProposalGeneration, type SiteProposalVersion } from "@/lib/tenant-site-proposals-api";
import { copyJson, downloadBlob, formatDate, getErrorMessage, hasPermanentProposalDeleteRole, proposalStatusLabel } from "./site-proposal-utils";
import { SiteProposalConfigEditor } from "./site-proposal-config-editor";
import { SiteProposalCrmEditor } from "./site-proposal-crm-editor";
import { SiteProposalEmailAnalysis } from "./site-proposal-email-analysis";
import { SiteProposalFilesPanel } from "./site-proposal-files-panel";
import { SiteProposalActivityPanel } from "./site-proposal-activity-panel";
import { SiteProposalPreview } from "./site-proposal-preview";

type Draft = { displayName: string; siteConfig: SiteConfig; commercialAnalysis: CommercialAnalysis; emailSubject: string; emailBody: string; companyId?: string | null; contactId?: string | null; leadId?: string | null; opportunityId?: string | null };
const tabs = ["dati", "sito", "contatti", "email", "file", "attivita"] as const;
type Tab = typeof tabs[number];
const makeDraft = (detail: DetailResponse): Draft => { const p = detail.proposal; return { displayName: p.display_name, siteConfig: copyJson(p.site_config as SiteConfig), commercialAnalysis: copyJson(p.commercial_analysis || {}), emailSubject: p.email_subject || "", emailBody: p.email_body || "", companyId: p.company_id, contactId: p.contact_id, leadId: p.lead_id, opportunityId: p.opportunity_id }; };

const preparationLabels: Record<PreparationStatus, string> = { idle: "Preparazione incompleta", queued: "In coda", running: "Preparazione in corso", ready: "Pronta con AI", fallback: "Pronta localmente", failed: "Preparazione fallita" };
function PreparationBadge({ status, emailValid }: { status?: PreparationStatus | null; emailValid: boolean }) {
  const value: PreparationStatus = emailValid ? (status || "idle") : "idle";
  const tone = value === "ready" ? "bg-emerald-100 text-emerald-700" : value === "fallback" ? "bg-indigo-100 text-indigo-700" : value === "failed" ? "bg-rose-100 text-rose-700" : value === "queued" || value === "running" ? "bg-sky-100 text-sky-700" : "bg-amber-100 text-amber-700";
  return <Badge className={tone}>{value === "running" ? <Loader2 className="mr-1 h-3 w-3 animate-spin" /> : null}{preparationLabels[value]}</Badge>;
}

export function SiteProposalDetail({ id }: { id: string }) {
  const { canDelete, canManage, canUpdate } = useTenantAccess();
  const router = useRouter(); const pathname = usePathname(); const searchParams = useSearchParams();
  const query = searchParams.get("tab"); const activeTab: Tab = tabs.includes(query as Tab) ? query as Tab : "dati";
  const [detail, setDetail] = useState<DetailResponse | null>(null); const [draft, setDraft] = useState<Draft | null>(null);
  const [versions, setVersions] = useState<SiteProposalVersion[]>([]); const [generations, setGenerations] = useState<SiteProposalGeneration[]>([]);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false); const [generating, setGenerating] = useState(false); const [preparing, setPreparing] = useState(false); const [deleting, setDeleting] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false); const [deleteOpen, setDeleteOpen] = useState(false); const [prepareOpen, setPrepareOpen] = useState(false); const [upgradeOpen, setUpgradeOpen] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); setError(null);
    try { const [d, v, g] = await Promise.all([getSiteProposal(id), listSiteProposalVersions(id), listSiteProposalGenerations(id)]); setDetail(d); setDraft((current) => current && dirty ? current : makeDraft(d)); setVersions(v); setGenerations(g); if (!dirty) setDirty(false); }
    catch (value) { setError(getErrorMessage(value)); }
    finally { if (!silent) setLoading(false); }
  }, [dirty, id]);
  useEffect(() => { void load(); }, [id]);
  const preparationInProgress = ["queued", "running"].includes(detail?.proposal.preparation_status || "");
  useEffect(() => { if (!preparationInProgress) return; const timer = window.setInterval(() => void load(true), 3000); return () => window.clearInterval(timer); }, [load, preparationInProgress]);
  useEffect(() => { const warn = (event: BeforeUnloadEvent) => { if (dirty) { event.preventDefault(); event.returnValue = ""; } }; window.addEventListener("beforeunload", warn); return () => window.removeEventListener("beforeunload", warn); }, [dirty]);

  const changeTab = (tab: string) => { const params = new URLSearchParams(searchParams.toString()); params.set("tab", tab); router.replace(`${pathname}?${params}`, { scroll: false }); };
  const updateDraft = (next: Draft) => { setDraft(next); setDirty(true); };
  const save = useCallback(async () => {
    if (!draft) return false; setSaving(true);
    try { await updateSiteProposal(id, { displayName: draft.displayName, siteConfig: draft.siteConfig, commercialAnalysis: draft.commercialAnalysis, emailSubject: draft.emailSubject, emailBody: draft.emailBody, companyId: draft.companyId || null, contactId: draft.contactId || null, leadId: draft.leadId || null, opportunityId: draft.opportunityId || null }); toast.success("Proposta salvata."); setDirty(false); await load(); return true; }
    catch (value) { toast.error(getErrorMessage(value)); return false; }
    finally { setSaving(false); }
  }, [draft, id, load]);
  const generate = useCallback(async (saveFirst = false) => {
    if (dirty && !saveFirst) { toast.error("Sono presenti modifiche non salvate. Usa Salva e genera."); return; }
    if (saveFirst && !(await save())) return; setGenerating(true);
    try { await generateSiteProposal(id); toast.success("HTML e ZIP generati dall’attuale configurazione."); await load(); changeTab("sito"); }
    catch (value) { toast.error(getErrorMessage(value)); }
    finally { setGenerating(false); }
  }, [dirty, id, load, save]);
  const prepare = async () => {
    setPreparing(true);
    try { await prepareSiteProposal(id, { force: true }); toast.success("Rigenerazione completa accodata."); setPrepareOpen(false); await load(); }
    catch (value) { toast.error(getErrorMessage(value)); }
    finally { setPreparing(false); }
  };
  const upgrade = async () => {
    setPreparing(true);
    try { await upgradeSiteProposalTemplate(id, "2.4.1"); toast.success("Aggiornamento al Tema Colsova 2.4.1 accodato."); setUpgradeOpen(false); await load(); }
    catch (value) { toast.error(getErrorMessage(value)); }
    finally { setPreparing(false); }
  };
  const completed = useMemo(() => generations.find((generation) => generation.status === "completed"), [generations]);
  const previewId = searchParams.get("generationId") || completed?.id;
  const busy = saving || generating || preparing || preparationInProgress;
  const download = async (kind: "html" | "zip") => { if (!completed) return; try { const result = kind === "html" ? await downloadSiteProposalHtml(id, completed.id) : await downloadSiteProposalZip(id, completed.id); downloadBlob(result.blob, result.filename); toast.success("Download avviato."); } catch (value) { toast.error(getErrorMessage(value)); } };

  if (loading) return <main className="space-y-4 px-4 py-6 sm:px-6 lg:px-8"><Skeleton className="h-10 w-72" /><Skeleton className="h-[500px] w-full" /></main>;
  if (!detail || !draft) return <main className="px-4 py-6 sm:px-6 lg:px-8"><CommercialEmptyState>{error || "Proposta non trovata."}</CommercialEmptyState></main>;
  const proposal = detail.proposal; const canUpgrade = proposal.template_version !== "2.4.1";
  const emailValid = draft.emailSubject.trim().length >= 8 && draft.emailBody.trim().length >= 250 && draft.emailBody.includes("[LINK_DEMO]");
  const contentReady = emailValid && proposal.readiness?.complete !== false;

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <Link href="/commercial/site-proposals" className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600"><ChevronLeft className="h-4 w-4" />Proposte web</Link>
    <header className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><div className="flex flex-wrap items-center gap-2"><h1 className="text-[30px] font-bold leading-tight text-slate-950">{draft.displayName}</h1><Badge>{proposalStatusLabel[proposal.status] || proposal.status}</Badge><PreparationBadge status={proposal.preparation_status} emailValid={contentReady} />{dirty ? <Badge className="bg-amber-100 text-amber-700">Modifiche non salvate</Badge> : null}</div><p className="mt-2 text-sm text-slate-500">Tema {proposal.template_slug} {proposal.template_version} · configurazione v{proposal.current_version} · ultima generazione {formatDate(proposal.last_generated_at)}</p>{preparationInProgress ? <div className="mt-3 max-w-xl rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800"><Loader2 className="mr-2 inline h-4 w-4 animate-spin" />Preparazione in corso. La pagina si aggiorna automaticamente ogni 3 secondi.</div> : proposal.preparation_status === "failed" ? <p className="mt-3 text-sm text-rose-700">{proposal.preparation_error || "Preparazione non riuscita."}</p> : null}{canUpgrade ? <button type="button" onClick={() => setUpgradeOpen(true)} className="mt-2 text-sm font-semibold text-indigo-600 hover:underline">Aggiorna al Tema Colsova 2.4.1</button> : null}</div>
      <div className="flex flex-wrap gap-2">{canUpdate("crm") ? <Button variant="outline" disabled={busy || !dirty} onClick={() => void save()}><Save className="mr-2 h-4 w-4" />Salva</Button> : null}{canManage("crm") ? <Button disabled={busy || !dirty} onClick={() => void generate(true)}><Sparkles className="mr-2 h-4 w-4" />Salva e genera</Button> : null}{canManage("crm") ? <Button variant="outline" disabled={busy} onClick={() => void generate()}><Sparkles className="mr-2 h-4 w-4" />Genera</Button> : null}<Button variant="outline" disabled={!completed || busy} onClick={() => void download("html")}><Download className="mr-2 h-4 w-4" />HTML</Button><Button variant="outline" disabled={!completed || busy} onClick={() => void download("zip")}><Download className="mr-2 h-4 w-4" />ZIP</Button>{canManage("crm") ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" disabled={busy}>Altre azioni<ChevronDown className="ml-2 h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => setPrepareOpen(true)}><RefreshCw className="mr-2 h-4 w-4" />Rigenera proposta completa</DropdownMenuItem>{canUpgrade ? <DropdownMenuItem onSelect={() => setUpgradeOpen(true)}>Aggiorna tema</DropdownMenuItem> : null}</DropdownMenuContent></DropdownMenu> : null}{canDelete("crm") ? <Button variant="outline" disabled={busy} onClick={() => setArchiveOpen(true)}><Archive className="mr-2 h-4 w-4" />Archivia</Button> : null}{canDelete("crm") && hasPermanentProposalDeleteRole() ? <Button variant="destructive" disabled={busy || deleting} onClick={() => setDeleteOpen(true)}><Trash2 className="mr-2 h-4 w-4" />Elimina</Button> : null}</div>
    </header>
    {!contentReady && !preparationInProgress ? <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"><span>Preparazione incompleta: email, analisi e configurazione devono soddisfare tutti i requisiti.</span>{canManage("crm") ? <Button size="sm" variant="outline" onClick={() => setPrepareOpen(true)}>Rigenera proposta completa</Button> : null}</div> : null}
    <Tabs value={activeTab} onValueChange={changeTab}><TabsList className="h-auto w-full justify-start overflow-x-auto"><TabsTrigger value="dati">Dati</TabsTrigger><TabsTrigger value="sito">Sito</TabsTrigger><TabsTrigger value="contatti">Contatti</TabsTrigger><TabsTrigger value="email">Email</TabsTrigger><TabsTrigger value="file">File</TabsTrigger><TabsTrigger value="attivita">Attività</TabsTrigger></TabsList></Tabs>
    {activeTab === "dati" ? <SiteProposalConfigEditor config={draft.siteConfig} onChange={(siteConfig) => updateDraft({ ...draft, siteConfig })} /> : null}
    {activeTab === "sito" ? <SiteProposalPreview id={id} generationId={previewId} onGenerate={() => void generate(false)} /> : null}
    {activeTab === "contatti" ? <SiteProposalCrmEditor config={draft.siteConfig} links={draft} onConfigChange={(siteConfig) => updateDraft({ ...draft, siteConfig })} onLinksChange={(links) => updateDraft({ ...draft, ...links })} /> : null}
    {activeTab === "email" ? <SiteProposalEmailAnalysis analysis={draft.commercialAnalysis} status={proposal.personalization_status} subject={draft.emailSubject} body={draft.emailBody} originalSubject={proposal.email_subject || ""} originalBody={proposal.email_body || ""} onAnalysisChange={(commercialAnalysis) => updateDraft({ ...draft, commercialAnalysis })} onEmailChange={({ subject, body }) => updateDraft({ ...draft, emailSubject: subject, emailBody: body })} /> : null}
    {activeTab === "file" ? <SiteProposalFilesPanel proposalId={id} generations={generations} versions={versions} onPreview={(generationId) => { const params = new URLSearchParams(searchParams.toString()); params.set("tab", "sito"); params.set("generationId", generationId); router.replace(`${pathname}?${params}`, { scroll: false }); }} onRestore={() => load()} /> : null}
    {activeTab === "attivita" ? <SiteProposalActivityPanel proposalId={id} /> : null}
    <AlertDialog open={prepareOpen} onOpenChange={setPrepareOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Rigenera proposta completa</AlertDialogTitle><AlertDialogDescription>Verranno aggiornati sito pubblico, logo, palette, social, immagini, copy ed email. Al termine saranno generati automaticamente HTML e ZIP.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction disabled={preparing} onClick={() => void prepare()}>Rigenera proposta completa</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={upgradeOpen} onOpenChange={setUpgradeOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Aggiorna tema</AlertDialogTitle><AlertDialogDescription>La proposta verrà aggiornata al Tema Colsova 2.4.1 preservando contatti, social, logo, palette e immagini manuali. La preparazione completa e la generazione partiranno automaticamente; le generazioni storiche restano disponibili.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction disabled={preparing} onClick={() => void upgrade()}>Aggiorna tema</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={archiveOpen} onOpenChange={setArchiveOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archivia proposta</AlertDialogTitle><AlertDialogDescription>“{proposal.display_name}” verrà spostata nell’Archivio e potrà essere ripristinata.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction onClick={() => archiveSiteProposal(id).then(() => { toast.success("Proposta archiviata."); router.push("/commercial/site-proposals"); }).catch((value) => toast.error(getErrorMessage(value)))}>Archivia</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Elimina definitivamente la proposta</AlertDialogTitle><AlertDialogDescription>La proposta “{proposal.display_name}”, tutte le versioni, le generazioni e i relativi file HTML e ZIP verranno eliminati definitivamente. L’operazione non può essere annullata.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={deleting} onClick={() => { setDeleting(true); deleteSiteProposal(id).then(() => { toast.success("Proposta eliminata definitivamente."); router.push("/commercial/site-proposals"); }).catch((value) => toast.error(getErrorMessage(value))).finally(() => setDeleting(false)); }}>Elimina definitivamente</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}
