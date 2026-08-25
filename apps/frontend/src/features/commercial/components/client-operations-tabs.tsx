"use client"

import { useEffect, useMemo, useState } from "react"
import { FileSignature, Pencil, Plus, Repeat2, Trash2 } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { type CustomerCommunication, type CustomerDocument, useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { commercePaymentStatusLabel } from "@/features/commercial/commercial-commerce"
import { RecordCollaborationPanel } from "@/features/commercial/components/record-collaboration-panel"
import { useCommercialTeam } from "@/features/commercial/use-commercial-team"
import { customerDocumentStatuses, DocumentStatusBadge, documentStatusFilterClass } from "@/features/commercial/document-status"
import { AccessDenied } from "@/features/identity/access-denied"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { formatItalianDateTime } from "@/lib/date"
import { commerceApi, type CustomerCommerceEconomics } from "@/lib/tenant-commerce-api"

const money = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" })
const toLocalInput = (value = new Date().toISOString()) => new Date(value).toISOString().slice(0, 16)
const communicationEmpty = () => ({ channel: "Nota" as CustomerCommunication["channel"], title: "", body: "", occurredAt: toLocalInput(), projectId: "none" })
const documentEmpty = () => ({ name: "", status: "Da ricevere" as CustomerDocument["status"], notes: "", projectId: "none" })

export function ClientCommunicationsTab({ clientId }: { clientId: string }) {
  const store = useCommercialLeads(); const customer = store.customers.find((item) => item.id === clientId); const projects = store.projects.filter((project) => project.clientId === clientId && !project.archivedAt)
  const [editing, setEditing] = useState<CustomerCommunication | null>(null); const [open, setOpen] = useState(false); const [form, setForm] = useState(communicationEmpty)
  if (!customer) return null
  const communications = (customer.communications ?? []).filter((item) => !item.archivedAt).sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime())
  const start = (item?: CustomerCommunication) => { setEditing(item ?? null); setForm(item ? { channel: item.channel, title: item.title, body: item.body, occurredAt: toLocalInput(item.occurredAt), projectId: item.projectId ?? "none" } : communicationEmpty()); setOpen(true) }
  const save = () => { if (!form.title.trim() || !form.body.trim() || !form.occurredAt) return toast.error("Titolo, contenuto e data sono obbligatori"); const values = { channel: form.channel, title: form.title.trim(), body: form.body.trim(), occurredAt: new Date(form.occurredAt).toISOString(), projectId: form.projectId === "none" ? undefined : form.projectId, leadId: customer.sourceLeadId }; if (editing) store.updateCustomerCommunication(clientId, editing.id, values); else store.addCustomerCommunication(clientId, values); toast.success(editing ? "Comunicazione aggiornata" : "Comunicazione registrata"); setOpen(false) }
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Comunicazioni</h2><p className="text-sm text-muted-foreground">Cronologia di note e contatti collegati al cliente.</p></div><Button onClick={() => start()}><Plus />Nuova comunicazione</Button></div><Card><CardContent className="divide-y p-0">{communications.length ? communications.map((item) => <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{item.channel}</Badge><p className="font-medium">{item.title}</p></div><p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{item.body}</p><p className="mt-2 text-xs text-muted-foreground">{formatItalianDateTime(item.occurredAt)}{item.projectId ? ` · ${projects.find((project) => project.id === item.projectId)?.name ?? "Progetto"}` : " · Cliente"}</p></div><div className="flex gap-1"><Button size="icon-sm" variant="ghost" aria-label={`Modifica ${item.title}`} onClick={() => start(item)}><Pencil /></Button><Button size="icon-sm" variant="ghost" className="text-destructive" aria-label={`Elimina ${item.title}`} onClick={() => { store.removeCustomerCommunication(clientId, item.id); toast.success("Comunicazione eliminata") }}><Trash2 /></Button></div></div>) : <p className="p-8 text-center text-sm text-muted-foreground">Nessuna comunicazione registrata.</p>}</CardContent></Card><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? "Modifica comunicazione" : "Nuova comunicazione"}</DialogTitle></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Field label="Canale"><Select value={form.channel} onValueChange={(value) => setForm({ ...form, channel: value as CustomerCommunication["channel"] })}><SelectTrigger aria-label="Canale comunicazione"><SelectValue /></SelectTrigger><SelectContent>{["WhatsApp", "Email", "Chiamata", "Nota"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field><Field label="Data e ora"><Input aria-label="Data comunicazione" type="datetime-local" value={form.occurredAt} onChange={(event) => setForm({ ...form, occurredAt: event.target.value })} /></Field><div className="sm:col-span-2"><Field label="Titolo"><Input aria-label="Titolo comunicazione" value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></Field></div><div className="sm:col-span-2"><Field label="Contenuto"><Textarea aria-label="Contenuto comunicazione" value={form.body} onChange={(event) => setForm({ ...form, body: event.target.value })} /></Field></div><div className="sm:col-span-2"><Field label="Collegamento"><Select value={form.projectId} onValueChange={(projectId) => setForm({ ...form, projectId })}><SelectTrigger aria-label="Progetto comunicazione"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Solo cliente e lead</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></Field></div></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button><Button onClick={save}>Salva comunicazione</Button></DialogFooter></DialogContent></Dialog></div>
}

export function ClientDocumentsTab({ clientId }: { clientId: string }) {
  const store = useCommercialLeads(); const customer = store.customers.find((item) => item.id === clientId); const projects = store.projects.filter((project) => project.clientId === clientId && !project.archivedAt)
  const [filter, setFilter] = useState<"Tutti" | CustomerDocument["status"]>("Tutti"); const [editing, setEditing] = useState<CustomerDocument | null>(null); const [open, setOpen] = useState(false); const [form, setForm] = useState(documentEmpty)
  if (!customer) return null
  const allDocuments = customer.documents ?? []
  const statusOf = (item: CustomerDocument) => item.archivedAt ? "Archiviato" as const : item.status
  const documents = allDocuments.filter((item) => filter === "Tutti" ? !item.archivedAt : statusOf(item) === filter).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
  const count = (status?: CustomerDocument["status"]) => status ? allDocuments.filter((item) => statusOf(item) === status).length : allDocuments.filter((item) => !item.archivedAt).length
  const start = (item?: CustomerDocument) => { setEditing(item ?? null); setForm(item ? { name: item.name, status: item.status, notes: item.notes ?? "", projectId: item.projectId ?? "none" } : documentEmpty()); setOpen(true) }
  const save = () => { if (!form.name.trim()) return toast.error("Il nome del documento è obbligatorio"); const values = { name: form.name.trim(), status: form.status, notes: form.notes.trim() || undefined, projectId: form.projectId === "none" ? undefined : form.projectId }; if (editing) store.updateCustomerDocument(clientId, editing.id, values); else store.addCustomerDocument(clientId, values); toast.success(editing ? "Documento aggiornato" : "Documento registrato"); setOpen(false) }
  return <div className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-2"><div><h2 className="font-semibold">Documenti</h2><p className="text-sm text-muted-foreground">Metadati e stato dei documenti; nessun file viene simulato.</p></div><Button onClick={() => start()}><Plus />Nuovo documento</Button></div><div className="flex gap-2 overflow-x-auto pb-1"><Button size="sm" variant="outline" aria-pressed={filter === "Tutti"} className={filter === "Tutti" ? "border-primary bg-primary/10 text-primary" : ""} onClick={() => setFilter("Tutti")}>Tutti <Badge variant="secondary">{count()}</Badge></Button>{customerDocumentStatuses.map((value) => <Button key={value} size="sm" variant="outline" aria-pressed={filter === value} className={documentStatusFilterClass(value, filter === value)} onClick={() => setFilter((current) => current === value ? "Tutti" : value)}>{value} <span className="tabular-nums">{count(value)}</span></Button>)}</div><Card><CardContent className="divide-y p-0">{documents.length ? documents.map((item) => <div key={item.id} className="flex flex-wrap items-start justify-between gap-3 p-4"><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{item.name}</p><DocumentStatusBadge status={statusOf(item)} /></div><p className="mt-1 text-sm text-muted-foreground">{item.notes || "Nessuna nota"}</p><p className="mt-2 text-xs text-muted-foreground">{item.projectId ? projects.find((project) => project.id === item.projectId)?.name ?? "Progetto" : "Cliente"}</p></div><div className="flex gap-1"><RecordCollaborationPanel recordType="document" recordId={item.id} label={item.name} compact />{!item.archivedAt && <><Button size="icon-sm" variant="ghost" aria-label={`Modifica ${item.name}`} onClick={() => start(item)}><Pencil /></Button><Button size="icon-sm" variant="ghost" className="text-destructive" aria-label={`Archivia ${item.name}`} onClick={() => { store.removeCustomerDocument(clientId, item.id); toast.success("Documento archiviato") }}><Trash2 /></Button></>}</div></div>) : <p className="p-8 text-center text-sm text-muted-foreground">Nessun documento per questo filtro.</p>}</CardContent></Card><Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>{editing ? "Modifica documento" : "Nuovo documento"}</DialogTitle></DialogHeader><div className="grid gap-3"><Field label="Nome documento"><Input aria-label="Nome documento" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></Field><Field label="Stato"><Select value={form.status} onValueChange={(status) => setForm({ ...form, status: status as CustomerDocument["status"] })}><SelectTrigger aria-label="Stato documento"><SelectValue /></SelectTrigger><SelectContent>{customerDocumentStatuses.filter((value) => value !== "Archiviato").map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field><Field label="Progetto"><Select value={form.projectId} onValueChange={(projectId) => setForm({ ...form, projectId })}><SelectTrigger aria-label="Progetto documento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Solo cliente</SelectItem>{projects.map((project) => <SelectItem key={project.id} value={project.id}>{project.name}</SelectItem>)}</SelectContent></Select></Field><Field label="Note"><Textarea aria-label="Note documento" value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></Field></div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Annulla</Button><Button onClick={save}>Salva documento</Button></DialogFooter></DialogContent></Dialog></div>
}

export function ClientTimelineTab({ clientId }: { clientId: string }) {
  const store = useCommercialLeads(); const customer = store.customers.find((item) => item.id === clientId); const [filter, setFilter] = useState("Tutti")
  const items = useMemo(() => {
    if (!customer) return []
    const projects = store.projects.filter((project) => project.clientId === clientId)
    const persisted = store.timelineEvents.filter((event) => event.leadId === customer.sourceLeadId || Boolean(event.activityId && (customer.activities ?? []).some((activity) => activity.id === event.activityId)))
    const persistedIds = new Set(persisted.map((event) => event.id))
    const activityEventIds = new Set(persisted.map((event) => event.activityId).filter(Boolean))
    const synthetic = [
      { id: `lead-${customer.sourceLeadId}`, leadId: customer.sourceLeadId, kind: "status" as const, title: "Lead acquisito", detail: `Origine: ${customer.profile.source}`, date: customer.profile.createdAt, author: "Sistema" },
      ...(customer.activities ?? []).filter((activity) => !activityEventIds.has(activity.id)).map((activity) => ({ id: `activity-created-${activity.id}`, leadId: customer.sourceLeadId, activityId: activity.id, kind: "status" as const, title: "Attività cliente", detail: activity.title, date: activity.createdAt, author: activity.createdBy })),
      ...(customer.communications ?? []).filter((entry) => !entry.archivedAt && !persistedIds.has(`communication-${entry.id}`)).map((entry) => ({ id: `communication-${entry.id}`, leadId: customer.sourceLeadId, kind: "status" as const, title: `${entry.channel}: ${entry.title}`, detail: entry.body, date: entry.occurredAt, author: "Sistema" })),
      ...(customer.documents ?? []).filter((entry) => !entry.archivedAt && !persisted.some((event) => event.id.includes(entry.id))).map((entry) => ({ id: `document-${entry.id}`, leadId: customer.sourceLeadId, kind: "status" as const, title: `Documento ${entry.status.toLowerCase()}`, detail: entry.name, date: entry.updatedAt, author: "Sistema" })),
      ...projects.filter((project) => !persisted.some((event) => event.detail.includes(project.name) || event.id === `delivery-${project.id}`)).map((project) => ({ id: `project-${project.id}`, leadId: customer.sourceLeadId, kind: "status" as const, title: project.status === "delivered" ? "Progetto consegnato" : "Progetto collegato", detail: project.name, date: project.deliveredAt ?? project.updatedAt, author: "Sistema" })),
    ]
    const known = new Set<string>()
    return [...synthetic, ...persisted].filter((event) => !known.has(event.id) && Boolean(known.add(event.id))).map((event) => ({ ...event, category: event.id.startsWith("communication-") ? "Comunicazioni" : event.id.startsWith("document-") ? "Documenti" : "contractId" in event && event.contractId ? "Contratti" : "renewalId" in event && event.renewalId ? "Rinnovi" : event.id.startsWith("project-") || event.id.startsWith("delivery-") || event.title.includes("Progetto") || projects.some((project) => event.detail.includes(project.name)) ? "Progetti" : event.id.startsWith("merge-") || event.title.includes("duplicati") ? "Fusioni" : "activityId" in event && event.activityId ? "Attività" : "Cliente" })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [clientId, customer, store.projects, store.timelineEvents])
  if (!customer) return null
  const visible = items.filter((item) => filter === "Tutti" || item.category === filter)
  return <div className="space-y-4"><div><h2 className="font-semibold">Timeline</h2><p className="text-sm text-muted-foreground">Storico unificato e ordinato, senza duplicare gli eventi persistiti.</p></div><div className="flex flex-wrap gap-2">{["Tutti", "Cliente", "Attività", "Progetti", "Comunicazioni", "Documenti", "Contratti", "Rinnovi", "Fusioni"].map((value) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} onClick={() => setFilter(value)}>{value}</Button>)}</div><Card><CardContent className="space-y-4 p-4">{visible.length ? visible.map((event) => { const document = event.category === "Documenti" ? (customer.documents ?? []).find((item) => event.id.includes(item.id)) : undefined; const historicalStatus = customerDocumentStatuses.find((status) => event.title.toLocaleLowerCase("it-IT") === `documento ${status.toLocaleLowerCase("it-IT")}`); return <div key={event.id} className="border-l-2 border-primary/30 pl-3"><div className="flex flex-wrap items-center gap-2"><p className="font-medium">{event.title}</p>{document ? <DocumentStatusBadge status={historicalStatus ?? (document.archivedAt ? "Archiviato" : document.status)} /> : <Badge variant="secondary">{event.category}</Badge>}</div><p className="text-sm text-muted-foreground">{event.detail}</p><p className="text-xs text-muted-foreground">{formatItalianDateTime(event.date)} · {event.author}</p></div> }) : <p className="text-sm text-muted-foreground">Nessun evento per questo filtro.</p>}</CardContent></Card></div>
}

export function ClientCareFinanceTab({ clientId, showAdministration }: { clientId: string; showAdministration: boolean }) {
  const commercialTeam = useCommercialTeam()
  const identity = useDoflowIdentity()
  const store = useCommercialLeads()
  const customer = store.customers.find((item) => item.id === clientId)
  const [care, setCare] = useState(() => ({
    mode: customer?.care?.mode ?? "Nessuna",
    nextDueAt: customer?.care?.nextDueAt?.slice(0, 10) ?? "",
    assigneeId: customer?.care?.assigneeId ?? customer?.profile.assigneeId ?? identity.currentUserId,
    recurrenceMonths: String(customer?.care?.recurrenceMonths ?? 12),
  }))
  const [economics, setEconomics] = useState<CustomerCommerceEconomics | null>(null)
  const [economicsStatus, setEconomicsStatus] = useState<"loading" | "loaded" | "error">("loading")

  useEffect(() => {
    if (!showAdministration) return
    let cancelled = false
    queueMicrotask(() => { if (!cancelled) setEconomicsStatus("loading") })
    void commerceApi.customerEconomics(clientId).then((result) => {
      if (cancelled) return
      setEconomics(result)
      setEconomicsStatus("loaded")
    }).catch(() => {
      if (cancelled) return
      setEconomics(null)
      setEconomicsStatus("error")
    })
    return () => { cancelled = true }
  }, [clientId, showAdministration])

  if (!customer) return null
  if (!identity.hasCapability("canViewAdministration")) return <AccessDenied resource="all’amministrazione cliente" />
  const careValues = () => {
    const recurrenceMonths = Number(care.recurrenceMonths)
    return {
      mode: care.mode as "Nessuna" | "Assistenza" | "Rinnovo",
      nextDueAt: care.nextDueAt ? new Date(`${care.nextDueAt}T12:00:00`).toISOString() : undefined,
      assigneeId: care.assigneeId,
      recurrenceMonths: Number.isFinite(recurrenceMonths) && recurrenceMonths > 0 ? recurrenceMonths : undefined,
      lastGeneratedDueAt: customer.care?.lastGeneratedDueAt,
    }
  }
  const saveCare = () => { const ok = store.updateCustomerCare(clientId, careValues()); if (ok) toast.success("Assistenza e rinnovo aggiornati") }

  return <div className={`grid gap-4 ${showAdministration ? "lg:grid-cols-2" : ""}`}>
    <Card>
      <CardHeader><CardTitle>Assistenza e rinnovo</CardTitle><CardDescription>Scadenza e attività ricorrente persistite, create una sola volta per data.</CardDescription></CardHeader>
      <CardContent className="space-y-3">
        <Field label="Modalità"><Select value={care.mode} onValueChange={(mode) => setCare({ ...care, mode: mode as typeof care.mode })}><SelectTrigger aria-label="Modalità assistenza"><SelectValue /></SelectTrigger><SelectContent>{["Nessuna", "Assistenza", "Rinnovo"].map((value) => <SelectItem key={value} value={value}>{value}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Prossima scadenza"><Input aria-label="Prossima scadenza" type="date" value={care.nextDueAt} onChange={(event) => setCare({ ...care, nextDueAt: event.target.value })} /></Field>
        <Field label="Responsabile"><Select value={care.assigneeId} onValueChange={(assigneeId) => setCare({ ...care, assigneeId })}><SelectTrigger aria-label="Responsabile assistenza"><SelectValue /></SelectTrigger><SelectContent>{commercialTeam.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent></Select></Field>
        <Field label="Ricorrenza (mesi)"><Input aria-label="Ricorrenza mesi" type="number" min="1" value={care.recurrenceMonths} onChange={(event) => setCare({ ...care, recurrenceMonths: event.target.value })} /></Field>
        <div className="flex flex-wrap gap-2"><Button onClick={saveCare}>Salva assistenza</Button><Button variant="outline" disabled={care.mode === "Nessuna" || !care.nextDueAt} onClick={() => { const values = careValues(); store.updateCustomerCare(clientId, values); const id = store.ensureCustomerCareActivity(clientId, values); toast.success(id ? "Attività di scadenza verificata" : "Inserisci una scadenza valida") }}>Genera attività scadenza</Button></div>
      </CardContent>
    </Card>
    {showAdministration && <Card data-commerce-source="server">
      <CardHeader><CardTitle>Amministrazione economica</CardTitle><CardDescription>Aggregati calcolati dal backend su ordini, pagamenti confermati e rimborsi. I documenti fiscali appartengono alla Fase 3B.</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {economicsStatus === "loading" && <p className="text-sm text-muted-foreground">Caricamento dati economici…</p>}
        {economicsStatus === "error" && <p role="alert" className="text-sm text-destructive">Impossibile caricare l’amministrazione economica.</p>}
        {economicsStatus === "loaded" && economics && <>
          <div className="grid grid-cols-2 gap-3 rounded-md bg-muted p-3 text-sm">
            <p>Ordini<br /><strong>{economics.summary.orderCount}</strong></p>
            <p>Ordinato<br /><strong>{money.format(economics.summary.ordered)}</strong></p>
            <p>Incassato lordo<br /><strong>{money.format(economics.summary.grossCollected)}</strong></p>
            <p>Rimborsato<br /><strong>{money.format(economics.summary.refunded)}</strong></p>
            <p>Incassato netto<br /><strong>{money.format(economics.summary.netCollected)}</strong></p>
            <p>Residuo<br /><strong>{money.format(economics.summary.residual)}</strong></p>
          </div>
          <div className="space-y-2">{economics.orders.map((order) => <div key={order.id} className="flex items-center justify-between rounded-md border p-3 text-sm"><span><b>{order.code}</b><small className="block text-muted-foreground">{money.format(order.total)} · residuo {money.format(order.residual ?? 0)}</small></span><Badge variant="secondary">{commercePaymentStatusLabel(order.paymentStatus)}</Badge></div>)}{!economics.orders.length && <p className="text-sm text-muted-foreground">Nessun ordine collegato.</p>}</div>
          <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">Fatture, note di credito, contratti e rinnovi non sono presentati come dati economici finché la Fase 3B non sarà completata.</p>
        </>}
      </CardContent>
    </Card>}
  </div>
}

export function ClientContractsRenewalsSummary({ clientId }: { clientId: string }) {
  const store = useCommercialLeads(); const contracts = store.contracts.filter((item) => item.customerId === clientId); const renewals = store.renewals.filter((item) => item.customerId === clientId); const canViewValues = useDoflowIdentity().hasCapability("canViewCommercialValues")
  return <section className="mt-4 grid gap-4 lg:grid-cols-2"><Card><CardHeader><div className="flex items-start justify-between gap-2"><div><CardTitle className="text-base">Contratti collegati</CardTitle><CardDescription>Stato contrattuale derivato dagli ordini del cliente.</CardDescription></div><FileSignature className="size-4 text-muted-foreground" /></div></CardHeader><CardContent className="space-y-2">{contracts.length ? contracts.map((contract) => <div key={contract.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"><span><b>{contract.code}</b><small className="block text-muted-foreground">v{contract.version} · {contract.signatoryName}</small></span><Badge variant={contract.status === "Firmato" ? "secondary" : "outline"}>{contract.status}</Badge></div>) : <p className="text-sm text-muted-foreground">Nessun contratto collegato.</p>}</CardContent></Card><Card><CardHeader><div className="flex items-start justify-between gap-2"><div><CardTitle className="text-base">Piani e rinnovi</CardTitle><CardDescription>Scadenze e snapshot delle condizioni acquistate.</CardDescription></div><Repeat2 className="size-4 text-muted-foreground" /></div></CardHeader><CardContent className="space-y-2">{renewals.length ? renewals.map((renewal) => <div key={renewal.id} className="flex items-center justify-between gap-3 rounded-md border p-3 text-sm"><span><b>{renewal.planName}</b><small className="block text-muted-foreground">{new Date(renewal.nextDueAt).toLocaleDateString("it-IT")}{canViewValues ? ` · ${money.format(renewal.priceSnapshot)}` : ""}</small></span><Badge variant="outline">{renewal.status}</Badge></div>) : <p className="text-sm text-muted-foreground">Nessun rinnovo attivo.</p>}</CardContent></Card></section>
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1"><Label>{label}</Label>{children}</div> }
