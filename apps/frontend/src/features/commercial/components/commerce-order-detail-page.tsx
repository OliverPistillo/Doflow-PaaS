"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { ArrowLeft, FolderKanban } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { commercePaymentStatusLabel, type CommercialOrder, type CommercialPayment } from "@/features/commercial/commercial-commerce"
import { RecordCollaborationPanel } from "@/features/commercial/components/record-collaboration-panel"
import { AccessDenied } from "@/features/identity/access-denied"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { formatItalianDate } from "@/lib/date"
import { commerceApi } from "@/lib/tenant-commerce-api"

const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" })

type HistoryRow = { id: string; event_type: string; created_at: string; actor_name?: string }
const historyLabels: Record<string, string> = {
  commerce_order_created: "Ordine creato",
  commerce_order_paid: "Ordine saldato",
  commerce_order_project_generated: "Progetto generato dall’ordine",
  commerce_payment_recorded: "Pagamento registrato",
  commerce_refund_recorded: "Rimborso registrato",
}

export function CommerceOrderDetailPage({ orderId }: { orderId: string }) {
  const identity = useDoflowIdentity()
  const [order, setOrder] = useState<CommercialOrder | null>(null)
  const [payments, setPayments] = useState<CommercialPayment[]>([])
  const [history, setHistory] = useState<HistoryRow[]>([])
  const [status, setStatus] = useState<"loading" | "loaded" | "error" | "denied">("loading")
  const [generating, setGenerating] = useState(false)

  useEffect(() => {
    let cancelled = false
    void Promise.all([commerceApi.order(orderId), commerceApi.payments(), commerceApi.history("order", orderId)]).then(([nextOrder, paymentPage, historyPage]) => {
      if (cancelled) return
      setOrder(nextOrder)
      setPayments(paymentPage.items.filter((payment) => payment.orderId === orderId))
      setHistory(historyPage.items)
      setStatus("loaded")
    }).catch((error) => {
      if (cancelled) return
      const message = error instanceof Error ? error.message : ""
      setStatus(message.includes("403") ? "denied" : "error")
    })
    return () => { cancelled = true }
  }, [orderId])

  if (!identity.hasCapability("canViewOrders") || status === "denied") return <AccessDenied resource="a questo ordine" />
  if (status === "loading") return <main className="p-6"><p className="text-sm text-muted-foreground">Caricamento ordine…</p></main>
  if (status === "error" || !order) return <main className="p-6"><Card><CardHeader><CardTitle>Ordine non disponibile</CardTitle><CardDescription>Il record non esiste o non è raggiungibile.</CardDescription></CardHeader></Card></main>

  const generateProject = async () => {
    setGenerating(true)
    try {
      const result = await commerceApi.generateProject(order.id)
      const refreshed = await commerceApi.order(order.id)
      setOrder(refreshed)
      toast.success(result.existing ? "Progetto già collegato" : "Progetto generato")
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Generazione progetto non riuscita")
    } finally {
      setGenerating(false)
    }
  }

  return <main className="mx-auto w-full max-w-7xl space-y-5 p-4 md:p-6" data-commerce-source="server">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div><Button asChild variant="ghost" size="sm" className="-ml-2 mb-2"><Link href="/dashboard/ordini"><ArrowLeft />Ordini</Link></Button><div className="flex flex-wrap items-center gap-2"><h1 className="text-2xl font-semibold">{order.code}</h1><Badge>{order.administrativeStatus}</Badge><Badge variant="secondary">{commercePaymentStatusLabel(order.paymentStatus)}</Badge></div><p className="text-sm text-muted-foreground">Creato il {formatItalianDate(order.orderDate)} · snapshot prezzi v{order.version}</p></div>
      <div className="flex flex-wrap gap-2"><RecordCollaborationPanel recordType="order" recordId={order.id} label={order.code} compact />{identity.hasCapability("canManageOwnOrders") && (order.projectId ? <Button asChild variant="outline"><Link href={`/dashboard/progetti/${order.projectId}`}><FolderKanban />Apri progetto</Link></Button> : <Button disabled={generating} onClick={generateProject}><FolderKanban />{generating ? "Generazione…" : "Genera progetto"}</Button>)}</div>
    </header>
    <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <Metric label="Imponibile" value={money.format(order.subtotal ?? 0)} />
      <Metric label="Imposte" value={money.format(order.taxTotal ?? 0)} />
      <Metric label="Totale" value={money.format(order.total)} />
      <Metric label="Incassato netto" value={money.format(order.netCollected ?? 0)} />
      <Metric label="Residuo" value={money.format(order.residual ?? 0)} />
    </section>
    <Card><CardHeader><CardTitle>Righe ordine</CardTitle><CardDescription>Snapshot immutabile acquisito dal catalogo al momento della creazione.</CardDescription></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="p-2">Servizio</th><th className="p-2">Quantità</th><th className="p-2">Prezzo</th><th className="p-2">Sconto</th><th className="p-2">IVA</th><th className="p-2 text-right">Totale</th></tr></thead><tbody>{order.items.map((item) => <tr key={item.id} className="border-b last:border-0"><td className="p-2"><b>{item.name}</b><small className="block text-muted-foreground">{item.descriptionSnapshot || "Nessuna descrizione"} · catalogo v{item.catalogVersion ?? 1}</small></td><td className="p-2">{item.quantity}</td><td className="p-2">{money.format(item.unitPrice)}</td><td className="p-2">{money.format(item.discount)}</td><td className="p-2">{item.taxRate ?? 0}%</td><td className="p-2 text-right font-medium">{typeof item.lineTotal === "number" ? money.format(item.lineTotal) : "Non disponibile"}</td></tr>)}</tbody></table></CardContent></Card>
    <section className="grid gap-4 lg:grid-cols-2">
      <Card><CardHeader><CardTitle>Pagamenti e rimborsi</CardTitle><CardDescription>Solo i movimenti confermati alimentano gli aggregati.</CardDescription></CardHeader><CardContent className="space-y-2">{payments.map((payment) => <div key={payment.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"><span><b>{payment.type === "Rimborso" ? "−" : ""}{money.format(payment.amount)}</b><small className="block text-muted-foreground">{payment.reference} · {formatItalianDate(payment.effectiveDate ?? payment.date)}</small></span><Badge variant="secondary">{payment.status}</Badge></div>)}{!payments.length && <p className="text-sm text-muted-foreground">Nessun movimento registrato.</p>}</CardContent></Card>
      <Card><CardHeader><CardTitle>History</CardTitle><CardDescription>Eventi business persistiti dal backend.</CardDescription></CardHeader><CardContent className="space-y-3">{history.map((event) => <div key={event.id} className="border-l-2 border-primary/30 pl-3 text-sm"><p className="font-medium">{historyLabels[event.event_type] ?? event.event_type.replaceAll("_", " ")}</p><p className="text-xs text-muted-foreground">{event.actor_name || "Sistema"} · {new Date(event.created_at).toLocaleString("it-IT")}</p></div>)}{!history.length && <p className="text-sm text-muted-foreground">Nessun evento disponibile.</p>}</CardContent></Card>
    </section>
    <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Preventivi, contratti, fatture, note di credito e rinnovi appartengono alla Fase 3B e non sono simulati in questo dettaglio.</p>
  </main>
}

function Metric({ label, value }: { label: string; value: string }) {
  return <Card><CardHeader className="pb-2"><CardDescription>{label}</CardDescription><CardTitle className="text-xl">{value}</CardTitle></CardHeader></Card>
}
