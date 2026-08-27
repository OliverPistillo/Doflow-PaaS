import Link from "next/link"
import { CalendarDays } from "lucide-react"

import { Button } from "@/components/ui/button"

export function OpenInCalendarLink({ date, eventId, label = "Apri nel calendario", className }: { date?: string; eventId?: string; label?: string; className?: string }) {
  if (!date) return null
  const params = new URLSearchParams({ date: date.slice(0, 10), view: "agenda" })
  if (eventId) params.set("event", eventId)
  return <Button asChild size="sm" variant="outline" className={className}><Link href={`/dashboard/calendario?${params}`}><CalendarDays />{label}</Link></Button>
}
