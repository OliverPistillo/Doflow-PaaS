"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertTriangle, CalendarDays, CheckCircle2, CircleDot, Clock3, LayoutList, Plus, Search, ShieldAlert, UserRound } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { RankingWinnerBadges } from "@/features/commercial/components/ranking-winner-badges"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ActivityDetailSheet } from "@/features/commercial/components/activity-detail-sheet"
import { ActivityFormDialog } from "@/features/commercial/components/activity-form-dialog"
import { ActivityKanbanBoard } from "@/features/commercial/components/activity-kanban-board"
import { customerActivityPriorities, customerActivityStatuses, customerActivityTypes, type CustomerActivity } from "@/features/commercial/components/commercial-leads-provider"
import { useCommercialTeam } from "@/features/commercial/use-commercial-team"
import { AccessDenied } from "@/features/identity/access-denied"
import { canManageActivity } from "@/features/identity/permissions"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { formatItalianDate, getRomeDateKey } from "@/lib/date"

type View = "list" | "kanban" | "calendar"
type KpiFilter = "todo" | "progress" | "overdue" | "urgent" | "completed-month"
type ActivityRow = ReturnType<typeof useAuthorizedCommercial>["activities"][number]
const closedStatuses: CustomerActivity["status"][] = ["Completata", "Annullata"]
const priorityRank: Record<CustomerActivity["priority"], number> = { Urgente: 0, Alta: 1, Media: 2, Bassa: 3 }

function dueTone(activity: CustomerActivity, today: string) {
  if (!activity.dueDate || closedStatuses.includes(activity.status)) return "text-muted-foreground"
  if (activity.dueDate < today) return "text-red-600 dark:text-red-400"
  const soon = new Date(`${today}T12:00:00`); soon.setDate(soon.getDate() + 3)
  return activity.dueDate <= soon.toISOString().slice(0, 10) ? "text-amber-600 dark:text-amber-400" : "text-muted-foreground"
}

function ActivityCard({ row, onOpen }: { row: ActivityRow; onOpen: () => void }) {
  const commercialTeam = useCommercialTeam()
  const { activity, customer } = row
  const owner = commercialTeam.find((item) => item.id === activity.assigneeId)?.name ?? activity.assigneeId
  return <button type="button" onClick={onOpen} className="w-full rounded-lg border bg-card p-3 text-left transition-colors hover:bg-muted/50"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate font-medium">{activity.title}</p><p className="mt-1 truncate text-xs text-muted-foreground">{customer.profile.company} · {owner}</p></div><Badge variant={activity.priority === "Urgente" ? "destructive" : "secondary"}>{activity.priority}</Badge></div><div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground"><Badge variant="outline">{activity.type}</Badge><span>{activity.dueDate ? formatItalianDate(activity.dueDate) : "Senza scadenza"}</span>{activity.recurrence !== "Nessuna" && <span>· {activity.recurrence}</span>}</div></button>
}

