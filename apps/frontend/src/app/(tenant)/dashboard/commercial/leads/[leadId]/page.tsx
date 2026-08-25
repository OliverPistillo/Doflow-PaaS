import { LeadDetailRoute } from "@/features/commercial/components/lead-detail/lead-detail-route"

export default async function Page({ params }: { params: Promise<{ leadId: string }> }) {
  const { leadId } = await params
  return <LeadDetailRoute leadId={leadId} />
}
