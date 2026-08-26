"use client"

import Link from "next/link"
import { ArrowLeft, Printer } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { AccessDenied } from "@/features/identity/access-denied"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"

const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" })
const date = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric" })

function formattedDate(value: string) {
  const parsed = new Date(value.includes("T") ? value : `${value}T12:00:00`)
  return Number.isNaN(parsed.getTime()) ? value : date.format(parsed)
}

export function QuotePreviewPage({ quoteId }: { quoteId: string }) {
  const store = useCommercialLeads()
  const identity = useDoflowIdentity()

  if (!identity.hasCapability("canViewQuotes")) return <AccessDenied resource="al preventivo" />
  if (!store.hasHydrated) return <main className="min-h-dvh" aria-busy="true" />

  const quote = store.quotes.find((item) => item.id === quoteId)
  if (!quote) {
    return (
      <main className="mx-auto w-full max-w-xl p-6">
        <Card className="text-center">
          <CardHeader><CardTitle>Preventivo non disponibile</CardTitle></CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">Il documento non esiste oppure non appartiene al perimetro autorizzato.</p>
            <Button asChild className="mt-5"><Link href="/dashboard/preventivi">Torna ai preventivi</Link></Button>
          </CardContent>
        </Card>
      </main>
    )
  }

  return (
    <main className="mx-auto w-full max-w-5xl space-y-4 p-4 print:max-w-none print:p-0 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Button asChild variant="outline"><Link href="/dashboard/preventivi"><ArrowLeft />Preventivi</Link></Button>
        <div className="flex items-center gap-2"><Badge variant="secondary">Anteprima</Badge><Button onClick={() => window.print()}><Printer />Stampa / Salva PDF</Button></div>
      </div>

      <Card data-testid="quote-print-document" className="print:border-0 print:shadow-none">
        <CardHeader className="border-b">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Preventivo</p><CardTitle className="mt-1 text-2xl">{quote.code}</CardTitle><p className="mt-1 text-sm text-muted-foreground">Versione {quote.version}</p></div>
            <div className="text-right"><Badge>{quote.status}</Badge><p className="mt-3 text-sm text-muted-foreground">Valido fino al {formattedDate(quote.validUntil)}</p></div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6 p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow><TableHead>Servizio</TableHead><TableHead className="text-center">Q.tà</TableHead><TableHead className="text-right">Prezzo</TableHead><TableHead className="text-right">Sconto</TableHead><TableHead className="text-right">Totale</TableHead></TableRow></TableHeader>
              <TableBody>
                {quote.lines.map((line) => <TableRow key={line.id}><TableCell className="font-medium">{line.description}</TableCell><TableCell className="text-center">{line.quantity}</TableCell><TableCell className="text-right">{money.format(line.unitPrice)}</TableCell><TableCell className="text-right">{money.format(line.discount)}</TableCell><TableCell className="text-right font-semibold">{money.format(line.quantity * line.unitPrice - line.discount)}</TableCell></TableRow>)}
              </TableBody>
            </Table>
          </div>
          <div className="ml-auto grid max-w-sm gap-2 px-6 text-sm">
            <p className="flex justify-between gap-6"><span className="text-muted-foreground">Imponibile</span><strong>{money.format(Math.max(0, quote.subtotal - quote.discount))}</strong></p>
            <p className="flex justify-between gap-6"><span className="text-muted-foreground">IVA {quote.vatRate}%</span><strong>{money.format(quote.vatAmount)}</strong></p>
            <p className="flex justify-between gap-6 border-t pt-2 text-base"><span>Totale</span><strong>{money.format(quote.total)}</strong></p>
          </div>
          <div className="grid gap-4 border-t p-6 text-sm md:grid-cols-2">
            <section><h2 className="font-semibold">Condizioni</h2><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{quote.conditions || "Nessuna condizione aggiuntiva."}</p></section>
            <section><h2 className="font-semibold">Note</h2><p className="mt-2 whitespace-pre-wrap text-muted-foreground">{quote.notes || "Nessuna nota."}</p></section>
          </div>
          <footer className="border-t px-6 py-4 text-xs text-muted-foreground">Creato il {formattedDate(quote.createdAt)} · I dati e i totali provengono dal backend tenant-scoped.</footer>
        </CardContent>
      </Card>
    </main>
  )
}
