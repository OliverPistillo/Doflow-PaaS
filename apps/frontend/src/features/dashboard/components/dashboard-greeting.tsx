"use client"

import { useEffect, useState } from "react"
import { Skeleton } from "@/components/ui/skeleton"

function greetingFor(now: Date, timeZone: string | undefined, name: string) {
  const formatter = new Intl.DateTimeFormat("it-IT", { timeZone, weekday: "long", day: "numeric", month: "long" })
  const hour = Number(new Intl.DateTimeFormat("it-IT", { timeZone, hour: "2-digit", hour12: false }).format(now))
  const salutation = hour < 12 ? "Buongiorno" : hour < 18 ? "Buon pomeriggio" : "Buonasera"
  return { hour, timeZone: timeZone || Intl.DateTimeFormat().resolvedOptions().timeZone, dateLabel: formatter.format(now), greeting: `${salutation}, ${name}` }
}

export function DashboardGreeting({ name, timeZone }: { name: string; timeZone?: string }) {
  const [now, setNow] = useState<Date | null>(null)
  useEffect(() => {
    const update = () => setNow(new Date())
    update()
    const interval = window.setInterval(update, 30_000)
    return () => window.clearInterval(interval)
  }, [])
  if (!now) return <div className="space-y-2" aria-busy="true"><Skeleton className="h-3 w-44" /><Skeleton className="h-8 w-72 max-w-full" /></div>
  const value = greetingFor(now, timeZone, name)
  return <div data-timezone={value.timeZone} data-local-hour={value.hour}><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{value.dateLabel}</p><h1 className="mt-1 text-2xl font-semibold tracking-tight">{value.greeting}</h1></div>
}
