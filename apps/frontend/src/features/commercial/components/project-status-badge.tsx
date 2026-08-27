import { Badge } from "@/components/ui/badge"
import type { CommercialProject } from "@/features/commercial/components/commercial-leads-provider"
import { getProjectStatusVisual } from "@/features/commercial/commercial-production"

export function ProjectStatusBadge({ status, className = "" }: { status: CommercialProject["status"]; className?: string }) {
  const visual = getProjectStatusVisual(status)
  const Icon = visual.icon
  return <Badge variant="outline" className={`gap-1 whitespace-nowrap ${visual.badgeClass} ${className}`} aria-label={`Stato progetto: ${visual.label}`}><Icon className="size-3.5 shrink-0" aria-hidden="true" />{visual.label}</Badge>
}
