"use client"

import { Handle, NodeResizer, Position, type NodeProps } from "@xyflow/react"
import { CalendarClock, CheckSquare, CircleUserRound, Flag, FolderKanban, Link2, Milestone, NotebookPen, PanelsTopLeft, StickyNote, Target, UserRound, UsersRound } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import type { FlowboardNode } from "@/features/flowboard/flowboard-types"
import { flowboardNodeLabels } from "@/features/flowboard/flowboard-types"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import type { CommercialProject } from "@/features/commercial/components/commercial-leads-provider"
import { ProjectStatusBadge } from "@/features/commercial/components/project-status-badge"
import { formatOperationalValue } from "@/features/commercial/commercial-formatters"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"

const icons = { project: FolderKanban, phase: PanelsTopLeft, activity: CheckSquare, lead: Target, customer: UsersRound, appointment: CalendarClock, deadline: Flag, person: CircleUserRound, milestone: Milestone, note: StickyNote, text: NotebookPen, link: Link2, container: PanelsTopLeft }

export function FlowboardNodeCard({ data, selected }: NodeProps<FlowboardNode>) {
  const store = useCommercialLeads(); const identity = useDoflowIdentity(); const Icon = icons[data.kind]
  let title = data.label; let status = data.status; let projectStatus: CommercialProject["status"] | undefined; let dueAt = data.dueAt; let assigneeId = data.assigneeId; let unavailable = false
  if (data.record) {
    if (data.record.type === "lead") { const record = store.leads.find((item) => item.id === data.record?.id); if (record) { title = `${record.firstName} ${record.lastName} · ${record.company}`; status = record.status; dueAt = record.nextActionAt; assigneeId = record.assigneeId } else unavailable = true }
    if (data.record.type === "customer") { const record = store.customers.find((item) => item.id === data.record?.id); if (record) { title = record.profile.company || `${record.profile.firstName} ${record.profile.lastName}`; status = record.status; assigneeId = record.profile.assigneeId } else unavailable = true }
    if (data.record.type === "project") { const record = store.projects.find((item) => item.id === data.record?.id); if (record) { title = record.name; status = record.status; projectStatus = record.status; dueAt = record.dueDate; assigneeId = record.ownerId } else unavailable = true }
    if (data.record.type === "activity" || data.record.type === "deadline") { const customer = store.customers.find((item) => [...(item.activities ?? []), ...(item.onboardingActivity ? [item.onboardingActivity] : [])].some((activity) => activity.id === data.record?.id)); const record = [...(customer?.activities ?? []), ...(customer?.onboardingActivity ? [customer.onboardingActivity] : [])].find((item) => item.id === data.record?.id) ?? store.leadActivities.find((item) => item.id === data.record?.id); if (record) { title = record.title; status = record.status; dueAt = record.dueAt; assigneeId = record.assigneeId } else unavailable = true }
    if (data.record.type === "appointment") { const record = store.appointments.find((item) => item.id === data.record?.id); if (record) { title = record.title; status = record.status; dueAt = record.startsAt; assigneeId = record.assigneeId } else unavailable = true }
    if (data.record.type === "person") { const record = identity.users.find((item) => item.id === data.record?.id); if (record) { title = record.name; status = record.roles.join(" · "); assigneeId = record.id } else unavailable = true }
  }
  if (unavailable) { title = "Record non disponibile"; status = "Archiviato o non autorizzato"; dueAt = undefined; assigneeId = undefined }
  const assignee = identity.users.find((item) => item.id === assigneeId)
  const container = data.kind === "container"
  return <div className={cn("group relative rounded-xl border bg-card text-card-foreground shadow-sm transition-shadow", selected && "ring-2 ring-primary", container ? "h-full min-h-48 w-full bg-muted/20 p-3" : "w-60 p-3", data.locked && "border-dashed")}>
    {container && <NodeResizer minWidth={220} minHeight={180} isVisible={selected && !data.locked} />}
    {!container && <><Handle type="target" position={Position.Left} className="!size-2.5 !border-2 !border-background" /><Handle type="source" position={Position.Right} className="!size-2.5 !border-2 !border-background" /></>}
    <div className="flex items-start gap-2"><div className="rounded-md bg-primary/10 p-1.5 text-primary"><Icon className="size-4" /></div><div className="min-w-0 flex-1"><p className={cn("font-medium", container ? "text-sm" : "line-clamp-2 text-sm")}>{title}</p><p className="text-[10px] uppercase tracking-wide text-muted-foreground">{flowboardNodeLabels[data.kind]}</p></div>{data.locked && <Badge variant="outline" className="h-5 px-1 text-[9px]">Bloccato</Badge>}</div>
    {!container && <div className="mt-3 flex flex-wrap items-center gap-1.5">{projectStatus ? <ProjectStatusBadge status={projectStatus} className="h-5 max-w-full truncate text-[10px]" /> : status && <Badge variant="secondary" className="h-5 max-w-full truncate text-[10px]" title={formatOperationalValue(status)}>{formatOperationalValue(status)}</Badge>}{data.priority && <Badge variant="outline" className="h-5 text-[10px]">{formatOperationalValue(data.priority)}</Badge>}{dueAt && <span className="text-[10px] text-muted-foreground">{new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short" }).format(new Date(dueAt))}</span>}</div>}
    {!container && assignee && <div className="mt-2 flex items-center gap-1.5 text-[11px] text-muted-foreground"><UserRound className="size-3" /><span className="truncate">{assignee.name}</span></div>}
    {data.description && !container && <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">{data.description}</p>}
  </div>
}
