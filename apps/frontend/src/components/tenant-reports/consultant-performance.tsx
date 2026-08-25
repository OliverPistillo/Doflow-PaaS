"use client";

import { useEffect,useMemo,useState } from "react";
import { Activity,CheckCircle2,Clock3,Target,UsersRound } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card,CardContent,CardHeader,CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select";
import { Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle } from "@/components/ui/sheet";
import { reportsApi,type ConsultantPerformanceItem,type ConsultantPerformanceReport } from "@/lib/tenant-reports-api";
import { projectStageLabel } from "@/lib/project-stage-model";
import { formatCurrency,formatNumber } from "./report-utils";

type Preset = "7" | "30" | "90" | "month" | "custom";
type SortKey = "display_name" | "opportunities_assigned" | "activities_completed" | "conversion_rate" | "tasks_completed" | "projects_delivered" | "open_workload";

function dateOnly(date: Date) { return date.toISOString().slice(0, 10); }
function datesFor(preset: Preset) {
  const today = new Date();
  const from = preset === "month" ? new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)) : new Date(today.getTime() - (Number(preset || 30) - 1) * 86400000);
  return { dateFrom: dateOnly(from), dateTo: dateOnly(today) };
}
function shortDate(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value); return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat("it-IT", { dateStyle: "medium" }).format(date);
}

function MetricCard({ icon: Icon, label, value, hint }: { icon: typeof UsersRound; label: string; value: number | string; hint: string }) {
  return <Card className="border-slate-200"><CardContent className="p-4"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p><p className="mt-2 text-2xl font-bold tabular-nums text-slate-950">{value}</p><p className="mt-1 text-xs text-slate-500">{hint}</p></div><span className="rounded-xl bg-violet-50 p-2.5 text-violet-600"><Icon className="h-5 w-5" /></span></div></CardContent></Card>;
}

function MiniMetric({ label, value }: { label: string; value: string | number }) {
  return <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 text-lg font-bold tabular-nums text-slate-950">{value}</p></div>;
}

