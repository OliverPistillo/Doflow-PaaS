"use client";

import Link from "next/link";
import { CheckCircle2, Play, Workflow, X, XCircle } from "lucide-react";
import type { AutomationRule, AutomationRun } from "@/lib/tenant-automations-api";
import { actionNames, formatDateTime, ruleArea, ruleStatus, runStatus, successRate, triggerLabel } from "./automation-center-model";
import { AutomationBadge, AutomationEmpty } from "./automation-center-ui";

export function AutomationRulePanel({ rule, runs, canTest, busy, onClose, onTest }: {
  rule: AutomationRule | null; runs: AutomationRun[]; canTest: boolean; busy: boolean; onClose: () => void; onTest: () => void;
}) {
  if (!rule) return <aside className="rounded-2xl border border-slate-200/80 bg-white p-5"><AutomationEmpty className="min-h-72">Seleziona un’automazione per vedere trigger, azioni e risultati reali.</AutomationEmpty></aside>;
  const ruleRuns = runs.filter((run) => run.rule_id === rule.id); const latest = ruleRuns[0]; const rate = successRate(ruleRuns); const state = ruleStatus(rule); const latestState = latest ? runStatus(latest) : null; const actions = actionNames(rule.actions);
  return <aside className="rounded-2xl border border-slate-200/80 bg-white p-5">
    <div className="flex items-start justify-between gap-3"><div className="flex gap-3"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-violet-50 text-violet-600"><Workflow className="h-5 w-5" /></span><div><div className="flex flex-wrap items-center gap-2"><h2 className="font-semibold text-slate-950">{rule.name}</h2><AutomationBadge label={state.label} tone={state.tone} /></div><p className="mt-1 text-xs text-slate-500">ID: {rule.id}</p></div></div><button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Chiudi dettaglio"><X className="h-4 w-4" /></button></div>
    <div className="mt-5 space-y-5 border-t border-slate-100 pt-5">
      <div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Quando accade</p><div className="mt-2 rounded-xl bg-slate-50 p-3"><p className="text-sm font-semibold text-slate-900">{triggerLabel(rule.trigger_type)}</p><p className="mt-1 text-xs text-slate-500">{ruleArea(rule)} · {rule.run_mode}</p></div></div>
      <div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Sequenza azioni</p>{actions.length ? <div className="mt-2 space-y-2">{actions.map((action, index) => <div key={`${action}:${index}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-xs font-semibold text-white">{index + 1}</span><span className="text-sm font-medium capitalize text-slate-800">{action}</span></div>)}</div> : <p className="mt-2 text-sm text-slate-500">Nessuna azione configurata.</p>}</div>
      <div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Ultima esecuzione</p><div className="mt-2 flex items-center gap-3"><span className={`flex h-8 w-8 items-center justify-center rounded-full ${latestState?.tone === "red" ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-600"}`}>{latestState?.tone === "red" ? <XCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}</span><div><p className="text-sm font-semibold text-slate-900">{latestState?.label || "Nessuna esecuzione"}</p><p className="text-xs text-slate-500">{formatDateTime(latest?.started_at || rule.last_run_at)}</p></div></div></div>
      <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Esecuzioni caricate</p><p className="mt-1 text-xl font-semibold text-slate-950">{ruleRuns.length}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Tasso successo</p><p className="mt-1 text-xl font-semibold text-slate-950">{rate === null ? "—" : `${rate}%`}</p></div></div>
      <Link href={`/automations/rules/${rule.id}`} className="flex h-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700">Apri automazione</Link>
      {canTest ? <button disabled={busy} onClick={onTest} className="flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><Play className="h-4 w-4" />Esegui test</button> : null}
    </div>
  </aside>;
}
