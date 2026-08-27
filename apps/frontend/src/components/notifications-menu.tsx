"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Bell, Building2, CalendarClock, CheckCheck, ClipboardCheck, Clock3, FolderKanban, Inbox, UserRound } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Skeleton } from "@/components/ui/skeleton"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import type { DoFlowNotification } from "@/lib/doflow-notifications"
import { useDoflowNotifications } from "@/hooks/use-doflow-notifications"

function relativeDate(value: string) {
  const days = Math.round((Date.now() - new Date(value).getTime()) / 86400000)
  return days <= 0 ? "Oggi" : days === 1 ? "Ieri" : `${days} giorni fa`
}

function NotificationIcon({ item }: { item: DoFlowNotification }) {
  const Icon = item.type === "activity" ? ClipboardCheck : item.type === "project" ? FolderKanban : item.type === "client" ? Building2 : item.type === "deadline" ? CalendarClock : UserRound
  return <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-md bg-muted text-muted-foreground"><Icon className="size-4" /></span>
}

function LoadingNotifications() {
  return <div className="space-y-3 p-3" aria-label="Caricamento notifiche"><Skeleton className="h-10 w-full" /><Skeleton className="h-10 w-5/6" /><Skeleton className="h-10 w-4/5" /></div>
}

export function NotificationsMenu({ open: controlledOpen, onOpenChange }: { open?: boolean; onOpenChange?: (open: boolean) => void } = {}) {
  const router = useRouter()
  const [internalOpen, setInternalOpen] = useState(false)
  const open = controlledOpen ?? internalOpen
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value)
    onOpenChange?.(value)
  }
  const { notifications, summary, loading, markRead, markAllRead } = useDoflowNotifications()
  const unread = summary.unreadNotifications
  const recent = notifications.filter((item) => !item.archived).slice(0, 5)
  const headerCopy = unread > 0 ? `${unread} notifiche non lette` : notifications.length > 0 ? "Nessuna notifica non letta." : "Nessuna nuova notifica"
  const openNotification = async (item: DoFlowNotification) => { if (!item.read) await markRead(item.id, true); setOpen(false); router.push(item.href) }

  return <Popover open={open} onOpenChange={setOpen}>
    <Tooltip open={open ? false : undefined}><TooltipTrigger asChild><PopoverTrigger asChild><Button variant="ghost" className="relative inline-flex h-9 shrink-0 items-center gap-1.5 px-2" aria-label="Apri notifiche"><Bell className="size-4 shrink-0" />{unread > 0 && <><span className="hidden h-[18px] min-w-5 items-center justify-center rounded-full bg-red-700/90 px-1.5 text-[10px] font-semibold leading-none text-white sm:inline-flex">{unread > 99 ? "99+" : unread}</span><span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-red-600 ring-2 ring-background sm:hidden" aria-label={headerCopy} /></>}</Button></PopoverTrigger></TooltipTrigger><TooltipContent>Notifiche</TooltipContent></Tooltip>
    <PopoverContent align="end" sideOffset={8} className="w-[calc(100vw-24px)] max-w-[380px] gap-0 overflow-hidden p-0">
      <div className="flex items-start justify-between gap-3 border-b p-4"><div className="min-w-0"><h2 className="font-semibold">Notifiche</h2><p className="mt-0.5 text-xs text-muted-foreground">{headerCopy}</p></div>{unread > 0 && <Button variant="ghost" size="sm" className="shrink-0" onClick={() => void markAllRead()}><CheckCheck />Segna tutte come lette</Button>}</div>
      {loading ? <LoadingNotifications /> : recent.length ? <div className="max-h-[min(60vh,28rem)] overflow-y-auto p-1.5">{recent.map((item) => <button type="button" key={item.id} className="flex w-full gap-2 rounded-md p-2.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={() => void openNotification(item)}><NotificationIcon item={item} /><div className="min-w-0 flex-1"><div className="flex items-start gap-1.5"><p className="line-clamp-2 flex-1 text-sm font-medium">{item.title}</p>{!item.read && <span className="mt-1 size-1.5 shrink-0 rounded-full bg-violet-500" aria-label="Non letta" />}</div><p className="mt-0.5 truncate text-xs text-muted-foreground">{item.description}</p><p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="size-3" />{relativeDate(item.dueDate || item.occurredAt)}</p></div></button>)}</div> : <div className="flex flex-col items-center gap-2 px-4 py-10 text-center"><span className="grid size-10 place-items-center rounded-full bg-muted"><Inbox className="size-5 text-muted-foreground" /></span><p className="font-medium">Nessuna nuova notifica</p></div>}
      <div className="border-t p-2"><Button variant="ghost" className="w-full" onClick={() => { setOpen(false); router.push("/dashboard/notifiche") }}>Vedi tutte le notifiche</Button></div>
    </PopoverContent>
  </Popover>
}
