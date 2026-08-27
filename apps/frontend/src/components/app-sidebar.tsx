"use client"

import * as React from "react"
import { usePathname } from "next/navigation"
import {
  CalendarDays,
  FileText,
  Handshake,
  LayoutDashboard,
  ListTodo,
  Settings,
  UsersRound,
  CopyCheck,
  ReceiptText,
  Zap,
  Headphones,
  Inbox,
  ScanSearch,
  MessagesSquare,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { SidebarBrand } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import type { DoflowCapability } from "@/features/identity/permissions"
import { useCustomerInbox } from "@/features/inbox/customer-inbox-provider"
import { TeamSpaceSidebarContent, TeamSpaceSidebarFooter, TeamSpaceSidebarHeader } from "@/features/chat/team-space-sidebar"
import { FlowHelpButton } from "@/features/flow/flow-experience-provider"
import { usePlan } from "@/contexts/PlanContext"

export type NavigationItem = {
  title: string
  url: string
  icon?: typeof LayoutDashboard
  isActive?: boolean
  capability?: DoflowCapability
  items?: NavigationItem[]
  badge?: number | string
}

export const dashboardNavigationItems: NavigationItem[] = [
    {
      title: "Panoramica",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: true,
    },
    {
      title: "Inbox",
      url: "/dashboard/inbox",
      icon: Inbox,
      capability: "canReadNotifications",
    },
    {
      title: "Team Space",
      url: "/dashboard/team-space",
      icon: MessagesSquare,
      capability: "canViewProjects",
    },
    {
      title: "Commerciale",
      url: "/dashboard/commercial",
      icon: Handshake,
      capability: "canViewAssignedLeads",
      items: [
        {
          title: "Dashboard commerciale",
          url: "/dashboard/commercial",
          capability: "canViewAssignedLeads",
        },
        {
          title: "Tutti i lead",
          url: "/dashboard/commercial/leads",
          capability: "canViewAssignedLeads",
        },
        {
          title: "Pipeline",
          url: "/dashboard/commercial/pipeline",
          capability: "canViewAssignedLeads",
        },
        {
          title: "Campagne",
          url: "/dashboard/campagne",
          capability: "canViewCampaigns",
        },
        {
          title: "Analisi azienda",
          url: "/dashboard/company-intelligence",
          icon: ScanSearch,
          capability: "canViewAssignedLeads",
        },
        {
          title: "Duplicati",
          url: "/dashboard/duplicati",
          icon: CopyCheck,
          capability: "canInspectDuplicates",
        },
      ],
    },
    {
      title: "Clienti",
      url: "/dashboard/clienti",
      icon: UsersRound,
      capability: "canViewCustomers",
    },
    {
      title: "Lavoro",
      url: "/dashboard/attivita",
      icon: ListTodo,
      items: [
        { title: "Attività", url: "/dashboard/attivita", capability: "canViewActivities" },
        { title: "Progetti", url: "/dashboard/progetti", capability: "canViewProjects" },
        { title: "Flowboard", url: "/dashboard/flowboard", capability: "canViewProjects" },
        { title: "Scadenze", url: "/dashboard/scadenze", capability: "canViewProjects" },
      ],
    },
    {
      title: "Vendite",
      url: "/dashboard/vendite",
      icon: ReceiptText,
      items: [
        { title: "Catalogo", url: "/dashboard/catalogo", capability: "canViewSales" },
        { title: "Vendite", url: "/dashboard/vendite", capability: "canViewSales" },
        { title: "Ordini", url: "/dashboard/ordini", capability: "canViewOrders" },
        { title: "Pagamenti", url: "/dashboard/pagamenti", capability: "canManagePayments" },
        { title: "Preventivi", url: "/dashboard/preventivi", capability: "canViewQuotes" },
        { title: "Fatture locali", url: "/dashboard/fatture", capability: "canViewInvoices" },
        { title: "Contratti", url: "/dashboard/contratti", capability: "canViewContracts" },
        { title: "Rinnovi", url: "/dashboard/rinnovi", capability: "canViewRenewals" },
      ],
    },
    {
      title: "Calendario",
      url: "/dashboard/calendario",
      icon: CalendarDays,
      capability: "canViewActivities",
    },
    {
      title: "Supporto",
      url: "/dashboard/supporto",
      icon: Headphones,
    },
    {
      title: "Documenti",
      url: "/dashboard/documenti",
      icon: FileText,
      capability: "canViewProjects",
      items: [
        { title: "Documenti", url: "/dashboard/documenti", capability: "canViewProjects" },
        { title: "Archivio", url: "/dashboard/archivio", capability: "canManageArchive" },
      ],
    },
    {
      title: "Automazioni",
      url: "/dashboard/automazioni",
      icon: Zap,
      capability: "canViewAutomations",
    },
    {
      title: "Impostazioni",
      url: "/dashboard/impostazioni",
      icon: Settings,
    },
]

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname()
  const { hasCapability } = useDoflowIdentity()
  const { activeModules } = usePlan()
  const inbox = useCustomerInbox()
  const teamSpace = pathname === "/dashboard/team-space"
  const items = dashboardNavigationItems.flatMap((item) => {
    const children = item.items?.filter((child) => !child.capability || hasCapability(child.capability))
    const featureAllowed = item.url !== "/dashboard/company-intelligence" || activeModules.has("crm.sales-intel")
    const allowed = featureAllowed && (!item.capability || hasCapability(item.capability) || Boolean(children?.length))
    return allowed ? [{ ...item, badge: item.url === "/dashboard/inbox" ? inbox.unreadCount : undefined, items: item.items ? children : undefined }] : []
  })
  const primaryItems = items.filter((item) => !["Automazioni", "Impostazioni"].includes(item.title))
  const utilityItems = items.filter((item) => ["Automazioni", "Impostazioni"].includes(item.title))
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        {teamSpace ? <TeamSpaceSidebarHeader /> : <SidebarBrand />}
      </SidebarHeader>
      <SidebarContent data-flow-tour="flow-sidebar">
        {teamSpace ? <TeamSpaceSidebarContent /> : <><NavMain key={`main-${pathname}`} items={primaryItems} /><NavMain key={`utility-${pathname}`} items={utilityItems} label="Sistema" className="mt-auto" />{inbox.unreadCount > 0 ? <span className="sr-only" aria-live="polite">{inbox.unreadCount} messaggi Inbox non letti</span> : null}</>}
      </SidebarContent>
      <SidebarFooter>
        {teamSpace ? <TeamSpaceSidebarFooter /> : <><TeamSpaceSidebarFooter workspace /><FlowHelpButton /><NavUser /></>}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
