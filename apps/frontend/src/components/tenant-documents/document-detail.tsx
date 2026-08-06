"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Archive, Download, Loader2, RotateCcw, Save, Trash2, Upload } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { useConfirm } from "@/hooks/useConfirm";
import { getDoFlowUser } from "@/lib/jwt";
import {
  archiveDocument,
  deleteDocument,
  downloadDocumentBlob,
  getDocument,
  getDocumentActivity,
  listDocumentFolders,
  restoreDocument,
  updateDocument,
  uploadDocumentVersion,
  type DocumentActivity,
  type DocumentFolder,
  type TenantDocument,
} from "@/lib/tenant-documents-api";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_VISIBILITIES,
  canViewFinanceDocuments,
  categoryClass,
  categoryLabel,
  entityLabel,
  formatBytes,
  formatDateTime,
  statusClass,
  statusLabel,
  visibilityClass,
  visibilityLabel,
} from "./document-utils";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Errore documento";
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function DocumentDetailPage({ documentId }: { documentId: string }) {
  const router = useRouter();
  const { toast } = useToast();
  const { ConfirmDialog, confirm } = useConfirm();
  const canViewFinance = canViewFinanceDocuments(getDoFlowUser()?.role);
  const [document, setDocument] = useState<TenantDocument | null>(null);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [activity, setActivity] = useState<DocumentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [versionFile, setVersionFile] = useState<File | null>(null);
  const [form, setForm] = useState({
    title: "",
    description: "",
    folder_id: "",
    category: "generic",
    visibility: "internal",
    metadata: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [doc, foldersData, activityData] = await Promise.all([
        getDocument(documentId),
        listDocumentFolders().catch(() => ({ items: [] })),
        getDocumentActivity(documentId).catch(() => ({ items: [] })),
      ]);
      setDocument(doc);
      setFolders(foldersData.items || []);
      setActivity(activityData.items || []);
      setForm({
        title: doc.title || "",
        description: doc.description || "",
        folder_id: doc.folder_id || "",
        category: doc.category || "generic",
        visibility: doc.visibility || "internal",
        metadata: doc.metadata ? JSON.stringify(doc.metadata, null, 2) : "",
      });
    } catch (error) {
      toast({ title: "Documento non caricato", description: errorMessage(error), variant: "destructive" });
      setDocument(null);
    } finally {
      setLoading(false);
    }
  }, [documentId, toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const categories = canViewFinance ? DOCUMENT_CATEGORIES : DOCUMENT_CATEGORIES.filter((item) => !["finance", "invoice", "receipt"].includes(item));
  const visibilities = canViewFinance ? DOCUMENT_VISIBILITIES : DOCUMENT_VISIBILITIES.filter((item) => item !== "finance");

  const download = async () => {
    if (!document) return;
    try {
      const { blob, filename } = await downloadDocumentBlob(document);
      saveBlob(blob, filename);
    } catch (error) {
      toast({ title: "Download fallito", description: errorMessage(error), variant: "destructive" });
    }
  };

  const save = async () => {
    if (!document) return;
    setSaving(true);
    try {
      await updateDocument(document.id, {
        title: form.title,
        description: form.description,
        folder_id: form.folder_id || null,
        category: form.category,
        visibility: form.visibility,
        metadata: form.metadata ? JSON.parse(form.metadata) : null,
      } as Partial<TenantDocument>);
      toast({ title: "Documento aggiornato" });
      await load();
    } catch (error) {
      toast({ title: "Salvataggio fallito", description: errorMessage(error), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const mutateStatus = async (kind: "archive" | "restore" | "delete") => {
    if (!document) return;
    try {
      if (kind === "archive") await archiveDocument(document.id);
      if (kind === "restore") await restoreDocument(document.id);
      if (kind === "delete") await deleteDocument(document.id);
      toast({ title: kind === "archive" ? "Documento archiviato" : kind === "restore" ? "Documento ripristinato" : "Documento eliminato" });
      if (kind === "delete") router.push("/documents");
      else await load();
    } catch (error) {
      toast({ title: "Operazione non completata", description: errorMessage(error), variant: "destructive" });
    }
  };

  const uploadVersion = async () => {
    if (!document || !versionFile) return;
    try {
      const data = new FormData();
      data.append("file", versionFile);
      await uploadDocumentVersion(document.id, data);
      toast({ title: "Nuova versione caricata" });
      setVersionFile(null);
      await load();
    } catch (error) {
      toast({ title: "Versione non caricata", description: errorMessage(error), variant: "destructive" });
    }
  };

  if (loading) {
    return <PageShell><div className="flex min-h-[40vh] items-center justify-center text-muted-foreground"><Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" /> Caricamento documento...</div></PageShell>;
  }

  if (!document) {
    return <PageShell><Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Documento non trovato.</CardContent></Card></PageShell>;
  }

  return (
    <PageShell>
      <PageHeader
        title={document.title}
        description={document.original_filename}
        actions={
          <>
            <Button variant="outline" size="sm" onClick={() => router.push("/documents")}>Torna ai documenti</Button>
            <Button variant="outline" size="sm" onClick={download}><Download className="mr-2 h-4 w-4" /> Download</Button>
          </>
        }
      />

      <div className="grid gap-4 xl:grid-cols-[1.4fr_0.8fr]">
        <Card>
          <CardHeader><CardTitle>Dettagli documento</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <Info label="Filename" value={document.original_filename} />
            <Info label="MIME type" value={document.mime_type || "-"} />
            <Info label="Dimensione" value={formatBytes(document.size_bytes)} />
            <Info label="Versione" value={`v${document.version_number || 1}`} />
            <Info label="Cartella" value={document.folder_name || "Senza cartella"} />
            <Info label="Creato" value={formatDateTime(document.created_at)} />
            <div className="flex flex-wrap gap-2 md:col-span-2">
              <Badge variant="outline" className={categoryClass(document.category)}>{categoryLabel(document.category)}</Badge>
              <Badge variant="outline" className={visibilityClass(document.visibility)}>{visibilityLabel(document.visibility)}</Badge>
              <Badge variant="outline" className={statusClass(document.status)}>{statusLabel(document.status)}</Badge>
              {document.entity_type && document.entity_id ? <Badge variant="outline">{entityLabel(document.entity_type)} {document.entity_id.slice(0, 8)}</Badge> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Azioni</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {document.status === "archived" || document.status === "deleted" ? (
              <Button className="w-full" variant="outline" onClick={() => mutateStatus("restore")}><RotateCcw className="mr-2 h-4 w-4" /> Ripristina</Button>
            ) : (
              <Button className="w-full" variant="outline" onClick={() => mutateStatus("archive")}><Archive className="mr-2 h-4 w-4" /> Archivia</Button>
            )}
            <Button
              className="w-full"
              variant="outline"
              onClick={async () => {
                const ok = await confirm({
                  title: "Eliminare questo documento?",
                  description: "L'operazione è un soft delete.",
                  confirmLabel: "Elimina",
                  variant: "destructive",
                });
                if (ok) {
                  void mutateStatus("delete");
                }
              }}
            >
              <Trash2 className="mr-2 h-4 w-4 text-destructive" />
              Elimina soft delete
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader><CardTitle>Modifica base</CardTitle></CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-2">
          <div className="grid gap-2"><Label>Titolo</Label><Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} /></div>
          <div className="grid gap-2">
            <Label>Cartella</Label>
            <Select value={form.folder_id || "__none__"} onValueChange={(value) => setForm((prev) => ({ ...prev, folder_id: value === "__none__" ? "" : value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nessuna cartella</SelectItem>
                {folders.map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2"><Label>Categoria</Label><Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{categories.map((item) => <SelectItem key={item} value={item}>{categoryLabel(item)}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2"><Label>Visibilità</Label><Select value={form.visibility} onValueChange={(value) => setForm((prev) => ({ ...prev, visibility: value }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{visibilities.map((item) => <SelectItem key={item} value={item}>{visibilityLabel(item)}</SelectItem>)}</SelectContent></Select></div>
          <div className="grid gap-2 lg:col-span-2"><Label>Descrizione</Label><Textarea rows={4} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
          <div className="grid gap-2 lg:col-span-2"><Label>Metadata JSON</Label><Textarea className="font-mono text-xs" rows={5} value={form.metadata} onChange={(event) => setForm((prev) => ({ ...prev, metadata: event.target.value }))} /></div>
          <div className="lg:col-span-2"><Button onClick={save} disabled={saving || !form.title.trim()}>{saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />} Salva</Button></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Nuova versione</CardTitle></CardHeader>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Input type="file" onChange={(event) => setVersionFile(event.target.files?.[0] || null)} />
          <Button onClick={uploadVersion} disabled={!versionFile}><Upload className="mr-2 h-4 w-4" /> Carica versione</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Attività documento</CardTitle></CardHeader>
        <CardContent>
          {activity.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nessuna attività registrata.</p>
          ) : (
            <div className="space-y-2">
              {activity.map((item) => (
                <div key={item.id} className="flex flex-col gap-1 rounded-nav bg-muted/40 px-3 py-2 text-sm sm:flex-row sm:items-center sm:justify-between">
                  <span><strong>{item.action}</strong> {item.actor_email ? `da ${item.actor_email}` : ""}</span>
                  <span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
      <ConfirmDialog />
    </PageShell>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
