import { LeadDetailPage } from "@/features/commercial/components/lead-detail/lead-detail-page"
import { pipelineStages } from "@/features/commercial/data/commercial-fixtures"

export default async function Page({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params
  return <LeadDetailPage leadId={leadId} stages={pipelineStages} />
}
