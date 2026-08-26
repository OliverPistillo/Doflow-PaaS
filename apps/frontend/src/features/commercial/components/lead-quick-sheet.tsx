"use client"

import Link from "next/link"
import { useMemo, useState } from "react"
import { CalendarClock, ExternalLink, FileSignature, FolderKanban, Mail, MessageCircle, Phone, Plus, Save, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ActivityFormDialog } from "@/features/commercial/components/activity-form-dialog"
import { RankingWinnerBadges } from "@/features/commercial/components/ranking-winner-badges"
import { CustomerLogo } from "@/features/commercial/components/customer-logo"
import { DocumentStatusBadge } from "@/features/commercial/document-status"
import { pipelineStages } from "@/features/commercial/pipeline-stages"
import { useCommercialTeam } from "@/features/commercial/use-commercial-team"
import type { PipelineStage } from "@/features/commercial/types"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { canEditLead } from "@/features/identity/permissions"
import { formatItalianDateTime } from "@/lib/date"
import { commercialApi } from "@/lib/tenant-commercial-api"

const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR", maximumFractionDigits: 0 })
const dateTime = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
const toDateTimeInput = (value?: string) => value ? value.includes("T") ? value.slice(0, 16) : `${value.slice(0, 10)}T09:00` : ""

export function LeadQuickSheet({ leadId, open, onOpenChange }: { leadId?: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const commercialTeam = useCommercialTeam()
  const { store, identity, leads, customers, projects } = useAuthorizedCommercial()
  const lead = leads.find((item) => item.id === leadId)
  const editable = Boolean(lead && canEditLead(identity.currentUser, lead))
  const customer = customers.find((item) => item.sourceLeadId === lead?.id || item.id === lead?.convertedClientId)
  const order = store.orders.find((item) => item.customerId === customer?.id && !item.archivedAt)
  const contract = store.contracts.find((item) => item.orderId === order?.id && !item.archivedAt && !item.replacedById)
  const quote = [...store.quotes].filter((item) => item.leadId === lead?.id && !item.archivedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const project = projects.find((item) => item.id === order?.projectId || item.sourceLeadId === lead?.id)
  const payment = order ? { paid: order.netCollected ?? 0 } : undefined
  const communications = [...(customer?.communications ?? [])].filter((item) => !item.archivedAt).sort((a, b) => b.occurredAt.localeCompare(a.occurredAt))
  const timeline = useMemo(() => store.timelineEvents.filter((event) => event.leadId === leadId).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5), [leadId, store.timelineEvents])
  const [stage, setStage] = useState<PipelineStage>(() => lead?.stage ?? "new")
  const [assigneeId, setAssigneeId] = useState(() => lead?.assigneeId ?? "")
  const [nextAction, setNextAction] = useState(() => lead?.nextAction ?? "")
  const [nextActionAt, setNextActionAt] = useState(() => toDateTimeInput(lead?.nextActionAt))
  const [activityOpen, setActivityOpen] = useState(false)

  if (!lead) return null
  const changed = stage !== lead.stage || assigneeId !== lead.assigneeId || nextAction.trim() !== lead.nextAction || nextActionAt && nextActionAt !== toDateTimeInput(lead.nextActionAt)
  const save = async () => {
    if (!editable || !changed) return
    try {
      const payload = { assigneeId, owner: commercialTeam.find((item) => item.id === assigneeId)?.name ?? lead.owner, nextAction: nextAction.trim(), nextActionAt: new Date(nextActionAt).toISOString() }
      if (stage !== lead.stage) {
        await store.transitionLeadStatus({ leadId: lead.id, fromStatus: lead.stage, toStatus: stage })
        const current = await commercialApi.opportunity(lead.id)
        await commercialApi.updateOpportunity(lead.id, { version: current.version, assigned_to: payload.assigneeId, next_action: payload.nextAction, next_action_at: payload.nextActionAt })
        store.retryWorkspace()
      } else if (!await store.updateLead(lead.id, payload)) return
      toast.success("Scheda rapida aggiornata")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Aggiornamento scheda rapida non riuscito")
    }
  }
  const proposalStatus = quote?.status ?? "Da preparare"
  const depositStatus = !order || order.deposit <= 0 ? "Non richiesto" : payment && payment.paid >= order.deposit ? "Pagato" : payment && payment.paid > 0 ? "Parzialmente pagato" : "Da richiedere"
  return <><Sheet open={open} onOpenChange={onOpenChange}><SheetContent showCloseButton={false} className="flex h-dvh w-full flex-col overflow-hidden p-0 sm:max-w-[520px]"><SheetHeader className="shrink-0 border-b px-5 py-4 text-left"><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_2.25rem] items-start gap-x-3 gap-y-2"><div className="flex min-w-0 gap-3">{customer && <CustomerLogo customer={customer} className="size-11" />}<div className="min-w-0"><SheetTitle className="line-clamp-2 break-words leading-5">{lead.firstName} {lead.lastName}</SheetTitle><SheetDescription className="line-clamp-2 break-words leading-5">{lead.company} · {lead.service}</SheetDescription></div></div><div className="flex min-w-0 shrink-0 items-start"><Badge variant="secondary" className="max-w-32 whitespace-normal text-center leading-4">{pipelineStages.find((item) => item.id === lead.stage)?.label ?? lead.stage}</Badge></div><SheetClose asChild><Button variant="ghost" size="icon-sm" className="size-9 shrink-0" aria-label="Chiudi scheda rapida"><X /><span className="sr-only">Chiudi scheda rapida</span></Button></SheetClose><div className="col-span-3 flex min-w-0 flex-wrap items-center gap-1 text-xs"><span className="min-w-0 truncate text-muted-foreground">Responsabile: {commercialTeam.find((item) => item.id === lead.assigneeId)?.name ?? lead.owner}</span><RankingWinnerBadges userId={lead.assigneeId} compact /></div></div></SheetHeader><ScrollArea className="min-h-0 flex-1"><div className="space-y-4 px-5 py-4"><div className="grid grid-cols-3 gap-2"><Button asChild size="sm" variant="outline"><a href={`tel:${lead.phone}`}><Phone />Chiama</a></Button><Button asChild size="sm" variant="outline"><a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer"><MessageCircle />WhatsApp</a></Button><Button asChild size="sm" variant="outline"><a href={`mailto:${lead.email}`}><Mail />Email</a></Button></div><Card><CardHeader className="pb-2"><CardTitle className="text-base">Riepilogo operativo</CardTitle></CardHeader><CardContent className="grid gap-3 text-sm sm:grid-cols-2"><Value label="Telefono" value={lead.phone || "—"} /><Value label="Email" value={lead.email || "—"} /><Value label="Fonte" value={lead.source} /><Value label="Servizio" value={lead.service} /><Value label="Valore" value={money.format(lead.value)} /><Value label="Probabilità" value={`${lead.probability}% · ${money.format(lead.value * lead.probability / 100)} ponderato`} /><Value label="Ultima comunicazione" value={communications[0] ? `${communications[0].channel} · ${dateTime.format(new Date(communications[0].occurredAt))}` : lead.lastContact} /><Value label="Scadenza" value={formatItalianDateTime(lead.nextActionAt) || "Nessuna scadenza"} /><Value label="Proposta" value={proposalStatus} /><Value label="Contratto" value={contract?.status ?? "Da generare"} /><Value label="Acconto" value={depositStatus} /><Value label="Progetto" value={project?.name ?? "Non collegato"} /></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-base">Modifiche rapide</CardTitle></CardHeader><CardContent className="space-y-3"><div className="grid gap-3 sm:grid-cols-2"><Label>Stato<Select value={stage} onValueChange={(value) => setStage(value as PipelineStage)} disabled={!editable}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{pipelineStages.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select></Label><Label>Responsabile<Select value={assigneeId} onValueChange={setAssigneeId} disabled={!editable || !identity.hasCapability("canAssignLeads")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{commercialTeam.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Label></div><Label>Prossima azione<Input value={nextAction} onChange={(event) => setNextAction(event.target.value)} disabled={!editable} /></Label><Label>Data e ora<Input type="datetime-local" value={nextActionAt} onChange={(event) => setNextActionAt(event.target.value)} disabled={!editable} /></Label><div className="flex flex-wrap gap-2"><Button size="sm" onClick={save} disabled={!editable || !changed || !nextAction.trim() || !nextActionAt}><Save />Salva modifiche</Button><Button size="sm" variant="outline" onClick={() => setActivityOpen(true)} disabled={!editable || !customer}><Plus />Crea attività</Button></div>{!editable && <p className="text-xs text-muted-foreground">Il lead è in sola lettura perché non è assegnato all’utente corrente.</p>}{editable && !customer && <p className="text-xs text-muted-foreground">Converti prima il lead in cliente per creare un’attività strutturata.</p>}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-base">Percorso documentale</CardTitle></CardHeader><CardContent className="flex flex-wrap gap-2"><Button asChild size="sm" variant="outline"><Link href={`/dashboard/commercial/leads/${lead.id}?section=documents`}><ExternalLink />Apri proposta</Link></Button>{contract ? <Button asChild size="sm" variant="outline"><Link href="/dashboard/contratti"><FileSignature />Apri contratto</Link></Button> : <Button size="sm" variant="outline" disabled><FileSignature />Contratto non generato</Button>}{project && <Button asChild size="sm" variant="outline"><Link href={`/dashboard/progetti/${project.id}`}><FolderKanban />Apri progetto</Link></Button>}</CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-base">Timeline recente</CardTitle></CardHeader><CardContent className="space-y-3">{timeline.map((event) => <div key={event.id} className="border-l-2 border-primary/30 pl-3"><p className="text-sm font-medium">{event.title}</p><p className="text-xs text-muted-foreground">{event.detail}</p><p className="mt-1 text-[11px] text-muted-foreground">{dateTime.format(new Date(event.date))} · {event.author}</p></div>)}{!timeline.length && <p className="text-sm text-muted-foreground">Nessun evento registrato.</p>}<Button asChild size="sm" variant="link" className="px-0"><Link href={`/dashboard/commercial/leads/${lead.id}?section=timeline`}><CalendarClock />Vedi Timeline completa</Link></Button></CardContent></Card></div></ScrollArea><Separator /><SheetFooter className="shrink-0 flex-row gap-2 px-5 py-3"><Button asChild className="flex-1"><Link href={`/dashboard/commercial/leads/${lead.id}`}><ExternalLink />Apri scheda completa</Link></Button><Button variant="outline" onClick={() => onOpenChange(false)}>Chiudi</Button></SheetFooter></SheetContent></Sheet>{customer && <ActivityFormDialog open={activityOpen} onOpenChange={setActivityOpen} defaultClientId={customer.id} />}</>
}

function Value({ label, value }: { label: string; value: string }) { return <div className="min-w-0"><p className="text-xs text-muted-foreground">{label}</p>{label === "Proposta" || label === "Contratto" ? <DocumentStatusBadge className="mt-1" status={value} /> : <p className="break-words font-medium">{value}</p>}</div> }
