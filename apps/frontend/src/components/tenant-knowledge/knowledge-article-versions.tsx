"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { KnowledgeArticleVersion } from "@/lib/tenant-knowledge-api";
import { compactJson, formatDateTime } from "./knowledge-utils";
import { Empty } from "./knowledge-shared";

export function KnowledgeArticleVersions({ versions }: { versions: KnowledgeArticleVersion[] }) {
  return (
    <Card>
      <CardHeader><CardTitle>Versioni articolo</CardTitle></CardHeader>
      <CardContent className="space-y-2">
        {versions.length ? versions.map((version) => (
          <div key={version.id} className="rounded-lg border px-3 py-2 text-sm">
            <div className="font-medium">Versione {version.version_number} · {formatDateTime(version.created_at)}</div>
            <div className="text-muted-foreground">{version.change_summary || "Nessun riepilogo modifica."}</div>
            <pre className="mt-2 max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">{compactJson(version.content)}</pre>
          </div>
        )) : <Empty>Nessuna versione disponibile.</Empty>}
      </CardContent>
    </Card>
  );
}