export function CommercialActivitiesPage({ initialActivityId }: { initialActivityId?: string }) {
  const commercialTeam = useCommercialTeam()
  const { store, identity, activities, customers, projects } = useAuthorizedCommercial()
  const [view, setView] = useState<View>("list")
  const [createOpen, setCreateOpen] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(initialActivityId ?? null)
  const [query, setQuery] = useState("")
  const [status, setStatus] = useState("all")
  const [priority, setPriority] = useState("all")
  const [type, setType] = useState("all")
  const [assignee, setAssignee] = useState("all")
  const [customerId, setCustomerId] = useState("all")
  const [projectId, setProjectId] = useState("all")
  const [period, setPeriod] = useState("all")
  const [overdueOnly, setOverdueOnly] = useState(false)
  const [mineOnly, setMineOnly] = useState(false)
  const [sort, setSort] = useState("due")
  const today = getRomeDateKey(new Date())
  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLocaleLowerCase("it-IT")
    const start = new Date(`${today}T12:00:00`)
    const limit = new Date(start)
    if (period === "week") limit.setDate(limit.getDate() + 7)
    if (period === "month") limit.setMonth(limit.getMonth() + 1)
    const limitKey = limit.toISOString().slice(0, 10)
    return activities.filter(({ activity, customer }) => {
      const project = projects.find((item) => item.id === activity.projectId)
      const owner = commercialTeam.find((item) => item.id === activity.assigneeId)?.name
      const haystack = [activity.title, activity.description, customer.profile.company, project?.name, owner].filter(Boolean).join(" ").toLocaleLowerCase("it-IT")
      if (normalizedQuery && !haystack.includes(normalizedQuery)) return false
      if (status !== "all" && activity.status !== status) return false
      if (priority !== "all" && activity.priority !== priority) return false
      if (type !== "all" && activity.type !== type) return false
      if (assignee !== "all" && activity.assigneeId !== assignee) return false
      if (customerId !== "all" && customer.id !== customerId) return false
      if (projectId !== "all" && activity.projectId !== projectId) return false
      if (mineOnly && activity.assigneeId !== identity.currentUserId && !activity.collaboratorIds.includes(identity.currentUserId)) return false
      if (overdueOnly && (!activity.dueDate || activity.dueDate >= today || closedStatuses.includes(activity.status))) return false
      if (period === "completed-month" && (activity.status !== "Completata" || activity.completedAt?.slice(0, 7) !== today.slice(0, 7))) return false
      if (period !== "all" && period !== "completed-month" && (!activity.dueDate || activity.dueDate < today || activity.dueDate > limitKey)) return false
      if (priority === "Urgente" && status === "all" && period === "all" && !overdueOnly && closedStatuses.includes(activity.status)) return false
      return true
    }).sort((left, right) => sort === "priority" ? priorityRank[left.activity.priority] - priorityRank[right.activity.priority] : sort === "created" ? right.activity.createdAt.localeCompare(left.activity.createdAt) : sort === "updated" ? right.activity.updatedAt.localeCompare(left.activity.updatedAt) : (left.activity.dueDate || "9999").localeCompare(right.activity.dueDate || "9999"))
  }, [activities, assignee, commercialTeam, customerId, identity.currentUserId, mineOnly, overdueOnly, period, priority, projectId, projects, query, sort, status, today, type])
  if (!identity.hasCapability("canViewActivities")) return <AccessDenied resource="alle attività" />
  const selected = activities.find(({ activity }) => activity.id === selectedId)
  const openCount = activities.filter(({ activity }) => activity.status === "Da fare").length
  const progressCount = activities.filter(({ activity }) => activity.status === "In corso").length
  const overdueCount = activities.filter(({ activity }) => activity.dueDate && activity.dueDate < today && !closedStatuses.includes(activity.status)).length
  const urgentCount = activities.filter(({ activity }) => activity.priority === "Urgente" && !closedStatuses.includes(activity.status)).length
  const completedCount = activities.filter(({ activity }) => activity.status === "Completata" && activity.completedAt?.slice(0, 7) === today.slice(0, 7)).length
  const clearFilters = () => { setQuery(""); setStatus("all"); setPriority("all"); setType("all"); setAssignee("all"); setCustomerId("all"); setProjectId("all"); setPeriod("all"); setOverdueOnly(false); setMineOnly(false) }
  const activeKpi: KpiFilter | null = overdueOnly && status === "all" && priority === "all" && period === "all" ? "overdue"
    : !overdueOnly && priority === "all" && period === "all" && status === "Da fare" ? "todo"
      : !overdueOnly && priority === "all" && period === "all" && status === "In corso" ? "progress"
        : !overdueOnly && status === "all" && priority === "Urgente" && period === "all" ? "urgent"
          : !overdueOnly && status === "Completata" && priority === "all" && period === "completed-month" ? "completed-month"
            : null
  const setKpiFilter = (next: KpiFilter) => {
    if (activeKpi === next) { setStatus("all"); setPriority("all"); setPeriod("all"); setOverdueOnly(false); return }
    setStatus(next === "todo" ? "Da fare" : next === "progress" ? "In corso" : next === "completed-month" ? "Completata" : "all")
    setPriority(next === "urgent" ? "Urgente" : "all")
    setPeriod(next === "completed-month" ? "completed-month" : "all")
    setOverdueOnly(next === "overdue")
  }
  const updateStatus = async (row: ActivityRow, next: CustomerActivity["status"]) => { if (!canManageActivity(identity.currentUser, row.activity, row.customer, projects.find((item) => item.id === row.activity.projectId))) return; if (await store.setCustomerActivityStatus(row.customer.id, row.activity.id, next)) toast.success(`Stato aggiornato: ${next}`) }

  const kpis = [
    ["todo", "Da fare", openCount, Clock3, "text-slate-600"], ["progress", "In corso", progressCount, CircleDot, "text-blue-600"], ["overdue", "In ritardo", overdueCount, AlertTriangle, "text-red-600"], ["urgent", "Urgenti", urgentCount, ShieldAlert, "text-red-600"], ["completed-month", "Completate nel mese", completedCount, CheckCircle2, "text-emerald-600"],
  ] as const
  return <main className="mx-auto w-full max-w-[1440px] space-y-5 p-4 md:p-6"><header className="flex flex-wrap items-start justify-between gap-3"><div><h1 className="text-2xl font-semibold">Attività</h1><p className="text-sm text-muted-foreground">Centro operativo nel perimetro autorizzato di {identity.currentUser.name}.</p></div><Button onClick={() => setCreateOpen(true)} disabled={!customers.length}><Plus />Nuova attività</Button></header>
    <section aria-label="Filtri rapidi attività" className="grid grid-cols-2 gap-3 lg:grid-cols-5">{kpis.map(([id, label, value, Icon, tone]) => { const selected = activeKpi === id; return <Card key={id} className={selected ? "border-primary bg-primary/5 ring-2 ring-primary/20" : "transition-colors hover:bg-muted/40"}><CardContent className="p-0"><button type="button" aria-pressed={selected} aria-label={`Filtra per ${label}`} onClick={() => setKpiFilter(id)} className="flex min-h-20 w-full items-center gap-3 rounded-xl p-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 sm:p-4"><Icon className={`size-5 shrink-0 ${tone}`} /><span className="min-w-0"><span className="block text-2xl font-semibold tabular-nums">{value}</span><span className="block text-xs text-muted-foreground">{label}</span></span></button></CardContent></Card> })}</section>
    {store.leadActivities.length > 0 && <Card><CardHeader><CardTitle className="text-base">Attività commerciali collegate ai lead</CardTitle><CardDescription>{store.leadActivities.length} attività nel perimetro autorizzato</CardDescription></CardHeader><CardContent className="space-y-2">{store.leadActivities.map((activity) => { const lead = store.leads.find((item) => item.id === activity.leadId); return <Button key={activity.id} asChild variant="outline" className="h-auto w-full justify-start px-3 py-2 text-left"><Link href={`/dashboard/commercial/leads/${activity.leadId}`}><span className="min-w-0 flex-1"><span className="block truncate font-medium">{activity.title}</span><span className="block truncate text-xs text-muted-foreground">{lead?.company ?? activity.leadId} · {activity.dueDate ? formatItalianDate(activity.dueDate) : "Senza scadenza"}</span></span><Badge variant="secondary">{activity.status}</Badge></Link></Button> })}</CardContent></Card>}
    <Card><CardHeader><div className="flex flex-wrap items-center justify-between gap-3"><div><CardTitle className="text-base">Pianificazione operativa</CardTitle><CardDescription>{filtered.length} attività visualizzate</CardDescription></div><Tabs value={view} onValueChange={(value) => setView(value as View)}><TabsList><TabsTrigger value="list"><LayoutList />Lista</TabsTrigger><TabsTrigger value="kanban"><CircleDot />Kanban</TabsTrigger><TabsTrigger value="calendar"><CalendarDays />Scadenze</TabsTrigger></TabsList></Tabs></div></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 md:grid-cols-3 xl:grid-cols-5"><div className="relative md:col-span-2"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca titolo, cliente, progetto…" /></div>
      <Select value={assignee} onValueChange={setAssignee}><SelectTrigger aria-label="Filtra responsabile"><SelectValue placeholder="Responsabile" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i responsabili</SelectItem>{commercialTeam.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={status} onValueChange={setStatus}><SelectTrigger aria-label="Filtra stato"><SelectValue placeholder="Stato" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem>{customerActivityStatuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={priority} onValueChange={setPriority}><SelectTrigger aria-label="Filtra priorità"><SelectValue placeholder="Priorità" /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le priorità</SelectItem>{customerActivityPriorities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={type} onValueChange={setType}><SelectTrigger aria-label="Filtra tipologia"><SelectValue placeholder="Tipologia" /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le tipologie</SelectItem>{customerActivityTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select>
      <Select value={customerId} onValueChange={setCustomerId}><SelectTrigger aria-label="Filtra cliente"><SelectValue placeholder="Cliente" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i clienti</SelectItem>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.profile.company}</SelectItem>)}</SelectContent></Select>
      <Select value={projectId} onValueChange={setProjectId}><SelectTrigger aria-label="Filtra progetto"><SelectValue placeholder="Progetto" /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i progetti</SelectItem>{projects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select>
      <Select value={period} onValueChange={setPeriod}><SelectTrigger aria-label="Filtra periodo"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Qualsiasi periodo</SelectItem><SelectItem value="week">Prossimi 7 giorni</SelectItem><SelectItem value="month">Prossimi 30 giorni</SelectItem><SelectItem value="completed-month">Completate questo mese</SelectItem></SelectContent></Select>
      <Select value={sort} onValueChange={setSort}><SelectTrigger aria-label="Ordina attività"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="due">Scadenza</SelectItem><SelectItem value="priority">Priorità</SelectItem><SelectItem value="created">Data creazione</SelectItem><SelectItem value="updated">Ultimo aggiornamento</SelectItem></SelectContent></Select>
    </div><div className="flex flex-wrap gap-2"><Button size="sm" variant={mineOnly ? "default" : "outline"} onClick={() => setMineOnly((value) => !value)}><UserRound />Solo mie</Button><Button size="sm" variant={overdueOnly ? "destructive" : "outline"} onClick={() => setKpiFilter("overdue")}><AlertTriangle />Solo scadute</Button><Button size="sm" variant="ghost" onClick={clearFilters}>Azzera filtri</Button></div>
    {view === "list" && <div className="space-y-2">{filtered.map((row) => <div key={row.activity.id} className="flex flex-col gap-3 rounded-lg border p-3 lg:flex-row lg:items-center"><button type="button" onClick={() => setSelectedId(row.activity.id)} className="min-w-0 flex-1 text-left"><div className="flex flex-wrap items-center gap-2"><p className="line-clamp-2 min-w-0 font-medium">{row.activity.title}</p><Badge variant="outline">{row.activity.type}</Badge>{row.activity.status === "Bloccata" && <Badge variant="destructive">Bloccata</Badge>}</div><div className="mt-1 flex min-w-0 flex-wrap items-center gap-1 text-xs text-muted-foreground"><span className="min-w-0 truncate">{row.customer.profile.company} · {commercialTeam.find((item) => item.id === row.activity.assigneeId)?.name ?? row.activity.assigneeId}</span><RankingWinnerBadges userId={row.activity.assigneeId} compact /></div></button><div className="flex flex-wrap items-center gap-2"><span className={`text-xs ${dueTone(row.activity, today)}`}>{row.activity.dueDate ? formatItalianDate(row.activity.dueDate) : "Senza scadenza"}</span><Badge variant={row.activity.priority === "Urgente" ? "destructive" : "secondary"}>{row.activity.priority}</Badge><Select value={row.activity.status} onValueChange={(value) => updateStatus(row, value as CustomerActivity["status"])} disabled={!canManageActivity(identity.currentUser, row.activity, row.customer, projects.find((item) => item.id === row.activity.projectId))}><SelectTrigger className="w-40" aria-label={`Stato ${row.activity.title}`}><SelectValue /></SelectTrigger><SelectContent>{customerActivityStatuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" onClick={() => setSelectedId(row.activity.id)}>Dettaglio</Button></div></div>)}</div>}
    {view === "kanban" && <ActivityKanbanBoard rows={filtered} onOpen={setSelectedId} />}
    {view === "calendar" && <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{Array.from(new Set(filtered.map(({ activity }) => activity.dueDate || "Senza scadenza"))).sort().map((date) => <section key={date} className="rounded-lg border p-3"><h3 className="mb-3 font-medium">{date === "Senza scadenza" ? date : formatItalianDate(date)}</h3><div className="space-y-2">{filtered.filter(({ activity }) => (activity.dueDate || "Senza scadenza") === date).map((row) => <ActivityCard key={row.activity.id} row={row} onOpen={() => setSelectedId(row.activity.id)} />)}</div></section>)}</div>}
    {!filtered.length && <div className="py-12 text-center"><CardTitle className="text-base">Nessuna attività corrispondente</CardTitle><CardDescription className="mt-1">Modifica i filtri o crea una nuova attività.</CardDescription></div>}</CardContent></Card>
    <ActivityFormDialog open={createOpen} onOpenChange={setCreateOpen} onSaved={(id) => setSelectedId(id ?? null)} />
    {selected && <ActivityDetailSheet clientId={selected.customer.id} activityId={selected.activity.id} open={Boolean(selectedId)} onOpenChange={(open) => { if (!open) setSelectedId(null) }} />}
  </main>
}
