import { CommercialClientDetailPage } from "@/features/commercial/components/commercial-client-detail-page"

export default async function Page({ params }: { params: Promise<{ clientId: string }> }) {
  const { clientId } = await params
  return <CommercialClientDetailPage clientId={clientId} />
}
