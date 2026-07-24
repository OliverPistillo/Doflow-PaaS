import { AlertTriangle, Clock3, Send } from "lucide-react";
import type { CommercialQuote } from "@/lib/tenant-commercial-api";
import { Button } from "@/components/ui/button";
import { commercialDate } from "./commercial-utils";
import { CommercialEmptyState } from "./commercial-ui";

export function QuotesFollowUpPanel({
  items,
  onOpen,
}: {
  items: CommercialQuote[];
  onOpen: (item: CommercialQuote) => void;
}) {
  const dueItems = items
    .filter((item) => ["sent", "viewed", "expired"].includes(item.status))
    .sort((a, b) => new Date(a.valid_until || "2999-12-31").getTime() - new Date(b.valid_until || "2999-12-31").getTime())
    .slice(0, 5);

  return (
    <aside className="rounded-2xl border border-slate-200/80 bg-white p-5 xl:sticky xl:top-24 xl:self-start">
      <h2 className="text-[17px] font-semibold text-slate-950">Da seguire</h2>
      {dueItems.length === 0 ? (
        <div className="mt-5"><CommercialEmptyState>Nessun preventivo richiede un follow-up.</CommercialEmptyState></div>
      ) : (
        <div className="mt-4 divide-y divide-slate-100">
          {dueItems.map((item) => {
            const overdue = item.status === "expired" || Boolean(item.valid_until && new Date(item.valid_until).getTime() < Date.now());
            const Icon = overdue ? AlertTriangle : item.status === "sent" ? Send : Clock3;
            return (
              <div key={item.id} className="py-4 first:pt-0">
                <div className="flex items-start gap-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${overdue ? "text-rose-500" : "text-indigo-600"}`} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-slate-900">{item.company_name || item.title}</p>
                    <p className="mt-0.5 truncate text-xs text-slate-500">{item.title}</p>
                    <p className={`mt-2 text-xs font-medium ${overdue ? "text-rose-600" : "text-orange-600"}`}>
                      {overdue ? "Scaduto" : "Scadenza"}: {commercialDate(item.valid_until)}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" className="h-8 rounded-lg text-xs text-indigo-600" onClick={() => onOpen(item)}>
                    Apri
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <button type="button" className="mt-5 w-full rounded-xl border border-slate-200 px-4 py-2.5 text-left text-sm font-medium text-slate-800 hover:bg-slate-50">
        Vedi tutti
      </button>
    </aside>
  );
}
