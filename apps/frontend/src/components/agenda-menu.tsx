"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { addDays, differenceInMinutes, format, isSameDay, parseISO, startOfDay } from "date-fns"
import { it } from "date-fns/locale"
import { CalendarDays, Check, ChevronRight, Clock3, ExternalLink, Inbox, Phone, Plus, RotateCw } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CalendarAppointmentDialog } from "@/features/commercial/components/calendar-appointment-dialog"
import type { CommercialAppointment, CommercialProject, CustomerActivity } from "@/features/commercial/components/commercial-leads-provider"
import { ProjectStatusBadge } from "@/features/commercial/components/project-status-badge"
import { canManageActivity } from "@/features/identity/permissions"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { cn } from "@/lib/utils"

type AgendaKind = "activity" | "appointment" | "delivery" | "review" | "support"
type AgendaItem = {
  id: string
  title: string
  linkedLabel: string
  kind: AgendaKind
  start: string
  end?: string
  status: string
  priority?: string
  href: string
  phone?: string
  meetingUrl?: string
  activity?: CustomerActivity
  activityCustomerId?: string
  appointment?: CommercialAppointment
  projectStatus?: CommercialProject["status"]
  editable: boolean
}

const CLOSED = new Set(["Completata", "Annullata", "completed", "cancelled", "no_show", "Chiuso", "Annullato", "Consegnato"])
const KIND_LABEL: Record<AgendaKind, string> = { activity: "Attività", appointment: "Appuntamento", delivery: "Consegna", review: "Revisione", support: "Supporto" }
const KIND_STYLE: Record<AgendaKind, string> = { activity: "bg-violet-500/12 text-violet-700 dark:text-violet-300", appointment: "bg-sky-500/12 text-sky-700 dark:text-sky-300", delivery: "bg-indigo-500/12 text-indigo-700 dark:text-indigo-300", review: "bg-fuchsia-500/12 text-fuchsia-700 dark:text-fuchsia-300", support: "bg-red-500/12 text-red-700 dark:text-red-300" }
const meetingUrl = (notes?: string) => notes?.match(/https?:\/\/\S+/)?.[0]

function usePersonalAgendaItems() {
  const { store, identity, leads, projects, activities } = useAuthorizedCommercial()
  return useMemo(() => {
    const result: AgendaItem[] = []
    for (const { activity, customer } of activities) {
      const start = activity.dueAt || activity.startAt || activity.dueDate
      if (!start || activity.archivedAt || activity.assigneeId !== identity.currentUserId || CLOSED.has(activity.status)) continue
      const project = projects.find((item) => item.id === activity.projectId)
      const kind: AgendaKind = activity.type === "Consegna" ? "delivery" : activity.type === "QA/Test" || activity.type === "Approvazione cliente" ? "review" : "activity"
      result.push({ id: `activity:${activity.id}`, title: activity.title, linkedLabel: project?.name ?? customer.profile.company, kind, start, status: activity.status, priority: activity.priority, href: `/dashboard/attivita?activityId=${activity.id}`, activity, activityCustomerId: customer.id, editable: canManageActivity(identity.currentUser, activity, customer, project) })
    }
    for (const appointment of store.appointments) {
      const lead = leads.find((item) => item.id === appointment.leadId)
      if (!lead || appointment.archivedAt || appointment.assigneeId !== identity.currentUserId || CLOSED.has(appointment.status)) continue
      result.push({ id: `appointment:${appointment.id}`, title: appointment.title, linkedLabel: lead.company, kind: "appointment", start: appointment.startsAt, end: appointment.endsAt, status: appointment.status, href: `/dashboard/commercial/leads/${lead.id}`, phone: lead.phone, meetingUrl: meetingUrl(appointment.notes), appointment, editable: true })
    }
    for (const project of projects) {
      if (project.archivedAt || project.ownerId !== identity.currentUserId || CLOSED.has(project.status)) continue
      if (project.dueDate) result.push({ id: `project:${project.id}`, title: `Scadenza ${project.name}`, linkedLabel: project.name, kind: "delivery", start: project.dueDate, status: project.status, projectStatus: project.status, priority: project.priority, href: `/dashboard/progetti/${project.id}`, editable: false })
      for (const phase of project.phases) if (phase.dueDate && !CLOSED.has(phase.status)) result.push({ id: `phase:${project.id}:${phase.id}`, title: phase.name, linkedLabel: project.name, kind: phase.name.toLowerCase().includes("revision") || phase.name.toLowerCase().includes("qa") ? "review" : "delivery", start: phase.dueDate, status: phase.status, href: `/dashboard/progetti/${project.id}`, editable: false })
    }
    for (const ticket of store.supportTickets) if (!ticket.archivedAt && ticket.assigneeId === identity.currentUserId && ticket.dueAt && !CLOSED.has(ticket.status)) result.push({ id: `support:${ticket.id}`, title: ticket.title, linkedLabel: ticket.code, kind: "support", start: ticket.dueAt, status: ticket.status, priority: ticket.priority, href: `/dashboard/supporto?ticket=${ticket.id}`, editable: false })
    for (const approval of store.operationalApprovals) if (approval.requiredApproverId === identity.currentUserId && approval.requestedAt && approval.status === "In attesa approvazione") { const project = projects.find((item) => item.id === approval.objectId) ?? projects.find((item) => item.phases.some((phase) => phase.id === approval.objectId)); result.push({ id: `review:${approval.id}`, title: `Revisione ${project?.name ?? "lavoro operativo"}`, linkedLabel: project?.name ?? "Attività", kind: "review", start: approval.requestedAt, status: approval.status, priority: "Urgente", href: project ? `/dashboard/progetti/${project.id}` : "/dashboard/attivita", editable: false }) }
    return [...new Map(result.map((item) => [item.id, item])).values()].sort((left, right) => left.start.localeCompare(right.start))
  }, [activities, identity.currentUser, identity.currentUserId, leads, projects, store.appointments, store.operationalApprovals, store.supportTickets])
}

