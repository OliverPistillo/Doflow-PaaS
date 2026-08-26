"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Play, Workflow } from "lucide-react";
import { automationsApi, type AutomationActivity, type AutomationRule, type AutomationRun, type AutomationSummary } from "@/lib/tenant-automations-api";
import { AccessDenied } from "@/features/identity/access-denied";
import { loadRules, loadRuns, useAutomationCenterAccess } from "./automation-center-model";
import { AutomationError, AutomationKpi, AutomationLoading, AutomationPageHeader } from "./automation-center-ui";
import { AutomationAttentionPanel, AutomationMostUsed, AutomationRecentActivity, AutomationStatusChart } from "./automation-overview-sections";

export function AutomationOverview() {
  const { canViewRules, canManageRules, canViewRuns } = useAutomationCenterAccess();
  const [summary, setSummary] = useState<AutomationSummary | null>(null); const [rules, setRules] = useState<AutomationRule[]>([]); const [runs, setRuns] = useState<AutomationRun[]>([]); const [activities, setActivities] = useState<AutomationActivity[]>([]);
  const [days, setDays] = useState(7);
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null); const [truncated, setTruncated] = useState(false);
  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      if (!canViewRules) { setLoading(false); return; }
      Promise.all([
        canViewRuns ? automationsApi.summary() : Promise.resolve(null),
        loadRules(),
        canViewRuns ? loadRuns() : Promise.resolve({ items: [] as AutomationRun[], truncated: false }),
        canViewRuns ? automationsApi.activity({ limit: 20 }) : Promise.resolve({ items: [] as AutomationActivity[] }),
      ]).then(([summaryData, ruleData, runData, activityData]) => {
        if (!active) return; setSummary(summaryData); setRules(ruleData.items); setRuns(runData.items); setActivities(activityData.items || []); setTruncated(runData.truncated || ruleData.truncated);
      }).catch((reason) => active && setError(reason instanceof Error ? reason.message : "Caricamento delle automazioni non riuscito.")).finally(() => active && setLoading(false));
    });
    return () => { active = false; };
  }, [canViewRules, canViewRuns]);
  const todayTerminal = (summary?.successfulRunsToday || 0) + (summary?.failedRunsToday || 0);
  const todayRate = todayTerminal ? Math.round((summary?.successfulRunsToday || 0) / todayTerminal * 1000) / 10 : null;
  if (!canViewRules) return <AccessDenied resource="alle regole di automazione" />;
  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <AutomationPageHeader title="Automazioni" description="Controlla processi automatici, risultati ed eventuali problemi." ctaLabel="Nuova automazione" ctaHref="/automations/rules/new" canCreate={canManageRules} />
    <AutomationError message={error} />
    {loading ? <AutomationLoading /> : <>
      {canViewRuns ? <><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AutomationKpi icon={Workflow} label="Automazioni attive" value={summary?.enabledRules ?? 0} hint={`${summary?.totalRules || 0} regole complessive`} />
        <AutomationKpi icon={Play} label="Esecuzioni oggi" value={todayTerminal} hint="Run completate oggi" tone="blue" />
        <AutomationKpi icon={CheckCircle2} label="Tasso di successo" value={todayRate === null ? "—" : `${todayRate}%`} hint={todayRate === null ? "Nessuna run terminale oggi" : "Successi e successi parziali"} tone="green" />
        <AutomationKpi icon={AlertTriangle} label="Errori da risolvere" value={summary?.failedRunsToday ?? 0} hint="Run fallite oggi" tone="red" />
      </div>
      {truncated ? <p className="text-xs text-slate-500">Le classifiche usano le prime 1.000 esecuzioni reali più recenti; i KPI odierni provengono dagli aggregati completi del backend.</p> : null}
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,1fr)]"><AutomationStatusChart runs={runs} days={days} onDaysChange={setDays} /><AutomationAttentionPanel rules={rules} runs={runs} /></div>
      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(330px,1fr)]"><AutomationMostUsed rules={rules} runs={runs} /><AutomationRecentActivity activities={activities} rules={rules} runs={runs} /></div></> : <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Le regole sono disponibili in sola lettura. Monitoraggio, esecuzioni ed errori richiedono una capability dedicata.</p>}
    </>}
  </main>;
}
