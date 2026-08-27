"use client"

import { ArrowRight } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { CommercialTimeline } from "@/features/commercial/components/commercial-timeline"

export type TimelineEvent = { id: string; kind: "call" | "whatsapp" | "email" | "meeting" | "note" | "status" | "file" | "lead"; title: string; detail: string; date: string; author: string }
type Props = { filter: string; setFilter: (value: string) => void; visibleEvents: TimelineEvent[]; allEvents: TimelineEvent[]; open: boolean; setOpen: (open: boolean) => void }
export function LeadTimelineCard({ filter, setFilter, visibleEvents, allEvents, open, setOpen }: Props) {
  const filters = (className: string) => <Select value={filter} onValueChange={setFilter}><SelectTrigger className={className}><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti gli eventi</SelectItem><SelectItem value="call">Chiamate</SelectItem><SelectItem value="whatsapp">WhatsApp</SelectItem><SelectItem value="email">Email</SelectItem><SelectItem value="note">Note</SelectItem><SelectItem value="file">File</SelectItem><SelectItem value="status">Cambi stato</SelectItem></SelectContent></Select>
  const list = (items: TimelineEvent[], compact: boolean) => <CommercialTimeline compact={compact} items={items.map((event) => ({ id: event.id, title: event.title, description: event.detail, date: event.date, author: event.author, kind: event.kind }))} />
  return <Card className="min-[1280px]:col-span-5"><CardHeader className="flex flex-row items-start justify-between gap-3 p-4 pb-2"><div><CardTitle className="text-base">Timeline</CardTitle><CardDescription>Attività e comunicazioni del lead</CardDescription></div>{filters("h-8 w-40 text-xs")}</CardHeader><CardContent className="space-y-2 p-4 pt-2"><ScrollArea className="h-[360px] pr-3">{list(visibleEvents, true)}</ScrollArea><Tooltip><TooltipTrigger asChild><Button variant="ghost" size="sm" onClick={() => setOpen(true)}>Timeline completa<ArrowRight className="size-4" /></Button></TooltipTrigger><TooltipContent>Apri tutti gli eventi</TooltipContent></Tooltip><Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-3xl"><DialogHeader><DialogTitle>Timeline completa</DialogTitle><DialogDescription>Tutti gli eventi unici della trattativa.</DialogDescription></DialogHeader>{filters("h-8 w-48 text-xs")}<ScrollArea className="h-[360px] pr-3">{list(allEvents, false)}</ScrollArea><DialogFooter><Button onClick={() => setOpen(false)}>Chiudi</Button></DialogFooter></DialogContent></Dialog></CardContent></Card>
}
