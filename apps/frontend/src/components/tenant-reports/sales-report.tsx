"use client";

import { reportsApi } from "@/lib/tenant-reports-api";
import { formatCurrency } from "./report-utils";
import { KeyValueList, MetricGrid, ReportPage, Section, SimpleTable } from "./reports-core";

export function SalesReportPage() {
  return (
    <ReportPage
      reportKey="sales"
      title="Report vendite"
      description="Lead, opportunità, pipeline, preventivi e attività commerciali."
      load={reportsApi.sales}
      render={(data, canFinance) => {
        const sales = data.sales || data;
        return (
          <div className="space-y-4">
            <Section title="KPI vendite">
              <MetricGrid metrics={[
                { label: "Lead aperti", value: sales.openLeads },
                { label: "Nuovi lead periodo", value: sales.newLeadsInPeriod },
                { label: "Opportunità attive", value: sales.activeOpportunities },
                { label: "Pipeline", value: sales.pipelineValue, kind: "currency", hidden: !canFinance },
                { label: "Acceptance rate", value: sales.quoteAcceptanceRate, kind: "percent" },
                { label: "Follow-up dovuti", value: sales.followUpsDue },
              ]} />
            </Section>
            <Section title="Lead per stato"><KeyValueList data={sales.leadCountByStatus} /></Section>
            <Section title="Lead per fonte"><KeyValueList data={sales.leadCountBySource} /></Section>
            <Section title="Opportunità per stage"><KeyValueList data={sales.opportunitiesByStage} /></Section>
            {canFinance ? <Section title="Valore pipeline per stage"><KeyValueList data={sales.pipelineValueByStage} valueKind="currency" /></Section> : null}
            <Section title="Preventivi per status"><KeyValueList data={sales.quoteCountByStatus} /></Section>
            {canFinance ? <Section title="Valore preventivi per status"><KeyValueList data={sales.quoteValueByStatus} valueKind="currency" /></Section> : null}
            <Section title="Top opportunità">
              <SimpleTable rows={sales.topOpportunities || []} columns={[
                { key: "title", label: "Titolo" },
                { key: "stage", label: "Stage" },
                { key: "value_estimate", label: "Valore", format: (value) => canFinance ? formatCurrency(value) : "-" },
                { key: "expected_close_date", label: "Chiusura attesa" },
              ]} />
            </Section>
            <Section title="Opportunità ferme">
              <SimpleTable rows={sales.stagnantOpportunities || []} empty="Nessuna opportunità ferma." columns={[
                { key: "title", label: "Titolo" },
                { key: "stage", label: "Stage" },
                { key: "updated_at", label: "Ultimo aggiornamento" },
              ]} />
            </Section>
            <Section title="Attività commerciali"><KeyValueList data={sales.commercialActivities} /></Section>
          </div>
        );
      }}
    />
  );
}

