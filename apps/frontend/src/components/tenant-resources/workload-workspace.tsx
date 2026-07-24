"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, Clock3, Gauge, SlidersHorizontal } from "lucide-react";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { teamApi, type TeamAvailability, type TeamMember, type TeamWorkloadItem, type TimeEntry } from "@/lib/tenant-team-api";
import { availabilityMeta, dateLabel, hours, numberOf, roleLabel } from "./resources-model";
import { InitialsAvatar, ResourcesEmpty, ResourcesError, ResourcesKpi, ResourcesLoading, ResourcesPageHeader, ResourcesPanel, SoftBadge } from "./resources-ui";

function localIso(date: Date) { return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`; }
function mondayOf(date: Date) { const result = new Date(date); result.setHours(12, 0, 0, 0); result.setDate(result.getDate() - ((result.getDay() + 6) % 7)); return result; }
function weekDays(anchor: Date) { const monday = mondayOf(anchor); return Array.from({ length: 5 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return date; }); }

export function WorkloadWorkspace() {
  const { canView, canCreate, canUpdate } = useTenantAccess();
  const [anchor, setAnchor] = useState(() => new Date());
  const [members, setMembers] = useState<TeamMember[]>([]); const [workload, setWorkload] = useState<TeamWorkloadItem[]>([]); const [entries, setEntries] = useState<TimeEntry[]>([]); const [availability, setAvailability] = useState<TeamAvailability[]>([]);
  const [memberFilter, setMemberFilter] = useState("all"); const [projectFilter, setProjectFilter] = useState("all");
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);
  const days = useMemo(() => weekDays(anchor), [anchor]); const from = localIso(days[0]); const to = localIso(days[6]);

  const load = useCallback(async () => {
    if (!canView("team")) { setLoading(false); return; } setLoading(true); setError(null);
    try {
      const [memberData, workloadData, timeData, availabilityData] = await Promise.all([
        teamApi.members({ limit: 100 }), teamApi.workload({ limit: 100 }), teamApi.timeEntries({ date_from: from, date_to: to, limit: 200 }), teamApi.availability({ date_from: `${from}T00:00:00`, date_to: `${to}T23:59:59` }),
      ]);
      setMembers(memberData.items || []); setWorkload(workloadData.items || []); setEntries(timeData.items || []); setAvailability(availabilityData.items || []);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Caricamento dei carichi non riuscito."); } finally { setLoading(false); }
  }, [canView, from, to]);
  useEffect(() => { void load(); }, [load]);

  const projectOptions = useMemo(() => canView("projects") ? Array.from(new Map(entries.filter((entry) => entry.project_id).map((entry) => [entry.project_id!, entry.project_name || "Progetto"])).entries()) : [], [entries, canView]);
  const filteredMembers = useMemo(() => members.filter((member) => memberFilter === "all" || member.id === memberFilter), [members, memberFilter]);
  const filteredEntries = useMemo(() => entries.filter((entry) => (memberFilter === "all" || entry.team_member_id === memberFilter) && (projectFilter === "all" || entry.project_id === projectFilter)), [entries, memberFilter, projectFilter]);
  const totalCapacity = filteredMembers.reduce((sum, member) => sum + numberOf(member.capacity_hours_per_week), 0);
  const totalMinutes = filteredEntries.reduce((sum, entry) => sum + numberOf(entry.duration_minutes), 0);
  const plannedMinutes = filteredEntries.filter((entry) => entry.status === "planned").reduce((sum, entry) => sum + numberOf(entry.duration_minutes), 0);
  const perMemberMinutes = new Map(filteredMembers.map((member) => [member.id, filteredEntries.filter((entry) => entry.team_member_id === member.id).reduce((sum, entry) => sum + numberOf(entry.duration_minutes), 0)]));
  const overloaded = filteredMembers.filter((member) => numberOf(perMemberMinutes.get(member.id)) / 60 > numberOf(member.capacity_hours_per_week)).length;
  const workloadById = new Map(workload.map((item) => [item.team_member_id, item]));
  const priorityRows = [...filteredMembers].sort((a, b) => (numberOf(perMemberMinutes.get(b.id)) / Math.max(1, numberOf(b.capacity_hours_per_week))) - (numberOf(perMemberMinutes.get(a.id)) / Math.max(1, numberOf(a.capacity_hours_per_week)))).slice(0, 5);

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <ResourcesPageHeader title="Carichi e disponibilità" description="Distribuisci ore e attività senza sovraccaricare il team." ctaLabel="Pianifica attività" ctaHref="/projects/tasks" canCreate={canView("projects") && canCreate("projects")} />
    <ResourcesError message={error} />
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4"><div className="flex flex-wrap items-center gap-2">
      <Button variant="outline" size="icon" onClick={() => setAnchor((current) => { const next = new Date(current); next.setDate(next.getDate() - 7); return next; })}><ChevronLeft className="h-4 w-4" /></Button>
      <Button variant="outline" size="icon" onClick={() => setAnchor((current) => { const next = new Date(current); next.setDate(next.getDate() + 7); return next; })}><ChevronRight className="h-4 w-4" /></Button>
      <div className="mr-auto flex h-10 items-center gap-2 px-2 text-sm font-semibold text-slate-800"><CalendarDays className="h-4 w-4 text-indigo-600" />{dateLabel(from)} – {dateLabel(to)}</div>
      <Button variant="outline" onClick={() => setAnchor(new Date())}>Oggi</Button>
      <Select value={memberFilter} onValueChange={setMemberFilter}><SelectTrigger className="w-[190px]"><SelectValue placeholder="Team" /></SelectTrigger><SelectContent><SelectItem value="all">Tutto il team</SelectItem>{members.map((member) => <SelectItem key={member.id} value={member.id}>{member.display_name}</SelectItem>)}</SelectContent></Select>
      {canView("projects") ? <Select value={projectFilter} onValueChange={setProjectFilter}><SelectTrigger className="w-[190px]"><SelectValue placeholder="Progetti" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i progetti</SelectItem>{projectOptions.map(([id, name]) => <SelectItem key={id} value={id}>{name}</SelectItem>)}</SelectContent></Select> : null}
    </div></div>
    {loading ? <ResourcesLoading /> : <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <ResourcesKpi icon={Gauge} label="Capacità totale" value={`${totalCapacity}h`} hint="Somma delle capacità settimanali configurate" />
        <ResourcesKpi icon={Clock3} label="Ore pianificate" value={hours(plannedMinutes)} hint="Solo time entry con stato Pianificata" tone="blue" />
        <ResourcesKpi icon={SlidersHorizontal} label="Disponibili" value={`${Math.max(0, Math.round((totalCapacity - totalMinutes / 60) * 10) / 10)}h`} hint={`${hours(totalMinutes)} registrate nel periodo`} tone="green" />
        <ResourcesKpi icon={AlertTriangle} label="Sovraccarichi" value={overloaded} hint="Ore del periodo oltre la capacità" tone="red" />
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_330px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white"><div className="border-b border-slate-200 px-5 py-4"><h2 className="font-semibold text-slate-950">Pianificazione settimanale</h2><p className="mt-1 text-xs text-slate-500">I blocchi rappresentano esclusivamente time entry reali del periodo.</p></div><div className="overflow-x-auto"><div className="min-w-[900px]"><div className="grid grid-cols-[220px_repeat(5,minmax(130px,1fr))] border-b border-slate-200 bg-slate-50/70"><div className="p-4 text-xs font-semibold uppercase tracking-wide text-slate-500">Persona</div>{days.map((day) => <div key={localIso(day)} className={`border-l border-slate-200 p-3 text-center ${localIso(day) === localIso(new Date()) ? "bg-violet-50" : ""}`}><p className="text-xs uppercase text-slate-500">{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(day)}</p><p className="mt-1 font-semibold text-slate-900">{day.getDate()}</p></div>)}</div>
          {filteredMembers.map((member) => { const capacity = numberOf(member.capacity_hours_per_week); const memberMinutes = numberOf(perMemberMinutes.get(member.id)); return <div key={member.id} className="grid min-h-28 grid-cols-[220px_repeat(5,minmax(130px,1fr))] border-b border-slate-100 last:border-0"><div className="p-4"><div className="flex items-center gap-3"><InitialsAvatar name={member.display_name} /><div className="min-w-0"><p className="truncate text-sm font-semibold text-slate-900">{member.display_name}</p><p className="truncate text-xs text-slate-500">{roleLabel(member)}</p></div></div><p className="mt-3 text-xs text-slate-500">{hours(memberMinutes)} / {capacity || "—"}h</p></div>{days.map((day) => { const dayEntries = filteredEntries.filter((entry) => entry.team_member_id === member.id && entry.entry_date.slice(0, 10) === localIso(day)); const absent = availability.find((entry) => entry.team_member_id === member.id && entry.status !== "cancelled" && new Date(entry.starts_at) <= new Date(`${localIso(day)}T23:59:59`) && new Date(entry.ends_at) >= new Date(`${localIso(day)}T00:00:00`)); return <div key={localIso(day)} className="space-y-1.5 border-l border-slate-100 p-2">{absent ? <div className="rounded-lg border border-rose-100 bg-rose-50 px-2 py-1.5 text-[11px] font-medium text-rose-700">{absent.title || availabilityMeta(absent.type).label}</div> : null}{dayEntries.map((entry) => <div key={entry.id} className="rounded-lg border border-indigo-100 bg-indigo-50 px-2 py-1.5"><p className="truncate text-[11px] font-semibold text-indigo-800">{canView("projects") ? entry.task_title || entry.project_name || entry.description || "Attività" : entry.description || "Tempo registrato"}</p><p className="mt-0.5 text-[10px] text-indigo-600">{hours(entry.duration_minutes)} · {entry.status}</p></div>)}</div>; })}</div>; })}
          {!filteredMembers.length ? <ResourcesEmpty className="m-5">Nessun membro disponibile per i filtri scelti.</ResourcesEmpty> : null}
        </div></div></section>
        <div className="space-y-5"><ResourcesPanel title="Da riequilibrare">{priorityRows.length ? <div className="space-y-3">{priorityRows.map((member) => { const used = numberOf(perMemberMinutes.get(member.id)) / 60; const capacity = numberOf(member.capacity_hours_per_week); const ratio = capacity ? Math.round(used / capacity * 100) : numberOf(workloadById.get(member.id)?.utilizationPercent); return <div key={member.id} className="flex items-center gap-3"><InitialsAvatar name={member.display_name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{member.display_name}</p><p className="text-xs text-slate-500">{new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(used)}h / {capacity || "—"}h nel periodo</p></div><SoftBadge value={`${ratio}%`} tone={ratio >= 100 ? "red" : ratio >= 80 ? "orange" : "green"} /></div>; })}{canUpdate("team") ? <Link href="/team/time-entries" className="mt-2 flex h-10 items-center justify-center rounded-xl border border-slate-200 text-sm font-semibold text-indigo-600 hover:bg-slate-50">Gestisci registrazioni</Link> : null}</div> : <ResourcesEmpty>Nessun dato da riequilibrare.</ResourcesEmpty>}</ResourcesPanel>
          <ResourcesPanel title="Assenze e disponibilità" actionHref="/team/availability" actionLabel="Gestisci">{availability.length ? <div className="space-y-3">{availability.slice(0, 5).map((entry) => <div key={entry.id} className="flex items-center gap-3"><InitialsAvatar name={entry.display_name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{entry.display_name}</p><p className="truncate text-xs text-slate-500">{entry.title || availabilityMeta(entry.type).label}</p></div><span className="text-xs text-slate-500">{dateLabel(entry.starts_at, { day: "2-digit", month: "short" })}</span></div>)}</div> : <ResourcesEmpty>Nessuna assenza nel periodo.</ResourcesEmpty>}</ResourcesPanel>
        </div>
      </div>
    </>}
  </main>;
}
