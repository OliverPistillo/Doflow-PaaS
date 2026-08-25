"use client"

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
  const { archiveLead } = useCommercialLeads()
  const [reason, setReason] = useState("")
  const saving = useRef(false)
  const changeOpen = (next: boolean) => { if (saving.current) return; if (!next) setReason(""); onOpenChange(next) }
  const confirm = () => {
    if (!lead || saving.current) return
    saving.current = true
    const archived = archiveLead(lead.id, reason)
    if (!archived) { saving.current = false; toast.error("Impossibile archiviare il lead."); return }
    onOpenChange(false)
    toast.success("Lead archiviato")
    onArchived?.()
  }
  return <Dialog open={open} onOpenChange={changeOpen}><DialogContent><DialogHeader><DialogTitle>Archiviare {lead?.company}?</DialogTitle><DialogDescription>Il record non verrà eliminato. Sarà rimosso dalle viste operative e resterà conservato nello storico.</DialogDescription></DialogHeader><div className="grid gap-2"><Label htmlFor="lead-archive-reason">Motivo (facoltativo)</Label><Textarea id="lead-archive-reason" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Perché il lead viene archiviato?" /></div><DialogFooter><Button variant="outline" onClick={() => changeOpen(false)}>Annulla</Button><Button variant="destructive" onClick={confirm}><Archive />Conferma archiviazione</Button></DialogFooter></DialogContent></Dialog>
}
