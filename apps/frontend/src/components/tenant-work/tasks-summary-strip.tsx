"use client";

import { CalendarDays, CheckSquare2, ListChecks, UserRound } from "lucide-react";

export function TasksSummaryStrip({
  loading,
  open,
  mine,
  today,
  overdue,
}: {
  loading: boolean;
  open: number;
  mine: number;
  today: number;
  overdue: number;
}) {
  const items = [
    { icon: ListChecks, value: open, label: "Aperte", tone: "text-indigo-600 bg-indigo-50" },
    { icon: UserRound, value: mine, label: "Assegnate a me", tone: "text-blue-600 bg-blue-50" },
    { icon: CalendarDays, value: today, label: "Da completare oggi", tone: "text-orange-600 bg-orange-50" },
    { icon: CheckSquare2, value: overdue, label: "In ritardo", tone: "text-rose-600 bg-rose-50" },
  ];
  return (
    <section className="grid overflow-hidden rounded-2xl border border-slate-200/80 bg-white sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item, index) => (
        <div key={item.label} className={index ? "flex items-center gap-4 border-t border-slate-200 p-5 sm:border-l sm:border-t-0" : "flex items-center gap-4 p-5"}>
          <span className={`flex h-11 w-11 items-center justify-center rounded-full ${item.tone}`}><item.icon className="h-5 w-5" /></span>
          <div><p className="text-2xl font-bold text-slate-950">{loading ? "…" : item.value}</p><p className="text-sm text-slate-500">{item.label}</p></div>
        </div>
      ))}
    </section>
  );
}
