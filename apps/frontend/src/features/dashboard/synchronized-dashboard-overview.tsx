"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { BadgeEuro, CalendarClock, ChartNoAxesCombined, CircleDollarSign, ContactRound, ListTodo, ReceiptText, TrendingUp, UsersRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Progress } from "@/components/ui/progress"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { calculateCampaignMetrics } from "@/features/commercial/commercial-campaigns"
import { formatGoalValue, getGoalMetricDefinition } from "@/features/commercial/commercial-goals"
import { RankingWinnerBadges } from "@/features/commercial/components/ranking-winner-badges"
import { CommercialRankingsPanel } from "@/features/commercial/components/commercial-workspace-page"
import { DashboardGreeting } from "@/features/dashboard/components/dashboard-greeting"
import { DashboardGoalsCard } from "@/features/dashboard/components/dashboard-goals-card"
import { FinancialSummaryChart } from "@/features/dashboard/components/financial-summary-chart"
import { roleLabels } from "@/features/identity/permissions"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { commerceApi, type CommerceEconomics } from "@/lib/tenant-commerce-api"
import { performanceApi, type MissionGoal } from "@/lib/tenant-performance-api"

const revenueDefinition = getGoalMetricDefinition("revenue")
const euro = { format: (value: number) => formatGoalValue(value, revenueDefinition) }
type Period = "today" | "month" | "previous" | "year" | "custom"
type MetricId = "revenue" | "expenses" | "profit"
const emptyEconomics: CommerceEconomics = { sold: 0, orderCount: 0, ordered: 0, grossCollected: 0, refunded: 0, netCollected: 0, residual: 0, openOrders: 0, payingCustomers: 0, trend: [] }
const dateKey = (value: Date) => value.toISOString().slice(0, 10)

function periodBounds(period: Period, customFrom: string, customTo: string) {
  const now = new Date(); const from = new Date(now); const to = new Date(now)
  if (period === "custom") return { from: customFrom, to: customTo }
  if (period === "today") return { from: dateKey(now), to: dateKey(now) }
  if (period === "month") { from.setDate(1); to.setMonth(to.getMonth() + 1, 0) }
  else if (period === "previous") { from.setMonth(from.getMonth() - 1, 1); to.setDate(0) }
  else { from.setMonth(0, 1); to.setMonth(11, 31) }
  return { from: dateKey(from), to: dateKey(to) }
}

function metricSeries(economics: CommerceEconomics, sales: ReturnType<typeof useAuthorizedCommercial>["store"]["sales"], year: number) {
  return Array.from({ length: 12 }, (_, index) => { const start = new Date(year, index, 1); const period = `${year}-${String(index + 1).padStart(2, "0")}`; const server = economics.trend.find((item) => item.period === period); const expenses = sales.filter((sale) => !sale.archivedAt && !["Annullata", "Persa"].includes(sale.status) && sale.date.startsWith(period)).reduce((sum, sale) => sum + (sale.cost ?? 0), 0); const revenue = server?.ordered ?? 0; const collected = server?.netCollected ?? 0; return { month: new Intl.DateTimeFormat("it-IT", { month: "short" }).format(start), revenue, expenses, profit: collected - expenses } })
}

