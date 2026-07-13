"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type KnowledgeOptions } from "@/lib/tenant-knowledge-api";
import { cleanPayload, parseJsonField } from "./knowledge-utils";
import { Header, SelectFilter, normalizeError, useKnowledgeOptions } from "./knowledge-shared";

const DEFAULT_CONTENT = "{\n  \"items\": [\n    {\n      \"title\": \"Verifica responsive\",\n      \"required\": true\n    }\n  ]\n}";

export function KnowledgeTemplateFormPage() {
  const options = useKnowledgeOptions();
  const router = useRouter();
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({
    template_type: "generic",
    category: "operations",
    status: "draft",
    visibility: "team",
    content: DEFAULT_CONTENT,
    variables: "{}",
    metadata: "{}",
  });

  const submit = async () => {
    try {
      const template = await knowledgeApi.createOperationalTemplate(templatePayload(form));
      router.push(`/knowledge/templates/${template.id}`);
    } catch (err) {
      toast({ title: "Creazione fallita", description: normalizeError(err), variant: "destructive" });
    }
  };

  return <TemplateFormPanel title="Nuovo template" form={form} setForm={setForm} options={options} onSubmit={submit} submitLabel="Crea template" />;
}

export function TemplateFormPanel({ title, form, setForm, options, onSubmit, submitLabel, embedded }: { title: string; form: Record<string, string>; setForm: (value: Record<string, string>) => void; options: KnowledgeOptions; onSubmit: () => void; submitLabel: string; embedded?: boolean }) {
  const content = (
    <Card>
      <CardHeader><CardTitle>{title}</CardTitle></CardHeader>
      <CardContent className="grid gap-3">
        <Input placeholder="Nome" value={form.name || ""} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <Input placeholder="Slug" value={form.slug || ""} onChange={(e) => setForm({ ...form, slug: e.target.value })} />
        <Textarea placeholder="Descrizione" value={form.description || ""} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        <div className="grid gap-3 md:grid-cols-4">
          <SelectFilter placeholder="Tipo" values={options.template_types} value={form.template_type} onChange={(v) => setForm({ ...form, template_type: v })} />
          <Input placeholder="Categoria" value={form.category || ""} onChange={(e) => setForm({ ...form, category: e.target.value })} />
          <SelectFilter placeholder="Status" values={["draft", "active", "archived"]} value={form.status} onChange={(v) => setForm({ ...form, status: v })} />
          <SelectFilter placeholder="Visibility" values={options.visibilities} value={form.visibility} onChange={(v) => setForm({ ...form, visibility: v })} />
        </div>
        <Label>Content JSON</Label><Textarea className="min-h-40 font-mono" value={form.content || "{}"} onChange={(e) => setForm({ ...form, content: e.target.value })} />
        <Label>Variables JSON</Label><Textarea className="font-mono" value={form.variables || "{}"} onChange={(e) => setForm({ ...form, variables: e.target.value })} />
        <Textarea placeholder="Instructions" value={form.instructions || ""} onChange={(e) => setForm({ ...form, instructions: e.target.value })} />
        <Input placeholder="Change summary opzionale" value={form.change_summary || ""} onChange={(e) => setForm({ ...form, change_summary: e.target.value })} />
        <Label>Metadata JSON</Label><Textarea className="font-mono" value={form.metadata || "{}"} onChange={(e) => setForm({ ...form, metadata: e.target.value })} />
        <Button onClick={onSubmit}>{submitLabel}</Button>
      </CardContent>
    </Card>
  );
  return embedded ? content : <div className="space-y-6"><Header title={title} description="Template operativo versionato." />{content}</div>;
}

export function templatePayload(form: Record<string, string>) {
  return cleanPayload({
    ...form,
    content: parseJsonField(form.content, {}),
    variables: parseJsonField(form.variables, {}),
    metadata: parseJsonField(form.metadata, {}),
  });
}
