"use client"

import * as React from "react"
import Link from "next/link"
import { CalendarDays, Link2, MessageCircle } from "lucide-react"
import { usePathname } from "next/navigation"

import { GlobalSearch } from "@/components/global-search"
import { NotificationsMenu } from "@/components/notifications-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { useOptionalCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"

const ROUTE_LABELS: Array<[string, string[]]> = [
  ["/commercial/site-proposals", ["Builder"]],
  ["/dashboard/commercial/leads", ["Commerciale", "Tutti i lead"]],
  ["/dashboard/commercial/pipeline", ["Commerciale", "Pipeline"]],
  ["/dashboard/commercial", ["Commerciale"]],
  ["/dashboard/duplicati", ["Commerciale", "Duplicati"]],
  ["/dashboard/campagne", ["Commerciale", "Campagne"]],
  ["/dashboard/clienti", ["Clienti"]],
  ["/dashboard/attivita", ["Lavoro", "Attività"]],
  ["/dashboard/progetti", ["Lavoro", "Progetti"]],
  ["/dashboard/scadenze", ["Lavoro", "Scadenze"]],
  ["/dashboard/catalogo", ["Vendite", "Catalogo"]],
  ["/dashboard/ordini", ["Vendite", "Ordini"]],
  ["/dashboard/pagamenti", ["Vendite", "Pagamenti"]],
  ["/dashboard/preventivi", ["Vendite", "Preventivi"]],
  ["/dashboard/contratti", ["Vendite", "Contratti"]],
  ["/dashboard/fatture", ["Vendite", "Fatture locali"]],
  ["/dashboard/rinnovi", ["Vendite", "Rinnovi"]],
  ["/dashboard/vendite", ["Vendite"]],
  ["/dashboard/calendario", ["Calendario"]],
  ["/dashboard/supporto", ["Supporto"]],
  ["/dashboard/documenti", ["Documenti"]],
  ["/dashboard/archivio", ["Documenti", "Archivio"]],
  ["/dashboard/notifiche", ["Inbox"]],
  ["/dashboard/team-space", ["Team Space"]],
  ["/dashboard/flow-arcade", ["Flow Arcade"]],
  ["/dashboard/automazioni", ["Automazioni"]],
  ["/dashboard/impostazioni", ["Impostazioni"]],
]

function hrefForPart(part: string) {
  if (part === "Commerciale") return "/dashboard/commercial"
  if (part === "Lavoro") return "/dashboard/attivita"
  if (part === "Vendite") return "/dashboard/vendite"
  if (part === "Documenti") return "/dashboard/documenti"
  return "/dashboard"
}

export function DashboardHeader() {
  const pathname = usePathname()
  const commercial = useOptionalCommercialLeads()
  const { hasCapability } = useDoflowIdentity()
  const id = pathname.split("/").at(-1)
  const lead = pathname.includes("/leads/") ? commercial?.leads.find((item) => item.id === id) : undefined
  const customer = pathname.includes("/clienti/") ? commercial?.customers.find((item) => item.id === id) : undefined
  const project = pathname.includes("/progetti/") ? commercial?.projects.find((item) => item.id === id) : undefined
  const parts = [...(ROUTE_LABELS.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))?.[1] ?? ["Panoramica"])]
  if (lead) parts.push(lead.company)
  if (customer) parts.push(customer.profile.company)
  if (project) parts.push(project.name)

  return (
    <header className="sticky top-0 z-30 grid h-16 min-h-16 shrink-0 grid-cols-[minmax(0,1fr)_auto] items-center border-b bg-[var(--doflow-topbar)] backdrop-blur-xl xl:grid-cols-[minmax(250px,1fr)_minmax(360px,493px)_minmax(210px,1fr)]">
      <div className="flex min-w-0 items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1 shrink-0" />
        <Separator orientation="vertical" className="mx-1 h-5 shrink-0" />
        <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
          <BreadcrumbList className="flex-nowrap overflow-hidden">
            <BreadcrumbItem className="hidden shrink-0 sm:inline-flex"><BreadcrumbLink href="/dashboard">Workspace</BreadcrumbLink></BreadcrumbItem>
            {parts.map((part, index) => (
              <React.Fragment key={`${part}-${index}`}>
                <BreadcrumbSeparator className="hidden shrink-0 sm:block" />
                <BreadcrumbItem className={index === parts.length - 1 ? "min-w-0" : "shrink-0"}>
                  {index === parts.length - 1 ? <BreadcrumbPage className="block truncate">{part}</BreadcrumbPage> : <BreadcrumbLink href={hrefForPart(part)}>{part}</BreadcrumbLink>}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div className="hidden min-w-0 px-2 xl:block"><GlobalSearch /></div>
      <div className="flex min-w-0 items-center justify-end gap-0.5 pr-3 lg:pr-5">
        <div className="xl:hidden"><GlobalSearch compact /></div>
        {hasCapability("canUseBuilder") ? <HeaderAction href="/commercial/site-proposals" label="Apri Builder"><Link2 /></HeaderAction> : null}
        {hasCapability("canViewProjects") ? <HeaderAction href="/dashboard/team-space" label="Apri Team Space"><MessageCircle /></HeaderAction> : null}
        {hasCapability("canViewActivities") ? <HeaderAction href="/dashboard/calendario" label="Apri Calendario"><CalendarDays /></HeaderAction> : null}
        <NotificationsMenu />
        <ThemeToggle />
      </div>
    </header>
  )
}

function HeaderAction({ href, label, children }: { href: string; label: string; children: React.ReactNode }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild><Button asChild variant="ghost" size="icon"><Link href={href} aria-label={label}>{children}</Link></Button></TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
}
