import { CommercialActivitiesPage } from "@/features/commercial/components/commercial-activities-page"

export default async function Page({ searchParams }: { searchParams: Promise<{ activityId?: string }> }) {
  const { activityId } = await searchParams
  return <CommercialActivitiesPage initialActivityId={activityId} />
}
