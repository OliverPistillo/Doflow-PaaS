import { Suspense } from "react"

import { CommercialCalendarPage } from "@/features/commercial/components/commercial-calendar-page"

export default function DoflowCalendarPage() {
  return <Suspense fallback={<div className="p-6 text-sm text-muted-foreground">Caricamento calendario…</div>}><CommercialCalendarPage /></Suspense>
}
