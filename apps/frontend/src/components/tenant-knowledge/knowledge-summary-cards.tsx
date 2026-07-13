"use client";

import { Card, CardContent } from "@/components/ui/card";
import type { KnowledgeSummary } from "@/lib/tenant-knowledge-api";

export function KnowledgeSummaryCards({ summary }: { summary: KnowledgeSummary }) {
  const cards = [
    ["Articoli pubblicati", summary.publishedArticles || 0],
    ["Bozze", summary.draftArticles || 0],
    ["Da revisionare", summary.articlesDueForReview || 0],
    ["Asset", summary.totalAssets || 0],
    ["Template attivi", summary.activeTemplates || 0],
    ["Preferiti", summary.favoritesCount || 0],
    ["Aggiornati di recente", summary.recentlyUpdatedCount || 0],
    ["Template sistema", summary.systemTemplatesCount || 0],
    ["Rischi", summary.knowledgeRisksCount || 0],
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {cards.map(([label, value]) => (
        <Card key={String(label)}>
          <CardContent className="pt-6">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-1 text-2xl font-semibold">{value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
