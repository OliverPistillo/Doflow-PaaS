"use client";

import { BookOpen, FileClock, Files, Heart, Library, ShieldAlert, Sparkles, Star, Workflow } from "lucide-react";
import { KpiGrid, KpiStatCard } from "@/components/ui/workspace-ui";
import type { KnowledgeSummary } from "@/lib/tenant-knowledge-api";

export function KnowledgeSummaryCards({ summary }: { summary: KnowledgeSummary }) {
  const cards = [
    { label: "Articoli pubblicati", value: summary.publishedArticles || 0, icon: BookOpen, tone: "success" as const },
    { label: "Bozze", value: summary.draftArticles || 0, icon: Files, tone: "default" as const },
    { label: "Da revisionare", value: summary.articlesDueForReview || 0, icon: FileClock, tone: "warning" as const },
    { label: "Asset", value: summary.totalAssets || 0, icon: Library, tone: "info" as const },
    { label: "Template attivi", value: summary.activeTemplates || 0, icon: Workflow, tone: "success" as const },
    { label: "Preferiti", value: summary.favoritesCount || 0, icon: Heart, tone: "default" as const },
    { label: "Aggiornati di recente", value: summary.recentlyUpdatedCount || 0, icon: Sparkles, tone: "info" as const },
    { label: "Template sistema", value: summary.systemTemplatesCount || 0, icon: Star, tone: "default" as const },
    { label: "Rischi", value: summary.knowledgeRisksCount || 0, icon: ShieldAlert, tone: "danger" as const },
  ];

  return (
    <KpiGrid className="lg:grid-cols-3">
      {cards.map((card) => (
        <KpiStatCard key={card.label} {...card} />
      ))}
    </KpiGrid>
  );
}
