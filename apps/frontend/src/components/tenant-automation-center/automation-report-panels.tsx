"use client";

import Link from "next/link";
import { AlertCircle, BarChart3, CheckCircle2, Target } from "lucide-react";
import type { AutomationRule, AutomationRun } from "@/lib/tenant-automations-api";
import type { KpiTarget } from "@/lib/tenant-reports-api";
import { areaGroup, numeric, successRate, successfulRun } from "./automation-center-model";
import { AutomationEmpty, AutomationPanel } from "./automation-center-ui";

export function AutomationImpactChart({ runs, days }: { runs: AutomationRun[]; days: number }) {
  const bucketCount = days <= 7 ? 7 : days <= 30 ? 10 : 12; const bucketDays = Math.ceil(days / bucketCount);
  const buckets = Array.from({ length: bucketCount }, (_, index) => {
    const end = new Date(); end.setHours(23, 59, 59, 999); end.setDate(end.getDate() - (bucketCount - 1 - index) * bucketDays);
    const start = new Date(end); start.setHours(0, 0, 0, 0); start.setDate(end.getDate() - bucketDays + 1);
    const rows = runs.filter((run) => { const date = new Date(run.started_at || 0); return date >= start && date <= end; });
    return { label: new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(end), success: rows.filter(successfulRun).length, failed: rows.filter((run) => run.status === "failed").length };
  });
  const max = Math.max(1, ...buckets.map((item) => item.success + item.failed));
  return <AutomationPanel title="Impatto nel tempo">{runs.length ? <><div className="mb-4 flex gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" />Completate</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />Errori</span></div><div className="flex h-52 items-end gap-2 border-b border-slate-200 pb-8">{buckets.map((item) => <div key={item.label} className="relative flex h-full flex-1 items-end justify-center gap-0.5"><div className="w-[42%] rounded-t bg-indigo-500" style={{ height: `${Math.max(item.success ? 5 : 1, item.success / max * 145)}px` }} /><div className="w-[42%] rounded-t bg-rose-400" style={{ height: `${Math.max(item.failed ? 5 : 1, item.failed / max * 145)}px` }} /><span className="absolute -bottom-7 whitespace-nowrap text-[10px] text-slate-500">{item.label}</span></div>)}</div></> : <AutomationEmpty>Nessuna serie storica disponibile nel periodo.</AutomationEmpty>}</AutomationPanel>;
}

export function AutomationGoals({ targets }: { targets: KpiTarget[] }) {
  const relevant = targets.filter((target) => /automation|action|success|error|run/i.test(String(target.kpi_key || target.kpiKey || ""))).slice(0, 5);
  return <AutomationPanel title="Obiettivi del mese" actionHref="/reports/targets" actionLabel="Gestisci obiettivi">{relevant.length ? <div className="space-y-4">{relevant.map((target) => {
    const targetValue = numeric(target.target ?? target.target_value); const actual = numeric(target.actual); const progress = Math.max(0, Math.min(100, numeric(target.progressPercent))); const reached = target.lowerIsBetter ? actual <= targetValue : progress >= 100;
    return <div key={target.id}><div className="mb-2 flex items-center gap-3"><span className={`flex h-9 w-9 items-center justify-center rounded-full ${reached ? "bg-emerald-50 text-emerald-600" : "bg-violet-50 text-violet-600"}`}>{reached ? <CheckCircle2 className="h-4 w-4" /> : <Target className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{target.label}</p><p className="text-xs text-slate-500">{actual} / {targetValue}</p></div><span className="text-sm font-semibold text-slate-800">{Math.round(progress)}%</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${reached ? "bg-emerald-500" : "bg-indigo-500"}`} style={{ width: `${progress}%` }} /></div></div>;
  })}</div> : <AutomationEmpty>Nessun obiettivo Reports collegato a run, azioni, successo o errori.</AutomationEmpty>}</AutomationPanel>;
}

export function AutomationAreaPerformance({ rules, runs }: { rules: AutomationRule[]; runs: AutomationRun[] }) {
  const ruleById = new Map(rules.map((rule) => [rule.id, rule])); const groups = new Map<string, AutomationRun[]>();
  runs.forEach((run) => { const name = areaGroup(ruleById.get(run.rule_id || "")?.category); groups.set(name, [...(groups.get(name) || []), run]); });
  const rows = Array.from(groups.entries()).map(([name, values]) => ({ name, values, rate: successRate(values), errors: values.filter((run) => run.status === "failed").length })).sort((a, b) => b.values.length - a.values.length);
  const max = Math.max(1, ...rows.map((row) => row.values.length));
  return <AutomationPanel title="Performance per area" actionHref="/reports/operations" actionLabel="Report operatività">{rows.length ? <div className="divide-y divide-slate-100">{rows.map((row) => <div key={row.name} className="grid grid-cols-[minmax(110px,1fr)_minmax(130px,1.5fr)_70px_80px] items-center gap-3 py-3 text-sm"><p className="font-semibold text-slate-900">{row.name}</p><div><div className="mb-1 flex justify-between text-xs text-slate-500"><span>{row.values.length} esecuzioni</span></div><div className="h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${row.values.length / max * 100}%` }} /></div></div><span className="text-slate-600">{row.errors} errori</span><span className="font-semibold text-emerald-600">{row.rate === null ? "—" : `${row.rate}%`}</span></div>)}</div> : <AutomationEmpty>Nessuna performance per area disponibile.</AutomationEmpty>}</AutomationPanel>;
}

export function AutomationValuePanel({ runs }: { runs: AutomationRun[] }) {
  const completed = runs.filter(successfulRun).length; const failed = runs.filter((run) => run.status === "failed").length; const actions = runs.reduce((sum, run) => sum + numeric(run.actions_count), 0);
  return <AutomationPanel title="Valore generato / distribuzione"><div className="grid grid-cols-3 gap-3"><div className="rounded-xl bg-violet-50 p-3"><BarChart3 className="h-4 w-4 text-violet-600" /><p className="mt-2 text-xl font-semibold text-slate-950">{actions}</p><p className="text-xs text-slate-500">azioni registrate</p></div><div className="rounded-xl bg-emerald-50 p-3"><CheckCircle2 className="h-4 w-4 text-emerald-600" /><p className="mt-2 text-xl font-semibold text-slate-950">{completed}</p><p className="text-xs text-slate-500">run riuscite</p></div><div className="rounded-xl bg-rose-50 p-3"><AlertCircle className="h-4 w-4 text-rose-600" /><p className="mt-2 text-xl font-semibold text-slate-950">{failed}</p><p className="text-xs text-slate-500">run fallite</p></div></div><div className="mt-4 rounded-xl border border-dashed border-slate-200 bg-slate-50/70 p-4 text-sm text-slate-500">Ore risparmiate e valore economico richiedono parametri reali non configurati. Non vengono stimati da numero di esecuzioni o costo orario.</div><div className="mt-3 flex gap-3"><Link href="/reports/snapshots" className="text-sm font-medium text-indigo-600">Snapshot</Link><Link href="/reports/saved-views" className="text-sm font-medium text-indigo-600">Viste salvate</Link></div></AutomationPanel>;
}
