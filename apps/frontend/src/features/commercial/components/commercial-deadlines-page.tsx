"use client"

import Link from "next/link"
import { CalendarClock } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card"
import { AccessDenied } from "@/features/identity/access-denied"
import { useAuthorizedCommercial } from "@/features/identity/use-authorized-commercial"
import { addRomeDays, getRomeDateKey } from "@/lib/date"

export function CommercialDeadlinesPage() {
  const { identity, activities, projects } = useAuthorizedCommercial()
  const today = getRomeDateKey(new Date())
  const soon = addRomeDays(today, 3)
  if (!identity.hasCapability("canViewActivities") && !identity.hasCapability("canViewProjects")) return <AccessDenied resource="alle scadenze" />
  const deadlines = [
    ...activities.filter(({ activity }) => !["Completata", "Annullata"].includes(activity.status) && activity.dueDate).map(({ activity, customer }) => ({ id: `activity-${activity.id}`, title: activity.title, detail: customer.profile.company, date: activity.dueDate, href: `/dashboard/attivita?activityId=${activity.id}`, type: "Attività" })),
    ...projects.filter((project) => project.dueDate && !["completed", "delivered", "archived"].includes(project.status)).map((project) => ({ id: `project-${project.id}`, title: project.name, detail: "Scadenza progetto", date: project.dueDate!, href: `/dashboard/progetti/${project.id}`, type: "Progetto" })),
  ].sort((left, right) => left.date.localeCompare(right.date))
  return <main className="mx-auto w-full max-w-5xl space-y-5 p-4 md:p-6"><header><h1 className="text-2xl font-semibold">Scadenze</h1><p className="text-sm text-muted-foreground">Attività e progetti nel perimetro autorizzato di {identity.currentUser.name}.</p></header><Card><CardContent className="divide-y p-0">{deadlines.map((deadline) => <div key={deadline.id} className="flex flex-wrap items-center gap-3 p-4"><CalendarClock className={`size-4 ${deadline.date < today ? "text-red-600" : deadline.date <= soon ? "text-amber-600" : "text-muted-foreground"}`} /><div className="min-w-48 flex-1"><p className="font-medium">{deadline.title}</p><p className="text-xs text-muted-foreground">{deadline.detail}</p></div><Badge variant="secondary">{deadline.type}</Badge><Badge variant={deadline.date < today ? "destructive" : "outline"}>{deadline.date}</Badge><Button asChild size="sm" variant="outline"><Link href={deadline.href}>Apri</Link></Button></div>)}{!deadlines.length && <div className="p-10 text-center"><CardTitle className="text-base">Nessuna scadenza visibile</CardTitle><CardDescription className="mt-1">Non risultano scadenze nel perimetro corrente.</CardDescription></div>}</CardContent></Card></main>
}
