"use client";

import { AlertTriangle, Clock3, FileQuestion, FolderOpen, ShieldAlert } from "lucide-react";
import { KpiGrid, KpiStatCard } from "@/components/ui/workspace-ui";

type PaperworkSummary = {
  openDossiers?: number;
  blockedDossiers?: number;
  overdueDossiers?: number;
  missingItems?: number;
  dueSoonItems?: number;
};

export function PaperworkSummaryCards({ summary }: { summary?: PaperworkSummary | null }) {
  return (
    <KpiGrid className="xl:grid-cols-5">
      <KpiStatCard label="Dossier aperti" value={summary?.openDossiers || 0} icon={FolderOpen} tone="info" />
      <KpiStatCard label="Bloccati" value={summary?.blockedDossiers || 0} icon={ShieldAlert} tone="danger" />
      <KpiStatCard label="Scaduti" value={summary?.overdueDossiers || 0} icon={AlertTriangle} tone="danger" />
      <KpiStatCard label="Item mancanti" value={summary?.missingItems || 0} icon={FileQuestion} tone="warning" />
      <KpiStatCard label="Item in scadenza" value={summary?.dueSoonItems || 0} icon={Clock3} tone="warning" />
    </KpiGrid>
  );
}