type AgendaMenuProps = { open?: boolean; onOpenChange?: (open: boolean) => void }

export function AgendaMenu({ open: controlledOpen, onOpenChange }: AgendaMenuProps) {
  const router = useRouter()
  const { store, identity, leads } = useAuthorizedCommercial()
  const items = usePersonalAgendaItems()
  const [internalOpen, setInternalOpen] = useState(false)
  const [appointmentOpen, setAppointmentOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = (value: boolean) => { if (controlledOpen === undefined) setInternalOpen(value); onOpenChange?.(value) }
  const now = new Date(); const today = startOfDay(now); const tomorrow = addDays(today, 1); const horizon = addDays(today, 14)
  const visible = items.filter((item) => parseISO(item.start) < horizon)
  const isOverdue = (item: AgendaItem) => item.start.length === 10 ? parseISO(item.start) < today : parseISO(item.end ?? item.start) < now
  const overdue = visible.filter(isOverdue)
  const todayItems = visible.filter((item) => isSameDay(parseISO(item.start), today) && !overdue.includes(item))
  const tomorrowItems = visible.filter((item) => isSameDay(parseISO(item.start), tomorrow))
  const nextItems = visible.filter((item) => parseISO(item.start) >= addDays(today, 2))
  const nextAppointment = visible.find((item) => item.kind === "appointment" && parseISO(item.start) >= now)
  const badgeItems = visible.filter((item) => isOverdue(item) || item.kind === "appointment" && parseISO(item.start) <= addDays(now, 1) || item.kind === "activity" && item.start.includes("T") && parseISO(item.start) <= addDays(now, 1) || (["delivery", "review"].includes(item.kind) && (item.priority === "Urgente" || parseISO(item.start) <= addDays(now, 3))))
  const alertBadge = badgeItems.some((item) => overdue.includes(item) || item.priority === "Urgente" || item.priority === "Critica")
  const subtitle = overdue.length ? `${overdue.length} ${overdue.length === 1 ? "impegno in ritardo" : "impegni in ritardo"}` : todayItems.length ? `${todayItems.length} ${todayItems.length === 1 ? "impegno" : "impegni"} oggi` : nextAppointment ? `Prossimo appuntamento ${isSameDay(parseISO(nextAppointment.start), tomorrow) ? "domani" : format(parseISO(nextAppointment.start), "d MMM", { locale: it })} alle ${format(parseISO(nextAppointment.start), "HH:mm")}` : "Nessun impegno imminente"

  const navigate = (href: string) => { setOpen(false); router.push(href) }
  const groups: Array<[string, AgendaItem[]]> = [["In ritardo", overdue], ["Oggi", todayItems], ["Domani", tomorrowItems], ["Prossimi", nextItems]]
  return <><Popover open={open} onOpenChange={setOpen}><Tooltip><TooltipTrigger asChild><PopoverTrigger asChild><Button variant="ghost" className="relative hidden h-9 shrink-0 items-center gap-1.5 px-2 sm:inline-flex" aria-label="Apri la tua agenda"><CalendarDays className="size-4 shrink-0" />{badgeItems.length > 0 && <span className={cn("inline-flex h-[18px] min-w-5 items-center justify-center rounded-full px-1.5 text-[10px] font-semibold leading-none text-white", alertBadge ? "bg-red-700/90" : "bg-violet-600")}>{badgeItems.length > 99 ? "99+" : badgeItems.length}</span>}</Button></PopoverTrigger></TooltipTrigger><TooltipContent>La tua agenda</TooltipContent></Tooltip>
    <PopoverContent align="end" sideOffset={8} className="w-[calc(100vw-24px)] max-w-[430px] overflow-hidden p-0"><div className="border-b p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h2 className="font-semibold">La tua agenda</h2><p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p></div><Select value={String(identity.agendaReminderMinutes)} onValueChange={(value) => identity.setAgendaReminderMinutes(Number(value) as 0 | 5 | 15 | 30 | 60)}><SelectTrigger aria-label="Promemoria appuntamenti" className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="5">5 min prima</SelectItem><SelectItem value="15">15 min prima</SelectItem><SelectItem value="30">30 min prima</SelectItem><SelectItem value="60">60 min prima</SelectItem><SelectItem value="0">Nessuno</SelectItem></SelectContent></Select></div></div>
      {visible.length ? <div className="max-h-[min(68vh,34rem)] overflow-y-auto p-2">{groups.map(([label, group]) => group.length ? <section key={label} className="mb-3 last:mb-0"><h3 className={cn("px-2 pb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", label === "In ritardo" && "text-red-600 dark:text-red-400")}>{label}</h3><div className="space-y-1">{group.map((item) => <AgendaRow key={item.id} item={item} overdue={overdue.includes(item)} highlighted={item.id === nextAppointment?.id} onOpen={() => navigate(item.href)} onCalendar={() => navigate(`/dashboard/calendario?scope=mine&date=${item.start.slice(0, 10)}&event=${encodeURIComponent(item.id)}`)} onComplete={item.activity && item.activityCustomerId && item.editable ? () => { if (store.setCustomerActivityStatus(item.activityCustomerId!, item.activity!.id, "Completata")) toast.success("Attività completata") } : undefined} />)}</div></section> : null)}</div> : <div className="flex flex-col items-center gap-2 px-4 py-10 text-center"><span className="grid size-10 place-items-center rounded-full bg-muted"><Inbox className="size-5 text-muted-foreground" /></span><p className="font-medium">Nessun impegno imminente</p><p className="text-xs text-muted-foreground">Puoi creare un appuntamento o aprire il calendario completo.</p></div>}
      <div className="grid grid-cols-2 gap-2 border-t p-2"><Button variant="ghost" onClick={() => navigate("/dashboard/calendario?scope=mine")}><CalendarDays />Apri calendario</Button><Button variant="outline" disabled={!leads.length} title={!leads.length ? "Nessun lead autorizzato disponibile" : undefined} onClick={() => { setOpen(false); setAppointmentOpen(true) }}><Plus />Crea appuntamento</Button></div>
    </PopoverContent></Popover><CalendarAppointmentDialog open={appointmentOpen} onOpenChange={setAppointmentOpen} /></>
}

function AgendaRow({ item, overdue, highlighted, onOpen, onCalendar, onComplete }: { item: AgendaItem; overdue: boolean; highlighted: boolean; onOpen: () => void; onCalendar: () => void; onComplete?: () => void }) {
  const duration = item.end ? Math.max(0, differenceInMinutes(parseISO(item.end), parseISO(item.start))) : undefined
  return <article className={cn("rounded-lg border p-2.5 transition-colors", highlighted && "border-violet-500/50 bg-violet-500/5", overdue && "border-red-500/40 bg-red-500/5")}><button type="button" className="flex w-full min-w-0 items-start gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onOpen}>{item.projectStatus ? <ProjectStatusBadge status={item.projectStatus} className="mt-0.5 h-5 px-1.5 text-[10px]" /> : <span className={cn("mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-medium", KIND_STYLE[item.kind])}>{KIND_LABEL[item.kind]}</span>}<span className="min-w-0 flex-1"><span className="line-clamp-2 text-sm font-medium">{item.title}</span><span className="mt-0.5 block truncate text-xs text-muted-foreground">{item.linkedLabel} · {item.start.length === 10 ? "Tutto il giorno" : format(parseISO(item.start), "HH:mm")}{duration ? ` · ${duration} min` : ""} · {item.status}</span></span><ChevronRight className="mt-1 size-3.5 shrink-0 text-muted-foreground" /></button><div className="mt-2 flex flex-wrap gap-1"><Button size="xs" variant="ghost" onClick={onCalendar}><CalendarDays />Calendario</Button>{onComplete && <Button size="xs" variant="ghost" onClick={onComplete}><Check />Completa</Button>}{item.phone && <Button size="xs" variant="ghost" asChild><a href={`tel:${item.phone}`}><Phone />Chiama</a></Button>}{item.meetingUrl && <Button size="xs" variant="ghost" asChild><a href={item.meetingUrl} target="_blank" rel="noreferrer"><ExternalLink />Riunione</a></Button>}{item.editable && <Button size="xs" variant="ghost" onClick={onCalendar}><RotateCw />Riprogramma</Button>}<span className="ml-auto inline-flex items-center gap-1 text-[10px] text-muted-foreground"><Clock3 className="size-3" />DoFlow</span></div></article>
}
