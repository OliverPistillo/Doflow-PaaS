"use client";

import { FileText, FolderKanban, HardDrive, Wallet } from "lucide-react";

import { KpiGrid, KpiStatCard } from "@/components/ui/workspace-ui";
import type { DocumentSummary } from "@/lib/tenant-documents-api";
import { formatBytes } from "./document-utils";

type Props = {
  summary: DocumentSummary | null;
  canViewFinance: boolean;
};

export function DocumentsSummaryCards({ summary, canViewFinance }: Props) {
  const items = [
    { label: "Documenti totali", value: summary?.totalDocuments || 0, icon: FileText },
    { label: "Documenti progetto", value: summary?.projectDocuments || 0, icon: FolderKanban },
    ...(canViewFinance ? [{ label: "Documenti finance", value: summary?.financeDocuments || 0, icon: Wallet }] : []),
    { label: "Storage documenti", value: formatBytes(summary?.storageUsedBytes || 0), icon: HardDrive },
  ];

  return (
    <KpiGrid>
      {items.map((item) => (
        <KpiStatCard
          key={item.label}
          label={item.label}
          value={item.value}
          icon={item.icon}
          tone={item.label.includes("finance") ? "warning" : "info"}
        />
      ))}
    </KpiGrid>
  );
}
