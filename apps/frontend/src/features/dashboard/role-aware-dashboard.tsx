"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AlarmClock, ArrowUpRight, BadgeEuro, BriefcaseBusiness, CalendarClock, Check, ChevronDown, ClipboardCheck, FolderKanban, Headphones, Target, Trophy, UserRoundSearch, UsersRound } from "lucide-react"

import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { DashboardOverview } from "@/features/dashboard/dashboard-overview"
import { DashboardGreeting } from "@/features/dashboard/components/dashboard-greeting"
import { DashboardGoalsCard } from "@/features/dashboard/components/dashboard-goals-card"
import { MetricAreaChart } from "@/features/dashboard/components/metric-area-chart"
import { CommercialRankingsPanel } from "@/features/commercial/components/commercial-workspace-page"
import { GuidedCallAnalytics } from "@/features/commercial/components/guided-call-sheet"
import { RankingWinnerBadges } from "@/features/commercial/components/ranking-winner-badges"
import { useDoflowIdentity, type DoflowIdentityUser } from "@/features/identity/doflow-identity-provider"
import { roleLabels } from "@/features/identity/permissions"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { addRomeDays, getRomeDateKey } from "@/lib/date"
import { PresenceUserOption } from "@/features/identity/presence-user-option"
import { useDoflowPresence } from "@/features/identity/doflow-presence-provider"
import { PresenceIndicator } from "@/features/identity/presence-indicator"
import { useBonus } from "@/features/bonus/bonus-provider"

function Metric({ label, value, detail, icon: Icon, href }: { label: string; value: string | number; detail: string; icon: typeof UsersRound; href?: string }) {
  const card = <Card className={`h-full transition-colors ${href ? "group-hover:border-primary/40 group-hover:bg-muted/30" : ""}`}><CardHeader className="pb-2"><div className="flex items-center justify-between gap-2"><CardDescription>{label}</CardDescription><Icon className="size-4 text-muted-foreground" /></div><CardTitle className="text-3xl tabular-nums">{value}</CardTitle></CardHeader><CardContent className="flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>{detail}</span>{href && <span className="inline-flex shrink-0 items-center gap-1 font-medium text-foreground">Apri<ArrowUpRight className="size-3" /></span>}</CardContent></Card>
  return href ? <Link href={href} aria-label={`Apri ${label}`} onKeyDown={(event) => { if (event.key === " ") { event.preventDefault(); event.currentTarget.click() } }} className="group block rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{card}</Link> : card
}

