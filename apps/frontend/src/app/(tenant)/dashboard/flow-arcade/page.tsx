"use client"

import { useEffect, useState } from "react"
import { Gamepad2, Loader2, Medal, Sparkles } from "lucide-react"

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { ServerRankingsPanel } from "@/features/commercial/components/server-rankings-panel"
import { performanceApi, type PerformanceState } from "@/lib/tenant-performance-api"

export default function FlowArcadePage() {
  const [state, setState] = useState<PerformanceState | null>(null)
  const [error, setError] = useState(false)
  useEffect(() => { const controller = new AbortController(); void performanceApi.state(controller.signal).then(setState).catch((reason) => { if (!(reason instanceof Error && reason.name === "AbortError")) setError(true) }); return () => controller.abort() }, [])
  const approved = state?.pointLedger.filter((entry) => entry.status === "approved") ?? []
  const total = approved.reduce((sum, entry) => sum + entry.points, 0)
  return <main className="w-full space-y-5 p-4 md:p-6" data-flow-arcade-source="server"><header><p className="text-xs font-medium uppercase tracking-[.16em] text-primary">Pausa</p><h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight"><Gamepad2 className="size-6" />Flow Arcade</h1><p className="text-sm text-muted-foreground">Punti e classifiche consolidate dal backend.</p></header>{!state && !error ? <p className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Caricamento dati autorizzati…</p> : error ? <Card><CardContent className="p-6 text-sm text-destructive" role="alert">Flow Arcade non disponibile.</CardContent></Card> : <section className="grid gap-3 sm:grid-cols-3"><Card><CardHeader><CardDescription>Movimenti approvati</CardDescription><CardTitle className="flex items-center gap-2 text-3xl"><Sparkles className="size-5 text-primary" />{approved.length}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Punti autorizzati</CardDescription><CardTitle className="text-3xl tabular-nums">{total}</CardTitle></CardHeader></Card><Card><CardHeader><CardDescription>Snapshot classifiche</CardDescription><CardTitle className="flex items-center gap-2 text-3xl"><Medal className="size-5 text-primary" />{state?.rankingSnapshots.length ?? 0}</CardTitle></CardHeader></Card></section>}<ServerRankingsPanel /></main>
}
