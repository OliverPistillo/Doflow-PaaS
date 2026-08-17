"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Archive, Check, Download, Eye, FilePlus2, FileText, Loader2, Mail,
  MessageCircle, MoreHorizontal, RefreshCw, RotateCcw, Search, Upload, X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { useToast } from "@/hooks/use-toast";
import {
  archiveDocument, downloadDocumentBlob, listDocuments, listDocumentsForEntity,
  restoreDocument, uploadDocument, uploadDocumentVersion, type TenantDocument,
} from "@/lib/tenant-documents-api";
import {
  recordOperationsApi, type MaterialRequest, type OperationsRecordKind,
} from "@/lib/tenant-record-operations-api";
import { cn } from "@/lib/utils";
import { RecordPanelEmptyState, RecordPanelSection } from "./unified-record-panel";

const categoryOptions = [
  { value: "all", label: "Tutte le categorie" },
  { value: "project_asset", label: "Materiali" },
  { value: "briefing_material", label: "Briefing" },
  { value: "company_document", label: "Documenti cliente" },
  { value: "contract", label: "Contratti" },
  { value: "quote", label: "Preventivi" },
  { value: "generic", label: "Generici" },
];

const materialStatus: Record<MaterialRequest["status"], { label: string; className: string }> = {
  requested: { label: "Da ricevere", className: "bg-amber-100 text-amber-800" },
  received: { label: "Ricevuto", className: "bg-emerald-100 text-emerald-800" },
  waived: { label: "Non necessario", className: "bg-slate-100 text-slate-700" },
};

