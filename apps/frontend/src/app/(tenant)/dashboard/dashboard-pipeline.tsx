import Link from "next/link";
import { ArrowRight, Filter } from "lucide-react";

import { dashboardCurrency } from "./dashboard-format";
import { getDoFlowUser } from "@/lib/jwt";
import { isInternalDoflowTenant } from "@/lib/tenant-url";

type DashboardPipelineProps = {
  showEconomic: boolean;
  pipelineStages?: {
    new?: { count: number; totalValue: number | null };
    contacted?: { count: number; totalValue: number | null };
    qualified?: { count: number; totalValue: number | null };
    appointment?: { count: number; totalValue: number | null };
    quote?: { count: number; totalValue: number | null };
    won?: { count: number; totalValue: number | null };
    closed_won?: { count: number; totalValue: number | null };
  } | null;
};

export function DashboardPipeline({ showEconomic, pipelineStages }: DashboardPipelineProps) {
  const user = getDoFlowUser();
  const doflow = isInternalDoflowTenant(user?.tenantSlug || user?.tenantId);
  const stages = doflow ? [
    { id: "new", label: "Nuovo", href: "/pipeline?stage=new", value: pipelineStages?.new?.count || 0, totalValue: pipelineStages?.new?.totalValue || 0, className: "border-indigo-200 bg-indigo-50 text-indigo-950" },
    { id: "contacted", label: "Contattato", href: "/pipeline?stage=contacted", value: pipelineStages?.contacted?.count || 0, totalValue: pipelineStages?.contacted?.totalValue || 0, className: "border-blue-200 bg-blue-50 text-blue-950" },
    { id: "qualified", label: "Qualificato", href: "/pipeline?stage=qualified", value: pipelineStages?.qualified?.count || 0, totalValue: pipelineStages?.qualified?.totalValue || 0, className: "border-violet-200 bg-violet-50 text-violet-950" },
    { id: "appointment", label: "Appuntamento", href: "/pipeline?stage=appointment", value: pipelineStages?.appointment?.count || 0, totalValue: pipelineStages?.appointment?.totalValue || 0, className: "border-amber-200 bg-amber-50 text-amber-950" },
    { id: "quote", label: "Preventivo", href: "/pipeline?stage=quote", value: pipelineStages?.quote?.count || 0, totalValue: pipelineStages?.quote?.totalValue || 0, className: "border-emerald-200 bg-emerald-50 text-emerald-950" },
    { id: "closed_won", label: "Chiuso", href: "/pipeline?stage=closed_won", value: pipelineStages?.closed_won?.count || pipelineStages?.won?.count || 0, totalValue: pipelineStages?.closed_won?.totalValue || pipelineStages?.won?.totalValue || 0, className: "border-teal-200 bg-teal-50 text-teal-950" },
  ] : [
    { id: "new", label: "Nuovi", href: "/pipeline?stage=new", value: pipelineStages?.new?.count || 0, totalValue: pipelineStages?.new?.totalValue || 0, className: "border-indigo-200 bg-indigo-50 text-indigo-950" },
    { id: "contacted", label: "Contattati", href: "/pipeline?stage=contacted", value: pipelineStages?.contacted?.count || 0, totalValue: pipelineStages?.contacted?.totalValue || 0, className: "border-blue-200 bg-blue-50 text-blue-950" },
    { id: "quote", label: "Preventivo", href: "/pipeline?stage=quote", value: pipelineStages?.quote?.count || 0, totalValue: pipelineStages?.quote?.totalValue || 0, className: "border-emerald-200 bg-emerald-50 text-emerald-950" },
    { id: "won", label: "Vinti", href: "/pipeline?stage=won", value: pipelineStages?.won?.count || 0, totalValue: pipelineStages?.won?.totalValue || 0, className: "border-teal-200 bg-teal-50 text-teal-950" },
  ];

  return (
    <section className="dashboard-card p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-slate-950">Pipeline</h2>
          <p className="mt-1 text-xs text-slate-500">Opportunità reali per fase commerciale.</p>
        </div>
        <Link
          href="/pipeline"
          className="inline-flex h-8 shrink-0 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500"
        >
          <Filter className="h-3.5 w-3.5" aria-hidden="true" />
          Vai alla pipeline
        </Link>
      </div>
      <div className={`mt-4 grid gap-3 sm:grid-cols-2 ${doflow ? "xl:grid-cols-3" : "xl:grid-cols-4"}`}>
        {stages.map((stage) => (
          <Link
            key={stage.id}
            href={stage.href}
            aria-label={`Apri pipeline fase ${stage.label}`}
            className={`${stage.className} min-h-[118px] rounded-xl border p-4 transition hover:-translate-y-0.5 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-500`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold">{stage.label}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </div>
            <p className="mt-4 text-3xl font-bold tabular-nums">{stage.value}</p>
            <p className="mt-1 text-xs font-medium opacity-75">
              {showEconomic ? dashboardCurrency(stage.totalValue) : "Trattative"}
            </p>
          </Link>
        ))}
      </div>
    </section>
  );
}
