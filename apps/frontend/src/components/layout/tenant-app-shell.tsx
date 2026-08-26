"use client"

import * as React from "react"
import { LoaderCircle } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { FlowExperiencePreferencesProvider } from "@/components/flow-experience/flow-preferences-context"
import { UserNav } from "@/components/layout/user-nav"
import { ThemeToggle } from "@/components/theme-toggle"
import { Button } from "@/components/ui/button"
import { SearchTriggerButton } from "@/components/ui/global-search"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { DOFLOW_TENANT_NAVIGATION, moduleKeyForTenantPath, navigationVisibilityMatchesTenant, normalizeNavigationRole } from "@/config/tenant-navigation"
import { PlanProvider, usePlan } from "@/contexts/PlanContext"
import { TenantAccessProvider, useTenantAccess } from "@/contexts/TenantAccessContext"
import { CommercialLeadsProvider, useCommercialLeads } from "@/features/commercial/components/commercial-leads-provider"
import { DoflowExperienceProvider } from "@/features/identity/doflow-experience-context"
import { AccessDenied } from "@/features/identity/access-denied"
import { DoflowIdentityProvider, useDoflowIdentity } from "@/features/identity/doflow-identity-provider"
import { IdentitySessionGuard } from "@/features/identity/identity-session-guard"

export type TenantShellSession = {
  id: string
  email?: string
  role: string
  tenantId?: string
  tenantSlug?: string
  authStage?: string
}

const LEGACY_DOFLOW_ROUTE_REDIRECTS: Array<[string, string]> = [
  ["/finance/recurring-services", "/dashboard/rinnovi"],
  ["/finance/invoices", "/dashboard/fatture"],
  ["/finance/payments", "/dashboard/pagamenti"],
  ["/finance/deadlines", "/dashboard/scadenze"],
  ["/finance/renewals", "/dashboard/rinnovi"],
  ["/finance", "/dashboard/pagamenti"],
  ["/projects/tasks", "/dashboard/attivita"],
  ["/projects/milestones", "/dashboard/progetti"],
  ["/projects/timeline", "/dashboard/progetti"],
  ["/projects/kanban", "/dashboard/progetti"],
  ["/commercial/pipeline", "/dashboard/commercial/pipeline"],
  ["/commercial/leads", "/dashboard/commercial/leads"],
  ["/commercial", "/dashboard/commercial"],
  ["/pipeline", "/dashboard/commercial/pipeline"],
  ["/leads", "/dashboard/commercial/leads"],
  ["/deals", "/dashboard/commercial/pipeline"],
  ["/companies", "/dashboard/clienti"],
  ["/clients", "/dashboard/clienti"],
  ["/customers", "/dashboard/clienti"],
  ["/contacts", "/dashboard/clienti"],
  ["/projects", "/dashboard/progetti"],
  ["/activities", "/dashboard/attivita"],
  ["/activity", "/dashboard/attivita"],
  ["/tasks", "/dashboard/attivita"],
  ["/work", "/dashboard/attivita"],
  ["/timesheet", "/dashboard/attivita"],
  ["/calendar", "/dashboard/calendario"],
  ["/quotes", "/dashboard/preventivi"],
  ["/contracts", "/dashboard/contratti"],
  ["/signatures", "/dashboard/contratti"],
  ["/products", "/dashboard/catalogo"],
  ["/inventory", "/dashboard/catalogo"],
  ["/orders", "/dashboard/ordini"],
  ["/purchase-orders", "/dashboard/ordini"],
  ["/payments", "/dashboard/pagamenti"],
  ["/invoices", "/dashboard/fatture"],
  ["/billing", "/dashboard/fatture"],
  ["/expenses", "/dashboard/fatture"],
  ["/campaigns", "/dashboard/campagne"],
  ["/notifications", "/dashboard/inbox"],
  ["/inbox", "/dashboard/inbox"],
  ["/files", "/dashboard/documenti"],
  ["/documents", "/dashboard/documenti"],
  ["/paperwork", "/dashboard/documenti"],
  ["/credentials", "/dashboard/documenti"],
  ["/knowledge", "/dashboard/documenti"],
  ["/briefings", "/dashboard/commercial"],
  ["/forms", "/dashboard/commercial"],
  ["/reports", "/dashboard"],
  ["/analytics", "/dashboard"],
  ["/team", "/dashboard/team-space"],
  ["/settings", "/dashboard/impostazioni"],
  ["/tenant-users", "/dashboard/impostazioni"],
  ["/resources", "/dashboard"],
  ["/suppliers", "/dashboard"],
  ["/logistics", "/dashboard"],
  ["/support", "/dashboard/supporto"],
]

function legacyDoflowDestination(pathname: string) {
  if (pathname.startsWith("/commercial/site-proposals")) return null
  const match = LEGACY_DOFLOW_ROUTE_REDIRECTS.find(
    ([source]) => pathname === source || pathname.startsWith(`${source}/`),
  )
  return match ? `${match[1]}${pathname.slice(match[0].length)}` : null
}

