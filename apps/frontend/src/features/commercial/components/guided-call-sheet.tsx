"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { CalendarClock, Check, ChevronLeft, ChevronRight, Clock3, Play, Save, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Progress } from "@/components/ui/progress"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { detectGuidedCallServices, guidedServiceLabel, guidedServiceOptions, type GuidedCall, type GuidedCallMode, type GuidedCallOutcome, type GuidedCallParticipantRole, type GuidedServiceId } from "@/features/commercial/commercial-guided-calls"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { pipelineStages } from "@/features/commercial/data/commercial-fixtures"
import type { CommercialLead, PipelineStage } from "@/features/commercial/types"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { useDoflowPresence } from "@/features/identity/doflow-presence-provider"
import { canViewLead, hasCapability } from "@/features/identity/permissions"

type Field = readonly [string, string, "text" | "long" | "choice" | "date" | "datetime"]
type Phase = { title: string; intro: string; question: string; say: string; answerKey: string; options: readonly string[]; secondary?: readonly Field[]; why: string; deepen: string; avoid: string }

const phases: readonly Phase[] = [
  { title: "Obiettivo", intro: "Ascolta il risultato, non anticipare la soluzione.", question: "Qual è il risultato principale che vuole ottenere?", say: "Se questo progetto funzionasse bene, quale risultato concreto dovrebbe portarvi?", answerKey: "mainGoal", options: ["Ricevere più contatti", "Vendere online", "Presentarsi meglio", "Lanciare un’offerta", "Automatizzare un processo", "Altro"], why: "Dà una direzione commerciale chiara al progetto.", deepen: "Chiedi un esempio soltanto se la risposta è generica.", avoid: "Non proporre funzionalità prima di capire il risultato." },
  { title: "Progetto", intro: "Conferma il servizio già rilevato dalla richiesta.", question: "Che cosa dobbiamo realizzare?", say: "Dalla richiesta risulta questo servizio: lo confermiamo o va corretto?", answerKey: "confirmedService", options: [], why: "Allinea richiesta iniziale e soluzione concordata.", deepen: "Se sono più servizi, identifica quello principale.", avoid: "Non entrare in CMS, hosting o integrazioni tecniche." },
  { title: "Situazione attuale", intro: "Comprendi il punto di partenza con una sola scelta.", question: "Da che situazione partiamo?", say: "Per capire il punto di partenza: oggi esiste già qualcosa oppure partiamo da zero?", answerKey: "currentSituation", options: ["Partiamo da zero", "Esiste già qualcosa da rifare", "Esiste ma non funziona", "Materiale già disponibile", "Da verificare"], secondary: [["materialReadiness", "Il cliente possiede già parte del materiale?", "choice"]], why: "Fa emergere lavoro di migrazione e dipendenze senza un audit tecnico.", deepen: "Se esiste qualcosa da rifare, chiedi brevemente cosa non funziona.", avoid: "Non trasformare la telefonata in un inventario tecnico." },
  { title: "Budget e tempi", intro: "Raccogli soltanto investimento indicativo e urgenza.", question: "Quali sono budget e tempistiche?", say: "Per proporre un percorso realistico, quale fascia di investimento e quale urgenza considerate?", answerKey: "budgetRange", options: ["< 1.000 €", "1.000–2.500 €", "2.500–5.000 €", "5.000–10.000 €", "> 10.000 €", "Da definire"], secondary: [["projectUrgency", "Urgenza", "choice"], ["desiredDate", "Data precisa, se presente", "date"]], why: "Evita proposte incompatibili con aspettative e scadenze.", deepen: "Chiedi una data precisa soltanto se esiste un vincolo reale.", avoid: "Non negoziare il prezzo durante la raccolta del bisogno." },
  { title: "Prossimo passo", intro: "Chiudi con un’azione concreta e verificabile.", question: "Qual è il prossimo passo concordato?", say: "Qual è il passaggio più utile da fissare adesso, con una responsabilità chiara?", answerKey: "nextStep", options: ["Inviare proposta", "Fissare incontro tecnico", "Richiedere materiali", "Fare follow-up", "Cliente deve decidere", "Non idoneo"], secondary: [["finalNextActionAt", "Quando", "datetime"]], why: "Trasforma la chiamata in un impegno operativo.", deepen: "Conferma data e responsabile solo dopo la scelta.", avoid: "Non chiudere con un generico ‘ci sentiamo’." },
]

const materialOptions = ["Logo e identità visiva", "Testi", "Fotografie", "Listino", "Servizi o prodotti", "Documenti legali", "Accessi dominio e hosting", "Accessi alle piattaforme"]

