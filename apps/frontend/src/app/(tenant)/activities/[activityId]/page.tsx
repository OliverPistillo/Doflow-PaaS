import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { dashboardActivities } from "@/features/dashboard/data/dashboard-fixtures"

export default async function ActivityDetailPage({ params }: { params: Promise<{ activityId: string }> }) {
  const { activityId } = await params
  const activity = dashboardActivities.find((item) => item.id === activityId)
  if (!activity) notFound()

  return <main className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
    <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="/dashboard">Workspace</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator/><BreadcrumbItem><BreadcrumbLink href="/dashboard">Panoramica</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator/><BreadcrumbItem><BreadcrumbPage>{activity.title}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
    <Card><CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle>{activity.title}</CardTitle><Badge variant="secondary">Dati demo</Badge></div></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{activity.client} · {activity.time}</p><Button asChild variant="outline"><Link href="/dashboard">Torna alla Panoramica</Link></Button></CardContent></Card>
  </main>
}
