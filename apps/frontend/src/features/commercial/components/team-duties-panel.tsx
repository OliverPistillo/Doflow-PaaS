"use client"

import { useMemo, useState } from "react"
import { BookOpenCheck, CheckCircle2, ChevronDown, History, Plus, ShieldCheck } from "lucide-react"
import { toast } from "sonner"

import { UserAvatar } from "@/components/user-avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { useDoflowIdentity, type TeamDuty } from "@/features/identity/doflow-identity-provider"
import { roleLabels } from "@/features/identity/permissions"

const splitLines = (value: string) => value.split(/\r?\n|,/).map((item) => item.trim()).filter(Boolean)

export function TeamDutiesPanel() {
  const identity = useDoflowIdentity()
  const store = useCommercialLeads()
  const [editingUserId, setEditingUserId] = useState<string>()
  const [historyUserId, setHistoryUserId] = useState<string>()
  const [objectiveDuty, setObjectiveDuty] = useState<TeamDuty>()
  const [objectiveTitle, setObjectiveTitle] = useState("")
  const [objectiveTarget, setObjectiveTarget] = useState("4")
  const [form, setForm] = useState({ title: "", responsibilities: "", areas: "", validFrom: new Date().toISOString().slice(0, 10), notes: "" })
  const dutiesByUser = useMemo(() => new Map(identity.users.map((user) => [user.id, identity.teamDuties.filter((duty) => duty.userId === user.id).sort((a, b) => b.version - a.version)])), [identity.teamDuties, identity.users])
  const canManage = identity.hasCapability("manageTeamDuties")

  const openVersion = (userId: string) => {
    const current = dutiesByUser.get(userId)?.find((duty) => duty.status === "Attiva") ?? dutiesByUser.get(userId)?.[0]
    setForm({ title: current?.title ?? "", responsibilities: current?.responsibilities.join("\n") ?? "", areas: current?.competencyAreas.join(", ") ?? "", validFrom: new Date().toISOString().slice(0, 10), notes: current?.notes ?? "" })
    setEditingUserId(userId)
  }
  const saveVersion = () => {
    if (!editingUserId) return
    const source = dutiesByUser.get(editingUserId)?.find((duty) => duty.status === "Attiva") ?? dutiesByUser.get(editingUserId)?.[0]
    const id = identity.createTeamDutyVersion({ userId: editingUserId, title: form.title, responsibilities: splitLines(form.responsibilities), competencyAreas: splitLines(form.areas), capabilityIds: source?.capabilityIds ?? [], areaOwners: source?.areaOwners ?? [], validFrom: form.validFrom, notes: form.notes.trim() || undefined })
    if (!id) return toast.error("Completa titolo e data di validità")
    setEditingUserId(undefined)
    toast.success("Nuova versione salvata in bozza")
  }
  const createObjective = () => {
    if (!objectiveDuty || !objectiveTitle.trim() || Number(objectiveTarget) <= 0) return toast.error("Inserisci titolo e valore obiettivo")
    const now = new Date(); const end = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    const id = store.addGoal({ title: objectiveTitle.trim(), description: `Obiettivo derivato dalla mansione v${objectiveDuty.version}: ${objectiveDuty.title}`, targetType: "user", targetId: objectiveDuty.userId, metric: "completed_activities", targetValue: Number(objectiveTarget), unit: "number", startsAt: now.toISOString().slice(0, 10), endsAt: end.toISOString().slice(0, 10), status: "active", responsibleId: objectiveDuty.userId, notes: `Mansione ${objectiveDuty.id}` })
    if (!id) return toast.error("Obiettivo non creato")
    setObjectiveDuty(undefined); setObjectiveTitle(""); toast.success("Obiettivo collegato alla mansione")
  }

  return <Card id="team-duties"><CardHeader><div className="flex flex-wrap items-start justify-between gap-3"><div><CardTitle>Mansioni e responsabilità</CardTitle><CardDescription>Versioni persistenti nello store identità. Le mansioni descrivono responsabilità; attività e obiettivi restano record operativi separati.</CardDescription></div><Badge variant="outline"><ShieldCheck />Governance team</Badge></div></CardHeader><CardContent className="space-y-4">{identity.users.map((user) => { const versions = dutiesByUser.get(user.id) ?? []; const active = versions.find((duty) => duty.status === "Attiva") ?? versions[0]; const draft = versions.find((duty) => duty.status === "Bozza"); return <section key={user.id} className="rounded-xl border p-4"><div className="flex flex-wrap items-start gap-3"><UserAvatar userId={user.id} name={user.name} className="size-11" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><h3 className="font-semibold">{user.name}</h3>{active && <Badge>{active.status} · v{active.version}</Badge>}{draft && <Badge variant="secondary">Bozza v{draft.version}</Badge>}</div><p className="text-xs text-muted-foreground">{user.roles.map((role) => roleLabels[role]).join(" · ")}</p></div>{canManage && <Button size="sm" variant="outline" onClick={() => openVersion(user.id)}><Plus />Nuova versione</Button>}</div>{active ? <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]"><div><p className="font-medium">{active.title}</p><ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">{active.responsibilities.map((item) => <li key={item}>{item}</li>)}</ul></div><div className="space-y-2 text-sm"><p><span className="text-muted-foreground">Aree:</span> {active.competencyAreas.join(", ")}</p><p><span className="text-muted-foreground">Valida dal:</span> {active.validFrom}</p><p><span className="text-muted-foreground">Approvata da:</span> {identity.users.find((item) => item.id === active.approverId)?.name ?? "—"}</p>{active.notes && <p className="rounded-md bg-muted p-2 text-xs">{active.notes}</p>}</div></div> : <p className="mt-4 text-sm text-muted-foreground">Nessuna mansione attiva.</p>}<div className="mt-4 flex flex-wrap gap-2">{active?.userId === identity.currentUserId && !active.readAt && <Button size="sm" onClick={() => { if (identity.confirmTeamDutyRead(active.id)) toast.success("Presa visione registrata") }}><BookOpenCheck />Conferma presa visione</Button>}{active?.readAt && <Badge variant="outline"><CheckCircle2 />Letta {new Date(active.readAt).toLocaleDateString("it-IT")}</Badge>}{canManage && active && <Button size="sm" variant="outline" onClick={() => { setObjectiveDuty(active); setObjectiveTitle(`Obiettivo · ${active.title}`) }}><Plus />Crea obiettivo</Button>}{draft && canManage && <Button size="sm" disabled={draft.authorId === identity.currentUserId} onClick={() => identity.approveTeamDuty(draft.id) ? toast.success("Versione approvata e attivata") : toast.error("La bozza deve essere approvata da un altro amministratore")}><ShieldCheck />Approva v{draft.version}</Button>}<Button size="sm" variant="ghost" onClick={() => setHistoryUserId(historyUserId === user.id ? undefined : user.id)}><History />Storico <ChevronDown className={historyUserId === user.id ? "rotate-180" : ""} /></Button></div>{historyUserId === user.id && <div className="mt-3 space-y-2 border-t pt-3">{versions.map((duty) => <div key={duty.id} className="rounded-md bg-muted/50 p-3 text-sm"><div className="flex flex-wrap justify-between gap-2"><b>v{duty.version} · {duty.status}</b><span className="text-xs text-muted-foreground">{duty.validFrom}{duty.validTo ? ` → ${duty.validTo}` : ""}</span></div><p>{duty.title}</p><p className="text-xs text-muted-foreground">{duty.history.length} variazioni registrate</p></div>)}</div>}</section>})}</CardContent>

    <Dialog open={Boolean(editingUserId)} onOpenChange={(open) => { if (!open) setEditingUserId(undefined) }}><DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Nuova versione mansione</DialogTitle><DialogDescription>La versione resta in bozza finché un altro amministratore non la approva.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label htmlFor="duty-title">Titolo</Label><Input id="duty-title" value={form.title} onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} /></div><div><Label htmlFor="duty-responsibilities">Responsabilità, una per riga</Label><Textarea id="duty-responsibilities" className="min-h-32" value={form.responsibilities} onChange={(event) => setForm((current) => ({ ...current, responsibilities: event.target.value }))} /></div><div><Label htmlFor="duty-areas">Aree di competenza</Label><Input id="duty-areas" value={form.areas} onChange={(event) => setForm((current) => ({ ...current, areas: event.target.value }))} /></div><div><Label htmlFor="duty-valid-from">Valida dal</Label><Input id="duty-valid-from" type="date" value={form.validFrom} onChange={(event) => setForm((current) => ({ ...current, validFrom: event.target.value }))} /></div><div><Label htmlFor="duty-notes">Note</Label><Textarea id="duty-notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></div></div><DialogFooter><Button variant="outline" onClick={() => setEditingUserId(undefined)}>Annulla</Button><Button onClick={saveVersion}>Salva bozza</Button></DialogFooter></DialogContent></Dialog>
    <Dialog open={Boolean(objectiveDuty)} onOpenChange={(open) => { if (!open) setObjectiveDuty(undefined) }}><DialogContent><DialogHeader><DialogTitle>Crea obiettivo dalla mansione</DialogTitle><DialogDescription>L’obiettivo viene salvato nel solo store commerciale e mantiene il riferimento alla mansione.</DialogDescription></DialogHeader><div className="space-y-3"><div><Label htmlFor="duty-objective-title">Titolo</Label><Input id="duty-objective-title" value={objectiveTitle} onChange={(event) => setObjectiveTitle(event.target.value)} /></div><div><Label htmlFor="duty-objective-target">Attività completate nel mese</Label><Input id="duty-objective-target" type="number" min="1" value={objectiveTarget} onChange={(event) => setObjectiveTarget(event.target.value)} /></div></div><DialogFooter><Button variant="outline" onClick={() => setObjectiveDuty(undefined)}>Annulla</Button><Button onClick={createObjective}>Crea obiettivo</Button></DialogFooter></DialogContent></Dialog>
  </Card>
}