function RoleDashboard({ user, collaboratorView = false }: { user: DoflowIdentityUser; collaboratorView?: boolean }) {
  const authorized = useAuthorizedCommercial()
  const bonus = useBonus()
  const [goalsReady, setGoalsReady] = useState(false)
  useEffect(() => { const frame = window.requestAnimationFrame(() => setGoalsReady(true)); return () => window.cancelAnimationFrame(frame) }, [])
  const ownView = user.id === authorized.identity.currentUser.id
  const leads = (ownView ? authorized.leads : authorized.store.allLeads).filter((lead) => lead.assigneeId === user.id && !lead.archivedAt)
  const projects = (ownView ? authorized.projects : authorized.store.allProjects).filter((project) => !project.archivedAt && (project.ownerId === user.id || project.memberIds.includes(user.id)))
  const customerIds = new Set(projects.map((project) => project.clientId))
  const activities = (ownView ? authorized.activities : authorized.store.allCustomers.filter((customer) => customerIds.has(customer.id) || customer.profile.assigneeId === user.id).flatMap((customer) => (customer.activities ?? []).map((activity) => ({ activity, customer })))).filter(({ activity }) => !activity.archivedAt && (activity.assigneeId === user.id || activity.collaboratorIds?.includes(user.id)))
  const openActivities = activities.filter(({ activity }) => !["Completata", "Annullata"].includes(activity.status))
  const openFollowUps = openActivities.filter(({ activity }) => activity.type === "Follow-up")
  const today = getRomeDateKey(new Date())
  const upcomingLimit = addRomeDays(today, 3)
  const lateActivities = openActivities.filter(({ activity }) => activity.dueDate && activity.dueDate < today)
  const won = leads.filter((lead) => lead.stage === "won").length
  const series = ["Mar", "Apr", "Mag", "Giu", "Lug", "Ago"].map((month, index) => ({ month, value: Math.max(0, openActivities.length + index - 3) }))
  const completedPhases = projects.flatMap((project) => project.phases).filter((phase) => phase.status === "completed").length
  const totalPhases = projects.reduce((sum, project) => sum + project.phases.length, 0)
  const commercial = user.roles.includes("commercial")
  const technical = user.roles.includes("administrator") || user.roles.includes("web_developer") || user.roles.includes("project_manager")
  const personalPayments = authorized.store.payments.filter((payment) => payment.salespersonId === user.id && payment.status === "Confermato" && !payment.archivedAt)
  const personalRevenue = personalPayments.reduce((sum, payment) => sum + (payment.type === "Rimborso" ? -Math.abs(payment.amount) : Math.abs(payment.amount)), 0)
  const supportTickets = authorized.store.supportTickets.filter((ticket) => [ticket.requesterId, ticket.assigneeId, ticket.supervisorId, ...ticket.collaboratorIds].includes(user.id))
  const openSupport = supportTickets.filter((ticket) => !["Risolto", "Chiuso", "Annullato"].includes(ticket.status))
  const approvedPoints = ownView && bonus.snapshot?.wallet ? bonus.snapshot.wallet.consolidatedPoints : authorized.store.pointLedger.filter((entry) => entry.userId === user.id && entry.status === "approved").reduce((sum, entry) => sum + entry.points, 0)
  const upcomingDeadlines = openActivities.filter(({ activity }) => activity.dueDate && activity.dueDate >= today && activity.dueDate <= upcomingLimit).length + projects.filter((project) => project.dueDate && project.dueDate >= today && project.dueDate <= upcomingLimit && !["completed", "delivered", "archived"].includes(project.status)).length
  const monthFrom = `${today.slice(0, 7)}-01`
  const monthToDate = new Date(`${monthFrom}T12:00:00`); monthToDate.setMonth(monthToDate.getMonth() + 1)
  const monthTo = monthToDate.toISOString().slice(0, 10)
  const inMonth = (value?: string) => Boolean(value && value.slice(0, 10) >= monthFrom && value.slice(0, 10) < monthTo)
  const personalGoalValue = (metric: typeof authorized.store.goals[number]["metric"]) => {
    const sales = authorized.store.sales.filter((sale) => sale.salespersonId === user.id && !sale.archivedAt && inMonth(sale.date))
    if (metric === "revenue") return personalRevenue
    if (metric === "sales_value") return sales.filter((sale) => sale.status === "Vinta").reduce((sum, sale) => sum + sale.value, 0)
    if (metric === "sales_count") return sales.filter((sale) => sale.status === "Vinta").length
    if (metric === "won_leads") return leads.filter((lead) => lead.stage === "won" && inMonth(lead.convertedAt)).length
    if (metric === "new_clients") return authorized.customers.filter((customer) => customer.profile.assigneeId === user.id && inMonth(customer.createdAt)).length
    if (metric === "new_leads") return leads.filter((lead) => inMonth(lead.createdAt)).length
    if (metric === "appointments") return authorized.store.appointments.filter((appointment) => appointment.assigneeId === user.id && !appointment.archivedAt && inMonth(appointment.startsAt)).length
    if (metric === "conversion_rate") { const periodLeads = leads.filter((lead) => inMonth(lead.createdAt)); return periodLeads.length ? periodLeads.filter((lead) => lead.stage === "won").length / periodLeads.length * 100 : 0 }
    if (metric === "sla_hours") return openActivities.reduce((sum, { activity }) => sum + (activity.estimatedMinutes ?? 0) / 60, 0)
    if (metric === "score") return authorized.store.pointLedger.filter((entry) => entry.userId === user.id && entry.status === "approved" && inMonth(entry.occurredAt)).reduce((sum, entry) => sum + entry.points, 0)
    if (metric === "completed_projects" || metric === "on_time_deliveries") return projects.filter((project) => inMonth(project.deliveredAt)).length
    if (metric === "completed_activities" || metric === "resolved_bugs") return activities.filter(({ activity }) => inMonth(activity.completedAt) && (metric !== "resolved_bugs" || activity.type === "Bug")).length
    return authorized.store.renewals.filter((renewal) => renewal.salespersonId === user.id && renewal.status === "Pagato" && inMonth(renewal.updatedAt)).length
  }
  const personalGoals = authorized.store.goals.filter((goal) => goal.status === "active" && goal.startsAt < monthTo && goal.endsAt >= monthFrom && (goal.targetType === "user" && goal.targetId === user.id || goal.targetType === "role" && Boolean(goal.targetId && user.roles.includes(goal.targetId as typeof user.roles[number])))).map((goal) => ({ goal, current: personalGoalValue(goal.metric) }))

  return <main className="@container/main mx-auto w-full max-w-7xl space-y-6 p-4 md:p-6">
    <header>{collaboratorView ? <div className="flex min-w-0 items-center gap-3"><UserAvatar userId={user.id} name={user.name} className="size-11" /><div className="min-w-0"><h1 className="truncate text-2xl font-semibold tracking-tight">Dashboard di {user.name}</h1><p className="text-sm text-muted-foreground">KPI, obiettivi e lavoro nel perimetro autorizzato.</p></div></div> : <DashboardGreeting name={user.name} timeZone={authorized.identity.personalPreferences.timeZone} />}<div className="mt-2 flex flex-wrap items-center gap-1"><Badge variant="outline">{collaboratorView ? "Vista collaboratore autorizzata" : "Dashboard personale autorizzata"}</Badge>{user.roles.map((role) => <Badge key={role} variant="secondary">{roleLabels[role]}</Badge>)}<RankingWinnerBadges userId={user.id} /></div></header>
    <section className="grid auto-rows-fr gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {commercial && <Metric label="Lead assegnati" value={leads.length} detail={`${won} conversioni vinte`} icon={UsersRound} href={ownView && (authorized.identity.hasCapability("canViewAllLeads") || authorized.identity.hasCapability("canViewAssignedLeads")) ? "/dashboard/commercial/leads?scope=mine" : undefined} />}
      {commercial && <Metric label="Follow-up" value={openFollowUps.length} detail="Nel perimetro personale" icon={CalendarClock} href={ownView && authorized.identity.hasCapability("canViewActivities") ? "/dashboard/attivita?scope=mine&type=follow-up&status=open" : undefined} />}
      {commercial && <Metric label="Incassato netto personale" value={new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 }).format(personalRevenue)} detail={`${new Set(personalPayments.filter((payment) => payment.type !== "Rimborso").map((payment) => payment.orderId)).size} vendite pagate`} icon={BadgeEuro} href={ownView && authorized.identity.hasCapability("canManagePayments") ? "/dashboard/pagamenti?scope=mine&status=confirmed&net=true" : undefined} />}
      {technical && <Metric label="Progetti" value={projects.length} detail="Assegnati o in team" icon={FolderKanban} href={ownView && authorized.identity.hasCapability("canViewProjects") ? "/dashboard/progetti?scope=mine" : undefined} />}
      <Metric label="Attività aperte" value={openActivities.length} detail={`${lateActivities.length} oltre scadenza`} icon={ClipboardCheck} href={ownView && authorized.identity.hasCapability("canViewActivities") ? "/dashboard/attivita?scope=mine&status=open" : undefined} />
      {user.roles.some((role) => role === "administrator" || role === "web_developer" || role === "project_manager") && <Metric label="Ticket supporto" value={openSupport.length} detail={`${openSupport.filter((ticket) => ["Urgente", "Critica"].includes(ticket.priority)).length} urgenti o critici`} icon={Headphones} href={ownView && authorized.identity.hasCapability("openSupportTicket") ? "/dashboard/supporto?scope=mine&status=open&view=mine" : undefined} />}
      <Metric label="Punti approvati" value={approvedPoints} detail="Portafoglio server verificabile" icon={Trophy} href={ownView ? "/dashboard/bonus" : undefined} />
      <Metric label="Scadenze imminenti" value={upcomingDeadlines} detail="Nei prossimi 3 giorni" icon={AlarmClock} href={ownView && (authorized.identity.hasCapability("canViewActivities") || authorized.identity.hasCapability("canViewProjects")) ? "/dashboard/calendario?scope=mine&period=upcoming&source=personal-deadlines" : undefined} />
      {user.roles.includes("project_manager") && <Metric label="Avanzamento" value={`${totalPhases ? Math.round(completedPhases / totalPhases * 100) : 0}%`} detail={`${completedPhases} di ${totalPhases} fasi concluse`} icon={Target} href={ownView && authorized.identity.hasCapability("canViewProjects") ? "/dashboard/progetti?scope=mine" : undefined} />}
    </section>
    <DashboardGoalsCard goals={personalGoals} periodLabel="Questo mese" loading={!goalsReady} canConfigure={authorized.identity.hasCapability("canManageRoles")} />
    <section className="grid gap-4 lg:grid-cols-[minmax(0,3fr)_minmax(280px,2fr)]">
      <Card><CardHeader><CardTitle>Andamento operativo</CardTitle><CardDescription>Anno corrente e anno precedente, limitati al perimetro di {user.name}.</CardDescription></CardHeader><CardContent><MetricAreaChart label="Attività operative" token="chart-2" data={series} kind="number" /></CardContent></Card>
      <Card><CardHeader><CardTitle>Priorità e scadenze</CardTitle><CardDescription>Le attività autorizzate più vicine.</CardDescription></CardHeader><CardContent className="space-y-3">{openActivities.sort((a, b) => (a.activity.dueDate || "9999").localeCompare(b.activity.dueDate || "9999")).slice(0, 6).map(({ activity, customer }) => <Button key={activity.id} asChild variant="ghost" className="h-auto w-full justify-between gap-3 px-2 py-2"><Link href={`/dashboard/attivita?activityId=${activity.id}`}><span className="min-w-0 text-left"><span className="block truncate text-sm font-medium">{activity.title}</span><span className="block truncate text-xs text-muted-foreground">{customer.profile.company}</span></span><Badge variant="outline">{activity.dueDate || "Senza data"}</Badge></Link></Button>)}{!openActivities.length && <p className="text-sm text-muted-foreground">Nessuna attività aperta.</p>}</CardContent></Card>
    </section>
    <CommercialRankingsPanel compact />
    {commercial && <GuidedCallAnalytics />}
    {technical && <Card><CardHeader><CardTitle>Progetti e consegne</CardTitle><CardDescription>Avanzamento reale delle fasi collegate alle attività.</CardDescription></CardHeader><CardContent className="grid gap-4 md:grid-cols-2">{projects.slice(0, 6).map((project) => { const complete = project.phases.filter((phase) => phase.status === "completed").length; const progress = project.phases.length ? Math.round(complete / project.phases.length * 100) : 0; return <Link key={project.id} href={`/dashboard/progetti/${project.id}`} className="rounded-lg border p-4 transition-colors hover:bg-muted/50"><div className="flex items-center justify-between gap-2"><span className="font-medium">{project.name}</span><Badge variant="secondary">{progress}%</Badge></div><Progress className="mt-3" value={progress} /><p className="mt-2 text-xs text-muted-foreground">Scadenza {project.dueDate || "non definita"}</p></Link> })}</CardContent></Card>}
    {supportTickets.length > 0 && <Card><CardHeader><CardTitle>Supporto tecnico</CardTitle><CardDescription>Ticket autorizzati assegnati, richiesti o supervisionati.</CardDescription></CardHeader><CardContent className="grid gap-3 md:grid-cols-2">{supportTickets.slice(0, 6).map((ticket) => <Button key={ticket.id} asChild variant="outline" className="h-auto justify-start p-3"><Link href={`/dashboard/supporto?ticket=${ticket.id}`}><Headphones className="size-4" /><span className="min-w-0 text-left"><span className="block truncate font-medium">{ticket.title}</span><span className="block text-xs text-muted-foreground">{ticket.code} · {ticket.status}</span></span></Link></Button>)}</CardContent></Card>}
  </main>
}

