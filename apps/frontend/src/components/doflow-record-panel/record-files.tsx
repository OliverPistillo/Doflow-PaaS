"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from "react";
import {
  Archive, Check, Download, Eye, FilePlus2, FileText, Loader2, Mail,
  MessageCircle, MoreHorizontal, RefreshCw, RotateCcw, Search, Upload, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { useToast } from "@/hooks/use-toast";
import {
  archiveDocument, downloadDocumentBlob, listDocuments, listDocumentsForEntity,
  restoreDocument, uploadDocument, uploadDocumentVersion, type TenantDocument,
} from "@/lib/tenant-documents-api";
import { recordOperationsApi, type MaterialRequest, type OperationsRecordKind } from "@/lib/tenant-record-operations-api";
import { cn } from "@/lib/utils";
import { RecordPanelEmptyState } from "./unified-record-panel";

export type RecordFilesHandle = { openUpload: () => void; openMaterialRequest: () => void };

const materialStatus: Record<MaterialRequest["status"], { label: string; className: string }> = {
  requested: { label: "Da ricevere", className: "bg-amber-50 text-amber-700" },
  received: { label: "Ricevuto", className: "bg-emerald-50 text-emerald-700" },
  waived: { label: "Non necessario", className: "bg-slate-100 text-slate-600" },
};

function formatDate(value?: string | null) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(parsed);
}

