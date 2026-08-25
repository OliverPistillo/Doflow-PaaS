"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useState } from "react"
import { Archive } from "lucide-react"
import { Camera } from "lucide-react"
import { toast } from "sonner"
import { EntityImageDialog } from "@/components/entity-image-dialog"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { ActivityFormDialog } from "@/features/commercial/components/activity-form-dialog"
import { LeadDetailTopActions } from "@/features/commercial/components/lead-detail/lead-detail-actions"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { LeadDetailOperationalCard } from "@/features/commercial/components/lead-detail/lead-detail-operational-card"
import { LeadDetailWorkspace } from "@/features/commercial/components/lead-detail/lead-detail-workspace"
import { LeadArchiveDialog } from "@/features/commercial/components/lead-archive-dialog"
import { LeadCommercialPath, LeadDocumentCenter } from "@/features/commercial/components/lead-commercial-path"
import { CustomerLogo } from "@/features/commercial/components/customer-logo"
import { RankingWinnerBadges } from "@/features/commercial/components/ranking-winner-badges"
import { Badge } from "@/components/ui/badge"
import type { TimelineEvent } from "@/features/commercial/components/lead-detail/lead-timeline-card"
import type { CommercialLead, PipelineStage, TeamMember } from "@/features/commercial/types"
import { AccessDenied } from "@/features/identity/access-denied"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { canEditLead, canManageCustomerBranding, canViewLead } from "@/features/identity/permissions"

type Stage = { id: PipelineStage; label: string }
const italianDateTime = new Intl.DateTimeFormat("it-IT", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })

