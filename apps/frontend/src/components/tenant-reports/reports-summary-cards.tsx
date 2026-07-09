"use client";

import { AlertTriangle, BarChart3, CheckCircle2, Target, TrendingUp, Wallet } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
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
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.label}>
            <CardContent className="flex items-center justify-between gap-4 p-4">
              <div>
                <p className="text-xs font-semibold text-muted-foreground">{item.label}</p>
                <p className="mt-1 text-2xl font-bold tabular-nums">{typeof item.value === "number" ? formatNumber(item.value) : item.value}</p>
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

