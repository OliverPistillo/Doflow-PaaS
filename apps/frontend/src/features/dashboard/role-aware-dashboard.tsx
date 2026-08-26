"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { BadgeEuro, BriefcaseBusiness, CalendarClock, ClipboardCheck, FolderKanban, Target, UsersRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { DashboardOverview } from "@/features/dashboard/dashboard-overview"
import { MetricAreaChart } from "@/features/dashboard/components/metric-area-chart"
import { CommercialRankingsPanel } from "@/features/commercial/components/commercial-workspace-page"
import { RankingWinnerBadges } from "@/features/commercial/components/ranking-winner-badges"
import { useDoflowIdentity, type DoflowIdentityUser } from "@/features/identity/doflow-identity-provider"
import { roleLabels } from "@/features/identity/permissions"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { commerceApi, type CommerceEconomics } from "@/lib/tenant-commerce-api"

function Metric({ label, value, detail, icon: Icon }: { label: string; value: string | number; detail: string; icon: typeof UsersRound }) {
  return <Card className="h-full"><CardHeader className="pb-2"><div className="flex items-center justify-between gap-2"><CardDescription>{label}</CardDescription><Icon className="size-4 text-muted-foreground" /></div><CardTitle className="text-3xl tabular-nums">{value}</CardTitle></CardHeader><CardContent className="text-xs text-muted-foreground">{detail}</CardContent></Card>
}

function RoleDashboard({ user }: { user: DoflowIdentityUser }) {
  const authorized = useAuthorizedCommercial()
  const ownView = user.id === authorized.identity.currentUser.id
  const leads = ownView ? authorized.leads : authorized.store.allLeads.filter((lead) => lead.assigneeId === user.id && !lead.archivedAt)
  const projects = ownView ? authorized.projects : authorized.store.allProjects.filter((project) => project.ownerId === user.id || project.memberIds.includes(user.id))
  const customerIds = new Set(projects.map((project) => project.clientId))
  const activities = ownView ? authorized.activities : authorized.store.allCustomers.filter((customer) => customerIds.has(customer.id) || customer.profile.assigneeId === user.id).flatMap((customer) => (customer.activities ?? []).filter((activity) => !activity.archivedAt && (activity.assigneeId === user.id || activity.collaboratorIds?.includes(user.id))).map((activity) => ({ activity, customer })))
  const openActivities = activities.filter(({ activity }) => !["Completata", "Annullata"].includes(activity.status))
  const lateActivities = openActivities.filter(({ activity }) => activity.dueDate && activity.dueDate < new Date().toISOString().slice(0, 10))
  const won = leads.filter((lead) => lead.stage === "won").length
  const series = Array.from({ length: 6 }, (_, index) => {
    const start = new Date()
    start.setDate(1)
    start.setHours(0, 0, 0, 0)
    start.setMonth(start.getMonth() - 5 + index)
    const end = new Date(start)
    end.setMonth(end.getMonth() + 1)
    return {
      month: new Intl.DateTimeFormat("it-IT", { month: "short" }).format(start),
      value: activities.filter(({ activity }) => {
        const timestamp = Date.parse(activity.createdAt)
        return timestamp >= start.getTime() && timestamp < end.getTime()
      }).length,
    }
  })
  const completedPhases = projects.flatMap((project) => project.phases).filter((phase) => phase.status === "completed").length
  const totalPhases = projects.reduce((sum, project) => sum + project.phases.length, 0)
  const commercial = user.roles.includes("commercial")
  const technical = user.roles.includes("web_developer") || user.roles.includes("project_manager")
  const [economics, setEconomics] = useState<CommerceEconomics | null>(null)
  const [economicsStatus, setEconomicsStatus] = useState<"loading" | "loaded" | "error">("loading")
  useEffect(() => {
    if (!commercial) return
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setEconomicsStatus("loading") })
    void commerceApi.economics(undefined, undefined, user.id).then((result) => {
      if (cancelled) return
      setEconomics(result)
      setEconomicsStatus("loaded")
    }).catch(() => {
      if (cancelled) return
      setEconomics(null)
      setEconomicsStatus("error")
    })
    return () => { cancelled = true }
  }, [commercial, user.id])

  return <main className="@container/main w-full space-y-6 p-4 md:p-6">
    <header><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Dashboard personale autorizzata</p><h1 className="mt-1 text-2xl font-semibold">Buon pomeriggio, {user.name}</h1><div className="mt-2 flex flex-wrap items-center gap-1">{user.roles.map((role) => <Badge key={role} variant="secondary">{roleLabels[role]}</Badge>)}<RankingWinnerBadges userId={user.id} /></div></header>
    <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {commercial && <Metric label="Lead assegnati" value={leads.length} detail={`${won} conversioni vinte`} icon={UsersRound} />}
      {commercial && <Metric label="Follow-up" value={leads.filter((lead) => lead.stage === "follow-up").length} detail="Nel perimetro personale" icon={CalendarClock} />}
      {commercial && <Metric label="Incassato netto personale" value={economicsStatus === "loaded" && economics ? new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(economics.netCollected) : economicsStatus === "error" ? "—" : "…"} detail={economics ? `${economics.orderCount} ordini · aggregato server` : "Dati economici protetti"} icon={BadgeEuro} />}
      {technical && <Metric label="Progetti" value={projects.length} detail="Assegnati o in team" icon={FolderKanban} />}
      <Metric label="Attività aperte" value={openActivities.length} detail={`${lateActivities.length} oltre scadenza`} icon={ClipboardCheck} />
      {user.roles.includes("project_manager") && <Metric label="Avanzamento" value={`${totalPhases ? Math.round(completedPhases / totalPhases * 100) : 0}%`} detail={`${completedPhases} di ${totalPhases} fasi concluse`} icon={Target} />}
    </section>
    <section className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
      <Card><CardHeader><CardTitle>Andamento operativo</CardTitle><CardDescription>Anno corrente e anno precedente, limitati al perimetro di {user.name}.</CardDescription></CardHeader><CardContent><MetricAreaChart label="Attività operative" token="chart-2" data={series} kind="number" /></CardContent></Card>
      <Card><CardHeader><CardTitle>Priorità e scadenze</CardTitle><CardDescription>Le attività autorizzate più vicine.</CardDescription></CardHeader><CardContent className="space-y-3">{openActivities.sort((a, b) => (a.activity.dueDate || "9999").localeCompare(b.activity.dueDate || "9999")).slice(0, 6).map(({ activity, customer }) => <Button key={activity.id} asChild variant="ghost" className="h-auto w-full justify-between gap-3 px-2 py-2"><Link href={`/dashboard/attivita?activityId=${activity.id}`}><span className="min-w-0 text-left"><span className="block truncate text-sm font-medium">{activity.title}</span><span className="block truncate text-xs text-muted-foreground">{customer.profile.company}</span></span><Badge variant="outline">{activity.dueDate || "Senza data"}</Badge></Link></Button>)}{!openActivities.length && <p className="text-sm text-muted-foreground">Nessuna attività aperta.</p>}</CardContent></Card>
    </section>
    <CommercialRankingsPanel />
    {technical && <Card><CardHeader><CardTitle>Progetti e consegne</CardTitle><CardDescription>Avanzamento reale delle fasi collegate alle attività.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{projects.slice(0, 6).map((project) => { const complete = project.phases.filter((phase) => phase.status === "completed").length; const progress = project.phases.length ? Math.round(complete / project.phases.length * 100) : 0; return <Link key={project.id} href={`/dashboard/progetti/${project.id}`} className="rounded-lg border p-4 transition-colors hover:bg-muted/50"><div className="flex items-center justify-between gap-2"><span className="font-medium">{project.name}</span><Badge variant="secondary">{progress}%</Badge></div><Progress className="mt-3" value={progress} /><p className="mt-2 text-xs text-muted-foreground">Scadenza {project.dueDate || "non definita"}</p></Link> })}</CardContent></Card>}
  </main>
}

