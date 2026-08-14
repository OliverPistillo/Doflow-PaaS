"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Archive, Filter, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  canonicalCommercialStage,
  commercialConversion,
  COMMERCIAL_OUTCOME_STAGES,
  isOpenCommercialStage,
  normalizeCommercialStage,
  normalizeCommercialStageQuery,
} from "@/lib/commercial-stage-model";
import { getDoFlowUser } from "@/lib/jwt";
import { commercialApi, type CommercialOpportunity, type CommercialPipeline } from "@/lib/tenant-commercial-api";
import { isInternalDoflowTenant } from "@/lib/tenant-url";
import { CommercialPageHeader } from "./commercial-ui";
import { groupPipeline, isToday, pipelineItems } from "./commercial-utils";
import { PipelineColumn } from "./pipeline-column";
import { PipelineSummaryStrip } from "./pipeline-summary-strip";
import { OpportunityDetailSheet } from "./opportunity-detail-sheet";

function canSeeEconomicValues() {
  const role = String(getDoFlowUser()?.role || "").toLowerCase();
  return ["owner", "admin", "manager", "superadmin", "super_admin"].includes(role);
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function CommercialPipelinePage() {
  const searchParams = useSearchParams();
  const user = getDoFlowUser();
  const doflow = isInternalDoflowTenant(user?.tenantSlug || user?.tenantId);
  const stageParam = searchParams.get("stage");
  const highlightedOpportunityId = searchParams.get("opportunity");
  const [pipeline, setPipeline] = useState<CommercialPipeline | null>(null);
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState(() => normalizeCommercialStageQuery(stageParam, doflow));
  const [showFilters, setShowFilters] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedOpportunity, setSelectedOpportunity] = useState<CommercialOpportunity | null>(null);
  const [movingOpportunityId, setMovingOpportunityId] = useState<string | null>(null);
  const autoOpenedOpportunityRef = useRef<string | null>(null);
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

  useEffect(() => {
    setStageFilter(normalizeCommercialStageQuery(stageParam, doflow));
  }, [doflow, stageParam]);

  const groups = useMemo(() => groupPipeline(pipeline, doflow), [doflow, pipeline]);
  const allItems = useMemo(() => pipelineItems(pipeline, doflow), [doflow, pipeline]);
  const visibleGroups = groups.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      const needle = search.trim().toLowerCase();
      const matchesSearch = !needle || [item.title, item.company_name, item.service_type].filter(Boolean).join(" ").toLowerCase().includes(needle);
      return matchesSearch && (stageFilter === "all" || group.id === stageFilter);
    }),
  })).filter((group) => stageFilter === "all" || group.id === stageFilter);
  const archived = allItems.filter((item) => doflow
    ? (COMMERCIAL_OUTCOME_STAGES as readonly string[]).includes(canonicalCommercialStage(item.stage) || "")
    : ["lost", "paused"].includes(item.stage));
  const openItems = allItems.filter((item) => isOpenCommercialStage(item.stage, doflow));
  const unmappedItems = doflow ? allItems.filter((item) => !normalizeCommercialStage(item.stage).mapped) : [];
  const conversion = commercialConversion(allItems, doflow);
  const followUps = openItems.filter((item) => isToday(item.next_action_at)).length;
  const totalValue = openItems.reduce((sum, item) => sum + Number(item.value_estimate || 0), 0);

  useEffect(() => {
    if (!highlightedOpportunityId || !UUID_RE.test(highlightedOpportunityId)) return;
    if (autoOpenedOpportunityRef.current === highlightedOpportunityId) return;
    const opportunity = allItems.find((item) => item.id === highlightedOpportunityId);
    if (!opportunity) return;
    autoOpenedOpportunityRef.current = highlightedOpportunityId;
    setSelectedOpportunity(opportunity);
  }, [allItems, highlightedOpportunityId]);

  const move = async (id: string, stage: string) => {
    if (movingOpportunityId) return;
    setMovingOpportunityId(id);
    try {
      await commercialApi.moveOpportunity(id, stage);
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Spostamento opportunità non riuscito.");
    } finally {
      setMovingOpportunityId(null);
    }
  };

  return (
    <main className="min-w-0 max-w-full space-y-5 px-4 py-6 sm:px-6 lg:px-8">
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

      {unmappedItems.length > 0 ? (
        <section className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900" role="status" data-commercial-unmapped>
          <p className="font-semibold">Da verificare · {unmappedItems.length}</p>
          <p className="mt-1 text-xs text-amber-800">Queste trattative hanno una fase non riconosciuta e restano visibili fuori dal percorso positivo.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {unmappedItems.map((item) => (
              <button key={item.id} type="button" className="rounded-lg border border-amber-300 bg-white px-2.5 py-1 text-xs font-medium" data-visual-sensitive onClick={() => setSelectedOpportunity(item)}>
                {item.company_name || item.title}
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <PipelineSummaryStrip totalValue={totalValue} deals={openItems.length} followUps={followUps} conversion={conversion} showEconomic={showEconomic} />

      {loading ? (
        <div className="flex min-h-80 items-center justify-center text-sm text-slate-500">Caricamento pipeline...</div>
      ) : (
        <div className="overflow-x-auto pb-3" data-commercial-pipeline-scroll>
          <div className="flex min-w-max gap-4 xl:min-w-0" data-commercial-pipeline>
            {visibleGroups.map((group) => (
              <PipelineColumn
                key={group.id}
                stageId={group.id}
                label={group.label}
                color={group.color}
                items={group.items}
                totalValue={group.items.reduce((sum, item) => sum + Number(item.value_estimate || 0), 0)}
                showEconomic={showEconomic}
                onMove={move}
                onOpenDetails={setSelectedOpportunity}
                highlightedOpportunityId={highlightedOpportunityId}
                doflow={doflow}
                movingOpportunityId={movingOpportunityId}
              />
            ))}
          </div>
        </div>
      )}

      {archived.length > 0 ? (
        <div className="text-center">
          <button type="button" onClick={() => setShowArchived((value) => !value)} className="inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-700">
            <Archive className="h-4 w-4" /> {showArchived
              ? (doflow ? "Nascondi esiti" : "Nascondi archiviate")
              : (doflow ? "Mostra esiti" : "Mostra archiviate")}
          </button>
          {showArchived ? (
            <div className="mx-auto mt-4 max-w-3xl rounded-2xl border border-slate-200 bg-white p-4 text-left" data-commercial-outcomes>
              <div className="divide-y divide-slate-100">
                {archived.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 py-3" data-commercial-outcome data-visual-sensitive>
                    <div><p className="text-sm font-medium text-slate-900">{item.company_name || item.title}</p><p className="text-xs text-slate-500">{item.stage === "lost" ? (doflow ? "Perso" : "Persa") : "In pausa"}</p></div>
                    <Select value={item.stage} onValueChange={(stage) => move(item.id, stage)} disabled={Boolean(movingOpportunityId)}>
                      <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent><SelectItem value={doflow ? "new" : "new_lead"}>Ripristina</SelectItem><SelectItem value="lost">{doflow ? "Perso" : "Persa"}</SelectItem><SelectItem value="paused">In pausa</SelectItem></SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      <OpportunityDetailSheet
        opportunity={selectedOpportunity}
        open={Boolean(selectedOpportunity)}
        onOpenChange={(open) => { if (!open) setSelectedOpportunity(null); }}
        showEconomic={showEconomic}
      />
    </main>
  );
}
