"use client"

import { useMemo, useRef, useState } from "react"
import { Download, ExternalLink, UsersRound } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { buildGoogleContactsCsv, deduplicateContactLeads } from "@/features/commercial/google-contacts-export"
import { useCommercialTeam } from "@/features/commercial/use-commercial-team"
import type { CommercialLead } from "@/features/commercial/types"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"

type Mode = "new" | "selected" | "unexported"

export function GoogleContactsExportDialog({ open, onOpenChange, leads, selectedIds }: { open: boolean; onOpenChange: (open: boolean) => void; leads: CommercialLead[]; selectedIds: string[] }) {
  const commercialTeam = useCommercialTeam()
  const { store, identity } = useAuthorizedCommercial()
  const [mode, setMode] = useState<Mode>(selectedIds.length ? "selected" : "new")
  const [assignee, setAssignee] = useState("all")
  const [completed, setCompleted] = useState(false)
  const exporting = useRef(false)
  const candidates = useMemo(() => leads.filter((lead) => (mode === "selected" ? selectedIds.includes(lead.id) : mode === "unexported" ? lead.stage === "new" && !lead.exportedToContactsAt : lead.stage === "new") && (assignee === "all" || lead.assigneeId === assignee)), [assignee, leads, mode, selectedIds])
  const unique = deduplicateContactLeads(candidates)
  const duplicateCount = candidates.length - unique.length
  const exportContacts = () => {
    if (!unique.length || exporting.current) return
    exporting.current = true
    try {
      const result = store.exportLeadsToContacts(unique.map((lead) => lead.id))
      if (!result.ok) return toast.error(result.message)
      const built = buildGoogleContactsCsv(result.leads, (id) => commercialTeam.find((item) => item.id === id)?.name ?? id)
      const url = URL.createObjectURL(new Blob([built.csv], { type: "text/csv;charset=utf-8" }))
      const anchor = document.createElement("a"); anchor.href = url; anchor.download = `doflow-nuovi-lead-${identity.currentUser.name.toLowerCase().replace(/\s+/g, "-")}-${result.exportedAt.slice(0, 10)}.csv`; anchor.click(); URL.revokeObjectURL(url)
      setCompleted(true)
      if (result.existing) toast.info("Batch già registrato: il CSV è stato scaricato nuovamente senza duplicare eventi."); else toast.success(`${built.leads.length} contatti esportati`)
    } finally { window.setTimeout(() => { exporting.current = false }, 500) }
  }
  return <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setCompleted(false) }}><DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Esporta Google Contatti</DialogTitle><DialogDescription>Genera un CSV UTF-8 compatibile con Google, limitato ai lead autorizzati.</DialogDescription></DialogHeader><div className="space-y-4"><Label>Modalità<Select value={mode} onValueChange={(value) => setMode(value as Mode)}><SelectTrigger aria-label="Modalità export Google Contatti"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="new">Tutti i Nuovo lead autorizzati</SelectItem><SelectItem value="selected" disabled={!selectedIds.length}>Soltanto lead selezionati ({selectedIds.length})</SelectItem><SelectItem value="unexported">Nuovi lead non ancora esportati</SelectItem></SelectContent></Select></Label>{identity.hasCapability("canViewAllLeads") && <Label>Responsabile<Select value={assignee} onValueChange={setAssignee}><SelectTrigger aria-label="Responsabile export"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i responsabili autorizzati</SelectItem>{commercialTeam.map((member) => <SelectItem key={member.id} value={member.id}>{member.name}</SelectItem>)}</SelectContent></Select></Label>}<Card><CardContent className="flex gap-3 p-4"><UsersRound className="mt-0.5 size-4 shrink-0" /><div><p className="font-medium">{unique.length} contatti nel file</p><p className="text-sm text-muted-foreground">{duplicateCount ? `${duplicateCount} righe duplicate per telefono/email saranno escluse soltanto dal CSV.` : "Nessun duplicato telefono/email rilevato."}</p></div></CardContent></Card>{completed && <Card><CardContent className="flex gap-3 p-4"><Download className="mt-0.5 size-4 shrink-0" /><div><p className="font-medium">CSV pronto</p><p className="text-sm text-muted-foreground">1. Apri Google Contatti. 2. Clicca Importa. 3. Seleziona il CSV scaricato. 4. Conferma l’importazione.</p></div></CardContent></Card>}</div><DialogFooter className="flex-col-reverse gap-2 sm:flex-row"><Button asChild variant="outline"><a href="https://contacts.google.com/" target="_blank" rel="noreferrer"><ExternalLink />Apri Google Contatti</a></Button><Button onClick={exportContacts} disabled={!unique.length}><Download />Esporta {unique.length} contatti</Button></DialogFooter></DialogContent></Dialog>
}
