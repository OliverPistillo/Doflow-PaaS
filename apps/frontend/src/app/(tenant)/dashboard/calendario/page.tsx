"use client"

import Link from "next/link"
import { CalendarDays, Clock3 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"

export default function DoflowCalendarPage() {
  const { store, activities } = useAuthorizedCommercial()
  const items = [
    ...store.appointments.map((item) => ({ id: `appointment-${item.id}`, date: item.startsAt, title: item.title, detail: "Appuntamento", href: "/dashboard/commercial?view=appointments" })),
    ...activities.filter(({ activity }) => activity.dueAt || activity.dueDate).map(({ activity, customer }) => ({ id: `activity-${activity.id}`, date: activity.dueAt || `${activity.dueDate}T12:00:00`, title: activity.title, detail: customer.profile.company, href: `/dashboard/attivita?activityId=${activity.id}` })),
  ].filter((item) => item.date).sort((left, right) => left.date.localeCompare(right.date))
  return <main className="w-full space-y-5 p-4 md:p-6" data-calendar-source="server"><header><h1 className="text-2xl font-semibold tracking-tight">Calendario</h1><p className="text-sm text-muted-foreground">Appuntamenti e scadenze reali del workspace autorizzato.</p></header><Card><CardHeader><CardTitle className="flex items-center gap-2"><CalendarDays className="size-5" />Agenda</CardTitle><CardDescription>{items.length} elementi disponibili</CardDescription></CardHeader><CardContent className="space-y-2">{items.map((item) => <Link key={item.id} href={item.href} className="flex flex-wrap items-center gap-3 rounded-lg border p-3 hover:bg-muted/40"><Badge variant="outline" className="tabular-nums">{new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(item.date))}</Badge><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{item.title}</span><span className="block truncate text-xs text-muted-foreground">{item.detail}</span></span><Clock3 className="size-4 text-muted-foreground" /></Link>)}{!items.length ? <div className="rounded-xl border border-dashed p-10 text-center"><CalendarDays className="mx-auto size-7 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Nessun evento disponibile</p><p className="text-xs text-muted-foreground">Non vengono mostrati appuntamenti dimostrativi.</p></div> : null}</CardContent></Card></main>
}
