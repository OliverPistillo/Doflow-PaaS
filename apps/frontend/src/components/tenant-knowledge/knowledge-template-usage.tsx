"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi, type OperationalTemplateUsage } from "@/lib/tenant-knowledge-api";
import { cleanPayload, formatDateTime, isUuid } from "./knowledge-utils";
import { Empty, JsonBlock, normalizeError } from "./knowledge-shared";

export function KnowledgeTemplateUsePanel({ templateId, onUsed }: { templateId: string; onUsed: () => void }) {
  const { toast } = useToast();
  const [form, setForm] = useState<Record<string, string>>({});
  const [result, setResult] = useState<unknown>(null);

  const runUse = async () => {
    try {
      if (form.target_entity_id && !isUuid(form.target_entity_id)) throw new Error("target_entity_id non valido");
      setResult(await knowledgeApi.useOperationalTemplate(templateId, cleanPayload({ target_entity_type: form.target_entity_type, target_entity_id: form.target_entity_id })));
      onUsed();
    } catch (err) {
      toast({ title: "Use template fallito", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Use template</CardTitle>
        <CardDescription>Funziona anche senza target_entity_id; i campi target sono opzionali.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-3">
        <Input placeholder="target_entity_type opzionale" value={form.target_entity_type || ""} onChange={(e) => setForm({ ...form, target_entity_type: e.target.value })} />
        <Input placeholder="target_entity_id UUID opzionale" value={form.target_entity_id || ""} onChange={(e) => setForm({ ...form, target_entity_id: e.target.value })} />
        <Button onClick={runUse}>Use</Button>
        {result ? <div className="md:col-span-3"><JsonBlock value={result} /></div> : null}
      </CardContent>
    </Card>
  );
}

export function KnowledgeTemplateUsage({ usage }: { usage: OperationalTemplateUsage[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Usage</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {usage.length ? usage.map((item) => (
          <div key={item.id} className="rounded-lg border px-3 py-2 text-sm">
            <div>{item.action || "use"} · {item.target_entity_type || "-"}:{item.target_entity_id || "-"}</div>
            <div className="text-muted-foreground">{item.actor_user_id || "-"} · {formatDateTime(item.created_at)}</div>
            <JsonBlock value={item.result_payload} />
          </div>
        )) : <Empty>Nessun utilizzo registrato.</Empty>}
      </CardContent>
    </Card>
  );
}
