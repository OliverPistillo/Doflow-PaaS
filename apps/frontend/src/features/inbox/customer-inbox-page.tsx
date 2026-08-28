"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useEffect, useMemo, useRef, useState } from "react"
import { Archive, ArrowLeft, AtSign, CalendarPlus, CheckCircle2, Clock3, Headphones, Inbox, Link2, Mail, MessageCircle, MoreHorizontal, Paperclip, Phone, Search, Send, Smile, UserRoundPlus, Users, Wifi, WifiOff } from "lucide-react"
import { toast } from "sonner"

import { ActivityFormDialog } from "@/features/commercial/components/activity-form-dialog"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { useTeamChat } from "@/features/chat/team-chat-provider"
import { AccessDenied } from "@/features/identity/access-denied"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { PresenceUserOption } from "@/features/identity/presence-user-option"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"
import { emptyInboxFilters, inboxChannelLabels, inboxChannels, inboxPriorities, inboxStatuses, inboxTemplates, renderInboxTemplate, type InboxChannel, type InboxConversation, type InboxFilters } from "@/features/inbox/customer-inbox"
import { useCustomerInbox } from "@/features/inbox/customer-inbox-provider"

const dateTime = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
const day = new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long" })

function channelIcon(channel: InboxChannel) { return channel === "email" ? Mail : channel === "call" ? Phone : channel === "support" ? Headphones : MessageCircle }
function conversationDay(value: string) { return new Date(value).toISOString().slice(0, 10) }

