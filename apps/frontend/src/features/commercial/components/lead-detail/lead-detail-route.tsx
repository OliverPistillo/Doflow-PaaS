"use client"

import { LeadDetailPage } from "@/features/commercial/components/lead-detail/lead-detail-page"
import { pipelineStages } from "@/features/commercial/pipeline-stages"

export function LeadDetailRoute({ leadId }: { leadId: string }) {
  return <LeadDetailPage leadId={leadId} stages={pipelineStages} />
}
