"use client"

import Link from "next/link"
import { useEffect,useState } from "react"
import { BadgeEuro,CalendarClock,ChartNoAxesCombined,CircleDollarSign,ContactRound,ListTodo,ReceiptText,Target,TrendingUp,UsersRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card,CardContent,CardDescription,CardHeader,CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Select,SelectContent,SelectItem,SelectTrigger,SelectValue } from "@/components/ui/select"
import { RankingWinnerBadges } from "@/features/commercial/components/ranking-winner-badges"
import { FinancialSummaryChart } from "@/features/dashboard/components/financial-summary-chart"
import { roleLabels } from "@/features/identity/permissions"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { commerceApi,type CommerceEconomics } from "@/lib/tenant-commerce-api"
import { performanceApi,type MissionGoal } from "@/lib/tenant-performance-api"

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

export function SynchronizedDashboardOverview() {
  const { store, identity, leads, projects, activities } = useAuthorizedCommercial()
  const [period, setPeriod] = useState<Period>("month"); const [activeMetric, setActiveMetric] = useState<MetricId>("revenue")
  const [economics, setEconomics] = useState<CommerceEconomics | null>(null)
  const [economicsStatus, setEconomicsStatus] = useState<"loading" | "loaded" | "error">("loading")
  const [missionGoals, setMissionGoals] = useState<MissionGoal[]>([])
  const [missionStatus, setMissionStatus] = useState<"loading" | "loaded" | "error">("loading")
  const bounds = periodBounds(period)
  useEffect(() => {
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setEconomicsStatus("loading") })
    void commerceApi.economics(bounds.from, bounds.to).then((result) => {
      if (cancelled) return
      setEconomics(result)
      setEconomicsStatus("loaded")
    }).catch(() => {
      if (cancelled) return
      setEconomics(null)
      setEconomicsStatus("error")
    })
    return () => { cancelled = true }
  }, [bounds.from, bounds.to])
  useEffect(() => {
    let cancelled = false
    void performanceApi.state().then((result) => { if (!cancelled) { setMissionGoals(result.mission.items); setMissionStatus("loaded") } }).catch(() => { if (!cancelled) { setMissionGoals([]); setMissionStatus("error") } })
    return () => { cancelled = true }
  }, [])
  const values: CommerceEconomics = economics ?? { sold: 0, orderCount: 0, ordered: 0, grossCollected: 0, refunded: 0, netCollected: 0, residual: 0, openOrders: 0, payingCustomers: 0, trend: [] }
  const series = values.trend.map((item) => ({ month: item.period, revenue: item.ordered, expenses: item.refunded, profit: item.netCollected }))
  const makeMetric = (title: string, key: MetricId, token: "chart-1" | "chart-3" | "chart-5") => { const current = series.at(-1)?.[key] ?? 0; const previous = series.at(-2)?.[key] ?? 0; const value = key === "revenue" ? values.ordered : key === "expenses" ? values.refunded : values.netCollected; return { title, value: economicsStatus === "loaded" ? euro.format(value) : economicsStatus === "error" ? "Non disponibile" : "Caricamento…", change: previous ? `${current >= previous ? "+" : ""}${((current - previous) / Math.abs(previous) * 100).toFixed(1)}%` : "—", comparison: "aggregato dal server", token, series: series.map((item) => ({ month: item.month, value: item[key] })) } }
  const financialMetrics = [makeMetric("Ordinato", "revenue", "chart-3"), makeMetric("Rimborsato", "expenses", "chart-5"), makeMetric("Incassato netto", "profit", "chart-1")]
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
  return <main className="@container/main mx-auto flex w-full max-w-7xl flex-col gap-6 p-4 md:p-6">
    <header><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "numeric", month: "long" }).format(now)}</p><div className="mt-1 flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">Buon pomeriggio, {identity.currentUser.name}</h1><Badge variant="secondary">Vista agenzia autorizzata</Badge></div><div className="mt-2 flex flex-wrap gap-1">{identity.currentUser.roles.map((role) => <Badge key={role} variant="secondary">{roleLabels[role]}</Badge>)}<RankingWinnerBadges userId={identity.currentUser.id} /></div></header>
    <section className="grid gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(300px,1fr)]"><Card className="min-w-0" data-commerce-source="server"><CardHeader className="gap-3 pb-2"><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Andamento economico</CardTitle><CardDescription>Ordini, pagamenti confermati e rimborsi aggregati dal backend. Nessun fatturato fiscale è simulato.</CardDescription></div><Select value={period} onValueChange={(value) => setPeriod(value as Period)}><SelectTrigger className="w-44" aria-label="Periodo dashboard"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="today">Oggi</SelectItem><SelectItem value="month">Questo mese</SelectItem><SelectItem value="previous">Mese scorso</SelectItem><SelectItem value="year">Anno corrente</SelectItem></SelectContent></Select></div><div className="flex snap-x gap-2 overflow-x-auto pb-1 sm:grid sm:grid-cols-3">{financialMetrics.map((metric, index) => { const id = (["revenue", "expenses", "profit"] as const)[index]; const Icon = id === "revenue" ? TrendingUp : id === "expenses" ? ReceiptText : BadgeEuro; return <button key={id} type="button" aria-pressed={activeMetric === id} onClick={() => setActiveMetric(id)} className={`min-w-44 snap-start rounded-lg border p-3 text-left sm:min-w-0 ${activeMetric === id ? id === "revenue" ? "border-emerald-500 bg-emerald-500/5" : id === "expenses" ? "border-red-500 bg-red-500/5" : "border-violet-500 bg-violet-500/5" : "hover:bg-muted/40"}`}><span className="flex justify-between text-xs text-muted-foreground">{metric.title}<Icon className="size-4" /></span><strong className="mt-1 block text-xl">{metric.value}</strong><span className="text-xs text-muted-foreground">{metric.change}</span></button> })}</div></CardHeader><CardContent className="px-2 pb-2 sm:px-4"><FinancialSummaryChart metrics={financialMetrics} activeMetric={activeMetric} /></CardContent></Card>
      <Card data-mission-source="server"><CardHeader><CardTitle>Missione del periodo</CardTitle><CardDescription>Obiettivi e progresso aggregati dal backend.</CardDescription></CardHeader><CardContent className="space-y-4">{missionGoals.map((goal) => <Link key={goal.id} href="/dashboard/impostazioni" className="block rounded-lg border p-3 hover:bg-muted/40"><div className="flex justify-between gap-2 text-sm"><span className="font-medium">{goal.title}</span><span>{goal.progress == null ? "Protetto" : `${goal.progress}%`}</span></div><Progress className="mt-2" value={goal.progress || 0} /><p className="mt-1 text-xs text-muted-foreground">{goal.redacted || goal.currentValue == null ? "Valore redatto dal backend" : `${goal.unit === "currency" ? euro.format(goal.currentValue) : goal.currentValue} / ${goal.unit === "currency" ? euro.format(goal.targetValue) : goal.targetValue}`}</p></Link>)}{missionStatus === "loading" ? <p className="text-sm text-muted-foreground">Caricamento Missione…</p> : missionStatus === "error" ? <p role="alert" className="text-sm text-destructive">Missione non disponibile.</p> : !missionGoals.length ? <div className="rounded-lg border border-dashed p-5 text-center"><Target className="mx-auto size-5 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Nessun obiettivo attivo</p><p className="text-xs text-muted-foreground">Nessun valore dimostrativo viene mostrato.</p></div> : null}</CardContent></Card></section>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">{[["Venduto", euro.format(values.sold), CircleDollarSign, "/dashboard/vendite"], ["Incassato netto", euro.format(values.netCollected), BadgeEuro, "/dashboard/pagamenti"], ["Residuo", euro.format(values.residual), CalendarClock, "/dashboard/ordini"], ["Lead del mese", String(leads.filter((lead) => lead.createdAt.slice(0, 7) === month).length), ContactRound, "/dashboard/commercial/leads"], ["Clienti paganti", String(values.payingCustomers), UsersRound, "/dashboard/clienti"]].map(([label, value, Icon, href]) => <Link key={String(label)} href={String(href)} className="rounded-xl border bg-card p-4 shadow-sm hover:bg-muted/40"><span className="flex justify-between text-xs text-muted-foreground">{String(label)}<Icon className="size-4" /></span><strong className="mt-2 block text-2xl">{economicsStatus === "loaded" || !["Venduto", "Incassato netto", "Residuo", "Clienti paganti"].includes(String(label)) ? String(value) : economicsStatus === "error" ? "—" : "…"}</strong></Link>)}</section>
    <section className="grid gap-4 lg:grid-cols-3"><Card><CardHeader><CardTitle>Priorità di oggi</CardTitle><CardDescription>Aggiornate da stato, priorità, blocchi e scadenze.</CardDescription></CardHeader><CardContent className="space-y-2">{priorityActivities.map(({ activity, customer }) => <Button key={activity.id} asChild variant="ghost" className="h-auto w-full justify-start gap-3 px-2 py-2"><Link href={`/dashboard/attivita?activityId=${activity.id}`}><ListTodo className="size-4" /><span className="min-w-0 flex-1 text-left"><span className="block truncate text-sm font-medium">{activity.title}</span><span className="block truncate text-xs text-muted-foreground">{customer.profile.company}</span></span><Badge variant="outline">{activity.priority}</Badge></Link></Button>)}{!priorityActivities.length && <p className="text-sm text-muted-foreground">Nessuna priorità aperta.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Progetti in corso</CardTitle><CardDescription>Avanzamento derivato dalle fasi reali.</CardDescription></CardHeader><CardContent className="space-y-3">{projects.filter((project) => !["completed", "delivered", "archived"].includes(project.status)).slice(0, 5).map((project) => { const progress = project.phases.length ? Math.round(project.phases.filter((phase) => phase.status === "completed").length / project.phases.length * 100) : 0; return <Link key={project.id} href={`/dashboard/progetti/${project.id}`} className="block rounded-lg border p-3 hover:bg-muted/40"><div className="flex justify-between gap-2 text-sm"><span className="truncate font-medium">{project.name}</span><span>{progress}%</span></div><Progress className="mt-2" value={progress} /></Link> })}{!projects.length && <p className="text-sm text-muted-foreground">Nessun progetto autorizzato.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>Scadenze clienti</CardTitle><CardDescription>Attività, appuntamenti, progetti, contratti e rinnovi.</CardDescription></CardHeader><CardContent className="space-y-2">{deadlines.map((deadline) => <Button key={deadline.id} asChild variant="ghost" className="h-auto w-full justify-start px-2 py-2"><Link href={deadline.href}><Badge variant="outline">{new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(`${deadline.date}T12:00:00`))}</Badge><span className="min-w-0 text-left"><span className="block truncate text-sm font-medium">{deadline.title}</span><span className="block truncate text-xs text-muted-foreground">{deadline.detail}</span></span></Link></Button>)}{!deadlines.length && <p className="text-sm text-muted-foreground">Nessuna scadenza futura.</p>}</CardContent></Card></section>
    <Card><CardHeader className="flex-row items-start justify-between gap-3"><div><CardTitle>Campagne e qualità dei lead</CardTitle><CardDescription>I KPI economici delle campagne restano esclusi finché non sono aggregati dal backend; nessun ROAS è calcolato nel browser.</CardDescription></div><Button asChild variant="outline" size="sm"><Link href="/dashboard/campagne">Apri campagne</Link></Button></CardHeader><CardContent>{store.campaigns.length ? <div className="grid gap-3 md:grid-cols-3">{store.campaigns.slice(0, 3).map((campaign) => <Link key={campaign.id} href="/dashboard/campagne" className="rounded-lg border p-3 hover:bg-muted/40"><div className="flex justify-between gap-2"><span className="font-medium">{campaign.name}</span><Badge variant="secondary">{campaign.status}</Badge></div><p className="mt-1 text-xs text-muted-foreground">Metriche economiche non disponibili in questa fase.</p></Link>)}</div> : <div className="rounded-lg border border-dashed p-6 text-center"><ChartNoAxesCombined className="mx-auto size-5 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Nessuna campagna registrata</p><p className="text-xs text-muted-foreground">Nessun dato dimostrativo.</p></div>}</CardContent></Card>
  </main>
}
