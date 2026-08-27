"use client"

import Link from "next/link"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useMemo, useState } from "react"
import { ArrowDown, ArrowUp, Award, Coins, Gift, History, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import type { PointLedgerEntry, PointRewardType } from "@/features/commercial/commercial-collaboration"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"

const rewardLabels: Record<PointRewardType, string> = { voucher: "Voucher", cash_bonus: "Premio economico", day_off: "Giornata libera", benefit: "Benefit" }
const statusLabels = { provisional: "Provvisorio", approved: "Approvato", reversed: "Stornato", converted: "Convertito", cancelled: "Annullato" }
const dateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" })

function recordHref(entry: PointLedgerEntry) {
  if (entry.recordType === "lead") return `/dashboard/commercial/leads/${entry.recordId}`
  if (entry.recordType === "customer") return `/dashboard/clienti/${entry.recordId}`
  if (entry.recordType === "project") return `/dashboard/progetti?projectId=${entry.recordId}`
  if (entry.recordType === "activity") return `/dashboard/attivita?activityId=${entry.recordId}`
  if (entry.recordType === "payment") return "/dashboard/pagamenti"
  if (entry.recordType === "support_ticket") return `/dashboard/supporto?ticketId=${entry.recordId}`
  return undefined
}

export function CommercialPointsButton() {
  const store = useCommercialLeads()
  const identity = useDoflowIdentity()
  const [rewardOpen, setRewardOpen] = useState(false)
  const [points, setPoints] = useState("")
  const [rewardType, setRewardType] = useState<PointRewardType>("voucher")
  const [reason, setReason] = useState("")
  const [movementFilter, setMovementFilter] = useState<"all" | "bonus" | "penalty" | "conversion">("all")
  const own = useMemo(() => store.pointLedger.filter((entry) => entry.userId === identity.currentUser.id), [identity.currentUser.id, store.pointLedger])
  const approvedBalance = own.filter((entry) => ["approved", "converted"].includes(entry.status)).reduce((sum, entry) => sum + entry.points, 0)
  const locked = store.pointRedemptions.filter((item) => item.userId === identity.currentUser.id && ["in_review", "approved"].includes(item.status)).reduce((sum, item) => sum + item.points, 0)
  const month = new Date().toISOString().slice(0, 7)
  const monthlyEarned = own.filter((entry) => entry.status === "approved" && entry.points > 0 && entry.occurredAt.startsWith(month)).reduce((sum, entry) => sum + entry.points, 0)
  const monthlyDeducted = own.filter((entry) => entry.status === "approved" && entry.points < 0 && entry.occurredAt.startsWith(month)).reduce((sum, entry) => sum + Math.abs(entry.points), 0)
  const converted = Math.abs(own.filter((entry) => entry.status === "converted").reduce((sum, entry) => sum + entry.points, 0))
  const available = Math.max(0, approvedBalance - locked)
  const monthKeys = Array.from({ length: 6 }, (_, index) => { const value = new Date(); value.setMonth(value.getMonth() - (5 - index)); return value.toISOString().slice(0, 7) })
  const trend = monthKeys.map((key) => ({ key, value: own.filter((entry) => entry.status === "approved" && entry.occurredAt.startsWith(key)).reduce((sum, entry) => sum + entry.points, 0) }))
  const trendMax = Math.max(1, ...trend.map((item) => Math.abs(item.value)))
  const latestRanking = [...store.rankingSnapshots].filter((item) => item.status !== "revoked" && item.scores.some((score) => score.userId === identity.currentUser.id)).sort((a, b) => b.period.localeCompare(a.period))[0]
  const rankingPosition = latestRanking ? [...latestRanking.scores].sort((a, b) => b.score - a.score).findIndex((item) => item.userId === identity.currentUser.id) + 1 : 0
  const filteredMovements = [...own].filter((entry) => movementFilter === "all" || movementFilter === "bonus" && entry.points > 0 && entry.category !== "conversion" || movementFilter === "penalty" && entry.points < 0 && entry.category !== "conversion" || movementFilter === "conversion" && entry.category === "conversion").sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))

  const requestReward = () => {
    const result = store.requestPointRedemption({ points: Number(points), rewardType, reason })
    if (!result.ok) return toast.error(result.message)
    toast.success("Richiesta premio inviata alla revisione")
    setRewardOpen(false); setPoints(""); setReason("")
  }

  return <>
    <Sheet>
      <SheetTrigger asChild><Button size="sm" variant="outline"><Coins />I miei punti</Button></SheetTrigger>
      <SheetContent className="w-full gap-0 sm:max-w-xl">
        <SheetHeader className="border-b pr-14"><SheetTitle className="flex items-center gap-2"><Coins className="size-5 text-violet-500" />I miei punti</SheetTitle><SheetDescription>Saldo operativo reale, distinto dal punteggio classifica normalizzato su 100.</SheetDescription></SheetHeader>
        <div className="min-h-0 flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <PointKpi label="Saldo" value={approvedBalance} /><PointKpi label="Disponibili" value={available} /><PointKpi label="Guadagnati nel mese" value={monthlyEarned} positive /><PointKpi label="Penalità nel mese" value={monthlyDeducted} negative /><PointKpi label="Posizione consolidata" value={rankingPosition} suffix={rankingPosition ? "°" : "—"} />
          </div>
          <div className="mt-4 rounded-xl border p-3"><div className="mb-3 flex items-center justify-between"><strong>Andamento 6 mesi</strong><span className="text-xs text-muted-foreground">Convertiti: {converted} pt</span></div><div className="flex h-24 items-end gap-2">{trend.map((item) => <div key={item.key} className="flex min-w-0 flex-1 flex-col items-center gap-1"><div className={`w-full rounded-t ${item.value < 0 ? "bg-red-400" : "bg-violet-500"}`} style={{ height: `${Math.max(4, Math.abs(item.value) / trendMax * 64)}px` }} title={`${item.key}: ${item.value} punti`} /><span className="text-[10px] text-muted-foreground">{item.key.slice(5)}</span></div>)}</div></div>
          <Tabs defaultValue="movements" className="mt-4"><TabsList className="grid w-full grid-cols-2"><TabsTrigger value="movements">Movimenti</TabsTrigger><TabsTrigger value="rewards">Premi</TabsTrigger></TabsList>
            <TabsContent value="movements" className="space-y-2 pt-2"><div className="flex flex-wrap gap-1" aria-label="Filtri movimenti punti">{([['all', 'Tutti'], ['bonus', 'Bonus'], ['penalty', 'Penalità'], ['conversion', 'Conversioni']] as const).map(([value, label]) => <Button key={value} size="sm" variant={movementFilter === value ? "secondary" : "ghost"} aria-pressed={movementFilter === value} onClick={() => setMovementFilter(value)}>{label}</Button>)}</div>{filteredMovements.map((entry) => <article key={entry.id} className="rounded-lg border p-3"><div className="flex items-start gap-3"><span className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full ${entry.points >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>{entry.points >= 0 ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong>{entry.points > 0 ? "+" : ""}{entry.points} pt</strong><Badge variant="outline">{statusLabels[entry.status]}</Badge></div><p className="mt-1 text-sm">{entry.reason}</p><p className="mt-1 text-xs text-muted-foreground">{dateTime.format(new Date(entry.occurredAt))} · {entry.rule}{entry.approvedBy ? ` · approvato da ${identity.users.find((user) => user.id === entry.approvedBy)?.name ?? entry.approvedBy}` : ""}</p>{recordHref(entry) && <Button asChild size="sm" variant="link" className="h-auto p-0"><Link href={recordHref(entry)!}>Apri record collegato</Link></Button>}</div></div></article>)}{!filteredMovements.length && <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Nessun movimento per il filtro selezionato.</p>}</TabsContent>
            <TabsContent value="rewards" className="space-y-3 pt-2"><div className="rounded-lg border bg-muted/30 p-3 text-sm"><p><strong>Conversione:</strong> {store.pointPolicy.redemptionPointsUnit} punti = {store.pointPolicy.redemptionEuroValue} € indicativi.</p><p className="mt-1 text-muted-foreground">Soglia minima {store.pointPolicy.redemptionMinimumPoints} pt · massimo mensile {store.pointPolicy.redemptionMonthlyMaximumPoints} pt · scadenza {store.pointPolicy.pointExpiryMonths} mesi.</p><p className="mt-2 text-xs text-muted-foreground">Il valore è un beneficio interno stimato, non denaro disponibile né una transazione fiscale.</p></div><Button className="w-full" disabled={available < store.pointPolicy.redemptionMinimumPoints} onClick={() => setRewardOpen(true)}><Gift />Richiedi premio</Button>{store.pointRedemptions.map((item) => <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3"><Gift className="size-4" /><div className="min-w-0 flex-1"><p className="font-medium">{rewardLabels[item.rewardType]} · {item.points} pt</p><p className="text-xs text-muted-foreground">{dateTime.format(new Date(item.requestedAt))}</p></div><Badge variant="outline">{item.status.replace("_", " ")}</Badge></div>)}</TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
    <Dialog open={rewardOpen} onOpenChange={setRewardOpen}><DialogContent><DialogHeader><DialogTitle>Richiedi conversione premio</DialogTitle><DialogDescription>I punti restano bloccati durante la revisione e vengono convertiti solo dopo approvazione.</DialogDescription></DialogHeader><Label htmlFor="reward-points">Punti</Label><Input id="reward-points" type="number" min={store.pointPolicy.redemptionMinimumPoints} step={store.pointPolicy.redemptionPointsUnit} value={points} onChange={(event) => setPoints(event.target.value)} /><Label>Tipo premio</Label><Select value={rewardType} onValueChange={(value) => setRewardType(value as PointRewardType)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(rewardLabels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select><Label htmlFor="reward-reason">Motivazione</Label><Textarea id="reward-reason" value={reason} onChange={(event) => setReason(event.target.value)} /><DialogFooter><Button variant="outline" onClick={() => setRewardOpen(false)}>Annulla</Button><Button onClick={requestReward}>Invia richiesta</Button></DialogFooter></DialogContent></Dialog>
  </>
}

export function PersonalPointsHistoryPage() {
  const store = useCommercialLeads()
  const identity = useDoflowIdentity()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const approvedOnly = searchParams.get("status") === "approved"
  const dashboardScope = searchParams.get("scope") === "mine"
  const own = useMemo(() => store.pointLedger.filter((entry) => entry.userId === identity.currentUser.id), [identity.currentUser.id, store.pointLedger])
  const entries = useMemo(() => [...own].filter((entry) => !approvedOnly || entry.status === "approved").sort((left, right) => right.occurredAt.localeCompare(left.occurredAt)), [approvedOnly, own])
  const approvedPoints = own.filter((entry) => entry.status === "approved").reduce((sum, entry) => sum + entry.points, 0)
  const approvedBalance = own.filter((entry) => ["approved", "converted"].includes(entry.status)).reduce((sum, entry) => sum + entry.points, 0)
  const locked = store.pointRedemptions.filter((item) => item.userId === identity.currentUser.id && ["in_review", "approved"].includes(item.status)).reduce((sum, item) => sum + item.points, 0)
  const available = Math.max(0, approvedBalance - locked)

  return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Panoramica personale</p><h1 className="text-2xl font-semibold">Cronologia punti</h1><p className="text-sm text-muted-foreground">Movimenti personali approvati, penalità e collegamenti verificabili.</p></div><Button variant="outline" asChild><Link href="/dashboard">Torna alla dashboard</Link></Button></header>
    <section className="grid gap-3 sm:grid-cols-2"><PointKpi label="Punti approvati" value={approvedPoints} /><PointKpi label="Saldo disponibile" value={available} /></section>
    <Card><CardContent className="flex flex-wrap items-center gap-2 p-3">{dashboardScope && <Badge variant="secondary">Solo i miei</Badge>}{approvedOnly && <Badge variant="secondary">Movimenti approvati</Badge>}<Badge variant="outline">{entries.length} movimenti</Badge>{(dashboardScope || approvedOnly) && <Button className="ml-auto" size="sm" variant="ghost" onClick={() => router.replace(pathname)}>Azzera filtri</Button>}</CardContent></Card>
    <section className="space-y-2" aria-label="Movimenti punti personali">{entries.map((entry) => <Card key={entry.id}><CardContent className="flex items-start gap-3 p-4"><span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${entry.points >= 0 ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"}`}>{entry.points >= 0 ? <ArrowUp className="size-4" /> : <ArrowDown className="size-4" />}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><strong className="tabular-nums">{entry.points > 0 ? "+" : ""}{entry.points} pt</strong><Badge variant="outline">{statusLabels[entry.status]}</Badge></div><p className="mt-1 text-sm">{entry.reason}</p><p className="mt-1 text-xs text-muted-foreground">{dateTime.format(new Date(entry.occurredAt))} · {entry.rule}{entry.approvedBy ? ` · approvato da ${identity.users.find((user) => user.id === entry.approvedBy)?.name ?? entry.approvedBy}` : " · nessun approvatore"}</p>{recordHref(entry) && <Button asChild size="sm" variant="link" className="h-auto p-0"><Link href={recordHref(entry)!}>Apri record collegato</Link></Button>}</div></CardContent></Card>)}{!entries.length && <Card className="border-dashed"><CardContent className="py-12 text-center text-sm text-muted-foreground">Nessun movimento corrispondente.</CardContent></Card>}</section>
  </main>
}

function PointKpi({ label, value, positive, negative, suffix = "pt" }: { label: string; value: number; positive?: boolean; negative?: boolean; suffix?: string }) {
  return <div className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className={`mt-1 text-xl font-semibold tabular-nums ${positive ? "text-emerald-600" : negative ? "text-red-600" : ""}`}>{suffix === "—" && !value ? "" : value} <span className="text-xs font-normal">{suffix}</span></p></div>
}

export function PointAdministrationSettings() {
  const store = useCommercialLeads()
  const identity = useDoflowIdentity()
  const [userId, setUserId] = useState(identity.users[0]?.id ?? "")
  const [adjustment, setAdjustment] = useState("")
  const [reason, setReason] = useState("")
  if (!identity.hasCapability("managePointRules")) return null
  const numericRules: Array<[keyof typeof store.pointPolicy, string]> = [["onTimeBase", "Attività puntuale"], ["lateBasePenalty", "Ritardo iniziale"], ["lateAdditionalPerDay", "Ogni giorno ulteriore"], ["lateMaximum", "Limite massimo penalità ritardo"], ["earlyTwoDayBonus", "Anticipo ≥2 giorni"], ["earlyFiveDayBonus", "Anticipo ≥5 giorni"], ["urgentOnTimeBonus", "Urgente puntuale"], ["qaFirstPass", "QA al primo passaggio"], ["qaRejected", "QA respinto"], ["firstReopenPenalty", "Prima riapertura"], ["secondReopenPenalty", "Seconda riapertura"], ["correctionRecovery", "Correzione approvata"], ["deliveredProject", "Progetto consegnato"], ["approvedSupport", "Supporto approvato"], ["supportEarlyBonus", "Supporto anticipato"], ["supportSlaPenalty", "SLA superato"], ["qualifiedAppointment", "Appuntamento qualificato"], ["followupOnTime", "Follow-up puntuale"], ["payingCustomer", "Nuovo cliente pagante"], ["collectedPerHundredEuro", "Ogni 100 € incassati"], ["redemptionMinimumPoints", "Soglia minima premio"], ["redemptionPointsUnit", "Unità punti conversione"], ["redemptionEuroValue", "Valore € per unità"], ["redemptionMonthlyMaximumPoints", "Massimo mensile convertibile"], ["pointExpiryMonths", "Scadenza punti (mesi)"], ["rewardAdministratorEnabled", "Premi abilitati: amministratori (1/0)"], ["rewardCommercialEnabled", "Premi abilitati: commerciali (1/0)"], ["rewardDeveloperEnabled", "Premi abilitati: sviluppatori (1/0)"], ["rewardProjectManagerEnabled", "Premi abilitati: Project Manager (1/0)"]]
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><ShieldCheck className="size-4" />Punti, premi e penalità</CardTitle><CardDescription>Regole amministrative del saldo operativo. Il punteggio classifica resta una misura distinta e normalizzata su 100.</CardDescription></CardHeader><CardContent className="space-y-5"><div className="grid gap-3 sm:grid-cols-2">{numericRules.map(([key, label]) => <div key={key}><Label htmlFor={`point-${key}`}>{label}</Label><Input id={`point-${key}`} type="number" value={store.pointPolicy[key]} onChange={(event) => store.updatePointPolicy({ [key]: Number(event.target.value) })} /></div>)}</div><div className="rounded-xl border p-4"><h3 className="font-medium">Bonus, penalità o rettifica</h3><p className="mb-3 text-xs text-muted-foreground">Ogni rettifica crea un nuovo movimento. Gli originali non vengono modificati.</p><div className="grid gap-3 sm:grid-cols-3"><Select value={userId} onValueChange={setUserId}><SelectTrigger aria-label="Collaboratore"><SelectValue /></SelectTrigger><SelectContent>{identity.users.map((user) => <SelectItem key={user.id} value={user.id}>{user.name}</SelectItem>)}</SelectContent></Select><Input aria-label="Punti rettifica" type="number" value={adjustment} onChange={(event) => setAdjustment(event.target.value)} placeholder="+10 oppure -5" /><Input aria-label="Motivazione rettifica" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Motivazione obbligatoria" /></div><Button className="mt-3" onClick={() => { const id = store.addManualPointAdjustment({ userId, points: Number(adjustment), reason }); if (!id) return toast.error("Rettifica non valida"); setAdjustment(""); setReason(""); toast.success("Movimento registrato") }}>Registra movimento</Button></div><div><h3 className="mb-2 flex items-center gap-2 font-medium"><History className="size-4" />Richieste premio</h3><div className="space-y-2">{store.pointRedemptions.map((item) => <div key={item.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3"><Award className="size-4" /><div className="min-w-0 flex-1"><p className="font-medium">{identity.users.find((user) => user.id === item.userId)?.name} · {item.points} pt · {rewardLabels[item.rewardType]}</p><p className="text-xs text-muted-foreground">{item.reason}</p></div><Badge variant="outline">{item.status}</Badge>{item.status === "in_review" && <><Button size="sm" variant="outline" onClick={() => { if (store.decidePointRedemption(item.id, false, "Richiesta non approvata dall’amministratore.")) toast.success("Richiesta rifiutata") }}>Rifiuta</Button><Button size="sm" onClick={() => { if (store.decidePointRedemption(item.id, true, "Richiesta approvata dall’amministratore.")) toast.success("Richiesta approvata") }}>Approva</Button></>}{item.status === "approved" && <Button size="sm" onClick={() => { if (store.deliverPointRedemption(item.id)) toast.success("Premio consegnato") }}>Segna consegnato</Button>}</div>)}{!store.pointRedemptions.length && <p className="text-sm text-muted-foreground">Nessuna richiesta premio.</p>}</div></div></CardContent></Card>
}
