"use client"

import { useMemo, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { Bell, Building2, CalendarClock, Check, CheckCheck, ChevronDown, ClipboardCheck, Clock3, FolderKanban, Inbox, MoreHorizontal, RotateCcw, Search, UserRound } from "lucide-react"

import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { formatItalianDateTime, getRomeDateKey } from "@/lib/date"
import type { DoFlowNotification } from "@/lib/doflow-notifications"
import { useDoflowNotifications } from "@/hooks/use-doflow-notifications"

const typeLabels = { activity: "Attività", deadline: "Scadenze", project: "Progetti", client: "Clienti", lead: "Lead", comment: "Commenti", system: "Sistema" } as const
const severityTone = { urgent: "bg-red-500", warning: "bg-amber-500", info: "bg-blue-500" } as const
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("it-IT")
const relativeDate = (value: string) => { const today = getRomeDateKey(new Date()); const date = getRomeDateKey(value); if (!date) return ""; if (date === today) return "Oggi"; const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1); if (date === getRomeDateKey(yesterday)) return "Ieri"; return formatItalianDateTime(value) }
const iconFor = (type: DoFlowNotification["type"]) => type === "activity" ? ClipboardCheck : type === "deadline" ? CalendarClock : type === "project" ? FolderKanban : type === "client" ? Building2 : type === "lead" ? UserRound : Bell
type NotificationFilter = "all" | "unread" | "urgent" | "deadline" | "updates" | "archived"
const activeNotification = (item: DoFlowNotification) => !item.archived
const matchesFilter = (item: DoFlowNotification, filter: NotificationFilter) => filter === "all" ? activeNotification(item) : filter === "unread" ? activeNotification(item) && !item.read : filter === "urgent" ? activeNotification(item) && item.severity === "urgent" : filter === "deadline" ? activeNotification(item) && item.severity === "warning" : filter === "updates" ? activeNotification(item) && item.severity === "info" : item.archived

