"use client";

import { reportsApi } from "@/lib/tenant-reports-api";
import { formatCurrency } from "./report-utils";
import { KeyValueList, MetricGrid, ReportPage, Section, SimpleTable } from "./reports-core";

export function FinanceReportPage() {
  return (
    <ReportPage
      reportKey="finance"
      title="Report finance"
      description="Fatture, incassi, scadenze, rinnovi, saldi e margine stimato. Solo CEO/Admin."
      load={reportsApi.finance}
      financeOnly
      render={(data) => {
        const finance = data.finance || data;
        return (
          <div className="space-y-4">
            <Section title="KPI finance">
              <MetricGrid metrics={[
                { label: "Fatture emesse", value: finance.issuedInvoices },
                { label: "Valore emesso", value: finance.issuedInvoiceValue, kind: "currency" },
                { label: "Fatture pagate", value: finance.paidInvoices },
                { label: "Valore pagato", value: finance.paidInvoiceValue, kind: "currency" },
                { label: "Fatture scadute", value: finance.overdueInvoices },
                { label: "Da incassare", value: finance.receivables, kind: "currency" },
                { label: "Incassi periodo", value: finance.paymentsInPeriod, kind: "currency" },
                { label: "Margine stimato", value: finance.estimatedMargin, kind: "currency" },
              ]} />
            </Section>
            <Section title="Fatture per stato"><KeyValueList data={finance.invoicesByStatus} valueKind="currency" /></Section>
            <Section title="Pagamenti per mese">
              <SimpleTable rows={finance.paymentsByMonth || []} columns={[
                { key: "period", label: "Periodo" },
                { key: "value", label: "Incassato", format: (value) => formatCurrency(value) },
              ]} />
            </Section>
            <Section title="Stato economico progetti"><KeyValueList data={finance.projectFinancialStatus} /></Section>
            <Section title="Fatture aperte principali">
              <SimpleTable rows={finance.topUnpaidInvoices || []} empty="Nessuna fattura aperta." columns={[
                { key: "invoice_number", label: "Numero" },
                { key: "title", label: "Titolo" },
                { key: "status", label: "Stato" },
                { key: "due_date", label: "Scadenza" },
                { key: "remaining_total", label: "Residuo", format: (value) => formatCurrency(value) },
              ]} />
            </Section>
          </div>
        );
      }}
    />
  );
}

