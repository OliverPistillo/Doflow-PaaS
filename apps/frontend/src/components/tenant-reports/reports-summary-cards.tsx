"use client";

import { AlertTriangle, BarChart3, CheckCircle2, Target, TrendingUp, Wallet } from "lucide-react";
import { KpiGrid, KpiStatCard } from "@/components/ui/workspace-ui";
import type { ReportSummary } from "@/lib/tenant-reports-api";
import { formatCurrency, formatDate, formatNumber } from "./report-utils";

type Props = {
  summary?: ReportSummary | null;
  canViewFinance?: boolean;
};

export function ReportsSummaryCards({ summary, canViewFinance }: Props) {
  const items = [
    { label: "Report disponibili", value: summary?.reportsAvailable?.length || 0, icon: BarChart3 },
    { label: "Target KPI", value: summary?.kpiTargetsConfigured || 0, icon: Target },
    { label: "Rischi direzionali", value: summary?.executiveRisksCount || 0, icon: AlertTriangle },
    { label: "Lead mese", value: summary?.currentMonthNewLeads || 0, icon: TrendingUp },
    { label: "Preventivi accettati", value: summary?.currentMonthAcceptedQuotes || 0, icon: CheckCircle2 },
    { label: "Task scaduti", value: summary?.currentMonthOverdueTasks || 0, icon: AlertTriangle },
    ...(canViewFinance ? [{ label: "Incassi mese", value: formatCurrency(summary?.currentMonthRevenue || 0), icon: Wallet }] : []),
    { label: "Ultimo snapshot", value: formatDate(summary?.lastSnapshotAt || null), icon: BarChart3 },
  ];

  return (
    <KpiGrid>
      {items.map((item) => (
        <KpiStatCard
          key={item.label}
          label={item.label}
          value={typeof item.value === "number" ? formatNumber(item.value) : item.value}
          icon={item.icon}
          tone={item.label.includes("Rischi") || item.label.includes("scaduti") ? "warning" : "info"}
        />
      ))}
    </KpiGrid>
  );
}