export function RoleAwareDashboard() {
  const identity = useDoflowIdentity()
  const presence = useDoflowPresence()
  const administrator = identity.currentUser.roles.includes("administrator")
  const [view, setView] = useState<"agency" | "personal" | "collaborator">("agency")
  const [selectedUserId, setSelectedUserId] = useState<string>()
  const [selectorOpen, setSelectorOpen] = useState(false)
  const collaborators = identity.users.filter((user) => user.id !== identity.currentUserId && user.active !== false)
  const selectedUser = collaborators.find((user) => user.id === selectedUserId)

  useEffect(() => {
    const key = `doflow-dashboard-collaborator:${identity.currentUserId}`
    const saved = window.sessionStorage.getItem(key)
    const frame = window.requestAnimationFrame(() => {
      setSelectedUserId(saved && identity.users.some((user) => user.id === saved && user.id !== identity.currentUserId && user.active !== false) ? saved : undefined)
      setSelectorOpen(false)
    })
    return () => window.cancelAnimationFrame(frame)
  }, [identity.currentUserId, identity.users])

  const selectCollaborator = (userId: string) => {
    setSelectedUserId(userId)
    window.sessionStorage.setItem(`doflow-dashboard-collaborator:${identity.currentUserId}`, userId)
    setSelectorOpen(false)
  }

  if (!administrator) return <RoleDashboard user={identity.currentUser} />
  return <div className="min-w-0">
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 md:px-6 md:pt-6" aria-label="Ambito dashboard amministratore">
      <div className="flex min-w-0 items-center gap-2 overflow-x-auto pb-1">
        <Button size="sm" className="shrink-0" variant={view === "agency" ? "default" : "outline"} onClick={() => setView("agency")}>Agenzia</Button>
        <Button size="sm" className="shrink-0" variant={view === "personal" ? "default" : "outline"} onClick={() => setView("personal")}>Personale</Button>
        <Button size="sm" className="shrink-0" variant={view === "collaborator" ? "default" : "outline"} onClick={() => setView("collaborator")}>Collaboratore</Button>
        <Badge variant="outline" className="ml-auto hidden shrink-0 sm:inline-flex"><BriefcaseBusiness className="mr-1 size-3" />Dati filtrati per capacità</Badge>
      </div>
      {view === "collaborator" && <div className="mt-3 flex min-w-0 flex-col gap-3 rounded-xl border bg-muted/25 p-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0"><p className="text-sm font-medium">Dashboard collaboratore</p><p className="text-xs text-muted-foreground">Scegli una persona autorizzata. La tua Dashboard Personale resta separata.</p></div>
        <Popover open={selectorOpen} onOpenChange={setSelectorOpen}>
          <PopoverTrigger asChild><Button variant="outline" role="combobox" aria-expanded={selectorOpen} aria-label="Seleziona collaboratore" className="h-auto min-h-11 w-full min-w-0 justify-between gap-3 px-3 sm:w-80">{selectedUser ? <PresenceUserOption userId={selectedUser.id} /> : <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><UserRoundSearch className="size-4 shrink-0" />Seleziona collaboratore</span>}<ChevronDown className="size-4 shrink-0 opacity-60" /></Button></PopoverTrigger>
          <PopoverContent align="end" className="w-[min(320px,calc(100vw-2rem))] p-1.5" aria-label="Elenco collaboratori">{collaborators.length ? collaborators.map((user) => <button type="button" key={user.id} onClick={() => selectCollaborator(user.id)} className="flex w-full min-w-0 items-center gap-3 rounded-md p-2 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"><UserAvatar userId={user.id} name={user.name} className="size-9" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{user.name}</span><span className="block truncate text-xs text-muted-foreground" title={user.roles.map((role) => roleLabels[role]).join(" · ")}>{user.roles.map((role) => roleLabels[role]).join(" · ")}</span><PresenceIndicator status={presence.presenceFor(user.id).status} showLabel showDot={false} /></span><Check className={`size-4 shrink-0 ${selectedUserId === user.id ? "opacity-100" : "opacity-0"}`} aria-hidden="true" /></button>) : <p className="p-3 text-sm text-muted-foreground">Nessun collaboratore disponibile nel tuo perimetro.</p>}</PopoverContent>
        </Popover>
      </div>}
    </div>
    {view === "agency" ? <DashboardOverview /> : view === "personal" ? <RoleDashboard user={identity.currentUser} /> : selectedUser ? <RoleDashboard user={selectedUser} collaboratorView /> : <div className="mx-auto w-full max-w-7xl px-4 py-8 md:px-6"><Card className="border-dashed"><CardContent className="flex min-h-44 flex-col items-center justify-center gap-2 text-center"><UserRoundSearch className="size-8 text-muted-foreground" /><CardTitle className="text-base">Seleziona un collaboratore</CardTitle><CardDescription>I KPI e gli obiettivi verranno mostrati soltanto dopo una scelta esplicita.</CardDescription></CardContent></Card></div>}
  </div>
}
