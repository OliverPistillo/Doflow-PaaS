"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarDays, ChevronRight, Clock3 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"

type AgendaMenuProps = { open?: boolean; onOpenChange?: (open: boolean) => void }
type AgendaItem = { id: string; title: string; detail: string; start: string; href: string; kind: string }

const dateTime = new Intl.DateTimeFormat("it-IT", { weekday: "short", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

export function AgendaMenu({ open: controlledOpen, onOpenChange }: AgendaMenuProps) {
  const { store, identity, projects, activities } = useAuthorizedCommercial()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [renderedAt] = React.useState(Date.now)
  const open = controlledOpen ?? internalOpen
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value)
    onOpenChange?.(value)
  }

  if (!identity.hasCapability("canViewActivities")) return null

  const items: AgendaItem[] = [
    ...store.appointments
      .filter((item) => !item.archivedAt && item.assigneeId === identity.currentUserId && !["completed", "cancelled", "no_show"].includes(item.status))
      .map((item) => ({ id: "appointment:" + item.id, title: item.title, detail: "Appuntamento", start: item.startsAt, href: "/dashboard/calendario?event=" + item.id, kind: "Appuntamento" })),
    ...activities
      .filter(({ activity }) => activity.assigneeId === identity.currentUserId && !activity.archivedAt && !["Completata", "Annullata"].includes(activity.status))
      .flatMap(({ activity, customer }) => {
        const start = activity.dueAt || activity.startAt || activity.dueDate
        return start ? [{ id: "activity:" + activity.id, title: activity.title, detail: customer.profile.company, start, href: "/dashboard/attivita?activityId=" + activity.id, kind: "Attività" }] : []
      }),
    ...projects
      .filter((item) => item.ownerId === identity.currentUserId && item.dueDate && !item.archivedAt)
      .map((item) => ({ id: "project:" + item.id, title: item.name, detail: "Scadenza progetto", start: item.dueDate!, href: "/dashboard/progetti/" + item.id, kind: "Consegna" })),
  ]
    .filter((item) => !Number.isNaN(new Date(item.start).valueOf()))
    .sort((left, right) => left.start.localeCompare(right.start))
    .slice(0, 6)

  const overdue = items.filter((item) => new Date(item.start).valueOf() < renderedAt).length

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button variant="ghost" size="icon" className="relative shrink-0" aria-label="Apri agenda">
              <CalendarDays />
              {overdue ? <span className="absolute right-1 top-1 size-2 rounded-full bg-amber-500 ring-2 ring-background" aria-label={String(overdue) + " impegni in ritardo"} /> : null}
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Agenda</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8} className="w-[calc(100vw-24px)] max-w-[410px] gap-0 overflow-hidden p-0">
        <header className="border-b p-4"><h2 className="font-semibold">Agenda personale</h2><p className="mt-0.5 text-xs text-muted-foreground">{overdue ? String(overdue) + " impegni in ritardo" : "Prossimi impegni autorizzati"}</p></header>
        <div className="max-h-[min(65dvh,32rem)] overflow-y-auto p-2">
          {items.length ? items.map((item) => (
            <Link key={item.id} href={item.href} onClick={() => setOpen(false)} className="flex items-start gap-3 rounded-lg p-3 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary"><Clock3 className="size-4" /></span>
              <span className="min-w-0 flex-1"><b className="block truncate text-sm">{item.title}</b><span className="block truncate text-xs text-muted-foreground">{item.detail} · {dateTime.format(new Date(item.start))}</span></span>
              <Badge variant="outline" className="shrink-0 text-[10px]">{item.kind}</Badge>
            </Link>
          )) : <p className="p-8 text-center text-sm text-muted-foreground">Nessun impegno imminente.</p>}
        </div>
        <div className="border-t p-2"><Button asChild variant="ghost" className="w-full"><Link href="/dashboard/calendario" onClick={() => setOpen(false)}>Apri calendario<ChevronRight /></Link></Button></div>
      </PopoverContent>
    </Popover>
  )
}
