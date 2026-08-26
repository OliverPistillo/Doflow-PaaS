"use client";

import { ChangeEvent, DragEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Download, Eye, Loader2, RefreshCw, ShieldCheck, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CommercialEmptyState, CommercialPageHeader, CommercialSectionCard } from "@/components/tenant-commercial/commercial-ui";
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider";
import { activateProposalTheme, deleteProposalTheme, disableProposalTheme, downloadProposalTheme, fetchProposalThemePreview, listProposalThemes, setDefaultProposalTheme, uploadProposalTheme, type JsonObject, type ProposalTheme } from "@/lib/tenant-site-proposals-api";
import { downloadBlob, formatDate, getErrorMessage } from "./site-proposal-utils";

type PendingAction = { kind: "activate" | "disable" | "default" | "delete"; theme: ProposalTheme };
type Viewport = "mobile" | "tablet" | "desktop" | "compare";
const viewportWidth: Record<Exclude<Viewport, "compare">, string> = { mobile: "390px", tablet: "768px", desktop: "100%" };

export function SiteProposalThemes() {
  const { currentUser } = useDoflowIdentity();
  const canAdmin = currentUser.roles.includes("administrator");
  const [themes, setThemes] = useState<ProposalTheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [report, setReport] = useState<JsonObject | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [previewTheme, setPreviewTheme] = useState<ProposalTheme | null>(null);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [viewport, setViewport] = useState<Viewport>("desktop");
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState<"active" | "disabled" | "deleted" | "all">("active");

  const load = useCallback(async () => {
    setLoading(true);
    try { setThemes(await listProposalThemes("all")); }
    catch (error) { toast.error(getErrorMessage(error)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => void load(), 0); return () => window.clearTimeout(timer); }, [load]);

  const activeThemes = useMemo(() => themes.filter((theme) => theme.status === "active"), [themes]);
  const visibleThemes = useMemo(() => themes.filter((theme) => filter === "all" || (filter === "deleted" ? Boolean(theme.deleted_at) || theme.status === "retired" : filter === "disabled" ? !theme.deleted_at && theme.status === "disabled" : !theme.deleted_at && ["active","draft"].includes(theme.status))), [filter, themes]);
  const uploadFile = async (file?: File) => {
    setUploadError(null); setReport(null);
    if (!file) return;
    if (!file.name.toLowerCase().endsWith(".zip")) { setUploadError("Seleziona un pacchetto ZIP."); return; }
    if (file.size > 10 * 1024 * 1024) { setUploadError("Il file supera il limite di 10 MiB."); return; }
    setUploading(true);
    try { const result = await uploadProposalTheme(file); setReport(result.validationReport); toast.success("Tema caricato come bozza."); await load(); }
    catch (error) { const message = getErrorMessage(error); setUploadError(message); toast.error(message); }
    finally { setUploading(false); }
  };
  const drop = (event: DragEvent<HTMLDivElement>) => { event.preventDefault(); setDragging(false); void uploadFile(event.dataTransfer.files[0]); };
  const choose = (event: ChangeEvent<HTMLInputElement>) => { void uploadFile(event.target.files?.[0]); event.target.value = ""; };

  const preview = async (theme: ProposalTheme) => {
    setPreviewTheme(theme); setPreviewLoading(true); setPreviewHtml("");
    try { setPreviewHtml(await fetchProposalThemePreview(theme.slug, theme.version)); }
    catch (error) { toast.error(getErrorMessage(error)); setPreviewTheme(null); }
    finally { setPreviewLoading(false); }
  };
  const download = async (theme: ProposalTheme) => {
    try { const file = await downloadProposalTheme(theme.slug, theme.version); downloadBlob(file.blob, file.filename); }
    catch (error) { toast.error(getErrorMessage(error)); }
  };
  const runAction = async () => {
    if (!pending) return; setBusy(true);
    try {
      const { theme, kind } = pending;
      if (kind === "activate") await activateProposalTheme(theme.slug, theme.version);
      if (kind === "disable") await disableProposalTheme(theme.slug, theme.version);
      if (kind === "default") await setDefaultProposalTheme(theme.slug, theme.version);
      const deletion = kind === "delete" ? await deleteProposalTheme(theme.slug, theme.version) : null;
      toast.success(deletion ? deletion.deletionMode === "retired" ? "Tema ritirato dalla Libreria; lo storico resta disponibile." : "Tema eliminato e storage accodato per il cleanup." : "Tema aggiornato."); setPending(null); await load();
    } catch (error) { toast.error(getErrorMessage(error)); }
    finally { setBusy(false); }
  };

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <CommercialPageHeader title="Libreria Temi" description="Gestisci pacchetti standalone, versioni immutabili e tema predefinito delle Proposte web." />
    {canAdmin ? <CommercialSectionCard title="Carica tema ZIP">
      <div onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={drop} className={`rounded-2xl border-2 border-dashed p-8 text-center ${dragging ? "border-primary bg-primary/10" : "border-border bg-muted/50"}`}>
        <Upload className="mx-auto h-7 w-7 text-muted-foreground" /><p className="mt-3 text-sm font-medium text-foreground">Trascina qui il pacchetto oppure selezionalo</p><p className="mt-1 text-xs text-muted-foreground">ZIP standalone o modulare, massimo 10 MiB. La nuova versione resta in bozza.</p>
        <label className="mt-4 inline-flex cursor-pointer"><Input className="peer sr-only" type="file" accept=".zip,application/zip" onChange={choose} disabled={uploading} /><span className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground peer-focus-visible:ring-2 peer-focus-visible:ring-ring peer-focus-visible:ring-offset-2 peer-disabled:cursor-not-allowed peer-disabled:opacity-50">{uploading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin motion-reduce:animate-none" />Validazione in corso</> : "Seleziona ZIP"}</span></label>
      </div>
      {uploadError ? <p className="mt-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{uploadError}</p> : null}
      {report ? <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800"><div className="flex items-center gap-2 font-medium"><ShieldCheck className="h-4 w-4" />Pacchetto valido</div><pre className="mt-2 overflow-auto whitespace-pre-wrap text-xs">{JSON.stringify(report, null, 2)}</pre></div> : null}
    </CommercialSectionCard> : null}
    <CommercialSectionCard title="Temi disponibili">
      <div className="mb-4 flex justify-end gap-2"><Select value={filter} onValueChange={(value) => setFilter(value as typeof filter)}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="active">Attivi</SelectItem><SelectItem value="disabled">Disattivati</SelectItem><SelectItem value="deleted">Ritirati</SelectItem><SelectItem value="all">Tutti</SelectItem></SelectContent></Select><Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className="mr-2 h-4 w-4" />Aggiorna</Button></div>
      {loading ? <p className="py-8 text-center text-sm text-muted-foreground">Caricamento temi…</p> : visibleThemes.length === 0 ? <CommercialEmptyState>Nessun tema disponibile.</CommercialEmptyState> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b text-xs uppercase text-muted-foreground"><tr><th className="p-3">Tema</th><th className="p-3">Versione</th><th className="p-3">Sorgente</th><th className="p-3">Categorie</th><th className="p-3">Stato</th><th className="p-3">Utilizzi</th><th className="p-3">Caricamento</th><th className="p-3" /></tr></thead><tbody>{visibleThemes.map((theme) => {
        const isDefault = theme.isDefault ?? theme.default_version === theme.version; const uploaded = (theme.sourceType || theme.source_kind) === "uploaded"; const obsoleteBuiltin = !uploaded && Boolean(theme.obsolete); const canDelete = canAdmin && Boolean(theme.canDelete);
        const manifest = asRecord(theme.manifest); const pendingAdapter = theme.runtime_adapter_status === "pending"; const assets = asRecord(manifest.assetMap); const counts = asRecord(manifest.fixedCounts); const features = asRecord(manifest.features); const tags = stringList(manifest.recommendationTags);
        return <tr key={`${theme.slug}@${theme.version}`} className="border-b last:border-0">
          <td className="p-3"><p className="font-medium text-foreground">{theme.name}</p><p className="text-xs text-muted-foreground">{theme.slug} · {theme.content_profile}</p><div className="mt-1 flex flex-wrap gap-1"><Badge variant="outline">{theme.source_format === "modular" ? "Modulare" : "Legacy"}</Badge><Badge className={pendingAdapter ? "bg-amber-100 text-amber-800" : "bg-emerald-100 text-emerald-700"}>{pendingAdapter ? "Adattatore in preparazione" : "Adattatore attivo"}</Badge></div></td>
          <td className="p-3">{theme.version}{isDefault ? <Badge className="ml-2 bg-primary/10 text-primary">Predefinita</Badge> : null}<p className="mt-1 text-xs text-muted-foreground">format {theme.format_version || "—"}</p></td>
          <td className="p-3"><Badge variant="outline">{uploaded ? "Caricato" : "Built-in"}</Badge><p className="mt-2 text-xs text-muted-foreground">Immagini: {theme.default_image_mode === "theme" ? "tema" : "ibrida"}</p><p className="mt-1 text-xs text-muted-foreground">Package {formatBytes(theme.zip_size)} · Compiled {formatBytes(theme.compiled_size)}</p></td>
          <td className="p-3"><div className="flex max-w-[300px] flex-wrap gap-1">{(theme.categories || []).map((category) => <Badge key={category} variant="outline">{category}</Badge>)}{tags.map((tag) => <Badge key={tag} className="bg-muted text-muted-foreground">{tag}</Badge>)}</div><p className="mt-1 text-xs text-muted-foreground">Asset: {Object.keys(assets).length} · {summary(counts)} · {summary(features)}</p></td>
          <td className="p-3"><Badge className={theme.deleted_at || theme.status === "retired" ? "bg-rose-100 text-rose-700" : theme.status === "active" ? "bg-emerald-100 text-emerald-700" : theme.status === "draft" ? "bg-amber-100 text-amber-700" : "bg-muted text-muted-foreground"}>{theme.deleted_at || theme.status === "retired" ? "Ritirato" : theme.status === "active" ? "Attivo" : theme.status === "disabled" ? "Disattivato" : "Bozza"}</Badge></td>
          <td className="p-3">{theme.usageCount ?? theme.usages ?? 0}<p className="text-xs text-muted-foreground">Storico: {theme.historicalUsageCount ?? 0}</p></td><td className="p-3 text-muted-foreground">{formatDate(theme.version_created_at)}</td>
          <td className="p-3"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" aria-label="Anteprima" onClick={() => void preview(theme)}><Eye className="h-4 w-4" /></Button>{uploaded || theme.source_format === "modular" ? <Button size="icon" variant="ghost" aria-label="Download ZIP" onClick={() => void download(theme)}><Download className="h-4 w-4" /></Button> : null}{canAdmin && !theme.deleted_at && theme.status !== "active" ? <Button size="sm" variant="outline" onClick={() => setPending({ kind: "activate", theme })}>Attiva</Button> : null}{canAdmin && !theme.deleted_at && theme.status === "active" && uploaded && !isDefault ? <Button size="sm" variant="outline" onClick={() => setPending({ kind: "disable", theme })}>Disattiva</Button> : null}{canAdmin && !theme.deleted_at && theme.status === "active" && !isDefault && !obsoleteBuiltin ? <Button size="sm" variant="outline" disabled={pendingAdapter} onClick={() => setPending({ kind: "default", theme })}>Imposta predefinito</Button> : null}{canDelete ? <Button size="icon" variant="ghost" className="text-rose-600" aria-label={obsoleteBuiltin ? "Elimina versione" : "Elimina tema"} onClick={() => setPending({ kind: "delete", theme })}><Trash2 className="h-4 w-4" /></Button> : null}</div></td>
        </tr>;
      })}</tbody></table></div>}
      <p className="mt-3 text-xs text-muted-foreground">{activeThemes.length} versioni attive. Le versioni caricate sono immutabili: per aggiornare un tema carica una nuova versione.</p>
    </CommercialSectionCard>
    {previewTheme ? <CommercialSectionCard title={`Anteprima · ${previewTheme.name} ${previewTheme.version}`}><div className="mb-4 flex flex-wrap gap-2">{(["mobile","tablet","desktop","compare"] as Viewport[]).map((item) => <Button key={item} size="sm" variant={viewport === item ? "default" : "outline"} onClick={() => setViewport(item)}>{item === "mobile" ? "Mobile" : item === "tablet" ? "Tablet" : item === "desktop" ? "Desktop" : "Confronta"}</Button>)}<Button className="ml-auto" size="sm" variant="ghost" onClick={() => setPreviewTheme(null)}>Chiudi</Button></div>{previewLoading ? <div className="flex h-96 items-center justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div> : viewport === "compare" ? <div className="grid gap-4 xl:grid-cols-2"><PreviewFrame html={previewHtml} width="390px" label="Mobile" /><PreviewFrame html={previewHtml} width="100%" label="Desktop" /></div> : <PreviewFrame html={previewHtml} width={viewportWidth[viewport]} label={viewport} />}</CommercialSectionCard> : null}
    <AlertDialog open={Boolean(pending)} onOpenChange={(open) => !open && setPending(null)}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{pending?.kind === "delete" ? pending.theme.obsolete && pending.theme.builtIn ? "Eliminare questa vecchia versione?" : pending.theme.deletionMode === "purge" ? "Eliminare definitivamente il tema?" : "Ritirare il tema dalla Libreria?" : "Conferma azione tema"}</AlertDialogTitle><AlertDialogDescription>{pending ? pending.kind === "delete" ? <span className="space-y-2"><span className="block"><strong>{pending.theme.name}</strong> · {pending.theme.slug}@{pending.theme.version}</span>{pending.theme.obsolete && pending.theme.builtIn ? <span className="block">La versione verrà rimossa dalla Libreria e dai selettori. Le proposte e le generazioni storiche resteranno disponibili.</span> : <><span className="block">Origine: Caricato · Stato: {pending.theme.deleted_at ? "ritirato" : pending.theme.status} · Utilizzi: {pending.theme.usageCount ?? pending.theme.usages ?? 0} · Default: {(pending.theme.isDefault ?? pending.theme.default_version === pending.theme.version) ? "sì" : "no"}.</span><span className="block">Modalità prevista: {pending.theme.deletionMode === "purge" ? "eliminazione definitiva DB-first e cleanup storage" : "ritiro dalla Libreria con package e storico preservati"}.</span></>}{(pending.theme.isDefault ?? pending.theme.default_version === pending.theme.version) ? <span className="block">Verrà assegnato automaticamente un altro tema predefinito attivo e pronto.</span> : null}</span> : `${pending.kind === "default" ? "Imposta come predefinita" : pending.kind === "activate" ? "Attiva" : "Disattiva"} la versione ${pending.theme.slug}@${pending.theme.version}?` : ""}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={() => void runAction()}>{busy ? "Operazione…" : pending?.kind === "delete" ? pending.theme.obsolete && pending.theme.builtIn ? "Elimina versione" : pending.theme.deletionMode === "purge" ? "Elimina definitivamente" : "Ritira tema" : "Conferma"}</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </main>;
}

function PreviewFrame({ html, width, label }: { html: string; width: string; label: string }) { return <div className="mx-auto w-full"><p className="mb-2 text-xs font-medium uppercase text-muted-foreground">{label}</p><div className="mx-auto overflow-hidden rounded-xl border bg-card" style={{ width, maxWidth: "100%" }}><iframe title={`Anteprima tema ${label}`} srcDoc={html} sandbox="allow-scripts" referrerPolicy="no-referrer" className="h-[720px] w-full" /></div></div>; }

function asRecord(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function stringList(value: unknown): string[] { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }
function summary(value: Record<string, unknown>): string { const entries = Object.entries(value); return entries.length ? entries.slice(0, 6).map(([key, item]) => `${key}=${String(item)}`).join(", ") : "—"; }
function formatBytes(value: number | string | null | undefined): string { const bytes = Number(value || 0); if (bytes <= 0) return "—"; return bytes >= 1024 * 1024 ? `${(bytes / (1024 * 1024)).toFixed(1)} MiB` : `${(bytes / 1024).toFixed(1)} KiB`; }
