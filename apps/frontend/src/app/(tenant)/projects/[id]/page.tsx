import Link from "next/link"
import { notFound } from "next/navigation"
import { Badge } from "@/components/ui/badge"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { dashboardProjects } from "@/features/dashboard/data/dashboard-fixtures"

export default async function ProjectDetailPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params
  const project = dashboardProjects.find((item) => item.id === projectId)
  if (!project) notFound()

  return <main className="mx-auto w-full max-w-3xl space-y-6 p-4 md:p-6">
    <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink href="/dashboard">Workspace</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator/><BreadcrumbItem><BreadcrumbLink href="/dashboard">Panoramica</BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator/><BreadcrumbItem><BreadcrumbPage>{project.name}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
    <Card><CardHeader><div className="flex flex-wrap items-center gap-2"><CardTitle>{project.name}</CardTitle><Badge variant="secondary">Dati demo</Badge></div></CardHeader><CardContent className="space-y-4"><p className="text-sm text-muted-foreground">{project.client} · Avanzamento {project.progress}% · Consegna {project.deadline}</p><Button asChild variant="outline"><Link href="/dashboard">Torna alla Panoramica</Link></Button></CardContent></Card>
  </main>
}
