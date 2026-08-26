"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { BadgeEuro, CalendarClock, ChartNoAxesCombined, CircleDollarSign, ContactRound, ListTodo, ReceiptText, TrendingUp, UsersRound } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { RankingWinnerBadges } from "@/features/commercial/components/ranking-winner-badges"
import { DashboardGreeting } from "@/features/dashboard/components/dashboard-greeting"
import { DashboardGoalsCard } from "@/features/dashboard/components/dashboard-goals-card"
import { FinancialSummaryChart } from "@/features/dashboard/components/financial-summary-chart"
import type { OverviewMetric } from "@/features/dashboard/types"
import { roleLabels } from "@/features/identity/permissions"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { commerceApi, type CommerceEconomics } from "@/lib/tenant-commerce-api"
import { performanceApi, type MissionGoal } from "@/lib/tenant-performance-api"

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
type Period = "today" | "month" | "previous" | "year"
type MetricId = "revenue" | "expenses" | "profit"

function periodBounds(period: Period) {
  const now = new Date(); const from = new Date(now); const to = new Date(now)
  if (period === "today") { from.setHours(0, 0, 0, 0); to.setDate(to.getDate() + 1); to.setHours(0, 0, 0, 0) }
  else if (period === "month") { from.setDate(1); from.setHours(0, 0, 0, 0); to.setMonth(to.getMonth() + 1, 1); to.setHours(0, 0, 0, 0) }
  else if (period === "previous") { from.setMonth(from.getMonth() - 1, 1); from.setHours(0, 0, 0, 0); to.setDate(1); to.setHours(0, 0, 0, 0) }
  else { from.setMonth(0, 1); from.setHours(0, 0, 0, 0); to.setFullYear(to.getFullYear() + 1, 0, 1); to.setHours(0, 0, 0, 0) }
  return { from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) }
}

function unavailableMetric(title: string, token: OverviewMetric["token"], months: string[]): OverviewMetric {
  return { title, value: "Non disponibile", change: "—", comparison: "Aggregato server non disponibile", token, series: months.map((month) => ({ month, value: 0 })) }
}

