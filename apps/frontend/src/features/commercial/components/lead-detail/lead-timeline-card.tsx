"use client"

import { ArrowRight, CalendarPlus, CheckCircle2, FileText, Mail, MessageCircle, Phone, StickyNote, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"

export type TimelineEvent = { id: string; kind: "call" | "whatsapp" | "email" | "meeting" | "note" | "status" | "file" | "lead"; title: string; detail: string; date: string; author: string }
const fmt = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })
const eventIcon = { call: Phone, whatsapp: MessageCircle, email: Mail, meeting: CalendarPlus, note: StickyNote, status: CheckCircle2, file: FileText, lead: Users }
const eventTone = { call: "text-blue-600 bg-blue-500/10", whatsapp: "text-emerald-600 bg-emerald-500/10", email: "text-cyan-600 bg-cyan-500/10", meeting: "text-indigo-600 bg-indigo-500/10", note: "text-amber-600 bg-amber-500/10", status: "text-violet-600 bg-violet-500/10", file: "text-blue-600 bg-blue-500/10", lead: "text-emerald-600 bg-emerald-500/10" }

type Props = { filter: string; setFilter: (value: string) => void; visibleEvents: TimelineEvent[]; allEvents: TimelineEvent[]; open: boolean; setOpen: (open: boolean) => void }
export function LeadTimelineCard({ filter, setFilter, visibleEvents, allEvents, open, setOpen }: Props) {
  const filters = (className: string) => <Select value={filter} onValueChange={setFilter}><SelectTrigger className={className}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli eventi</SelectItem><SelectItem value="call">Chiamate</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="note">Note</SelectItem><SelectItem value="file">File</SelectItem><SelectItem value="status">Cambi stato</SelectItem></SelectContent></Select>
  const list = (items: TimelineEvent[], compact: boolean) => <div className="space-y-2">{items.map((event, index) => { const Icon = eventIcon[event.kind]; return <div key={event.id}><div className="flex gap-3 py-1"><span className={`grid size-9 shrink-0 place-items-center rounded-full ${eventTone[event.kind]}`}><Icon className="size-4" /></span><div className={compact ? "min-w-0 flex-1" : "min-w-0"}>{compact ? <div className="flex items-start justify-between gap-2"><p className="text-sm font-medium">{event.title}</p>{event.kind !== "lead" && <Badge variant="secondary" className="h-5 text-[10px]">{event.kind === "whatsapp" ? "WhatsApp" : event.kind === "email" ? "Email" : event.kind === "call" ? "Chiamata" : event.kind === "note" ? "Nota" : event.kind === "file" ? "File" : "Stato"}</Badge>}</div> : <p className="text-sm font-medium">{event.title}</p>}<p className="line-clamp-2 text-xs text-muted-foreground">{event.detail}</p><p className="mt-1 text-[11px] text-muted-foreground">{fmt.format(new Date(event.date))} · {event.author}</p></div></div>{index < items.length - 1 && <Separator />}</div> })}</div>
  return <Card className="min-[1280px]:col-span-5"><CardHeader className="flex flex-row items-start justify-between gap-3 p-4 pb-2"><div><CardTitle className="text-base">Timeline</CardTitle><CardDescription>Attività e comunicazioni del lead</CardDescription></div>{filters("h-8 w-40 text-xs")}</CardHeader><CardContent className="space-y-2 p-4 pt-2"><ScrollArea className="h-[360px] pr-3">{list(visibleEvents, true)}</ScrollArea><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Timeline completa<ArrowRight className="size-4" /></Button></TooltipTrigger><TooltipContent>Apri tutti gli eventi</TooltipContent></Tooltip><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Timeline completa</DialogTitle><DialogDescription>Tutti gli eventi unici della trattativa.</DialogDescription></DialogHeader>{filters("h-8 w-48 text-xs")}<ScrollArea className="h-[360px] pr-3">{list(allEvents, false)}</ScrollArea><DialogFooter><Button onClick={() => setOpen(false)}>Chiudi</Button></DialogFooter></DialogContent></Dialog></CardContent></Card>
}
