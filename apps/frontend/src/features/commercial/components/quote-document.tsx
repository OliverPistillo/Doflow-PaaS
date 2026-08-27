"use client"

import Image from "next/image"
import Link from "next/link"
import { ArrowLeft, AlertTriangle, Printer } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import type { CommercialQuote, QuotePartySnapshot, QuoteSupplierSnapshot } from "@/features/commercial/commercial-documents"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { AccessDenied } from "@/features/identity/access-denied"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import styles from "./quote-document.module.css"

const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always", minimumFractionDigits: 0, maximumFractionDigits: 2 })
const date = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric" })

export function QuotePreviewPage({ quoteId }: { quoteId: string }) {
  const store = useCommercialLeads()
  const identity = useDoflowIdentity()
  if (!identity.hasCapability("canViewQuotes")) return <AccessDenied resource="al preventivo" />
  if (!store.hasHydrated) return <main className="min-h-dvh" aria-busy="true" />
  const quote = store.quotes.find((item) => item.id === quoteId)
  if (!quote) return <main className="mx-auto max-w-xl p-6"><div className="rounded-xl border bg-card p-6 text-center"><h1 className="text-xl font-semibold">Preventivo non disponibile</h1><p className="mt-2 text-sm text-muted-foreground">Il documento non esiste oppure non appartiene al tuo perimetro autorizzato.</p><Button asChild className="mt-5"><Link href="/dashboard/preventivi">Torna ai preventivi</Link></Button></div></main>

  const lead = quote.leadId ? store.leads.find((item) => item.id === quote.leadId) : undefined
  const customer = quote.customerId ? store.customers.find((item) => item.id === quote.customerId) : undefined
  const profile = customer?.profile ?? lead
  const recipient: QuotePartySnapshot = quote.recipientSnapshot ?? { name: profile ? `${profile.firstName} ${profile.lastName}`.trim() : "Destinatario non disponibile", company: profile?.company ?? "", address: profile?.location, email: profile?.email, phone: profile?.phone, vatNumber: profile?.vatNumber, taxCode: profile?.taxCode }
  const supplier: QuoteSupplierSnapshot = quote.supplierSnapshot ?? store.commerceSettings.supplierProfile
  const missing = supplierMissingFields(supplier)
  const print = () => {
    if (missing.length) return toast.error(`Completa le Impostazioni aziendali: ${missing.join(", ")}.`)
    window.print()
  }
  return <main className={`${styles.preview} w-full bg-slate-100 px-3 py-5 dark:bg-slate-950 sm:px-6 lg:px-10`}>
    <div className={`${styles.noPrint} mx-auto mb-4 flex w-full max-w-[210mm] flex-wrap items-center justify-between gap-3`}>
      <Button asChild variant="outline"><Link href="/dashboard/preventivi"><ArrowLeft />Preventivi</Link></Button>
      <div className="flex flex-wrap items-center justify-end gap-2"><Badge variant="secondary">Anteprima A4</Badge><Button onClick={print}><Printer />Stampa / Salva PDF</Button></div>
    </div>
    {missing.length > 0 && <div className={`${styles.noPrint} mx-auto mb-4 flex w-full max-w-[210mm] gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-950 dark:text-amber-100`}><AlertTriangle className="mt-0.5 size-5 shrink-0" /><div><p className="font-semibold">Dati aziendali incompleti: la stampa è bloccata.</p><p className="mt-1">Configura {missing.join(", ")} nelle Impostazioni aziendali. Nessun dato fiscale mancante viene inventato.</p></div></div>}
    <QuoteDocument quote={quote} recipient={recipient} supplier={supplier} />
  </main>
}

