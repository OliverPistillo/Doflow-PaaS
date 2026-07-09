"use client";

import { reportsApi } from "@/lib/tenant-reports-api";
import { KeyValueList, MetricGrid, ReportPage, Section, SimpleTable } from "./reports-core";

export function ProjectsReportPage() {
  return (
    <ReportPage
      reportKey="projects"
      title="Report progetti"
      description="Stato delivery, task, milestone, rischi e workload progetto."
      load={reportsApi.projects}
      render={(data) => {
        const projects = data.projects || data;
        return (
          <div className="space-y-4">
            <Section title="KPI progetti">
              <MetricGrid metrics={[
                { label: "Attivi", value: projects.activeProjects },
                { label: "Completati", value: projects.completedProjects },
                { label: "In ritardo", value: projects.lateProjects },
                { label: "Bloccati", value: projects.blockedProjects },
                { label: "Task scaduti", value: projects.overdueTasks },
                { label: "Task in scadenza", value: projects.dueSoonTasks },
                { label: "Milestone prossime", value: projects.upcomingMilestones },
                { label: "Delivery rate", value: projects.projectDeliveryRate, kind: "percent" },
              ]} />
            </Section>
            <Section title="Progetti per stato"><KeyValueList data={projects.projectsByStatus} /></Section>
            <Section title="Task per stato"><KeyValueList data={projects.tasksByStatus} /></Section>
            <Section title="Milestone per stato"><KeyValueList data={projects.milestonesByStatus} /></Section>
            <Section title="Rischi progetto">
              <SimpleTable rows={projects.projectRisks || []} empty="Nessun rischio rilevato." columns={[
                { key: "name", label: "Progetto" },
                { key: "status", label: "Stato" },
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

