"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { BriefcaseBusiness, Gauge, Search, Sparkles, UserRound, UsersRound, X } from "lucide-react";
import { useTenantAccess } from "@/contexts/TenantAccessContext";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { teamApi, type TeamMember, type TeamWorkloadItem } from "@/lib/tenant-team-api";
import { availabilityMeta, numberOf, roleLabel } from "./resources-model";
import { InitialsAvatar, ResourcesEmpty, ResourcesError, ResourcesKpi, ResourcesLoading, ResourcesPageHeader, SoftBadge } from "./resources-ui";

function TeamProfilePanel({ member, workload, onClose }: { member: TeamMember | null; workload?: TeamWorkloadItem; onClose: () => void }) {
  if (!member) return <aside className="rounded-2xl border border-slate-200/80 bg-white p-5"><ResourcesEmpty className="min-h-64">Seleziona una persona per vedere il profilo operativo.</ResourcesEmpty></aside>;
  const availability = availabilityMeta(member.availability_status);
  const capacity = numberOf(member.capacity_hours_per_week);
  const logged = numberOf(workload?.loggedMinutesThisWeek) / 60;
  return <aside className="rounded-2xl border border-slate-200/80 bg-white p-5">
    <div className="flex items-start justify-between"><div className="flex items-center gap-3"><InitialsAvatar name={member.display_name} className="h-12 w-12 text-sm" /><div><h2 className="font-semibold text-slate-950">{member.display_name}</h2><p className="text-sm text-slate-500">{roleLabel(member)}</p></div></div><button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Chiudi dettaglio"><X className="h-4 w-4" /></button></div>
    <div className="mt-5 space-y-4 border-t border-slate-100 pt-5">
      <div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Contatti</p><p className="mt-1 text-sm text-slate-700">{member.email}</p>{member.phone ? <p className="text-sm text-slate-700">{member.phone}</p> : null}</div>
      <div className="flex items-center justify-between"><span className="text-sm text-slate-500">Disponibilità</span><SoftBadge value={availability.label} tone={availability.tone} /></div>
      {member.skill_items?.length || member.skills?.length ? <div><p className="text-xs font-medium uppercase tracking-wide text-slate-400">Competenze</p><div className="mt-2 flex flex-wrap gap-1.5">{(member.skill_items?.map((skill) => skill.name) || member.skills || []).slice(0, 8).map((skill) => <SoftBadge key={skill} value={skill} tone="violet" />)}</div></div> : null}
      <div className="grid grid-cols-2 gap-3"><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Progetti attivi</p><p className="mt-1 text-xl font-semibold text-slate-950">{workload?.activeProjects ?? "—"}</p></div><div className="rounded-xl bg-slate-50 p-3"><p className="text-xs text-slate-500">Attività aperte</p><p className="mt-1 text-xl font-semibold text-slate-950">{workload?.openTasks ?? "—"}</p></div></div>
      {capacity ? <div><div className="flex justify-between text-sm"><span className="text-slate-500">Capacità / registrate</span><span className="font-semibold text-slate-800">{capacity}h / {new Intl.NumberFormat("it-IT", { maximumFractionDigits: 1 }).format(logged)}h</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-indigo-500" style={{ width: `${Math.min(100, numberOf(workload?.utilizationPercent))}%` }} /></div></div> : null}
      <Link href={`/team/members/${member.id}`} className="flex h-10 items-center justify-center rounded-xl bg-indigo-600 text-sm font-semibold text-white hover:bg-indigo-700">Apri profilo</Link>
    </div>
  </aside>;
}

export function TeamWorkspace() {
  const { canView, canCreate } = useTenantAccess();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [workload, setWorkload] = useState<TeamWorkloadItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [search, setSearch] = useState(""); const [role, setRole] = useState("all"); const [availability, setAvailability] = useState("all");
  const [loading, setLoading] = useState(true); const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true; if (!canView("team")) { setLoading(false); return; }
    Promise.all([teamApi.members({ limit: 100 }), teamApi.workload({ limit: 100 })]).then(([memberData, workloadData]) => {
      if (!active) return; setMembers(memberData.items || []); setWorkload(workloadData.items || []); setSelectedId(memberData.items?.[0]?.id || null);
    }).catch((reason) => active && setError(reason instanceof Error ? reason.message : "Caricamento del team non riuscito.")).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [canView]);

  const workloadById = useMemo(() => new Map(workload.map((item) => [item.team_member_id, item])), [workload]);
  const roles = useMemo(() => Array.from(new Set(members.map((member) => roleLabel(member)))).sort(), [members]);
  const visible = useMemo(() => members.filter((member) => {
    const text = `${member.display_name} ${member.email} ${roleLabel(member)}`.toLowerCase();
    return (!search || text.includes(search.toLowerCase())) && (role === "all" || roleLabel(member) === role) && (availability === "all" || member.status === availability);
  }), [members, search, role, availability]);
  const selected = members.find((member) => member.id === selectedId) || null;
  const collaborators = members.filter((member) => ["contractor", "external"].includes(String(member.employment_type))).length;
  const skillCount = new Set(members.flatMap((member) => member.skill_items?.map((skill) => skill.id) || member.skills || [])).size;
  const projectCount = workload.reduce((sum, item) => sum + numberOf(item.activeProjects), 0);

  return <main className="space-y-5 px-4 py-6 sm:px-6 lg:px-8">
    <ResourcesPageHeader title="Team" description="Persone, ruoli e competenze sempre aggiornati." ctaLabel="Aggiungi membro" ctaHref="/team/members" canCreate={canCreate("team")} />
    <ResourcesError message={error} />
    {loading ? <ResourcesLoading /> : <>
      <div className="rounded-2xl border border-slate-200/80 bg-white p-4"><div className="grid gap-3 md:grid-cols-[minmax(260px,1fr)_220px_220px]"><div className="relative"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca nome, ruolo o competenza..." className="pl-9" /></div><Select value={role} onValueChange={setRole}><SelectTrigger><SelectValue placeholder="Ruolo" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i ruoli</SelectItem>{roles.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={availability} onValueChange={setAvailability}><SelectTrigger><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem><SelectItem value="active">Attivo</SelectItem><SelectItem value="invited">Invitato</SelectItem><SelectItem value="inactive">Inattivo</SelectItem><SelectItem value="suspended">Sospeso</SelectItem></SelectContent></Select></div></div>
      <div className="grid gap-4 sm:grid-cols-3">
        <ResourcesKpi icon={UsersRound} label="Membri attivi" value={members.filter((member) => member.status === "active").length} hint={`${members.length} profili complessivi`} />
        <ResourcesKpi icon={UserRound} label="Collaboratori" value={collaborators} hint="Contractor ed esterni registrati" tone="blue" />
        <ResourcesKpi icon={Sparkles} label="Competenze coperte" value={skillCount} hint={`${projectCount} assegnazioni a progetti attivi`} tone="green" />
      </div>
      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-white"><div className="overflow-x-auto"><table className="w-full min-w-[1020px] text-left text-sm"><thead className="border-b border-slate-200 bg-slate-50/80 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-4">Persona</th><th className="px-4 py-4">Ruolo</th><th className="px-4 py-4">Competenze</th><th className="px-4 py-4">Progetti</th><th className="px-4 py-4">Disponibilità</th><th className="px-4 py-4">Ore settimana / carico</th><th className="px-4 py-4">Azioni</th></tr></thead><tbody className="divide-y divide-slate-100">
          {visible.map((member) => { const load = workloadById.get(member.id); const meta = availabilityMeta(member.availability_status); const loadValue = numberOf(load?.utilizationPercent); return <tr key={member.id} onClick={() => setSelectedId(member.id)} className={`cursor-pointer ${selectedId === member.id ? "bg-violet-50/70" : "hover:bg-slate-50/70"}`}><td className="px-5 py-4"><div className="flex items-center gap-3"><InitialsAvatar name={member.display_name} /><div><p className="font-semibold text-slate-900">{member.display_name}</p><p className="text-xs text-slate-500">{member.email}</p></div></div></td><td className="px-4 py-4 text-slate-700">{roleLabel(member)}</td><td className="px-4 py-4"><div className="flex max-w-48 flex-wrap gap-1">{(member.skill_items?.map((skill) => skill.name) || member.skills || []).slice(0, 2).map((skill) => <SoftBadge key={skill} value={skill} tone="violet" />)}{(member.skill_items?.length || member.skills?.length || 0) > 2 ? <span className="text-xs text-slate-500">+{(member.skill_items?.length || member.skills?.length || 0) - 2}</span> : null}</div></td><td className="px-4 py-4"><span className="inline-flex items-center gap-1.5 text-slate-700"><BriefcaseBusiness className="h-4 w-4 text-slate-400" />{load?.activeProjects ?? 0}</span></td><td className="px-4 py-4"><SoftBadge value={meta.label} tone={meta.tone} /></td><td className="px-4 py-4"><div className="w-32"><div className="flex justify-between text-xs"><span>{load ? `${Math.round(numberOf(load.loggedMinutesThisWeek) / 60)}h` : "—"}</span><span className="font-semibold">{load ? `${loadValue}%` : "—"}</span></div><div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-slate-100"><div className={`h-full rounded-full ${loadValue >= 100 ? "bg-rose-500" : "bg-indigo-500"}`} style={{ width: `${Math.min(100, loadValue)}%` }} /></div></div></td><td className="px-4 py-4"><Link href={`/team/members/${member.id}`} onClick={(event) => event.stopPropagation()} className="font-medium text-indigo-600 hover:text-indigo-700">Apri</Link></td></tr>; })}
        </tbody></table>{!visible.length ? <ResourcesEmpty className="m-5">Nessuna persona corrisponde ai filtri.</ResourcesEmpty> : null}</div></section>
        <TeamProfilePanel member={selected} workload={selected ? workloadById.get(selected.id) : undefined} onClose={() => setSelectedId(null)} />
      </div>
    </>}
  </main>;
}
