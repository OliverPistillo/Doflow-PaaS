"use client";

import { reportsApi } from "@/lib/tenant-reports-api";
import { formatCurrency, formatNumber } from "./report-utils";
import { KeyValueList, MetricGrid, ReportPage, Section, SimpleTable } from "./reports-core";

export function TeamReportPage() {
  return (
    <ReportPage
      reportKey="team"
      title="Report team"
      description="Carichi, disponibilità, ore lavorate e capacità operativa."
      load={reportsApi.team}
      render={(data, canFinance) => {
        const team = data.team || data;
        return (
          <div className="space-y-4">
            <Section title="KPI team">
              <MetricGrid metrics={[
                { label: "Sovraccarichi", value: team.overloadedMembers },
                { label: "Costo stimato", value: team.estimatedInternalCost, kind: "currency", hidden: !canFinance },
              ]} />
            </Section>
            <Section title="Membri per stato"><KeyValueList data={team.membersByStatus} /></Section>
            <Section title="Distribuzione disponibilità"><KeyValueList data={team.availabilityDistribution} /></Section>
            <Section title="Distribuzione workload"><KeyValueList data={team.workloadDistribution} /></Section>
            <Section title="Ore per attività"><KeyValueList data={team.loggedHoursByActivityType} /></Section>
            <Section title="Time entries per stato"><KeyValueList data={team.timeEntriesByStatus} /></Section>
            <Section title="Ore per membro">
              <SimpleTable rows={team.loggedHoursByMember || []} columns={[
                { key: "display_name", label: "Membro" },
                { key: "hours", label: "Ore", format: (value) => formatNumber(value) },
              ]} />
            </Section>
            <Section title="Capacità vs ore loggate">
              <SimpleTable rows={team.capacityVsLoggedHours || []} columns={[
                { key: "display_name", label: "Membro" },
                { key: "capacityHours", label: "Capacità" },
                { key: "loggedHoursThisWeek", label: "Ore settimana" },
                { key: "utilizationPercent", label: "Utilizzo", format: (value) => `${formatNumber(value)}%` },
              ]} />
            </Section>
            {canFinance && team.estimatedInternalCost ? <p className="text-sm text-muted-foreground">Costo interno stimato: {formatCurrency(team.estimatedInternalCost)}</p> : null}
          </div>
        );
      }}
    />
  );
}