export function ConsultantPerformancePage() {
  const [preset, setPreset] = useState<Preset>("30");
  const initial = datesFor("30");
  const [dateFrom, setDateFrom] = useState(initial.dateFrom);
  const [dateTo, setDateTo] = useState(initial.dateTo);
  const [data, setData] = useState<ConsultantPerformanceReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("activities_completed");
  const [sortDesc, setSortDesc] = useState(true);
  const [selected, setSelected] = useState<ConsultantPerformanceItem | null>(null);
  const [details, setDetails] = useState<ConsultantPerformanceReport["details"]>();
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    let active = true;
    queueMicrotask(() => {
      if (!active) return;
      setLoading(true);
      setError(null);
      reportsApi.consultantPerformance({ date_from: dateFrom, date_to: dateTo })
        .then((result) => { if (active) setData(result); })
        .catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "Performance non disponibile."); })
        .finally(() => { if (active) setLoading(false); });
    });
    return () => { active = false; };
  }, [dateFrom, dateTo]);

  const choosePreset = (value: Preset) => {
    setPreset(value);
    if (value !== "custom") { const next = datesFor(value); setDateFrom(next.dateFrom); setDateTo(next.dateTo); }
  };
  const rows = useMemo(() => [...(data?.items || [])].sort((a, b) => {
    const left = a[sortKey]; const right = b[sortKey];
    const comparison = typeof left === "string" ? left.localeCompare(String(right)) : Number(left || 0) - Number(right || 0);
    return sortDesc ? -comparison : comparison;
  }), [data?.items, sortDesc, sortKey]);
  const changeSort = (key: SortKey) => { if (key === sortKey) setSortDesc((value) => !value); else { setSortKey(key); setSortDesc(true); } };
  const openDetail = async (item: ConsultantPerformanceItem) => {
    setSelected(item); setDetails(undefined); setDetailLoading(true);
    try { const result = await reportsApi.consultantPerformance({ date_from: dateFrom, date_to: dateTo, user_id: item.user_id }); setDetails(result.details); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Dettaglio non disponibile."); }
    finally { setDetailLoading(false); }
  };
  const summary = data?.summary || {};
  const canFinance = Boolean(data?.permissions.canViewFinance);

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between"><div><h1 className="text-2xl font-bold tracking-tight text-slate-950">Performance consulenti</h1><p className="mt-1 max-w-3xl text-sm text-slate-500">Metriche trasparenti da commerciale, delivery e attività operative reali. Nessun punteggio sintetico di valutazione.</p></div><div className="flex flex-col gap-2 sm:flex-row"><Select value={preset} onValueChange={(value) => choosePreset(value as Preset)}><SelectTrigger className="h-11 w-full bg-white sm:w-52"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">7 giorni</SelectItem><SelectItem value="30">30 giorni</SelectItem><SelectItem value="90">90 giorni</SelectItem><SelectItem value="month">Mese corrente</SelectItem><SelectItem value="custom">Intervallo personalizzato</SelectItem></SelectContent></Select>{preset === "custom" ? <><Input aria-label="Inizio periodo performance" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className="h-11 bg-white" /><Input aria-label="Fine periodo performance" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className="h-11 bg-white" /></> : null}</div></div>
    {error ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">{error}</p> : null}
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5"><MetricCard icon={UsersRound} label="Consulenti" value={loading ? "…" : Number(summary.consultants || 0)} hint="Membri team attivi" /><MetricCard icon={Target} label="Conversione" value={loading ? "…" : `${formatNumber(summary.conversionRate || 0)}%`} hint="Vinte su vinte + perse" /><MetricCard icon={Activity} label="Attività completate" value={loading ? "…" : Number(summary.activitiesCompleted || 0)} hint="Nel periodo selezionato" /><MetricCard icon={CheckCircle2} label="Task completati" value={loading ? "…" : Number(summary.tasksCompleted || 0)} hint="Delivery nel periodo" /><MetricCard icon={Clock3} label="Carico aperto" value={loading ? "…" : Number(summary.openWorkload || 0)} hint="Attività e task correnti" /></div>
    {canFinance ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"><strong>Valore trattative vinte:</strong> {formatCurrency(summary.wonValue || 0)}. Visibile perché il backend ha confermato il permesso finance.</div> : null}
    <Card className="overflow-hidden border-slate-200"><CardHeader className="border-b border-slate-200"><CardTitle className="text-base">Consulenti · {shortDate(dateFrom)} – {shortDate(dateTo)}</CardTitle></CardHeader><CardContent className="p-0">{loading ? <div className="flex min-h-72 items-center justify-center text-sm text-slate-500">Calcolo metriche…</div> : rows.length === 0 ? <div className="p-10 text-center text-sm text-slate-500">Nessun membro team attivo disponibile.</div> : <div className="overflow-x-auto"><table className="w-full min-w-[1120px] text-sm"><thead className="bg-slate-50 text-left text-xs font-semibold text-slate-500"><tr><th className="px-5 py-4"><button onClick={() => changeSort("display_name")}>Consulente</button></th><th className="px-4 py-4"><button onClick={() => changeSort("opportunities_assigned")}>Opportunità</button></th><th className="px-4 py-4"><button onClick={() => changeSort("activities_completed")}>Attività concluse</button></th><th className="px-4 py-4">Follow-up scaduti</th><th className="px-4 py-4"><button onClick={() => changeSort("conversion_rate")}>Conversione</button></th><th className="px-4 py-4"><button onClick={() => changeSort("tasks_completed")}>Task completati</button></th><th className="px-4 py-4">Task scaduti</th><th className="px-4 py-4"><button onClick={() => changeSort("projects_delivered")}>Consegnati</button></th><th className="px-4 py-4"><button onClick={() => changeSort("open_workload")}>Carico aperto</button></th></tr></thead><tbody className="divide-y divide-slate-100">{rows.map((item) => <tr key={item.user_id} onClick={() => void openDetail(item)} className="cursor-pointer hover:bg-violet-50/50"><td className="px-5 py-4"><button type="button" data-record-sensitive className="font-semibold text-indigo-600 hover:text-indigo-700">{item.display_name}</button><p className="mt-0.5 text-xs text-slate-500">{item.operational_role || "Consulente"}</p></td><td className="px-4 py-4 tabular-nums">{item.opportunities_assigned}</td><td className="px-4 py-4 tabular-nums">{item.activities_completed}</td><td className="px-4 py-4"><Badge className={item.follow_ups_overdue ? "bg-rose-100 text-rose-700 hover:bg-rose-100" : "bg-slate-100 text-slate-600 hover:bg-slate-100"}>{item.follow_ups_overdue}</Badge></td><td className="px-4 py-4 font-semibold tabular-nums">{formatNumber(item.conversion_rate)}%</td><td className="px-4 py-4 tabular-nums">{item.tasks_completed} <span className="text-xs text-slate-400">({formatNumber(item.task_completion_rate)}%)</span></td><td className="px-4 py-4 tabular-nums">{item.tasks_overdue}</td><td className="px-4 py-4 tabular-nums">{item.projects_delivered}</td><td className="px-4 py-4 font-semibold tabular-nums">{item.open_workload}</td></tr>)}</tbody></table></div>}</CardContent></Card>
    <p className="text-xs leading-5 text-slate-500">Criterio: sono inclusi i membri team attivi. Vinte/perse usano l’ultimo aggiornamento della fase nel periodo; consegne usano delivered_at; scaduti e carico aperto fotografano lo stato corrente.</p>

    <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) { setSelected(null); setDetails(undefined); } }}><SheetContent className="w-full overflow-y-auto bg-white sm:max-w-none md:w-[min(680px,76vw)]"><SheetHeader><SheetTitle data-record-sensitive>{selected?.display_name || "Dettaglio consulente"}</SheetTitle><SheetDescription>Dettaglio nello stesso percorso, senza aprire una nuova pagina.</SheetDescription></SheetHeader>{selected ? <div className="mt-6 space-y-5"><section><h3 className="mb-3 text-sm font-semibold text-slate-900">Commerciale</h3><div className="grid gap-3 sm:grid-cols-3"><MiniMetric label="Opportunità assegnate" value={selected.opportunities_assigned} /><MiniMetric label="Vinte / perse" value={`${selected.won} / ${selected.lost}`} /><MiniMetric label="Conversione" value={`${formatNumber(selected.conversion_rate)}%`} /><MiniMetric label="Appuntamenti" value={selected.appointments} /><MiniMetric label="Chiamate" value={selected.calls} /><MiniMetric label="Follow-up scaduti" value={selected.follow_ups_overdue} />{canFinance ? <MiniMetric label="Valore vinto" value={formatCurrency(selected.won_value || 0)} /> : null}</div></section><section><h3 className="mb-3 text-sm font-semibold text-slate-900">Delivery</h3><div className="grid gap-3 sm:grid-cols-3"><MiniMetric label="Progetti gestiti" value={selected.projects_managed} /><MiniMetric label="Task assegnati" value={selected.tasks_assigned} /><MiniMetric label="Task completati" value={selected.tasks_completed} /><MiniMetric label="Task scaduti" value={selected.tasks_overdue} /><MiniMetric label="Progetti consegnati" value={selected.projects_delivered} /><MiniMetric label="Progetti in ritardo" value={selected.projects_late} /></div></section><section><h3 className="mb-3 text-sm font-semibold text-slate-900">Operatività</h3><div className="grid gap-3 sm:grid-cols-3"><MiniMetric label="Timeline create" value={selected.timeline_created} /><MiniMetric label="Timeline completate" value={selected.timeline_completed} /><MiniMetric label="Tempo medio chiusura" value={selected.average_activity_close_hours === null ? "Non calcolabile" : `${formatNumber(selected.average_activity_close_hours)} h`} /><MiniMetric label="Carico aperto" value={selected.open_workload} /></div></section>{detailLoading ? <div className="py-10 text-center text-sm text-slate-500">Caricamento relazioni…</div> : details ? <div className="grid gap-4"><Card><CardHeader><CardTitle className="text-sm">Attività recenti</CardTitle></CardHeader><CardContent className="space-y-2">{details.activities.length ? details.activities.map((item) => <div key={item.id} className="rounded-xl border p-3"><p className="font-medium">{item.title}</p><p className="text-xs text-slate-500">{item.type} · {shortDate(item.completed_at || item.created_at)}</p></div>) : <p className="text-sm text-slate-500">Nessuna attività nel periodo.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Progetti correlati</CardTitle></CardHeader><CardContent className="space-y-2">{details.projects.length ? details.projects.map((item) => <div key={item.id} className="rounded-xl border p-3"><p className="font-medium" data-record-sensitive>{item.name}</p><p className="text-xs text-slate-500" data-record-sensitive>{item.company_name || "Cliente non collegato"} · {projectStageLabel(item.status, true)}</p></div>) : <p className="text-sm text-slate-500">Nessun progetto gestito.</p>}</CardContent></Card><Card><CardHeader><CardTitle className="text-sm">Opportunità correlate</CardTitle></CardHeader><CardContent className="space-y-2">{details.opportunities.length ? details.opportunities.map((item) => <div key={item.id} className="rounded-xl border p-3"><p className="font-medium" data-record-sensitive>{item.title}</p><p className="text-xs text-slate-500" data-record-sensitive>{item.company_name || "Cliente non collegato"} · {item.stage}</p></div>) : <p className="text-sm text-slate-500">Nessuna opportunità assegnata.</p>}</CardContent></Card></div> : null}</div> : null}</SheetContent></Sheet>
  </main>;
}
