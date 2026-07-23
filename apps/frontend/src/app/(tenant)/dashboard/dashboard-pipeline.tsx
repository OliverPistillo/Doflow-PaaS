import Link from "next/link";
import { Filter } from "lucide-react";

type DashboardPipelineProps = {
  leads: number;
  quotes: number;
  won: number;
};

export function DashboardPipeline({ leads, quotes, won }: DashboardPipelineProps) {
  const stages = [
    { label: "Lead", value: leads, className: "bg-indigo-600 text-white" },
    { label: "Preventivi", value: quotes, className: "bg-indigo-100 text-indigo-900" },
    { label: "Vinti", value: won, className: "bg-emerald-100 text-emerald-900" },
  ];

  return (
    <section className="dashboard-card p-5">
      <h2 className="text-base font-semibold text-slate-950">Pipeline</h2>
      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-3">
          {stages.map((stage) => (
            <div key={stage.label} className={`${stage.className} px-2 py-2 text-center text-xs font-semibold`}>
              {stage.label}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-3 bg-white">
          {stages.map((stage) => (
            <div key={stage.label} className="border-r border-slate-100 px-2 py-4 text-center last:border-r-0">
              <p className="text-2xl font-bold tabular-nums text-slate-950">{stage.value}</p>
            </div>
          ))}
        </div>
      </div>
      <Link
        href="/pipeline"
        className="mt-4 inline-flex h-8 items-center gap-2 rounded-lg border border-slate-200 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50"
      >
        <Filter className="h-3.5 w-3.5" aria-hidden="true" />
        Vai alla pipeline
      </Link>
    </section>
  );
}
