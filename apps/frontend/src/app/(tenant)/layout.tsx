"use client"

import * as React from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Bell, LoaderCircle, Plus } from "lucide-react"

import { apiFetch } from "@/lib/api"
import { clearDoFlowUser, setDoFlowUser } from "@/lib/jwt"
import { moduleKeyForTenantPath } from "@/config/tenant-navigation"
import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { TenantSidebar } from "@/components/layout/tenant-sidebar"
import { UserNav } from "@/components/layout/user-nav"
import { ThemeSettingsDrawer } from "@/components/layout/theme-settings-drawer"
import { Button } from "@/components/ui/button"
import { SearchTriggerButton } from "@/components/ui/global-search"
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { PlanProvider } from "@/contexts/PlanContext"
import { AppSettingsProvider, useAppSettings } from "@/contexts/AppSettingsContext"
import { TenantAccessProvider, useTenantAccess } from "@/contexts/TenantAccessContext"
import {
  CommercialLeadsProvider,
  useCommercialLeads,
} from "@/features/commercial/components/commercial-leads-provider"
import { DoflowExperienceProvider } from "@/features/identity/doflow-experience-context"
import { DoflowIdentityProvider } from "@/features/identity/doflow-identity-provider"
import { IdentitySessionGuard } from "@/features/identity/identity-session-guard"

type AuthMe = { user: { id: string; role: string; tenantId?: string; tenantSlug?: string; authStage?: string } }

const LEGACY_DOFLOW_ROUTES: Array<[string, string]> = [
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
  ["/calendar", "/dashboard/scadenze"],
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
  ["/notifications", "/dashboard/notifiche"],
  ["/files", "/dashboard/documenti"],
  ["/documents", "/dashboard/documenti"],
  ["/paperwork", "/dashboard/documenti"],
  ["/credentials", "/dashboard/documenti"],
  ["/knowledge", "/dashboard/documenti"],
  ["/briefings", "/dashboard/commercial"],
  ["/forms", "/dashboard/commercial"],
  ["/reports", "/dashboard"],
  ["/analytics", "/dashboard"],
  ["/team", "/dashboard/impostazioni"],
  ["/settings", "/dashboard/impostazioni"],
  ["/tenant-users", "/dashboard/impostazioni"],
  ["/resources", "/dashboard"],
  ["/suppliers", "/dashboard"],
  ["/logistics", "/dashboard"],
  ["/support", "/dashboard/clienti"],
]

function legacyDestination(pathname: string) {
  if (pathname.startsWith("/commercial/site-proposals")) return null
  const match = LEGACY_DOFLOW_ROUTES.find(([source]) => pathname === source || pathname.startsWith(`${source}/`))
  return match ? `${match[1]}${pathname.slice(match[0].length)}` : null
}

function DoflowCommercialShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const {
    workspaceStatus,
    workspaceError,
    secondaryStatus,
    secondaryError,
    retryWorkspace,
    retrySecondary,
  } = useCommercialLeads()
  const workspaceReady = workspaceStatus === "ready"

  React.useEffect(() => {
    if (workspaceStatus === "error" && workspaceError?.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [pathname, router, workspaceError?.status, workspaceStatus])

  const loading = workspaceStatus === "loading"
  const title = loading
    ? "Sincronizzazione workspace"
    : workspaceError?.status === 403
      ? "Accesso al workspace non consentito"
      : "Workspace non disponibile"
  const description = loading
    ? "Caricamento dei dati autorizzati dal server…"
    : workspaceError?.message || "Il caricamento non è riuscito."

  return (
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <DashboardHeader />
        <main
          className="relative min-w-0 flex-1 overflow-y-auto"
          data-app-shell-ready="true"
          data-workspace-ready={workspaceReady ? "true" : "false"}
          data-workspace-status={workspaceStatus}
          data-secondary-status={secondaryStatus}
          aria-busy={loading}
        >
          <div
            className="min-h-full"
            aria-hidden={workspaceReady ? undefined : true}
            inert={workspaceReady ? undefined : true}
          >
            {workspaceReady && secondaryStatus !== "ready" ? (
              <section
                className="mx-4 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm"
                role={secondaryStatus === "loading" ? "status" : "alert"}
                aria-live={secondaryStatus === "loading" ? "polite" : "assertive"}
              >
                <div className="flex items-center gap-2">
                  {secondaryStatus === "loading" ? (
                    <LoaderCircle
                      className="size-4 animate-spin text-amber-700 dark:text-amber-300"
                      aria-hidden="true"
                    />
                  ) : null}
                  <p>
                    {secondaryStatus === "loading"
                      ? "Caricamento dei dati secondari…"
                      : secondaryError?.message ||
                        "Alcuni dati secondari non sono disponibili."}
                  </p>
                </div>
                {secondaryStatus === "error" ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={retrySecondary}
                  >
                    Riprova dati secondari
                  </Button>
                ) : null}
              </section>
            ) : null}
            {children}
          </div>
          {!workspaceReady ? (
            <section
              className="absolute inset-0 z-10 grid min-h-full place-items-center bg-background px-6"
              role={loading ? "status" : "alert"}
              aria-live={loading ? "polite" : "assertive"}
            >
              <div className="flex max-w-sm flex-col items-center gap-3 rounded-xl border bg-card p-6 text-center shadow-sm">
                {loading ? (
                  <LoaderCircle
                    className="size-6 animate-spin text-primary"
                    aria-hidden="true"
                  />
                ) : null}
                <p className="font-medium">{title}</p>
                <p className="text-sm text-muted-foreground">{description}</p>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={retryWorkspace}
                >
                  Riprova caricamento
                </Button>
              </div>
            </section>
          ) : null}
        </main>
      </SidebarInset>
    </SidebarProvider>
  )
}

function DoflowLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const destination = legacyDestination(pathname)
  const isAutomationWorkspace = pathname === "/automations" || pathname.startsWith("/automations/")

  React.useEffect(() => {
    if (destination) router.replace(`${destination}${window.location.search}`)
  }, [destination, router])

  if (destination) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Apertura del nuovo workspace…</div>

  return (
    <DoflowExperienceProvider>
      <DoflowIdentityProvider>
        <IdentitySessionGuard>
          {isAutomationWorkspace ? (
            <SidebarProvider>
              <AppSidebar />
              <SidebarInset>
                <DashboardHeader />
                <main
                  className="min-w-0 flex-1 overflow-y-auto"
                  data-app-shell-ready="true"
                  data-workspace-ready="true"
                  data-workspace-status="ready"
                  data-secondary-status="ready"
                >
                  {children}
                </main>
              </SidebarInset>
            </SidebarProvider>
          ) : (
            <CommercialLeadsProvider>
              <DoflowCommercialShell>{children}</DoflowCommercialShell>
            </CommercialLeadsProvider>
          )}
        </IdentitySessionGuard>
      </DoflowIdentityProvider>
    </DoflowExperienceProvider>
  )
}

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
    <SidebarProvider>
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

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const [session, setSession] = React.useState<AuthMe["user"] | null | undefined>(undefined)

  React.useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    apiFetch<AuthMe>("/auth/me", { signal: controller.signal })
      .then((result) => {
        if (cancelled) return
        setDoFlowUser({ ...result.user, sub: result.user.id })
        setSession(result.user)
      })
      .catch((error) => {
        if (cancelled || (error instanceof Error && error.name === "AbortError")) return
        clearDoFlowUser()
        setSession(null)
        router.replace("/login")
      })
    return () => {
      cancelled = true
      controller.abort()
    }
  }, [router])

  if (session === undefined || session === null) return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Caricamento spazio di lavoro…</div>

  const tenant = String(session.tenantSlug || session.tenantId || "").toLowerCase()
  const role = String(session.role || "").toLowerCase()
  if (["superadmin", "super_admin"].includes(role) || tenant === "public") {
    if (!pathname.startsWith("/superadmin")) router.replace("/superadmin")
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Apertura amministrazione…</div>
  }
  if (tenant === "doflow") return <DoflowLayout>{children}</DoflowLayout>

  return <AppSettingsProvider><PlanProvider><TenantAccessProvider><LegacyTenantLayout>{children}</LegacyTenantLayout></TenantAccessProvider></PlanProvider></AppSettingsProvider>
}
