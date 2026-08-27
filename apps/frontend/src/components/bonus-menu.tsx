"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowRight, Coins, Gift, Loader2, Sparkles } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Progress } from "@/components/ui/progress"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { bonusApi, type BonusDashboard } from "@/lib/tenant-feature-api"

const euro = new Intl.NumberFormat("it-IT", { style: "currency", currency: "EUR" })
const dateTime = new Intl.DateTimeFormat("it-IT", { dateStyle: "medium", timeStyle: "short" })

type BonusMenuProps = { open?: boolean; onOpenChange?: (open: boolean) => void }

export function BonusMenu({ open: controlledOpen, onOpenChange }: BonusMenuProps) {
  const identity = useDoflowIdentity()
  const [internalOpen, setInternalOpen] = React.useState(false)
  const [dashboard, setDashboard] = React.useState<BonusDashboard>()
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState("")
  const open = controlledOpen ?? internalOpen
  const loadDashboard = React.useCallback(() => {
    if (dashboard || loading) return
    setLoading(true)
    void bonusApi.dashboard()
      .then((value) => {
        setDashboard(value)
        setError("")
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Bonus non disponibile."))
      .finally(() => setLoading(false))
  }, [dashboard, loading])
  const setOpen = (value: boolean) => {
    if (controlledOpen === undefined) setInternalOpen(value)
    onOpenChange?.(value)
    if (value) loadDashboard()
  }
  React.useEffect(() => {
    if (!open) return
    const timer = window.setTimeout(loadDashboard, 0)
    return () => window.clearTimeout(timer)
  }, [loadDashboard, open])

  if (!identity.hasCapability("canViewOwnPoints")) return null

  const wallet = dashboard?.wallet
  const available = wallet?.availablePoints ?? 0
  const threshold = wallet?.minimumRequestPoints ?? dashboard?.policy?.minimumRequestPoints ?? 100
  const latest = dashboard?.ledger.filter((entry) => entry.points > 0).slice(0, 3) ?? []
  const valueCents = wallet?.euroValueCents ?? available * (dashboard?.policy?.pointEuroCents ?? 0)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <Tooltip>
        <TooltipTrigger asChild>
          <PopoverTrigger asChild>
            <Button size="icon" variant="ghost" className="relative shrink-0" aria-label="Bonus e punti">
              <Coins />
            </Button>
          </PopoverTrigger>
        </TooltipTrigger>
        <TooltipContent>Bonus e punti</TooltipContent>
      </Tooltip>
      <PopoverContent align="end" sideOffset={8} className="flex max-h-[min(82dvh,680px)] w-[calc(100vw-24px)] max-w-[440px] flex-col overflow-hidden p-0">
        <header className="shrink-0 border-b bg-gradient-to-br from-violet-500/10 via-indigo-500/5 to-transparent p-4">
          <div className="flex items-center gap-2">
            <span className="grid size-9 place-items-center rounded-lg bg-violet-500/15 text-violet-700 dark:text-violet-300"><Coins className="size-5" /></span>
            <div><h2 className="font-semibold">Il tuo Bonus</h2><p className="text-xs text-muted-foreground">Saldo server-backed del tenant</p></div>
          </div>
          <p className="mt-3 text-xl font-semibold">{available} punti consolidati</p>
          <p className="text-sm text-muted-foreground">Valore indicativo: {wallet ? euro.format(valueCents / 100) : "—"}</p>
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs"><span>{available} / {threshold} punti</span><span>{Math.min(100, Math.round(available / Math.max(1, threshold) * 100))}%</span></div>
            <Progress value={Math.min(100, available / Math.max(1, threshold) * 100)} className="h-2" />
          </div>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
          {loading ? <p className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" />Caricamento portafoglio…</p> : null}
          {!loading && error ? <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p> : null}
          {!loading && dashboard && wallet ? (
            <>
              <section className="grid grid-cols-2 gap-2" aria-label="Riepilogo portafoglio">
                <Summary label="Consolidati" value={String(wallet.availablePoints) + " pt"} icon={<Coins />} />
                <Summary label="Valore indicativo" value={euro.format(valueCents / 100)} icon={<Gift />} />
                <Summary label="Provvisori" value={String(wallet.provisionalPoints ?? 0) + " pt"} icon={<Sparkles />} />
                <Summary label="Riservati" value={String(wallet.reservedPoints ?? 0) + " pt"} icon={<Coins />} />
              </section>
              <section>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ultimi movimenti</h3>
                {latest.length ? <div className="space-y-2">{latest.map((entry) => (
                  <div key={entry.id} className="rounded-lg border p-3">
                    <div className="flex items-start justify-between gap-2"><strong className="text-sm">+{entry.points} pt</strong><Badge variant="outline" className="text-[10px]">{entry.bucket ?? entry.status}</Badge></div>
                    <p className="mt-1 line-clamp-2 text-xs">{entry.reason}</p>
                    <time className="mt-1 block text-[11px] text-muted-foreground">{dateTime.format(new Date(entry.occurredAt))}</time>
                  </div>
                ))}</div> : <p className="rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">Nessun movimento registrato.</p>}
              </section>
            </>
          ) : null}
        </div>
        <footer className="border-t bg-background p-3">
          <Button asChild variant="outline" className="min-h-11 w-full"><Link href="/dashboard/bonus" onClick={() => setOpen(false)}>Apri Portafoglio<ArrowRight /></Link></Button>
        </footer>
      </PopoverContent>
    </Popover>
  )
}

function Summary({ label, value, icon }: { label: string; value: string; icon: React.ReactNode }) {
  return <div className="min-w-0 rounded-lg border bg-muted/20 p-2.5"><span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}{label}</span><strong className="mt-1 block truncate text-base" title={value}>{value}</strong></div>
}
