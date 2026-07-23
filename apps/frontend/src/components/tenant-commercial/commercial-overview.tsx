"use client";

import { useEffect, useMemo, useState } from "react";
import { FileText, Filter, Target, Users } from "lucide-react";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import {
  commercialApi,
  type CommercialActivity,
  type CommercialContact,
  type CommercialOpportunity,
  type CommercialPipeline,
  type CommercialQuote,
} from "@/lib/tenant-commercial-api";
import {
  commercialMoney,
  groupPipeline,
  isThisMonth,
  isToday,
  pipelineTotal,
  quoteTotal,
} from "./commercial-utils";
import { CommercialFunnel } from "./commercial-funnel";
import { CommercialForecast } from "./commercial-forecast";
import { CommercialRecentActivity } from "./commercial-recent-activity";
import { CommercialTodayActions } from "./commercial-today-actions";
import { CommercialKpiCard, CommercialPageHeader } from "./commercial-ui";

export function CommercialOverview() {
  const { canView } = useTenantAccess();
  const [contacts, setContacts] = useState<CommercialContact[]>([]);
  const [opportunities, setOpportunities] = useState<CommercialOpportunity[]>([]);
  const [activities, setActivities] = useState<CommercialActivity[]>([]);
  const [pipeline, setPipeline] = useState<CommercialPipeline | null>(null);
  const [quotes, setQuotes] = useState<CommercialQuote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      const [contactsResult, opportunitiesResult, activitiesResult, pipelineResult, quotesResult] = await Promise.allSettled([
        commercialApi.contacts({ limit: 100 }),
        commercialApi.opportunities({ limit: 100 }),
        commercialApi.activities({ limit: 100 }),
        commercialApi.pipeline(),
        canView("quotes")
          ? commercialApi.quotes({ limit: 100 })
          : Promise.resolve({ items: [], total: 0, limit: 100, offset: 0 }),
      ] as const);
      if (!active) return;
      const failed = [contactsResult, opportunitiesResult, activitiesResult, pipelineResult, quotesResult]
        .some((result) => result.status === "rejected");
      if (contactsResult.status === "fulfilled") setContacts(contactsResult.value.items || []);
      if (opportunitiesResult.status === "fulfilled") setOpportunities(opportunitiesResult.value.items || []);
      if (activitiesResult.status === "fulfilled") setActivities(activitiesResult.value.items || []);
      if (pipelineResult.status === "fulfilled") setPipeline(pipelineResult.value);
      if (quotesResult.status === "fulfilled") setQuotes(quotesResult.value.items || []);
      if (failed) setError("Alcuni dati commerciali non sono disponibili in questo momento.");
      setLoading(false);
    };
    void load();
    return () => {
      active = false;
    };
  }, [canView]);

  const groups = useMemo(() => groupPipeline(pipeline), [pipeline]);
  const openQuotes = quotes.filter((quote) => !["accepted", "rejected", "expired"].includes(quote.status));
  const closedQuotes = quotes.filter((quote) => ["accepted", "rejected"].includes(quote.status));
  const closeRate = closedQuotes.length > 0
    ? Math.round((closedQuotes.filter((quote) => quote.status === "accepted").length / closedQuotes.length) * 100)
    : 0;
  const forecast = pipelineTotal(opportunities);
  const acquired = quotes
    .filter((quote) => quote.status === "accepted" && isThisMonth(quote.accepted_at || quote.updated_at))
    .reduce((sum, quote) => sum + quoteTotal(quote), 0);
  const todayActions = activities
    .filter((activity) => !activity.completed_at && isToday(activity.due_at))
    .sort((a, b) => new Date(a.due_at || 0).getTime() - new Date(b.due_at || 0).getTime());

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <CommercialPageHeader
        title="Commerciale"
        description="Tieni sotto controllo vendite, clienti e preventivi in un’unica vista."
        ctaLabel="Nuovo contatto"
        ctaHref="/contacts?new=1"
      />

      {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{error}</p> : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <CommercialKpiCard
          label="Pipeline"
          value={loading ? "…" : commercialMoney(forecast)}
          hint="Valore delle opportunità aperte"
          icon={Filter}
          tone="violet"
        />
        <CommercialKpiCard
          label="Contatti attivi"
          value={loading ? "…" : contacts.length}
          hint="Contatti tenant disponibili"
          icon={Users}
          tone="blue"
        />
        <CommercialKpiCard
          label="Preventivi aperti"
          value={loading ? "…" : openQuotes.length}
          hint="Bozze, inviati o visualizzati"
          icon={FileText}
          tone="green"
        />
        <CommercialKpiCard
          label="Tasso di chiusura"
          value={loading ? "…" : `${closeRate}%`}
          hint="Preventivi accettati sui chiusi"
          icon={Target}
          tone="orange"
        />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <CommercialFunnel groups={groups} />
        <CommercialForecast forecast={forecast} acquired={acquired} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <CommercialTodayActions items={todayActions} />
        <CommercialRecentActivity activities={activities.slice(0, 8)} quotes={quotes.slice(0, 8)} />
      </div>
    </main>
  );
}
