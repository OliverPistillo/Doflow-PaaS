"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  Archive,
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
  ScanSearch,
  Settings,
  Zap,
} from "lucide-react"

import { NavMain, type NavigationGroup, type NavigationItem } from "@/components/nav-main"
import { NavUser } from "@/components/nav-user"
import { TeamSwitcher } from "@/components/team-switcher"
import { TeamSpaceSidebarContent, TeamSpaceSidebarFooter, TeamSpaceSidebarHeader } from "@/components/tenant-collaboration/team-space-sidebar"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar"
import { useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { usePlan } from "@/contexts/PlanContext"
import { getTenantNotificationSummary } from "@/lib/tenant-notifications-api"

const groups: NavigationGroup[] = [
  {
    label: "Workspace",
    items: [
      { title: "Panoramica", url: "/dashboard", icon: LayoutDashboard },
      { title: "Inbox", url: "/dashboard/inbox", icon: Inbox, capability: "canReadNotifications" },
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
          { title: "Analisi azienda", url: "/dashboard/company-intelligence", icon: ScanSearch, capability: "canViewAssignedLeads", featureKey: "crm.sales-intel" },
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

function HelpMenu() {
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <SidebarMenuButton asChild tooltip="Aiuto e tutorial">
          <Link href="/dashboard/supporto?view=tutorial"><CircleHelp /><span>Aiuto e tutorial</span></Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}

function AppSidebarFrame({
  navigationGroups,
  tenantName,
  tenantSlug,
  footer,
  ...props
}: AppSidebarProps & { navigationGroups: NavigationGroup[] }) {
  const pathname = usePathname()

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader className="px-2 pb-1 pt-3">
        <TeamSwitcher name={tenantName} slug={tenantSlug} />
      </SidebarHeader>
      <SidebarContent className="gap-0 pb-1">
        <NavMain key={pathname} groups={navigationGroups} />
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/70 px-2 py-2">
        {footer ?? <><HelpMenu /><NavUser /></>}
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}

function DoflowAppSidebar(props: Omit<AppSidebarProps, "navigationGroups">) {
  const pathname = usePathname()
  const { hasCapability } = useDoflowIdentity()
  const { activeModules } = usePlan()
  const [unreadCount, setUnreadCount] = React.useState(0)
  const teamSpace = pathname === "/dashboard/team-space"

  React.useEffect(() => {
    if (!hasCapability("canReadNotifications")) return
    let active = true
    const timer = window.setTimeout(() => {
      void getTenantNotificationSummary().then((summary) => {
        if (active) setUnreadCount(summary.unreadNotifications)
      }).catch(() => {
        if (active) setUnreadCount(0)
      })
    }, 0)
    return () => {
      active = false
      window.clearTimeout(timer)
    }
  }, [hasCapability])

  const visibleGroups = groups.map((group) => ({
    ...group,
    items: group.items.flatMap((item) => {
      const filtered = filterItem(item, hasCapability, activeModules)
      return filtered ? [{ ...filtered, badge: filtered.url === "/dashboard/inbox" && unreadCount > 0 ? unreadCount : filtered.badge }] : []
    }),
  }))

  if (teamSpace) {
    return (
      <Sidebar collapsible="icon" {...props}>
        <SidebarHeader><TeamSpaceSidebarHeader /></SidebarHeader>
        <SidebarContent data-flow-tour="flow-sidebar"><TeamSpaceSidebarContent /></SidebarContent>
        <SidebarFooter className="border-t border-sidebar-border/70 px-2 py-2"><TeamSpaceSidebarFooter /></SidebarFooter>
        <SidebarRail />
      </Sidebar>
    )
  }

  return <AppSidebarFrame navigationGroups={visibleGroups} {...props} />
}

export function AppSidebar({ navigationGroups, ...props }: AppSidebarProps) {
  if (navigationGroups) {
    return <AppSidebarFrame navigationGroups={navigationGroups} {...props} />
  }

  return <DoflowAppSidebar {...props} />
}
