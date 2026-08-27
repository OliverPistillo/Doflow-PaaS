"use client"

import { useRouter } from "next/navigation"
import { useRef, useState } from "react"
import { Archive } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import type { CommercialLead } from "@/features/commercial/types"

export function LeadArchiveDialog({ lead, open, onOpenChange, onArchived }: { lead?: CommercialLead; open: boolean; onOpenChange: (open: boolean) => void; onArchived?: () => void }) {
  const router = useRouter()
  const { archiveLead } = useCommercialLeads()
  const [reason, setReason] = useState("")
  const [isSaving, setIsSaving] = useState(false)
  const saving = useRef(false)
  const changeOpen = (next: boolean) => { if (saving.current) return; if (!next) setReason(""); onOpenChange(next) }
  const confirm = () => {
    if (!lead || saving.current) return
    saving.current = true
    setIsSaving(true)
    const archived = archiveLead(lead.id, reason)
    if (!archived) { saving.current = false; setIsSaving(false); toast.error("Impossibile archiviare il lead."); return }
    window.setTimeout(() => {
      toast.success("Lead archiviato", { duration: 8000, action: { label: "Apri Archivio", onClick: () => router.push("/dashboard/archivio") } })
      onOpenChange(false)
      onArchived?.()
    }, 250)
  }
  return <Dialog open={open} onOpenChange={changeOpen}><DialogContent aria-busy={isSaving}><DialogHeader><DialogTitle>Archiviare questo lead?</DialogTitle><DialogDescription>Il record resterà recuperabile dalla sezione Archivio.</DialogDescription></DialogHeader><div className="grid gap-2"><Label htmlFor="lead-archive-reason">Motivo (facoltativo)</Label><Textarea id="lead-archive-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Perché il lead viene archiviato?" disabled={isSaving} /></div><DialogFooter><Button variant="outline" onClick={() => changeOpen(false)} disabled={isSaving}>Annulla</Button><Button variant="destructive" onClick={confirm} disabled={isSaving}><Archive />Conferma archiviazione</Button></DialogFooter></DialogContent></Dialog>
}
