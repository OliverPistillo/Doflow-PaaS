"use client";

import { AlertTriangle, Banknote, Clock3, Receipt } from "lucide-react";
import { financeMoney, numeric, type AdministrationRow } from "./administration-model";
import { AdministrationKpi } from "./administration-ui";

export function InvoicesKpis({ rows, truncated }: { rows: AdministrationRow[]; truncated: boolean }) {
  const total = rows.reduce((sum, row) => sum + numeric(row.total), 0);
  const paid = rows.reduce((sum, row) => sum + numeric(row.paid_total), 0);
  const outstanding = rows.reduce((sum, row) => sum + numeric(row.remaining_total), 0);
  const overdue = rows
    .filter((row) => row.status === "overdue")
    .reduce((sum, row) => sum + numeric(row.remaining_total), 0);
  const hint = truncated ? "Valore reale sui primi 100 risultati" : `${rows.length} fatture nei filtri correnti`;
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdministrationKpi icon={Receipt} label="Totale fatturato" value={financeMoney(total)} hint={hint} />
      <AdministrationKpi icon={Banknote} label="Incassato" value={financeMoney(paid)} hint="Pagamenti registrati" tone="green" />
      <AdministrationKpi icon={Clock3} label="Da incassare" value={financeMoney(outstanding)} hint="Residuo dei risultati correnti" tone="orange" />
      <AdministrationKpi icon={AlertTriangle} label="Scaduto" value={financeMoney(overdue)} hint="Residuo sulle fatture scadute" tone="red" />
    </div>
  );
}
