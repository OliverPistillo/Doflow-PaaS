"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Clock3, Workflow, XCircle } from "lucide-react";
import type { AutomationActivity, AutomationRule, AutomationRun } from "@/lib/tenant-automations-api";
import { formatDateTime, inPeriod, ruleStatus, runStatus, successRate, successfulRun } from "./automation-center-model";
import { AutomationBadge, AutomationEmpty, AutomationPanel } from "./automation-center-ui";

export function AutomationStatusChart({ runs, days, onDaysChange }: { runs: AutomationRun[]; days: number; onDaysChange: (days: number) => void }) {
  const buckets = Array.from({ length: days }, (_, index) => {
    const date = new Date(); date.setHours(0, 0, 0, 0); date.setDate(date.getDate() - (days - 1 - index));
    const key = `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
    const dayRuns = runs.filter((run) => { const value = new Date(run.started_at || 0); return `${value.getFullYear()}-${value.getMonth()}-${value.getDate()}` === key; });
    return { label: new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(date), success: dayRuns.filter(successfulRun).length, failed: dayRuns.filter((run) => run.status === "failed").length };
  });
  const max = Math.max(1, ...buckets.map((bucket) => bucket.success + bucket.failed));
  const relevant = runs.filter((run) => inPeriod(run.started_at, days));
  const successful = relevant.filter(successfulRun).length; const failed = relevant.filter((run) => run.status === "failed").length;
  return <AutomationPanel title="Stato delle automazioni" header={<select value={days} onChange={(event) => onDaysChange(Number(event.target.value))} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700"><option value={7}>7 giorni</option><option value={30}>30 giorni</option></select>}>
    {relevant.length ? <><div className="mb-4 flex flex-wrap gap-4 text-xs text-slate-500"><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-indigo-500" />Esecuzioni riuscite</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-rose-500" />Esecuzioni fallite</span></div>
      <div className="flex h-48 items-end gap-2 border-b border-slate-200 pb-7">{buckets.map((bucket) => <div key={bucket.label} className="relative flex h-full flex-1 items-end justify-center gap-1"><div className="w-2/5 max-w-8 rounded-t-md bg-indigo-500" style={{ height: `${Math.max(bucket.success ? 5 : 1, bucket.success / max * 135)}px` }} /><div className="w-2/5 max-w-8 rounded-t-md bg-rose-400" style={{ height: `${Math.max(bucket.failed ? 5 : 1, bucket.failed / max * 135)}px` }} /><span className="absolute -bottom-6 text-[11px] capitalize text-slate-500">{bucket.label}</span></div>)}</div>
      <div className="mt-4 grid grid-cols-3 divide-x divide-slate-200 text-center"><div><p className="text-xl font-semibold text-slate-950">{relevant.length}</p><p className="text-xs text-slate-500">esecuzioni</p></div><div><p className="text-xl font-semibold text-slate-950">{successful}</p><p className="text-xs text-slate-500">riuscite</p></div><div><p className="text-xl font-semibold text-slate-950">{failed}</p><p className="text-xs text-slate-500">fallite</p></div></div></> : <AutomationEmpty>Nessuna esecuzione disponibile per costruire la serie del periodo.</AutomationEmpty>}
  </AutomationPanel>;
}

export function AutomationAttentionPanel({ rules, runs }: { rules: AutomationRule[]; runs: AutomationRun[] }) {
  const byRule = new Map(rules.map((rule) => [rule.id, rule]));
  const failed = runs.filter((run) => run.status === "failed").slice(0, 5).map((run) => ({ id: run.id, name: run.rule_name || byRule.get(run.rule_id || "")?.name || "Automazione", problem: run.error_message || "Esecuzione fallita", href: `/automations/runs/${run.id}`, severity: byRule.get(run.rule_id || "")?.priority === "urgent" ? "Alta" : "Errore" }));
  const known = new Set(failed.map((item) => item.name));
  const ruleErrors = rules.filter((rule) => rule.last_error_message && !known.has(rule.name)).slice(0, Math.max(0, 5 - failed.length)).map((rule) => ({ id: rule.id, name: rule.name, problem: rule.last_error_message || "Ultima esecuzione in errore", href: `/automations/rules/${rule.id}`, severity: rule.priority === "urgent" ? "Alta" : "Controllo" }));
  const items = [...failed, ...ruleErrors];
  return <AutomationPanel title="Richiedono attenzione">{items.length ? <div className="divide-y divide-slate-100">{items.map((item) => <div key={`${item.href}:${item.id}`} className="flex items-center gap-3 py-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600"><AlertTriangle className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{item.name}</p><p className="truncate text-xs text-rose-600">{item.problem}</p></div><Link href={item.href} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Apri</Link></div>)}</div> : <AutomationEmpty>Nessun errore reale richiede attenzione.</AutomationEmpty>}</AutomationPanel>;
}

export function AutomationMostUsed({ rules, runs }: { rules: AutomationRule[]; runs: AutomationRun[] }) {
  const rows = rules.map((rule) => { const ruleRuns = runs.filter((run) => run.rule_id === rule.id); return { rule, count: ruleRuns.length, rate: successRate(ruleRuns) }; }).filter((row) => row.count > 0).sort((a, b) => b.count - a.count).slice(0, 5);
  return <AutomationPanel title="Più utilizzate" actionHref="/automations/rules" actionLabel="Vedi tutte">{rows.length ? <div className="divide-y divide-slate-100">{rows.map(({ rule, count, rate }) => { const state = ruleStatus(rule); return <Link key={rule.id} href={`/automations/rules/${rule.id}`} className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto] items-center gap-3 py-3 hover:bg-slate-50"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Workflow className="h-4 w-4" /></span><p className="truncate text-sm font-semibold text-slate-900">{rule.name}</p><span className="text-xs text-slate-500">{count} esecuzioni · {rate === null ? "—" : `${rate}%`}</span><AutomationBadge label={state.label} tone={state.tone} /></Link>; })}</div> : <AutomationEmpty>Nessuna automazione eseguita nel periodo caricato.</AutomationEmpty>}</AutomationPanel>;
}

export function AutomationRecentActivity({ activities, rules, runs }: { activities: AutomationActivity[]; rules: AutomationRule[]; runs: AutomationRun[] }) {
  const byRule = new Map(rules.map((rule) => [rule.id, rule]));
  const items = activities.length ? activities.slice(0, 5).map((activity) => ({ id: activity.id, name: byRule.get(activity.rule_id || "")?.name || "Automazione", event: activity.action.replaceAll("_", " "), date: activity.created_at, href: activity.rule_id ? `/automations/rules/${activity.rule_id}` : "/automations/activity", status: null as AutomationRun | null })) : runs.slice(0, 5).map((run) => ({ id: run.id, name: run.rule_name || "Automazione", event: run.trigger_type.replaceAll("_", " "), date: run.started_at, href: `/automations/runs/${run.id}`, status: run }));
  return <AutomationPanel title="Ultime attività" actionHref="/automations/activity" actionLabel="Vedi attività">{items.length ? <div className="divide-y divide-slate-100">{items.map((item) => { const state = item.status ? runStatus(item.status) : null; return <Link key={item.id} href={item.href} className="flex items-center gap-3 py-3 hover:bg-slate-50"><span className={`flex h-9 w-9 items-center justify-center rounded-full ${state?.tone === "red" ? "bg-rose-50 text-rose-600" : "bg-violet-50 text-violet-600"}`}>{state?.tone === "red" ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{item.name}</p><p className="truncate text-xs capitalize text-slate-500">{item.event}</p></div><span className="inline-flex items-center gap-1 text-xs text-slate-500"><Clock3 className="h-3.5 w-3.5" />{formatDateTime(item.date)}</span>{state ? <AutomationBadge label={state.label} tone={state.tone} /> : null}</Link>; })}</div> : <AutomationEmpty>Nessuna attività recente.</AutomationEmpty>}</AutomationPanel>;
}
