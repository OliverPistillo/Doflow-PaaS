import type { CommercialOpportunity } from "@/lib/tenant-commercial-api";
import { commercialMoney } from "./commercial-utils";
import { PipelineDealCard } from "./pipeline-deal-card";

export function PipelineColumn({
  label,
  color,
  items,
  totalValue,
  showEconomic,
  onMove,
}: {
  label: string;
  color: string;
  items: CommercialOpportunity[];
  totalValue: number;
  showEconomic: boolean;
  onMove: (id: string, stage: string) => void;
}) {
  return (
    <section className="flex min-h-[480px] min-w-[280px] flex-1 flex-col rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3">
      <header className="px-1 pb-3">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
          <h2 className="text-sm font-semibold text-slate-950">{label}</h2>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          {items.length} {items.length === 1 ? "trattativa" : "trattative"}
          {showEconomic ? ` · ${commercialMoney(totalValue)}` : ""}
        </p>
      </header>
      <div className="space-y-2.5">
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-xs text-slate-500">Nessuna trattativa</div>
        ) : items.map((item) => (
          <PipelineDealCard key={item.id} item={item} showEconomic={showEconomic} onMove={onMove} />
        ))}
      </div>
    </section>
  );
}
