"use client";

import { reportsApi } from "@/lib/tenant-reports-api";
import { formatCurrency } from "./report-utils";
import { KeyValueList, MetricGrid, ReportPage, Section, SimpleTable, TargetsProgress } from "./reports-core";

export function ExecutiveReportPage() {
  return (
    <ReportPage
      reportKey="executive"
      title="Report direzione"
      description="Vista completa per CEO/Admin con KPI trasversali e rischi principali."
      load={reportsApi.executive}
      render={(data, canFinance) => (
        <div className="space-y-4">
          <Section title="Sales">
            <MetricGrid metrics={[
              { label: "Lead aperti", value: data.sales?.openLeads },
              { label: "Nuovi lead", value: data.sales?.newLeadsInPeriod },
              { label: "Opportunità attive", value: data.sales?.activeOpportunities },
              { label: "Pipeline", value: data.sales?.pipelineValue, kind: "currency", hidden: !canFinance },
              { label: "Preventivi accettati", value: data.sales?.acceptedQuotes },
              { label: "Acceptance rate", value: data.sales?.quoteAcceptanceRate, kind: "percent" },
            ]} />
          </Section>
          <Section title="Progetti">
            <MetricGrid metrics={[
              { label: "Attivi", value: data.projects?.activeProjects },
              { label: "Completati", value: data.projects?.completedProjects },
              { label: "In ritardo", value: data.projects?.lateProjects },
              { label: "Bloccati", value: data.projects?.blockedProjects },
              { label: "Task scaduti", value: data.projects?.overdueTasks },
              { label: "Delivery rate", value: data.projects?.projectDeliveryRate, kind: "percent" },
            ]} />
          </Section>
          {canFinance && data.finance ? (
            <Section title="Finance">
              <MetricGrid metrics={[
                { label: "Fatture emesse", value: data.finance.issuedInvoices },
                { label: "Fatture pagate", value: data.finance.paidInvoices },
                { label: "Fatture scadute", value: data.finance.overdueInvoices },
                { label: "Da incassare", value: data.finance.receivables, kind: "currency" },
                { label: "Incassi periodo", value: data.finance.paymentsInPeriod, kind: "currency" },
                { label: "Margine stimato", value: data.finance.estimatedMargin, kind: "currency" },
              ]} />
            </Section>
          ) : null}
          <Section title="Team">
            <MetricGrid metrics={[
              { label: "Sovraccarichi", value: data.team?.overloadedMembers },
              { label: "Ore mese", value: data.team?.loggedHoursByActivityType?.work || 0 },
              { label: "Time entry pendenti", value: data.team?.timeEntriesByStatus?.submitted || 0 },
            ]} />
          </Section>
          <Section title="Documenti"><KeyValueList data={data.documents} canFinance={canFinance} /></Section>
          <Section title="Operatività"><KeyValueList data={data.operations} canFinance={canFinance} /></Section>
          <Section title="Clienti"><KeyValueList data={data.customers} canFinance={canFinance} /></Section>
          <Section title="Obiettivi KPI"><TargetsProgress targets={data.targets || []} /></Section>
          <Section title="Rischi principali">
            <SimpleTable
              rows={data.risks || []}
              empty="Nessun rischio rilevato."
              columns={[
                { key: "type", label: "Tipo" },
                { key: "name", label: "Nome", format: (value, row) => value || row.title || row.invoice_number || row.id },
                { key: "status", label: "Stato" },
                { key: "due_date", label: "Scadenza" },
                { key: "remaining_total", label: "Residuo", format: (value) => value ? formatCurrency(value) : "-" },
              ]}
            />
          </Section>
        </div>
      )}
    />
  );
}

