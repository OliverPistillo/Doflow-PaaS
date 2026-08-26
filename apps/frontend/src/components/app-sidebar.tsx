"use client"

import * as React from "react"
import {
  Archive,
  BrainCircuit,
  CalendarDays,
  CircleHelp,
  ContactRound,
  FileText,
  Handshake,
  Headphones,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessageSquareText,
  PanelsTopLeft,
  ReceiptText,
  Settings,
  Trophy,
  Workflow,
  Zap,
} from "lucide-react"

import { NavMain, type NavigationGroup, type NavigationItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { Sidebar, SidebarContent, SidebarFooter, SidebarHeader, SidebarRail } from "@/components/ui/sidebar"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { usePlan } from "@/contexts/PlanContext"

const groups: NavigationGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Panoramica", url: "/dashboard", icon: LayoutDashboard },
      { title: "Inbox", url: "/dashboard/inbox", icon: Inbox, capability: "canReadNotifications" },
      { title: "Team Space", url: "/dashboard/team-space", icon: MessageSquareText, capability: "canViewProjects" },
      { title: "Flowboard", url: "/dashboard/flowboard", icon: Workflow, capability: "canViewProjects" },
      { title: "Company Intelligence", url: "/dashboard/company-intelligence", icon: BrainCircuit, capability: "canViewAssignedLeads", featureKey: "crm.sales-intel" },
      { title: "Bonus", url: "/dashboard/bonus", icon: Trophy, capability: "canViewOwnPoints" },
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

function filterItem(
  item: NavigationItem,
  hasCapability: ReturnType<typeof useDoflowIdentity>["hasCapability"],
  activeModules: ReadonlySet<string>,
): NavigationItem | null {
  const children = item.items?.flatMap((child) => {
    const filtered = filterItem(child, hasCapability, activeModules)
    return filtered ? [filtered] : []
  })
  const allowed = item.items
    ? Boolean(children?.length) || Boolean(item.capability && hasCapability(item.capability))
    : !item.capability || hasCapability(item.capability)
  return allowed && (!item.featureKey || activeModules.has(item.featureKey))
    ? { ...item, items: item.items ? children : undefined }
    : null
}

type AppSidebarProps = React.ComponentProps<typeof Sidebar> & {
  navigationGroups?: NavigationGroup[]
  tenantName?: string
  tenantSlug?: string
  footer?: React.ReactNode
}

function AppSidebarFrame({
  navigationGroups,
  tenantName,
  tenantSlug,
  footer,
  ...props
}: AppSidebarProps & { navigationGroups: NavigationGroup[] }) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-2 pb-1 pt-3">
        <TeamSwitcher name={tenantName} slug={tenantSlug} />
      </SidebarHeader>
      <SidebarContent className="gap-0 pb-1">
        <NavMain groups={navigationGroups} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/70 px-2 py-2">
        {footer ?? <NavUser />}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function DoflowAppSidebar(props: Omit<AppSidebarProps, "navigationGroups">) {
  const { hasCapability } = useDoflowIdentity()
  const { activeModules } = usePlan()
  const visibleGroups = groups.map((group) => ({
    ...group,
    items: group.items.flatMap((item) => {
      const filtered = filterItem(item, hasCapability, activeModules)
      return filtered ? [filtered] : []
    }),
  }))

  return <AppSidebarFrame navigationGroups={visibleGroups} {...props} />
}

export function AppSidebar({ navigationGroups, ...props }: AppSidebarProps) {
  if (navigationGroups) {
    return <AppSidebarFrame navigationGroups={navigationGroups} {...props} />
  }

  return <DoflowAppSidebar {...props} />
}
