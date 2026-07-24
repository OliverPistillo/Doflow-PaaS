import type { ComponentType } from "react";
import { ArrowUpRight, Minus } from "lucide-react";

import { cn } from "@/lib/utils";

type DashboardKpiCardProps = {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  hint?: string;
  tone?: "violet" | "green" | "blue";
};

const iconTone = {
  violet: "bg-violet-50 text-violet-600",
  green: "bg-emerald-50 text-emerald-600",
  blue: "bg-blue-50 text-blue-600",
};

export function DashboardKpiCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "violet",
}: DashboardKpiCardProps) {
  const hasHint = Boolean(hint);

  return (
    <section className="dashboard-card min-h-[132px] p-5">
      <div className="flex items-center gap-3">
        <span className={cn("flex h-9 w-9 items-center justify-center rounded-full", iconTone[tone])}>
          <Icon className="h-[18px] w-[18px]" aria-hidden="true" />
        </span>
        <p className="text-sm font-semibold text-slate-900">{label}</p>
      </div>
      <p className="mt-4 text-[30px] font-bold leading-none tabular-nums text-slate-950">{value}</p>
      <p className={cn("mt-3 flex items-center gap-1 text-xs", hasHint ? "text-emerald-600" : "text-slate-400")}>
        {hasHint ? <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /> : <Minus className="h-3.5 w-3.5" aria-hidden="true" />}
        <span>{hint || "Dato aggiornato"}</span>
      </p>
    </section>
  );
}