function formatDate(value?: string | null, includeTime = false) {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return new Intl.DateTimeFormat("it-IT", includeTime ? { dateStyle: "medium", timeStyle: "short" } : { dateStyle: "medium" }).format(parsed);
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

export function RecordFiles({
  recordKind,
  recordId,
  onSolicit,
}: {
  recordKind: OperationsRecordKind;
  recordId: string;
  onSolicit?: (channel: "email" | "whatsapp", text: string) => void;
}) {
  const { canView, canCreate, canUpdate } = useTenantAccess();
  const { toast } = useToast();
  const [documents, setDocuments] = useState<TenantDocument[]>([]);
  const [availableDocuments, setAvailableDocuments] = useState<TenantDocument[]>([]);
  const [materials, setMaterials] = useState<MaterialRequest[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [status, setStatus] = useState("active");
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
  const uploadInput = useRef<HTMLInputElement>(null);
  const versionInput = useRef<HTMLInputElement>(null);
  const materialInput = useRef<HTMLInputElement>(null);
  const target = useMemo(() => ({ record_kind: recordKind, record_id: recordId }), [recordId, recordKind]);

  const load = useCallback(async () => {
    if (!canView("documents")) return;
    setLoading(true);
    setError(null);
    try {
      const [documentResult, materialResult, availableResult] = await Promise.all([
        listDocumentsForEntity(recordKind, recordId, { search, category, status, limit: 100 }),
        recordOperationsApi.materials(target),
        listDocuments({ status: "active", limit: 100, sort: "created_at", sortDir: "desc" }),
      ]);
      setDocuments(documentResult.items || []);
      setMaterials(materialResult.items || []);
      setAvailableDocuments(availableResult.items || []);
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, [canView, category, recordId, recordKind, search, status, target]);

  useEffect(() => { void load(); }, [load]);

  const upload = async (file?: File, material?: MaterialRequest) => {
    if (!file || busy || !canCreate("documents")) return;
    const operation = material ? `material-upload:${material.id}` : "upload";
    setBusy(operation);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", file.name);
      form.append("entity_type", recordKind);
      form.append("entity_id", recordId);
      form.append("category", material ? "briefing_material" : recordKind === "project" ? "project_asset" : "company_document");
      form.append("visibility", "internal");
      form.append("relation_type", "attachment");
      const document = await uploadDocument(form);
      if (material) await recordOperationsApi.receiveMaterial(material.id, document.id);
      toast({ title: material ? "Materiale ricevuto" : "File caricato", description: "Il documento è stato collegato al record." });
      await load();
    } catch (reason) {
      toast({ title: "Caricamento non riuscito", description: errorMessage(reason), variant: "destructive" });
    } finally {
      setBusy(null);
      setMaterialUploadTarget(null);
      if (uploadInput.current) uploadInput.current.value = "";
      if (materialInput.current) materialInput.current.value = "";
    }
  };

  const createRequest = async () => {
    if (!requestTitle.trim() || busy) return;
    setBusy("request");
    try {
      await recordOperationsApi.createMaterial(target, {
        title: requestTitle,
        description: requestDescription || undefined,
        due_at: requestDueAt || undefined,
      });
      setRequestTitle("");
      setRequestDescription("");
      setRequestDueAt("");
      setRequestOpen(false);
      toast({ title: "Materiale richiesto", description: "La richiesta è stata aggiunta alla timeline operativa." });
      await load();
    } catch (reason) {
      toast({ title: "Richiesta non creata", description: errorMessage(reason), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const receiveExisting = async (material: MaterialRequest) => {
    const documentId = selectedDocuments[material.id];
    if (!documentId || busy) return;
    setBusy(`receive:${material.id}`);
    try {
      await recordOperationsApi.receiveMaterial(material.id, documentId);
      toast({ title: "Materiale collegato", description: "La richiesta è stata segnata come ricevuta." });
      await load();
    } catch (reason) {
      toast({ title: "Collegamento non riuscito", description: errorMessage(reason), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const waive = async (material: MaterialRequest) => {
    if (busy) return;
    setBusy(`waive:${material.id}`);
    try {
      await recordOperationsApi.waiveMaterial(material.id);
      toast({ title: "Materiale non necessario", description: "La richiesta è stata chiusa senza cambiare la fase progetto." });
      await load();
    } catch (reason) {
      toast({ title: "Aggiornamento non riuscito", description: errorMessage(reason), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const updateStatus = async (document: TenantDocument, next: "archive" | "restore") => {
    if (busy || !canUpdate("documents")) return;
    setBusy(`${next}:${document.id}`);
    try {
      if (next === "archive") await archiveDocument(document.id);
      else await restoreDocument(document.id);
      toast({ title: next === "archive" ? "File archiviato" : "File ripristinato" });
      await load();
    } catch (reason) {
      toast({ title: "Aggiornamento non riuscito", description: errorMessage(reason), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  const version = async (file?: File) => {
    if (!file || !versionTarget || busy) return;
    setBusy(`version:${versionTarget.id}`);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("title", versionTarget.title);
      await uploadDocumentVersion(versionTarget.id, form);
      toast({ title: "Nuova versione caricata", description: `${versionTarget.title} è stato aggiornato.` });
      await load();
    } catch (reason) {
      toast({ title: "Versione non caricata", description: errorMessage(reason), variant: "destructive" });
    } finally {
      setBusy(null);
      setVersionTarget(null);
      if (versionInput.current) versionInput.current.value = "";
    }
  };

  const openBlob = async (document: TenantDocument, download: boolean) => {
    if (busy) return;
    setBusy(`${download ? "download" : "open"}:${document.id}`);
    try {
      const result = await downloadDocumentBlob(document);
      const url = URL.createObjectURL(result.blob);
      if (download) {
        const anchor = window.document.createElement("a");
        anchor.href = url;
        anchor.download = result.filename;
        anchor.click();
      } else window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (reason) {
      toast({ title: "File non disponibile", description: errorMessage(reason), variant: "destructive" });
    } finally {
      setBusy(null);
    }
  };

  if (!canView("documents")) {
    return <RecordPanelEmptyState title="File non disponibili" description="Il tuo profilo non dispone del permesso documenti." />;
  }

  return (
    <div className="space-y-5" data-record-files>
      <input ref={uploadInput} type="file" className="hidden" onChange={(event) => void upload(event.target.files?.[0])} />
      <input ref={versionInput} type="file" className="hidden" onChange={(event) => void version(event.target.files?.[0])} />
      <input ref={materialInput} type="file" className="hidden" onChange={(event) => void upload(event.target.files?.[0], materialUploadTarget || undefined)} />

      <RecordPanelSection title="File operativi" description="Documenti reali collegati direttamente a questo record.">
        <div className="flex flex-wrap gap-2">
          <label className="relative min-w-48 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca file" className="pl-9" />
          </label>
          <select value={category} onChange={(event) => setCategory(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            {categoryOptions.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)} className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm">
            <option value="active">Attivi</option><option value="archived">Archiviati</option><option value="__all__">Tutti gli stati</option>
          </select>
          {canCreate("documents") ? <Button onClick={() => uploadInput.current?.click()} disabled={Boolean(busy)} className="bg-violet-600 hover:bg-violet-700"><Upload className="mr-2 h-4 w-4" />Carica file</Button> : null}
        </div>

        {canCreate("documents") ? (
          <div
            onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragging(false)}
            onDrop={(event) => { event.preventDefault(); setDragging(false); void upload(event.dataTransfer.files?.[0]); }}
            className={cn("mt-3 rounded-xl border border-dashed px-4 py-3 text-center text-xs text-slate-500 transition-colors", dragging ? "border-violet-500 bg-violet-50 text-violet-700" : "border-slate-300 bg-slate-50")}
          >
            Trascina qui un file oppure usa “Carica file” · massimo 25 MB
          </div>
        ) : null}

        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-violet-600" /></div>
          : error ? <div className="mt-3 rounded-xl bg-rose-50 p-3 text-sm text-rose-700">{error}<Button variant="ghost" size="sm" onClick={() => void load()}><RefreshCw className="h-4 w-4" /></Button></div>
            : documents.length ? <div className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">{documents.map((document) => (
              <div key={document.id} className="flex items-center gap-3 p-3" data-document-row>
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-700"><FileText className="h-4 w-4" /></span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-900" data-record-sensitive>{document.title || document.original_filename}</span>
                  <span className="block truncate text-xs text-slate-500">{document.category} · v{document.version_number || 1} · {formatBytes(document.size_bytes)} · {formatDate(document.created_at)} · <span data-record-sensitive>{document.uploaded_by_email || "Autore interno"}</span></span>
                </span>
                <Badge variant="outline" className={document.status === "archived" ? "text-slate-500" : "text-emerald-700"}>{document.status === "archived" ? "Archiviato" : "Attivo"}</Badge>
                <Button variant="ghost" size="icon" aria-label="Apri file" onClick={() => void openBlob(document, false)} disabled={Boolean(busy)}><Eye className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" aria-label="Scarica file" onClick={() => void openBlob(document, true)} disabled={Boolean(busy)}><Download className="h-4 w-4" /></Button>
                {canUpdate("documents") ? <Button variant="ghost" size="icon" aria-label="Nuova versione" onClick={() => { setVersionTarget(document); window.setTimeout(() => versionInput.current?.click(), 0); }} disabled={Boolean(busy)}><FilePlus2 className="h-4 w-4" /></Button> : null}
                {canUpdate("documents") ? <Button variant="ghost" size="icon" aria-label={document.status === "archived" ? "Ripristina file" : "Archivia file"} onClick={() => void updateStatus(document, document.status === "archived" ? "restore" : "archive")} disabled={Boolean(busy)}>{document.status === "archived" ? <RotateCcw className="h-4 w-4" /> : <Archive className="h-4 w-4" />}</Button> : null}
              </div>
            ))}</div> : <div className="mt-4"><RecordPanelEmptyState title="Nessun file trovato" description="Carica il primo documento o modifica i filtri." /></div>}
      </RecordPanelSection>

      <RecordPanelSection title="Materiali richiesti" description="Richieste operative senza modificare automaticamente la fase progetto.">
        <div className="mb-3 flex items-center justify-between gap-3">
          <p className="text-xs text-slate-500">{materials.filter((item) => item.status === "requested").length} da ricevere</p>
          {canCreate("documents") ? <Button variant="outline" size="sm" onClick={() => setRequestOpen((value) => !value)}><FilePlus2 className="mr-2 h-4 w-4" />Richiedi materiale</Button> : null}
        </div>
        {requestOpen ? <div className="mb-4 space-y-3 rounded-xl border border-violet-200 bg-violet-50/50 p-3" data-material-request-form>
          <div className="flex items-center justify-between"><p className="text-sm font-semibold">Nuova richiesta</p><Button variant="ghost" size="icon" onClick={() => setRequestOpen(false)}><X className="h-4 w-4" /></Button></div>
          <Input value={requestTitle} onChange={(event) => setRequestTitle(event.target.value)} placeholder="Titolo materiale" maxLength={300} />
          <Textarea value={requestDescription} onChange={(event) => setRequestDescription(event.target.value)} placeholder="Descrizione opzionale" rows={2} />
          <Input type="datetime-local" value={requestDueAt} onChange={(event) => setRequestDueAt(event.target.value)} />
          <Button onClick={() => void createRequest()} disabled={!requestTitle.trim() || Boolean(busy)}>{busy === "request" ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}Crea richiesta</Button>
        </div> : null}

        {materials.length ? <div className="space-y-3">{materials.map((material) => {
          const state = materialStatus[material.status];
          return <div key={material.id} className="rounded-xl border border-slate-200 bg-white p-3" data-material-row>
            <div className="flex items-start gap-3">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><MoreHorizontal className="h-4 w-4" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-slate-900" data-record-sensitive>{material.title}</span>{material.description ? <span className="mt-1 block text-xs leading-5 text-slate-600" data-record-sensitive>{material.description}</span> : null}<span className="mt-1 block text-xs text-slate-500">Scadenza {formatDate(material.due_at)} · richiesto da <span data-record-sensitive>{material.requested_by_label || "operatore interno"}</span></span></span>
              <Badge className={cn("border-0", state.className)}>{state.label}</Badge>
            </div>
            {material.status === "received" ? <p className="mt-2 text-xs text-emerald-700">Collegato: <span data-record-sensitive>{material.received_document_title || material.received_document_filename || "documento ricevuto"}</span></p> : null}
            {material.status === "requested" && canUpdate("documents") ? <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
              <div className="flex flex-wrap gap-2">
                <select value={selectedDocuments[material.id] || ""} onChange={(event) => setSelectedDocuments((current) => ({ ...current, [material.id]: event.target.value }))} className="h-9 min-w-48 flex-1 rounded-lg border border-slate-200 bg-white px-2 text-xs">
                  <option value="">Collega file esistente…</option>{availableDocuments.map((document) => <option key={document.id} value={document.id}>{document.title || document.original_filename}</option>)}
                </select>
                <Button variant="outline" size="sm" onClick={() => void receiveExisting(material)} disabled={!selectedDocuments[material.id] || Boolean(busy)}>Collega e ricevi</Button>
                <Button variant="outline" size="sm" onClick={() => { setMaterialUploadTarget(material); window.setTimeout(() => materialInput.current?.click(), 0); }} disabled={Boolean(busy)}><Upload className="mr-1 h-3.5 w-3.5" />Carica e ricevi</Button>
                <Button variant="ghost" size="sm" onClick={() => void waive(material)} disabled={Boolean(busy)}>Non necessario</Button>
              </div>
              {onSolicit ? <div className="flex flex-wrap gap-2"><span className="self-center text-[11px] text-slate-500">Sollecita:</span><Button variant="ghost" size="sm" onClick={() => onSolicit("email", `Buongiorno, avremmo bisogno del materiale: ${material.title}. Grazie.`)}><Mail className="mr-1 h-3.5 w-3.5" />Email</Button><Button variant="ghost" size="sm" onClick={() => onSolicit("whatsapp", `Buongiorno, avremmo bisogno del materiale: ${material.title}. Grazie.`)}><MessageCircle className="mr-1 h-3.5 w-3.5" />WhatsApp</Button></div> : null}
            </div> : null}
          </div>;
        })}</div> : <RecordPanelEmptyState title="Nessun materiale richiesto" description="Crea una richiesta soltanto quando serve un input concreto dal cliente." />}
      </RecordPanelSection>
    </div>
  );
}