function QuoteDocument({ quote, recipient, supplier }: { quote: CommercialQuote; recipient: QuotePartySnapshot; supplier: QuoteSupplierSnapshot }) {
  const taxable = Math.max(0, quote.subtotal - quote.discount)
  const deposit = quote.lines.reduce((sum, line) => sum + (line.deposit ?? 0) * line.quantity, 0)
  const renewal = quote.lines.reduce((sum, line) => sum + (line.recurringPrice ?? 0) * line.quantity, 0)
  const installments = Math.max(0, ...quote.lines.map((line) => line.installments ?? 0))
  const serviceTitle = quote.lines.map((line) => line.title || line.description).join(" + ")
  return <article className={styles.document} data-testid="quote-print-document">
    <div className={styles.page}>
      <header className="flex items-start justify-between gap-8 border-b-2 border-indigo-600 pb-5">
        <div><Image src="/brand/logo_doflow_nero.svg" alt="DoFlow" width={150} height={32} priority className="h-auto w-36" /><p className="mt-3 text-[11px] leading-5 text-slate-600">{supplier.brandName || "Dato non configurato"}<br />{supplier.legalHolder || "Intestatario non configurato"}<br />P. IVA {supplier.vatNumber || "non configurata"}</p></div>
        <div className="text-right"><p className="text-[10px] font-bold uppercase tracking-[0.28em] text-indigo-600">Preventivo</p><h1 className="mt-1 text-2xl font-extrabold tracking-tight">{quote.code}</h1><p className="text-xs text-slate-500">Versione {quote.version}</p><span className="mt-3 inline-flex rounded-full bg-indigo-50 px-3 py-1 text-[10px] font-semibold text-indigo-700">{quote.status}</span></div>
      </header>

      <section className={`${styles.avoidBreak} mt-5 grid grid-cols-2 gap-8 text-[11px]`}>
        <Block title="Fornitore"><p className="font-semibold">{supplier.legalHolder || "Dato non configurato"}</p><p>{supplier.address || "Indirizzo non configurato"}</p><p>{supplier.email || "Email non configurata"}</p><p>{supplier.phone || "Telefono non configurato"}</p></Block>
        <Block title="Destinatario"><p className="font-semibold">{recipient.company || recipient.name}</p>{recipient.company && recipient.name && <p>{recipient.name}</p>}<p>{recipient.address || "Indirizzo non disponibile"}</p><p>{recipient.email || "Email non disponibile"}</p><p>{recipient.phone || "Telefono non disponibile"}</p>{recipient.vatNumber && <p>P. IVA {recipient.vatNumber}</p>}{!recipient.vatNumber && recipient.taxCode && <p>CF {recipient.taxCode}</p>}</Block>
      </section>

      <section className={`${styles.avoidBreak} mt-5 grid grid-cols-3 gap-3 rounded-lg bg-slate-50 p-3 text-[10px]`}><Meta label="Emissione" value={date.format(new Date(quote.createdAt))} /><Meta label="Valido fino al" value={date.format(new Date(`${quote.validUntil}T12:00:00`))} /><Meta label="Stato" value={quote.status} /></section>

      <section className="mt-5"><h2 className="text-sm font-bold text-slate-900">Oggetto: {serviceTitle}</h2><p className="mt-2 text-[11px] leading-5 text-slate-600">Proposta professionale elaborata sulla base delle esigenze raccolte durante la qualificazione commerciale.</p>{quote.briefSnapshot && <p className="mt-2 rounded-lg border-l-4 border-indigo-500 bg-indigo-50/60 px-3 py-2 text-[10px] leading-4 text-slate-700">{quote.briefSnapshot}</p>}</section>

      <section className="mt-5 overflow-hidden rounded-lg border border-slate-200"><table className="w-full border-collapse text-left text-[10px]"><thead className="bg-slate-900 text-white"><tr><th className="px-3 py-2.5">Servizio</th><th className="px-2 py-2.5 text-center">Q.tà</th><th className="px-2 py-2.5 text-right">Prezzo</th><th className="px-2 py-2.5 text-right">Sconto</th><th className="px-3 py-2.5 text-right">Imponibile</th></tr></thead><tbody>{quote.lines.map((line) => <tr key={line.id} className="border-t border-slate-200 align-top"><td className="px-3 py-3"><p className="font-semibold">{line.title || line.description}</p>{line.title && <p className="mt-0.5 max-w-[78mm] leading-4 text-slate-500">{line.description}</p>}{line.includedSnapshot?.length ? <p className="mt-1 text-[9px] text-slate-500">Incluso: {line.includedSnapshot.join(", ")}</p> : null}</td><td className="px-2 py-3 text-center">{line.quantity}</td><td className="px-2 py-3 text-right">{money.format(line.unitPrice)}</td><td className="px-2 py-3 text-right">{money.format(line.discount)}</td><td className="px-3 py-3 text-right font-semibold">{money.format(line.quantity * line.unitPrice - line.discount)}</td></tr>)}</tbody></table></section>

      <section className={`${styles.avoidBreak} mt-4 ml-auto w-full max-w-[86mm] space-y-1.5 text-[11px]`}><Summary label="Imponibile" value={money.format(taxable)} /><Summary label={`IVA ${quote.vatRate}%`} value={money.format(quote.vatAmount)} /><Summary label="Totale primo periodo" value={money.format(quote.total)} strong />{deposit > 0 && <Summary label="Acconto richiesto" value={money.format(deposit)} />}{deposit > 0 && <Summary label="Saldo" value={money.format(Math.max(0, quote.total - deposit))} />}{installments > 0 && <Summary label="Rate previste" value={String(installments)} />}{renewal > 0 && <div className="mt-3 rounded-lg border border-indigo-200 bg-indigo-50 p-3"><Summary label="Rinnovo dal periodo successivo" value={`${money.format(renewal)} / anno`} strong /></div>}</section>

      <section className={`${styles.avoidBreak} mt-5 grid grid-cols-2 gap-6 text-[10px] leading-4`}><Block title="Condizioni"><p>{quote.conditions}</p><p className="mt-1">L’avvio del lavoro è subordinato al pagamento previsto. Il contratto viene generato nel passaggio successivo.</p>{installments > 0 && <p className="mt-1">Pagamento articolato in {installments} {installments === 1 ? "rata" : "rate"} secondo le scadenze concordate.</p>}</Block><Block title="Note e perimetro"><p>{quote.notes || "Tempi, revisioni incluse, esclusioni e materiali saranno dettagliati nel contratto collegato."}</p><p className="mt-1">Attività o integrazioni non indicate nelle righe economiche sono escluse.</p></Block></section>

      <section className={`${styles.avoidBreak} mt-7 border-t border-slate-300 pt-5`}><h2 className="text-xs font-bold uppercase tracking-wider text-slate-700">Accettazione</h2><div className="mt-5 grid grid-cols-2 gap-10 text-[10px] text-slate-500"><div><p>Nome e ruolo del firmatario</p><div className="mt-7 border-b border-slate-400" /><p className="mt-4">Data e firma cliente</p><div className="mt-7 border-b border-slate-400" /></div><div><p>Per DoFlow · {supplier.legalHolder || "Intestatario"}</p><div className="mt-7 border-b border-slate-400" /><p className="mt-4">Data e firma DoFlow</p><div className="mt-7 border-b border-slate-400" /></div></div></section>

      <footer className="mt-7 flex items-center justify-between border-t border-slate-200 pt-3 text-[9px] text-slate-500"><span>Il presente preventivo non costituisce fattura.</span><span>{quote.code} · v{quote.version} · Pagina <span className={styles.pageNumber} /></span></footer>
    </div>
  </article>
}

function supplierMissingFields(profile: QuoteSupplierSnapshot) { return [["brandName", "intestazione"], ["legalHolder", "intestatario"], ["vatNumber", "Partita IVA"], ["address", "indirizzo"], ["email", "email"], ["phone", "telefono"]].filter(([key]) => !profile[key as keyof QuoteSupplierSnapshot]?.trim()).map(([, label]) => label) }
function Block({ title, children }: { title: string; children: React.ReactNode }) { return <div><h2 className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-indigo-600">{title}</h2><div className="leading-5 text-slate-600">{children}</div></div> }
function Meta({ label, value }: { label: string; value: string }) { return <div><p className="uppercase tracking-wider text-slate-400">{label}</p><p className="mt-0.5 font-semibold text-slate-700">{value}</p></div> }
function Summary({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className={`flex items-center justify-between gap-4 ${strong ? "text-sm font-bold text-slate-900" : "text-slate-600"}`}><span>{label}</span><span>{value}</span></div> }