const rapidAnswers: Record<string, { options: string[]; multiple?: boolean }> = {
  answered: { options: ["Sì", "No", "Referente diverso"] }, available: { options: ["Sì, procediamo", "Solo 10 minuti", "Da riprogrammare"] }, preferredChannel: { options: ["Telefono", "WhatsApp", "Email"] },
  geography: { options: ["Locale", "Italia", "Europa", "Internazionale"] }, customerSources: { options: ["Passaparola", "Google", "Social", "Advertising", "Commerciale", "Marketplace"], multiple: true },
  mainGoal: { options: ["Più contatti", "Vendere online", "Rafforzare il brand", "Automatizzare", "Migliorare conversioni"] }, secondaryGoals: { options: ["SEO", "Advertising", "CRM", "Analytics", "Email marketing", "Assistenza"], multiple: true }, idealCustomer: { options: ["Privati", "PMI", "Professionisti", "Enti", "B2B", "B2C"], multiple: true }, objections: { options: ["Prezzo", "Tempi", "Fiducia", "Priorità", "Confronto concorrenti", "Decisione condivisa"], multiple: true },
  availableMaterials: { options: materialOptions, multiple: true }, startTiming: { options: ["Subito", "Entro 30 giorni", "1–3 mesi", "Oltre 3 mesi", "Da definire"] }, budgetRange: { options: ["< 1.000 €", "1.000–2.500 €", "2.500–5.000 €", "5.000–10.000 €", "> 10.000 €", "Da definire"] }, paymentPreference: { options: ["Acconto + saldo", "Rate", "Unica soluzione", "Da definire"] }, recapConfirmed: { options: ["Sì", "No, da correggere"] },
  websiteGoal: { options: ["Ricevere più richieste", "Presentare l’attività", "Aumentare la credibilità", "Mostrare i servizi", "Farsi trovare online", "Sostituire il sito attuale"] },
  currentWebsite: { options: ["Nessun sito", "Sito vecchio", "Sito lento", "Non porta contatti", "Grafica poco professionale", "Informazioni non aggiornate"] },
  visualIdentity: { options: ["Logo disponibile", "Testi disponibili", "Foto disponibili", "Materiali parziali", "Nessun materiale", "Da verificare"], multiple: true },
  productCount: { options: ["Fino a 20 prodotti", "21–100 prodotti", "Oltre 100 prodotti", "Prodotti con varianti", "Prodotti digitali", "Servizi/prenotazioni"] },
  existingManagement: { options: ["Parte da zero", "Vende già offline", "E-commerce esistente", "Vuole cambiare piattaforma", "Vende sui marketplace", "Catalogo da organizzare"], multiple: true },
  ecommerceNeeds: { options: ["Pagamenti online", "Spedizioni", "Gestione magazzino", "Fatturazione", "Coupon", "Recupero carrelli", "Multilingua", "B2B", "Integrazioni gestionali"], multiple: true },
  landingGoal: { options: ["Generare contatti", "Prenotare consulenze", "Vendere un servizio", "Lanciare un prodotto", "Raccogliere iscrizioni", "Testare un’offerta"] },
  campaign: { options: ["Meta Ads", "Google Ads", "Social organico", "Email", "QR code", "Da definire"] },
  form: { options: ["Form contatti", "WhatsApp", "Chiamata", "Prenotazione", "Acquisto", "Download"] },
}

