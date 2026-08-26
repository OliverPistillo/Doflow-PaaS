"use client"

import * as React from "react"
import { useRouter, useSearchParams } from "next/navigation"
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CirclePlus,
  Clock3,
  ExternalLink,
  FilterX,
  Loader2,
  Pencil,
  Search,
  Trash2,
} from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { useTenantAccess } from "@/contexts/TenantAccessContext"
import {
  EVENT_TYPE_LABELS,
  PRIORITY_LABELS,
  STATUS_LABELS,
  canManageCalendar,
  formatDateTime,
  label,
} from "@/components/tenant-calendar/calendar-utils"
import { calendarTone, calendarToneClasses } from "@/components/tenant-work/calendar-presentation"
import {
  addLocalDays,
  formatShortDate,
  formatTime,
  getMetadataText,
  isSameLocalDay,
  startOfLocalDay,
  startOfWeek,
  type WorkListResponse,
  type WorkMilestone,
  type WorkProject,
  type WorkTask,
} from "@/components/tenant-work/work-model"
import { apiFetch } from "@/lib/api"
import {
  calendarApi,
  type CalendarEvent,
  type CalendarOptions,
  type CalendarParams,
} from "@/lib/tenant-calendar-api"
import { teamApi, type TeamMember } from "@/lib/tenant-team-api"
import { cn } from "@/lib/utils"

type CalendarView = "month" | "week" | "day" | "agenda"
type CalendarCategory = "all" | "operations" | "projects" | "commercial" | "administration" | "documents"
type CalendarEditor = {
  eventId?: string
  title: string
  description: string
  eventType: string
  status: string
  priority: string
  date: string
  time: string
  duration: string
  allDay: boolean
  assigneeId: string
}

const VIEW_VALUES = new Set<CalendarView>(["month", "week", "day", "agenda"])
const CLOSED_STATUSES = new Set(["completed", "cancelled", "skipped"])
const MANUAL_EVENT_TYPES = ["internal", "meeting", "call", "focus_time", "unavailable", "reminder"]

const CATEGORY_DEFINITIONS: Array<{
  id: Exclude<CalendarCategory, "all">
  label: string
  types: string[]
}> = [
  { id: "operations", label: "Operatività", types: ["internal", "meeting", "call", "focus_time", "unavailable", "reminder"] },
  { id: "projects", label: "Progetti", types: ["task_due", "milestone_due", "project_deadline"] },
  { id: "commercial", label: "Commerciale", types: ["commercial_activity_due", "quote_followup"] },
  { id: "administration", label: "Amministrazione", types: ["invoice_due", "financial_deadline", "renewal_due", "recurring_service_due", "contract_due", "contract_signature", "contract_expiration"] },
  { id: "documents", label: "Documenti", types: ["paperwork_due", "paperwork_item_due", "briefing_due", "document_reminder"] },
]

function validDate(value?: string | null) {
  if (!value) return undefined
  const date = new Date(value.length === 10 ? `${value}T12:00:00` : value)
  return Number.isNaN(date.getTime()) ? undefined : date
}

