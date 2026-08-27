"use client"

import Link from "next/link"
import { CheckCircle2, Settings2, Target } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { calculateGoalProgress, formatGoalProgress, getGoalMetricDefinition } from "@/features/commercial/commercial-goals"
import type { CommercialGoal } from "@/features/commercial/components/commercial-leads-provider"

export type DashboardGoal = { goal: CommercialGoal; current: number }

function tone(progress: number) {
  if (progress >= 100) return { label: "Centrato", badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300", bar: "[&_[data-slot=progress-indicator]]:bg-emerald-500" }
  if (progress >= 70) return { label: "In linea", badge: "border-violet-500/30 bg-violet-500/10 text-violet-700 dark:text-violet-300", bar: "[&_[data-slot=progress-indicator]]:bg-violet-500" }
  if (progress >= 40) return { label: "Da accelerare", badge: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300", bar: "[&_[data-slot=progress-indicator]]:bg-amber-500" }
  return { label: "Da avviare", badge: "border-border bg-muted/50 text-muted-foreground", bar: "[&_[data-slot=progress-indicator]]:bg-muted-foreground" }
}

export function DashboardGoalsCard({ goals, periodLabel, loading, canConfigure }: { goals: DashboardGoal[]; periodLabel: string; loading: boolean; canConfigure: boolean }) {
  const rows = goals.map(({ goal, current }) => {
    const definition = getGoalMetricDefinition(goal.metric)
    const rawProgress = calculateGoalProgress(current, goal.targetValue, definition.direction)
    return { goal, current, definition, rawProgress, normalized: Math.min(100, rawProgress) }
  })
  const overall = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.normalized, 0) / rows.length) : 0
  const reached = rows.filter((row) => row.rawProgress >= 100).length
  const overallTone = tone(overall)

  return <Card className="min-h-0 overflow-hidden xl:max-h-[620px]">
    <CardHeader className="pb-3">
      <div className="flex items-start justify-between gap-3"><div><CardTitle>Obiettivi del periodo</CardTitle><CardDescription>Dati operativi reali · {periodLabel}</CardDescription></div><Badge variant="outline" className="shrink-0">{rows.length} attivi</Badge></div>
    </CardHeader>
    <CardContent className="flex min-h-0 flex-col gap-4">
      {loading ? <div className="space-y-4" aria-busy="true" aria-label="Caricamento obiettivi"><div className="flex items-center gap-4"><Skeleton className="size-20 rounded-full" /><div className="flex-1 space-y-2"><Skeleton className="h-4 w-36" /><Skeleton className="h-8 w-20" /><Skeleton className="h-3 w-full" /></div></div>{[0, 1, 2].map((item) => <Skeleton key={item} className="h-20 w-full" />)}</div> : rows.length ? <>
        <div className="rounded-xl border bg-muted/20 p-4">
          <div className="flex items-center gap-4"><div className="relative grid size-20 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--primary) ${overall * 3.6}deg, var(--muted) 0deg)` }}><div className="grid size-16 place-items-center rounded-full bg-card"><span className="text-xl font-semibold tabular-nums">{overall}%</span></div></div><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><p className="font-medium">Avanzamento complessivo</p><Badge variant="outline" className={overallTone.badge}>{overallTone.label}</Badge></div><p className="mt-1 text-sm text-muted-foreground"><CheckCircle2 className="mr-1 inline size-4" />{reached} {reached === 1 ? "obiettivo centrato" : "obiettivi centrati"} su {rows.length}</p><Progress aria-label={`Avanzamento complessivo ${overall}%`} className={`mt-3 ${overallTone.bar}`} value={overall} /></div></div>
        </div>
        <div className="min-h-0 space-y-2 overflow-y-auto pr-1">{rows.map((row) => { const status = tone(row.rawProgress); const content = <><div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium">{row.goal.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{formatGoalProgress(row.current, row.goal.targetValue, row.definition)}</p></div><div className="shrink-0 text-right"><span className="block text-sm font-semibold tabular-nums">{Math.round(row.rawProgress)}%</span><Badge variant="outline" className={`mt-1 text-[10px] ${status.badge}`}>{status.label}</Badge></div></div><Progress aria-label={`${row.goal.title}: ${Math.round(row.rawProgress)}%`} className={`mt-2 h-1.5 ${status.bar}`} value={row.normalized} /></>; return canConfigure ? <Link key={row.goal.id} href="/dashboard/impostazioni?section=goals" className="block rounded-lg border p-3 transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">{content}</Link> : <div key={row.goal.id} className="rounded-lg border p-3">{content}</div> })}</div>
      </> : <div className="grid min-h-48 place-items-center rounded-xl border border-dashed bg-muted/10 p-5 text-center"><div><Target className="mx-auto size-6 text-muted-foreground" /><p className="mt-2 text-sm font-medium">Nessun obiettivo attivo</p><p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">{canConfigure ? "Non risultano obiettivi autorizzati nel periodo selezionato." : "Non sono stati configurati obiettivi per questo periodo."}</p>{canConfigure && <Button asChild size="sm" variant="outline" className="mt-3"><Link href="/dashboard/impostazioni?section=goals"><Settings2 />Configura obiettivi</Link></Button>}</div></div>}
    </CardContent>
  </Card>
}
