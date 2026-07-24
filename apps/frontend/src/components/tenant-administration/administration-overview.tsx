"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarClock, Receipt, WalletCards } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { contractsApi, type Contract } from "@/lib/tenant-contracts-api";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import {
  financeMoney,
  numeric,
  type AdministrationList,
  type AdministrationRow,
} from "./administration-model";
import {
  AdministrationError,
  AdministrationKpi,
  AdministrationLoading,
  AdministrationPageHeader,
} from "./administration-ui";
import { CashflowChart } from "./cashflow-chart";
import { UpcomingFinancialDeadlines } from "./upcoming-financial-deadlines";
import { RecentInvoices } from "./recent-invoices";
import { ContractsRenewalsSummary } from "./contracts-renewals-summary";

function monthRange() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const iso = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  return { from: iso(from), to: iso(to) };
}

export function AdministrationOverview() {
  const { canView, canCreate } = useTenantAccess();
  const [summary, setSummary] = useState<AdministrationRow | null>(null);
  const [monthInvoices, setMonthInvoices] = useState<AdministrationRow[]>([]);
  const [overdueInvoices, setOverdueInvoices] = useState<AdministrationRow[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<AdministrationRow[]>([]);
  const [deadlines, setDeadlines] = useState<AdministrationRow[]>([]);
  const [renewals, setRenewals] = useState<AdministrationRow[]>([]);
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [truncatedMonth, setTruncatedMonth] = useState(false);
  const [truncatedOverdue, setTruncatedOverdue] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!canView("finance")) {
      setLoading(false);
      return;
    }
    const { from, to } = monthRange();
    const request = async () => {
      setLoading(true);
      setError(null);
      const financeRequests = [
        apiFetch<AdministrationRow>("/tenant/finance/summary"),
        apiFetch<AdministrationList>(`/tenant/finance/invoices?limit=100&date_from=${from}&date_to=${to}&sortBy=issue_date&sortOrder=desc`),
        apiFetch<AdministrationList>("/tenant/finance/invoices?limit=100&status=overdue&sortBy=due_date&sortOrder=asc"),
        apiFetch<AdministrationList>("/tenant/finance/invoices?limit=5&sortBy=updated_at&sortOrder=desc"),
        apiFetch<AdministrationList>("/tenant/finance/deadlines?limit=6&sortBy=due_date&sortOrder=asc"),
        apiFetch<AdministrationList>("/tenant/finance/renewals?limit=6&sortBy=due_date&sortOrder=asc"),
      ] as const;
      try {
        const [summaryData, monthData, overdueData, invoiceData, deadlineData, renewalData] = await Promise.all(financeRequests);
        if (!active) return;
        setSummary(summaryData);
        setMonthInvoices(monthData.items || []);
        setOverdueInvoices(overdueData.items || []);
        setRecentInvoices(invoiceData.items || []);
        setDeadlines(deadlineData.items || []);
        setRenewals(renewalData.items || []);
        setTruncatedMonth(Number(monthData.total || 0) > (monthData.items?.length || 0));
        setTruncatedOverdue(Number(overdueData.total || 0) > (overdueData.items?.length || 0));
        if (canView("contracts")) {
          const contractData = await contractsApi.list({ limit: 5, sortBy: "renewal_date", sortOrder: "asc" }).catch(() => ({ items: [] as Contract[] }));
          if (active) setContracts(contractData.items || []);
        } else {
          setContracts([]);
        }
      } catch (reason) {
        if (active) setError(reason instanceof Error ? reason.message : "Caricamento dell’area amministrativa non riuscito.");
      } finally {
        if (active) setLoading(false);
      }
    };
    void request();
    return () => { active = false; };
  }, [canView]);

  const monthRevenue = useMemo(() => monthInvoices.reduce((total, row) => total + numeric(row.total), 0), [monthInvoices]);
  const overdueAmount = useMemo(() => overdueInvoices.reduce((total, row) => total + numeric(row.remaining_total), 0), [overdueInvoices]);

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <AdministrationPageHeader
        title="Amministrazione"
        description="Fatture, incassi, contratti e rinnovi sotto controllo."
        ctaLabel="Nuova fattura"
        ctaHref="/finance/invoices/new"
        canCreate={canCreate("finance")}
      />
      <AdministrationError message={error} />
      {loading ? <AdministrationLoading /> : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <AdministrationKpi icon={Receipt} label="Fatturato del mese" value={financeMoney(monthRevenue)} hint={truncatedMonth ? "Importo reale sui primi 100 documenti del mese" : `${monthInvoices.length} documenti nel periodo`} />
            <AdministrationKpi icon={WalletCards} label="Da incassare" value={financeMoney(summary?.total_outstanding)} hint="Residuo complessivo registrato" tone="green" />
            <AdministrationKpi icon={AlertTriangle} label="Scaduto" value={financeMoney(overdueAmount)} hint={truncatedOverdue ? "Residuo reale sulle prime 100 fatture scadute" : `${summary?.invoices_overdue_count || 0} fatture scadute`} tone="red" />
            <AdministrationKpi icon={CalendarClock} label="Rinnovi in arrivo" value={summary?.renewals_upcoming_30d || 0} hint="Nei prossimi 30 giorni" tone="violet" />
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
            <CashflowChart summary={summary} />
            <UpcomingFinancialDeadlines rows={deadlines} />
          </div>
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(320px,1fr)]">
            <RecentInvoices rows={recentInvoices} />
            <ContractsRenewalsSummary renewals={renewals} contracts={contracts} canViewContracts={canView("contracts")} />
          </div>
        </>
      )}
    </main>
  );
}