export function LeadDetailPage({ leadId, team, stages }: { leadId: string; team: TeamMember[]; stages: Stage[] }) {
  const router = useRouter()
  const commercialStore = useCommercialLeads()
  const { allLeads, allCustomers, allProjects, leadActivities, timelineEvents, updateLead: updateSharedLead } = commercialStore
  const identity = useDoflowIdentity()
  const [activityOpen, setActivityOpen] = useState(false)
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [logoOpen, setLogoOpen] = useState(false)
  const [selectedActivityId, setSelectedActivityId] = useState<string>()
  const lead = allLeads.find((item) => item.id === leadId)
  if (!lead) return <main className="mx-auto flex min-h-[60vh] max-w-xl items-center p-6"><div className="w-full rounded-xl border bg-card p-6 text-center"><h1 className="text-xl font-semibold">Record non disponibile</h1><p className="mt-2 text-sm text-muted-foreground">Il lead richiesto non esiste oppure non è più disponibile.</p><Button asChild className="mt-5"><Link href="/dashboard/commercial/leads">Torna a Tutti i lead</Link></Button></div></main>
  if (lead.archivedAt) {
    if (!canEditLead(identity.currentUser, lead)) return <AccessDenied resource="a questo record archiviato" />
    return <main className="mx-auto flex min-h-[60vh] max-w-xl items-center p-6"><div className="w-full rounded-xl border bg-card p-6 text-center"><Archive className="mx-auto size-9 text-muted-foreground" /><h1 className="mt-3 text-xl font-semibold">Record archiviato</h1><p className="mt-2 text-sm text-muted-foreground">{lead.firstName} {lead.lastName} · {lead.company}</p><p className="mt-1 text-xs text-muted-foreground">Archiviato il {italianDateTime.format(new Date(lead.archivedAt))}{lead.archivedReason ? ` · ${lead.archivedReason}` : ""}</p><Button asChild className="mt-5"><Link href="/dashboard/commercial/leads">Torna a Tutti i lead</Link></Button></div></main>
  }
  if (!canViewLead(identity.currentUser, lead)) return <AccessDenied resource="a questa scheda lead" />
  const editable = canEditLead(identity.currentUser, lead)
  const assignableTeam = identity.hasCapability("canAssignLeads") ? team : team.filter((member) => member.id === identity.currentUserId)
  const leadUpdateEvent = timelineEvents.find((event) => event.leadId === lead.id) as TimelineEvent | undefined
  const latestEvent = timelineEvents.filter((event) => event.leadId === lead.id).sort((a, b) => b.date.localeCompare(a.date))[0]
  const owner = team.find((member) => member.id === lead.assigneeId)
  const customer = allCustomers.find((item) => item.id === lead.convertedClientId || item.sourceLeadId === lead.id)
  const canEditLogo = customer ? canManageCustomerBranding(identity.currentUser, customer, { leads: allLeads, customers: allCustomers, projects: allProjects }) : false
  const selectedActivity = leadActivities.find((activity) => activity.id === selectedActivityId && activity.leadId === lead.id)
  const updateLead = (updates: Pick<CommercialLead, "opportunityName" | "firstName" | "lastName" | "company" | "email" | "phone" | "location" | "source">) => {
    updateSharedLead(lead.id, updates)
  }

  return <main className="mx-auto w-full max-w-[1600px] space-y-4 px-3 py-5 md:px-4 lg:px-6">
    <header className="flex flex-col gap-3 border-b py-3 lg:flex-row lg:items-start lg:justify-between"><div className="flex min-w-0 items-center gap-3">{customer && <CustomerLogo customer={customer} className="size-14" />}<div className="min-w-0"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Scheda commerciale</p><h1 className="line-clamp-2 text-2xl font-semibold">{lead.company || `${lead.firstName} ${lead.lastName}`}</h1><p className="truncate text-sm text-muted-foreground">{lead.firstName} {lead.lastName} · {lead.service}</p><div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground"><Badge variant="secondary">{stages.find((stage) => stage.id === lead.stage)?.label ?? lead.stage}</Badge><span>Responsabile: {owner?.name ?? lead.owner}</span><RankingWinnerBadges userId={lead.assigneeId} compact /><span>Modificato {italianDateTime.format(new Date(latestEvent?.date ?? lead.lastContact))}</span><span>Prossima azione {italianDateTime.format(new Date(lead.nextActionAt))}</span><span>Origine: {lead.formSubmission?.utmCampaign || lead.source}</span></div></div></div><div className="flex shrink-0 flex-wrap items-center gap-2">{canEditLogo && <Button variant="outline" onClick={() => setLogoOpen(true)}><Camera />Logo</Button>}{lead.convertedClientId && <Button asChild variant="outline"><Link href={`/dashboard/clienti/${lead.convertedClientId}`}>Apri cliente</Link></Button>}{editable && <Button variant="destructive" onClick={() => setArchiveOpen(true)}><Archive />Archivia</Button>}{editable && <LeadDetailTopActions lead={lead} onSave={updateLead} onCreateActivity={() => setActivityOpen(true)} />}</div>{customer && logoOpen && <EntityImageDialog open={logoOpen} onOpenChange={setLogoOpen} title={`Logo di ${customer.profile.company}`} description="Salvato sul record cliente dal server." currentUrl={customer.logoUrl} fallback={customer.profile.company.slice(0, 2).toUpperCase()} onSave={async (logoUrl) => { const saved = await commercialStore.updateCustomerLogo(customer.id, logoUrl); if (saved) toast.success(logoUrl ? "Logo cliente aggiornato" : "Logo cliente rimosso"); return saved }} />}</header>
    <LeadDetailOperationalCard lead={lead} team={assignableTeam} stages={stages} onCreateActivity={editable ? () => setActivityOpen(true) : undefined} />
    <LeadCommercialPath lead={lead} />
    <LeadDocumentCenter lead={lead} />
    <div id="timeline"><LeadDetailWorkspace lead={lead} team={team} leadUpdateEvent={leadUpdateEvent} onCreateActivity={editable ? () => setActivityOpen(true) : undefined} onOpenActivity={setSelectedActivityId} /></div>
    {editable && <ActivityFormDialog open={activityOpen} onOpenChange={setActivityOpen} defaultLeadId={lead.id} onSaved={setSelectedActivityId} />}
    <Sheet open={Boolean(selectedActivity)} onOpenChange={(open) => { if (!open) setSelectedActivityId(undefined) }}><SheetContent className="w-full sm:max-w-[520px]"><SheetHeader><SheetTitle>{selectedActivity?.title}</SheetTitle><SheetDescription>{selectedActivity?.description || "Nessuna descrizione"}</SheetDescription></SheetHeader>{selectedActivity && <div className="space-y-3 p-4 text-sm"><div className="flex flex-wrap gap-2"><Badge>{selectedActivity.status}</Badge><Badge variant="secondary">{selectedActivity.priority}</Badge><Badge variant="outline">{selectedActivity.type}</Badge></div><p>Responsabile: <b>{team.find((member) => member.id === selectedActivity.assigneeId)?.name ?? selectedActivity.assigneeId}</b></p><p>Scadenza: <b>{selectedActivity.dueDate ? italianDateTime.format(new Date(`${selectedActivity.dueDate}T${selectedActivity.dueTime || "12:00"}:00`)) : "Nessuna"}</b></p><Button asChild variant="outline"><Link href="/dashboard/attivita">Apri nel modulo Attività</Link></Button></div>}</SheetContent></Sheet>
    <LeadArchiveDialog lead={lead} open={archiveOpen} onOpenChange={setArchiveOpen} onArchived={() => router.replace("/dashboard/commercial")} />
  </main>
}