export default function NotificationsPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { notifications, summary: serverSummary, loading, error, markRead, archive, markAllRead } = useDoflowNotifications()
  const [query, setQuery] = useState("")
  const filterParam = searchParams.get("filter")
  const selectedFilter: NotificationFilter = filterParam === "unread" || filterParam === "urgent" || filterParam === "deadline" || filterParam === "updates" || filterParam === "archived" ? filterParam : "all"
  const [type, setType] = useState("all")
  const [period, setPeriod] = useState("all")
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false)
  const today = getRomeDateKey(new Date())
  const filtered = notifications.filter((item) => {
    const searchable = normalize(`${item.title} ${item.description}`)
    const matchesQuery = !query.trim() || searchable.includes(normalize(query))
    const matchesTab = matchesFilter(item, selectedFilter)
    const matchesType = type === "all" || item.type === type
    const date = getRomeDateKey(item.occurredAt)
    const age = date ? Math.floor((new Date(`${today}T12:00:00`).getTime() - new Date(`${date}T12:00:00`).getTime()) / 86400000) : Number.POSITIVE_INFINITY
    const matchesPeriod = period === "all" || period === "today" && date === today || period === "week" && age >= 0 && age <= 7 || period === "month" && age >= 0 && age <= 30
    return matchesQuery && matchesTab && matchesType && matchesPeriod
  })
  const summary = [["Non lette", serverSummary.unreadNotifications, "text-primary", "unread"], ["Urgenti", serverSummary.urgentNotifications, "text-red-600 dark:text-red-400", "urgent"], ["In scadenza", notifications.filter((item) => matchesFilter(item, "deadline")).length, "text-amber-600 dark:text-amber-400", "deadline"], ["Aggiornamenti", notifications.filter((item) => matchesFilter(item, "updates")).length, "text-blue-600 dark:text-blue-400", "updates"]] as const
  const groups = useMemo(() => {
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1)
    const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
    const keys = { today, yesterday: getRomeDateKey(yesterday), week: getRomeDateKey(sevenDaysAgo) }
    const bucket = { "Oggi": [] as DoFlowNotification[], "Ieri": [] as DoFlowNotification[], "Questa settimana": [] as DoFlowNotification[], "Precedenti": [] as DoFlowNotification[] }
    filtered.forEach((item) => { const date = getRomeDateKey(item.occurredAt); if (date === keys.today) bucket.Oggi.push(item); else if (date === keys.yesterday) bucket.Ieri.push(item); else if (date >= keys.week) bucket["Questa settimana"].push(item); else bucket.Precedenti.push(item) })
    return bucket
  }, [filtered, today])
  const setFilter = (filter: NotificationFilter) => { const next = selectedFilter === filter && filter !== "all" ? "all" : filter; router.replace(next === "all" ? pathname : `${pathname}?filter=${next}`) }
  const resetFilters = () => { setQuery(""); setType("all"); setPeriod("all"); router.replace(pathname) }
  const isAvailable = (item: DoFlowNotification) => Boolean(item.href)
  const openItem = async (item: DoFlowNotification) => { if (!isAvailable(item)) return; if (!item.read) await markRead(item.id, true); router.push(item.href) }
  const archiveRead = async () => { for (const item of notifications.filter((entry) => entry.read && !entry.archived)) await archive(item.id) }

  return <main className="mx-auto w-full max-w-6xl space-y-5 p-4 md:p-6">
    <header className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-semibold">Notifiche</h1><p className="text-sm text-muted-foreground">Aggiornamenti, scadenze e attività da non perdere.</p></div><div className="flex flex-wrap gap-2"><Badge variant="secondary" className="h-9 px-3">{serverSummary.unreadNotifications} non lette</Badge><Button variant="outline" disabled={!serverSummary.unreadNotifications} onClick={() => void markAllRead()}><CheckCheck />Segna tutte come lette</Button><DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="icon" aria-label="Altre azioni notifiche"><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem disabled={!notifications.some((item) => item.read && !item.archived)} onSelect={() => setArchiveDialogOpen(true)}>Archivia tutte le lette</DropdownMenuItem></DropdownMenuContent></DropdownMenu><AlertDialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Archivia tutte le notifiche lette?</AlertDialogTitle><AlertDialogDescription>Le notifiche resteranno disponibili nel filtro Archiviate.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Annulla</AlertDialogCancel><AlertDialogAction onClick={() => void archiveRead()}>Archivia</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog></div></header>
    {error && <Card><CardContent className="py-4 text-sm text-destructive">{error}</CardContent></Card>}
    <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{summary.map(([label, value, tone, filter]) => { const selected = selectedFilter === filter; return <button type="button" key={label} aria-pressed={selected} onClick={() => setFilter(filter)} className="text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"><Card className={`h-full cursor-pointer transition-colors hover:border-primary/40 ${selected ? "border-primary bg-accent/50 ring-1 ring-primary/40" : ""}`}><CardHeader className="relative py-3"><CardDescription className={selected ? "font-medium text-foreground" : ""}>{label}</CardDescription><CardTitle className={`text-2xl ${tone}`}>{value}</CardTitle>{selected && <Check className="absolute right-3 top-3 size-4 text-primary" />}</CardHeader></Card></button> })}</section>
    <Card><CardContent className="flex flex-wrap gap-2 p-3"><div className="relative min-w-52 flex-1"><Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" /><Input className="pl-8" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Cerca notifiche" /></div><Tabs value={selectedFilter === "unread" || selectedFilter === "urgent" || selectedFilter === "archived" ? selectedFilter : "all"} onValueChange={(value) => setFilter(value as NotificationFilter)}><TabsList><TabsTrigger value="all">Tutte</TabsTrigger><TabsTrigger value="unread">Non lette</TabsTrigger><TabsTrigger value="urgent">Urgenti</TabsTrigger><TabsTrigger value="archived">Archiviate</TabsTrigger></TabsList></Tabs><Select value={type} onValueChange={setType}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutti i tipi</SelectItem><SelectItem value="activity">Attività</SelectItem><SelectItem value="deadline">Scadenze</SelectItem><SelectItem value="project">Progetti</SelectItem><SelectItem value="client">Clienti</SelectItem><SelectItem value="lead">Lead</SelectItem></SelectContent></Select><Select value={period} onValueChange={setPeriod}><SelectTrigger className="w-36"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Tutte</SelectItem><SelectItem value="today">Oggi</SelectItem><SelectItem value="week">Ultimi 7 giorni</SelectItem><SelectItem value="month">Ultimi 30 giorni</SelectItem></SelectContent></Select><Button variant="outline" onClick={resetFilters}>Azzera filtri</Button></CardContent></Card>
    {loading ? <Card><CardContent className="py-16 text-center text-sm text-muted-foreground">Caricamento notifiche…</CardContent></Card> : notifications.length === 0 ? <Card><CardContent className="flex flex-col items-center gap-2 py-16 text-center"><Inbox className="size-8 text-muted-foreground" /><CardTitle>Nessuna notifica</CardTitle><CardDescription>Quando ci saranno attività, scadenze o aggiornamenti importanti li vedrai qui.</CardDescription></CardContent></Card> : filtered.length === 0 ? <Card><CardContent className="flex flex-col items-center gap-3 py-16 text-center"><Search className="size-8 text-muted-foreground" /><CardTitle>{selectedFilter === "all" ? "Nessun risultato" : "Nessuna notifica in questa categoria"}</CardTitle><CardDescription>{selectedFilter === "all" ? "Prova a modificare o azzerare i filtri." : "Non ci sono elementi corrispondenti al filtro selezionato."}</CardDescription><Button variant="outline" onClick={resetFilters}>{selectedFilter === "all" ? "Azzera filtri" : "Mostra tutte"}</Button></CardContent></Card> : <div className="space-y-5">{Object.entries(groups).map(([label, items]) => items.length ? <section key={label}><h2 className="mb-2 text-sm font-medium text-muted-foreground">{label}</h2><Card><CardContent className="divide-y p-0">{items.map((item) => { const Icon = iconFor(item.type); const available = isAvailable(item); return <div key={item.id} className="flex items-start gap-3 p-3 transition-colors hover:bg-muted/60"><button type="button" disabled={!available} className="flex min-w-0 flex-1 items-start gap-3 text-left disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void openItem(item)}><span className={`mt-1 size-2 shrink-0 rounded-full ${severityTone[item.severity]}`} /><Icon className="mt-0.5 size-5 shrink-0 text-muted-foreground" /><div className="min-w-0 flex-1"><div className="flex flex-wrap items-start gap-2"><p className="line-clamp-2 font-medium">{item.title}</p>{!item.read && !item.archived && <span className="mt-2 size-1.5 rounded-full bg-violet-500" aria-label="Non letta" />}</div><p className="mt-0.5 truncate text-sm text-muted-foreground">{available ? item.description : "Elemento non disponibile"}</p><div className="mt-2 flex flex-wrap items-center gap-2"><Badge variant="secondary">{typeLabels[item.type]}</Badge><span className="flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="size-3" />{relativeDate(item.dueDate || item.occurredAt)}</span></div></div></button><DropdownMenu><DropdownMenuTrigger asChild><Button size="icon-sm" variant="ghost" aria-label={`Azioni ${item.title}`}><MoreHorizontal /></Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onSelect={() => void markRead(item.id, !item.read)}>{item.read ? "Segna come non letta" : "Segna come letta"}</DropdownMenuItem><DropdownMenuItem disabled={!available} onSelect={() => void openItem(item)}><ChevronDown className="rotate-[-90deg]" />Apri elemento</DropdownMenuItem>{item.archived ? <DropdownMenuItem onSelect={() => void markRead(item.id, false)}><RotateCcw />Ripristina</DropdownMenuItem> : <DropdownMenuItem onSelect={() => void archive(item.id)}><ChevronDown className="rotate-90" />Archivia</DropdownMenuItem>}</DropdownMenuContent></DropdownMenu></div> })}</CardContent></Card></section> : null)}</div>}
  </main>
}
