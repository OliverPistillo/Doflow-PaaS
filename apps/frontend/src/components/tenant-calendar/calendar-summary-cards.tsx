"use client";

import { AlertTriangle, BellRing, CalendarCheck2, CalendarDays, Clock3, GitMerge, Users, Workflow } from "lucide-react";
import { KpiGrid, KpiStatCard } from "@/components/ui/workspace-ui";
import type { CalendarSummary } from "@/lib/tenant-calendar-api";

export function CalendarSummaryCards({ summary }: { summary?: CalendarSummary | null }) {
  return (
    <KpiGrid>
      <KpiStatCard label="Eventi oggi" value={summary?.eventsToday || 0} icon={CalendarCheck2} tone="info" />
      <KpiStatCard label="Eventi settimana" value={summary?.eventsThisWeek || 0} icon={CalendarDays} />
      <KpiStatCard label="Scaduti" value={summary?.overdueEvents || 0} icon={AlertTriangle} tone="danger" />
      <KpiStatCard label="Conflitti" value={summary?.conflictsCount || 0} icon={GitMerge} tone="warning" />
      <KpiStatCard label="Scadenze settimana" value={summary?.deadlinesThisWeek || 0} icon={Clock3} tone="warning" />
      <KpiStatCard label="Team assente oggi" value={summary?.teamUnavailableToday || 0} icon={Users} />
      <KpiStatCard label="Reminder dovuti" value={summary?.remindersDue || 0} icon={BellRing} tone="warning" />
      <KpiStatCard label="Eventi derivati" value={summary?.derivedEventsCount || 0} icon={Workflow} tone="success" />
    </KpiGrid>
  );
}
