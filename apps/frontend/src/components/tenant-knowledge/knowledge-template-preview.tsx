"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { knowledgeApi } from "@/lib/tenant-knowledge-api";
import { parseJsonField } from "./knowledge-utils";
import { JsonBlock, normalizeError } from "./knowledge-shared";

export function KnowledgeTemplatePreview({ templateId }: { templateId: string }) {
  const { toast } = useToast();
  const [variables, setVariables] = useState("{}");
  const [preview, setPreview] = useState<unknown>(null);

  const runPreview = async () => {
    try {
      setPreview(await knowledgeApi.previewOperationalTemplate(templateId, { variables: parseJsonField(variables, {}) }));
    } catch (err) {
      toast({ title: "Preview fallita", description: normalizeError(err), variant: "destructive" });
    }
  };

  return (
    <Card>
      <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <Textarea className="font-mono" value={variables} onChange={(e) => setVariables(e.target.value)} />
        <Button onClick={runPreview}>Preview</Button>
        {preview ? <JsonBlock value={preview} /> : null}
      </CardContent>
    </Card>
  );
}
