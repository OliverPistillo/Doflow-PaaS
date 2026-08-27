"use client"

import Link from "next/link"
import { Check, Circle, CircleAlert, Clock3, FileSignature, ReceiptText } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { orderFinancialsFromServer } from "@/features/commercial/commercial-commerce"
import type { QuoteStatus } from "@/features/commercial/commercial-documents"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { canEditLead } from "@/features/identity/permissions"
import type { CommercialLead } from "@/features/commercial/types"
import { DocumentStatusBadge } from "@/features/commercial/document-status"

type StepState = "completed" | "current" | "todo" | "blocked"
const date = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" })
const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", useGrouping: "always", maximumFractionDigits: 0 })
const dateAfterDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

export function LeadCommercialPath({ lead }: { lead: CommercialLead }) {
  const { store, customers, projects } = useAuthorizedCommercial()
  const customer = customers.find((item) => item.sourceLeadId === lead.id || item.id === lead.convertedClientId)
  const order = store.orders.find((item) => item.customerId === customer?.id && !item.archivedAt)
  const contract = store.contracts.find((item) => item.orderId === order?.id && !item.archivedAt && !item.replacedById)
  const quote = store.quotes.find((item) => item.leadId === lead.id && !item.archivedAt && !item.replacedById)
  const financial = order ? orderFinancialsFromServer(order) : undefined
  const project = projects.find((item) => item.id === order?.projectId || item.sourceLeadId === lead.id)
  const normalizedEmail = lead.email.trim().toLocaleLowerCase("it-IT")
  const normalizedPhone = lead.phone.replace(/\D/g, "")
  const duplicateLead = store.leads.find((item) => item.id !== lead.id && !item.archivedAt && ((normalizedEmail && item.email.trim().toLocaleLowerCase("it-IT") === normalizedEmail) || (normalizedPhone && item.phone.replace(/\D/g, "") === normalizedPhone)))
  const existingCustomer = customer ?? customers.find((item) => !item.archivedAt && ((normalizedEmail && item.profile.email.trim().toLocaleLowerCase("it-IT") === normalizedEmail) || (normalizedPhone && item.profile.phone.replace(/\D/g, "") === normalizedPhone)))
  const transferableActivities = store.leadActivities.filter((item) => item.leadId === lead.id && !item.archivedAt).length
  const transferableTimeline = store.timelineEvents.filter((item) => item.leadId === lead.id).length
  const qualified = lead.stage !== "new"
  const proposalReady = Boolean(quote && !["Bozza", "Rifiutato", "Scaduto"].includes(quote.status)) || ["proposal", "negotiation", "follow-up", "won"].includes(lead.stage)
  const signed = contract?.status === "Firmato"
  const depositPaid = Boolean(order && (order.deposit <= 0 || financial && financial.paid >= order.deposit))
  const won = lead.stage === "won" || Boolean(customer)
  const steps: Array<{ label: string; state: StepState; detail: string; action: string }> = [
    { label: "Qualificazione", state: qualified ? "completed" : "current", detail: qualified ? "Lead qualificato" : "Verifica requisiti e priorità", action: qualified ? "Completata" : "Qualifica il lead" },
    { label: "Proposta", state: proposalReady ? "completed" : qualified ? "current" : "blocked", detail: quote?.status ?? "Da preparare", action: proposalReady ? "Proposta pronta" : "Prepara proposta" },
    { label: "Contratto", state: signed ? "completed" : proposalReady ? "current" : "blocked", detail: contract ? `${contract.code} · ${contract.status}` : "Non generato", action: signed ? "Firmato" : "Genera o firma" },
    { label: "Acconto", state: depositPaid ? "completed" : signed ? "current" : "blocked", detail: order ? `${money.format(financial?.paid ?? 0)} / ${money.format(order.deposit)}` : "Ordine non disponibile", action: depositPaid ? "Incassato" : "Registra acconto" },
    { label: "Vinto", state: won ? "completed" : depositPaid ? "current" : "blocked", detail: won ? "Cliente collegato" : "Trattativa aperta", action: won ? "Completata" : "Segna vinta" },
    { label: "Progetto", state: project ? "completed" : won && signed && depositPaid ? "current" : "blocked", detail: project?.name ?? "Non generato", action: project ? "Apri progetto" : "Genera progetto" },
  ]
  return <Card data-flow-tour="flow-lead-commercial-path"><CardHeader><CardTitle>Percorso commerciale</CardTitle><CardDescription>Qualificazione → Proposta → Contratto → Acconto → Vinto → Progetto, derivato dai record reali.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">{steps.map((step) => <div key={step.label} className={`rounded-lg border p-3 ${step.state === "current" ? "border-primary bg-primary/5" : step.state === "blocked" ? "border-dashed bg-muted/30" : step.state === "completed" ? "border-emerald-500/30 bg-emerald-500/5" : ""}`}><div className="flex items-center gap-2">{step.state === "completed" ? <Check className="size-4 text-emerald-600" /> : step.state === "blocked" ? <CircleAlert className="size-4 text-muted-foreground" /> : step.state === "current" ? <Clock3 className="size-4 text-primary" /> : <Circle className="size-4" />}<strong className="text-sm">{step.label}</strong></div><p className="mt-2 text-xs text-muted-foreground">{step.detail}</p><Badge className="mt-2" variant="outline">{step.action}</Badge></div>)}</div>{won && <section data-flow-tour="flow-conversion-checks" className="rounded-xl border border-violet-500/25 bg-violet-500/5 p-3"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-semibold">Controlli conversione</h3><p className="text-xs text-muted-foreground">Verifica sui record autorizzati prima di creare o collegare il cliente.</p></div><Badge variant="outline">{duplicateLead || existingCustomer || project ? "Collegamenti da verificare" : "Nessun blocco rilevato"}</Badge></div><div className="mt-3 grid gap-2 text-sm sm:grid-cols-2 xl:grid-cols-5"><ConversionCheck label="Duplicato Lead" value={duplicateLead ? `Trovato · ${duplicateLead.company}` : "Non trovato"} /><ConversionCheck label="Cliente esistente" value={existingCustomer ? `Trovato · ${existingCustomer.profile.company}` : "Non trovato"} /><ConversionCheck label="Progetto esistente" value={project ? `Trovato · ${project.name}` : "Non trovato"} /><ConversionCheck label="Dati da trasferire" value={`${transferableActivities} attività`} /><ConversionCheck label="Timeline" value={`${transferableTimeline} eventi`} /></div></section>}{project && <Button asChild size="sm" variant="link" className="px-0"><Link href={`/dashboard/progetti/${project.id}`}>Apri progetto collegato</Link></Button>}</CardContent></Card>
}

