import Link from "next/link";
import { CalendarDays } from "lucide-react";

import type { CalendarEvent } from "@/lib/tenant-calendar-api";
import { dashboardDate } from "./dashboard-format";

function deadlineTone(priority?: string | null) {
  if (priority === "urgent") return "bg-rose-500";
  if (priority === "high") return "bg-amber-500";
  return "bg-indigo-500";
}

export function DashboardDeadlines({ items }: { items: CalendarEvent[] }) {
  return (
    <section className="dashboard-card min-h-[320px] p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold text-slate-950">Prossime scadenze</h2>
        <Link href="/calendar/deadlines" className="text-xs font-semibold text-indigo-600 hover:text-indigo-700">
          Vedi tutte
        </Link>
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-[225px] items-center justify-center text-center text-sm text-slate-500">
          Nessuna scadenza imminente.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {items.slice(0, 4).map((item) => (
            <Link
              key={item.id}
              href={`/calendar/events/${item.id}`}
              className="group flex items-center gap-3 rounded-xl border border-slate-200 px-3 py-2.5 transition-colors hover:border-indigo-200 hover:bg-indigo-50/40"
            >
              <span className={`h-2 w-2 shrink-0 rounded-full ${deadlineTone(item.priority)}`} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-indigo-700">{item.title}</p>
                <p className="truncate text-xs text-slate-500">{item.event_type.replaceAll("_", " ")}</p>
              </div>
              <time className="shrink-0 text-xs font-medium text-indigo-600">{dashboardDate(item.start_at)}</time>
            </Link>
          ))}
        </div>
      )}

      <Link
        href="/calendar"
        className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <CalendarDays className="h-3.5 w-3.5" aria-hidden="true" />
        Vedi calendario
      </Link>
    </section>
  );
}
