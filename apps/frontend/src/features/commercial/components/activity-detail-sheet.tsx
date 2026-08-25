"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { CheckCircle2, MoreHorizontal, Pencil, Repeat2, X } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { customerActivityPriorities, customerActivityRecurrences, customerActivityStatuses, customerActivityTypes, getCanonicalCustomerActivities, resolveCanonicalCustomerActivityId, type CustomerActivity, useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { useCommercialTeam } from "@/features/commercial/use-commercial-team"
import { RecordCollaborationPanel } from "@/features/commercial/components/record-collaboration-panel"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { canManageActivity } from "@/features/identity/permissions"
import { formatItalianDate, formatItalianDateTime } from "@/lib/date"

const dateInput = (value?: string) => value?.match(/^\d{4}-\d{2}-\d{2}/)?.[0] ?? ""

export function ActivityDetailSheet({ clientId, activityId, open, onOpenChange }: { clientId: string; activityId: string | null; open: boolean; onOpenChange: (open: boolean) => void }) {
  const store = useCommercialLeads()
  const identity = useDoflowIdentity()
  const commercialTeam = useCommercialTeam()
  const customer = store.customers.find((item) => item.id === clientId)
  const canonicalId = activityId ? resolveCanonicalCustomerActivityId(customer, activityId) : null
  const activity = useMemo(() => canonicalId ? getCanonicalCustomerActivities(customer).find((item) => item.id === canonicalId) ?? null : null, [canonicalId, customer])
  const [editing, setEditing] = useState(false)
  const [draftState, setDraft] = useState<CustomerActivity | null>(activity)
  const draft = editing && draftState?.id === activity?.id ? draftState : activity
  if (!activity || !draft || !customer) return null
  const project = store.projects.find((item) => item.id === activity.projectId) ?? store.projects.find((item) => item.clientId === clientId && item.activityIds.includes(activity.id))
  const phase = project?.phases.find((item) => item.id === activity.phaseId || item.activityIds.includes(activity.id))
  const manageable = canManageActivity(identity.currentUser, activity, customer, project)
  const owner = commercialTeam.find((member) => member.id === activity.assigneeId)
  const collaborators = commercialTeam.filter((member) => activity.collaboratorIds.includes(member.id))
  const history = store.timelineEvents.filter((event) => event.activityId === activity.id)
  const dependencies = getCanonicalCustomerActivities(customer).filter((item) => activity.dependencyIds.includes(item.id))
  const save = async () => {
    if (!draft.title.trim()) return
    const ok = await store.updateCustomerActivity(clientId, activity.id, { ...draft, completedAt: draft.status === "Completata" ? draft.completedAt ?? new Date().toISOString() : undefined })
    if (ok) { toast.success("Attività aggiornata"); setEditing(false) }
  }
  const toggleComplete = async () => {
    const ok = activity.status === "Completata" ? await store.reopenCustomerActivity(clientId, activity.id) : await store.completeCustomerActivity(clientId, activity.id)
    if (ok) toast.success(activity.status === "Completata" ? "Attività riaperta" : "Attività completata")
  }
  const generateNext = async () => {
    const nextId = await store.generateNextCustomerActivityRecurrence(clientId, activity.id)
    if (!nextId) toast.error("Imposta ricorrenza e scadenza prima di generare la successiva.")
    else toast.success(nextId === activity.nextRecurrenceId ? "Ricorrenza già generata" : "Prossima ricorrenza generata")
  }

  return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent showCloseButton={false} className="flex h-dvh w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-[520px]"><SheetHeader className="shrink-0 border-b px-4 py-4 text-left sm:px-5"><div className="grid min-w-0 grid-cols-[minmax(0,1fr)_2.25rem_2.25rem] items-start gap-x-1.5 gap-y-2"><div className="min-w-0"><SheetTitle className="line-clamp-2 break-words leading-5">{activity.title}</SheetTitle><div className="mt-1.5 flex flex-wrap gap-1"><Badge className={`h-5 px-2 py-0 text-[11px] ${activity.status === "Completata" ? "bg-emerald-600 text-white" : ""}`}>{activity.status}</Badge><Badge variant={activity.priority === "Urgente" ? "destructive" : "secondary"} className="h-5 px-2 py-0 text-[11px]">{activity.priority}</Badge><Badge variant="outline" className="h-5 px-2 py-0 text-[11px]">{activity.type}</Badge></div><SheetDescription className="mt-1.5 line-clamp-3 break-words text-sm leading-5">{activity.description || "Nessuna descrizione"}</SheetDescription></div><div className="flex size-9 shrink-0">{manageable && <DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-sm" className="size-9" variant="ghost" aria-label="Azioni attività"><MoreHorizontal className="size-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={() => setEditing(true)}>Modifica</DropdownMenuItem><DropdownMenuItem onClick={toggleComplete}>{activity.status === "Completata" ? "Riapri" : "Completa"}</DropdownMenuItem><DropdownMenuItem onClick={() => store.setCustomerActivityStatus(clientId, activity.id, "Annullata")}>Annulla attività</DropdownMenuItem>{activity.recurrence !== "Nessuna" && <DropdownMenuItem onClick={generateNext}>Genera prossima ricorrenza</DropdownMenuItem>}<DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onClick={() => { store.deleteCustomerActivity(clientId, activity.id); onOpenChange(false) }}>Archivia</DropdownMenuItem></DropdownMenuContent></DropdownMenu>}</div><SheetClose asChild><Button size="icon-sm" className="size-9 shrink-0" variant="ghost" aria-label="Chiudi dettaglio attività"><X className="size-4" /><span className="sr-only">Chiudi dettaglio attività</span></Button></SheetClose>{manageable && <div className="col-span-3 flex flex-wrap gap-1.5 pt-1"><Button size="sm" className="h-8 px-2.5" onClick={toggleComplete}><CheckCircle2 className="size-3.5" />{activity.status === "Completata" ? "Riapri attività" : "Completa"}</Button><Button size="sm" className="h-8 px-2.5" variant="outline" onClick={() => setEditing(true)}><Pencil className="size-3.5" />Modifica</Button>{activity.recurrence !== "Nessuna" && <Button size="sm" className="h-8 px-2.5" variant="outline" onClick={generateNext}><Repeat2 className="size-3.5" />Genera successiva</Button>}</div>}</div></SheetHeader>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-3 sm:px-5">{manageable && editing ? <Card size="sm"><CardHeader><CardTitle className="text-base">Modifica attività</CardTitle></CardHeader><CardContent className="grid gap-3 sm:grid-cols-2">
      <Label className="sm:col-span-2">Titolo<Input value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></Label>
      <Label className="sm:col-span-2">Descrizione<Textarea value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} /></Label>
      <Label>Stato<Select value={draft.status} onValueChange={(value) => setDraft({ ...draft, status: value as CustomerActivity["status"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{customerActivityStatuses.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Label>
      <Label>Priorità<Select value={draft.priority} onValueChange={(value) => setDraft({ ...draft, priority: value as CustomerActivity["priority"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{customerActivityPriorities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Label>
      <Label>Tipologia<Select value={draft.type} onValueChange={(value) => setDraft({ ...draft, type: value as CustomerActivity["type"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{customerActivityTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Label>
      <Label>Responsabile<Select value={draft.assigneeId} onValueChange={(value) => setDraft({ ...draft, assigneeId: value })} disabled={!identity.hasCapability("canAssignLeads") && !identity.hasCapability("canManageProjects")}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{commercialTeam.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Label>
      <Label>Scadenza<Input type="date" value={dateInput(draft.dueDate || draft.dueAt)} onChange={(event) => setDraft({ ...draft, dueDate: event.target.value, dueAt: event.target.value ? `${event.target.value}T12:00:00` : "" })} /></Label>
      <Label>Ricorrenza<Select value={draft.recurrence} onValueChange={(value) => setDraft({ ...draft, recurrence: value as CustomerActivity["recurrence"] })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{customerActivityRecurrences.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Label>
      <Label className="sm:col-span-2">Motivo del blocco<Input value={draft.blockedReason ?? ""} onChange={(event) => setDraft({ ...draft, blockedReason: event.target.value || undefined })} /></Label>
      <Label className="sm:col-span-2">Note<Textarea value={draft.notes ?? ""} onChange={(event) => setDraft({ ...draft, notes: event.target.value || undefined })} /></Label>
      <Label className="sm:col-span-2">Categoria tecnica<Input value={draft.technicalCategory ?? ""} onChange={(event) => setDraft({ ...draft, technicalCategory: event.target.value || undefined })} /></Label>
      <div className="flex justify-end gap-2 sm:col-span-2"><Button variant="outline" onClick={() => { setDraft(activity); setEditing(false) }}>Annulla</Button><Button disabled={!draft.title.trim()} onClick={save}>Salva modifiche</Button></div>
    </CardContent></Card> : <>
      <Card size="sm"><CardHeader><CardTitle className="text-base">Pianificazione</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-2.5 text-sm"><p>Stato<br /><b>{activity.status}</b></p><p>Priorità<br /><b>{activity.priority}</b></p><p>Responsabile<br /><b>{owner?.name ?? activity.assigneeId}</b></p><p>Scadenza<br /><b>{formatItalianDate(activity.dueDate || activity.dueAt) || "Nessuna"}</b></p><p>Inizio<br /><b>{formatItalianDate(activity.startAt) || "Non impostata"}</b></p><p>Ricorrenza<br /><b>{activity.recurrence}</b></p>{collaborators.length > 0 && <p className="col-span-2">Collaboratori<br /><b>{collaborators.map((item) => item.name).join(", ")}</b></p>}{activity.blockedReason && <p className="col-span-2 text-red-600">Blocco<br /><b>{activity.blockedReason}</b></p>}</CardContent></Card>
      <Card size="sm"><CardHeader><CardTitle className="text-base">Collegamenti</CardTitle></CardHeader><CardContent className="space-y-1.5 text-sm"><p>Cliente<br /><b><Link className="text-primary hover:underline" href={`/dashboard/clienti/${customer.id}`}>{customer.profile.company}</Link></b></p><p>Lead<br /><b><Link className="text-primary hover:underline" href={`/dashboard/commercial/leads/${activity.leadId ?? customer.sourceLeadId}`}>Apri lead origine</Link></b></p><p>Progetto<br /><b>{project ? <Link className="text-primary hover:underline" href={`/dashboard/progetti/${project.id}`}>{project.name}</Link> : "Nessuno"}</b></p><p>Fase<br /><b>{phase?.name ?? "Nessuna"}</b></p><p>Origine<br /><b>{activity.origin}</b></p>{activity.technicalCategory && <p>Categoria tecnica<br /><b>{activity.technicalCategory}</b></p>}</CardContent></Card>
      {(activity.notes || dependencies.length > 0) && <Card size="sm"><CardHeader><CardTitle className="text-base">Note e dipendenze</CardTitle></CardHeader><CardContent className="space-y-1.5 text-sm">{activity.notes && <p className="whitespace-pre-wrap">{activity.notes}</p>}{dependencies.map((item) => <p key={item.id}>Dipende da: <b>{item.title}</b> · {item.status}</p>)}</CardContent></Card>}
      <Card size="sm"><CardHeader><CardTitle className="text-base">Informazioni</CardTitle></CardHeader><CardContent className="space-y-1.5 text-sm"><p>Creata il {formatItalianDateTime(activity.createdAt)} da {activity.createdBy}</p><p>Aggiornata il {formatItalianDateTime(activity.updatedAt)}</p>{activity.completedAt && <p>Completata il {formatItalianDateTime(activity.completedAt)}</p>}{activity.nextRecurrenceId && <p>Prossima ricorrenza già generata: <b>{activity.nextRecurrenceId}</b></p>}</CardContent></Card>
    </>}
      <Card size="sm"><CardHeader className="flex-row items-start justify-between gap-2"><div><CardTitle className="text-base">Cronologia</CardTitle></div><RecordCollaborationPanel recordType="activity" recordId={activity.id} label={activity.title} compact /></CardHeader><CardContent className="space-y-2.5 text-sm">{history.length ? history.map((event) => <div key={event.id}><p className="font-medium">{event.title}</p><p className="text-muted-foreground">{event.detail}</p><p className="text-xs text-muted-foreground">{formatItalianDateTime(event.date)} · {event.author}</p></div>) : <p className="text-muted-foreground">Nessuna modifica registrata.</p>}</CardContent></Card>
    </div></SheetContent></Sheet>
}
