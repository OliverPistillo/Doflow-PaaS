"use client";

import { Clock, Gauge, Timer, UserCheck, Users } from "lucide-react";
import { KpiGrid, KpiStatCard } from "@/components/ui/workspace-ui";
import type { TeamSummary } from "@/lib/tenant-team-api";

export function TeamSummaryCards({ summary }: { summary: TeamSummary | null }) {
  const data = summary || {
    teamMembers: 0,
    activeTeamMembers: 0,
    availableTeamMembers: 0,
    unavailableTeamMembers: 0,
    overloadedMembers: 0,
    totalCapacityHours: 0,
    loggedHoursThisWeek: 0,
    loggedHoursThisMonth: 0,
    pendingTimeEntries: 0,
    overdueTasksByTeam: 0,
    workload: [],
  };

  return (
    <KpiGrid className="xl:grid-cols-5">
      <KpiStatCard label="Membri team" value={data.teamMembers || 0} icon={Users} />
      <KpiStatCard label="Attivi" value={data.activeTeamMembers || 0} icon={UserCheck} tone="success" />
      <KpiStatCard label="Disponibili" value={data.availableTeamMembers || 0} icon={Gauge} tone="success" />
      <KpiStatCard label="Ore settimana" value={`${data.loggedHoursThisWeek || 0}h`} icon={Timer} tone="info" />
      <KpiStatCard
        label="Time entry pending"
        value={data.pendingTimeEntries || 0}
        icon={Clock}
        tone={(data.pendingTimeEntries || 0) > 0 ? "warning" : "default"}
      />
    </KpiGrid>
  );
}
