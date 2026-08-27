"use client"

import * as React from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { AgendaMenu } from "@/components/agenda-menu"
import { BonusMenu } from "@/components/bonus-menu"
import { GlobalSearch } from "@/components/global-search"
import { NotificationsMenu } from "@/components/notifications-menu"
import { TeamChatMenu } from "@/components/team-chat-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useOptionalCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"

const ROUTE_LABELS: Array<[string, string[]]> = [
  ["/commercial/site-proposals", ["Builder"]],
  ["/dashboard/commercial/leads", ["Commerciale", "Tutti i lead"]],
  ["/dashboard/commercial/pipeline", ["Commerciale", "Pipeline"]],
  ["/dashboard/commercial", ["Commerciale"]],
  ["/dashboard/company-intelligence", ["Commerciale", "Analisi azienda"]],
  ["/dashboard/duplicati", ["Commerciale", "Duplicati"]],
  ["/dashboard/campagne", ["Commerciale", "Campagne"]],
  ["/dashboard/clienti", ["Clienti"]],
  ["/dashboard/attivita", ["Lavoro", "Attività"]],
  ["/dashboard/progetti", ["Lavoro", "Progetti"]],
  ["/dashboard/flowboard", ["Lavoro", "Flowboard"]],
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
  ["/dashboard/team-space", ["Team Space"]],
  ["/dashboard/inbox", ["Inbox"]],
  ["/dashboard/bonus", ["Bonus"]],
  ["/dashboard/notifiche", ["Notifiche"]],
  ["/dashboard/automazioni", ["Automazioni"]],
  ["/dashboard/impostazioni", ["Impostazioni"]],
]

function hrefForPart(part: string) {
  if (part === "Commerciale") return "/dashboard/commercial"
  if (part === "Lavoro") return "/dashboard/attivita"
  if (part === "Vendite") return "/dashboard/vendite"
  if (part === "Documenti") return "/dashboard/documenti"
  if (part === "Team Space") return "/dashboard/team-space"
  return "/dashboard"
}

export function DashboardHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const commercial = useOptionalCommercialLeads()
  const [openMenu, setOpenMenu] = React.useState<"bonus" | "chat" | "agenda" | "notifications" | null>(
    () => searchParams.has("chat") ? "chat" : null,
  )
  const id = pathname.split("/").at(-1)
  const lead = pathname.includes("/leads/") ? commercial?.leads.find((item) => item.id === id) : undefined
  const customer = pathname.includes("/clienti/") ? commercial?.customers.find((item) => item.id === id) : undefined
  const project = pathname.includes("/progetti/") ? commercial?.projects.find((item) => item.id === id) : undefined
  const parts = [...(ROUTE_LABELS.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix + "/"))?.[1] ?? ["Panoramica"])]
  if (lead) parts.push(lead.company)
  if (customer) parts.push(customer.profile.company)
  if (project) parts.push(project.name)

  return (
    <header className="flex min-h-16 min-w-0 shrink-0 items-center gap-1 border-b bg-[var(--doflow-topbar)] px-2 transition-[width,height] ease-linear sm:gap-2 xl:px-4 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
      <div className="flex min-w-0 flex-1 items-center gap-2 xl:basis-0">
        <SidebarTrigger className="shrink-0" />
        <Separator orientation="vertical" className="hidden h-4 shrink-0 sm:block" />
        <Breadcrumb className="min-w-0 flex-1 overflow-hidden">
          <BreadcrumbList className="flex-nowrap overflow-hidden">
            <BreadcrumbItem className="hidden shrink-0 lg:inline-flex"><BreadcrumbLink href="/dashboard">Workspace</BreadcrumbLink></BreadcrumbItem>
            {parts.map((part, index) => (
              <React.Fragment key={part + "-" + index}>
                <BreadcrumbSeparator className="hidden shrink-0 lg:block" />
                <BreadcrumbItem className={index === parts.length - 1 ? "min-w-0" : "hidden shrink-0 xl:inline-flex"}>
                  {index === parts.length - 1
                    ? <BreadcrumbPage className="block truncate">{part}</BreadcrumbPage>
                    : <BreadcrumbLink href={hrefForPart(part)}>{part}</BreadcrumbLink>}
                </BreadcrumbItem>
              </React.Fragment>
            ))}
          </BreadcrumbList>
        </Breadcrumb>
      </div>
      <div data-flow-tour="flow-search" className="min-w-0 shrink-0 max-xl:[&>button]:w-9 max-xl:[&>button]:justify-center max-xl:[&>button]:px-0 max-xl:[&>button>span]:hidden max-xl:[&>button>kbd]:hidden">
        <GlobalSearch />
      </div>
      <div className="flex shrink-0 items-center justify-end">
        <BonusMenu open={openMenu === "bonus"} onOpenChange={(open) => setOpenMenu(open ? "bonus" : null)} />
        <TeamChatMenu open={openMenu === "chat"} onOpenChange={(open) => setOpenMenu(open ? "chat" : null)} />
        <AgendaMenu open={openMenu === "agenda"} onOpenChange={(open) => setOpenMenu(open ? "agenda" : null)} />
        <span data-flow-tour="flow-notifications">
          <NotificationsMenu open={openMenu === "notifications"} onOpenChange={(open) => setOpenMenu(open ? "notifications" : null)} />
        </span>
        <ThemeToggle />
      </div>
    </header>
  )
}