function UniversalThemeBoundary({ children }: { children: React.ReactNode }) {
  React.useLayoutEffect(() => {
    const root = document.documentElement
    const previousTheme = root.getAttribute("data-tenant-ui")
    root.setAttribute("data-tenant-ui", "universal")
    return () => {
      if (previousTheme === null) root.removeAttribute("data-tenant-ui")
      else root.setAttribute("data-tenant-ui", previousTheme)
    }
  }, [])
  return <>{children}</>
}

function DoflowWorkspace({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { workspaceStatus, workspaceError, secondaryStatus, secondaryError, retryWorkspace, retrySecondary } = useCommercialLeads()
  const workspaceReady = workspaceStatus === "ready"
  const loading = workspaceStatus === "loading"

  React.useEffect(() => {
    if (workspaceStatus === "error" && workspaceError?.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [pathname, router, workspaceError?.status, workspaceStatus])

  return (
    <SidebarProvider data-app-ui-generation="universal-v1" className="universal-app-shell">
      <AppSidebar data-sidebar-kind="tenant" style={{ borderRightWidth: 0 }} />
      <SidebarInset as="div" data-app-inset="true">
        <DashboardHeader />
        <main className="relative min-w-0 flex-1 overflow-y-auto" data-app-shell-ready="true" data-workspace-ready={workspaceReady ? "true" : "false"} data-workspace-status={workspaceStatus} data-secondary-status={secondaryStatus} aria-busy={loading}>
          <div className="min-h-full" aria-hidden={workspaceReady ? undefined : true} inert={workspaceReady ? undefined : true}>
            {workspaceReady && secondaryStatus !== "ready" ? (
              <section className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-50/90 px-4 py-3 text-sm dark:bg-amber-950/30" role={secondaryStatus === "loading" ? "status" : "alert"} aria-live={secondaryStatus === "loading" ? "polite" : "assertive"}>
                <div className="flex items-center gap-2">
                  {secondaryStatus === "loading" ? <LoaderCircle className="size-4 animate-spin text-amber-700 dark:text-amber-300" aria-hidden="true" /> : null}
                  <p>{secondaryStatus === "loading" ? "Caricamento dei dati secondari…" : secondaryError?.message || "Alcuni dati secondari non sono disponibili."}</p>
                </div>
                {secondaryStatus === "error" ? <Button type="button" variant="outline" size="sm" onClick={retrySecondary}>Riprova dati secondari</Button> : null}
              </section>
            ) : null}
            <DoflowRouteCapabilityGate pathname={pathname}>{children}</DoflowRouteCapabilityGate>
          </div>
          {!workspaceReady ? (
            <section className="absolute inset-0 z-10 grid min-h-full place-items-center bg-background/95 px-6" role={loading ? "status" : "alert"} aria-live={loading ? "polite" : "assertive"}>
              <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm">
                {loading ? <LoaderCircle className="size-6 animate-spin text-primary" aria-hidden="true" /> : null}
                <p className="font-medium">{loading ? "Sincronizzazione workspace" : workspaceError?.status === 403 ? "Accesso al workspace non consentito" : "Workspace non disponibile"}</p>
                <p className="text-sm text-muted-foreground">{loading ? "Caricamento dei dati autorizzati dal server…" : workspaceError?.message || "Il caricamento non è riuscito."}</p>
                {!loading ? <Button type="button" variant="outline" size="sm" onClick={retryWorkspace}>Riprova caricamento</Button> : null}
              </div>
            </section>
          ) : null}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

const DOFLOW_ROUTE_CAPABILITIES = [
  ["/dashboard/company-intelligence", "canViewAssignedLeads"],
  ["/dashboard/team-space", "canViewProjects"],
  ["/dashboard/flowboard", "canViewProjects"],
  ["/dashboard/inbox", "canReadNotifications"],
  ["/dashboard/bonus", "canViewOwnPoints"],
] as const

function DoflowRouteCapabilityGate({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const { hasCapability } = useDoflowIdentity()
  const { activeModules, loading } = usePlan()
  const match = DOFLOW_ROUTE_CAPABILITIES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`))
  const requiresSalesIntelligence = pathname === "/dashboard/company-intelligence" || pathname.startsWith("/dashboard/company-intelligence/")
  if (requiresSalesIntelligence && loading) return <div className="p-6 text-sm text-muted-foreground">Caricamento moduli…</div>
  if (requiresSalesIntelligence && !activeModules.has("crm.sales-intel")) return <AccessDenied resource="a questa funzione" />
  if (match && !hasCapability(match[1])) return <AccessDenied resource="a questa funzione" />
  return <>{children}</>
}

function TenantRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { loading: accessLoading, canView } = useTenantAccess()
  const { activeModules, loading: planLoading } = usePlan()
  const moduleKey = React.useMemo(() => moduleKeyForTenantPath(pathname), [pathname])
  const featureKey = pathname === "/dashboard/company-intelligence" || pathname.startsWith("/dashboard/company-intelligence/")
    ? "crm.sales-intel"
    : null
  const featureAllowed = !featureKey || activeModules.has(featureKey)
  const genericDestination = pathname === "/dashboard/team-space" || pathname.startsWith("/dashboard/team-space/")
    ? "/team"
    : null

  React.useEffect(() => {
    if (genericDestination) router.replace(genericDestination)
    else if (!accessLoading && !planLoading && ((moduleKey && !canView(moduleKey)) || !featureAllowed)) router.replace("/dashboard")
  }, [accessLoading, canView, featureAllowed, genericDestination, moduleKey, planLoading, router])

  if (genericDestination) return <div className="p-6 text-sm text-muted-foreground">Apertura del Team Space…</div>
  if (accessLoading || planLoading) return <div className="p-6 text-sm text-muted-foreground">Caricamento permessi…</div>
  if ((moduleKey && !canView(moduleKey)) || !featureAllowed) return <div className="p-6 text-sm text-muted-foreground">Reindirizzamento…</div>
  return <>{children}</>
}

function GenericTenantWorkspace({ children, session }: { children: React.ReactNode; session: TenantShellSession }) {
  const { canView } = useTenantAccess()
  const { activeModules, can, tenantInfo } = usePlan()
  const role = normalizeNavigationRole(session.role)
  const tenantSlug = String(session.tenantSlug || session.tenantId || tenantInfo?.slug || "tenant").toLowerCase()
  const tenantName = tenantInfo?.name || tenantSlug

  const navigationGroups = React.useMemo(() => {
    const visible = DOFLOW_TENANT_NAVIGATION.flatMap((section) => {
      if (!navigationVisibilityMatchesTenant(section.visibility, false)) return []
      if (section.roles && !section.roles.includes(role)) return []
      if (section.minPlan && !can(section.minPlan)) return []
      if (section.moduleKey && !canView(section.moduleKey)) return []
      if (section.featureKey && !activeModules.has(section.featureKey)) return []
      const items = section.children?.flatMap((item) => {
        if (!navigationVisibilityMatchesTenant(item.visibility, false)) return []
        if (item.roles && !item.roles.includes(role)) return []
        if (item.minPlan && !can(item.minPlan)) return []
        if (item.moduleKey && !canView(item.moduleKey)) return []
        if (item.featureKey && !activeModules.has(item.featureKey)) return []
        return [{ title: item.label, url: item.href, icon: item.icon }]
      })
      if (section.children && !items?.length) return []
      return [{ title: section.label, url: section.href || items?.[0]?.url || "/dashboard", icon: section.icon, items }]
    })
    const settings = visible.filter((item) => item.url === "/settings")
    const workspace = visible.filter((item) => item.url !== "/settings")
    return [
      { label: "Workspace", items: workspace },
      ...(settings.length ? [{ label: "Sistema", placement: "bottom" as const, items: settings }] : []),
    ]
  }, [activeModules, can, canView, role])

  return (
    <SidebarProvider data-app-ui-generation="universal-v1" className="universal-app-shell">
      <AppSidebar navigationGroups={navigationGroups} tenantName={tenantName} tenantSlug={tenantSlug} data-sidebar-kind="tenant" footer={<div className="flex items-center gap-2 px-1"><UserNav /><div className="min-w-0 group-data-[collapsible=icon]:hidden"><p className="truncate text-sm font-medium">{session.email || "Account"}</p><p className="truncate text-xs capitalize text-muted-foreground">{role}</p></div></div>} />
      <SidebarInset as="div" data-app-inset="true">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b bg-background/90 px-4 backdrop-blur-xl lg:px-6">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold">{tenantName}</p></div>
          <div className="hidden min-w-0 max-w-sm flex-1 sm:block"><SearchTriggerButton context="tenant" /></div>
          <ThemeToggle />
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto" data-app-shell-ready="true">
          <TenantRouteGate>{children}</TenantRouteGate>
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

export function TenantAppShell({ children, session }: { children: React.ReactNode; session: TenantShellSession }) {
  const pathname = usePathname()
  const router = useRouter()
  const tenant = String(session.tenantSlug || session.tenantId || "").toLowerCase()
  const isDoflow = tenant === "doflow"
  const destination = isDoflow ? legacyDoflowDestination(pathname) : null

  React.useEffect(() => {
    if (destination) router.replace(`${destination}${window.location.search}`)
  }, [destination, router])

  if (destination) return <div className="grid min-h-screen place-items-center bg-background text-sm text-muted-foreground">Apertura del workspace…</div>

  return (
    <UniversalThemeBoundary>
      <FlowExperiencePreferencesProvider>
        <PlanProvider>
          <TenantAccessProvider>
            {isDoflow ? (
              <DoflowExperienceProvider>
                <DoflowIdentityProvider>
                  <IdentitySessionGuard>
                    <CommercialLeadsProvider>
                      <DoflowWorkspace>{children}</DoflowWorkspace>
                    </CommercialLeadsProvider>
                  </IdentitySessionGuard>
                </DoflowIdentityProvider>
              </DoflowExperienceProvider>
            ) : (
              <GenericTenantWorkspace session={session}>{children}</GenericTenantWorkspace>
            )}
          </TenantAccessProvider>
        </PlanProvider>
      </FlowExperiencePreferencesProvider>
    </UniversalThemeBoundary>
  )
}
