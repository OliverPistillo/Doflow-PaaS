"use client";

import Link from "next/link";
import { AlertTriangle, Bell, CheckCircle2, Info, XCircle } from "lucide-react";
import type { AutomationRule, AutomationRun } from "@/lib/tenant-automations-api";
import type { TenantNotification } from "@/lib/tenant-notifications-api";
import { formatTime } from "./automation-center-model";
import { AutomationEmpty, AutomationPanel } from "./automation-center-ui";

export function AutomationProblemsPanel({ runs, rules }: { runs: AutomationRun[]; rules: AutomationRule[] }) {
  const ruleById = new Map(rules.map((rule) => [rule.id, rule]));
  const problems = runs.filter((run) => run.status === "failed").slice(0, 5);
  return <AutomationPanel title="Problemi aperti" actionHref="/automations/activity" actionLabel="Vedi tutti">{problems.length ? <div className="divide-y divide-slate-100">{problems.map((run) => { const rule = ruleById.get(run.rule_id || ""); const severity = rule?.priority === "urgent" ? "Urgente" : rule?.priority === "high" ? "Alta" : "Errore"; return <div key={run.id} className="flex items-center gap-3 py-3"><span className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600"><AlertTriangle className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{run.error_message || "Esecuzione fallita"}</p><p className="truncate text-xs text-slate-500">{run.rule_name || rule?.name || "Automazione"} · {severity}</p></div><Link href={`/automations/runs/${run.id}`} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700">Apri</Link></div>; })}</div> : <AutomationEmpty>Nessun problema aperto nel periodo.</AutomationEmpty>}</AutomationPanel>;
}

export function AutomationNotificationsPanel({ notifications, importantOnly, onImportantChange }: { notifications: TenantNotification[]; importantOnly: boolean; onImportantChange: (value: boolean) => void }) {
  const visible = importantOnly ? notifications.filter((item) => ["high", "urgent"].includes(String(item.priority))) : notifications;
  return <AutomationPanel title="Notifiche recenti" header={<label className="flex items-center gap-2 text-xs text-slate-500"><span>Solo importanti</span><button type="button" role="switch" aria-checked={importantOnly} onClick={() => onImportantChange(!importantOnly)} className={`relative h-6 w-11 rounded-full transition-colors ${importantOnly ? "bg-indigo-600" : "bg-slate-200"}`}><span className={`absolute top-1 h-4 w-4 rounded-full bg-white transition-transform ${importantOnly ? "left-6" : "left-1"}`} /></button></label>}>
    {visible.length ? <div className="divide-y divide-slate-100">{visible.slice(0, 6).map((item) => {
      const tone = ["high", "urgent"].includes(String(item.priority)) ? "red" : item.type === "success" ? "green" : "blue"; const Icon = tone === "red" ? XCircle : tone === "green" ? CheckCircle2 : item.type === "info" ? Info : Bell;
      const content = <><span className={`flex h-9 w-9 items-center justify-center rounded-full ${tone === "red" ? "bg-rose-50 text-rose-600" : tone === "green" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{item.title}</p><p className="truncate text-xs text-slate-500">{item.body || item.type}</p></div><span className="text-xs text-slate-500">{formatTime(item.created_at)}</span></>;
      return item.link_url ? <Link key={item.id} href={item.link_url} className="flex items-center gap-3 py-3 hover:bg-slate-50">{content}</Link> : <div key={item.id} className="flex items-center gap-3 py-3">{content}</div>;
    })}</div> : <AutomationEmpty>Nessuna notifica reale corrisponde al filtro.</AutomationEmpty>}
    <div className="mt-3 text-center"><Link href="/notifications" className="text-sm font-medium text-indigo-600">Visualizza tutte le notifiche</Link></div>
  </AutomationPanel>;
}
