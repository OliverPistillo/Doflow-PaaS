"use client";

import { Clock, Gauge, Timer, UserCheck, Users } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { TeamSummary } from "@/lib/tenant-team-api";

function StatCard({ label, value, icon: Icon }: { label: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 p-4">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
        </div>
        <span className="rounded-nav bg-primary/10 p-2 text-primary">
          <Icon className="h-4 w-4" />
        </span>
      </CardContent>
    </Card>
  );
}

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
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
      <StatCard label="Membri team" value={data.teamMembers || 0} icon={Users} />
      <StatCard label="Attivi" value={data.activeTeamMembers || 0} icon={UserCheck} />
      <StatCard label="Disponibili" value={data.availableTeamMembers || 0} icon={Gauge} />
      <StatCard label="Ore settimana" value={`${data.loggedHoursThisWeek || 0}h`} icon={Timer} />
      <StatCard label="Time entry pending" value={data.pendingTimeEntries || 0} icon={Clock} />
    </div>
  );
}
