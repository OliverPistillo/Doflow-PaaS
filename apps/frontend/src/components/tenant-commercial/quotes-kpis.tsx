import { CheckCircle2, Clock3, Euro, Percent } from "lucide-react";
import type { CommercialQuote } from "@/lib/tenant-commercial-api";
import { commercialMoney, isThisMonth, quoteTotal } from "./commercial-utils";
import { CommercialKpiCard } from "./commercial-ui";

export function QuotesKpis({
  items,
  showMoney,
}: {
  items: CommercialQuote[];
  showMoney: boolean;
}) {
  const open = items.filter((item) => !["accepted", "rejected", "expired"].includes(item.status));
  const waiting = items.filter((item) => ["sent", "viewed"].includes(item.status));
  const acceptedThisMonth = items.filter((item) => item.status === "accepted" && isThisMonth(item.accepted_at || item.updated_at));
  const closed = items.filter((item) => ["accepted", "rejected"].includes(item.status));
  const acceptanceRate = closed.length > 0 ? Math.round((closed.filter((item) => item.status === "accepted").length / closed.length) * 100) : 0;
  const openValue = open.reduce((sum, item) => sum + quoteTotal(item), 0);

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {showMoney ? <CommercialKpiCard label="Valore aperto" value={commercialMoney(openValue)} icon={Euro} tone="violet" /> : null}
      <CommercialKpiCard label="In attesa" value={waiting.length} icon={Clock3} tone="orange" />
      <CommercialKpiCard label="Accettati questo mese" value={acceptedThisMonth.length} icon={CheckCircle2} tone="green" />
      <CommercialKpiCard label="Tasso accettazione" value={`${acceptanceRate}%`} icon={Percent} tone="violet" />
    </div>
  );
}
