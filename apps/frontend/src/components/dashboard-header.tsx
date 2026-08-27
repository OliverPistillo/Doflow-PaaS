"use client"

import { useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"

import { AgendaMenu } from "@/components/agenda-menu"
import { ThemeToggle } from "@/components/theme-toggle"
import { GlobalSearch } from "@/components/global-search"
import { NotificationsMenu } from "@/components/notifications-menu"
import { TeamChatMenu } from "@/components/team-chat-menu"
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { useCompanyIntelligence } from "@/features/company-intelligence/company-intelligence-provider"
import { BonusMenu } from "@/components/bonus-menu"
import { useTeamChat } from "@/features/chat/team-chat-provider"
import { chatConversationTitle } from "@/features/chat/team-chat"

export function DashboardHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [openMenu, setOpenMenu] = useState<"bonus" | "chat" | "agenda" | "notifications" | null>(() => searchParams.has("chat") ? "chat" : null)
  const { leads, customers, projects } = useCommercialLeads()
  const intelligence = useCompanyIntelligence()
  const teamChat = useTeamChat()
  const id = pathname.split("/").at(-1)
  const lead = pathname.includes("/leads/") ? leads.find((item) => item.id === id) : undefined
  const customer = pathname.includes("/clienti/") ? customers.find((item) => item.id === id) : undefined
  const project = pathname.includes("/progetti/") ? projects.find((item) => item.id === id) : undefined
  const intelligenceReport = pathname === "/dashboard/company-intelligence" ? intelligence.getReport(searchParams.get("report")) : undefined
  const teamSpaceConversation = pathname === "/dashboard/team-space" ? teamChat.conversations.find((item) => item.id === (searchParams.get("channel") ?? teamChat.conversations[0]?.id)) : undefined
  const parts = (pathname.includes("/commercial")
    ? ["Commerciale", pathname.includes("/leads") ? "Tutti i lead" : pathname.includes("/pipeline") ? "Pipeline" : undefined]
    : pathname.includes("/duplicati")
      ? ["Commerciale", "Duplicati"]
    : pathname.includes("/company-intelligence")
      ? ["Commerciale", "Analisi azienda", intelligenceReport ? `Report ${intelligenceReport.companyName}` : undefined]
    : pathname === "/dashboard/team-space"
      ? ["Team Space", teamSpaceConversation ? chatConversationTitle(teamSpaceConversation) : "Generale"]
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

  const breadcrumbHref = (part: string) => part === "Clienti"
    ? "/dashboard/clienti"
    : part === "Team Space"
      ? "/dashboard/team-space"
    : part === "Analisi azienda"
      ? "/dashboard/company-intelligence"
      : "/dashboard/commercial"

  return <header className="flex min-h-16 min-w-0 shrink-0 items-center gap-1 border-b bg-[var(--doflow-topbar)] px-2 transition-[width,height] ease-linear sm:gap-2 xl:px-4 group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
    <div className="flex min-w-0 flex-1 items-center gap-2 xl:basis-0"><SidebarTrigger className="shrink-0" /><Separator orientation="vertical" className="hidden h-4 shrink-0 sm:block" /><Breadcrumb className="min-w-0 flex-1 overflow-hidden"><BreadcrumbList className="flex-nowrap overflow-hidden"><BreadcrumbItem className="hidden shrink-0 lg:inline-flex"><BreadcrumbLink href="/dashboard">Workspace</BreadcrumbLink></BreadcrumbItem>{parts.map((part, index) => <span key={part} className="contents"><BreadcrumbSeparator className="hidden shrink-0 lg:block" /><BreadcrumbItem className={index === parts.length - 1 ? "min-w-0" : "hidden shrink-0 xl:inline-flex"}>{index === parts.length - 1 ? <BreadcrumbPage className="block truncate">{part}</BreadcrumbPage> : <BreadcrumbLink href={breadcrumbHref(part)}>{part}</BreadcrumbLink>}</BreadcrumbItem></span>)}{parts.length === 0 && <BreadcrumbItem className="min-w-0"><BreadcrumbPage className="block truncate">Panoramica</BreadcrumbPage></BreadcrumbItem>}</BreadcrumbList></Breadcrumb></div>
    <div data-flow-tour="flow-search" className="min-w-0 shrink-0 max-xl:[&>button]:w-9 max-xl:[&>button]:justify-center max-xl:[&>button]:px-0 max-xl:[&>button>span]:hidden max-xl:[&>button>kbd]:hidden"><GlobalSearch /></div>
    <div className="flex shrink-0 items-center justify-end"><BonusMenu open={openMenu === "bonus"} onOpenChange={(open) => setOpenMenu(open ? "bonus" : null)}/><TeamChatMenu open={openMenu === "chat"} onOpenChange={(open) => setOpenMenu(open ? "chat" : null)} /><AgendaMenu open={openMenu === "agenda"} onOpenChange={(open) => setOpenMenu(open ? "agenda" : null)} /><span data-flow-tour="flow-notifications"><NotificationsMenu open={openMenu === "notifications"} onOpenChange={(open) => setOpenMenu(open ? "notifications" : null)} /></span><ThemeToggle /></div>
  </header>
}
