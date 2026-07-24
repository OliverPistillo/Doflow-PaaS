"use client";

import { useEffect, useMemo, useState } from "react";
import { Archive, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getDoFlowUser } from "@/lib/jwt";
import { commercialApi, type CommercialPipeline } from "@/lib/tenant-commercial-api";
import { CommercialPageHeader } from "./commercial-ui";
import { groupPipeline, isToday } from "./commercial-utils";
import { PipelineColumn } from "./pipeline-column";
import { PipelineSummaryStrip } from "./pipeline-summary-strip";

function canSeeEconomicValues() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "manager", "superadmin", "super_admin"].includes(role);
}

export function CommercialPipelinePage() {
  const [pipeline, setPipeline] = useState<CommercialPipeline | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("all");
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const showEconomic = canSeeEconomicValues();

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      setPipeline(await commercialApi.pipeline());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Pipeline non disponibile.");
      setPipeline(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const groups = useMemo(() => groupPipeline(pipeline), [pipeline]);
  const allItems = (pipeline?.stages || []).flatMap((stage) => stage.items || []);
  const visibleGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const needle = search.trim().toLowerCase();
      const matchesSearch = !needle || [item.title, item.company_name, item.service_type].filter(Boolean).join(" ").toLowerCase().includes(needle);
      return matchesSearch && (stageFilter === "all" || group.id === stageFilter);
    }),
  })).filter((group) => stageFilter === "all" || group.id === stageFilter);
  const archived = allItems.filter((item) => ["lost", "paused"].includes(item.stage));
  const openItems = allItems.filter((item) => !["lost", "paused"].includes(item.stage));
  const won = allItems.filter((item) => item.stage === "accepted").length;
  const lost = allItems.filter((item) => item.stage === "lost").length;
  const conversion = won + lost > 0 ? Math.round((won / (won + lost)) * 100) : 0;
  const followUps = openItems.filter((item) => isToday(item.next_action_at)).length;
  const totalValue = openItems.reduce((sum, item) => sum + Number(item.value_estimate || 0), 0);

  const move = async (id: string, stage: string) => {
    try {
      await commercialApi.moveOpportunity(id, stage);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Spostamento opportunità non riuscito.");
    }
  };

  return (
    <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <CommercialPageHeader
          title="Pipeline"
          description="Segui ogni trattativa dal primo contatto alla chiusura."
          ctaLabel="Nuovo contatto"
          ctaHref="/contacts?new=1"
        />
        <div className="flex flex-wrap gap-2 xl:pt-0">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={search} onChange={(event) => setSearch(event.target.value)} className="h-11 rounded-xl border-slate-200 bg-white pl-10" placeholder="Cerca..." />
          </div>
          <Button variant="outline" className="h-11 rounded-xl border-slate-200 bg-white" onClick={() => setShowFilters((value) => !value)}>
            <Filter className="mr-2 h-4 w-4" /> Filtri
          </Button>
        </div>
      </div>

      {showFilters ? (
        <div className="flex justify-end">
          <Select value={stageFilter} onValueChange={setStageFilter}>
            <SelectTrigger className="h-10 w-full rounded-xl bg-white sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tutte le fasi</SelectItem>
              {groups.map((group) => <SelectItem key={group.id} value={group.id}>{group.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      ) : null}

      {error ? <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p> : null}

      <PipelineSummaryStrip totalValue={totalValue} deals={openItems.length} followUps={followUps} conversion={conversion} showEconomic={showEconomic} />

      {loading ? (
        <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">Caricamento pipeline...</div>
      ) : (
        <div className="overflow-x-auto pb-3">
          <div className="flex min-w-max gap-4 xl:min-w-0">
            {visibleGroups.map((group) => (
              <PipelineColumn
                key={group.id}
                label={group.label}
                color={group.color}
                items={group.items}
                totalValue={group.items.reduce((sum, item) => sum + Number(item.value_estimate || 0), 0)}
                showEconomic={showEconomic}
                onMove={move}
              />
            ))}
          </div>
        </div>
      )}

      {archived.length > 0 ? (
        <div className="text-center">
          <button type="button" onClick={() => setShowArchived((value) => !value)} className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <Archive className="h-4 w-4" /> {showArchived ? "Nascondi archiviate" : "Mostra archiviate"}
          </button>
          {showArchived ? (
            <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 text-left">
              <div className="divide-y divide-slate-100">
                {archived.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 py-3">
                    <div><p className="text-sm font-medium text-slate-900">{item.company_name || item.title}</p><p className="text-xs text-slate-500">{item.stage === "lost" ? "Persa" : "In pausa"}</p></div>
                    <Select value={item.stage} onValueChange={(stage) => move(item.id, stage)}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value="new_lead">Ripristina</SelectItem><SelectItem value="lost">Persa</SelectItem><SelectItem value="paused">In pausa</SelectItem></SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </main>
  );
}
