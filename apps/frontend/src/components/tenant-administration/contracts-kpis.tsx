"use client";

import { CalendarClock, FileCheck2, FileSignature, WalletCards } from "lucide-react";
import { financeMoney, numeric, type AdministrationRow } from "./administration-model";
import { AdministrationKpi } from "./administration-ui";

export function ContractsKpis({
  summary,
  rows,
  canViewFinance,
}: {
  summary?: AdministrationRow | null;
  rows: AdministrationRow[];
  canViewFinance: boolean;
}) {
  const data = summary?.contracts || summary || {};
  const value = rows.reduce((total, row) => total + numeric(row.amount), 0);
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdministrationKpi icon={FileCheck2} label="Attivi" value={data.signedContracts || rows.filter((row) => ["signed", "active"].includes(row.status)).length} hint="Firmati o attivi" />
      <AdministrationKpi icon={FileSignature} label="In firma" value={data.waitingSignatureContracts || rows.filter((row) => ["internal_pending", "client_pending", "partially_signed"].includes(row.signature_status)).length} hint="Con firma in corso" tone="orange" />
      <AdministrationKpi icon={CalendarClock} label="In scadenza" value={data.expiringContracts || 0} hint="Nei prossimi 30 giorni" tone="red" />
      {canViewFinance
        ? <AdministrationKpi icon={WalletCards} label="Valore contratti" value={financeMoney(value)} hint="Valore reale dei contratti caricati" tone="green" />
        : <AdministrationKpi icon={CalendarClock} label="Scaduti" value={data.overdueContracts || 0} hint="Contratti oltre scadenza" tone="orange" />}
    </div>
  );
}
