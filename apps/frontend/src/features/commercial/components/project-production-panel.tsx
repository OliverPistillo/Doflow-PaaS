"use client"

import { useState } from "react"
import { CheckCircle2, Clock3, Eye, PackageCheck, Play, RotateCcw, Send, ShieldCheck, Square } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { projectProgress } from "@/features/commercial/commercial-production"
import { type CommercialProject, type CustomerActivity, useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { useCommercialTeam } from "@/features/commercial/use-commercial-team"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { canManageProject } from "@/features/identity/permissions"

const minutes = new Intl.NumberFormat("it-IT")

export function ProjectProductionPanel({ project, activities }: { project: CommercialProject; activities: CustomerActivity[] }) {
  const commercialTeam = useCommercialTeam()
  const store = useCommercialLeads()
  const identity = useDoflowIdentity()
  const manage = canManageProject(identity.currentUser, project)
  const canTrack = identity.currentUser.roles.some((role) => role === "administrator" || role === "project_manager" || role === "web_developer")
  const sessions = store.timeSessions.filter((session) => session.projectId === project.id && !session.archivedAt)
  const active = sessions.find((session) => session.userId === identity.currentUser.id && session.status === "active")
  const total = sessions.filter((session) => session.status === "completed").reduce((sum, session) => sum + (session.durationMinutes ?? 0), 0)
  const progress = projectProgress(project, activities)
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({})
  const start = async (activityId?: string) => {
    const result = await store.startProjectTime(project.id, activityId)
    if (result.ok) toast.success(result.existing ? "Timer già attivo" : "Timer avviato")
    else toast.error(result.message)
  }
  const stop = async () => {
    if (!active) return
    const result = await store.stopProjectTime(active.id)
    if (result.ok) toast.success(`Registrati ${result.durationMinutes} minuti`)
    else toast.error(result.message)
  }
  const publish = async () => {
    const result = await store.publishProjectClientUpdate(project.id)
    if (result.ok) toast.success(result.existing ? "Aggiornamento già pubblicato" : "Aggiornamento pubblicato")
    else toast.error(result.message)
  }
  const deliver = async () => {
    const result = await store.deliverProject(project.id)
    if (result.ok) toast.success(result.existing ? "Progetto già consegnato" : "Progetto consegnato")
    else toast.error(result.message)
  }

  return <div className="grid gap-4 lg:grid-cols-2">
    <Card><CardHeader><div className="flex items-start justify-between gap-3"><div><CardTitle>Produzione e tempo</CardTitle><CardDescription>Timer persistente collegato al progetto e, facoltativamente, all’attività.</CardDescription></div><Badge variant="secondary">{progress.internal}%</Badge></div></CardHeader><CardContent className="space-y-3"><div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3"><div><p className="font-medium">Tempo consuntivato</p><p className="text-sm text-muted-foreground">{minutes.format(total)} minuti · {sessions.filter((item) => item.status === "completed").length} sessioni · stima {progress.estimatedMinutes} min</p></div>{canTrack && (active ? <Button variant="destructive" onClick={stop}><Square />Ferma timer</Button> : <Button onClick={() => start()}><Play />Avvia timer</Button>)}</div>{active && <p className="flex items-center gap-2 text-sm text-emerald-700 dark:text-emerald-300"><Clock3 className="size-4 animate-pulse" />Timer attivo dal {new Date(active.startedAt).toLocaleTimeString("it-IT", { hour: "2-digit", minute: "2-digit" })}</p>}<div className="space-y-2">{activities.map((activity) => <div key={activity.id} className="flex flex-wrap items-center gap-2 rounded-lg border p-3"><div className="min-w-0 flex-1"><p className="truncate font-medium">{activity.title}</p><p className="text-xs text-muted-foreground">Stima {activity.estimatedMinutes ?? 0} min · {activity.status}</p></div>{canTrack && !active && <Button size="sm" variant="outline" onClick={() => start(activity.id)}><Play />Cronometra</Button>}</div>)}</div></CardContent></Card>
    <Card><CardHeader><CardTitle>Supervisione, QA e consegna</CardTitle><CardDescription>Completamento, approvazione interna e pubblicazione sono transizioni separate e persistenti.</CardDescription></CardHeader><CardContent className="space-y-3"><div className="rounded-lg border p-3 text-sm"><b>Supervisore</b><p className="text-muted-foreground">{(project.supervisorIds?.length ? project.supervisorIds : [project.ownerId]).map((id) => commercialTeam.find((member) => member.id === id)?.name ?? id).join(", ")}</p></div>{activities.map((activity) => <WorkApproval key={activity.id} activity={activity} project={project} notes={notes} checks={checks} overrideReasons={overrideReasons} setNotes={setNotes} setChecks={setChecks} setOverrideReasons={setOverrideReasons} />)}<div className="border-t pt-3">{project.qaChecklist?.length ? project.qaChecklist.map((item) => <label key={item.id} className="mb-2 flex items-start gap-3 rounded-lg border p-3"><Checkbox checked={Boolean(item.completedAt)} disabled={!manage && !(identity.currentUser.roles.includes("web_developer") && project.memberIds.includes(identity.currentUser.id))} onCheckedChange={(checked) => store.setProjectQaItem(project.id, item.id, Boolean(checked))} /><span className="min-w-0 flex-1 text-sm"><span className="font-medium">{item.label}</span>{item.required && <span className="block text-xs text-muted-foreground">Controllo obbligatorio</span>}</span>{item.completedAt && <CheckCircle2 className="size-4 text-emerald-600" />}</label>) : <p className="text-sm text-muted-foreground">Nessuna checklist QA configurata.</p>}</div><div className="flex flex-wrap gap-2 border-t pt-3"><Button variant="outline" disabled={!identity.hasCapability("canPublishClientUpdate")} onClick={publish}><Eye />Pubblica aggiornamento cliente</Button><Button disabled={!manage} onClick={deliver}><PackageCheck />Consegna progetto</Button></div>{project.clientUpdatePublishedAt && <p className="text-xs text-muted-foreground">Pubblicato: {new Date(project.clientUpdatePublishedAt).toLocaleString("it-IT")} · versione {project.clientUpdateVersion ?? 1}</p>}{project.deliveredAt && <p className="text-xs text-muted-foreground">Consegnato: {new Date(project.deliveredAt).toLocaleString("it-IT")}</p>}</CardContent></Card>
  </div>
}

type ApprovalState = { notes: Record<string, string>; checks: Record<string, boolean>; overrideReasons: Record<string, string>; setNotes: React.Dispatch<React.SetStateAction<Record<string, string>>>; setChecks: React.Dispatch<React.SetStateAction<Record<string, boolean>>>; setOverrideReasons: React.Dispatch<React.SetStateAction<Record<string, string>>> }
function WorkApproval({ activity, project, notes, checks, overrideReasons, setNotes, setChecks, setOverrideReasons }: { activity: CustomerActivity; project: CommercialProject } & ApprovalState) {
  const commercialTeam = useCommercialTeam()
  const store = useCommercialLeads(); const identity = useDoflowIdentity(); const worker = activity.assigneeId === identity.currentUser.id || activity.collaboratorIds.includes(identity.currentUser.id); const canApprove = identity.hasCapability("canApproveProjectWork"); const canPublish = identity.hasCapability("canPublishClientUpdate")
  const submit = async () => await store.submitCustomerActivityWork(project.clientId, activity.id) ? toast.success("Lavoro inviato in approvazione") : toast.error("Invio non autorizzato o già eseguito")
  const approve = async () => await store.approveCustomerActivityWork(project.clientId, activity.id, { note: notes[activity.id] ?? "", checklist: [{ id: "requirements", label: "Requisiti e QA verificati", checked: checks[activity.id] ?? false }], overrideReason: overrideReasons[activity.id] }) ? toast.success("Lavoro approvato internamente") : toast.error("Approvazione rifiutata: verifica nota, checklist e separazione dei ruoli")
  return <section className="space-y-2 rounded-lg border p-3"><div className="flex flex-wrap items-center gap-2"><strong className="min-w-0 flex-1 truncate text-sm">{activity.title}</strong><Badge variant="outline">{activity.workStatus ?? (activity.status === "Completata" ? "Completato dal collaboratore" : "In lavorazione")}</Badge></div>{activity.changesRequestNote && <p className="text-xs text-amber-700 dark:text-amber-300">Prossima azione: {activity.changesRequestNote}</p>}<div className="flex flex-wrap gap-2">{worker && activity.status === "Completata" && !["In attesa di approvazione", "Approvato internamente", "Pronto per il cliente", "Pubblicato al cliente"].includes(activity.workStatus ?? "") && <Button size="sm" variant="outline" onClick={submit}><Send />Invia in approvazione</Button>}{canPublish && activity.workStatus === "Approvato internamente" && <Button size="sm" variant="outline" onClick={async () => await store.markCustomerActivityReadyForClient(project.clientId, activity.id) ? toast.success("Lavoro pronto per il cliente") : toast.error("Transizione rifiutata")}><CheckCircle2 />Pronto per il cliente</Button>}{canPublish && activity.workStatus === "Pronto per il cliente" && <Button size="sm" variant="outline" onClick={async () => await store.publishCustomerActivityWork(project.clientId, activity.id) ? toast.success("Lavoro pubblicato") : toast.error("Pubblicazione rifiutata")}><Eye />Pubblica lavoro</Button>}</div>{canApprove && activity.workStatus === "In attesa di approvazione" && <div className="space-y-2 rounded-md bg-muted/40 p-2"><Textarea aria-label={`Nota approvazione ${activity.title}`} placeholder="Nota obbligatoria" value={notes[activity.id] ?? ""} onChange={(event) => setNotes((current) => ({ ...current, [activity.id]: event.target.value }))} /><label className="flex items-center gap-2 text-xs"><Checkbox checked={checks[activity.id] ?? false} onCheckedChange={(checked) => setChecks((current) => ({ ...current, [activity.id]: checked === true }))} />Requisiti e QA verificati</label>{activity.submittedBy === identity.currentUser.id && identity.currentUser.roles.includes("administrator") && <Input aria-label={`Motivo override ${activity.title}`} placeholder="Motivo override amministratore" value={overrideReasons[activity.id] ?? ""} onChange={(event) => setOverrideReasons((current) => ({ ...current, [activity.id]: event.target.value }))} />}<div className="flex flex-wrap gap-2"><Button size="sm" onClick={approve}><ShieldCheck />Approva</Button><Button size="sm" variant="destructive" onClick={async () => await store.requestCustomerActivityChanges(project.clientId, activity.id, notes[activity.id] ?? "") ? toast.success("Modifiche richieste; attività e fase riaperte") : toast.error("Inserisci una nota o verifica i permessi")}><RotateCcw />Richiedi modifiche</Button></div></div>}{activity.approval && <p className="text-xs text-muted-foreground">Approvato da {commercialTeam.find((member) => member.id === activity.approval?.approvedBy)?.name ?? activity.approval.approvedBy} · v{activity.approval.version} · {new Date(activity.approval.approvedAt).toLocaleString("it-IT")}</p>}</section>
}
