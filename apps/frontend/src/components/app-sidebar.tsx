"use client"

import * as React from "react"
import {
  CalendarClock,
  FileText,
  FolderKanban,
  Handshake,
  LayoutDashboard,
  ListTodo,
  Settings,
  UsersRound,
  CopyCheck,
  Workflow,
  ReceiptText,
  FileSignature,
  Repeat2,
  Archive,
  Megaphone,
  Zap,
  PanelsTopLeft,
} from "lucide-react"

import { NavMain } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import type { DoflowCapability } from "@/features/identity/permissions"

type NavigationItem = {
  title: string
  url: string
  icon?: typeof LayoutDashboard
  isActive?: boolean
  capability?: DoflowCapability
  items?: NavigationItem[]
}
const data: { teams: Array<{ name: string; logo: typeof Workflow; plan: string }>; navMain: NavigationItem[] } = {
  teams: [
    {
      name: "DoFlow Workspace",
      logo: Workflow,
      plan: "Workspace",
    },
  ],
  navMain: [
    {
      title: "Panoramica",
      url: "/dashboard",
      icon: LayoutDashboard,
      isActive: true,
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
          title: "Duplicati",
          url: "/dashboard/duplicati",
          icon: CopyCheck,
          capability: "canInspectDuplicates",
        },
      ],
    },
    {
      title: "Campagne",
      url: "/dashboard/campagne",
      icon: Megaphone,
      capability: "canViewCampaigns",
    },
    {
      title: "Clienti",
      url: "/dashboard/clienti",
      icon: UsersRound,
      capability: "canViewCustomers",
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
      ],
    },
    {
      title: "Contratti",
      url: "/dashboard/contratti",
      icon: FileSignature,
      capability: "canViewContracts",
    },
    {
      title: "Rinnovi",
      url: "/dashboard/rinnovi",
      icon: Repeat2,
      capability: "canViewRenewals",
    },
    {
      title: "Attività",
      url: "/dashboard/attivita",
      icon: ListTodo,
      capability: "canViewActivities",
    },
    {
      title: "Progetti",
      url: "/dashboard/progetti",
      icon: FolderKanban,
      capability: "canViewProjects",
    },
    {
      title: "Scadenze",
      url: "/dashboard/scadenze",
      icon: CalendarClock,
      capability: "canViewProjects",
    },
    {
      title: "Documenti",
      url: "/dashboard/documenti",
      icon: FileText,
      capability: "canViewProjects",
    },
    {
      title: "Archivio",
      url: "/dashboard/archivio",
      icon: Archive,
      capability: "canManageArchive",
    },
    {
      title: "Automazioni",
      url: "/dashboard/automazioni",
      icon: Zap,
      capability: "canViewAutomations",
    },
    {
      title: "Builder",
      url: "/commercial/site-proposals",
      icon: PanelsTopLeft,
      capability: "canUseBuilder",
    },
    {
      title: "Impostazioni",
      url: "/dashboard/impostazioni",
      icon: Settings,
    },
  ],
}

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { hasCapability } = useDoflowIdentity()
  const items = data.navMain.flatMap((item) => {
    const children = item.items?.filter((child) => !child.capability || hasCapability(child.capability))
    const allowed = !item.capability || hasCapability(item.capability) || Boolean(children?.length)
    return allowed ? [{ ...item, items: item.items ? children : undefined }] : []
  })
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={items} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