function localDateInput(value?: string | Date | null) {
  const date = value instanceof Date ? value : validDate(value)
  if (!date) return ""
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`
}

function localTimeInput(value?: string | Date | null) {
  const date = value instanceof Date ? value : validDate(value)
  if (!date) return "09:00"
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

function monthStart(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), 1)
}

function addMonths(value: Date, amount: number) {
  const next = monthStart(value)
  next.setMonth(next.getMonth() + amount)
  return next
}

function rangeFor(view: CalendarView, anchor: Date) {
  if (view === "day") {
    const start = startOfLocalDay(anchor)
    return { start, end: addLocalDays(start, 1) }
  }
  if (view === "week") {
    const start = startOfWeek(anchor)
    return { start, end: addLocalDays(start, 7) }
  }
  if (view === "agenda") {
    const start = monthStart(anchor)
    return { start, end: addMonths(start, 1) }
  }
  const start = startOfWeek(monthStart(anchor))
  return { start, end: addLocalDays(start, 42) }
}

function calendarTitle(view: CalendarView, anchor: Date) {
  if (view === "day") {
    return new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long", year: "numeric" }).format(anchor)
  }
  if (view === "week") {
    const start = startOfWeek(anchor)
    const end = addLocalDays(start, 6)
    return `${formatShortDate(start)} – ${new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(end)}`
  }
  return new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric" }).format(anchor)
}

function categoryFor(event: CalendarEvent) {
  return CATEGORY_DEFINITIONS.find((category) => category.types.includes(event.event_type))?.id ?? "operations"
}

function isOverdue(event: CalendarEvent, now = new Date()) {
  const end = validDate(event.end_at || event.start_at)
  return Boolean(end && end < startOfLocalDay(now) && !CLOSED_STATUSES.has(event.status))
}

function canEditManualEvent(event: CalendarEvent) {
  return event.source_type === "manual" && !event.is_system_generated && !event.is_locked
}

type ProjectMilestone = WorkMilestone & { project_id: string }

function projectIdForEvent(event: CalendarEvent, tasks: WorkTask[], milestones: ProjectMilestone[]) {
  if (event.source_entity_type === "project") return event.source_entity_id || undefined
  if (event.source_entity_type === "task") return tasks.find((task) => task.id === event.source_entity_id)?.project_id
  if (event.source_entity_type === "milestone") return milestones.find((milestone) => milestone.id === event.source_entity_id)?.project_id
  return getMetadataText(event.metadata, "project_id", "projectId")
}

function linkedRecordHref(event: CalendarEvent, tasks: WorkTask[], milestones: ProjectMilestone[]) {
  const projectId = projectIdForEvent(event, tasks, milestones)
  if (projectId) return `/dashboard/progetti/${projectId}`
  const id = event.source_entity_id
  if (!id) return undefined
  if (event.source_entity_type === "lead" || event.source_entity_type === "opportunity") return `/dashboard/commercial/leads/${id}`
  if (event.source_entity_type === "quote") return `/dashboard/preventivi/${id}/anteprima`
  if (event.source_entity_type === "contract") return `/dashboard/contratti?contract=${id}`
  if (event.source_entity_type === "commercial_activity") return `/dashboard/attivita?activityId=${id}`
  if (["invoice", "payment", "deadline", "renewal", "recurring_service"].includes(String(event.source_entity_type))) return "/dashboard/pagamenti"
  if (["paperwork_dossier", "paperwork_item", "document", "briefing"].includes(String(event.source_entity_type))) return "/dashboard/documenti"
  return undefined
}

function editorFor(event?: CalendarEvent, date = new Date()): CalendarEditor {
  const start = validDate(event?.start_at) ?? date
  const end = validDate(event?.end_at)
  const duration = end ? Math.max(15, Math.round((end.getTime() - start.getTime()) / 60_000)) : 60
  return {
    eventId: event?.id,
    title: event?.title ?? "",
    description: event?.description ?? "",
    eventType: event?.event_type ?? "meeting",
    status: event?.status ?? "scheduled",
    priority: event?.priority ?? "medium",
    date: localDateInput(start),
    time: localTimeInput(start),
    duration: String(duration),
    allDay: Boolean(event?.all_day),
    assigneeId: event?.assigned_to_user_id || "unassigned",
  }
}

async function listCalendarRange(params: CalendarParams) {
  const items: CalendarEvent[] = []
  let offset = 0
  let total = 1
  while (offset < total && offset < 1_000) {
    const page = await calendarApi.listCalendarEvents({ ...params, limit: 200, offset })
    items.push(...(page.items || []))
    total = Number(page.total ?? items.length)
    if (!page.items?.length) break
    offset += page.items.length
  }
  return items
}

function EventBadge({ event, compact = false }: { event: CalendarEvent; compact?: boolean }) {
  const tone = calendarTone(event)
  return (
    <Badge variant="outline" className={cn("border", calendarToneClasses[tone].surface, compact && "text-[10px]")}>
      {label(EVENT_TYPE_LABELS, event.event_type)}
    </Badge>
  )
}

function EventButton({ event, selected, editable, onOpen }: { event: CalendarEvent; selected: boolean; editable: boolean; onOpen: () => void }) {
  const tone = calendarTone(event)
  return (
    <button
      type="button"
      draggable={editable}
      onDragStart={(drag) => {
        drag.dataTransfer.effectAllowed = "move"
        drag.dataTransfer.setData("text/calendar-event", event.id)
      }}
      onClick={(click) => {
        click.stopPropagation()
        onOpen()
      }}
      className={cn(
        "block w-full truncate rounded-md border px-2 py-1 text-left text-[11px] font-medium outline-none transition hover:brightness-[0.98] focus-visible:ring-2 focus-visible:ring-ring",
        calendarToneClasses[tone].surface,
        selected && "ring-2 ring-primary",
      )}
      title={`${event.title} · ${event.all_day ? "Tutto il giorno" : formatTime(event.start_at)}`}
    >
      {!event.all_day ? <span className="mr-1 font-semibold">{formatTime(event.start_at)}</span> : null}
      {event.title}
    </button>
  )
}

export function CommercialCalendarPage() {
  const params = useSearchParams()
  const router = useRouter()
  const access = useTenantAccess()
  const initialDate = validDate(params.get("date")) ?? new Date()
  const initialView = params.get("view") as CalendarView | null
  const [anchor, setAnchor] = React.useState(initialDate)
  const [view, setView] = React.useState<CalendarView>(initialView && VIEW_VALUES.has(initialView) ? initialView : "month")
  const [events, setEvents] = React.useState<CalendarEvent[]>([])
  const [deadlines, setDeadlines] = React.useState<CalendarEvent[]>([])
  const [options, setOptions] = React.useState<CalendarOptions>()
  const [projects, setProjects] = React.useState<WorkProject[]>([])
  const [tasks, setTasks] = React.useState<WorkTask[]>([])
  const [milestones, setMilestones] = React.useState<ProjectMilestone[]>([])
  const [members, setMembers] = React.useState<TeamMember[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [error, setError] = React.useState("")
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState<CalendarCategory>("all")
  const [eventType, setEventType] = React.useState("all")
  const [status, setStatus] = React.useState("all")
  const [priority, setPriority] = React.useState("all")
  const [assigneeId, setAssigneeId] = React.useState(params.get("assignee") || "all")
  const [projectId, setProjectId] = React.useState("all")
  const [overdueOnly, setOverdueOnly] = React.useState(false)
  const [openOnly, setOpenOnly] = React.useState(params.get("status") === "open")
  const [selectedId, setSelectedId] = React.useState<string | undefined>(params.get("event") || undefined)
  const [editor, setEditor] = React.useState<CalendarEditor>()

  const canCreate = access.canCreate("calendar") && canManageCalendar()
  const canUpdate = access.canUpdate("calendar") && canManageCalendar()
  const canDelete = access.canDelete("calendar") && canManageCalendar()

  React.useEffect(() => {
    let active = true
    Promise.allSettled([
      calendarApi.getCalendarOptions(),
      apiFetch<WorkListResponse<WorkProject>>("/tenant/projects?limit=100"),
      apiFetch<WorkListResponse<WorkTask>>("/tenant/projects/tasks?limit=200"),
      access.canView("team") ? teamApi.members({ limit: 200 }) : Promise.resolve({ items: [] as TeamMember[] }),
    ]).then((results) => {
      if (!active) return
      if (results[0].status === "fulfilled") setOptions(results[0].value)
      if (results[1].status === "fulfilled") {
        const nextProjects = results[1].value.items || []
        setProjects(nextProjects)
        void Promise.all(nextProjects.map(async (project) => {
          try {
            const data = await apiFetch<WorkListResponse<WorkMilestone>>(`/tenant/projects/${project.id}/milestones`)
            return (data.items || []).map((milestone) => ({ ...milestone, project_id: project.id }))
          } catch {
            return []
          }
        })).then((rows) => { if (active) setMilestones(rows.flat()) })
      }
      if (results[2].status === "fulfilled") setTasks(results[2].value.items || [])
      if (results[3].status === "fulfilled") setMembers(results[3].value.items || [])
    })
    return () => { active = false }
  }, [access])

  React.useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError("")
      const range = rangeFor(view, anchor)
      try {
        const [nextEvents, nextDeadlines] = await Promise.all([
          listCalendarRange({ start: range.start.toISOString(), end: range.end.toISOString(), include_cancelled: true }),
          calendarApi.getCalendarDeadlines({
            start: startOfLocalDay(new Date()).toISOString(),
            end: addLocalDays(startOfLocalDay(new Date()), 60).toISOString(),
            limit: 200,
          }),
        ])
        if (!active) return
        setEvents(nextEvents)
        setDeadlines(nextDeadlines.items || [])
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Calendario non disponibile.")
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [anchor, refreshKey, view])

  const selectedEvent = React.useMemo(() => events.find((event) => event.id === selectedId), [events, selectedId])

  const filtered = React.useMemo(() => events.filter((event) => {
    const search = query.trim().toLowerCase()
    if (search && !`${event.title} ${event.description || ""} ${label(EVENT_TYPE_LABELS, event.event_type)}`.toLowerCase().includes(search)) return false
    if (category !== "all" && categoryFor(event) !== category) return false
    if (eventType !== "all" && event.event_type !== eventType) return false
    if (status !== "all" && event.status !== status) return false
    if (priority !== "all" && event.priority !== priority) return false
    if (assigneeId !== "all" && event.assigned_to_user_id !== assigneeId) return false
    if (projectId !== "all" && projectIdForEvent(event, tasks, milestones) !== projectId) return false
    if (overdueOnly && !isOverdue(event)) return false
    if (openOnly && CLOSED_STATUSES.has(event.status)) return false
    return true
  }), [assigneeId, category, eventType, events, milestones, openOnly, overdueOnly, priority, projectId, query, status, tasks])

  const visibleDeadlines = React.useMemo(() => deadlines
    .filter((event) => assigneeId === "all" || event.assigned_to_user_id === assigneeId)
    .filter((event) => projectId === "all" || projectIdForEvent(event, tasks, milestones) === projectId)
    .sort((left, right) => left.start_at.localeCompare(right.start_at))
    .slice(0, 10), [assigneeId, deadlines, milestones, projectId, tasks])

  const updateUrl = React.useCallback((next: { view?: CalendarView; date?: Date; eventId?: string | null }) => {
    const search = new URLSearchParams(params.toString())
    if (next.view) search.set("view", next.view)
    if (next.date) search.set("date", localDateInput(next.date))
    if (next.eventId === null) search.delete("event")
    else if (next.eventId) search.set("event", next.eventId)
    router.replace(`/dashboard/calendario?${search.toString()}`, { scroll: false })
  }, [params, router])

  const selectEvent = (event: CalendarEvent) => {
    setSelectedId(event.id)
    updateUrl({ eventId: event.id })
  }

  const closeEvent = () => {
    setSelectedId(undefined)
    updateUrl({ eventId: null })
  }

  const changeView = (next: CalendarView) => {
    setView(next)
    updateUrl({ view: next, date: anchor })
  }

  const moveAnchor = (direction: -1 | 1) => {
    const next = view === "month" || view === "agenda"
      ? addMonths(anchor, direction)
      : addLocalDays(anchor, direction * (view === "week" ? 7 : 1))
    setAnchor(next)
    updateUrl({ date: next, view })
  }

  const openDay = (day: Date) => {
    setAnchor(day)
    setView("day")
    setSelectedId(undefined)
    updateUrl({ date: day, view: "day", eventId: null })
  }

  const resetFilters = () => {
    setQuery("")
    setCategory("all")
    setEventType("all")
    setStatus("all")
    setPriority("all")
    setAssigneeId("all")
    setProjectId("all")
    setOverdueOnly(false)
    setOpenOnly(false)
  }

  const refresh = () => setRefreshKey((value) => value + 1)

  const saveEditor = async () => {
    if (!editor?.title.trim() || !editor.date || saving) return
    setSaving(true)
    try {
      const start = new Date(`${editor.date}T${editor.allDay ? "00:00" : editor.time}:00`)
      if (Number.isNaN(start.getTime())) throw new Error("Data evento non valida")
      const duration = Math.max(15, Number(editor.duration) || 60)
      const body = {
        title: editor.title.trim(),
        description: editor.description.trim() || null,
        event_type: editor.eventType,
        status: editor.status,
        priority: editor.priority,
        start_at: start.toISOString(),
        end_at: editor.allDay ? null : new Date(start.getTime() + duration * 60_000).toISOString(),
        all_day: editor.allDay,
        assigned_to_user_id: editor.assigneeId === "unassigned" ? "" : editor.assigneeId,
        visibility: "team",
        transparency: "busy",
        source_type: "manual",
        is_system_generated: false,
        is_locked: false,
      }
      if (editor.eventId) await calendarApi.updateCalendarEvent(editor.eventId, body)
      else await calendarApi.createCalendarEvent(body)
      toast.success(editor.eventId ? "Evento aggiornato" : "Evento creato")
      setEditor(undefined)
      refresh()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Evento non salvato")
    } finally {
      setSaving(false)
    }
  }

  const reschedule = async (event: CalendarEvent, day: string) => {
    if (!canUpdate || !canEditManualEvent(event)) return
    const currentStart = validDate(event.start_at)
    if (!currentStart) return
    const nextStart = new Date(`${day}T${localTimeInput(currentStart)}:00`)
    const currentEnd = validDate(event.end_at)
    const duration = currentEnd ? currentEnd.getTime() - currentStart.getTime() : 60 * 60_000
    try {
      await calendarApi.updateCalendarEvent(event.id, {
        start_at: nextStart.toISOString(),
        end_at: event.all_day ? null : new Date(nextStart.getTime() + duration).toISOString(),
      })
      toast.success("Evento riprogrammato")
      refresh()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Riprogrammazione non riuscita")
    }
  }

  const complete = async (event: CalendarEvent) => {
    if (!canUpdate || !canEditManualEvent(event)) return
    try {
      await calendarApi.completeCalendarEvent(event.id)
      toast.success("Evento completato")
      refresh()
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Evento non completato")
    }
  }

  const remove = async (event: CalendarEvent) => {
    if (!canDelete || !canEditManualEvent(event) || !window.confirm(`Eliminare “${event.title}”?`)) return
    try {
      await calendarApi.deleteCalendarEvent(event.id)
      closeEvent()
      refresh()
      toast.success("Evento eliminato")
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Evento non eliminato")
    }
  }

  const dropOnDay = (drop: React.DragEvent, day: Date) => {
    drop.preventDefault()
    const event = events.find((item) => item.id === drop.dataTransfer.getData("text/calendar-event"))
    if (event) void reschedule(event, localDateInput(day))
  }

  const renderDayColumn = (day: Date, monthMode = false) => {
    const dayEvents = filtered.filter((event) => {
      const start = validDate(event.start_at)
      return start && isSameLocalDay(start, day)
    })
    const visible = monthMode ? dayEvents.slice(0, 4) : dayEvents
    return (
      <section
        key={day.toISOString()}
        onDragOver={(drag) => { if (canUpdate) drag.preventDefault() }}
        onDrop={(drop) => dropOnDay(drop, day)}
        className={cn(
          "min-w-0 border-b border-l border-border p-2",
          monthMode ? "min-h-32" : "min-h-80",
          monthMode && day.getMonth() !== anchor.getMonth() && "bg-muted/30 text-muted-foreground",
          isSameLocalDay(day, new Date()) && "bg-primary/5",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-1">
          <button type="button" className="text-xs font-semibold hover:text-primary" onClick={() => openDay(day)}>
            {monthMode ? day.getDate() : new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit", month: "short" }).format(day)}
          </button>
          {canCreate ? (
            <button type="button" className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={`Crea evento il ${localDateInput(day)}`} onClick={() => setEditor(editorFor(undefined, day))}>
              <CirclePlus className="size-3.5" />
            </button>
          ) : null}
        </div>
        <div className="space-y-1.5">
          {visible.map((event) => <EventButton key={event.id} event={event} selected={selectedId === event.id} editable={canUpdate && canEditManualEvent(event)} onOpen={() => selectEvent(event)} />)}
          {dayEvents.length > visible.length ? <button type="button" className="px-1 text-[10px] text-muted-foreground hover:text-foreground" onClick={() => openDay(day)}>+{dayEvents.length - visible.length} altri</button> : null}
        </div>
      </section>
    )
  }

  const monthDays = React.useMemo(() => Array.from({ length: 42 }, (_, index) => addLocalDays(startOfWeek(monthStart(anchor)), index)), [anchor])
  const weekDays = React.useMemo(() => Array.from({ length: 7 }, (_, index) => addLocalDays(startOfWeek(anchor), index)), [anchor])
  const agendaGroups = React.useMemo(() => {
    const groups = new Map<string, CalendarEvent[]>()
    filtered.forEach((event) => {
      const key = localDateInput(event.start_at)
      groups.set(key, [...(groups.get(key) || []), event])
    })
    return Array.from(groups.entries()).sort(([left], [right]) => left.localeCompare(right))
  }, [filtered])

  return (
    <main className="w-full space-y-5 p-4 md:p-6" data-calendar-source="server" data-calendar-views="month week day agenda">
      <header className="flex flex-col gap-3 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><CalendarDays className="size-6 text-primary" />Calendario operativo</h1>
          <p className="mt-1 text-sm text-muted-foreground">Eventi e scadenze autorizzati dal backend del tenant. I record derivati restano in sola lettura.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Tabs value={view} onValueChange={(value) => changeView(value as CalendarView)}>
            <TabsList aria-label="Vista calendario" className="max-w-full overflow-x-auto">
              <TabsTrigger value="month">Mese</TabsTrigger>
              <TabsTrigger value="week">Settimana</TabsTrigger>
              <TabsTrigger value="day">Giorno</TabsTrigger>
              <TabsTrigger value="agenda">Agenda</TabsTrigger>
            </TabsList>
          </Tabs>
          {canCreate ? <Button type="button" onClick={() => setEditor(editorFor(undefined, anchor))}><CirclePlus />Nuovo evento</Button> : null}
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5" aria-label="Riepilogo calendario">
        {[
          { label: "Nel periodo", value: events.length, action: () => { setCategory("all"); setOverdueOnly(false); setOpenOnly(false) } },
          { label: "Aperti", value: events.filter((event) => !CLOSED_STATUSES.has(event.status)).length, action: () => setOpenOnly(true) },
          { label: "Scaduti", value: events.filter((event) => isOverdue(event)).length, action: () => setOverdueOnly(true) },
          { label: "Commerciale", value: events.filter((event) => categoryFor(event) === "commercial").length, action: () => setCategory("commercial") },
          { label: "Prossime scadenze", value: deadlines.length, action: () => changeView("agenda") },
        ].map((item) => (
          <button key={item.label} type="button" onClick={item.action} className="rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-muted/20">
            <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
            <span className="mt-1 block text-2xl font-semibold tabular-nums">{item.value}</span>
          </button>
        ))}
      </section>

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">Filtri</CardTitle><CardDescription>Ricerca e restringi la vista senza modificare i record.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
          <Label className="relative sm:col-span-2"><span className="sr-only">Cerca</span><Search className="absolute left-3 top-3 size-4 text-muted-foreground" /><Input className="pl-9" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca titolo o descrizione" /></Label>
          <FilterSelect label="Categoria" value={category} onChange={(value) => setCategory(value as CalendarCategory)} options={[{ value: "all", label: "Tutte le categorie" }, ...CATEGORY_DEFINITIONS.map((item) => ({ value: item.id, label: item.label }))]} />
          <FilterSelect label="Tipo evento" value={eventType} onChange={setEventType} options={[{ value: "all", label: "Tutti i tipi" }, ...(options?.event_types || []).map((value) => ({ value, label: label(EVENT_TYPE_LABELS, value) }))]} />
          <FilterSelect label="Stato" value={status} onChange={setStatus} options={[{ value: "all", label: "Tutti gli stati" }, ...(options?.statuses || []).map((value) => ({ value, label: label(STATUS_LABELS, value) }))]} />
          <FilterSelect label="Priorità" value={priority} onChange={setPriority} options={[{ value: "all", label: "Tutte le priorità" }, ...(options?.priorities || []).map((value) => ({ value, label: label(PRIORITY_LABELS, value) }))]} />
          <FilterSelect label="Responsabile" value={assigneeId} onChange={setAssigneeId} options={[{ value: "all", label: "Tutto il team" }, ...members.filter((member) => member.user_id).map((member) => ({ value: String(member.user_id), label: member.display_name || member.email }))]} />
          <FilterSelect label="Progetto" value={projectId} onChange={setProjectId} options={[{ value: "all", label: "Tutti i progetti" }, ...projects.map((project) => ({ value: project.id, label: project.name }))]} />
          <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-4">
            <Button type="button" size="sm" variant={openOnly ? "default" : "outline"} onClick={() => setOpenOnly((value) => !value)}>Solo aperti</Button>
            <Button type="button" size="sm" variant={overdueOnly ? "destructive" : "outline"} onClick={() => setOverdueOnly((value) => !value)}><AlertTriangle />Solo scaduti</Button>
            <Button type="button" size="sm" variant="ghost" onClick={resetFilters}><FilterX />Azzera filtri</Button>
          </div>
        </CardContent>
      </Card>

      {error ? <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p> : null}

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-4">
          <Button type="button" variant="outline" onClick={() => { const today = new Date(); setAnchor(today); updateUrl({ date: today, view }) }}>Oggi</Button>
          <Button type="button" size="icon" variant="outline" onClick={() => moveAnchor(-1)} aria-label="Periodo precedente"><ChevronLeft /></Button>
          <Button type="button" size="icon" variant="outline" onClick={() => moveAnchor(1)} aria-label="Periodo successivo"><ChevronRight /></Button>
          <p className="min-w-0 flex-1 text-base font-semibold capitalize">{calendarTitle(view, anchor)}</p>
          <Button type="button" variant="ghost" onClick={refresh} disabled={loading}>{loading ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : null}Aggiorna</Button>
          <Badge variant="outline">{filtered.length} eventi</Badge>
        </div>

        {loading ? <div className="grid min-h-80 place-items-center text-sm text-muted-foreground"><Loader2 className="mb-2 size-6 animate-spin motion-reduce:animate-none" />Caricamento calendario…</div> : null}
        {!loading && view === "month" ? (
          <div className="overflow-x-auto"><div className="min-w-[840px]"><div className="grid grid-cols-7 border-b">{weekDays.map((day) => <div key={day.toISOString()} className="border-l px-3 py-2 text-center text-xs font-semibold uppercase text-muted-foreground first:border-l-0">{new Intl.DateTimeFormat("it-IT", { weekday: "short" }).format(day)}</div>)}</div><div className="grid grid-cols-7">{monthDays.map((day) => renderDayColumn(day, true))}</div></div></div>
        ) : null}
        {!loading && view === "week" ? <div className="grid min-w-0 gap-0 sm:grid-cols-2 xl:grid-cols-7">{weekDays.map((day) => renderDayColumn(day))}</div> : null}
        {!loading && view === "day" ? <div className="p-3">{renderDayColumn(anchor)}</div> : null}
        {!loading && view === "agenda" ? (
          <div className="space-y-5 p-3 sm:p-5">
            {agendaGroups.map(([day, items]) => <section key={day}><h2 className="mb-2 border-b pb-2 text-sm font-semibold capitalize">{new Intl.DateTimeFormat("it-IT", { weekday: "long", day: "2-digit", month: "long" }).format(new Date(`${day}T12:00:00`))}</h2><div className="space-y-2">{items.map((event) => <AgendaRow key={event.id} event={event} selected={selectedId === event.id} editable={canUpdate && canEditManualEvent(event)} onOpen={() => selectEvent(event)} onReschedule={(date) => void reschedule(event, date)} />)}</div></section>)}
            {!agendaGroups.length ? <p className="py-12 text-center text-sm text-muted-foreground">Nessun impegno con i filtri correnti.</p> : null}
          </div>
        ) : null}
      </section>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-base"><Clock3 className="size-4" />Prossime scadenze</CardTitle><CardDescription>Aggregazione backend di task, progetti, amministrazione, contratti e documenti autorizzati.</CardDescription></CardHeader>
        <CardContent className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
          {visibleDeadlines.map((event) => <button key={event.id} type="button" className="flex min-w-0 items-start gap-3 rounded-xl border p-3 text-left hover:bg-muted/30" onClick={() => { setAnchor(validDate(event.start_at) || anchor); setView("agenda"); setSelectedId(event.id); updateUrl({ date: validDate(event.start_at), view: "agenda", eventId: event.id }) }}><Badge variant="outline" className="shrink-0 tabular-nums">{formatShortDate(event.start_at)}</Badge><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{event.title}</span><span className="mt-1 block text-xs text-muted-foreground">{label(EVENT_TYPE_LABELS, event.event_type)}</span></span></button>)}
          {!visibleDeadlines.length ? <p className="col-span-full rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">Nessuna scadenza imminente.</p> : null}
        </CardContent>
      </Card>

      <CalendarEventSheet
        event={selectedEvent}
        tasks={tasks}
        milestones={milestones}
        canUpdate={canUpdate}
        canDelete={canDelete}
        onClose={closeEvent}
        onEdit={(event) => setEditor(editorFor(event))}
        onComplete={(event) => void complete(event)}
        onDelete={(event) => void remove(event)}
      />

      <CalendarEventDialog
        editor={editor}
        setEditor={setEditor}
        options={options}
        members={members}
        saving={saving}
        onSave={() => void saveEditor()}
      />
    </main>
  )
}

function FilterSelect({ label: ariaLabel, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: Array<{ value: string; label: string }> }) {
  return <Select value={value} onValueChange={onChange}><SelectTrigger aria-label={ariaLabel}><SelectValue /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select>
}

function AgendaRow({ event, selected, editable, onOpen, onReschedule }: { event: CalendarEvent; selected: boolean; editable: boolean; onOpen: () => void; onReschedule: (date: string) => void }) {
  return (
    <div className={cn("flex flex-wrap items-center gap-2 rounded-xl border p-3", selected && "ring-2 ring-primary")}>
      <button type="button" className="min-w-0 flex-1 text-left" onClick={onOpen}>
        <span className="flex flex-wrap items-center gap-2"><span className="font-medium">{event.title}</span><EventBadge event={event} compact /><Badge variant="secondary">{label(STATUS_LABELS, event.status)}</Badge></span>
        <span className="mt-1 block text-xs text-muted-foreground">{event.all_day ? "Tutto il giorno" : formatDateTime(event.start_at)}{event.end_at ? ` – ${formatTime(event.end_at)}` : ""}</span>
      </button>
      {editable ? <Label><span className="sr-only">Riprogramma {event.title}</span><Input aria-label={`Riprogramma ${event.title}`} className="h-9 w-40" type="date" value={localDateInput(event.start_at)} onChange={(change) => onReschedule(change.target.value)} /></Label> : <Badge variant="outline">Sola lettura</Badge>}
    </div>
  )
}

function CalendarEventSheet({ event, tasks, milestones, canUpdate, canDelete, onClose, onEdit, onComplete, onDelete }: { event?: CalendarEvent; tasks: WorkTask[]; milestones: ProjectMilestone[]; canUpdate: boolean; canDelete: boolean; onClose: () => void; onEdit: (event: CalendarEvent) => void; onComplete: (event: CalendarEvent) => void; onDelete: (event: CalendarEvent) => void }) {
  const editable = Boolean(event && canEditManualEvent(event))
  const href = event ? linkedRecordHref(event, tasks, milestones) : undefined
  return (
    <Sheet open={Boolean(event)} onOpenChange={(open) => { if (!open) onClose() }}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        {event ? <><SheetHeader className="text-left"><div className="flex flex-wrap gap-2"><EventBadge event={event} /><Badge variant="secondary">{label(STATUS_LABELS, event.status)}</Badge><Badge variant="outline">{label(PRIORITY_LABELS, event.priority)}</Badge></div><SheetTitle>{event.title}</SheetTitle><SheetDescription>{event.description || "Nessuna descrizione."}</SheetDescription></SheetHeader><div className="mt-5 space-y-5"><section className="grid gap-3 rounded-xl border p-4 text-sm sm:grid-cols-2"><Detail label="Inizio" value={event.all_day ? `${formatShortDate(event.start_at)} · tutto il giorno` : formatDateTime(event.start_at)} /><Detail label="Fine" value={event.end_at ? formatDateTime(event.end_at) : "Non definita"} /><Detail label="Origine" value={event.source_type === "manual" ? "Evento manuale" : "Record operativo derivato"} /><Detail label="Visibilità" value={event.visibility || "team"} /><Detail label="Responsabile" value={event.assigned_to_user_id || "Non assegnato"} /><Detail label="Categoria" value={CATEGORY_DEFINITIONS.find((item) => item.id === categoryFor(event))?.label || "Operatività"} /></section>{!editable ? <p className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm text-muted-foreground">Questo evento è derivato da un record operativo: modifiche e completamento vanno eseguiti nel record sorgente.</p> : null}<div className="flex flex-wrap gap-2">{editable && canUpdate ? <Button type="button" onClick={() => onEdit(event)}><Pencil />Modifica</Button> : null}{editable && canUpdate && !CLOSED_STATUSES.has(event.status) ? <Button type="button" variant="outline" onClick={() => onComplete(event)}><CheckCircle2 />Completa</Button> : null}{href ? <Button asChild type="button" variant="outline"><a href={href}><ExternalLink />Apri record</a></Button> : null}{editable && canDelete ? <Button type="button" variant="destructive" onClick={() => onDelete(event)}><Trash2 />Elimina</Button> : null}</div></div></> : null}
      </SheetContent>
    </Sheet>
  )
}

function Detail({ label: detailLabel, value }: { label: string; value: string }) {
  return <div className="min-w-0"><p className="text-xs text-muted-foreground">{detailLabel}</p><p className="break-words font-medium">{value}</p></div>
}

function CalendarEventDialog({ editor, setEditor, options, members, saving, onSave }: { editor?: CalendarEditor; setEditor: React.Dispatch<React.SetStateAction<CalendarEditor | undefined>>; options?: CalendarOptions; members: TeamMember[]; saving: boolean; onSave: () => void }) {
  const update = (patch: Partial<CalendarEditor>) => setEditor((current) => current ? { ...current, ...patch } : current)
  const allowedTypes = (options?.event_types || MANUAL_EVENT_TYPES).filter((value) => MANUAL_EVENT_TYPES.includes(value))
  return (
    <Dialog open={Boolean(editor)} onOpenChange={(open) => { if (!open) setEditor(undefined) }}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-xl">
        {editor ? <><DialogHeader><DialogTitle>{editor.eventId ? "Modifica evento" : "Nuovo evento"}</DialogTitle><DialogDescription>Il salvataggio usa il calendario Nest tenant-scoped; identità e tenant non provengono dal form.</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-2"><Label className="sm:col-span-2">Titolo<Input aria-label="Titolo evento" value={editor.title} onChange={(event) => update({ title: event.target.value })} /></Label><Label className="sm:col-span-2">Descrizione<Textarea aria-label="Descrizione evento" value={editor.description} onChange={(event) => update({ description: event.target.value })} /></Label><Label>Tipo<Select value={editor.eventType} onValueChange={(value) => update({ eventType: value })}><SelectTrigger aria-label="Tipo evento"><SelectValue /></SelectTrigger><SelectContent>{allowedTypes.map((value) => <SelectItem key={value} value={value}>{label(EVENT_TYPE_LABELS, value)}</SelectItem>)}</SelectContent></Select></Label><Label>Priorità<Select value={editor.priority} onValueChange={(value) => update({ priority: value })}><SelectTrigger aria-label="Priorità evento"><SelectValue /></SelectTrigger><SelectContent>{(options?.priorities || ["low", "medium", "high", "urgent"]).map((value) => <SelectItem key={value} value={value}>{label(PRIORITY_LABELS, value)}</SelectItem>)}</SelectContent></Select></Label><Label>Data<Input aria-label="Data evento" type="date" value={editor.date} onChange={(event) => update({ date: event.target.value })} /></Label><Label>Ora<Input aria-label="Ora evento" type="time" value={editor.time} disabled={editor.allDay} onChange={(event) => update({ time: event.target.value })} /></Label><Label>Durata<Select value={editor.duration} disabled={editor.allDay} onValueChange={(value) => update({ duration: value })}><SelectTrigger aria-label="Durata evento"><SelectValue /></SelectTrigger><SelectContent>{[30, 60, 90, 120].map((minutes) => <SelectItem key={minutes} value={String(minutes)}>{minutes < 120 ? `${minutes} minuti` : "2 ore"}</SelectItem>)}</SelectContent></Select></Label><Label>Responsabile<Select value={editor.assigneeId} onValueChange={(value) => update({ assigneeId: value })}><SelectTrigger aria-label="Responsabile evento"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="unassigned">Non assegnato</SelectItem>{members.filter((member) => member.user_id).map((member) => <SelectItem key={member.id} value={String(member.user_id)}>{member.display_name || member.email}</SelectItem>)}</SelectContent></Select></Label><Label className="flex items-center gap-2 rounded-lg border p-3 sm:col-span-2"><input type="checkbox" checked={editor.allDay} onChange={(event) => update({ allDay: event.target.checked })} />Tutto il giorno</Label></div><DialogFooter><Button type="button" variant="outline" onClick={() => setEditor(undefined)}>Annulla</Button><Button type="button" disabled={saving || !editor.title.trim() || !editor.date} onClick={onSave}>{saving ? <Loader2 className="animate-spin motion-reduce:animate-none" /> : null}Salva</Button></DialogFooter></> : null}
      </DialogContent>
    </Dialog>
  )
}
