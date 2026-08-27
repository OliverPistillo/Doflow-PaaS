"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, FolderKanban, RotateCcw, Users } from "lucide-react"

import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import type { CommercialProject, CustomerActivity } from "@/features/commercial/components/commercial-leads-provider"
import type { DoflowIdentityUser } from "@/features/identity/doflow-identity-provider"
import { roleLabels, type DoflowRole } from "@/features/identity/permissions"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { addRomeDays, formatItalianDate, getRomeDateKey, parseSafeDate } from "@/lib/date"

type Period = "this-week" | "next-week" | "month" | "custom"
type WorkStatus = "all" | "open" | "todo" | "progress" | "blocked" | "overdue" | "completed"
type Sort = "load-desc" | "load-asc" | "deadline" | "name"
type Group = "collaborator" | "project"
type DetailFilter = "all" | "todo" | "progress" | "blocked" | "overdue"
type ActivityRow = ReturnType<typeof useAuthorizedCommercial>["activities"][number]

const closedStatuses: CustomerActivity["status"][] = ["Completata", "Annullata"]

function weekStart(today: string) {
  const date = parseSafeDate(today)
  return addRomeDays(today, -(date.getDay() === 0 ? 6 : date.getDay() - 1))
}

function monthEnd(today: string) {
  const [year, month] = today.split("-").map(Number)
  return getRomeDateKey(new Date(year, month, 0))
}

function workingDays(start: string, end: string) {
  let cursor = start
  let count = 0
  while (cursor && cursor <= end && count < 370) {
    const day = parseSafeDate(cursor).getDay()
    if (day !== 0 && day !== 6) count += 1
    cursor = addRomeDays(cursor, 1)
  }
  return count
}

