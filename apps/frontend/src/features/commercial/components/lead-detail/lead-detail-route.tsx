"use client"

import { LeadDetailPage } from "@/features/commercial/components/lead-detail/lead-detail-page"
import { pipelineStages } from "@/features/commercial/pipeline-stages"
import { useCommercialTeam } from "@/features/commercial/use-commercial-team"

export function LeadDetailRoute({ leadId }: { leadId: string }) {
  const team = useCommercialTeam()
  return <LeadDetailPage leadId={leadId} team={team} stages={pipelineStages} />
}
