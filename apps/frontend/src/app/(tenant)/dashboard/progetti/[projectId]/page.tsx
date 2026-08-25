import { CommercialProjectDetailPage } from "@/features/commercial/components/commercial-project-detail-page"

export default async function Page({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  return <CommercialProjectDetailPage projectId={projectId} />
}
