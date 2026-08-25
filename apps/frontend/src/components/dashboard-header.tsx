"use client"

import { usePathname } from "next/navigation"

import { ThemeToggle } from "@/components/theme-toggle"
import { GlobalSearch } from "@/components/global-search"
import { NotificationsMenu } from "@/components/notifications-menu"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useOptionalCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"

export function DashboardHeader() {
  const pathname = usePathname()
  const commercial = useOptionalCommercialLeads()
  const leads = commercial?.leads ?? []
  const customers = commercial?.customers ?? []
  const projects = commercial?.projects ?? []
  const id = pathname.split("/").at(-1)
  const lead = pathname.includes("/leads/") ? leads.find((item) => item.id === id) : undefined
  const customer = pathname.includes("/clienti/") ? customers.find((item) => item.id === id) : undefined
  const project = pathname.includes("/progetti/") ? projects.find((item) => item.id === id) : undefined
  const parts = (pathname.includes("/commercial")
    ? ["Commerciale", pathname.includes("/leads") ? "Tutti i lead" : pathname.includes("/pipeline") ? "Pipeline" : undefined]
    : pathname.includes("/duplicati")
      ? ["Commerciale", "Duplicati"]
    : pathname.includes("/progetti")
      ? ["Progetti"]
      : pathname.includes("/clienti")
        ? ["Clienti"]
        : pathname.includes("/notifiche")
          ? ["Notifiche"]
      : [])
    .filter(Boolean) as string[]
  if (lead) parts.push(lead.company)
  if (customer) parts.push(customer.profile.company)
  if (project) parts.push(project.name)

  return <header className="grid min-h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-b bg-[var(--doflow-topbar)] transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
    <div className="flex min-w-0 items-center gap-2 px-4"><SidebarTrigger className="-ml-1 shrink-0" /><Separator orientation="vertical" className="mr-2 h-4 shrink-0" /><Breadcrumb className="min-w-0 flex-1 overflow-hidden"><BreadcrumbList className="flex-nowrap overflow-hidden"><BreadcrumbItem className="hidden shrink-0 md:inline-flex"><BreadcrumbLink href="/dashboard">Workspace</BreadcrumbLink></BreadcrumbItem>{parts.map((part, index) => <span key={part} className="contents"><BreadcrumbSeparator className="hidden shrink-0 md:block" /><BreadcrumbItem className={index === parts.length - 1 ? "min-w-0" : "shrink-0"}>{index === parts.length - 1 ? <BreadcrumbPage className="block truncate">{part}</BreadcrumbPage> : <BreadcrumbLink href={part === "Clienti" ? "/dashboard/clienti" : "/dashboard/commercial"}>{part}</BreadcrumbLink>}</BreadcrumbItem></span>)}{parts.length === 0 && <><BreadcrumbSeparator className="hidden shrink-0 md:block" /><BreadcrumbItem className="min-w-0"><BreadcrumbPage className="block truncate">Panoramica</BreadcrumbPage></BreadcrumbItem></>}</BreadcrumbList></Breadcrumb></div>
    {commercial ? <GlobalSearch /> : <div aria-hidden="true" />}
    <div className="flex min-w-0 items-center justify-end pr-1"><NotificationsMenu /><ThemeToggle /></div>
  </header>
}
