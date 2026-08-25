"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, Download, Euro, Workflow } from "lucide-react";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { reportsApi, type ExecutiveReport, type KpiTarget } from "@/lib/tenant-reports-api";
import { type AutomationRule, type AutomationRun } from "@/lib/tenant-automations-api";
import { inPeriod, loadRules, loadRuns, numeric, successRate } from "./automation-center-model";
import { AutomationError, AutomationKpi, AutomationLoading, AutomationPageHeader } from "./automation-center-ui";
import { AutomationAreaPerformance, AutomationGoals, AutomationImpactChart, AutomationValuePanel } from "./automation-report-panels";

function dateFrom(days: number) { const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - Math.max(0, days - 1)); return date.toISOString().slice(0, 10); }

export function AutomationReportsWorkspace() {
  const { canView } = useTenantAccess();
  const [days, setDays] = useState(30); const [runs, setRuns] = useState<AutomationRun[]>([]); const [rules, setRules] = useState<AutomationRule[]>([]); const [targets, setTargets] = useState<KpiTarget[]>([]); const [truncated, setTruncated] = useState(false);
  const [loading, setLoading] = useState(true); const [exporting, setExporting] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!canView("reports")) { setLoading(false); return; } setLoading(true); setError(null);
    try {
      const automationAllowed = canView("automations");
      const [runData, ruleData, executive] = await Promise.all([
        automationAllowed ? loadRuns() : Promise.resolve({ items: [] as AutomationRun[], total: 0, truncated: false }),
        automationAllowed ? loadRules() : Promise.resolve({ items: [] as AutomationRule[], total: 0, truncated: false }),
        reportsApi.executive({ dateFrom: dateFrom(days), dateTo: new Date().toISOString().slice(0, 10), groupBy: days > 30 ? "month" : "day" }).catch(() => ({ targets: [] } as ExecutiveReport)),
      ]);
      setRuns(runData.items); setRules(ruleData.items); setTargets(executive.targets || []); setTruncated(runData.truncated || ruleData.truncated);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Caricamento del report non riuscito."); } finally { setLoading(false); }
  }, [canView, days]);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void load();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const periodRuns = useMemo(() => runs.filter((run) => inPeriod(run.started_at, days)), [runs, days]); const actions = periodRuns.reduce((sum, run) => sum + numeric(run.actions_count), 0); const rate = successRate(periodRuns);
  const exportReport = async () => {
    setExporting(true); setError(null);
    try { const result = await reportsApi.exportReport("operations", { dateFrom: dateFrom(days), dateTo: new Date().toISOString().slice(0, 10), format: "csv" }); const blob = new Blob([result.csv || ""], { type: "text/csv;charset=utf-8" }); const url = URL.createObjectURL(blob); const anchor = document.createElement("a"); anchor.href = url; anchor.download = "report-operativita.csv"; document.body.appendChild(anchor); anchor.click(); anchor.remove(); URL.revokeObjectURL(url); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Esportazione non riuscita."); } finally { setExporting(false); }
  };

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <AutomationPageHeader title="Report e KPI" description="Misura risultati, affidabilità e impatto delle automazioni." canCreate={false}><Select value={String(days)} onValueChange={(value) => setDays(Number(value))}><SelectTrigger className="h-11 w-[170px] bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">Ultimi 7 giorni</SelectItem><SelectItem value="30">Questo mese</SelectItem><SelectItem value="90">Ultimi 90 giorni</SelectItem></SelectContent></Select><button disabled={exporting} onClick={() => void exportReport()} className="inline-flex h-11 items-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"><Download className="h-4 w-4" />Esporta report</button></AutomationPageHeader>
    <AutomationError message={error} />
    {loading ? <AutomationLoading /> : <>
      {!canView("automations") ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">I target Reports sono disponibili, ma le metriche di esecuzione richiedono accesso al modulo Automations.</p> : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AutomationKpi icon={Clock3} label="Ore risparmiate" value="Non configurato" hint="Nessun parametro minuti/run disponibile" /><AutomationKpi icon={Workflow} label="Attività automatizzate" value={actions} hint={`${periodRuns.length} run nel periodo`} tone="blue" /><AutomationKpi icon={CheckCircle2} label="Tasso di successo" value={rate === null ? "—" : `${rate}%`} hint="Run terminali reali" tone="green" /><AutomationKpi icon={Euro} label="Costo evitato" value="Non configurato" hint="Nessun costo orario o valore/run disponibile" tone="orange" /></div>
      {truncated ? <p className="text-xs text-slate-500">Le metriche storiche usano le prime 1.000 esecuzioni reali più recenti.</p> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)]"><AutomationImpactChart runs={periodRuns} days={days} /><AutomationGoals targets={targets} /></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(340px,1fr)]"><AutomationAreaPerformance rules={rules} runs={periodRuns} /><AutomationValuePanel runs={periodRuns} /></div>
    </>}
  </main>;
}
