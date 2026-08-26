"use client";

import { useEffect, useEffectEvent, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Pause, Play, Search, Workflow } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { automationsApi, type AutomationRule, type AutomationRun } from "@/lib/tenant-automations-api";
import { AccessDenied } from "@/features/identity/access-denied";
import { actionNames, formatDateTime, isToday, loadRules, loadRuns, ruleArea, ruleStatus, triggerLabel, useAutomationCenterAccess } from "./automation-center-model";
import { AutomationBadge, AutomationEmpty, AutomationError, AutomationKpi, AutomationLoading, AutomationPageHeader } from "./automation-center-ui";
import { AutomationRulePanel } from "./automation-rule-panel";

const PAGE_SIZE = 10;

export function AutomationRulesWorkspace() {
  const router = useRouter();
  const { canViewRules, canManageRules, canRunRules, canViewRuns } = useAutomationCenterAccess();
  const [rules, setRules] = useState<AutomationRule[]>([]); const [runs, setRuns] = useState<AutomationRun[]>([]); const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState(""); const [area, setArea] = useState("all"); const [status, setStatus] = useState("all"); const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const load = async () => {
    if (!canViewRules) { setLoading(false); return; } setLoading(true); setError(null);
    try { const [ruleData, runData] = await Promise.all([loadRules(), canViewRuns ? loadRuns() : Promise.resolve({ items: [] as AutomationRun[] })]); setRules(ruleData.items); setRuns(runData.items); setSelectedId((current) => current || ruleData.items[0]?.id || null); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Caricamento delle automazioni non riuscito."); } finally { setLoading(false); }
  };
  const loadEffect = useEffectEvent(load);
  useEffect(() => {
    if (!canViewRules) return;
    let cancelled = false;
    queueMicrotask(() => {
      if (!cancelled) {
        void loadEffect();
      }
    });
    return () => {
      cancelled = true;
    };
  }, [canViewRules]);

  const areas = useMemo(() => Array.from(new Set(rules.map(ruleArea))).sort(), [rules]);
  const visible = useMemo(() => rules.filter((rule) => {
    const state = ruleStatus(rule).label; const text = `${rule.name} ${rule.description || ""} ${triggerLabel(rule.trigger_type)} ${actionNames(rule.actions).join(" ")}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (area === "all" || ruleArea(rule) === area) && (status === "all" || state === status);
  }), [rules, search, area, status]);
  const pages = Math.max(1, Math.ceil(visible.length / PAGE_SIZE)); const pageRows = visible.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const selected = rules.find((rule) => rule.id === selectedId) || null; const runByRule = new Map(rules.map((rule) => [rule.id, runs.filter((run) => run.rule_id === rule.id)]));
  const active = rules.filter((rule) => rule.is_enabled).length; const paused = rules.filter((rule) => !rule.is_enabled).length; const attention = rules.filter((rule) => ruleStatus(rule).label === "Da controllare").length;
  const toggle = async (rule: AutomationRule) => { if (!canManageRules) return; setBusy(true); setError(null); try { if (rule.is_enabled) await automationsApi.disableRule(rule.id); else await automationsApi.enableRule(rule.id); await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Aggiornamento non riuscito."); } finally { setBusy(false); } };
  const test = async () => { if (!selected || !canRunRules) return; setBusy(true); setError(null); try { const result = await automationsApi.runRule(selected.id); const runId = (result as AutomationRun)?.id; if (runId) router.push(`/automations/runs/${runId}`); else await load(); } catch (reason) { setError(reason instanceof Error ? reason.message : "Test non riuscito."); } finally { setBusy(false); } };

  if (!canViewRules) return <AccessDenied resource="alle regole di automazione" />;

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <AutomationPageHeader title="Automazioni" description="Crea e gestisci flussi automatici senza duplicare regole e trigger." ctaLabel="Nuova automazione" ctaHref="/automations/rules/new" canCreate={canManageRules}><Link href="/automations/templates" className="inline-flex h-11 items-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 hover:bg-slate-50">Modelli</Link></AutomationPageHeader>
    <AutomationError message={error} />
    {loading ? <AutomationLoading /> : <>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4"><div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px_220px]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Cerca automazione..." className="pl-9" /></div><Select value={area} onValueChange={(value) => { setArea(value); setPage(1); }}><SelectTrigger><SelectValue placeholder="Area" /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le aree</SelectItem>{areas.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={status} onValueChange={(value) => { setStatus(value); setPage(1); }}><SelectTrigger><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem><SelectItem value="Attiva">Attive</SelectItem><SelectItem value="In pausa">In pausa</SelectItem><SelectItem value="Da controllare">Da controllare</SelectItem></SelectContent></Select></div></div>
      <div className="grid gap-4 sm:grid-cols-3"><AutomationKpi icon={Play} label="Attive" value={active} hint="Regole abilitate" /><AutomationKpi icon={Pause} label="In pausa" value={paused} hint="Regole disabilitate" tone="orange" /><AutomationKpi icon={AlertTriangle} label="Da controllare" value={attention} hint="Ultimo errore successivo all’ultimo successo" tone="red" /></div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1050px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Automazione</th><th className="px-4 py-4">Quando accade</th><th className="px-4 py-4">Azione</th><th className="px-4 py-4">Area</th><th className="px-4 py-4">Esecuzioni oggi</th><th className="px-4 py-4">Ultima esecuzione</th><th className="px-4 py-4">Stato</th><th className="px-4 py-4">Azioni</th></tr></thead><tbody className="divide-y divide-slate-100">{pageRows.map((rule) => { const state = ruleStatus(rule); const ruleRuns = runByRule.get(rule.id) || []; return <tr key={rule.id} onClick={() => setSelectedId(rule.id)} className={`cursor-pointer ${selectedId === rule.id ? "bg-violet-50/70" : "hover:bg-slate-50/70"}`}><td className="px-5 py-4"><div className="flex items-center gap-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Workflow className="h-4 w-4" /></span><div><p className="font-semibold text-slate-900">{rule.name}</p>{rule.description ? <p className="max-w-48 truncate text-xs text-slate-500">{rule.description}</p> : null}</div></div></td><td className="px-4 py-4 text-slate-700">{triggerLabel(rule.trigger_type)}</td><td className="px-4 py-4 text-slate-700">{actionNames(rule.actions)[0] || "—"}</td><td className="px-4 py-4 text-slate-600">{ruleArea(rule)}</td><td className="px-4 py-4 font-semibold text-slate-800">{ruleRuns.filter((run) => isToday(run.started_at)).length}</td><td className="px-4 py-4 text-slate-600">{formatDateTime(ruleRuns[0]?.started_at || rule.last_run_at)}</td><td className="px-4 py-4"><AutomationBadge label={state.label} tone={state.tone} /></td><td className="px-4 py-4"><div className="flex gap-2"><Link href={`/automations/rules/${rule.id}`} onClick={(event) => event.stopPropagation()} className="text-xs font-semibold text-indigo-600">Apri</Link>{canManageRules ? <button disabled={busy} onClick={(event) => { event.stopPropagation(); void toggle(rule); }} className="text-xs font-semibold text-slate-600">{rule.is_enabled ? "Pausa" : "Attiva"}</button> : null}</div></td></tr>; })}</tbody></table>{!pageRows.length ? <AutomationEmpty className="m-5">Nessuna automazione corrisponde ai filtri.</AutomationEmpty> : null}</div><div className="flex items-center justify-between border-t border-slate-100 px-5 py-3 text-xs text-slate-500"><span>{visible.length} automazioni</span><div className="flex items-center gap-2"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="rounded-lg border p-1.5 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><span>{page}/{pages}</span><button disabled={page >= pages} onClick={() => setPage((value) => Math.min(pages, value + 1))} className="rounded-lg border p-1.5 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></div></section>
        <AutomationRulePanel rule={selected} runs={runs} canTest={canRunRules} busy={busy} onClose={() => setSelectedId(null)} onTest={() => void test()} />
      </div>
    </>}
  </main>;
}
