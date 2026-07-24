"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type KnowledgeOptions } from "@/lib/tenant-knowledge-api";
import { cleanPayload, isUuid, parseJsonField } from "./knowledge-utils";
import { Header, SelectFilter, normalizeError, useKnowledgeOptions } from "./knowledge-shared";

export function KnowledgeAssetFormPage() {
  const options = useKnowledgeOptions();
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({ asset_type: "document", status: "active", visibility: "team", metadata: "{}" });

  const submit = async () => {
    try {
      if (form.document_id && !isUuid(form.document_id)) throw new Error("document_id non valido");
      if (form.external_url) new URL(form.external_url);
      const item = await knowledgeApi.createKnowledgeAsset(assetPayload(form));
      router.push(`/knowledge/assets/${item.id}`);
    } catch (err) {
      toast({ title: "Creazione fallita", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <div className="space-y-6">
      <Header title="Nuovo asset" description="Per caricare file usa il modulo Documenti; qui puoi collegare un document_id esistente." />
      <AssetFormFields form={form} setForm={setForm} options={options} onSubmit={submit} submitLabel="Crea asset" />
    </div>
  );
}

export function AssetFormFields({ form, setForm, options, onSubmit, submitLabel }: { form: Record<string, string>; setForm: (value: Record<string, string>) => void; options: KnowledgeOptions; onSubmit: () => void; submitLabel: string }) {
  return (
    <Card><CardContent className="grid gap-3 pt-6">
      <Input placeholder="Nome" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
      <Textarea placeholder="Descrizione" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
      <div className="grid gap-3 md:grid-cols-3">
        <Input placeholder="Collection ID" value={form.collection_id || ""} onChange={(e) => setForm({ ...form, collection_id: e.target.value })} />
        <Input placeholder="Document ID" value={form.document_id || ""} onChange={(e) => setForm({ ...form, document_id: e.target.value })} />
        <Input placeholder="External URL" value={form.external_url || ""} onChange={(e) => setForm({ ...form, external_url: e.target.value })} />
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <SelectFilter placeholder="Tipo" values={options.asset_types} value={form.asset_type} onChange={(v) => setForm({ ...form, asset_type: v })} />
        <SelectFilter placeholder="Status" values={["active", "archived"]} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
        <SelectFilter placeholder="Visibility" values={options.visibilities} value={form.visibility} onChange={(v) => setForm({ ...form, visibility: v })} />
        <Input placeholder="Versione" value={form.version || ""} onChange={(e) => setForm({ ...form, version: e.target.value })} />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Input placeholder="MIME type" value={form.mime_type || ""} onChange={(e) => setForm({ ...form, mime_type: e.target.value })} />
        <Input type="number" placeholder="File size bytes" value={form.file_size_bytes || ""} onChange={(e) => setForm({ ...form, file_size_bytes: e.target.value })} />
      </div>
      <Label>Metadata JSON</Label>
      <Textarea className="font-mono" value={form.metadata || "{}"} onChange={(e) => setForm({ ...form, metadata: e.target.value })} />
      <Button onClick={onSubmit}>{submitLabel}</Button>
    </CardContent></Card>
  );
}

export function assetPayload(form: Record<string, string>) {
  return cleanPayload({
    ...form,
    file_size_bytes: form.file_size_bytes ? Number(form.file_size_bytes) : undefined,
    metadata: parseJsonField(form.metadata, {}),
  });
}
