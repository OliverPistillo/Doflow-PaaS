"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, Plus } from "lucide-react"

import { moduleKeyForTenantPath } from "@/config/tenant-navigation"
import { TenantSidebar } from "@/components/layout/tenant-sidebar"
import { ThemeSettingsDrawer } from "@/components/layout/theme-settings-drawer"
import { UserNav } from "@/components/layout/user-nav"
import { Button } from "@/components/ui/button"
import { SearchTriggerButton } from "@/components/ui/global-search"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PlanProvider } from "@/contexts/PlanContext"
import { AppSettingsProvider, useAppSettings } from "@/contexts/AppSettingsContext"
import { TenantAccessProvider, useTenantAccess } from "@/contexts/TenantAccessContext"

function TenantRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { loading, canView } = useTenantAccess()
  const moduleKey = React.useMemo(() => moduleKeyForTenantPath(pathname), [pathname])
  React.useEffect(() => {
    if (!loading && moduleKey && !canView(moduleKey)) router.replace("/dashboard")
  }, [loading, moduleKey, canView, router])
  if (loading) return <div className="p-6 text-sm text-muted-foreground">Caricamento permessi...</div>
  if (moduleKey && !canView(moduleKey)) return <div className="p-6 text-sm text-muted-foreground">Reindirizzamento...</div>
  return <>{children}</>
}

function LegacyTenantLayout({ children }: { children: React.ReactNode }) {
  const { sidebarVariant } = useAppSettings()
  const { canCreate } = useTenantAccess()
  return (
    <SidebarProvider
      mobileWidth="280px"
      data-sidebar-kind="tenant-legacy"
      style={{ "--sidebar-width": "280px", "--sidebar-width-icon": "72px" } as React.CSSProperties}
    >
      <TenantSidebar variant={sidebarVariant} collapsible="icon" />
      <SidebarInset>
        <header className="doflow-topbar sticky top-0 z-20 flex h-[72px] shrink-0 items-center gap-2 border-b border-border/60 px-3 sm:px-6">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <div className="ml-auto flex min-w-0 max-w-[240px] flex-1 justify-end"><SearchTriggerButton context="tenant" /></div>
          <Tooltip><TooltipTrigger asChild><Link href="/notifications"><Button variant="ghost" size="icon" aria-label="Notifiche"><Bell className="h-4 w-4" /></Button></Link></TooltipTrigger><TooltipContent>Notifiche</TooltipContent></Tooltip>
          <UserNav />
          {canCreate("crm") ? <Button asChild className="hidden sm:inline-flex"><Link href="/activities"><Plus className="h-4 w-4" />Nuova attività</Link></Button> : null}
          <Tooltip><TooltipTrigger asChild><div><ThemeSettingsDrawer /></div></TooltipTrigger><TooltipContent>Impostazioni aspetto</TooltipContent></Tooltip>
        </header>
        <main className="flex-1 overflow-y-auto"><TenantRouteGate>{children}</TenantRouteGate></main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export function LegacyTenantShell({ children }: { children: React.ReactNode }) {
  return (
    <AppSettingsProvider>
      <PlanProvider>
        <TenantAccessProvider>
          <LegacyTenantLayout>{children}</LegacyTenantLayout>
        </TenantAccessProvider>
      </PlanProvider>
    </AppSettingsProvider>
  )
}
