"use client"

import { useState, type FormEvent } from "react"
import { Archive, CalendarPlus, ChevronDown, LoaderCircle, Mail, MessageCircle, Pencil, Phone, Plus, Trophy, XCircle } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { CommercialLead, LeadSource } from "@/features/commercial/types"

type GeneralLeadFields = Pick<CommercialLead, "opportunityName" | "firstName" | "lastName" | "company" | "email" | "phone" | "location" | "source">
type LeadActionsProps = { lead: CommercialLead; onSave: (updates: GeneralLeadFields) => Promise<boolean>; onCreateActivity: () => void; onAddNote: () => void; onChangeOutcome: (stage: "won" | "lost") => Promise<void>; onArchive: () => void }
type Draft = Required<GeneralLeadFields>

const leadSources: LeadSource[] = ["Google Ads", "Meta Ads", "LinkedIn", "Referral", "Organico", "Evento", "Instagram", "Manuale"]

function toDraft(lead: CommercialLead): Draft {
  return { opportunityName: lead.opportunityName || lead.company, firstName: lead.firstName, lastName: lead.lastName, company: lead.company, email: lead.email, phone: lead.phone, location: lead.location || lead.originalRequest?.province || lead.formSubmission?.province || "", source: lead.source }
}

export function LeadDetailTopActions({ lead, onSave, onCreateActivity, onAddNote, onChangeOutcome, onArchive }: LeadActionsProps) {
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => toDraft(lead))
  const [errors, setErrors] = useState<Partial<Record<keyof Draft, string>>>({})
  const [isSaving, setIsSaving] = useState(false)
  const update = <Key extends keyof Draft>(key: Key, value: Draft[Key]) => setDraft((current) => ({ ...current, [key]: value }))
  const close = () => { if (isSaving) return; setDraft(toDraft(lead)); setErrors({}); setOpen(false) }
  const openEditor = () => { setDraft(toDraft(lead)); setErrors({}); setOpen(true) }
  const validate = () => {
    const next: Partial<Record<keyof Draft, string>> = {}
    if (!draft.opportunityName.trim()) next.opportunityName = "Inserisci il nome dell'opportunità."
    if (!draft.firstName.trim()) next.firstName = "Inserisci il nome del referente."
    if (!draft.lastName.trim()) next.lastName = "Inserisci il cognome del referente."
    if (!draft.company.trim()) next.company = "Inserisci l'azienda."
    if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) next.email = "Inserisci un'email valida."
    if (draft.phone.replace(/\D/g, "").length < 6) next.phone = "Inserisci un numero di telefono valido."
    if (!draft.location.trim()) next.location = "Inserisci la sede."
    if (!draft.source) next.source = "Seleziona la fonte del lead."
    setErrors(next)
    return Object.keys(next).length === 0
  }
  const save = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isSaving || !validate()) return
    setIsSaving(true)
    try {
      const saved = await onSave({ ...draft, opportunityName: draft.opportunityName.trim(), firstName: draft.firstName.trim(), lastName: draft.lastName.trim(), company: draft.company.trim(), email: draft.email.trim(), phone: draft.phone.trim(), location: draft.location.trim() })
      if (!saved) throw new Error("Aggiornamento non confermato dal server")
      setOpen(false)
      toast.success("Dati del lead aggiornati")
    } catch {
      toast.error("Non è stato possibile salvare le modifiche. Riprova.")
    } finally {
      setIsSaving(false)
    }
  }
  const changeOutcome = async (stage: "won" | "lost") => {
    try {
      await onChangeOutcome(stage)
      toast.success(stage === "won" ? "Lead convertito in cliente" : "Lead segnato come perso")
    } catch {
      toast.error("Non è stato possibile aggiornare lo stato del lead.")
    }
  }
  const field = (key: keyof Draft, label: string, type = "text") => <div className="grid gap-2"><Label htmlFor={`lead-${key}`}>{label}</Label><Input id={`lead-${key}`} type={type} value={draft[key]} aria-invalid={Boolean(errors[key])} onChange={(event) => update(key, event.target.value as Draft[typeof key])} disabled={isSaving} />{errors[key] && <p className="text-xs text-destructive">{errors[key]}</p>}</div>

  return <div className="flex items-center gap-2"><Button variant="outline" onClick={openEditor}><Pencil />Modifica</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline">Azioni<ChevronDown /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={onCreateActivity}><CalendarPlus />Crea attività</DropdownMenuItem><DropdownMenuItem onSelect={onAddNote}><Plus />Aggiungi nota</DropdownMenuItem><DropdownMenuItem onClick={() => window.location.href = `mailto:${lead.email}`}><Mail />Invia email</DropdownMenuItem><DropdownMenuItem onClick={() => window.open(`https://wa.me/${lead.phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer")}><MessageCircle />Apri WhatsApp</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem onSelect={() => void changeOutcome("won")}><Trophy />Segna come vinto</DropdownMenuItem><DropdownMenuItem variant="destructive" onSelect={() => void changeOutcome("lost")}><XCircle />Segna come perso</DropdownMenuItem><DropdownMenuSeparator /><DropdownMenuItem variant="destructive" onSelect={onArchive}><Archive />Archivia lead</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
    <Sheet open={open} onOpenChange={(nextOpen) => nextOpen ? setOpen(true) : close()}><SheetContent className="w-full sm:max-w-md"><SheetHeader><SheetTitle>Modifica dati del lead</SheetTitle><SheetDescription>Aggiorna i dati generali dell&apos;opportunità.</SheetDescription></SheetHeader><form className="flex min-h-0 flex-1 flex-col" onSubmit={save}><div className="space-y-4 overflow-y-auto px-4 pb-4">{field("opportunityName", "Nome opportunità")}{field("firstName", "Nome referente")}{field("lastName", "Cognome referente")}{field("company", "Azienda")}{field("email", "Email", "email")}{field("phone", "Telefono", "tel")}{field("location", "Sede")}<div className="grid gap-2"><Label htmlFor="lead-source">Fonte del lead</Label><Select value={draft.source} onValueChange={(value) => update("source", value as LeadSource)} disabled={isSaving}><SelectTrigger id="lead-source" aria-invalid={Boolean(errors.source)}><SelectValue /></SelectTrigger><SelectContent>{leadSources.map((source) => <SelectItem key={source} value={source}>{source}</SelectItem>)}</SelectContent></Select>{errors.source && <p className="text-xs text-destructive">{errors.source}</p>}</div></div><SheetFooter className="border-t sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={close} disabled={isSaving}>Annulla</Button><Button type="submit" disabled={isSaving}>{isSaving && <LoaderCircle className="animate-spin" />}Salva modifiche</Button></SheetFooter></form></SheetContent></Sheet>
  </div>
}

