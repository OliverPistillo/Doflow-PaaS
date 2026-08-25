import { CommerceOrderDetailPage } from "@/features/commercial/components/commerce-order-detail-page"

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <CommerceOrderDetailPage orderId={id} />
}