function ConversionCheck({ label, value }: { label: string; value: string }) { return <div className="rounded-lg border bg-background/70 p-2"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-0.5 font-medium">{value}</p></div> }

export function LeadDocumentCenter({ lead }: { lead: CommercialLead }) {
  const { store, identity, customers } = useAuthorizedCommercial()
  const editable = canEditLead(identity.currentUser, lead)
  const customer = customers.find((item) => item.sourceLeadId === lead.id || item.id === lead.convertedClientId)
  const order = store.orders.find((item) => item.customerId === customer?.id && !item.archivedAt)
  const contract = store.contracts.find((item) => item.orderId === order?.id && !item.archivedAt && !item.replacedById)
  const quote = store.quotes.find((item) => item.leadId === lead.id && !item.archivedAt && !item.replacedById)
  const financial = order ? orderFinancialsFromServer(order) : undefined
  const proposalStatus: Record<QuoteStatus, NonNullable<CommercialLead["proposal"]>["status"]> = { Bozza: "Preparata", Inviato: "Inviata", Visualizzato: "Visualizzata", Accettato: "Accettata", Rifiutato: "Rifiutata", Scaduto: "Scaduta", Sostituito: "Scaduta" }
  const quoteStatus: Record<NonNullable<CommercialLead["proposal"]>["status"], QuoteStatus> = { "Da preparare": "Bozza", Preparata: "Bozza", Inviata: "Inviato", Visualizzata: "Visualizzato", Accettata: "Accettato", Rifiutata: "Rifiutato", Scaduta: "Scaduto" }
  const proposal = quote ? { code: quote.code, version: quote.version, status: proposalStatus[quote.status], amount: quote.total, createdAt: quote.createdAt, dueAt: quote.validUntil } : undefined
  const prepareProposal = async () => {
    if (quote) {
      const result = await store.createQuoteVersion(quote.id)
      if (!result.ok) return toast.error(result.message)
      toast.success(result.existing ? "Versione già disponibile" : "Nuova versione preparata")
      return
    }
    const service = store.services.find((item) => item.name === lead.service || lead.services?.includes(item.name)) ?? store.services[0]
    if (!service) return toast.error("Nessun servizio di catalogo disponibile")
    const validUntil = dateAfterDays(14)
    const id = await store.addQuote({ status: "Bozza", leadId: lead.id, customerId: customer?.id, salespersonId: lead.assigneeId, lines: [{ id: crypto.randomUUID(), serviceId: service.id, title: service.name, description: service.description, quantity: 1, unitPrice: service.price, discount: 0 }], discount: 0, vatRate: store.commerceSettings.defaultVatRate ?? 22, validUntil, conditions: "Offerta valida fino alla data indicata.", recipientSnapshot: { name: `${lead.firstName} ${lead.lastName}`.trim(), company: lead.company, address: lead.location, email: lead.email, phone: lead.phone }, supplierSnapshot: { ...store.commerceSettings.supplierProfile }, briefSnapshot: `Esigenza raccolta: ${lead.service || service.name}.` })
    if (!id) return toast.error("Preventivo non creato")
    toast.success("Proposta preparata")
  }
  const setProposalStatus = async (status: NonNullable<CommercialLead["proposal"]>["status"]) => { if (!quote || proposal?.status === status) return; if (await store.updateQuote(quote.id, { status: quoteStatus[status] })) toast.success(`Proposta ${status.toLowerCase()}`) }
  const deposit = !order || order.deposit <= 0 ? "Non richiesto" : financial && financial.paid >= order.deposit ? "Pagato" : financial && financial.paid > 0 ? "Parzialmente pagato" : "Da richiedere"
  const cards = [{ label: "Brief e materiali", status: lead.materialsStatus ?? "Da richiedere", icon: ReceiptText }, { label: "Proposta / preventivo", status: proposal?.status ?? "Da preparare", icon: ReceiptText }, { label: "Contratto", status: contract?.status ?? "Da generare", icon: FileSignature }, { label: "Acconto", status: deposit, icon: ReceiptText }]
  return <Card id="documents"><CardHeader><CardTitle>Centro documentale</CardTitle><CardDescription>Metadati operativi: nessun upload o invio esterno viene simulato.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(({ label, status, icon: Icon }) => <div key={label} className="rounded-lg border p-3"><div className="flex items-center gap-2"><Icon className="size-4 text-muted-foreground" /><strong className="text-sm">{label}</strong></div><DocumentStatusBadge className="mt-2" status={status} /></div>)}</div><div className="grid gap-4 lg:grid-cols-2"><div className="rounded-lg border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="font-medium">Proposta</h3><p className="text-sm text-muted-foreground">{proposal ? `${proposal.code} · v${proposal.version} · ${money.format(proposal.amount)}` : "Nessuna proposta preparata"}</p></div>{proposal?.dueAt && <Badge variant="outline">Scade {date.format(new Date(proposal.dueAt))}</Badge>}</div><div className="mt-3 flex flex-wrap gap-2">{!proposal ? <Button size="sm" onClick={prepareProposal} disabled={!editable}>Genera proposta</Button> : <><Select value={proposal.status} onValueChange={(value) => void setProposalStatus(value as NonNullable<CommercialLead["proposal"]>["status"])} disabled={!editable}><SelectTrigger className="w-44"><SelectValue /></SelectTrigger><SelectContent>{["Preparata", "Inviata", "Visualizzata", "Accettata", "Rifiutata", "Scaduta"].map((status) => <SelectItem key={status} value={status}>{status}</SelectItem>)}</SelectContent></Select><Button size="sm" variant="outline" onClick={() => void prepareProposal()} disabled={!editable}>Nuova versione</Button></>}</div></div><div className="rounded-lg border p-4"><h3 className="font-medium">Contratto e ordine</h3><div className="mt-1 flex flex-wrap items-center gap-2"><p className="text-sm text-muted-foreground">{contract ? `${contract.code} · v${contract.version}` : "Contratto non ancora generato"}</p>{contract && <DocumentStatusBadge status={contract.status} />}</div><p className="mt-1 text-sm text-muted-foreground">{order ? `${order.code} · acconto ${deposit}` : "Ordine non collegato"}</p><div className="mt-3 flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href="/dashboard/contratti">Apri contratti</Link></Button>{order && <Button asChild size="sm" variant="outline"><Link href="/dashboard/ordini">Apri ordine</Link></Button>}</div></div></div>{customer?.documents?.length ? <div><h3 className="mb-2 text-sm font-medium">Altri documenti</h3><div className="flex flex-wrap gap-2">{customer.documents.filter((item) => !item.archivedAt).map((item) => <span key={item.id} className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs"><span>{item.name}</span><DocumentStatusBadge status={item.status} /></span>)}</div></div> : null}</CardContent></Card>
}
