"use client";

import { reportsApi } from "@/lib/tenant-reports-api";
import { KeyValueList, MetricGrid, ReportPage, Section, SimpleTable } from "./reports-core";

export function CustomersReportPage() {
  return (
    <ReportPage
      reportKey="customers"
      title="Report clienti"
      description="Report interno su aziende, clienti attivi, rinnovi e opportunità upsell."
      load={reportsApi.customers}
      render={(data, canFinance) => {
        const customers = data.customers || data;
        return (
          <div className="space-y-4">
            <Section title="KPI clienti">
              <MetricGrid metrics={[
                { label: "Clienti attivi", value: customers.activeCustomers },
                { label: "Prospect", value: customers.prospects },
                { label: "Dormienti", value: customers.dormantCustomers },
                { label: "Con progetti attivi", value: customers.customersWithActiveProjects },
                { label: "Con servizi ricorrenti", value: customers.customersWithRecurringServices },
                { label: "Rinnovi prossimi", value: customers.customersWithUpcomingRenewals },
                { label: "Fatture aperte", value: customers.customersWithUnpaidInvoices, hidden: !canFinance },
              ]} />
            </Section>
            <Section title="Aziende per stato"><KeyValueList data={customers.companiesByStatus} /></Section>
            <Section title="Upsell candidates">
              <SimpleTable rows={customers.upsellCandidates || []} empty="Nessun candidato upsell rilevato." columns={[
                { key: "name", label: "Azienda" },
                { key: "status", label: "Stato" },
                { key: "updated_at", label: "Ultimo aggiornamento" },
              ]} />
            </Section>
          </div>
        );
      }}
    />
  );
}

