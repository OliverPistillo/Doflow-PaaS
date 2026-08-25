"use client"

import { Flame, Medal, Trophy } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"
import { UserAvatar } from "@/components/user-avatar"
import { getCurrentRankingAwards, rankingMetricLabels, type CurrentRankingAward } from "@/features/commercial/commercial-rankings"
import type { RankingRole } from "@/features/commercial/components/commercial-leads-provider"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"

const month = new Intl.DateTimeFormat("it-IT", { month: "long", year: "numeric", timeZone: "UTC" })
const date = new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "long", year: "numeric", timeZone: "UTC" })
const compactLabels: Record<RankingRole, string> = { commercial: "Venditore #1", developer: "Sviluppatore #1", project_manager: "Project Manager #1", support: "Supporto #1" }

function awardDetail(award: CurrentRankingAward) {
  const metrics = Object.entries(award.metrics).map(([metric, value]) => `${rankingMetricLabels[metric as keyof typeof rankingMetricLabels]}: ${value}`).join(" · ")
  return `Conquistato per ${month.format(new Date(`${award.snapshot.period}-01T12:00:00Z`))}. Valido dal ${date.format(new Date(`${award.validFrom}T12:00:00Z`))} al ${date.format(new Date(`${award.validThrough}T12:00:00Z`))}. Punteggio ${award.score.toFixed(2)}. Vittorie totali ${award.totalWins}. Serie consecutiva ${award.consecutiveWins}. ${metrics}`
}

function Award({ award, compact = false }: { award: CurrentRankingAward; compact?: boolean }) {
  const detail = awardDetail(award)
  const Icon = compact ? Trophy : Medal
  return <Tooltip><TooltipTrigger asChild><Badge tabIndex={0} aria-label={`${award.label}. ${detail}`} className={cn("max-w-full border-amber-500/40 bg-amber-500/15 text-amber-800 dark:text-amber-200", compact ? "h-5 gap-0.5 border-amber-400/30 bg-amber-400/10 px-1.5 py-0 text-[10px] leading-none font-medium text-amber-700 dark:text-amber-300 [&>svg]:size-3!" : "h-auto py-1")} variant="outline"><Icon aria-hidden="true" className="shrink-0 text-amber-500" />{compact ? <><span className="hidden max-w-28 truncate min-[480px]:inline">{compactLabels[award.role]}</span><span className="min-[480px]:hidden">#1</span></> : <span className="truncate">{award.label}</span>}{!compact && award.totalWins > 1 && <span className="inline-flex items-center gap-0.5 border-l border-amber-500/30 pl-1.5"><Trophy aria-hidden="true" />{award.totalWins} vittorie</span>}{!compact && award.consecutiveWins > 1 && <span className="inline-flex items-center gap-0.5 border-l border-amber-500/30 pl-1.5"><Flame aria-hidden="true" />{award.consecutiveWins} mesi consecutivi</span>}</Badge></TooltipTrigger><TooltipContent className="max-w-80 text-pretty">{detail}</TooltipContent></Tooltip>
}

export function RankingWinnerBadges({ userId, roles, compact = false, className }: { userId: string; roles?: RankingRole[]; compact?: boolean; className?: string }) {
  const { rankingSnapshots } = useCommercialLeads()
  const awards = getCurrentRankingAwards(userId, rankingSnapshots).filter((award) => !roles || roles.includes(award.role))
  if (!awards.length) return null
  const visible = compact ? awards.slice(0, 1) : awards
  const hidden = compact ? awards.slice(1) : awards.slice(2)
  return <div className={cn("flex min-w-0 flex-wrap items-center gap-1", className)} aria-label="Premi classifiche correnti">
    <UserAvatar userId={userId} className={compact ? "size-5" : "size-7"} />
    {visible.map((award, index) => <span key={award.snapshot.id} className={!compact && index >= 2 ? "hidden sm:inline-flex" : "inline-flex min-w-0"}><Award award={award} compact={compact} /></span>)}
    {hidden.length > 0 && (compact ? <Tooltip><TooltipTrigger asChild><Badge tabIndex={0} variant="outline" className="h-5 px-1.5 py-0 text-[10px] leading-none" aria-label={`Altri ${hidden.length} premi. ${hidden.map((award) => `${award.label}. ${awardDetail(award)}`).join(" ")}`}>+{hidden.length}</Badge></TooltipTrigger><TooltipContent className="max-w-80 text-pretty">{hidden.map((award) => <span key={award.snapshot.id} className="block"><b>{award.label}</b>: {awardDetail(award)}</span>)}</TooltipContent></Tooltip> : <Popover><PopoverTrigger asChild><Badge asChild variant="outline" className="cursor-pointer sm:hidden"><button type="button" aria-label={`Mostra altri ${hidden.length} premi`}>+{hidden.length}</button></Badge></PopoverTrigger><PopoverContent className="w-80"><p className="mb-2 text-sm font-medium">Altri premi</p><div className="flex flex-col items-start gap-2">{hidden.map((award) => <Award key={award.snapshot.id} award={award} />)}</div></PopoverContent></Popover>)}
  </div>
}
