"use client"
/* eslint-disable react-hooks/refs -- dnd-kit espone callback ref e stato di trascinamento da applicare durante il render. */

import { useState } from "react"
import { DndContext, DragOverlay, KeyboardSensor, PointerSensor, TouchSensor, closestCenter, useDroppable, useSensor, useSensors, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core"
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { GripVertical } from "lucide-react"
import { toast } from "sonner"

import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { customerActivityStatuses, type CommercialCustomer, type CustomerActivity } from "@/features/commercial/components/commercial-leads-provider"
import { useCommercialTeam } from "@/features/commercial/use-commercial-team"
import { canManageActivity } from "@/features/identity/permissions"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"

type ActivityRow = { activity: CustomerActivity; customer: CommercialCustomer }

function SortableCard({ row, onOpen, onMove }: { row: ActivityRow; onOpen: () => void; onMove: (status: CustomerActivity["status"]) => void }) {
  const commercialTeam = useCommercialTeam()
  const { identity, projects } = useAuthorizedCommercial(); const project = projects.find((item) => item.id === row.activity.projectId); const manageable = canManageActivity(identity.currentUser, row.activity, row.customer, project)
  const sortable = useSortable({ id: row.activity.id, disabled: !manageable, data: { status: row.activity.status } })
  const owner = commercialTeam.find((item) => item.id === row.activity.assigneeId)?.name ?? row.activity.assigneeId
  return <article ref={sortable.setNodeRef} style={{ transform: CSS.Transform.toString(sortable.transform), transition: sortable.transition }} className={`min-w-0 overflow-hidden rounded-lg border bg-card p-3 shadow-sm transition-shadow ${sortable.isDragging ? "opacity-40 shadow-lg" : ""}`}>
    <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-2"><button type="button" className="touch-none shrink-0 cursor-grab rounded-md border bg-muted/50 p-1 text-muted-foreground active:cursor-grabbing disabled:cursor-not-allowed" aria-label={`Trascina ${row.activity.title}`} title="Trascina per spostare" disabled={!manageable} {...sortable.attributes} {...sortable.listeners}><GripVertical className="size-4" /></button><button type="button" className="min-w-0 text-left" onClick={onOpen}><span className="line-clamp-2 break-words font-medium leading-5">{row.activity.title}</span><span className="mt-1 block truncate text-xs text-muted-foreground">{row.customer.profile.company} · {owner}</span></button><Badge variant={row.activity.priority === "Urgente" ? "destructive" : "secondary"} className="max-w-20 shrink-0 truncate">{row.activity.priority}</Badge></div>
    <div className="mt-2 flex min-w-0 flex-wrap items-center justify-between gap-2">{row.activity.workStatus ? <Badge variant="outline" className="max-w-full truncate">{row.activity.workStatus}</Badge> : <span />}<Select value={row.activity.status} disabled={!manageable} onValueChange={(value) => onMove(value as CustomerActivity["status"])}><SelectTrigger className="h-7 w-[8.75rem] max-w-full text-xs" aria-label={`Sposta ${row.activity.title} in`} title="Sposta in un altro stato"><SelectValue /></SelectTrigger><SelectContent>{customerActivityStatuses.map((status) => <SelectItem key={status} value={status}>Sposta in {status}</SelectItem>)}</SelectContent></Select></div>
  </article>
}

function Column({ status, rows, onOpen, onMove }: { status: CustomerActivity["status"]; rows: ActivityRow[]; onOpen: (id: string) => void; onMove: (row: ActivityRow, status: CustomerActivity["status"], beforeId?: string) => void }) {
  const drop = useDroppable({ id: `column:${status}`, data: { status } })
  return <section ref={drop.setNodeRef} className={`min-h-44 min-w-0 overflow-hidden rounded-xl border p-2 transition-colors ${drop.isOver ? "border-primary bg-primary/10" : "bg-muted/30"}`}><div className="mb-2 flex min-w-0 items-center justify-between gap-2"><h3 className="min-w-0 truncate text-sm font-medium" title={status}>{status}</h3><Badge variant="secondary" className="shrink-0">{rows.length}</Badge></div><SortableContext items={rows.map((row) => row.activity.id)} strategy={verticalListSortingStrategy}><div className="min-w-0 space-y-2">{rows.map((row) => <SortableCard key={row.activity.id} row={row} onOpen={() => onOpen(row.activity.id)} onMove={(next) => onMove(row, next)} />)}{!rows.length && <div className="grid min-h-24 place-items-center rounded-lg border border-dashed px-2 text-center text-xs text-muted-foreground">Rilascia qui</div>}</div></SortableContext></section>
}

export function ActivityKanbanBoard({ rows, onOpen }: { rows: ActivityRow[]; onOpen: (id: string) => void }) {
  const { store } = useAuthorizedCommercial(); const [activeId, setActiveId] = useState<string>(); const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(TouchSensor, { activationConstraint: { delay: 220, tolerance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }))
  const sortedFor = (status: CustomerActivity["status"]) => rows.filter((row) => row.activity.status === status).sort((left, right) => (left.activity.kanbanOrder ?? 0) - (right.activity.kanbanOrder ?? 0) || left.activity.id.localeCompare(right.activity.id))
  const move = async (row: ActivityRow, status: CustomerActivity["status"], beforeId?: string) => { const target = sortedFor(status).filter((item) => item.activity.id !== row.activity.id); const index = beforeId ? Math.max(0, target.findIndex((item) => item.activity.id === beforeId)) : target.length; target.splice(index < 0 ? target.length : index, 0, row); const accepted = await store.moveCustomerActivity(row.customer.id, row.activity.id, status, target.map((item) => item.activity.id)); if (accepted) toast.success(row.activity.status === status ? "Ordine attività aggiornato" : `Attività spostata in ${status}`) }
  const dragStart = (event: DragStartEvent) => setActiveId(String(event.active.id))
  const dragEnd = (event: DragEndEvent) => { const row = rows.find((item) => item.activity.id === event.active.id); const overId = String(event.over?.id ?? ""); const overRow = rows.find((item) => item.activity.id === overId); const status = overId.startsWith("column:") ? overId.slice(7) as CustomerActivity["status"] : overRow?.activity.status; setActiveId(undefined); if (row && status) move(row, status, overRow?.activity.id) }
  const active = rows.find((row) => row.activity.id === activeId)
  return <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={dragStart} onDragCancel={() => setActiveId(undefined)} onDragEnd={dragEnd}><div className="min-w-0 max-w-full overflow-hidden rounded-xl border bg-muted/10"><div data-kanban-scroll className="w-full overflow-x-auto overscroll-x-contain pb-2 [scrollbar-gutter:stable]"><div className="grid w-max grid-flow-col auto-cols-[17rem] gap-3 p-3 sm:auto-cols-[18rem] lg:auto-cols-[19rem]">{customerActivityStatuses.map((status) => <Column key={status} status={status} rows={sortedFor(status)} onOpen={onOpen} onMove={move} />)}</div></div></div><DragOverlay>{active ? <div className="w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border bg-card p-3 shadow-xl"><strong className="line-clamp-2 break-words">{active.activity.title}</strong><p className="truncate text-xs text-muted-foreground">{active.customer.profile.company}</p></div> : null}</DragOverlay></DndContext>
}