export function RoleAwareDashboard() {
  const identity = useDoflowIdentity()
  const administrator = identity.currentUser.roles.includes("administrator")
  const [view, setView] = useState<"agency" | "personal" | "collaborator">("agency")
  const [selectedUserId, setSelectedUserId] = useState(identity.currentUser.id)
  const selectedUser = identity.users.find((user) => user.id === selectedUserId) ?? identity.currentUser

  if (!administrator) return <RoleDashboard user={identity.currentUser} />
  return <div className="min-w-0">
    <div className="flex w-full flex-wrap items-center gap-2 px-4 pt-5 md:px-6 md:pt-6" aria-label="Ambito dashboard amministratore">
      <Button size="sm" variant={view === "agency" ? "default" : "outline"} onClick={() => setView("agency")}>Agenzia</Button>
      <Button size="sm" variant={view === "personal" ? "default" : "outline"} onClick={() => setView("personal")}>Personale</Button>
      <Button size="sm" variant={view === "collaborator" ? "default" : "outline"} onClick={() => setView("collaborator")}>Collaboratore</Button>
      {view === "collaborator" && <Select value={selectedUser.id} onValueChange={setSelectedUserId}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{identity.users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select>}
      <Badge variant="outline" className="ml-auto"><BriefcaseBusiness className="mr-1 size-3" />Dati filtrati per capacità</Badge>
    </div>
    {view === "agency" ? <DashboardOverview /> : <RoleDashboard user={view === "personal" ? identity.currentUser : selectedUser} />}
  </div>
}