export function SynchronizedDashboardOverview() {
  const { store, identity, leads, customers, projects, activities } = useAuthorizedCommercial()
  const [period, setPeriod] = useState<Period>("month"); const [activeMetric, setActiveMetric] = useState<MetricId>("revenue")
  const [customOpen, setCustomOpen] = useState(false)
  const [missionGoals, setMissionGoals] = useState<MissionGoal[]>([])
  const [missionStatus, setMissionStatus] = useState<"loading" | "loaded" | "error">("loading")
  const [canConfigureGoals, setCanConfigureGoals] = useState(false)
  const [customFrom, setCustomFrom] = useState(() => `${new Date().getFullYear()}-01-01`)
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().slice(0, 10))
  const bounds = periodBounds(period, customFrom, customTo)
  const [economics, setEconomics] = useState<CommerceEconomics>(emptyEconomics)
  const [annualEconomics, setAnnualEconomics] = useState<CommerceEconomics>(emptyEconomics)
  const [previousAnnualEconomics, setPreviousAnnualEconomics] = useState<CommerceEconomics>(emptyEconomics)
  const [economicsStatus, setEconomicsStatus] = useState<"loading" | "loaded" | "error">("loading")
  const [, setEconomicsError] = useState<string>()
  useEffect(() => {
    let cancelled = false
    void performanceApi.state().then((result) => {
      if (!cancelled) { setMissionGoals(result.mission.items); setCanConfigureGoals(result.permissions.canManageGoals); setMissionStatus("loaded") }
    }).catch(() => { if (!cancelled) { setMissionGoals([]); setMissionStatus("error") } })
    return () => { cancelled = true }
  }, [])
  useEffect(() => {
    let cancelled = false
    const year = new Date().getFullYear()
    const loadingTimer = window.setTimeout(() => { if (!cancelled) setEconomicsStatus("loading") }, 0)
    void Promise.all([
      commerceApi.economics(bounds.from, bounds.to),
      commerceApi.economics(`${year}-01-01`, `${year}-12-31`),
      commerceApi.economics(`${year - 1}-01-01`, `${year - 1}-12-31`),
    ]).then(([selected, annual, previousAnnual]) => {
      if (cancelled) return
      setEconomics(selected); setAnnualEconomics(annual); setPreviousAnnualEconomics(previousAnnual); setEconomicsError(undefined); setEconomicsStatus("loaded")
    }).catch((cause) => {
      if (cancelled) return
      setEconomics(emptyEconomics); setAnnualEconomics(emptyEconomics); setPreviousAnnualEconomics(emptyEconomics); setEconomicsError(cause instanceof Error ? cause.message : "Dati economici non disponibili"); setEconomicsStatus("error")
    })
    return () => { cancelled = true; window.clearTimeout(loadingTimer) }
  }, [bounds.from, bounds.to])
  const expenses = store.sales.filter((sale) => !sale.archivedAt && !["Annullata", "Persa"].includes(sale.status) && sale.date >= bounds.from && sale.date <= bounds.to).reduce((sum, sale) => sum + (sale.cost ?? 0), 0)
  const year = new Date().getFullYear()
  const series = metricSeries(annualEconomics, store.sales, year)
  const previousSeries = metricSeries(previousAnnualEconomics, store.sales, year - 1)
  const makeMetric = (title: string, key: MetricId, token: "chart-1" | "chart-3" | "chart-5") => { const current = series[new Date().getMonth()]?.[key] ?? 0; const previous = previousSeries[new Date().getMonth()]?.[key] ?? 0; return { title, value: euro.format(key === "revenue" ? economics.ordered : key === "expenses" ? expenses : economics.netCollected - expenses), change: previous ? `${current >= previous ? "+" : ""}${((current - previous) / Math.abs(previous) * 100).toFixed(1)}%` : "—", comparison: "da dati persistenti", token, series: series.map((item) => ({ month: item.month, value: item[key] })), previousSeries: previousSeries.map((item) => ({ month: item.month, value: item[key] })) } }
  const financialMetrics = [makeMetric("Fatturato", "revenue", "chart-3"), makeMetric("Spese", "expenses", "chart-5"), makeMetric("Utile", "profit", "chart-1")]
  const signed = new Set(store.contracts.filter((contract) => contract.status === "Firmato" && !contract.replacedById && !contract.archivedAt).map((contract) => contract.orderId))
  const campaignRows = store.campaigns.map((campaign) => ({ campaign, metrics: calculateCampaignMetrics(campaign, leads, store.sales, store.orders, store.payments, signed) })).sort((left, right) => right.metrics.netRoas - left.metrics.netRoas)
  const totalCampaignSpend = campaignRows.reduce((sum, row) => sum + row.metrics.spend, 0); const campaignNet = campaignRows.reduce((sum, row) => sum + row.metrics.netCollected, 0)
  const now = new Date(); const today = now.toISOString().slice(0, 10); const month = today.slice(0, 7)
  const openActivities = activities.filter(({ activity }) => !["Completata", "Annullata"].includes(activity.status) && !activity.archivedAt)
  const priorityActivities = [...openActivities].sort((left, right) => { const priority = { Urgente: 0, Alta: 1, Media: 2, Bassa: 3 }; return priority[left.activity.priority] - priority[right.activity.priority] || (left.activity.dueDate || "9999").localeCompare(right.activity.dueDate || "9999") }).slice(0, 5)
  const deadlines = [
    ...openActivities.filter(({ activity }) => activity.dueDate).map(({ activity, customer }) => ({ id: `activity:${activity.id}`, date: activity.dueDate, title: activity.title, detail: customer.profile.company, href: `/dashboard/attivita?activityId=${activity.id}` })),
    ...store.appointments.filter((item) => item.startsAt.slice(0, 10) >= today).map((item) => ({ id: `appointment:${item.id}`, date: item.startsAt.slice(0, 10), title: item.title, detail: leads.find((lead) => lead.id === item.leadId)?.company ?? "Appuntamento", href: "/dashboard/commercial?view=appointments" })),
    ...projects.filter((item) => item.dueDate && !["delivered", "completed", "archived"].includes(item.status)).map((item) => ({ id: `project:${item.id}`, date: item.dueDate!, title: item.name, detail: "Consegna progetto", href: `/dashboard/progetti/${item.id}` })),
    ...store.contracts.filter((item) => item.signatureDueAt && !["Firmato", "Sostituito", "Archiviato"].includes(item.status)).map((item) => ({ id: `contract:${item.id}`, date: item.signatureDueAt!, title: item.title, detail: "Firma contratto", href: "/dashboard/contratti" })),
    ...store.renewals.filter((item) => !["Pagato", "Annullato"].includes(item.status)).map((item) => ({ id: `renewal:${item.id}`, date: item.nextDueAt, title: item.planName, detail: "Rinnovo", href: "/dashboard/rinnovi" })),
  ].filter((item) => item.date >= today).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6)
  const dashboardGoals = missionGoals.map((goal) => ({ goal, current: goal.currentValue ?? 0 }))
  const periodLabel = period === "today" ? "Oggi" : period === "month" ? "Questo mese" : period === "previous" ? "Mese scorso" : period === "year" ? "Anno corrente" : `${bounds.from} – ${bounds.to}`
  const hasEconomicMovements = economics.ordered !== 0 || economics.netCollected !== 0 || expenses !== 0
  const activeContacts = customers.reduce((sum, customer) => sum + (customer.contacts ?? []).filter((contact) => !contact.archivedAt).length, 0)
  return <main className="@container/main mx-auto flex w-full max-w-none flex-col gap-6 p-4 md:p-6">
    <header><DashboardGreeting name={identity.currentUser.name} timeZone={identity.personalPreferences.timeZone} /><div className="mt-2 flex flex-wrap gap-1"><Badge variant="secondary">Vista agenzia autorizzata</Badge>{identity.currentUser.roles.map((role) => <Badge key={role} variant="secondary">{roleLabels[role]}</Badge>)}<RankingWinnerBadges userId={identity.currentUser.id} /></div></header>
    <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]"><Card className="min-w-0" aria-busy={economicsStatus === "loading"}><CardHeader className="gap-3 pb-2"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Andamento economico</CardTitle><CardDescription>Anno corrente e precedente da ordini, pagamenti, rimborsi e costi reali.</CardDescription></div><Select value={period} onValueChange={(value) => { if (value === "custom") setCustomOpen(true); else setPeriod(value as Period) }}><SelectTrigger className="w-44" aria-label="Periodo dashboard"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="today">Oggi</SelectItem><SelectItem value="month">Questo mese</SelectItem><SelectItem value="previous">Mese scorso</SelectItem><SelectItem value="year">Anno corrente</SelectItem><SelectItem value="custom">Personalizzato</SelectItem></SelectContent></Select></div><div className="flex snap-x gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3">{financialMetrics.map((metric, index) => { const id = (["revenue", "expenses", "profit"] as const)[index]; const Icon = id === "revenue" ? TrendingUp : id === "expenses" ? ReceiptText : BadgeEuro; return <button key={id} type="button" aria-pressed={activeMetric === id} onClick={() => setActiveMetric(id)} className={`min-w-44 snap-start rounded-lg border p-3 text-left sm:min-w-0 ${activeMetric === id ? id === "revenue" ? "border-emerald-500 bg-emerald-500/5" : id === "expenses" ? "border-red-500 bg-red-500/5" : "border-violet-500 bg-violet-500/5" : "hover:bg-muted/40"}`}><span className="flex justify-between text-xs text-muted-foreground">{metric.title}<Icon className="size-4" /></span><strong className="mt-1 block text-xl">{metric.value}</strong><span className="text-xs text-muted-foreground">{metric.change}</span></button> })}</div></CardHeader><CardContent className="px-2 pb-2 sm:px-4">{economicsStatus === "loaded" && !hasEconomicMovements && <div className="mx-2 mb-2 rounded-lg border border-dashed bg-muted/20 p-3 text-center text-sm text-muted-foreground">Nessun movimento confermato nel periodo. Registra ordini, pagamenti o costi per visualizzare l’andamento economico.</div>}<FinancialSummaryChart metrics={financialMetrics} activeMetric={activeMetric} /></CardContent></Card>
      <DashboardGoalsCard goals={dashboardGoals} periodLabel={periodLabel} loading={missionStatus === "loading"} canConfigure={canConfigureGoals} /></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">{[["Venduto", euro.format(economics.sold), CircleDollarSign, "/dashboard/ordini"], ["Incassato netto", euro.format(economics.netCollected), BadgeEuro, "/dashboard/pagamenti"], ["Residuo", euro.format(economics.residual), CalendarClock, "/dashboard/ordini"], ["Lead del mese", String(leads.filter((lead) => lead.createdAt.slice(0, 7) === month).length), ContactRound, "/dashboard/commercial/leads"], ["Nuovi contatti", String(activeContacts), ContactRound, "/dashboard/clienti"], ["Clienti attivi", String(customers.filter((customer) => !customer.archivedAt && !["Sospeso", "Completato"].includes(customer.status)).length), UsersRound, "/dashboard/clienti"]].map(([label, value, Icon, href]) => <Link key={String(label)} href={String(href)} className="rounded-xl border bg-card p-4 shadow-sm hover:bg-muted/40"><span className="flex justify-between text-xs text-muted-foreground">{String(label)}<Icon className="size-4" /></span><strong className="mt-2 block text-2xl">{String(value)}</strong></Link>)}</section>
    <section className="grid gap-4 lg:grid-cols-3"><Card><CardHeader><CardTitle>Priorità di oggi</CardTitle><CardDescription>Aggiornate da stato, priorità, blocchi e scadenze.</CardDescription></CardHeader><CardContent className="space-y-2">{priorityActivities.map(({ activity, customer }) => <Button key={activity.id} asChild variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2"><Link href={`/dashboard/attivita?activityId=${activity.id}`}><ListTodo className="size-4" /><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{activity.title}</span><span className="block truncate text-xs text-muted-foreground">{customer.profile.company}</span></span><Badge variant="outline">{activity.priority}</Badge></Link></Button>)}{!priorityActivities.length && <p className="text-sm text-muted-foreground">Nessuna priorità aperta.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Progetti in corso</CardTitle><CardDescription>Avanzamento derivato dalle fasi reali.</CardDescription></CardHeader><CardContent className="space-y-3">{projects.filter((project) => !["completed", "delivered", "archived"].includes(project.status)).slice(0, 5).map((project) => { const progress = project.phases.length ? Math.round(project.phases.filter((phase) => phase.status === "completed").length / project.phases.length * 100) : 0; return <Link key={project.id} href={`/dashboard/progetti/${project.id}`} className="block rounded-lg border p-3 hover:bg-muted/40"><div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{project.name}</span><span>{progress}%</span></div><Progress className="mt-2" value={progress} /></Link> })}{!projects.length && <p className="text-sm text-muted-foreground">Nessun progetto autorizzato.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Scadenze clienti</CardTitle><CardDescription>Attività, appuntamenti, progetti, contratti e rinnovi.</CardDescription></CardHeader><CardContent className="space-y-2">{deadlines.map((deadline) => <Button key={deadline.id} asChild variant="ghost" className="h-auto w-full justify-start px-2 py-2"><Link href={deadline.href}><Badge variant="outline">{new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(`${deadline.date}T12:00:00`))}</Badge><span className="min-w-0 text-left"><span className="block truncate text-sm font-medium">{deadline.title}</span><span className="block truncate text-xs text-muted-foreground">{deadline.detail}</span></span></Link></Button>)}{!deadlines.length && <p className="text-sm text-muted-foreground">Nessuna scadenza futura.</p>}</CardContent></Card></section>
    <Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Campagne e qualità dei lead</CardTitle><CardDescription>Incassi reali e rimborsi, non il semplice stato “Vinto”.</CardDescription></div><Button asChild variant="outline" size="sm"><Link href="/dashboard/campagne">Apri campagne</Link></Button></CardHeader><CardContent>{campaignRows.length ? <div className="grid gap-3 md:grid-cols-3">{campaignRows.slice(0, 3).map(({ campaign, metrics }) => <Link key={campaign.id} href="/dashboard/campagne" className="rounded-lg border p-3 hover:bg-muted/40"><div className="flex justify-between gap-2"><span className="font-medium">{campaign.name}</span><Badge variant="secondary">{metrics.netRoas.toFixed(1)}×</Badge></div><p className="mt-1 text-xs text-muted-foreground">{metrics.leads} lead · {metrics.payingCustomers} paganti · {euro.format(metrics.netCollected)} netti</p></Link>)}</div> : <div className="rounded-lg border border-dashed p-6 text-center"><ChartNoAxesCombined className="mx-auto size-5 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Nessuna campagna registrata</p><p className="text-xs text-muted-foreground">ROAS {totalCampaignSpend ? (campaignNet / totalCampaignSpend).toFixed(1) : "0,0"}× · nessun dato dimostrativo.</p></div>}</CardContent></Card>
    <CommercialRankingsPanel compact />
    <Dialog open={customOpen} onOpenChange={setCustomOpen}><DialogContent><DialogHeader><DialogTitle>Periodo personalizzato</DialogTitle><DialogDescription>Seleziona l’intervallo usato da KPI, obiettivi e andamento economico.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><label className="text-sm font-medium">Dal<Input type="date" value={customFrom} onChange={(event) => setCustomFrom(event.target.value)} /></label><label className="text-sm font-medium">Al<Input type="date" value={customTo} onChange={(event) => setCustomTo(event.target.value)} /></label></div><DialogFooter><Button variant="outline" onClick={() => setCustomOpen(false)}>Annulla</Button><Button disabled={!customFrom || !customTo || customFrom > customTo} onClick={() => { setPeriod("custom"); setCustomOpen(false) }}>Applica periodo</Button></DialogFooter></DialogContent></Dialog>
  </main>
}
