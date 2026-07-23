import Link from "next/link";
import { groupPipeline } from "./commercial-utils";
import { CommercialEmptyState, CommercialSectionCard } from "./commercial-ui";

type FunnelGroup = ReturnType<typeof groupPipeline>[number];

export function CommercialFunnel({ groups }: { groups: FunnelGroup[] }) {
  if (!groups.some((group) => group.count > 0)) {
    return (
      <CommercialSectionCard title="Pipeline commerciale">
        <CommercialEmptyState>La pipeline non contiene ancora opportunità.</CommercialEmptyState>
      </CommercialSectionCard>
    );
  }

  return (
    <CommercialSectionCard title="Pipeline commerciale">
      <div className="grid overflow-hidden rounded-xl md:grid-cols-4">
        {groups.map((group, index) => (
          <div
            key={group.id}
            className="relative border-b border-white bg-indigo-50 px-4 py-5 text-center last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0"
            style={{
              backgroundColor: index === 0
                ? "#f0edff"
                : index === 1
                  ? "#eaf3ff"
                  : index === 2
                    ? "#edf8ee"
                    : "#dcf4dc",
            }}
          >
            <p className="text-sm font-medium text-slate-700">{group.label}</p>
            <p className="mt-1 text-[26px] font-bold leading-none text-slate-950">{group.count}</p>
          </div>
        ))}
      </div>
      <div className="mt-3 hidden grid-cols-3 md:grid">
        {groups.slice(0, 3).map((group, index) => {
          const next = groups[index + 1];
          const conversion = group.count > 0 ? Math.round((next.count / group.count) * 100) : 0;
          return (
            <div key={group.id} className="text-center">
              <p className="text-sm font-semibold text-slate-900">{conversion}%</p>
              <p className="text-xs text-slate-500">conversione</p>
            </div>
          );
        })}
      </div>
      <Link
        href="/pipeline"
        className="mt-8 inline-flex h-10 items-center justify-center rounded-xl border border-indigo-300 px-5 text-sm font-semibold text-indigo-600 hover:bg-indigo-50"
      >
        Apri pipeline
      </Link>
    </CommercialSectionCard>
  );
}
