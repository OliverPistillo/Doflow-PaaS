"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Play, RefreshCw, Search, Workflow } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { automationsApi, type AutomationRule, type AutomationRun, type AutomationSummary } from "@/lib/tenant-automations-api";
import { listTenantNotifications, type TenantNotification } from "@/lib/tenant-notifications-api";
import { AccessDenied } from "@/features/identity/access-denied";
import { formatDateTime, formatDuration, formatTime, inPeriod, isToday, loadRules, loadRuns, runStatus, triggerLabel, useAutomationCenterAccess } from "./automation-center-model";
import { AutomationBadge, AutomationEmpty, AutomationError, AutomationKpi, AutomationLoading, AutomationPageHeader } from "./automation-center-ui";
import { AutomationNotificationsPanel, AutomationProblemsPanel } from "./automation-monitoring-panels";

const PAGE_SIZE = 10;

export function AutomationMonitoringWorkspace() {
  const router = useRouter();
  const { canViewRuns, canRetryRuns, canViewNotifications } = useAutomationCenterAccess();
  const [summary, setSummary] = useState<AutomationSummary | null>(null); const [runs, setRuns] = useState<AutomationRun[]>([]); const [rules, setRules] = useState<AutomationRule[]>([]); const [notifications, setNotifications] = useState<TenantNotification[]>([]);
  const [tab, setTab] = useState<"all" | "success" | "failed">("all"); const [search, setSearch] = useState(""); const [days, setDays] = useState(1); const [importantOnly, setImportantOnly] = useState(false); const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [truncated, setTruncated] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = async (manual = false) => {
    if (!canViewRuns) { setLoading(false); return; } if (manual) setRefreshing(true); else setLoading(true); setError(null);
    try {
      const [summaryData, runData, ruleData, notificationData] = await Promise.all([
        automationsApi.summary(), loadRuns(), loadRules(), canViewNotifications ? listTenantNotifications({ limit: 20 }) : Promise.resolve({ items: [] as TenantNotification[] }),
      ]);
      setSummary(summaryData); setRuns(runData.items); setRules(ruleData.items); setNotifications(notificationData.items || []); setTruncated(runData.truncated);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Aggiornamento del monitoraggio non riuscito."); } finally { setLoading(false); setRefreshing(false); }
  };
  const loadEffect = useEffectEvent(load);
  useEffect(() => {
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void loadEffect();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [canViewRuns, canViewNotifications]);

  const periodRuns = useMemo(() => runs.filter((run) => inPeriod(run.started_at, days)), [runs, days]);
  const successCount = periodRuns.filter((run) => ["success", "partial_success"].includes(run.status)).length; const errorCount = periodRuns.filter((run) => run.status === "failed").length;
  const visible = useMemo(() => periodRuns.filter((run) => {
    const statusMatch = tab === "all" || (tab === "success" ? ["success", "partial_success"].includes(run.status) : run.status === "failed");
    return statusMatch && (!search || `${run.rule_name || ""} ${run.trigger_type} ${run.error_message || ""}`.toLowerCase().includes(search.toLowerCase()));
  }), [periodRuns, tab, search]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE)); const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const todayRows = runs.filter((run) => isToday(run.started_at)); const durations = todayRows.map((run) => Number(run.duration_ms)).filter((value) => Number.isFinite(value) && value > 0); const averageDuration = !truncated && durations.length ? durations.reduce((sum, value) => sum + value, 0) / durations.length : null;
  const retry = async (run: AutomationRun) => { if (!run.rule_id || !canRetryRuns) return; setRefreshing(true); setError(null); try { const result = await automationsApi.retryRun(run.id); const runId = (result as AutomationRun)?.id; if (runId) router.push(`/automations/runs/${runId}`); else await load(true); } catch (reason) { setError(reason instanceof Error ? reason.message : "Nuova esecuzione non riuscita."); } finally { setRefreshing(false); } };
  const todayTotal = (summary?.successfulRunsToday || 0) + (summary?.failedRunsToday || 0);

  if (!canViewRuns) return <AccessDenied resource="al monitoraggio automazioni" />;

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <AutomationPageHeader title="Monitoraggio" description="Controlla esecuzioni, errori e notifiche in tempo reale." canCreate={false}><button disabled={refreshing} onClick={() => void load(true)} className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />Aggiorna</button></AutomationPageHeader>
    <AutomationError message={error} />
    {loading ? <AutomationLoading /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><AutomationKpi icon={Play} label="Esecuzioni oggi" value={todayTotal} hint="Run terminali odierne" /><AutomationKpi icon={CheckCircle2} label="Riuscite" value={summary?.successfulRunsToday || 0} hint="Successo e successo parziale" tone="green" /><AutomationKpi icon={AlertTriangle} label="Errori" value={summary?.failedRunsToday || 0} hint="Run fallite oggi" tone="red" /><AutomationKpi icon={Clock3} label="Durata media" value={averageDuration === null ? "—" : formatDuration(averageDuration)} hint={truncated ? "Non calcolata: storico troncato" : "Sulle run odierne con durata"} tone="blue" /></div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white"><div className="flex flex-col gap-3 border-b border-slate-200 p-4 lg:flex-row lg:items-center"><div className="flex gap-1">{([{ key: "all", label: "Tutte", count: periodRuns.length }, { key: "success", label: "Riuscite", count: successCount }, { key: "failed", label: "Errori", count: errorCount }] as const).map((item) => <button key={item.key} onClick={() => { setTab(item.key); setPage(1); }} className={`rounded-lg px-3 py-2 text-sm font-medium ${tab === item.key ? "bg-indigo-50 text-indigo-700" : "text-slate-500 hover:bg-slate-50"}`}>{item.label} <span className="ml-1 text-xs">{item.count}</span></button>)}</div><div className="relative ml-auto min-w-0 flex-1 lg:max-w-sm"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cerca automazione o esecuzione..." className="pl-9" /></div><Select value={String(days)} onValueChange={(value) => { setDays(Number(value)); setPage(1); }}><SelectTrigger className="w-[150px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="1">Oggi</SelectItem><SelectItem value="7">7 giorni</SelectItem><SelectItem value="30">30 giorni</SelectItem></SelectContent></Select></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[860px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Ora</th><th className="px-4 py-4">Automazione</th><th className="px-4 py-4">Evento</th><th className="px-4 py-4">Durata</th><th className="px-4 py-4">Stato</th><th className="px-4 py-4">Dettagli</th></tr></thead><tbody className="divide-y divide-slate-100">{pageRows.map((run) => { const state = runStatus(run); return <tr key={run.id} className="hover:bg-slate-50/70"><td className="px-5 py-4 font-medium text-slate-700">{days === 1 ? formatTime(run.started_at) : formatDateTime(run.started_at)}</td><td className="px-4 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Workflow className="h-4 w-4" /></span><div><p className="font-semibold text-slate-900">{run.rule_name || "Automazione"}</p><p className="text-xs text-slate-500">{run.trigger_source || "Trigger"}</p></div></div></td><td className="px-4 py-4 text-slate-700">{triggerLabel(run.trigger_type)}</td><td className="px-4 py-4 text-slate-700">{formatDuration(run.duration_ms)}</td><td className="px-4 py-4"><AutomationBadge label={state.label} tone={state.tone} /></td><td className="px-4 py-4"><div className="flex items-center gap-3"><Link href={`/automations/runs/${run.id}`} className="font-medium text-indigo-600">Apri</Link>{run.status === "failed" && run.rule_id && canRetryRuns ? <button disabled={refreshing} onClick={() => void retry(run)} className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-700">Riprova</button> : null}</div></td></tr>; })}</tbody></table>{!pageRows.length ? <AutomationEmpty className="m-5">Nessuna esecuzione corrisponde ai filtri.</AutomationEmpty> : null}</div>
          <div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><span>{visible.length} esecuzioni</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span>{page}/{pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="rounded-lg border p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div></section>
        <div className="space-y-5"><AutomationProblemsPanel runs={periodRuns} rules={rules} />{canViewNotifications ? <AutomationNotificationsPanel notifications={notifications} importantOnly={importantOnly} onImportantChange={setImportantOnly} /> : null}</div>
      </div>
    </>}
  </main>;
}