export function SynchronizedDashboardOverview() {
  const { store, identity, leads, customers, projects, activities } = useAuthorizedCommercial()
  const [period, setPeriod] = useState<Period>("month")
  const [activeMetric, setActiveMetric] = useState<MetricId>("revenue")
  const [economics, setEconomics] = useState<CommerceEconomics | null>(null)
  const [economicsStatus, setEconomicsStatus] = useState<"loading" | "loaded" | "error">("loading")
  const [missionGoals, setMissionGoals] = useState<MissionGoal[]>([])
  const [missionStatus, setMissionStatus] = useState<"loading" | "loaded" | "error">("loading")
  const [canConfigureGoals, setCanConfigureGoals] = useState(false)
  const bounds = useMemo(() => periodBounds(period), [period])

  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setEconomicsStatus("loading") })
    void commerceApi.economics(bounds.from, bounds.to).then((result) => {
      if (!cancelled) { setEconomics(result); setEconomicsStatus("loaded") }
    }).catch(() => { if (!cancelled) { setEconomics(null); setEconomicsStatus("error") } })
    return () => { cancelled = true }
  }, [bounds.from, bounds.to])

  useEffect(() => {
    let cancelled = false
    void performanceApi.state().then((result) => {
      if (!cancelled) { setMissionGoals(result.mission.items); setCanConfigureGoals(result.permissions.canManageGoals); setMissionStatus("loaded") }
    }).catch(() => { if (!cancelled) { setMissionGoals([]); setMissionStatus("error") } })
    return () => { cancelled = true }
  }, [])

  const values: CommerceEconomics = economics ?? { sold: 0, orderCount: 0, ordered: 0, grossCollected: 0, refunded: 0, netCollected: 0, residual: 0, openOrders: 0, payingCustomers: 0, trend: [] }
  const months = Array.from({ length: 12 }, (_, index) => new Intl.DateTimeFormat("it-IT", { month: "short" }).format(new Date(2024, index, 1)).replace(".", ""))
  const financialMetrics = [unavailableMetric("Fatturato", "chart-3", months), unavailableMetric("Spese", "chart-5", months), unavailableMetric("Utile", "chart-1", months)]
  const now = new Date(); const today = now.toISOString().slice(0, 10); const month = today.slice(0, 7)
  const activeContacts = customers.reduce((sum, customer) => sum + (customer.contacts ?? []).filter((contact) => !contact.archivedAt).length, 0)
  const openActivities = activities.filter(({ activity }) => !["Completata", "Annullata"].includes(activity.status) && !activity.archivedAt)
  const priorityActivities = [...openActivities].sort((left, right) => { const priority = { Urgente: 0, Alta: 1, Media: 2, Bassa: 3 }; return priority[left.activity.priority] - priority[right.activity.priority] || (left.activity.dueDate || "9999").localeCompare(right.activity.dueDate || "9999") }).slice(0, 5)
  const deadlines = [
    ...openActivities.filter(({ activity }) => activity.dueDate).map(({ activity, customer }) => ({ id: `activity:${activity.id}`, date: activity.dueDate, title: activity.title, detail: customer.profile.company, href: `/dashboard/attivita?activityId=${activity.id}` })),
    ...store.appointments.filter((item) => item.startsAt.slice(0, 10) >= today).map((item) => ({ id: `appointment:${item.id}`, date: item.startsAt.slice(0, 10), title: item.title, detail: leads.find((lead) => lead.id === item.leadId)?.company ?? "Appuntamento", href: "/dashboard/commercial?view=appointments" })),
    ...projects.filter((item) => item.dueDate && !["delivered", "completed", "archived"].includes(item.status)).map((item) => ({ id: `project:${item.id}`, date: item.dueDate!, title: item.name, detail: "Consegna progetto", href: `/dashboard/progetti/${item.id}` })),
  ].filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
  const periodLabel = period === "today" ? "Oggi" : period === "month" ? "Questo mese" : period === "previous" ? "Mese scorso" : "Anno corrente"
  const kpis = [
    { label: "Venduto", value: euro.format(values.sold), icon: CircleDollarSign, href: "/dashboard/vendite", economic: true },
    { label: "Incassato netto", value: euro.format(values.netCollected), icon: BadgeEuro, href: "/dashboard/pagamenti", economic: true },
    { label: "Residuo", value: euro.format(values.residual), icon: CalendarClock, href: "/dashboard/ordini", economic: true },
    { label: "Lead del mese", value: String(leads.filter((lead) => lead.createdAt.slice(0, 7) === month).length), icon: ContactRound, href: "/dashboard/commercial/leads", economic: false },
    { label: "Nuovi contatti", value: String(activeContacts), icon: ContactRound, href: "/dashboard/clienti", economic: false },
    { label: "Clienti attivi", value: String(customers.filter((customer) => !customer.archivedAt && !["Sospeso", "Completato"].includes(customer.status)).length), icon: UsersRound, href: "/dashboard/clienti", economic: false },
  ]

  return <main className="@container/main flex w-full flex-col gap-6 p-4 pt-6 md:p-6 md:pt-7" data-dashboard-design="universal">
    <header><DashboardGreeting name={identity.currentUser.name} /><div className="mt-2 flex flex-wrap gap-1"><Badge variant="secondary">Vista agenzia autorizzata</Badge>{identity.currentUser.roles.map((role) => <Badge key={role} variant="secondary">{roleLabels[role]}</Badge>)}<RankingWinnerBadges userId={identity.currentUser.id} /></div></header>
    <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]"><Card className="min-h-[546px] min-w-0" data-commerce-source="server"><CardHeader className="gap-3 pb-2"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Andamento economico</CardTitle><CardDescription>Fatturato, spese e utile non sono ricostruiti nel browser.</CardDescription></div><Select value={period} onValueChange={(value) => setPeriod(value as Period)}><SelectTrigger className="w-44" aria-label="Periodo dashboard"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="today">Oggi</SelectItem><SelectItem value="month">Questo mese</SelectItem><SelectItem value="previous">Mese scorso</SelectItem><SelectItem value="year">Anno corrente</SelectItem></SelectContent></Select></div><div className="flex snap-x gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3">{financialMetrics.map((metric, index) => { const id = (["revenue", "expenses", "profit"] as const)[index]; const Icon = id === "revenue" ? TrendingUp : id === "expenses" ? ReceiptText : BadgeEuro; return <button key={id} type="button" aria-pressed={activeMetric === id} onClick={() => setActiveMetric(id)} className={`min-w-44 snap-start rounded-lg border p-3 text-left sm:min-w-0 ${activeMetric === id ? id === "revenue" ? "border-emerald-500 bg-emerald-500/5" : id === "expenses" ? "border-red-500 bg-red-500/5" : "border-violet-500 bg-violet-500/5" : "hover:bg-muted/40"}`}><span className="flex justify-between text-xs text-muted-foreground">{metric.title}<Icon className="size-4" /></span><strong className="mt-1 block text-base">{metric.value}</strong><span className="text-xs text-muted-foreground">{metric.change}</span></button> })}</div></CardHeader><CardContent className="px-2 pb-2 sm:px-4"><div className="mx-2 mb-2 rounded-lg border border-dashed bg-muted/20 p-3 text-center text-sm text-muted-foreground">Aggregati contabili del periodo non disponibili. Ordini, pagamenti e rimborsi restano visibili nei KPI server-authoritative.</div><FinancialSummaryChart metrics={financialMetrics} activeMetric={activeMetric} /></CardContent></Card><DashboardGoalsCard goals={missionGoals} periodLabel={periodLabel} loading={missionStatus === "loading"} error={missionStatus === "error"} canConfigure={canConfigureGoals} /></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{kpis.map(({ label, value, icon: Icon, href, economic }) => <Link key={label} href={href} className="rounded-xl border bg-card p-4 shadow-sm transition-colors hover:bg-muted/40"><span className="flex justify-between text-xs text-muted-foreground">{label}<Icon className="size-4" /></span><strong className="mt-2 block text-2xl">{economic && economicsStatus !== "loaded" ? economicsStatus === "error" ? "—" : "…" : value}</strong></Link>)}</section>
    <section className="grid gap-4 lg:grid-cols-3"><Card><CardHeader><CardTitle>Priorità di oggi</CardTitle><CardDescription>Aggiornate da stato, priorità, blocchi e scadenze.</CardDescription></CardHeader><CardContent className="space-y-2">{priorityActivities.map(({ activity, customer }) => <Button key={activity.id} asChild variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2"><Link href={`/dashboard/attivita?activityId=${activity.id}`}><ListTodo className="size-4" /><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{activity.title}</span><span className="block truncate text-xs text-muted-foreground">{customer.profile.company}</span></span><Badge variant="outline">{activity.priority}</Badge></Link></Button>)}{!priorityActivities.length ? <p className="text-sm text-muted-foreground">Nessuna priorità aperta.</p> : null}</CardContent></Card><Card><CardHeader><CardTitle>Progetti in corso</CardTitle><CardDescription>Avanzamento derivato dalle fasi reali.</CardDescription></CardHeader><CardContent className="space-y-3">{projects.filter((project) => !["completed", "delivered", "archived"].includes(project.status)).slice(0, 5).map((project) => { const progress = project.phases.length ? Math.round(project.phases.filter((phase) => phase.status === "completed").length / project.phases.length * 100) : 0; return <Link key={project.id} href={`/dashboard/progetti/${project.id}`} className="block rounded-lg border p-3 hover:bg-muted/40"><div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{project.name}</span><span>{progress}%</span></div><Progress className="mt-2" value={progress} /></Link> })}{!projects.length ? <p className="text-sm text-muted-foreground">Nessun progetto autorizzato.</p> : null}</CardContent></Card><Card><CardHeader><CardTitle>Scadenze clienti</CardTitle><CardDescription>Attività, appuntamenti e progetti autorizzati.</CardDescription></CardHeader><CardContent className="space-y-2">{deadlines.map((deadline) => <Button key={deadline.id} asChild variant="ghost" className="h-auto w-full justify-start px-2 py-2"><Link href={deadline.href}><Badge variant="outline">{new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(`${deadline.date}T12:00:00`))}</Badge><span className="min-w-0 text-left"><span className="block truncate text-sm font-medium">{deadline.title}</span><span className="block truncate text-xs text-muted-foreground">{deadline.detail}</span></span></Link></Button>)}{!deadlines.length ? <p className="text-sm text-muted-foreground">Nessuna scadenza futura.</p> : null}</CardContent></Card></section>
    <Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Campagne e qualità dei lead</CardTitle><CardDescription>I KPI economici non vengono derivati nel browser.</CardDescription></div><Button asChild variant="outline" size="sm"><Link href="/dashboard/campagne">Apri campagne</Link></Button></CardHeader><CardContent>{store.campaigns.length ? <div className="grid gap-3 md:grid-cols-3">{store.campaigns.slice(0, 3).map((campaign) => <Link key={campaign.id} href="/dashboard/campagne" className="rounded-lg border p-3 hover:bg-muted/40"><div className="flex justify-between gap-2"><span className="font-medium">{campaign.name}</span><Badge variant="secondary">{campaign.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Metriche economiche non disponibili.</p></Link>)}</div> : <div className="rounded-lg border border-dashed p-6 text-center"><ChartNoAxesCombined className="mx-auto size-5 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Nessuna campagna registrata</p><p className="text-xs text-muted-foreground">Nessun dato dimostrativo.</p></div>}</CardContent></Card>
  </main>
}
