"use client"

import * as React from "react"
import {
  Archive,
  CalendarDays,
  CircleHelp,
  ContactRound,
  FileText,
  Gamepad2,
  Handshake,
  Headphones,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  PanelsTopLeft,
  ReceiptText,
  Settings,
  Zap,
} from "lucide-react"

import { NavMain, type NavigationGroup, type NavigationItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"

const groups: NavigationGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Panoramica", url: "/dashboard", icon: LayoutDashboard },
      { title: "Inbox", url: "/dashboard/notifiche", icon: Inbox, capability: "canReadNotifications" },
      { title: "Team Space", url: "/dashboard/team-space", icon: MessageSquareText, capability: "canViewProjects" },
      {
        title: "Commerciale",
        url: "/dashboard/commercial",
        icon: Handshake,
        capability: "canViewAssignedLeads",
        items: [
          { title: "Dashboard commerciale", url: "/dashboard/commercial", capability: "canViewAssignedLeads" },
          { title: "Tutti i lead", url: "/dashboard/commercial/leads", capability: "canViewAssignedLeads" },
          { title: "Pipeline", url: "/dashboard/commercial/pipeline", capability: "canViewAssignedLeads" },
          { title: "Campagne", url: "/dashboard/campagne", capability: "canViewCampaigns" },
          { title: "Duplicati", url: "/dashboard/duplicati", capability: "canInspectDuplicates" },
        ],
      },
      { title: "Builder", url: "/commercial/site-proposals", icon: PanelsTopLeft, capability: "canUseBuilder" },
      { title: "Clienti", url: "/dashboard/clienti", icon: ContactRound, capability: "canViewCustomers" },
      {
        title: "Lavoro",
        url: "/dashboard/attivita",
        icon: ListChecks,
        items: [
          { title: "Attività", url: "/dashboard/attivita", capability: "canViewActivities" },
          { title: "Progetti", url: "/dashboard/progetti", capability: "canViewProjects" },
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
          { title: "Contratti", url: "/dashboard/contratti", capability: "canViewContracts" },
          { title: "Fatture locali", url: "/dashboard/fatture", capability: "canViewInvoices" },
          { title: "Rinnovi", url: "/dashboard/rinnovi", capability: "canViewRenewals" },
        ],
      },
      { title: "Calendario", url: "/dashboard/calendario", icon: CalendarDays, capability: "canViewActivities" },
      { title: "Supporto", url: "/dashboard/supporto", icon: Headphones },
      {
        title: "Documenti",
        url: "/dashboard/documenti",
        icon: FileText,
        items: [
          { title: "Documenti", url: "/dashboard/documenti", capability: "canViewProjects" },
          { title: "Archivio", url: "/dashboard/archivio", icon: Archive, capability: "canManageArchive" },
        ],
      },
    ],
  },
  {
    label: "Pausa",
    items: [{ title: "Flow Arcade", url: "/dashboard/flow-arcade", icon: Gamepad2 }],
  },
  {
    label: "Sistema",
    placement: "bottom",
    items: [
      { title: "Automazioni", url: "/dashboard/automazioni", icon: Zap, capability: "canViewAutomations" },
      { title: "Impostazioni", url: "/dashboard/impostazioni", icon: Settings },
    ],
  },
  {
    label: "",
    separated: true,
    items: [{ title: "Aiuto e tutorial", url: "/dashboard/supporto?view=tutorial", icon: CircleHelp }],
  },
]

function filterItem(item: NavigationItem, hasCapability: ReturnType<typeof useDoflowIdentity>["hasCapability"]): NavigationItem | null {
  const children = item.items?.flatMap((child) => {
    const filtered = filterItem(child, hasCapability)
    return filtered ? [filtered] : []
  })
  const allowed = item.items
    ? Boolean(children?.length) || Boolean(item.capability && hasCapability(item.capability))
    : !item.capability || hasCapability(item.capability)
  return allowed ? { ...item, items: item.items ? children : undefined } : null
}

export function AppSidebar(props: React.ComponentProps<typeof Sidebar>) {
  const { hasCapability } = useDoflowIdentity()
  const visibleGroups = groups.map((group) => ({
    ...group,
    items: group.items.flatMap((item) => {
      const filtered = filterItem(item, hasCapability)
      return filtered ? [filtered] : []
    }),
  }))

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-2 pb-1 pt-3">
        <TeamSwitcher />
      </SidebarHeader>
      <SidebarContent className="gap-0 pb-1">
        <NavMain groups={visibleGroups} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/70 px-2 py-2">
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
