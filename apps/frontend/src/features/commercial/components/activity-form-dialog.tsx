"use client"

import { useMemo, useRef, useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { customerActivityPriorities, customerActivityRecurrences, customerActivityTypes, type CustomerActivity } from "@/features/commercial/components/commercial-leads-provider"
import { useCommercialTeam } from "@/features/commercial/use-commercial-team"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"

type Props = { open: boolean; onOpenChange: (open: boolean) => void; defaultClientId?: string; defaultLeadId?: string; defaultProjectId?: string; lockClient?: boolean; lockProject?: boolean; onSaved?: (activityId?: string) => void }

export function ActivityFormDialog({ open, onOpenChange, defaultClientId, defaultLeadId, defaultProjectId, lockClient = false, lockProject = false, onSaved }: Props) {
  const { store, identity, leads, customers, projects } = useAuthorizedCommercial()
  const commercialTeam = useCommercialTeam()
  const [clientId, setClientId] = useState(defaultClientId ?? "")
  const [projectId, setProjectId] = useState(defaultProjectId ?? "none")
  const [phaseId, setPhaseId] = useState("none")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [type, setType] = useState<CustomerActivity["type"]>("Attività")
  const [priority, setPriority] = useState<CustomerActivity["priority"]>("Media")
  const [assigneeId, setAssigneeId] = useState(identity.currentUserId)
  const [collaboratorId, setCollaboratorId] = useState("none")
  const [startAt, setStartAt] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [dueTime, setDueTime] = useState("")
  const [recurrence, setRecurrence] = useState<CustomerActivity["recurrence"]>("Nessuna")
  const [technicalCategory, setTechnicalCategory] = useState("")
  const [saving, setSaving] = useState(false)
  const savingRef = useRef(false)
  const effectiveClientId = lockClient ? defaultClientId ?? "" : clientId || defaultClientId || ""
  const effectiveProjectId = lockProject ? defaultProjectId ?? "none" : projectId || defaultProjectId || "none"
  const customer = customers.find((item) => item.id === effectiveClientId)
  const lead = defaultLeadId ? leads.find((item) => item.id === defaultLeadId) : undefined
  const clientProjects = useMemo(() => projects.filter((item) => item.clientId === effectiveClientId), [effectiveClientId, projects])
  const project = clientProjects.find((item) => item.id === effectiveProjectId)
  const canAssignTeam = identity.hasCapability("canAssignLeads") || identity.hasCapability("canManageProjects")
  const teamOptions = canAssignTeam ? commercialTeam : commercialTeam.filter((item) => item.id === identity.currentUserId)

  const reset = () => {
    setTitle(""); setDescription(""); setType("Attività"); setPriority("Media"); setAssigneeId(identity.currentUserId); setCollaboratorId("none")
    setStartAt(""); setDueDate(""); setDueTime(""); setRecurrence("Nessuna"); setTechnicalCategory(""); setPhaseId("none")
    if (!lockClient) setClientId(defaultClientId ?? "")
    if (!lockProject) setProjectId(defaultProjectId ?? "none")
  }
  const save = async () => {
    if ((!customer && !lead) || !title.trim() || savingRef.current) return
    savingRef.current = true
    setSaving(true)
    const input = {
      title: title.trim(), description: description.trim(), type, status: "Da fare" as const, priority,
      assigneeId: assigneeId || identity.currentUserId, collaboratorIds: collaboratorId === "none" ? [] : [collaboratorId],
      projectId: effectiveProjectId === "none" ? undefined : effectiveProjectId,
      phaseId: phaseId === "none" ? undefined : phaseId, startAt: startAt || undefined,
      dueAt: dueDate ? dueTime ? `${dueDate}T${dueTime}:00` : `${dueDate}T12:00:00` : "", dueDate: dueDate || undefined, dueTime: dueTime || undefined,
      recurrence, dependencyIds: [], technicalCategory: technicalCategory.trim() || undefined, origin: "manuale" as const,
    }
    const activityId = customer ? await store.addCustomerActivity(customer.id, { ...input, leadId: customer.sourceLeadId }) : store.addLeadActivity(lead!.id, input)
    savingRef.current = false
    setSaving(false)
    if (!activityId) { toast.error("Impossibile creare l’attività nel perimetro corrente."); return }
    toast.success("Attività creata"); reset(); onOpenChange(false); onSaved?.(activityId)
  }

  return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="flex max-h-[92dvh] flex-col overflow-hidden sm:max-w-2xl"><DialogHeader className="shrink-0"><DialogTitle>Nuova attività</DialogTitle></DialogHeader><div className="grid min-h-0 gap-4 overflow-y-auto pr-1 sm:grid-cols-2">
    {lead ? <Label className="sm:col-span-2">Lead<Input aria-label="Lead attività" value={`${lead.company} · ${lead.firstName} ${lead.lastName}`} disabled /></Label> : <Label className="sm:col-span-2">Cliente<Select value={effectiveClientId} onValueChange={(value) => { setClientId(value); setProjectId("none"); setPhaseId("none") }} disabled={lockClient}><SelectTrigger aria-label="Cliente attività"><SelectValue placeholder="Seleziona cliente" /></SelectTrigger><SelectContent>{customers.map((item) => <SelectItem key={item.id} value={item.id}>{item.profile.company}</SelectItem>)}</SelectContent></Select></Label>}
    <Label className="sm:col-span-2">Titolo<Input aria-label="Titolo nuova attività" value={title} onChange={(event) => setTitle(event.target.value)} /></Label>
    <Label className="sm:col-span-2">Descrizione<Textarea value={description} onChange={(event) => setDescription(event.target.value)} /></Label>
    <Label>Tipologia<Select value={type} onValueChange={(value) => setType(value as CustomerActivity["type"])}><SelectTrigger aria-label="Tipologia attività"><SelectValue /></SelectTrigger><SelectContent>{customerActivityTypes.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Label>
    <Label>Priorità<Select value={priority} onValueChange={(value) => setPriority(value as CustomerActivity["priority"])}><SelectTrigger aria-label="Priorità attività"><SelectValue /></SelectTrigger><SelectContent>{customerActivityPriorities.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Label>
    <Label>Responsabile<Select value={assigneeId} onValueChange={setAssigneeId}><SelectTrigger aria-label="Responsabile attività"><SelectValue /></SelectTrigger><SelectContent>{teamOptions.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Label>
    <Label>Collaboratore<Select value={collaboratorId} onValueChange={setCollaboratorId}><SelectTrigger aria-label="Collaboratore attività"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nessuno</SelectItem>{commercialTeam.filter((item) => item.id !== assigneeId).map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Label>
    <Label>Progetto<Select value={effectiveProjectId} onValueChange={(value) => { setProjectId(value); setPhaseId("none") }} disabled={Boolean(lead) || lockProject || !effectiveClientId}><SelectTrigger aria-label="Progetto attività"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nessun progetto</SelectItem>{clientProjects.map((item) => <SelectItem key={item.id} value={item.id}>{item.name}</SelectItem>)}</SelectContent></Select></Label>
    <Label>Fase<Select value={phaseId} onValueChange={setPhaseId} disabled={!project}><SelectTrigger aria-label="Fase del progetto"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Nessuna fase</SelectItem>{project?.phases.map((phase) => <SelectItem key={phase.id} value={phase.id}>{phase.name}</SelectItem>)}</SelectContent></Select></Label>
    <Label>Data inizio<Input type="date" value={startAt} onChange={(event) => setStartAt(event.target.value)} /></Label>
    <Label>Scadenza<Input aria-label="Scadenza nuova attività" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} /></Label>
    <Label>Ora facoltativa<Input type="time" value={dueTime} onChange={(event) => setDueTime(event.target.value)} /></Label>
    <Label>Ricorrenza<Select value={recurrence} onValueChange={(value) => setRecurrence(value as CustomerActivity["recurrence"])}><SelectTrigger aria-label="Ricorrenza attività"><SelectValue /></SelectTrigger><SelectContent>{customerActivityRecurrences.map((item) => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></Label>
    <Label className="sm:col-span-2">Categoria tecnica<Input value={technicalCategory} onChange={(event) => setTechnicalCategory(event.target.value)} placeholder="Facoltativa, es. frontend, API, contenuti" /></Label>
  </div><DialogFooter className="shrink-0 border-t pt-3"><Button variant="outline" onClick={() => onOpenChange(false)}>Annulla</Button><Button disabled={(!customer && !lead) || !title.trim() || saving} onClick={save}>{saving ? "Creazione…" : "Crea attività"}</Button></DialogFooter></DialogContent></Dialog>
}