export function CustomerInboxPage() {
  const identity = useDoflowIdentity()
  const inbox = useCustomerInbox()
  const chat = useTeamChat()
  const store = useCommercialLeads()
  const searchParams = useSearchParams()
  const router = useRouter()
  const [selectedId, setSelectedId] = useState(searchParams.get("conversation") ?? "")
  const [mobileConversation, setMobileConversation] = useState(Boolean(searchParams.get("conversation")))
  const [contextOpen, setContextOpen] = useState(false)
  const [activityOpen, setActivityOpen] = useState(false)
  const [templateOpen, setTemplateOpen] = useState(false)
  const [templateId, setTemplateId] = useState("")
  const [localDrafts, setLocalDrafts] = useState<Record<string, string>>({})
  const [internal, setInternal] = useState(false)
  const [replyChannel, setReplyChannel] = useState<"email" | "whatsapp">("email")
  const [sending, setSending] = useState(false)
  const [renderedAt] = useState(() => Date.now())
  const draftSaveTimer = useRef<number | null>(null)
  const selected = inbox.conversations.find((item) => item.id === selectedId) ?? inbox.conversations[0]
  const draft = selected ? localDrafts[selected.id] ?? inbox.drafts[selected.id] ?? "" : ""
  const selectedMessages = useMemo(() => inbox.messages.filter((item) => item.conversationId === selected?.id), [inbox.messages, selected?.id])

  useEffect(() => {
    if (!selected) return
    const timer = window.setTimeout(() => void inbox.markRead(selected.id, true), 0)
    return () => window.clearTimeout(timer)
  }, [selected?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!identity.hasCapability("canViewCustomerInbox")) return <AccessDenied resource="all’Inbox clienti" />

  const filters = { ...emptyInboxFilters, ...(inbox.filters ?? {}) }
  const filtered = inbox.conversations.filter((conversation) => {
    const query = filters.search.toLocaleLowerCase("it-IT")
    const text = [conversation.contactName, conversation.company, conversation.email, conversation.phone, conversation.tags.join(" ")].filter(Boolean).join(" ").toLocaleLowerCase("it-IT")
    return (!query || text.includes(query)) && (filters.status === "all" || conversation.status === filters.status) && (filters.priority === "all" || conversation.priority === filters.priority) && (filters.channel === "all" || conversation.channel === filters.channel) && (filters.scope === "all" || conversation.assignedToId === identity.currentUserId) && (!filters.unreadOnly || inbox.unreadFor(conversation.id) > 0)
  })
  const updateFilters = (updates: Partial<InboxFilters>) => void inbox.setFilters({ ...filters, ...updates })
  const chooseConversation = (conversation: InboxConversation) => { setSelectedId(conversation.id); setMobileConversation(true); void inbox.markRead(conversation.id, true) }
  const send = async () => {
    if (!selected || !draft.trim() || sending) return
    setSending(true); const result = await inbox.send({ conversationId: selected.id, text: draft, channel: internal ? selected.channel : replyChannel, internal, idempotencyKey: crypto.randomUUID() }); setSending(false)
    if (result.ok) { if (!result.preserveDraft) { setLocalDrafts((current) => ({ ...current, [selected.id]: "" })); void inbox.saveDraft(selected.id, "") } toast.success(result.message ?? (internal ? "Nota interna aggiunta" : "Messaggio inviato")) }
    else toast.error(result.message ?? "Operazione non disponibile")
  }
  const scheduleDraftSave = (value: string) => { if (!selected) return; setLocalDrafts((current) => ({ ...current, [selected.id]: value })); if (draftSaveTimer.current) window.clearTimeout(draftSaveTimer.current); draftSaveTimer.current = window.setTimeout(() => void inbox.saveDraft(selected.id, value), 500) }
  const createLead = () => {
    if (!selected || !identity.hasCapability("canCreateLeads")) return
    const [firstName, ...rest] = selected.contactName.trim().split(/\s+/); const id = crypto.randomUUID(); const now = new Date().toISOString()
    store.addLead({ id, firstName: firstName || "Nuovo", lastName: rest.join(" "), company: selected.company ?? "", email: selected.email ?? "", phone: selected.phone ?? "", source: "Manuale", service: "Altro", stage: "new", status: "new", value: 0, probability: 10, assigneeId: identity.currentUserId, owner: identity.currentUser.name, createdAt: now, lastContact: now, nextAction: "Rispondere dalla Inbox", nextActionAt: now, daysInStage: 0 })
    const link = { type: "lead" as const, id, title: selected.contactName, href: `/dashboard/commercial/leads/${id}` }; void inbox.updateConversation(selected.id, { linkedRecords: [...selected.linkedRecords, link], candidateMatches: [] }); toast.success("Lead creato e collegato")
  }
  const updateSelected = async (updates: Partial<InboxConversation> & { archive?: boolean }) => {
    if (!selected) return
    const result = await inbox.updateConversation(selected.id, updates)
    if (!result.ok || !updates.archive && (!updates.status || updates.status === selected.status)) return
    const leadId = selected.linkedRecords.find((item) => item.type === "lead")?.id
    const customerId = selected.linkedRecords.find((item) => item.type === "customer")?.id
    const event = updates.archive ? "archived" : `status:${updates.status}`
    store.recordInboxLifecycle({ conversationId: selected.id, leadId, customerId, event, title: updates.archive ? "Conversazione Inbox archiviata" : "Conversazione Inbox aggiornata", detail: `${selected.contactName} · ${updates.archive ? "Archiviata" : updates.status}.` })
  }
  const askLeadership = async () => {
    if (!selected) return
    const leadership = identity.users.find((user) => user.id !== identity.currentUserId && user.active !== false && user.roles.includes("administrator"))
    if (!leadership) { toast.error("Nessun referente di direzione disponibile"); return }
    const linkedRecord = { type: "inbox" as const, id: selected.id, title: `Inbox · ${selected.contactName}`, href: `/dashboard/inbox?conversation=${selected.id}` }
    const conversation = await chat.createConversation({ kind: "direct", title: leadership.name, participantIds: [leadership.id], linkedRecord })
    if (!conversation.ok || !conversation.id) { toast.error(conversation.message); return }
    await chat.sendMessage({ conversationId: conversation.id, text: `Puoi aiutarmi con la conversazione di ${selected.contactName}?`, linkedRecord })
    router.push(`/dashboard/inbox?conversation=${selected.id}&chat=${encodeURIComponent(conversation.id)}`)
  }
  const linkedLead = selected?.linkedRecords.find((item) => item.type === "lead")
  const linkedCustomer = selected?.linkedRecords.find((item) => item.type === "customer")
  const openCount = inbox.conversations.filter((item) => !["Risolta", "Archiviata"].includes(item.status)).length
  const overdueCount = inbox.conversations.filter((item) => item.dueAt && Date.parse(item.dueAt) < renderedAt && !["Risolta", "Archiviata"].includes(item.status)).length
  const waitingCount = inbox.conversations.filter((item) => item.status === "In attesa cliente").length
  const externalAvailable = Boolean(selected && (replyChannel === "email" ? selected.email && inbox.adapters.email.outboundConfigured : selected.phone && inbox.adapters.whatsapp.mode === "web_handoff"))
  const channelNotice = replyChannel === "email"
    ? !selected?.email ? "Il cliente non ha un indirizzo email disponibile." : !inbox.adapters.email.outboundConfigured ? "Email non configurata per questo tenant. Usa una nota interna oppure configura SMTP." : "Email collegata via SMTP."
    : !selected?.phone ? "Il cliente non ha un numero WhatsApp disponibile." : "Apre WhatsApp Web in una nuova scheda; l’invio deve essere completato manualmente."

  const conversationPanel = selected ? <section className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-background" aria-label={`Conversazione con ${selected.contactName}`}>
    <header className="flex shrink-0 items-center gap-2 border-b px-3 py-2.5 sm:px-4">
      <Button className="md:hidden" size="icon" variant="ghost" aria-label="Torna alle conversazioni" onClick={() => setMobileConversation(false)}><ArrowLeft /></Button>
      <div className="min-w-0 flex-1"><h2 className="truncate font-semibold">{selected.contactName}</h2><p className="truncate text-xs text-muted-foreground">{selected.company || selected.email || selected.phone || "Contatto esterno"}</p></div>
      <Badge className="hidden sm:inline-flex" variant="outline">{inboxChannelLabels[selected.channel]}</Badge>
      <Button size="sm" variant="outline" className="xl:hidden" onClick={() => setContextOpen(true)}>CRM</Button>
      <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon" variant="ghost" aria-label="Azioni conversazione"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => void updateSelected({ status: "Risolta" })}><CheckCircle2 />Segna risolta</DropdownMenuItem><DropdownMenuItem onClick={() => void updateSelected({ archive: true })}><Archive />Archivia</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    </header>
    <ScrollArea className="min-h-0 flex-1 px-3 py-4 sm:px-5"><div className="mx-auto flex max-w-3xl flex-col gap-2">
      {selectedMessages.map((message, index) => { const previous = selectedMessages[index - 1]; const showDay = !previous || conversationDay(previous.createdAt) !== conversationDay(message.createdAt); const own = message.direction === "outgoing"; const note = message.direction === "internal"; return <div key={message.id}>{showDay && <div className="my-3 text-center text-xs capitalize text-muted-foreground">{day.format(new Date(message.createdAt))}</div>}<div className={cn("flex", own ? "justify-end" : "justify-start")}><div className={cn("max-w-[86%] rounded-2xl px-3 py-2 text-sm shadow-sm", own ? "bg-primary text-primary-foreground" : note ? "border border-amber-300 bg-amber-50 text-amber-950 dark:bg-amber-950 dark:text-amber-100" : message.direction === "system" ? "bg-muted text-muted-foreground" : "border bg-card")}><p className="whitespace-pre-wrap break-words">{message.text}</p><div className={cn("mt-1 flex items-center gap-1 text-[10px]", own ? "text-primary-foreground/70" : "text-muted-foreground")}><span>{dateTime.format(new Date(message.createdAt))}</span>{note && <span>· Nota interna</span>}<span>· {message.status}</span></div></div></div></div> })}
      {!selectedMessages.length && <p className="py-10 text-center text-sm text-muted-foreground">Nessun messaggio nella conversazione.</p>}
    </div></ScrollArea>
    <div className="shrink-0 border-t bg-background p-3 sm:p-4">
      <div className="mx-auto max-w-3xl space-y-2">
        {!internal && <div className={cn("rounded-md border px-3 py-2 text-xs", externalAvailable ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-100" : "border-amber-300 bg-amber-50 text-amber-900 dark:bg-amber-950 dark:text-amber-100")}>{channelNotice}</div>}
        <div className="flex flex-wrap items-center gap-1.5"><Button size="sm" variant={internal ? "default" : "outline"} onClick={() => setInternal((value) => !value)}><AtSign />{internal ? "Nota interna" : "Risposta cliente"}</Button>{!internal && <Select value={replyChannel} onValueChange={(value) => setReplyChannel(value as "email" | "whatsapp")}><SelectTrigger className="h-8 w-[140px]" aria-label="Canale risposta"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="email">Email</SelectItem><SelectItem value="whatsapp">WhatsApp Web</SelectItem></SelectContent></Select>}<Select value={templateId || "none"} onValueChange={(value) => { setTemplateId(value === "none" ? "" : value); if (value !== "none") setTemplateOpen(true) }}><SelectTrigger className="h-8 w-[170px]" aria-label="Template risposta"><SelectValue placeholder="Template" /></SelectTrigger><SelectContent><SelectItem value="none">Nessun template</SelectItem>{inboxTemplates.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent></Select><Button size="icon" variant="ghost" aria-label="Aggiungi emoji" onClick={() => scheduleDraftSave(`${draft} 🙂`)}><Smile /></Button><Button size="icon" variant="ghost" aria-label="Allega file" onClick={() => toast.info("Storage allegati non configurato")}><Paperclip /></Button></div>
        <Textarea aria-label="Messaggio Inbox" value={draft} onChange={(event) => scheduleDraftSave(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); void send() } }} placeholder={internal ? "Scrivi una nota visibile solo al team…" : "Scrivi una risposta…"} className="min-h-20 resize-none" />
        <div className="flex items-center justify-between gap-2"><span className="text-xs text-muted-foreground">Invio: Enter · nuova riga: Shift+Enter</span><Button size="sm" disabled={!draft.trim() || sending || (!internal && !externalAvailable)} onClick={() => void send()}><Send />{sending ? "Invio…" : internal ? "Aggiungi nota" : replyChannel === "whatsapp" ? "Apri WhatsApp Web" : "Invia email"}</Button></div>
      </div>
    </div>
  </section> : <Empty className="min-h-72"><EmptyHeader><EmptyMedia variant="icon"><Inbox /></EmptyMedia><EmptyTitle>Seleziona una conversazione</EmptyTitle><EmptyDescription>Apri un contatto dalla lista per vedere i messaggi e il contesto CRM.</EmptyDescription></EmptyHeader></Empty>

  const crmPanel = selected ? <CrmContext conversation={selected} renderedAt={renderedAt} identityUsers={identity.users} canAssign={identity.currentUser.roles.includes("administrator") || selected.supervisorId === identity.currentUserId} onCreateLead={createLead} onCreateActivity={() => setActivityOpen(true)} onAskLeadership={() => void askLeadership()} onUpdate={(updates) => void updateSelected(updates)} /> : null

  return <main className="flex h-[calc(100dvh-4rem)] min-h-0 flex-col overflow-hidden p-3 sm:p-5">
    <div className="mb-4 flex flex-wrap items-start justify-between gap-3"><div><div className="flex items-center gap-2"><h1 className="text-2xl font-bold tracking-tight">Inbox clienti</h1><Badge variant={inbox.connected ? "secondary" : "destructive"}>{inbox.connected ? <Wifi /> : <WifiOff />}{inbox.connected ? "Connessa" : "Disconnessa"}</Badge></div><p className="text-sm text-muted-foreground">Comunicazioni esterne collegate al CRM. Separata dalla Chat interna del team.</p></div></div>
    <div className="mb-4 grid grid-cols-2 gap-2 lg:grid-cols-4">{[{ label: "Da gestire", value: openCount, icon: Inbox }, { label: "Non lette", value: inbox.unreadCount, icon: MessageCircle }, { label: "Fuori SLA", value: overdueCount, icon: Clock3 }, { label: "Attesa cliente", value: waitingCount, icon: Users }].map((item) => { const Icon = item.icon; return <Card key={item.label}><CardContent className="flex items-center justify-between p-3"><div><p className="text-xs text-muted-foreground">{item.label}</p><p className="text-xl font-semibold">{item.value}</p></div><Icon className="size-4 text-muted-foreground" /></CardContent></Card> })}</div>
    <div className="grid min-h-0 flex-1 overflow-hidden rounded-xl border bg-card md:grid-cols-[220px_minmax(0,1fr)] lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[320px_minmax(0,1fr)_340px]">
      <section className={cn("min-h-0 border-r", mobileConversation && "hidden md:block")} aria-label="Elenco conversazioni">
        <div className="space-y-2 border-b p-3"><div className="relative"><Search className="absolute left-2.5 top-2.5 size-4 text-muted-foreground" /><Input aria-label="Cerca conversazioni" className="pl-8" value={filters.search} onChange={(event) => updateFilters({ search: event.target.value })} placeholder="Cerca nome, azienda, email…" /></div><div className="grid grid-cols-2 gap-2"><Select value={filters.status} onValueChange={(value) => updateFilters({ status: value as InboxFilters["status"] })}><SelectTrigger aria-label="Filtra stato"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli stati</SelectItem>{inboxStatuses.filter((item) => item !== "Archiviata").map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select><Select value={filters.scope} onValueChange={(value) => updateFilters({ scope: value as InboxFilters["scope"] })}><SelectTrigger aria-label="Filtra assegnazione"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Autorizzate</SelectItem><SelectItem value="mine">Solo mie</SelectItem></SelectContent></Select><Select value={filters.channel} onValueChange={(value) => updateFilters({ channel: value as InboxFilters["channel"] })}><SelectTrigger aria-label="Filtra canale"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i canali</SelectItem>{inboxChannels.map((item) => <SelectItem key={item} value={item}>{inboxChannelLabels[item]}</SelectItem>)}</SelectContent></Select><Select value={filters.priority} onValueChange={(value) => updateFilters({ priority: value as InboxFilters["priority"] })}><SelectTrigger aria-label="Filtra priorità"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutte le priorità</SelectItem>{inboxPriorities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="flex items-center justify-between"><Label className="flex items-center gap-2 text-xs"><Checkbox checked={filters.unreadOnly} onCheckedChange={(value) => updateFilters({ unreadOnly: value === true })} />Non lette</Label><Button variant="ghost" size="sm" onClick={() => void inbox.setFilters(emptyInboxFilters)}>Azzera</Button></div></div>
        <ScrollArea className="h-[calc(100%-182px)]"><div className="p-2">{filtered.map((conversation) => { const Icon = channelIcon(conversation.channel); const unread = inbox.unreadFor(conversation.id); const last = inbox.messages.filter((item) => item.conversationId === conversation.id).at(-1); return <button key={conversation.id} onClick={() => chooseConversation(conversation)} className={cn("mb-1 w-full rounded-lg p-3 text-left transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", selected?.id === conversation.id && "bg-muted")}><div className="flex items-start gap-2"><div className="mt-0.5 rounded-full border p-2"><Icon className="size-4" /></div><div className="min-w-0 flex-1"><div className="flex items-center gap-2"><span className="truncate font-medium">{conversation.contactName}</span>{unread > 0 && <Badge className="ml-auto h-5 min-w-5 justify-center px-1.5">{unread}</Badge>}</div><p className="truncate text-xs text-muted-foreground">{last?.text ?? conversation.email ?? conversation.phone}</p><div className="mt-1 flex items-center justify-between gap-2"><span className="truncate text-[11px] text-muted-foreground">{conversation.status}</span><time className="shrink-0 text-[10px] text-muted-foreground">{dateTime.format(new Date(conversation.lastMessageAt))}</time></div></div></div></button>})}{!filtered.length && <Empty className="border-0 py-10"><EmptyHeader><EmptyMedia variant="icon"><Inbox /></EmptyMedia><EmptyTitle>Nessuna conversazione</EmptyTitle><EmptyDescription>Modifica i filtri per visualizzare altre conversazioni autorizzate.</EmptyDescription></EmptyHeader></Empty>}</div></ScrollArea>
      </section>
      <div className={cn("min-h-0 min-w-0 overflow-hidden", !mobileConversation && "hidden md:flex")}>{conversationPanel}</div>
      <aside className="hidden min-h-0 border-l xl:block"><ScrollArea className="h-full">{crmPanel}</ScrollArea></aside>
    </div>
    <Sheet open={contextOpen} onOpenChange={setContextOpen}><SheetContent className="w-full overflow-y-auto sm:max-w-md"><SheetHeader><SheetTitle>Contesto CRM</SheetTitle><SheetDescription>Dati autorizzati e azioni collegate alla conversazione.</SheetDescription></SheetHeader>{crmPanel}</SheetContent></Sheet>
    <ActivityFormDialog open={activityOpen} onOpenChange={setActivityOpen} defaultLeadId={linkedLead?.id} defaultClientId={linkedCustomer?.id} lockClient={Boolean(linkedCustomer)} />
    <Dialog open={templateOpen} onOpenChange={setTemplateOpen}><DialogContent><DialogHeader><DialogTitle>Anteprima template</DialogTitle><DialogDescription>Controlla il testo prima di inserirlo nella bozza.</DialogDescription></DialogHeader><div className="rounded-lg border bg-muted/30 p-4 text-sm whitespace-pre-wrap">{selected && templateId ? renderInboxTemplate(inboxTemplates.find((item) => item.id === templateId)?.text ?? "", selected) : ""}</div><DialogFooter><Button variant="outline" onClick={() => setTemplateOpen(false)}>Annulla</Button><Button onClick={() => { if (selected && templateId) scheduleDraftSave(renderInboxTemplate(inboxTemplates.find((item) => item.id === templateId)?.text ?? "", selected)); setTemplateOpen(false) }}>Usa template</Button></DialogFooter></DialogContent></Dialog>
  </main>
}

function CrmContext({ conversation, renderedAt, identityUsers, canAssign, onCreateLead, onCreateActivity, onAskLeadership, onUpdate }: { conversation: InboxConversation; renderedAt: number; identityUsers: Array<{ id: string; name: string }>; canAssign: boolean; onCreateLead: () => void; onCreateActivity: () => void; onAskLeadership: () => void; onUpdate: (updates: Partial<InboxConversation>) => void }) {
  return <div className="space-y-5 p-4"><div><h3 className="font-semibold">Contatto e responsabilità</h3><div className="mt-2 space-y-1 text-sm"><p>{conversation.contactName}</p>{conversation.company && <p className="text-muted-foreground">{conversation.company}</p>}{conversation.email && <a className="block text-primary hover:underline" href={`mailto:${conversation.email}`}>{conversation.email}</a>}{conversation.phone && <a className="block text-primary hover:underline" href={`tel:${conversation.phone}`}>{conversation.phone}</a>}</div></div><div className="grid gap-3"><Label>Stato<Select value={conversation.status} onValueChange={(value) => onUpdate({ status: value as InboxConversation["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{inboxStatuses.filter((item) => item !== "Archiviata").map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Label><Label>Priorità<Select value={conversation.priority} onValueChange={(value) => onUpdate({ priority: value as InboxConversation["priority"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{inboxPriorities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Label><Label>Responsabile<Select disabled={!canAssign} value={conversation.assignedToId ?? "none"} onValueChange={(value) => onUpdate({ assignedToId: value === "none" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Non assegnata</SelectItem>{identityUsers.map((user) => <SelectItem key={user.id} value={user.id}><PresenceUserOption userId={user.id} /></SelectItem>)}</SelectContent></Select></Label><Label>Supervisore<Select disabled={!canAssign} value={conversation.supervisorId ?? "none"} onValueChange={(value) => onUpdate({ supervisorId: value === "none" ? "" : value })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nessuno</SelectItem>{identityUsers.map((user) => <SelectItem key={user.id} value={user.id}><PresenceUserOption userId={user.id} /></SelectItem>)}</SelectContent></Select></Label><Label>Collaboratore<Select disabled={!canAssign} value={conversation.collaboratorIds[0] ?? "none"} onValueChange={(value) => onUpdate({ collaboratorIds: value === "none" ? [] : [value] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nessuno</SelectItem>{identityUsers.filter((user) => user.id !== conversation.assignedToId).map((user) => <SelectItem key={user.id} value={user.id}><PresenceUserOption userId={user.id} /></SelectItem>)}</SelectContent></Select></Label><Label>Categoria<Input defaultValue={conversation.category ?? ""} onBlur={(event) => onUpdate({ category: event.target.value })} placeholder="Es. preventivo, supporto" /></Label><Label>Tag<Input defaultValue={conversation.tags.join(", ")} onBlur={(event) => onUpdate({ tags: event.target.value.split(",").map((item) => item.trim()).filter(Boolean) })} placeholder="urgente, rinnovo" /></Label><Label>Scadenza SLA<Input type="datetime-local" value={conversation.dueAt?.slice(0, 16) ?? ""} onChange={(event) => onUpdate({ dueAt: event.target.value })} /></Label></div><div><h3 className="font-semibold">Collegamenti CRM</h3><div className="mt-2 space-y-2">{conversation.linkedRecords.map((record) => <Button key={`${record.type}:${record.id}`} asChild variant="outline" className="w-full justify-start"><Link href={record.href}><Link2 />{record.title}</Link></Button>)}{conversation.candidateMatches.length > 1 && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-950 dark:bg-amber-950 dark:text-amber-100"><p className="font-medium">Corrispondenza ambigua</p><p className="mb-2">Scegli manualmente il record corretto. Nessuna fusione automatica.</p>{conversation.candidateMatches.map((candidate) => <Button key={`${candidate.type}:${candidate.id}`} size="sm" variant="ghost" className="w-full justify-start" onClick={() => onUpdate({ linkedRecords: [candidate], candidateMatches: [] })}>{candidate.title}</Button>)}</div>}{!conversation.linkedRecords.length && !conversation.candidateMatches.length && <Button variant="outline" className="w-full" onClick={onCreateLead}><UserRoundPlus />Crea e collega lead</Button>}</div></div><div className="grid gap-2"><Button variant="outline" onClick={onCreateActivity}><CalendarPlus />Crea attività</Button><Button variant="outline" asChild><Link href={`/dashboard/calendario?date=${encodeURIComponent(conversation.dueAt?.slice(0, 10) ?? new Date().toISOString().slice(0, 10))}&create=appointment`}><CalendarPlus />Crea appuntamento</Link></Button><Button variant="outline" onClick={onAskLeadership}><MessageCircle />Chiedi alla direzione nella Chat</Button>{conversation.linkedRecords.find((item) => item.type === "lead") && <Button variant="outline" asChild><Link href={`/dashboard/preventivi?leadId=${conversation.linkedRecords.find((item) => item.type === "lead")?.id}`}><Mail />Crea preventivo</Link></Button>}</div><div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground"><p className="font-medium text-foreground">SLA</p><p>{conversation.dueAt ? Date.parse(conversation.dueAt) < renderedAt ? "Scaduta" : `Entro ${dateTime.format(new Date(conversation.dueAt))}` : `${conversation.slaMinutes} minuti dalla presa in carico`}</p></div></div>
}
