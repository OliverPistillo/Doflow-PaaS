"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import {
  knowledgeApi,
  type OperationalTemplate,
  type OperationalTemplateUsage,
  type OperationalTemplateVersion,
} from "@/lib/tenant-knowledge-api";
import { TEMPLATE_STATUS_LABELS, VISIBILITY_LABELS, downloadJson, formatDateTime, jsonText } from "./knowledge-utils";
import { Header, JsonBlock, Loading, StatusBadge, itemsOf, normalizeError, useKnowledgeOptions } from "./knowledge-shared";
import { TemplateFormPanel, templatePayload } from "./knowledge-template-form";
import { KnowledgeTemplatePreview } from "./knowledge-template-preview";
import { KnowledgeTemplateUsePanel, KnowledgeTemplateUsage } from "./knowledge-template-usage";
import { KnowledgeTemplateVersions } from "./knowledge-template-versions";

export function KnowledgeTemplateDetailPage({ templateId }: { templateId: string }) {
  const options = useKnowledgeOptions();
  const { toast } = useToast();
  const [template, setTemplate] = useState<OperationalTemplate | null>(null);
  const [versions, setVersions] = useState<OperationalTemplateVersion[]>([]);
  const [usage, setUsage] = useState<OperationalTemplateUsage[]>([]);
  const [form, setForm] = useState<Record<string, string>>({});

  const load = async () => {
    const [tpl, versionPayload, usagePayload] = await Promise.all([
      knowledgeApi.getOperationalTemplate(templateId),
      knowledgeApi.listOperationalTemplateVersions(templateId).catch(() => ({ items: [] as OperationalTemplateVersion[] })),
      knowledgeApi.listOperationalTemplateUsage(templateId).catch(() => ({ items: [] as OperationalTemplateUsage[] })),
    ]);
    setTemplate(tpl);
    setVersions(itemsOf(versionPayload));
    setUsage(itemsOf(usagePayload));
    setForm({
      name: tpl.name || "",
      slug: tpl.slug || "",
      description: tpl.description || "",
      template_type: tpl.template_type || "generic",
      category: tpl.category || "operations",
      status: tpl.status || "draft",
      visibility: tpl.visibility || "team",
      content: jsonText(tpl.content),
      variables: jsonText(tpl.variables),
      instructions: tpl.instructions || "",
      metadata: jsonText(tpl.metadata),
      change_summary: "",
    });
  };

  useEffect(() => { void load(); }, [templateId]);

  const update = async () => {
    try {
      await knowledgeApi.updateOperationalTemplate(templateId, templatePayload(form));
      await load();
    } catch (err) {
      toast({ title: "Update fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  if (!template) return <Loading />;

  return (
    <div className="space-y-6">
      <Header title={template.name} description="Dettaglio template operativo, preview, use, versioni e usage.">
        <Button asChild variant="outline"><Link href="/knowledge/templates">Torna lista</Link></Button>
        <Button variant="outline" onClick={() => knowledgeApi.activateOperationalTemplate(templateId).then(load)}>Activate</Button>
        <Button variant="outline" onClick={() => knowledgeApi.archiveOperationalTemplate(templateId).then(load)}>Archive</Button>
        <Button variant="outline" onClick={() => knowledgeApi.duplicateOperationalTemplate(templateId).then((copy) => { location.href = `/knowledge/templates/${copy.id}`; })}>Duplica</Button>
        <Button variant="outline" onClick={() => knowledgeApi.exportOperationalTemplate(templateId).then((data) => downloadJson(`knowledge-template-${templateId}.json`, data))}>Export</Button>
      </Header>
      <div className="flex gap-2">
        <StatusBadge value={template.status} map={TEMPLATE_STATUS_LABELS} />
        <StatusBadge value={template.visibility} map={VISIBILITY_LABELS} />
        <span className="rounded-md border px-2 py-1 text-xs">{template.template_type}</span>
        <span className="rounded-md border px-2 py-1 text-xs">{template.category}</span>
      </div>
      <Card>
        <CardHeader><CardTitle>Overview</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <p>{template.description}</p>
          <p className="text-sm text-muted-foreground">{template.instructions}</p>
          <JsonBlock value={template.content} />
          <JsonBlock value={template.variables} />
          <JsonBlock value={template.metadata} />
          <div className="text-sm">Usage: {template.usage_count || 0} · Last used: {formatDateTime(template.last_used_at)} · System: {template.is_system ? "Sì" : "No"}</div>
        </CardContent>
      </Card>
      <TemplateFormPanel title="Modifica template" form={form} setForm={setForm} options={options} onSubmit={update} submitLabel="Salva template" embedded />
      <KnowledgeTemplatePreview templateId={templateId} />
      <KnowledgeTemplateUsePanel templateId={templateId} onUsed={() => void load()} />
      <KnowledgeTemplateVersions versions={versions} />
      <KnowledgeTemplateUsage usage={usage} />
    </div>
  );
}
