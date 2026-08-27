"use client"

import { CalendarDays, MinusCircle, Phone } from "lucide-react"

import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { presenceDotClasses, presenceLabels, type PresenceStatus } from "@/features/identity/presence"

export function PresenceIndicator({ status, showLabel = false, showDot = true, className = "" }: { status: PresenceStatus; showLabel?: boolean; showDot?: boolean; className?: string }) {
  const label = presenceLabels[status]
  const icon = status === "in_call" ? <Phone className="size-3" /> : status === "in_meeting" ? <CalendarDays className="size-3" /> : status === "do_not_disturb" ? <MinusCircle className="size-3" /> : null
  return <Tooltip><TooltipTrigger asChild><span data-presence-indicator className={`inline-flex shrink-0 items-center gap-1.5 ${className}`} aria-label={`Stato: ${label}`}>{showDot && <span data-presence-dot className={`size-2.5 rounded-full border-2 border-background ${presenceDotClasses[status]}`} />}{showLabel && <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">{icon}{label}</span>}</span></TooltipTrigger><TooltipContent>Stato: {label}</TooltipContent></Tooltip>
}
