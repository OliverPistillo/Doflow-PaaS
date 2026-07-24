"use client";

import { AlertTriangle, CalendarClock, ChevronRight } from "lucide-react";
import {
  administrationDate,
  daysUntil,
  financeMoney,
  numeric,
  relationName,
  type AdministrationRow,
} from "./administration-model";
import { AdministrationEmpty } from "./administration-ui";

export function RenewalsFollowUpPanel({
  rows,
  services,
  companies,
}: {
  rows: AdministrationRow[];
  services: AdministrationRow[];
  companies: AdministrationRow[];
}) {
  const actionable = rows
    .filter((row) => !["paid", "cancelled"].includes(row.status))
    .sort((a, b) => String(a.due_date || "").localeCompare(String(b.due_date || "")))
    .slice(0, 5);
  const monthly = rows.reduce<Record<string, number>>((result, row) => {
    if (!row.due_date) return result;
    const date = new Date(row.due_date);
    if (Number.isNaN(date.getTime())) return result;
    const label = new Intl.DateTimeFormat("it-IT", { month: "short" }).format(date);
    result[label] = (result[label] || 0) + numeric(row.amount);
    return result;
  }, {});
  const monthEntries = Object.entries(monthly).slice(0, 4);
  const max = Math.max(1, ...monthEntries.map(([, value]) => value));

  return (
    <aside className="space-y-5">
      <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
        <h2 className="text-[17px] font-semibold text-slate-950">Da gestire</h2>
        {actionable.length === 0 ? <AdministrationEmpty className="mt-4">Nessun rinnovo richiede attenzione.</AdministrationEmpty> : (
          <div className="mt-3 divide-y divide-slate-100">
            {actionable.map((row) => {
              const service = services.find((item) => item.id === row.recurring_service_id);
              const days = daysUntil(row.due_date);
              const overdue = days != null && days < 0;
              return (
                <div key={row.id} className="flex items-center gap-3 py-3">
                  <span className={overdue ? "flex h-9 w-9 items-center justify-center rounded-full bg-rose-50 text-rose-600" : "flex h-9 w-9 items-center justify-center rounded-full bg-orange-50 text-orange-600"}>
                    {overdue ? <AlertTriangle className="h-4 w-4" /> : <CalendarClock className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{service?.name || row.title}</p>
                    <p className="truncate text-xs text-slate-500">{relationName(row.company_id || service?.company_id, companies) || administrationDate(row.due_date)}</p>
                    <p className={overdue ? "mt-1 text-xs font-medium text-rose-600" : "mt-1 text-xs font-medium text-orange-600"}>{days == null ? "Data non disponibile" : days < 0 ? `Scaduto da ${Math.abs(days)} giorni` : days === 0 ? "Scade oggi" : `Tra ${days} giorni`}</p>
                  </div>
                  {row.amount != null ? <span className="text-sm font-semibold text-slate-900">{financeMoney(row.amount, row.currency)}</span> : null}
                  <ChevronRight className="h-4 w-4 text-slate-400" />
                </div>
              );
            })}
          </div>
        )}
      </section>
      {monthEntries.length ? (
        <section className="rounded-2xl border border-slate-200/80 bg-white p-5">
          <h2 className="text-[17px] font-semibold text-slate-950">Distribuzione rinnovi</h2>
          <div className="mt-5 flex h-36 items-end gap-4 border-b border-slate-200 px-2">
            {monthEntries.map(([label, value]) => <div key={label} className="flex h-full flex-1 flex-col justify-end text-center"><div title={financeMoney(value)} className="mx-auto w-full max-w-10 rounded-t-md bg-indigo-600" style={{ height: `${Math.max(8, value / max * 100)}%` }} /><p className="py-2 text-xs capitalize text-slate-500">{label}</p></div>)}
          </div>
        </section>
      ) : null}
    </aside>
  );
}
