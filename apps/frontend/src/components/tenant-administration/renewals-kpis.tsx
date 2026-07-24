"use client";

import { AlertTriangle, CalendarClock, RefreshCw, WalletCards } from "lucide-react";
import { addDays, dateValue, financeMoney, numeric, startOfDay, type AdministrationRow } from "./administration-model";
import { AdministrationKpi } from "./administration-ui";

export function RenewalsKpis({ rows, services, truncated }: { rows: AdministrationRow[]; services: AdministrationRow[]; truncated: boolean }) {
  const today = startOfDay();
  const soon = addDays(today, 30);
  const active = rows.filter((row) => !["paid", "cancelled", "expired"].includes(row.status)).length;
  const expiring = rows.filter((row) => {
    const date = dateValue(row.due_date);
    return date && date >= today && date <= soon && !["paid", "cancelled"].includes(row.status);
  }).length;
  const recurringValue = rows.filter((row) => !["cancelled", "expired"].includes(row.status)).reduce((sum, row) => sum + numeric(row.amount), 0);
  const manualServiceIds = new Set(services.filter((service) => !service.auto_renew).map((service) => service.id));
  const toConfirm = rows.filter((row) => row.status === "upcoming" && (!row.recurring_service_id || manualServiceIds.has(row.recurring_service_id))).length;
  const hint = truncated ? "Conteggio sui primi 100 rinnovi reali" : "Rinnovi registrati";
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <AdministrationKpi icon={RefreshCw} label="Rinnovi attivi" value={active} hint={hint} />
      <AdministrationKpi icon={CalendarClock} label="In scadenza" value={expiring} hint="Entro 30 giorni" tone="red" />
      <AdministrationKpi icon={WalletCards} label="Valore ricorrente" value={financeMoney(recurringValue)} hint="Valore dei rinnovi attivi caricati" tone="green" />
      <AdministrationKpi icon={AlertTriangle} label="Da confermare" value={toConfirm} hint="Rinnovi manuali in arrivo" tone="orange" />
    </div>
  );
}
