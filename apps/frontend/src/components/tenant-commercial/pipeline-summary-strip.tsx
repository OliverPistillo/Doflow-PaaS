import { Clock3, Euro, TrendingUp, Users } from "lucide-react";
import { commercialMoney } from "./commercial-utils";

export function PipelineSummaryStrip({
  totalValue,
  deals,
  followUps,
  conversion,
  showEconomic,
}: {
  totalValue: number;
  deals: number;
  followUps: number;
  conversion: number;
  showEconomic: boolean;
}) {
  const items = [
    ...(showEconomic ? [{ label: "Valore totale", value: commercialMoney(totalValue), icon: Euro, tone: "bg-violet-100 text-violet-600" }] : []),
    { label: "Trattative", value: String(deals), icon: Users, tone: "bg-blue-100 text-blue-600" },
    { label: "Da ricontattare oggi", value: String(followUps), icon: Clock3, tone: "bg-orange-100 text-orange-600" },
    { label: "Conversione", value: `${conversion}%`, icon: TrendingUp, tone: "bg-emerald-100 text-emerald-600" },
  ];

  return (
    <section className="grid overflow-hidden rounded-2xl border border-slate-200/80 bg-white sm:grid-cols-2 xl:grid-cols-4">
      {items.map((item) => {
        const Icon = item.icon;
        return (
          <div key={item.label} className="flex items-center gap-4 border-b border-slate-100 px-5 py-4 last:border-b-0 sm:border-r sm:[&:nth-child(2)]:border-r-0 xl:border-b-0 xl:[&:nth-child(2)]:border-r xl:last:border-r-0">
            <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${item.tone}`}>
              <Icon className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs text-slate-500">{item.label}</p>
              <p className="mt-0.5 text-xl font-bold text-slate-950">{item.value}</p>
            </div>
          </div>
        );
      })}
    </section>
  );
}