function formatBytes(value?: number | string | null) {
  const bytes = Number(value || 0);
  if (!bytes) return "—";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(bytes >= 10 * 1024 * 1024 ? 0 : 1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function errorMessage(reason: unknown) {
  return reason instanceof Error ? reason.message : "Operazione non riuscita.";
}

function groupFor(document: TenantDocument) {
  if (["project_asset", "briefing_material"].includes(document.category)) return "client";
  const metadata = document.metadata || {};
  if (["deliverable", "project_output"].includes(document.category)
    || metadata.deliverable === true || metadata.origin === "team" || metadata.delivery_side === "team") return "team";
  return "documents";
}

type RecordFilesProps = {
  recordKind: OperationsRecordKind;
  recordId: string;
  onSolicit?: (channel: "email" | "whatsapp", text: string) => void;
};

export const RecordFiles = forwardRef<RecordFilesHandle, RecordFilesProps>(function RecordFiles({ recordKind, recordId, onSolicit }, ref) {
  const { canView, canCreate, canUpdate } = useTenantAccess();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<TenantDocument[]>([]);
  const [materials, setMaterials] = useState<MaterialRequest[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [requestTitle, setRequestTitle] = useState("");
  const [requestDescription, setRequestDescription] = useState("");
  const [requestDueAt, setRequestDueAt] = useState("");
  const [selectedDocuments, setSelectedDocuments] = useState<Record<string, string>>({});
  const [versionTarget, setVersionTarget] = useState<TenantDocument | null>(null);
  const [materialUploadTarget, setMaterialUploadTarget] = useState<MaterialRequest | null>(null);
  const [expandedMaterialId, setExpandedMaterialId] = useState<string | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const versionInput = useRef<HTMLInputElement>(null);
  const materialInput = useRef<HTMLInputElement>(null);
  const target = useMemo(() => ({ record_kind: recordKind, record_id: recordId }), [recordId, recordKind]);

  useImperativeHandle(ref, () => ({
    openUpload: () => uploadInput.current?.click(),
    openMaterialRequest: () => setRequestOpen(true),
  }), []);

  const load = useCallback(async () => {
    if (!canView("documents")) return;
    setLoading(true); setError(null);
    try {
      const [documentResult, materialResult, availableResult] = await Promise.all([
        listDocumentsForEntity(recordKind, recordId, { search, status: "active", limit: 100 }),
        recordOperationsApi.materials(target),
        listDocuments({ status: "active", limit: 100, sort: "created_at", sortDir: "desc" }),
      ]);
      setDocuments(documentResult.items || []); setMaterials(materialResult.items || []); setAvailableDocuments(availableResult.items || []);
    } catch (reason) { setError(errorMessage(reason)); }
    finally { setLoading(false); }
  }, [canView, recordId, recordKind, search, target]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (file?: File, material?: MaterialRequest) => {
    if (!file || busy || !canCreate("documents")) return;
    setBusy(material ? `material-upload:${material.id}` : "upload");
    try {
      const form = new FormData();
      form.append("file", file); form.append("title", file.name); form.append("entity_type", recordKind); form.append("entity_id", recordId);
      form.append("category", material ? "briefing_material" : recordKind === "project" ? "project_asset" : "company_document");
      form.append("visibility", "internal"); form.append("relation_type", "attachment");
      const document = await uploadDocument(form);
      if (material) await recordOperationsApi.receiveMaterial(material.id, document.id);
      toast({ title: material ? "Materiale ricevuto" : "File caricato", description: "Il documento è stato collegato al record." });
      await load();
    } catch (reason) { toast({ title: "Caricamento non riuscito", description: errorMessage(reason), variant: "destructive" }); }
    finally {
      setBusy(null); setMaterialUploadTarget(null);
      if (uploadInput.current) uploadInput.current.value = "";
      if (materialInput.current) materialInput.current.value = "";
    }
  };

  const createRequest = async () => {
    if (!requestTitle.trim() || busy) return;
    setBusy("request");
    try {
      await recordOperationsApi.createMaterial(target, { title: requestTitle, description: requestDescription || undefined, due_at: requestDueAt || undefined });
      setRequestTitle(""); setRequestDescription(""); setRequestDueAt(""); setRequestOpen(false);
      toast({ title: "Materiale richiesto", description: "La richiesta è stata aggiunta alla timeline operativa." });
      await load();
    } catch (reason) { toast({ title: "Richiesta non creata", description: errorMessage(reason), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const receiveExisting = async (material: MaterialRequest) => {
    const documentId = selectedDocuments[material.id]; if (!documentId || busy) return;
    setBusy(`receive:${material.id}`);
    try { await recordOperationsApi.receiveMaterial(material.id, documentId); toast({ title: "Materiale collegato" }); await load(); }
    catch (reason) { toast({ title: "Collegamento non riuscito", description: errorMessage(reason), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const waive = async (material: MaterialRequest) => {
    if (busy) return; setBusy(`waive:${material.id}`);
    try { await recordOperationsApi.waiveMaterial(material.id); toast({ title: "Materiale non necessario" }); await load(); }
    catch (reason) { toast({ title: "Aggiornamento non riuscito", description: errorMessage(reason), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const updateStatus = async (document: TenantDocument, next: "archive" | "restore") => {
    if (busy || !canUpdate("documents")) return; setBusy(`${next}:${document.id}`);
    try { if (next === "archive") await archiveDocument(document.id); else await restoreDocument(document.id); toast({ title: next === "archive" ? "File archiviato" : "File ripristinato" }); await load(); }
    catch (reason) { toast({ title: "Aggiornamento non riuscito", description: errorMessage(reason), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const version = async (file?: File) => {
    if (!file || !versionTarget || busy) return; setBusy(`version:${versionTarget.id}`);
    try {
      const form = new FormData(); form.append("file", file); form.append("title", versionTarget.title);
      await uploadDocumentVersion(versionTarget.id, form); toast({ title: "Nuova versione caricata" }); await load();
    } catch (reason) { toast({ title: "Versione non caricata", description: errorMessage(reason), variant: "destructive" }); }
    finally { setBusy(null); setVersionTarget(null); if (versionInput.current) versionInput.current.value = ""; }
  };

  const openBlob = async (document: TenantDocument, download: boolean) => {
    if (busy) return; setBusy(`${download ? "download" : "open"}:${document.id}`);
    try {
      const result = await downloadDocumentBlob(document); const url = URL.createObjectURL(result.blob);
      if (download) { const anchor = window.document.createElement("a"); anchor.href = url; anchor.download = result.filename; anchor.click(); }
      else window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) { toast({ title: "File non disponibile", description: errorMessage(reason), variant: "destructive" }); }
    finally { setBusy(null); }
  };

  const groups = useMemo(() => ({
    client: documents.filter((item) => groupFor(item) === "client"),
    team: documents.filter((item) => groupFor(item) === "team"),
    documents: documents.filter((item) => groupFor(item) === "documents"),
  }), [documents]);
  const openMaterials = materials.filter((item) => item.status === "requested");
  const signedContract = documents.some((item) => item.category === "contract" && (item.metadata?.signature_status === "signed" || item.metadata?.signed === true));

  const documentRow = (document: TenantDocument) => <div key={document.id} className="flex items-center gap-2 border-b border-slate-100 px-2 py-2 last:border-0" data-document-row>
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><FileText className="h-4 w-4" /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-slate-900" data-record-sensitive>{document.title || document.original_filename}</span><span className="block truncate text-[10px] text-slate-500">v{document.version_number || 1} · {formatBytes(document.size_bytes)} · {formatDate(document.created_at)} · <span data-record-sensitive>{document.uploaded_by_label || document.uploaded_by_email || "Autore interno"}</span></span></span>
    {document.status === "archived" ? <Badge className="h-5 border-0 bg-slate-100 px-2 text-[9px] text-slate-600">Archiviato</Badge> : null}
    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Apri file" onClick={() => void openBlob(document, false)} disabled={Boolean(busy)}><Eye className="h-3.5 w-3.5" /></Button>
    <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Scarica file" onClick={() => void openBlob(document, true)} disabled={Boolean(busy)}><Download className="h-3.5 w-3.5" /></Button>
    {canUpdate("documents") ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Altre azioni file"><MoreHorizontal className="h-3.5 w-3.5" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => { setVersionTarget(document); window.setTimeout(() => versionInput.current?.click(), 0); }}><FilePlus2 className="mr-2 h-4 w-4" />Nuova versione</DropdownMenuItem><DropdownMenuItem onSelect={() => void updateStatus(document, document.status === "archived" ? "restore" : "archive")}>{document.status === "archived" ? <RotateCcw className="mr-2 h-4 w-4" /> : <Archive className="mr-2 h-4 w-4" />}{document.status === "archived" ? "Ripristina" : "Archivia"}</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}
  </div>;

  if (!canView("documents")) return <RecordPanelEmptyState title="File non disponibili" description="Il tuo profilo non dispone del permesso documenti." />;

  return <div
    className="space-y-3"
    data-record-files
    onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
    onDragOver={(event) => event.preventDefault()}
    onDragLeave={() => setDragging(false)}
    onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files?.[0]); }}
  >
    <input ref={uploadInput} type="file" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
    <input ref={versionInput} type="file" className="hidden" onChange={(event) => void version(event.target.files?.[0])} />
    <input ref={materialInput} type="file" className="hidden" onChange={(event) => void upload(event.target.files?.[0], materialUploadTarget || undefined)} />

    <div className="flex items-center gap-2">
      <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca file" className="h-9 pl-8 text-xs" /></label>
      {canCreate("documents") ? <Button variant="outline" size="sm" className="h-9 shrink-0 rounded-lg border-[#dedfe6] px-3 text-[11px]" onClick={() => setRequestOpen(true)}><FilePlus2 className="mr-1.5 h-3.5 w-3.5" />Richiedi materiali</Button> : null}
      {canCreate("documents") ? <Button size="sm" className="h-9 shrink-0 rounded-lg bg-gradient-to-r from-blue-600 to-violet-600 px-3 text-[11px]" onClick={() => uploadInput.current?.click()} disabled={Boolean(busy)}><Upload className="mr-1.5 h-3.5 w-3.5" />Carica file</Button> : null}
    </div>
    <div className="grid grid-cols-3 rounded-lg border border-[#e8e8ed] bg-white px-3 py-2 text-center text-[10px] text-slate-500"><span><strong className="mr-1 text-xs text-slate-900">{documents.length}</strong> file</span><span><strong className="mr-1 text-xs text-amber-700">{openMaterials.length}</strong> da ricevere</span><span className={signedContract ? "text-emerald-700" : "text-slate-400"}><Check className="mr-1 inline h-3 w-3" />{signedContract ? "Contratto firmato" : "Contratto non rilevato"}</span></div>
    {dragging ? <div className="rounded-lg border border-dashed border-violet-400 bg-violet-50 p-3 text-center text-xs text-violet-700">Rilascia il file per caricarlo</div> : null}

    {requestOpen ? <div className="space-y-2 rounded-lg border border-violet-200 bg-violet-50/40 p-3" data-material-request-form><div className="flex items-center justify-between"><strong className="text-xs">Nuova richiesta materiale</strong><Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRequestOpen(false)}><X className="h-3.5 w-3.5" /></Button></div><Input value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder="Titolo materiale" maxLength={300} className="h-8 text-xs" /><Textarea value={requestDescription} onChange={(event) => setRequestDescription(event.target.value)} placeholder="Descrizione opzionale" rows={2} className="text-xs" /><div className="flex gap-2"><Input type="datetime-local" value={requestDueAt} onChange={(event) => setRequestDueAt(event.target.value)} className="h-8 flex-1 text-xs" /><Button size="sm" className="h-8 text-xs" onClick={() => void createRequest()} disabled={!requestTitle.trim() || Boolean(busy)}>{busy === "request" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}Crea richiesta</Button></div></div> : null}

    {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>
      : error ? <div className="rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{error}<Button variant="ghost" size="sm" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div>
        : <div className="space-y-3">
          {(groups.client.length || materials.length) ? <section><h3 className="mb-1.5 text-xs font-semibold text-slate-900">Materiali cliente</h3><div className="rounded-lg border border-[#e8e8ed] bg-white">{groups.client.map(documentRow)}{materials.map((material) => { const state = materialStatus[material.status]; const expanded = expandedMaterialId === material.id; return <div key={material.id} className="border-b border-slate-100 px-2 py-2 last:border-0" data-material-row><div className="flex items-center gap-2"><span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-dashed border-amber-300 bg-amber-50 text-amber-700"><FilePlus2 className="h-3.5 w-3.5" /></span><span className="min-w-0 flex-1"><strong className="block truncate text-xs text-slate-900" data-record-sensitive>{material.title}</strong><span className="block truncate text-[10px] text-slate-500">Scadenza {formatDate(material.due_at)}</span></span><Badge className={cn("h-5 border-0 px-2 text-[9px]", state.className)}>{state.label}</Badge>{material.status === "requested" && onSolicit ? <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-violet-700">Sollecita</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => onSolicit("email", `Buongiorno, avremmo bisogno del materiale: ${material.title}. Grazie.`)}><Mail className="mr-2 h-4 w-4" />Email</DropdownMenuItem><DropdownMenuItem onSelect={() => onSolicit("whatsapp", `Buongiorno, avremmo bisogno del materiale: ${material.title}. Grazie.`)}><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</DropdownMenuItem></DropdownMenuContent></DropdownMenu> : null}{material.status === "requested" && canUpdate("documents") ? <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Altre azioni materiale" onClick={() => setExpandedMaterialId(expanded ? null : material.id)}><MoreHorizontal className="h-3.5 w-3.5" /></Button> : null}</div>{material.status === "received" ? <p className="mt-1 pl-10 text-[10px] text-emerald-700">Collegato: <span data-record-sensitive>{material.received_document_title || material.received_document_filename || "documento ricevuto"}</span></p> : null}{expanded ? <div className="mt-2 flex flex-wrap gap-1.5 border-t border-slate-100 pt-2"><select value={selectedDocuments[material.id] || ""} onChange={(event) => setSelectedDocuments((current) => ({ ...current, [material.id]: event.target.value }))} className="h-8 min-w-40 flex-1 rounded-md border border-slate-200 bg-white px-2 text-[10px]"><option value="">Collega file esistente…</option>{availableDocuments.map((item) => <option key={item.id} value={item.id}>{item.title || item.original_filename}</option>)}</select><Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => void receiveExisting(material)} disabled={!selectedDocuments[material.id] || Boolean(busy)}>Collega</Button><Button variant="outline" size="sm" className="h-8 text-[10px]" onClick={() => { setMaterialUploadTarget(material); window.setTimeout(() => materialInput.current?.click(), 0); }} disabled={Boolean(busy)}>Carica</Button><Button variant="ghost" size="sm" className="h-8 text-[10px]" onClick={() => void waive(material)} disabled={Boolean(busy)}>Non necessario</Button></div> : null}</div>; })}</div></section> : null}
          {groups.team.length ? <section><h3 className="mb-1.5 text-xs font-semibold text-slate-900">Consegne team</h3><div className="rounded-lg border border-[#e8e8ed] bg-white">{groups.team.map(documentRow)}</div></section> : null}
          {groups.documents.length ? <section><h3 className="mb-1.5 text-xs font-semibold text-slate-900">Documenti</h3><div className="rounded-lg border border-[#e8e8ed] bg-white">{groups.documents.map(documentRow)}</div></section> : null}
          {!documents.length && !materials.length ? <RecordPanelEmptyState title="Nessun file trovato" description="Carica il primo documento o modifica la ricerca." /> : null}
        </div>}
  </div>;
});
