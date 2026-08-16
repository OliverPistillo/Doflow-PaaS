"use client";

import { reportsApi } from "@/lib/tenant-reports-api";
import { getDoFlowUser } from "@/lib/jwt";
import { aggregateProjectStageValues, projectStageLabel } from "@/lib/project-stage-model";
import { isInternalDoflowTenant } from "@/lib/tenant-url";
import { KeyValueList, MetricGrid, ReportPage, Section, SimpleTable } from "./reports-core";

export function ProjectsReportPage() {
  const user = getDoFlowUser();
  const doflow = isInternalDoflowTenant(user?.tenantSlug || user?.tenantId);
  return (
    <ReportPage
      reportKey="projects"
      title="Report progetti"
      description="Stato delivery, task, milestone, rischi e workload progetto."
      load={reportsApi.projects}
      render={(data) => {
        const projects = data.projects || data;
        const projectStageCounts = doflow
          ? Object.fromEntries(Object.entries(aggregateProjectStageValues(projects.projectsByStatus || {})).map(([stage, value]) => [projectStageLabel(stage, true), value]))
          : projects.projectsByStatus;
        return (
          <div className="space-y-4">
            <Section title="KPI progetti">
              <MetricGrid metrics={[
                { label: "Attivi", value: projects.activeProjects },
                { label: "Completati", value: projects.completedProjects },
                { label: "In ritardo", value: projects.lateProjects },
                { label: doflow ? "In pausa" : "Bloccati", value: projects.blockedProjects },
                { label: "Task scaduti", value: projects.overdueTasks },
                { label: "Task in scadenza", value: projects.dueSoonTasks },
                { label: "Milestone prossime", value: projects.upcomingMilestones },
                { label: "Delivery rate", value: projects.projectDeliveryRate, kind: "percent" },
              ]} />
            </Section>
            <Section title={doflow ? "Progetti per fase" : "Progetti per stato"}><KeyValueList data={projectStageCounts} /></Section>
            <Section title="Task per stato"><KeyValueList data={projects.tasksByStatus} /></Section>
            <Section title="Milestone per stato"><KeyValueList data={projects.milestonesByStatus} /></Section>
            <Section title="Rischi progetto">
              <SimpleTable rows={projects.projectRisks || []} empty="Nessun rischio rilevato." columns={[
                { key: "name", label: "Progetto" },
                { key: "status", label: doflow ? "Fase" : "Stato", format: (value) => projectStageLabel(value, doflow) },
                { key: "due_date", label: "Scadenza" },
                { key: "project_manager_id", label: "PM" },
              ]} />
            </Section>
            <Section title="Workload per progetto">
              <SimpleTable rows={projects.workloadByProject || []} columns={[
                { key: "name", label: "Progetto" },
                { key: "openTasks", label: "Task aperti" },
                { key: "overdueTasks", label: "Task scaduti" },
              ]} />
            </Section>
          </div>
        );
      }}
    />
  );
}
