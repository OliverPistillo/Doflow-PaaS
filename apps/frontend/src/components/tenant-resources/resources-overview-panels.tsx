"use client";

import Link from "next/link";
import { Clock3, FileText, FolderOpen, LayoutTemplate } from "lucide-react";
import type { TeamAvailability, TeamMember, TeamWorkloadItem, TimeEntry } from "@/lib/tenant-team-api";
import { availabilityMeta, dateLabel, hours, numberOf, roleLabel, type KnowledgeRow } from "./resources-model";
import { InitialsAvatar, ResourcesEmpty, ResourcesPanel, SoftBadge } from "./resources-ui";

export function TeamLoadSummary({ rows, members }: { rows: TeamWorkloadItem[]; members: TeamMember[] }) {
  const byId = new Map(members.map((member) => [member.id, member]));
  return <ResourcesPanel title="Carico del team" actionHref="/team/workload" actionLabel="Gestisci carichi">
    {rows.length ? <div className="space-y-4">{rows.slice(0, 6).map((row) => {
      const load = Math.max(0, numberOf(row.utilizationPercent)); const member = byId.get(row.team_member_id);
      return <div key={row.team_member_id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3"><InitialsAvatar name={row.display_name} /><div className="min-w-0"><div className="flex items-center justify-between gap-2"><div className="truncate"><p className="truncate text-sm font-semibold text-slate-900">{row.display_name}</p><p className="truncate text-xs text-slate-500">{roleLabel(member)}</p></div><span className="text-sm font-semibold text-slate-700">{load}%</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${load >= 100 ? "bg-rose-500" : load >= 80 ? "bg-amber-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, load)}%` }} /></div></div><SoftBadge value={load >= 100 ? "Sovraccarico" : load >= 80 ? "Carico" : "Disponibile"} tone={load >= 100 ? "red" : load >= 80 ? "orange" : "green"} /></div>;
    })}</div> : <ResourcesEmpty>Il carico comparirà quando saranno disponibili capacità, ore o attività assegnate.</ResourcesEmpty>}
  </ResourcesPanel>;
}

export function TodayAvailability({ members, entries }: { members: TeamMember[]; entries: TeamAvailability[] }) {
  const entryByMember = new Map(entries.filter((entry) => entry.status !== "cancelled").map((entry) => [entry.team_member_id, entry]));
  const counts = members.reduce((result, member) => {
    const label = availabilityMeta(entryByMember.get(member.id)?.type || member.availability_status).label;
    if (label === "Disponibile") result.available += 1; else if (label === "Parziale") result.partial += 1; else if (["Assente", "In ferie", "Non disponibile"].includes(label)) result.absent += 1;
    return result;
  }, { available: 0, partial: 0, absent: 0 });
  return <ResourcesPanel title="Disponibilità di oggi" actionHref="/team/availability" actionLabel="Vedi disponibilità">
    {members.length ? <><div className="mb-3 grid grid-cols-3 gap-2">{[{ label: "Disponibili", value: counts.available }, { label: "Assenti", value: counts.absent }, { label: "Parziali", value: counts.partial }].map((item) => <div key={item.label} className="rounded-xl bg-slate-50 p-2.5 text-center"><p className="text-lg font-semibold text-slate-950">{item.value}</p><p className="text-[11px] text-slate-500">{item.label}</p></div>)}</div><div className="space-y-1">{members.slice(0, 6).map((member) => {
      const entry = entryByMember.get(member.id); const meta = availabilityMeta(entry?.type || member.availability_status);
      return <div key={member.id} className="flex items-center gap-3 rounded-xl px-1 py-2.5"><InitialsAvatar name={member.display_name} /><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{member.display_name}</p><p className="truncate text-xs text-slate-500">{entry?.title || roleLabel(member)}</p></div>{entry?.capacity_hours !== null && entry?.capacity_hours !== undefined ? <span className="text-xs text-slate-500">{numberOf(entry.capacity_hours)}h</span> : null}<SoftBadge value={meta.label} tone={meta.tone} /></div>;
    })}</div></> : <ResourcesEmpty>Nessuna disponibilità registrata per oggi.</ResourcesEmpty>}
  </ResourcesPanel>;
}

export function WeeklyHours({ entries }: { entries: TimeEntry[] }) {
  const today = new Date(); const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7)); monday.setHours(0, 0, 0, 0);
  const days = Array.from({ length: 5 }, (_, index) => { const date = new Date(monday); date.setDate(monday.getDate() + index); return date; });
  const data = days.map((day) => ({ label: new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(day), minutes: entries.filter((entry) => entry.entry_date.slice(0, 10) === day.toISOString().slice(0, 10)).reduce((sum, entry) => sum + numberOf(entry.duration_minutes), 0) }));
  const max = Math.max(...data.map((item) => item.minutes), 60);
  return <ResourcesPanel title="Ore lavorate" actionHref="/team/time-entries" actionLabel="Apri timesheet"><div className="flex h-52 items-end gap-3 border-b border-slate-200 px-2 pb-7">{data.map((item) => <div key={item.label} className="flex h-full flex-1 flex-col items-center justify-end gap-2"><span className="text-xs font-medium text-slate-500">{item.minutes ? hours(item.minutes) : ""}</span><div className="w-full max-w-12 rounded-t-lg bg-indigo-500" style={{ height: `${Math.max(item.minutes ? 8 : 2, (item.minutes / max) * 135)}px` }} /><span className="absolute mt-[205px] text-xs capitalize text-slate-500">{item.label}</span></div>)}</div><div className="mt-4 flex items-center gap-2 text-xs text-slate-500"><Clock3 className="h-4 w-4 text-indigo-500" />Serie reale delle ore registrate; il pianificato giornaliero non è disponibile.</div></ResourcesPanel>;
}

export function RecentKnowledge({ rows, members }: { rows: KnowledgeRow[]; members: TeamMember[] }) {
  const memberByUser = new Map(members.filter((member) => member.user_id).map((member) => [member.user_id!, member])); const icons = { article: FileText, asset: FolderOpen, template: LayoutTemplate };
  return <ResourcesPanel title="Knowledge recenti" actionHref="/knowledge" actionLabel="Vedi tutte">{rows.length ? <div className="space-y-1">{rows.slice(0, 5).map((row) => {
    const Icon = icons[row.kind]; const author = row.ownerUserId ? memberByUser.get(row.ownerUserId) : undefined;
    return <Link key={`${row.kind}:${row.id}`} href={row.href} className="flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-slate-50"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-slate-900">{row.title}</p><p className="truncate text-xs text-slate-500">{author?.display_name || row.category} · {dateLabel(row.updatedAt)}</p></div><SoftBadge value={row.kind === "article" ? "Guida" : row.kind === "asset" ? "Asset" : "Template"} tone="violet" /></Link>;
  })}</div> : <ResourcesEmpty>Le risorse aggiornate di recente appariranno qui.</ResourcesEmpty>}</ResourcesPanel>;
}
