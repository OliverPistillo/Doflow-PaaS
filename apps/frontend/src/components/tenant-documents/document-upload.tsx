"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader, PageShell } from "@/components/ui/page-shell";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { getDoFlowUser } from "@/lib/jwt";
import { listDocumentFolders, uploadDocument, type DocumentFolder } from "@/lib/tenant-documents-api";
import {
  DOCUMENT_CATEGORIES,
  DOCUMENT_ENTITY_TYPES,
  DOCUMENT_VISIBILITIES,
  canViewFinanceDocuments,
  categoryLabel,
  entityLabel,
  visibilityLabel,
} from "./document-utils";

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Upload fallito";
}

export function DocumentUploadPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  const canViewFinance = canViewFinanceDocuments(getDoFlowUser()?.role);
  const [folders, setFolders] = useState<DocumentFolder[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    folder_id: searchParams.get("folder_id") || "",
    category: searchParams.get("category") || "generic",
    visibility: searchParams.get("visibility") || "internal",
    entity_type: searchParams.get("entity_type") || "",
    entity_id: searchParams.get("entity_id") || "",
    metadata: "",
  });

  useEffect(() => {
    listDocumentFolders()
      .then((data) => setFolders(data.items || []))
      .catch(() => setFolders([]));
  }, []);

  const categories = canViewFinance ? DOCUMENT_CATEGORIES : DOCUMENT_CATEGORIES.filter((item) => !["finance", "invoice", "receipt"].includes(item));
  const visibilities = canViewFinance ? DOCUMENT_VISIBILITIES : DOCUMENT_VISIBILITIES.filter((item) => item !== "finance");

  const submit = async () => {
    if (!file) {
      toast({ title: "File obbligatorio", description: "Seleziona un file da caricare.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const data = new FormData();
      data.append("file", file);
      Object.entries(form).forEach(([key, value]) => {
        if (value) data.append(key, value);
      });
      const document = await uploadDocument(data);
      toast({ title: "Documento caricato" });
      router.push(document?.id ? `/documents/${document.id}` : "/documents");
    } catch (error) {
      toast({
        title: "Upload non completato",
        description: errorMessage(error),
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell>
      <PageHeader
        title="Carica documento"
        description="Carica un file nel modulo Documenti interno e collegalo opzionalmente a CRM, progetto, preventivo, briefing o finance."
      />

      <Card>
        <CardContent className="grid gap-4 pt-6 lg:grid-cols-2">
          <div className="grid gap-2 lg:col-span-2">
            <Label>File *</Label>
            <Input type="file" onChange={(event) => setFile(event.target.files?.[0] || null)} />
          </div>
          <div className="grid gap-2">
            <Label>Titolo</Label>
            <Input value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Lascia vuoto per usare il nome file" />
          </div>
          <div className="grid gap-2">
            <Label>Cartella</Label>
            <Select value={form.folder_id || "__none__"} onValueChange={(value) => setForm((prev) => ({ ...prev, folder_id: value === "__none__" ? "" : value }))}>
              <SelectTrigger><SelectValue placeholder="Nessuna cartella" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nessuna cartella</SelectItem>
                {folders.map((folder) => <SelectItem key={folder.id} value={folder.id}>{folder.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Categoria</Label>
            <Select value={form.category} onValueChange={(value) => setForm((prev) => ({ ...prev, category: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {categories.map((category) => <SelectItem key={category} value={category}>{categoryLabel(category)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Visibilità</Label>
            <Select value={form.visibility} onValueChange={(value) => setForm((prev) => ({ ...prev, visibility: value }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {visibilities.map((visibility) => <SelectItem key={visibility} value={visibility}>{visibilityLabel(visibility)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>Entità collegata</Label>
            <Select value={form.entity_type || "__none__"} onValueChange={(value) => setForm((prev) => ({ ...prev, entity_type: value === "__none__" ? "" : value }))}>
              <SelectTrigger><SelectValue placeholder="Nessuna entità" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Nessuna entità</SelectItem>
                {DOCUMENT_ENTITY_TYPES.map((type) => <SelectItem key={type} value={type}>{entityLabel(type)}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-2">
            <Label>ID entità</Label>
            <Input value={form.entity_id} onChange={(event) => setForm((prev) => ({ ...prev, entity_id: event.target.value }))} placeholder="UUID opzionale" />
          </div>
          <div className="grid gap-2 lg:col-span-2">
            <Label>Descrizione</Label>
            <Textarea rows={4} value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} />
          </div>
          <div className="grid gap-2 lg:col-span-2">
            <Label>Metadata JSON opzionale</Label>
            <Textarea className="font-mono text-xs" rows={4} value={form.metadata} onChange={(event) => setForm((prev) => ({ ...prev, metadata: event.target.value }))} placeholder='{"origine":"briefing"}' />
          </div>
          <div className="flex gap-2 lg:col-span-2">
            <Button onClick={submit} disabled={saving || !file}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Upload className="mr-2 h-4 w-4" />}
              Carica documento
            </Button>
            <Button variant="outline" onClick={() => router.push("/documents")}>Annulla</Button>
          </div>
        </CardContent>
      </Card>
    </PageShell>
  );
}