const dateTimeInput = (value?: string) => value ? /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T09:00` : value.slice(0, 16) : new Date(Date.now() + 24 * 60 * 60_000).toISOString().slice(0, 16)
const formatAppointment = (value: string) => new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value))
const appointmentChannel = (notes?: string) => notes?.toLowerCase().includes("whatsapp") ? "WhatsApp" : notes?.toLowerCase().includes("email") ? "Email" : "Agenda DoFlow"

export function GuidedCallButton({ lead, variant = "default", className }: { lead: CommercialLead; variant?: "default" | "outline"; className?: string }) {
  const store = useCommercialLeads()
  const identity = useDoflowIdentity()
  const [open, setOpen] = useState(false)
  const [callId, setCallId] = useState<string>()
  const draft = store.guidedCalls.find((call) => call.leadId === lead.id && call.status === "draft")
  const allowed = identity.hasCapability("manageGuidedCalls") && canViewLead(identity.currentUser, lead)
  if (!allowed) return null
  const launch = () => { const result = store.startGuidedCall(lead.id); if (!result.ok) return toast.error(result.message); setCallId(result.id); setOpen(true) }
  return <><Button type="button" variant={variant} className={className} onClick={launch} data-flow-tour="flow-guided-call"><Play />{draft ? "Riprendi chiamata" : "Avvia chiamata guidata"}</Button><GuidedCallSheet lead={lead} callId={callId ?? draft?.id} open={open} onOpenChange={setOpen} /></>
}

export function GuidedCallAnalytics() {
  const store = useCommercialLeads()
  const calls = store.guidedCalls
  const completed = calls.filter((call) => call.status === "completed")
  const paidLeadIds = useMemo(() => { const ids = new Set<string>(); for (const order of store.orders) { const net = store.payments.filter((payment) => payment.orderId === order.id && payment.status === "Confermato" && !payment.archivedAt).reduce((sum, payment) => sum + (payment.type === "Rimborso" ? -Math.abs(payment.amount) : Math.abs(payment.amount)), 0); if (net <= 0) continue; const sale = store.sales.find((item) => item.id === order.saleId); const customer = store.customers.find((item) => item.id === order.customerId); const leadId = sale?.leadId ?? customer?.sourceLeadId; if (leadId) ids.add(leadId) } return ids }, [store.customers, store.orders, store.payments, store.sales])
  const metrics = [["Chiamate iniziate", calls.length], ["Chiamate completate", completed.length], ["Appuntamenti già fissati", completed.filter((call) => call.mode === "scheduled_appointment").length], ["Nessuna risposta", completed.filter((call) => call.outcome === "Nessuna risposta").length], ["Durata media", `${completed.length ? Math.round(completed.reduce((sum, call) => sum + (call.durationSeconds ?? 0), 0) / completed.length / 60) : 0} min`], ["Qualificazioni", completed.filter((call) => call.outcome === "Qualificato").length], ["Appuntamenti generati", completed.filter((call) => call.outcome === "Appuntamento tecnico" && call.appointmentId && call.appointmentId !== call.linkedAppointmentId).length], ["Proposte da preparare", completed.filter((call) => call.outcome === "Proposta da preparare").length], ["Conversione su incassi", `${completed.length ? Math.round(completed.filter((call) => paidLeadIds.has(call.leadId)).length / completed.length * 100) : 0}%`]] as const
  return <Card><CardHeader><CardTitle>Chiamate commerciali guidate</CardTitle><CardDescription>Metriche derivate dai record autorizzati. La conversione richiede un incasso netto confermato.</CardDescription></CardHeader><CardContent className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">{metrics.map(([label, value]) => <div key={label} className="rounded-lg border bg-muted/20 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold tabular-nums">{value}</p></div>)}</CardContent></Card>
}

function GuidedCallSheet({ lead, callId, open, onOpenChange }: { lead: CommercialLead; callId?: string; open: boolean; onOpenChange: (open: boolean) => void }) {
  const call = useCommercialLeads().guidedCalls.find((item) => item.id === callId)
  if (!call) return null
  return <GuidedCallSheetContent key={call.id} lead={lead} call={call} open={open} onOpenChange={onOpenChange} />
}

function GuidedCallSheetContent({ lead, call, open, onOpenChange }: { lead: CommercialLead; call: GuidedCall; open: boolean; onOpenChange: (open: boolean) => void }) {
  const store = useCommercialLeads()
  const identity = useDoflowIdentity()
  const { setOperationalActivity } = useDoflowPresence()
  const [answers, setAnswers] = useState<GuidedCall["answers"]>(() => call.answers)
  const [savedAt, setSavedAt] = useState<string>()
  const [elapsed, setElapsed] = useState(0)
  const contentRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open || call.status !== "draft") return
    setOperationalActivity({ kind: "guided_call", label: "Chiamata guidata", startedAt: new Date().toISOString() })
    return () => setOperationalActivity(null)
  }, [call.status, open, setOperationalActivity])
  useEffect(() => { if (!open || call.status !== "draft") return; const timer = window.setInterval(() => setElapsed(Math.max(0, Math.floor((Date.now() - new Date(call.startedAt).getTime()) / 1000))), 1000); return () => window.clearInterval(timer) }, [call.startedAt, call.status, open])
  useEffect(() => { if (JSON.stringify(answers) === JSON.stringify(call.answers)) return; const timer = window.setTimeout(() => { if (store.updateGuidedCall(call.id, { answers })) setSavedAt(new Date().toISOString()) }, 450); return () => window.clearTimeout(timer) }, [answers, call.answers, call.id, store])
  useEffect(() => { if (!open) return; const frame = window.requestAnimationFrame(() => contentRef.current?.closest<HTMLElement>("[data-slot='scroll-area-viewport']")?.scrollTo({ top: 0, behavior: "auto" })); return () => window.cancelAnimationFrame(frame) }, [call.currentPhase, open])

  const phase = Math.min(Math.max(call.currentPhase, 1), phases.length)
  const current = phases[phase - 1]
  const participants = call.participants
  const participantOptions = identity.users
    .filter((user) => user.active !== false)
    .map((user) => ({
      user,
      role: (hasCapability(user, "developWebsites")
        ? "consulente web"
        : hasCapability(user, "developSoftware")
          ? "consulente tecnico"
          : "osservatore") as GuidedCallParticipantRole,
    }))
  const scheduledAppointments = store.appointments.filter((item) => item.leadId === lead.id && item.status === "scheduled" && !item.archivedAt)
  const previousCalls = store.guidedCalls.filter((item) => item.leadId === lead.id && item.status === "completed" && item.id !== call.id).sort((a, b) => (b.completedAt ?? b.updatedAt).localeCompare(a.completedAt ?? a.updatedAt))
  const linkedAppointment = scheduledAppointments.find((item) => item.id === call.linkedAppointmentId)
  const previousCall = previousCalls.find((item) => item.id === call.previousCallId) ?? previousCalls[0]
  const detection = useMemo(() => detectGuidedCallServices(lead), [lead])
  const selectedServiceIds = call.selectedServiceIds ?? detection.serviceIds
  const primaryServiceId = call.primaryServiceId && selectedServiceIds.includes(call.primaryServiceId) ? call.primaryServiceId : selectedServiceIds[0]
  const servicePathLabel = selectedServiceIds.length ? selectedServiceIds.map(guidedServiceLabel).join(" + ") : detection.ambiguous ? "Servizio da confermare" : "Standard"
  const setAnswer = (key: string, value: string | boolean | string[]) => setAnswers((currentAnswers) => ({ ...currentAnswers, [key]: value }))
  const materialChecklist = Array.isArray(answers.materialChecklist) ? answers.materialChecklist : []
  const setMode = (mode: GuidedCallMode) => { const previousCallId = mode === "follow_up" ? previousCalls[0]?.id : undefined; store.updateGuidedCall(call.id, { mode, linkedAppointmentId: undefined, previousCallId }) }
  const toggleService = (serviceId: GuidedServiceId) => {
    const current = selectedServiceIds
    const next = serviceId === "undefined" ? [] : current.includes(serviceId) ? current.filter((id) => id !== serviceId) : [...current.filter((id) => id !== "undefined"), serviceId]
    const nextPrimary = next.includes(primaryServiceId as GuidedServiceId) ? primaryServiceId : next[0]
    const now = new Date().toISOString()
    store.updateGuidedCall(call.id, { selectedServiceIds: next, primaryServiceId: nextPrimary, serviceSelectionUpdatedAt: now, serviceSelectionUpdatedBy: identity.currentUser.id })
    setAnswers((currentAnswers) => ({ ...currentAnswers, confirmedServices: next.map(guidedServiceLabel), recommendedService: nextPrimary ? guidedServiceLabel(nextPrimary) : "" }))
  }
  const setPrimaryService = (serviceId: GuidedServiceId) => store.updateGuidedCall(call.id, { primaryServiceId: serviceId, serviceSelectionUpdatedAt: new Date().toISOString(), serviceSelectionUpdatedBy: identity.currentUser.id })
  const selectAppointment = (appointmentId: string) => store.updateGuidedCall(call.id, { mode: "scheduled_appointment", linkedAppointmentId: appointmentId, previousCallId: undefined })
  const move = (next: number) => { if (!call.mode) return toast.error("Seleziona il tipo di chiamata"); if (call.mode === "scheduled_appointment" && !linkedAppointment) return toast.error("Seleziona l’appuntamento già fissato"); store.updateGuidedCall(call.id, { currentPhase: Math.min(Math.max(next, 1), phases.length), answers }) }
  const toggleParticipant = (userId: string, role: GuidedCallParticipantRole) => { const exists = participants.some((item) => item.userId === userId && item.role === role); store.updateGuidedCall(call.id, { participants: exists ? participants.filter((item) => !(item.userId === userId && item.role === role)) : [...participants, { userId, role }] }) }
  const buildSummary = () => {
    const service = selectedServiceIds.length ? selectedServiceIds.map(guidedServiceLabel).join(" + ") : lead.service || "servizio da definire"
    const goal = String(answers.mainGoal || "risultato da chiarire"); const situation = String(answers.currentSituation || "situazione da verificare"); const budget = String(answers.budgetRange || "budget da definire"); const urgency = String(answers.projectUrgency || answers.desiredDate || "tempistiche da definire"); const next = String(answers.nextStep || "prossimo passo da concordare"); const notes = String(answers.consultantNotes || "").trim()
    return `${lead.company || `${lead.firstName} ${lead.lastName}`.trim()} vuole ${goal.toLocaleLowerCase("it-IT")} attraverso ${service}. Si parte da: ${situation}. Budget indicativo: ${budget}; tempistiche: ${urgency}. Prossimo passo concordato: ${next}.${notes ? ` Note del consulente: ${notes}` : ""}`
  }
  const finish = () => {
    const nextStep = String(answers.nextStep || ""); if (!String(answers.mainGoal || "").trim() || !nextStep || !selectedServiceIds.length) return toast.error("Conferma obiettivo, servizio e prossimo passo")
    const outcomeByStep: Record<string, GuidedCallOutcome> = { "Inviare proposta": "Proposta da preparare", "Fissare incontro tecnico": "Appuntamento tecnico", "Richiedere materiali": "Qualificato", "Fare follow-up": "Ricontattare", "Cliente deve decidere": "Lead da approfondire", "Non idoneo": "Non idoneo" }
    const outcome = outcomeByStep[nextStep] ?? "Lead da approfondire"; const summary = buildSummary(); const nextActionAt = String(answers.finalNextActionAt || dateTimeInput(lead.nextActionAt)); const result = store.completeGuidedCall(call.id, { outcome, summary, recommendedService: primaryServiceId ? guidedServiceLabel(primaryServiceId) : lead.service, selectedServiceIds, primaryServiceId, serviceSelectionReason: String(answers.serviceSelectionReason || ""), confirmedProbability: Number(answers.confirmedProbability ?? lead.probability), confirmedStage: String(answers.confirmedStage || lead.stage) as PipelineStage, nextAction: nextStep, nextActionAt, nextAssigneeId: String(answers.nextAssigneeId || lead.assigneeId), technicalParticipantId: String(answers.technicalParticipantId || "") || undefined, createAppointment: outcome === "Appuntamento tecnico" && !call.linkedAppointmentId, materialChecklist }); if (!result.ok) return toast.error(result.message); toast.success(result.existing ? "Chiamata già salvata" : "Briefing confermato"); onOpenChange(false)
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent showCloseButton={false} className="flex h-dvh w-full flex-col overflow-hidden p-0 sm:max-w-[760px] xl:max-w-[1040px]">
        <SheetHeader className="shrink-0 space-y-3 border-b px-4 py-3 text-left">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
            <div className="min-w-0">
              <SheetTitle className="truncate">Chiamata guidata · {lead.firstName} {lead.lastName}</SheetTitle>
              <SheetDescription className="truncate">{lead.company || lead.service} · {servicePathLabel}</SheetDescription>
            </div>
            <SheetClose asChild><Button size="icon-sm" variant="ghost" className="size-9" aria-label="Chiudi chiamata guidata"><X /></Button></SheetClose>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="secondary">{pipelineStages.find((item) => item.id === lead.stage)?.label}</Badge>
            {lead.phone && <span>{lead.phone}</span>}
            {lead.email && <span className="max-w-56 truncate">{lead.email}</span>}
            <span className="ml-auto inline-flex items-center gap-1 tabular-nums"><Clock3 className="size-3.5" />{Math.floor(elapsed / 60)}:{String(elapsed % 60).padStart(2, "0")}</span>
            <span>{savedAt ? "Salvato" : "Autosalvataggio attivo"}</span>
          </div>
          <details className="rounded-md border bg-muted/20 px-3 py-2 text-xs">
            <summary className="cursor-pointer font-medium">Partecipanti · {participants.length}</summary>
            <div className="mt-2 flex flex-wrap gap-2">
              {participantOptions.map(({ user, role }) => <Button key={user.id} type="button" size="xs" variant={participants.some((item) => item.userId === user.id && item.role === role) ? "secondary" : "outline"} onClick={() => toggleParticipant(user.id, role)}>{user.name} · {role}</Button>)}
            </div>
          </details>
          <Progress value={call.mode ? phase / phases.length * 100 : 0} className="h-1.5" />
        </SheetHeader>
        <ScrollArea className="min-h-0 flex-1">
          <div ref={contentRef} className="space-y-4 px-4 py-4">
            {!call.mode ? (
              <>
                <InitialRequestCard lead={lead} detection={detection} selected={selectedServiceIds} primary={primaryServiceId} reason={String(answers.serviceSelectionReason || "")} onToggle={toggleService} onPrimary={setPrimaryService} onReason={(value) => setAnswer("serviceSelectionReason", value)} />
                <CallModeCard call={call} appointments={scheduledAppointments} previousCalls={previousCalls} linkedAppointment={linkedAppointment} onMode={setMode} onAppointment={selectAppointment} />
              </>
            ) : (
              <>
                {call.mode === "follow_up" && previousCall && <PreviousCallCard call={previousCall} />}
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-primary">Fase {phase} di {phases.length}</p>
                  <h2 className="mt-1 text-xl font-semibold">{current.title}</h2>
                  <p className="text-sm text-muted-foreground">{current.intro}</p>
                </div>
                <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.6fr)_minmax(260px,.8fr)]">
                  <div className="min-w-0 space-y-3">
                    {phase === 2 && <InitialRequestCard lead={lead} detection={detection} selected={selectedServiceIds} primary={primaryServiceId} reason={String(answers.serviceSelectionReason || "")} onToggle={toggleService} onPrimary={setPrimaryService} onReason={(value) => setAnswer("serviceSelectionReason", value)} />}
                    <Card className="border-primary/30">
                      <CardHeader className="pb-2"><CardDescription>Domanda essenziale</CardDescription><CardTitle className="text-base">{current.question}</CardTitle></CardHeader>
                      <CardContent className="space-y-3">
                        <p className="rounded-md bg-primary/5 p-3 text-sm">“{current.say}”</p>
                        {current.options.length > 0 && <QuickAnswerChoices answerKey={current.answerKey} options={current.options} value={answers[current.answerKey]} onChange={setAnswer} />}
                        {current.options.includes("Altro") && answers[current.answerKey] === "Altro" && <Input aria-label="Specifica altro" value={String(answers[`${current.answerKey}Detail`] || "")} onChange={(event) => setAnswer(`${current.answerKey}Detail`, event.target.value)} placeholder="Specifica in poche parole" />}
                        {current.secondary?.length ? <div className="grid gap-3 sm:grid-cols-2">{current.secondary.map((field) => <GuidedField key={field[0]} field={field} value={answers[field[0]]} onChange={(value) => setAnswer(field[0], value)} />)}</div> : null}
                        {phase === 2 && primaryServiceId && <ServiceSpecificPrompt serviceId={primaryServiceId} answers={answers} setAnswer={setAnswer} />}
                      </CardContent>
                    </Card>
                    {phase === 5 && <Card className="bg-muted/20"><CardHeader className="pb-2"><CardTitle className="text-sm">Sintesi del briefing</CardTitle></CardHeader><CardContent className="space-y-2 text-sm"><p>{buildSummary()}</p><details><summary className="cursor-pointer text-xs font-medium text-primary">Visualizza tutte le risposte</summary><pre className="mt-2 whitespace-pre-wrap break-words rounded-md bg-background p-2 text-xs">{JSON.stringify(answers, null, 2)}</pre></details></CardContent></Card>}
                    <details className="rounded-lg border bg-muted/20 p-3">
                      <summary className="cursor-pointer text-sm font-medium">Approfondisci solo se serve</summary>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        <GuidedField field={["secondaryGoals", "Obiettivi secondari", "long"]} value={answers.secondaryGoals} onChange={(value) => setAnswer("secondaryGoals", value)} />
                        <GuidedField field={["objections", "Dubbi o vincoli emersi", "long"]} value={answers.objections} onChange={(value) => setAnswer("objections", value)} />
                      </div>
                    </details>
                    <details className="rounded-lg border p-3">
                      <summary className="cursor-pointer text-sm font-medium">Note del consulente</summary>
                      <Textarea className="mt-3 min-h-20" value={String(answers.consultantNotes || "")} onChange={(event) => setAnswer("consultantNotes", event.target.value)} placeholder="Note facoltative" />
                    </details>
                  </div>
                  <Card className="h-fit bg-muted/20">
                    <CardHeader className="pb-2"><CardTitle className="text-sm">Guida consulenziale</CardTitle></CardHeader>
                    <CardContent className="space-y-3 text-xs">
                      <p><b>Perché:</b> {current.why}</p>
                      <p><b>Approfondisci:</b> {current.deepen}</p>
                      <p className="text-amber-700 dark:text-amber-300"><b>Evita:</b> {current.avoid}</p>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </div>
        </ScrollArea>
        <SheetFooter className="shrink-0 flex-row items-center justify-between gap-2 border-t px-4 py-3">
          <Button variant="outline" size="sm" onClick={() => move(phase - 1)} disabled={!call.mode || phase === 1}><ChevronLeft />Indietro</Button>
          <Button variant="ghost" size="sm" onClick={() => { if (store.updateGuidedCall(call.id, { answers })) { setSavedAt(new Date().toISOString()); toast.success("Bozza salvata") } }} disabled={!call.mode}><Save />Salva bozza</Button>
          {phase < phases.length ? <Button size="sm" onClick={() => move(phase + 1)} disabled={!call.mode}>Continua<ChevronRight /></Button> : <Button size="sm" onClick={finish} disabled={!call.mode}>Conferma briefing<Check /></Button>}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}

function QuickAnswerChoices({ answerKey, options, value, onChange }: { answerKey: string; options: readonly string[]; value: GuidedCall["answers"][string]; onChange: (key: string, value: string) => void }) {
  const selected = String(value ?? "")
  return <div className="flex flex-wrap gap-2" role="group" aria-label="Risposte rapide">{options.map((option) => <Button key={option} type="button" size="sm" variant={selected === option ? "default" : "outline"} aria-pressed={selected === option} onClick={() => onChange(answerKey, option)}>{selected === option && <Check />}{option}</Button>)}</div>
}

function ServiceSpecificPrompt({ serviceId, answers, setAnswer }: { serviceId: GuidedServiceId; answers: GuidedCall["answers"]; setAnswer: (key: string, value: string) => void }) {
  const config = serviceId === "service-showcase-site"
    ? { key: "showcaseContents", label: "Quali contenuti o sezioni principali servono?", options: ["Azienda", "Servizi", "Portfolio", "Testimonianze", "Contatti", "Da definire"] }
    : serviceId === "service-ecommerce"
      ? { key: "ecommerceOfferReadiness", label: "Cosa vende e quanti prodotti iniziali sono previsti?", options: ["Fino a 20", "21–100", "Oltre 100", "Servizi/prenotazioni", "Da definire"] }
      : serviceId === "service-landing-page"
        ? { key: "landingPrimaryAction", label: "Qual è l’azione principale che il visitatore deve compiere?", options: ["Inviare un form", "Scrivere su WhatsApp", "Prenotare", "Acquistare", "Scaricare", "Da definire"] }
        : undefined
  if (!config) return null
  return <div className="space-y-2 border-t pt-3"><p className="text-sm font-medium">{config.label}</p><QuickAnswerChoices answerKey={config.key} options={config.options} value={answers[config.key]} onChange={setAnswer} /></div>
}

function CallModeCard({ call, appointments, previousCalls, linkedAppointment, onMode, onAppointment }: { call: GuidedCall; appointments: ReturnType<typeof useCommercialLeads>["appointments"]; previousCalls: GuidedCall[]; linkedAppointment?: ReturnType<typeof useCommercialLeads>["appointments"][number]; onMode: (mode: GuidedCallMode) => void; onAppointment: (id: string) => void }) {
  const modes: Array<{ id: GuidedCallMode; label: string; description: string }> = [{ id: "first_contact", label: "Primo contatto", description: "Prima conversazione conoscitiva con il lead." }, { id: "scheduled_appointment", label: "Appuntamento già fissato", description: "Consulenza collegata a un appuntamento esistente." }, { id: "follow_up", label: "Follow-up", description: "Riprende risposte e contesto della chiamata precedente." }]
  return <Card className={!call.mode ? "border-primary" : undefined}><CardHeader className="pb-3"><CardTitle className="text-base">Tipo di chiamata</CardTitle><CardDescription>La scelta determina il percorso operativo e viene salvata nel record.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid gap-2 sm:grid-cols-3">{modes.map((mode) => <Button key={mode.id} type="button" variant={call.mode === mode.id ? "default" : "outline"} className="h-auto min-h-16 items-start justify-start whitespace-normal p-3 text-left" onClick={() => onMode(mode.id)} disabled={mode.id === "follow_up" && !previousCalls.length}><span><span className="block font-medium">{mode.label}</span><span className="mt-1 block text-xs opacity-80">{mode.description}</span></span></Button>)}</div>{call.mode === "scheduled_appointment" && <div className="space-y-2"><Label>Appuntamento esistente<Select value={call.linkedAppointmentId ?? ""} onValueChange={onAppointment}><SelectTrigger aria-label="Appuntamento esistente"><SelectValue placeholder={appointments.length ? "Seleziona appuntamento" : "Nessun appuntamento disponibile"} /></SelectTrigger><SelectContent>{appointments.map((appointment) => <SelectItem key={appointment.id} value={appointment.id}>{formatAppointment(appointment.startsAt)} · {appointment.title}</SelectItem>)}</SelectContent></Select></Label>{linkedAppointment && <div className="rounded-md border bg-muted/30 p-3 text-sm"><div className="flex items-center gap-2 font-medium"><CalendarClock className="size-4" />{formatAppointment(linkedAppointment.startsAt)}</div><p className="mt-1 text-xs text-muted-foreground">Canale: {appointmentChannel(linkedAppointment.notes)} · {linkedAppointment.notes || "Appuntamento concordato e registrato in DoFlow."}</p><Badge className="mt-2" variant="outline">Collegato senza duplicazioni</Badge></div>}{!appointments.length && <p className="text-sm text-amber-700 dark:text-amber-300">Non esistono appuntamenti pianificati per questo lead.</p>}</div>}</CardContent></Card>
}

function InitialRequestCard({ lead, detection, selected, primary, reason, onToggle, onPrimary, onReason }: { lead: CommercialLead; detection: ReturnType<typeof detectGuidedCallServices>; selected: GuidedServiceId[]; primary?: GuidedServiceId; reason: string; onToggle: (id: GuidedServiceId) => void; onPrimary: (id: GuidedServiceId) => void; onReason: (value: string) => void }) {
  const [showOriginal, setShowOriginal] = useState(false)
  const original = lead.originalRequest
  const submission = lead.formSubmission
  const objectives = original?.objectives ?? submission?.goals ?? []
  const timing = original?.timing ?? submission?.timing
  const province = original?.province ?? submission?.province
  return <Card className="border-primary/30 bg-primary/5"><CardHeader className="pb-2"><div className="flex flex-wrap items-start justify-between gap-2"><div><CardDescription>Richiesta iniziale</CardDescription><CardTitle className="mt-1 text-base">{detection.label}</CardTitle></div><Badge variant="outline">{lead.source}</Badge></div></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap gap-1.5">{guidedServiceOptions.map((option) => { const active = option.id === "undefined" ? selected.length === 0 : selected.includes(option.id); return <Button key={option.id} type="button" size="xs" variant={active ? "default" : "outline"} aria-pressed={active} onClick={() => onToggle(option.id)}>{active && <Check />}{option.label}</Button> })}</div>{selected.length > 1 && <div className="flex flex-wrap items-center gap-1.5"><span className="text-xs text-muted-foreground">Servizio principale:</span>{selected.map((id) => <Button key={id} type="button" size="xs" variant={primary === id ? "secondary" : "ghost"} onClick={() => onPrimary(id)}>{guidedServiceLabel(id)}</Button>)}</div>}<div className="flex flex-wrap items-center gap-2"><Button type="button" size="xs" variant="ghost" onClick={() => setShowOriginal((value) => !value)} aria-expanded={showOriginal}>{showOriginal ? "Nascondi richiesta originale" : "Vedi richiesta originale"}</Button><span className="text-xs text-muted-foreground">Modifica servizi senza perdere i dati iniziali.</span></div>{showOriginal && <div className="space-y-1 rounded-md border bg-background/70 p-3 text-sm"><p><b>Servizio indicato:</b> {(original?.projectType ?? submission?.projectType ?? lead.service) || "Non indicato"}</p>{objectives.length > 0 && <p><b>Obiettivi:</b> {objectives.join(", ")}</p>}{timing && <p><b>Tempistiche:</b> {timing}</p>}{province && <p><b>Provincia:</b> {province}</p>} {!original && !submission && <p className="text-muted-foreground">Nessun dettaglio aggiuntivo inviato dal sito.</p>}</div>}{JSON.stringify(selected) !== JSON.stringify(detection.serviceIds) && <Label>Motivo della modifica (facoltativo)<Input value={reason} onChange={(event) => onReason(event.target.value)} placeholder="Esigenza chiarita durante la chiamata" /></Label>}</CardContent></Card>
}

function PreviousCallCard({ call }: { call: GuidedCall }) {
  return <Card className="border-blue-500/30 bg-blue-500/5"><CardHeader className="pb-2"><CardTitle className="text-sm">Risposte della chiamata precedente</CardTitle><CardDescription>{call.completedAt ? formatAppointment(call.completedAt) : "Storico disponibile"} · {call.outcome}</CardDescription></CardHeader><CardContent className="space-y-2 text-sm"><p>{call.summary || "Nessuna sintesi disponibile."}</p><div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">{Object.entries(call.answers).filter(([, value]) => typeof value === "string" && value.trim()).slice(0, 6).map(([key, value]) => <p key={key}><b className="text-foreground">{key}:</b> {String(value)}</p>)}</div></CardContent></Card>
}

function GuidedField({ field, value, onChange }: { field: Field; value: GuidedCall["answers"][string]; onChange: (value: string | string[]) => void }) {
  const [key, label, kind] = field
  const rapid = rapidAnswers[key]
  if (rapid) { const selected = Array.isArray(value) ? value : value ? [String(value)] : []; return <fieldset className={kind === "long" ? "sm:col-span-2" : ""}><legend className="mb-1.5 text-sm font-medium">{label}</legend><div className="flex flex-wrap gap-1.5">{rapid.options.map((option) => { const active = selected.includes(option); return <Button key={option} type="button" size="xs" variant={active ? "default" : "outline"} aria-pressed={active} onClick={() => onChange(rapid.multiple ? active ? selected.filter((item) => item !== option) : [...selected, option] : active ? "" : option)}>{active && <Check />}{option}</Button>})}</div></fieldset> }
  if (kind === "choice") return <Label>{label}<Select value={String(value ?? "")} onValueChange={onChange}><SelectTrigger aria-label={label}><SelectValue placeholder="Seleziona" /></SelectTrigger><SelectContent><SelectItem value="Sì">Sì</SelectItem><SelectItem value="No">No</SelectItem><SelectItem value="Da verificare">Da verificare</SelectItem></SelectContent></Select></Label>
  if (kind === "long") return <Label className="sm:col-span-2">{label}<Textarea aria-label={label} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} /></Label>
  return <Label>{label}<Input aria-label={label} type={kind === "date" ? "date" : kind === "datetime" ? "datetime-local" : "text"} value={String(value ?? "")} onChange={(event) => onChange(event.target.value)} data-field={key} /></Label>
}
