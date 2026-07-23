"use client";

import { FileText, FolderKanban, HardDrive, Wallet } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">{item.value}</p>
              </div>
              <span className="rounded-nav bg-primary/10 p-2 text-primary">
                <Icon className="h-4 w-4" />
              </span>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
