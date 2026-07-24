"use client";

import Link from "next/link";
import { CalendarClock, ChevronRight } from "lucide-react";
import {
  administrationDate,
  dateValue,
  financeMoney,
  startOfDay,
  type AdministrationRow,
} from "./administration-model";
import { AdministrationBadge, AdministrationEmpty, AdministrationPanel } from "./administration-ui";

function groupLabel(value?: string | null) {
  const date = dateValue(value);
  if (!date) return "Più avanti";
  const delta = Math.round((startOfDay(date).getTime() - startOfDay().getTime()) / 86_400_000);
  if (delta <= 0) return "Oggi";
  if (delta <= 7) return "Questa settimana";
  return "Più avanti";
}

export function UpcomingFinancialDeadlines({ rows }: { rows: AdministrationRow[] }) {
  const grouped = rows.slice(0, 6).reduce<Record<string, AdministrationRow[]>>((result, row) => {
    const key = groupLabel(row.due_date);
    result[key] ||= [];
    result[key].push(row);
    return result;
  }, {});

  return (
    <AdministrationPanel title="Scadenze imminenti" actionHref="/finance/deadlines" actionLabel="Vedi tutte" className="min-h-[330px]">
      {rows.length === 0 ? <AdministrationEmpty>Nessuna scadenza finanziaria da gestire.</AdministrationEmpty> : (
        <div className="space-y-4">
          {["Oggi", "Questa settimana", "Più avanti"].map((group) => grouped[group]?.length ? (
            <div key={group}>
              <p className="mb-2 text-xs font-semibold text-indigo-600">{group}</p>
              <div className="space-y-2">
                {grouped[group].map((row) => (
                  <div key={row.id} className="flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
                      <CalendarClock className="h-4 w-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-slate-900">{row.title}</p>
                      <p className="mt-0.5 text-xs text-slate-500">{administrationDate(row.due_date, false)}</p>
                    </div>
                    {row.amount != null ? <span className="text-sm font-semibold text-slate-900">{financeMoney(row.amount, row.currency)}</span> : null}
                    <AdministrationBadge value={row.status} label={row.status === "open" ? "Aperta" : undefined} />
                    <Link href="/finance/deadlines" aria-label={`Apri ${row.title}`} className="text-slate-400 hover:text-indigo-600"><ChevronRight className="h-4 w-4" /></Link>
                  </div>
                ))}
              </div>
            </div>
          ) : null)}
        </div>
      )}
    </AdministrationPanel>
  );
}
