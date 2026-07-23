"use client";

import { AlertTriangle, CalendarClock, CheckCircle2, Clock3, ListChecks, PlayCircle, Workflow, Zap } from "lucide-react";
import { KpiGrid, KpiStatCard } from "@/components/ui/workspace-ui";
import type { AutomationSummary } from "@/lib/tenant-automations-api";
import { formatDateTime } from "./automation-utils";

export function AutomationsSummaryCards({ summary }: { summary?: AutomationSummary | null }) {
  return (
    <KpiGrid>
      <KpiStatCard label="Regole totali" value={summary?.totalRules || 0} icon={Workflow} />
      <KpiStatCard label="Abilitate" value={summary?.enabledRules || 0} icon={Zap} tone="success" />
      <KpiStatCard label="Run falliti oggi" value={summary?.failedRunsToday || 0} icon={AlertTriangle} tone="danger" />
      <KpiStatCard label="Run riusciti oggi" value={summary?.successfulRunsToday || 0} icon={CheckCircle2} tone="success" />
      <KpiStatCard label="Azioni oggi" value={summary?.actionsToday || 0} icon={ListChecks} tone="info" />
      <KpiStatCard label="Regole dovute" value={summary?.dueRules || 0} icon={CalendarClock} tone="warning" />
      <KpiStatCard label="Rischi automazione" value={summary?.automationRisksCount || 0} icon={PlayCircle} tone="danger" />
      <KpiStatCard
        label="Ultimo run"
        value={summary?.lastRunAt ? formatDateTime(summary.lastRunAt) : "-"}
        icon={Clock3}
      />
    </KpiGrid>
  );
}
