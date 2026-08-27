"use client"

import { useEffect, useState } from "react"

import { Skeleton } from "@/components/ui/skeleton"
import { getZonedGreeting } from "@/features/dashboard/dashboard-time"

export function DashboardGreeting({ name, timeZone }: { name: string; timeZone?: string }) {
  const [now, setNow] = useState<Date | null>(null)

  useEffect(() => {
    const update = () => setNow(new Date())
    update()
    const interval = window.setInterval(update, 30_000)
    return () => window.clearInterval(interval)
  }, [])

  if (!now) return <div className="space-y-2" aria-busy="true"><Skeleton className="h-3 w-44" /><Skeleton className="h-8 w-72 max-w-full" /></div>
  const value = getZonedGreeting(now, timeZone, name)
  return <div data-timezone={value.timeZone} data-local-hour={value.hour}>
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{value.dateLabel}</p>
    <h1 className="mt-1 text-2xl font-semibold">{value.greeting}</h1>
  </div>
}