function hours(minutes: number) {
  const value = Math.round(minutes / 6) / 10
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} h`
}

function sessionMinutes(startedAt: string, endedAt?: string, durationMinutes?: number) {
  if (typeof durationMinutes === "number" && Number.isFinite(durationMinutes)) return Math.max(0, durationMinutes)
  const start = new Date(startedAt).getTime()
  const end = endedAt ? new Date(endedAt).getTime() : Date.now()
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 60_000)) : 0
}

function activityEstimate(activity: CustomerActivity, project: CommercialProject | undefined, projectActivities: CustomerActivity[]) {
  if (typeof activity.estimatedMinutes === "number" && activity.estimatedMinutes > 0) return activity.estimatedMinutes
  const phase = project?.phases.find((item) => item.id === activity.phaseId)
  if (!phase?.estimatedMinutes) return 0
  const peers = projectActivities.filter((item) => item.phaseId === phase.id && !item.archivedAt && !closedStatuses.includes(item.status))
  return Math.round(phase.estimatedMinutes / Math.max(1, peers.length))
}

function statusMatches(activity: CustomerActivity, status: WorkStatus, today: string) {
  const overdue = Boolean(activity.dueDate && activity.dueDate < today && !closedStatuses.includes(activity.status))
  if (status === "all") return true
  if (status === "open") return !closedStatuses.includes(activity.status)
  if (status === "todo") return activity.status === "Da fare"
  if (status === "progress") return activity.status === "In corso"
  if (status === "blocked") return activity.status === "Bloccata"
  if (status === "overdue") return overdue
  return activity.status === "Completata"
}

export function TeamWorkloadView() {
  const { identity, projects, activities, store } = useAuthorizedCommercial()
  const today = getRomeDateKey(new Date())
  const thisWeekStart = weekStart(today)
  const [period, setPeriod] = useState<Period>("this-week")
  const [customStart, setCustomStart] = useState(thisWeekStart)
  const [customEnd, setCustomEnd] = useState(addRomeDays(thisWeekStart, 6))
  const [collaboratorId, setCollaboratorId] = useState("all")
  const [role, setRole] = useState("all")
  const [projectId, setProjectId] = useState("all")
  const [status, setStatus] = useState<WorkStatus>("all")
  const [sort, setSort] = useState<Sort>("load-desc")
  const [group, setGroup] = useState<Group>("collaborator")
  const [selectedUserId, setSelectedUserId] = useState<string>()
  const [detailFilter, setDetailFilter] = useState<DetailFilter>("all")

  const range = useMemo(() => {
    if (period === "custom" && customStart && customEnd && customStart <= customEnd) return { start: customStart, end: customEnd }
    if (period === "next-week") { const start = addRomeDays(thisWeekStart, 7); return { start, end: addRomeDays(start, 6) } }
    if (period === "month") return { start: `${today.slice(0, 7)}-01`, end: monthEnd(today) }
    return { start: thisWeekStart, end: addRomeDays(thisWeekStart, 6) }
  }, [customEnd, customStart, period, thisWeekStart, today])

  const uniqueActivities = useMemo(() => Array.from(new Map(activities.map((row) => [row.activity.id, row])).values()), [activities])
  const projectIds = useMemo(() => new Set(projects.map((project) => project.id)), [projects])
  const visiblePeopleIds = useMemo(() => {
    const ids = new Set<string>([identity.currentUserId])
    projects.forEach((project) => { ids.add(project.ownerId); project.memberIds.forEach((id) => ids.add(id)); project.supervisorIds?.forEach((id) => ids.add(id)) })
    uniqueActivities.forEach(({ activity }) => { ids.add(activity.assigneeId); activity.collaboratorIds.forEach((id) => ids.add(id)) })
    return ids
  }, [identity.currentUserId, projects, uniqueActivities])
  const canSeeTeam = identity.currentUser.roles.includes("administrator") || identity.currentUser.roles.includes("project_manager") || identity.hasCapability("canApproveProjectWork")
  const canSeeShared = canSeeTeam || identity.currentUser.roles.includes("web_developer")
  const authorizedUsers = identity.users.filter((user) => identity.currentUser.roles.includes("administrator") || user.id === identity.currentUserId || canSeeShared && visiblePeopleIds.has(user.id))
  const roleOptions = Array.from(new Set(authorizedUsers.flatMap((user) => user.roles)))

  const periodActivities = uniqueActivities.filter(({ activity }) => {
    if (activity.archivedAt) return false
    if (projectId !== "all" && activity.projectId !== projectId) return false
    if (activity.projectId && !projectIds.has(activity.projectId)) return false
    const relevantDate = activity.status === "Completata" ? activity.completedAt?.slice(0, 10) : activity.dueDate
    const overdueBacklog = period === "this-week" && Boolean(activity.dueDate && activity.dueDate < today && !closedStatuses.includes(activity.status))
    return overdueBacklog || Boolean(relevantDate && relevantDate >= range.start && relevantDate <= range.end)
  })
  const filteredActivities = periodActivities.filter(({ activity }) => statusMatches(activity, status, today))
  const capacityDays = workingDays(range.start, range.end)

  const baseRows = authorizedUsers.map((user) => {
    const assignedAll = periodActivities.filter(({ activity }) => activity.assigneeId === user.id)
    const assigned = filteredActivities.filter(({ activity }) => activity.assigneeId === user.id)
    const open = assigned.filter(({ activity }) => !closedStatuses.includes(activity.status))
    const estimatedMinutes = open.reduce((sum, { activity }) => {
      const project = projects.find((item) => item.id === activity.projectId)
      return sum + activityEstimate(activity, project, uniqueActivities.filter((row) => row.activity.projectId === project?.id).map((row) => row.activity))
    }, 0)
    const recordedMinutes = store.timeSessions.filter((session) => !session.archivedAt && session.userId === user.id && Boolean(session.projectId && projectIds.has(session.projectId)) && getRomeDateKey(session.startedAt) >= range.start && getRomeDateKey(session.startedAt) <= range.end).reduce((sum, session) => sum + sessionMinutes(session.startedAt, session.endedAt, session.durationMinutes), 0)
    const weeklyCapacityHours = user.weeklyCapacityHours ?? 40
    const capacityMinutes = weeklyCapacityHours * 60 * capacityDays / 5
    const saturation = capacityMinutes ? Math.round(estimatedMinutes / capacityMinutes * 100) : 0
    const userProjectIds = new Set(projects.filter((project) => project.ownerId === user.id || project.memberIds.includes(user.id) || project.supervisorIds?.includes(user.id) || assignedAll.some(({ activity }) => activity.projectId === project.id)).map((project) => project.id))
    const dueDates = assignedAll.filter(({ activity }) => !closedStatuses.includes(activity.status) && activity.dueDate).map(({ activity }) => activity.dueDate).sort()
    const counts = {
      todo: assignedAll.filter(({ activity }) => activity.status === "Da fare").length,
      progress: assignedAll.filter(({ activity }) => activity.status === "In corso").length,
      blocked: assignedAll.filter(({ activity }) => activity.status === "Bloccata").length,
      overdue: assignedAll.filter(({ activity }) => activity.dueDate < today && !closedStatuses.includes(activity.status)).length,
      completed: assignedAll.filter(({ activity }) => activity.status === "Completata").length,
    }
    return { user, assignedAll, assigned, estimatedMinutes, recordedMinutes, weeklyCapacityHours, capacityMinutes, saturation, remainingMinutes: capacityMinutes - estimatedMinutes, projectIds: userProjectIds, nextDueDate: dueDates[0], counts }
  })

  const rows = baseRows.filter((row) => collaboratorId === "all" || row.user.id === collaboratorId).filter((row) => role === "all" || row.user.roles.includes(role as DoflowRole)).filter((row) => projectId === "all" || row.projectIds.has(projectId)).sort((left, right) => sort === "load-asc" ? left.saturation - right.saturation : sort === "deadline" ? (left.nextDueDate ?? "9999").localeCompare(right.nextDueDate ?? "9999") : sort === "name" ? left.user.name.localeCompare(right.user.name, "it") : right.saturation - left.saturation)
  const selected = baseRows.find((row) => row.user.id === selectedUserId)
  const detailActivities = selected?.assignedAll.filter(({ activity }) => detailFilter === "all" || statusMatches(activity, detailFilter, today)) ?? []
  const reset = () => { setPeriod("this-week"); setCustomStart(thisWeekStart); setCustomEnd(addRomeDays(thisWeekStart, 6)); setCollaboratorId("all"); setRole("all"); setProjectId("all"); setStatus("all"); setSort("load-desc"); setGroup("collaborator") }

  return <div className="space-y-4">
    <Card><CardHeader className="pb-3"><CardTitle className="text-base">Carico del team</CardTitle><CardDescription>{formatItalianDate(range.start)} – {formatItalianDate(range.end)} · attività e timer nel solo perimetro autorizzato.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
      <Select value={period} onValueChange={(value) => setPeriod(value as Period)}><SelectTrigger aria-label="Periodo carico"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="this-week">Questa settimana</SelectItem><SelectItem value="next-week">Prossima settimana</SelectItem><SelectItem value="month">Questo mese</SelectItem><SelectItem value="custom">Personalizzato</SelectItem></SelectContent></Select>
      <Select value={collaboratorId} onValueChange={setCollaboratorId}><SelectTrigger aria-label="Collaboratore carico"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i collaboratori</SelectItem>{authorizedUsers.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select>
      <Select value={role} onValueChange={setRole}><SelectTrigger aria-label="Ruolo carico"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i ruoli</SelectItem>{roleOptions.map((item) => <SelectItem key={item} value={item}>{roleLabels[item]}</SelectItem>)}</SelectContent></Select>
      <Select value={projectId} onValueChange={setProjectId}><SelectTrigger aria-label="Progetto carico"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i progetti</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={(value) => setStatus(value as WorkStatus)}><SelectTrigger aria-label="Stato carico"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem><SelectItem value="open">Solo aperte</SelectItem><SelectItem value="todo">Da fare</SelectItem><SelectItem value="progress">In corso</SelectItem><SelectItem value="blocked">Bloccate</SelectItem><SelectItem value="overdue">Scadute</SelectItem><SelectItem value="completed">Completate</SelectItem></SelectContent></Select>
      <Select value={sort} onValueChange={(value) => setSort(value as Sort)}><SelectTrigger aria-label="Ordina carico"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="load-desc">Carico maggiore</SelectItem><SelectItem value="load-asc">Carico minore</SelectItem><SelectItem value="deadline">Prossima scadenza</SelectItem><SelectItem value="name">Nome A–Z</SelectItem></SelectContent></Select>
    </div>{period === "custom" && <div className="grid gap-2 sm:grid-cols-2"><Label>Dal<Input type="date" value={customStart} max={customEnd} onChange={(event) => setCustomStart(event.target.value)} /></Label><Label>Al<Input type="date" value={customEnd} min={customStart} onChange={(event) => setCustomEnd(event.target.value)} /></Label></div>}<div className="flex flex-wrap items-center justify-between gap-2"><Select value={group} onValueChange={(value) => setGroup(value as Group)}><SelectTrigger className="w-56" aria-label="Raggruppa carico"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="collaborator">Per collaboratore</SelectItem><SelectItem value="project">Per progetto</SelectItem></SelectContent></Select><Button variant="ghost" size="sm" onClick={reset}><RotateCcw />Azzera filtri</Button></div></CardContent></Card>
    {group === "collaborator" ? <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">{rows.map((row) => <WorkloadCard key={row.user.id} row={row} onOpen={() => { setSelectedUserId(row.user.id); setDetailFilter("all") }} />)}</div> : <ProjectGroups projects={projectId === "all" ? projects : projects.filter((project) => project.id === projectId)} activities={filteredActivities.filter(({ activity }) => collaboratorId === "all" || activity.assigneeId === collaboratorId).filter(({ activity }) => role === "all" || authorizedUsers.find((user) => user.id === activity.assigneeId)?.roles.includes(role as DoflowRole))} users={authorizedUsers} today={today} sort={sort} />}
    {group === "collaborator" && !rows.length && <EmptyWorkload title="Nessun collaboratore corrispondente" detail="Modifica i filtri: nessun nome o dato esterno al tuo perimetro è stato caricato." />}
    {group === "project" && !projects.length && <EmptyWorkload title="Nessun progetto assegnato" detail="Non risultano progetti visibili per l’account e il periodo selezionati." />}
    <Sheet open={Boolean(selected)} onOpenChange={(open) => { if (!open) setSelectedUserId(undefined) }}><SheetContent className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]"><SheetHeader className="shrink-0 border-b px-5 py-4 text-left"><div className="flex min-w-0 items-center gap-3 pr-9">{selected && <UserAvatar userId={selected.user.id} name={selected.user.name} className="size-10" />}<div className="min-w-0"><SheetTitle className="truncate">{selected?.user.name}</SheetTitle><SheetDescription>{selected?.user.roles.map((item) => roleLabels[item]).join(" · ")}</SheetDescription></div></div></SheetHeader>{selected && <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4"><div className="grid grid-cols-2 gap-2"><Metric label="Ore stimate" value={hours(selected.estimatedMinutes)} /><Metric label="Ore registrate" value={hours(selected.recordedMinutes)} /><Metric label="Capacità periodo" value={hours(selected.capacityMinutes)} /><Metric label="Ore residue" value={hours(selected.remainingMinutes)} /></div>{(selected.user.id === identity.currentUserId || identity.currentUser.roles.includes("administrator")) && <Label>Capacità settimanale (ore)<Input key={`${selected.user.id}-${selected.weeklyCapacityHours}`} className="mt-1" type="number" min="1" max="168" step="0.5" defaultValue={selected.weeklyCapacityHours} aria-label={`Capacità settimanale ${selected.user.name}`} onBlur={(event) => identity.updateUserWeeklyCapacity(selected.user.id, Number(event.target.value))} /></Label>}<div><div className="mb-1 flex items-center justify-between gap-2 text-sm"><span>Saturazione</span><strong>{selected.saturation}%</strong></div><Progress value={Math.min(100, selected.saturation)} /></div><div className="grid grid-cols-2 gap-2">{([['todo','Da fare',selected.counts.todo],['progress','In corso',selected.counts.progress],['blocked','Bloccate',selected.counts.blocked],['overdue','Scadute',selected.counts.overdue]] as const).map(([id, label, value]) => <Button key={id} variant={detailFilter === id ? "default" : "outline"} aria-pressed={detailFilter === id} className="h-auto justify-between py-2" onClick={() => setDetailFilter((current) => current === id ? "all" : id)}><span>{label}</span><Badge variant="secondary">{value}</Badge></Button>)}</div><section><h3 className="mb-2 font-medium">Attività nel periodo</h3><div className="space-y-2">{detailActivities.map(({ activity }) => <ActivityItem key={activity.id} activity={activity} project={projects.find((item) => item.id === activity.projectId)} today={today} />)}{!detailActivities.length && <p className="rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground">Nessuna attività per il filtro selezionato.</p>}</div></section><section><h3 className="mb-2 font-medium">Progetti assegnati</h3><div className="space-y-2">{projects.filter((project) => selected.projectIds.has(project.id)).map((project) => <Button key={project.id} asChild variant="outline" className="h-auto w-full justify-start py-2"><Link href={`/dashboard/progetti/${project.id}`}><FolderKanban /><span className="min-w-0 truncate">{project.name}</span></Link></Button>)}</div></section></div>}</SheetContent></Sheet>
  </div>
}

type WorkloadRow = {
  user: DoflowIdentityUser; estimatedMinutes: number; recordedMinutes: number; weeklyCapacityHours: number; capacityMinutes: number; saturation: number; remainingMinutes: number; projectIds: Set<string>; nextDueDate?: string; counts: { todo: number; progress: number; blocked: number; overdue: number; completed: number }
}

function WorkloadCard({ row, onOpen }: { row: WorkloadRow; onOpen: () => void }) {
  const tone = row.estimatedMinutes === 0 ? "bg-muted" : row.saturation < 75 ? "bg-emerald-500" : row.saturation < 100 ? "bg-amber-500" : "bg-red-500"
  return <Card role="button" tabIndex={0} aria-label={`Apri carico di ${row.user.name}`} onClick={onOpen} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onOpen() } }} className="cursor-pointer transition-colors hover:bg-muted/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><CardHeader className="pb-3"><div className="flex min-w-0 items-center gap-3"><UserAvatar userId={row.user.id} name={row.user.name} className="size-10" /><div className="min-w-0 flex-1"><CardTitle className="truncate text-base">{row.user.name}</CardTitle><CardDescription className="truncate">{row.user.roles.map((item) => roleLabels[item]).join(" · ")}</CardDescription></div><Badge variant="outline">{row.saturation}%</Badge></div></CardHeader><CardContent className="space-y-3"><div><div className="mb-1 flex items-center justify-between gap-2 text-sm"><span>{hours(row.estimatedMinutes)} / {hours(row.capacityMinutes)}</span><span className="text-xs text-muted-foreground">{hours(row.remainingMinutes)} residue</span></div><div className="h-2 overflow-hidden rounded-full bg-muted"><div className={`h-full rounded-full ${tone}`} style={{ width: `${Math.min(100, row.saturation)}%` }} /></div></div><div className="grid grid-cols-2 gap-2 text-xs"><Metric label="Timer" value={hours(row.recordedMinutes)} /><Metric label="Progetti" value={String(row.projectIds.size)} /><Metric label="Da fare" value={String(row.counts.todo)} /><Metric label="In corso" value={String(row.counts.progress)} /><Metric label="Bloccate" value={String(row.counts.blocked)} /><Metric label="Scadute" value={String(row.counts.overdue)} /><Metric label="Completate" value={String(row.counts.completed)} /></div><div className="flex items-end justify-between gap-3"><div className="min-w-0"><p className="text-xs text-muted-foreground">Prossima scadenza</p><p className="truncate text-sm font-medium">{row.nextDueDate ? formatItalianDate(row.nextDueDate) : "Nessuna"}</p></div><p className="shrink-0 text-xs text-muted-foreground">Capacità: <strong className="text-foreground">{row.weeklyCapacityHours} h/sett.</strong></p></div>{row.counts.blocked > 0 && <p className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400"><AlertTriangle className="size-3.5" />{row.counts.blocked} blocchi attivi</p>}</CardContent></Card>
}

function ProjectGroups({ projects, activities, users, today, sort }: { projects: CommercialProject[]; activities: ActivityRow[]; users: DoflowIdentityUser[]; today: string; sort: Sort }) {
  const visible = projects.map((project) => { const rows = activities.filter(({ activity }) => activity.projectId === project.id); const open = rows.filter(({ activity }) => !closedStatuses.includes(activity.status)); const estimated = open.reduce((sum, { activity }) => sum + activityEstimate(activity, project, rows.map((row) => row.activity)), 0); const people = Array.from(new Set(rows.map(({ activity }) => activity.assigneeId))).map((id) => users.find((user) => user.id === id)).filter((user): user is DoflowIdentityUser => Boolean(user)); const nextDueDate = open.map(({ activity }) => activity.dueDate).filter(Boolean).sort()[0]; return { project, rows, open, estimated, people, nextDueDate, overdue: open.filter(({ activity }) => activity.dueDate < today).length } }).filter(({ rows }) => rows.length).sort((left, right) => sort === "load-asc" ? left.estimated - right.estimated : sort === "deadline" ? (left.nextDueDate ?? "9999").localeCompare(right.nextDueDate ?? "9999") : sort === "name" ? left.project.name.localeCompare(right.project.name, "it") : right.estimated - left.estimated)
  if (!visible.length) return <EmptyWorkload title="Nessun carico per progetto" detail="I progetti autorizzati non contengono attività nel periodo e nei filtri selezionati." />
  return <div className="grid items-start gap-3 md:grid-cols-2 xl:grid-cols-3">{visible.map(({ project, open, estimated, people, overdue }) => <Card key={project.id}><CardHeader><div className="flex items-start justify-between gap-2"><FolderKanban className="size-5 text-muted-foreground" /><Badge variant="secondary">{open.length} aperte</Badge></div><CardTitle className="truncate text-base">{project.name}</CardTitle><CardDescription>{people.map((user) => user.name).join(" · ") || "Nessun assegnatario nel periodo"}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p className="text-2xl font-semibold">{hours(estimated)}</p><p className="text-muted-foreground">Stima aperta nel periodo</p>{overdue > 0 && <p className="text-red-600 dark:text-red-400">{overdue} attività scadute</p>}<Button asChild variant="outline" className="w-full"><Link href={`/dashboard/progetti/${project.id}`}>Apri progetto</Link></Button></CardContent></Card>)}</div>
}

function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-md bg-muted/60 px-2.5 py-2"><p className="text-[11px] text-muted-foreground">{label}</p><p className="font-semibold tabular-nums">{value}</p></div> }
function ActivityItem({ activity, project, today }: { activity: CustomerActivity; project?: CommercialProject; today: string }) { const overdue = activity.dueDate < today && !closedStatuses.includes(activity.status); return <div className="rounded-lg border p-3"><div className="flex items-start justify-between gap-2"><p className="line-clamp-2 font-medium">{activity.title}</p><Badge variant={activity.status === "Bloccata" || overdue ? "destructive" : "secondary"}>{overdue ? "Scaduta" : activity.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">{project?.name ?? "Senza progetto"} · {formatItalianDate(activity.dueDate) || "Senza scadenza"}</p>{activity.blockedReason && <p className="mt-2 text-xs text-red-600 dark:text-red-400">{activity.blockedReason}</p>}</div> }
function EmptyWorkload({ title, detail }: { title: string; detail: string }) { return <Card><CardContent className="grid min-h-48 place-items-center p-6 text-center"><div><Users className="mx-auto size-8 text-muted-foreground" /><h3 className="mt-3 font-medium">{title}</h3><p className="mt-1 max-w-md text-sm text-muted-foreground">{detail}</p></div></CardContent></Card> }
