"use client"

import { useMemo, useState, type ComponentType } from "react"
import { CalendarClock, CheckCircle2, FileText, History, Mail, MessageCircle, MessageSquareText, Phone, RefreshCw, StickyNote, Users } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { DocumentStatusBadge } from "@/features/commercial/document-status"
import { formatItalianDateTime } from "@/lib/date"

export type CommercialTimelineCategory = "Attività" | "Commenti" | "Revisioni" | "Comunicazioni" | "Documenti" | "Contratti" | "Rinnovi" | "Progetti" | "Fusioni" | "Cliente" | "Sistema"

export type CommercialTimelineItem = {
  id: string
  title: string
  description?: string
  date: string
  author?: string
  category?: CommercialTimelineCategory
  kind?: string
  status?: string
}

const categoryIcon: Record<CommercialTimelineCategory, ComponentType<{ className?: string }>> = {
  Attività: CheckCircle2,
  Commenti: MessageSquareText,
  Revisioni: RefreshCw,
  Comunicazioni: MessageCircle,
  Documenti: FileText,
  Contratti: FileText,
  Rinnovi: CalendarClock,
  Progetti: CalendarClock,
  Fusioni: Users,
  Cliente: Users,
  Sistema: History,
}

const categoryTone: Record<CommercialTimelineCategory, string> = {
  Attività: "bg-blue-500/10 text-blue-600 dark:text-blue-300",
  Commenti: "bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
  Revisioni: "bg-violet-500/10 text-violet-700 dark:text-violet-300",
  Comunicazioni: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  Documenti: "bg-amber-500/10 text-amber-700 dark:text-amber-300",
  Contratti: "bg-orange-500/10 text-orange-700 dark:text-orange-300",
  Rinnovi: "bg-yellow-500/10 text-yellow-700 dark:text-yellow-300",
  Progetti: "bg-indigo-500/10 text-indigo-700 dark:text-indigo-300",
  Fusioni: "bg-fuchsia-500/10 text-fuchsia-700 dark:text-fuchsia-300",
  Cliente: "bg-slate-500/10 text-slate-700 dark:text-slate-300",
  Sistema: "bg-muted text-muted-foreground",
}

const inferCategory = (item: CommercialTimelineItem): CommercialTimelineCategory => {
  if (item.category) return item.category
  const value = `${item.kind ?? ""} ${item.title}`.toLocaleLowerCase("it-IT")
  if (value.includes("comment")) return "Commenti"
  if (value.includes("revision")) return "Revisioni"
  if (value.includes("document") || value.includes("file")) return "Documenti"
  if (value.includes("contratt")) return "Contratti"
  if (value.includes("rinnov")) return "Rinnovi"
  if (value.includes("progett") || value.includes("consegn")) return "Progetti"
  if (value.includes("fus") || value.includes("duplicat")) return "Fusioni"
  if (value.includes("mail") || value.includes("whatsapp") || value.includes("chiamat") || value.includes("nota")) return "Comunicazioni"
  if (item.kind === "activity" || value.includes("attivit")) return "Attività"
  return "Sistema"
}

function TimelineIcon({ item, category }: { item: CommercialTimelineItem; category: CommercialTimelineCategory }) {
  const kind = item.kind?.toLowerCase()
  const Icon = kind === "email" ? Mail : kind === "whatsapp" ? MessageCircle : kind === "call" ? Phone : kind === "note" ? StickyNote : categoryIcon[category]
  return <span className={`relative z-10 grid size-8 shrink-0 place-items-center rounded-full ring-4 ring-background ${categoryTone[category]}`}><Icon className="size-3.5" /></span>
}

export function CommercialTimeline({ items, compact = false, limit, filters = true, emptyText = "Nessun evento registrato." }: { items: CommercialTimelineItem[]; compact?: boolean; limit?: number; filters?: boolean; emptyText?: string }) {
  const normalized = useMemo(() => {
    const known = new Set<string>()
    return items.filter((item) => item.id && !known.has(item.id) && Boolean(known.add(item.id))).map((item) => ({ ...item, category: inferCategory(item) })).sort((a, b) => Date.parse(b.date) - Date.parse(a.date))
  }, [items])
  const categories = useMemo(() => Array.from(new Set(normalized.map((item) => item.category))), [normalized])
  const [filter, setFilter] = useState<"Tutti" | CommercialTimelineCategory>("Tutti")
  const visible = normalized.filter((item) => filter === "Tutti" || item.category === filter).slice(0, limit)

  return <div className="space-y-3">
    {filters && categories.length > 1 && <div className="flex gap-2 overflow-x-auto pb-1" aria-label="Filtri Timeline"><Button size="xs" variant={filter === "Tutti" ? "default" : "outline"} aria-pressed={filter === "Tutti"} onClick={() => setFilter("Tutti")}>Tutti</Button>{categories.map((category) => <Button key={category} size="xs" variant={filter === category ? "default" : "outline"} aria-pressed={filter === category} onClick={() => setFilter((current) => current === category ? "Tutti" : category)}>{category}</Button>)}</div>}
    {visible.length ? <div className="relative space-y-0 before:absolute before:bottom-4 before:left-4 before:top-4 before:w-px before:bg-border">{visible.map((item) => {
      const category = item.category as CommercialTimelineCategory
      return <article key={item.id} className={`relative flex gap-3 ${compact ? "py-2" : "py-3"}`}><TimelineIcon item={item} category={category} /><div className="min-w-0 flex-1"><div className="flex min-w-0 flex-wrap items-center gap-1.5"><p className="min-w-0 flex-1 text-sm font-medium leading-5">{item.title}</p>{item.status && category === "Documenti" ? <DocumentStatusBadge status={item.status} /> : <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{category}</Badge>}</div>{item.description && <p className={`${compact ? "line-clamp-2" : "whitespace-pre-wrap"} mt-0.5 break-words text-xs leading-5 text-muted-foreground`}>{item.description}</p>}<p className="mt-0.5 text-[11px] text-muted-foreground"><time dateTime={item.date}>{formatItalianDateTime(item.date)}</time>{item.author ? ` · ${item.author}` : ""}</p></div></article>
    })}</div> : <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">{emptyText}</p>}
  </div>
}
