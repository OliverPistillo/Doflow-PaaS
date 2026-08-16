"use client";

import { reportsApi } from "@/lib/tenant-reports-api";
import { getDoFlowUser } from "@/lib/jwt";
import { projectStageLabel } from "@/lib/project-stage-model";
import { isInternalDoflowTenant } from "@/lib/tenant-url";
import { KeyValueList, MetricGrid, ReportPage, Section, SimpleTable } from "./reports-core";

export function OperationsReportPage() {
  const user = getDoFlowUser();
  const doflow = isInternalDoflowTenant(user?.tenantSlug || user?.tenantId);
  return (
    <ReportPage
      reportKey="operations"
      title="Report operatività"
      description="Notifiche, briefing, materiali, task scaduti e rischi operativi."
      load={reportsApi.operations}
      render={(data, canFinance) => {
        const operations = data.operations || data;
        return (
          <div className="space-y-4">
            <Section title="KPI operativi">
              <MetricGrid metrics={[
                { label: "Notifiche non lette", value: operations.unreadNotifications },
                { label: "Urgenti", value: operations.urgentNotifications },
                { label: "Briefing incompleti", value: operations.incompleteBriefings },
                { label: "Materiali mancanti", value: operations.missingMaterials },
                { label: "Task scaduti", value: operations.overdueTasks },
                { label: doflow ? "Progetti in pausa" : "Progetti bloccati", value: operations.blockedProjects },
                { label: "Quote ferme", value: operations.staleQuotes },
              ]} />
            </Section>
            <Section title="Notifiche per tipo"><KeyValueList data={operations.notificationsByType} canFinance={canFinance} /></Section>
            <Section title="Regole notifiche"><KeyValueList data={operations.notificationRulesStatus} /></Section>
            <Section title="Rischi aperti">
              <SimpleTable rows={operations.openRisks || []} empty="Nessun rischio rilevato." columns={[
                { key: "type", label: "Tipo" },
                { key: "name", label: "Nome", format: (value, row) => value || row.title || row.id },
                { key: "status", label: "Stato", format: (value, row) => doflow && row.type === "project_blocked" ? projectStageLabel(value, true) : value || "-" },
                { key: "due_date", label: "Scadenza", format: (value, row) => value || row.due_at || "-" },
              ]} />
            </Section>
          </div>
        );
      }}
    />
  );
}