export function LeadQuickActions({ phone, email, onCreateActivity }: { firstName: string; phone: string; email: string; onCreateActivity?: () => void }) {
  const actions = [
    { label: "Chiama", icon: Phone, className: "border-blue-500/30 text-blue-600 dark:text-blue-400", onClick: () => { window.location.href = `tel:${phone}` } },
    { label: "WhatsApp", icon: MessageCircle, className: "border-emerald-500/30 text-emerald-600 dark:text-emerald-400", onClick: () => window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank", "noopener,noreferrer") },
    { label: "Email", icon: Mail, className: "border-cyan-500/30 text-cyan-600 dark:text-cyan-400", onClick: () => { window.location.href = `mailto:${email}` } },
    ...(onCreateActivity ? [{ label: "Crea attività", icon: CalendarPlus, className: "border-violet-500/30 text-violet-600 dark:text-violet-400", onClick: onCreateActivity }] : []),
  ]
  return <div className="flex flex-wrap items-center gap-2">{actions.map(({ label, icon: Icon, className, onClick }) => <Tooltip key={label}><TooltipTrigger asChild><Button variant="outline" className={`h-9 gap-2 whitespace-nowrap ${className}`} onClick={onClick}><Icon className="size-4" /><span className="hidden xl:inline">{label}</span></Button></TooltipTrigger><TooltipContent>{label}</TooltipContent></Tooltip>)}</div>
}
