"use client"

import * as React from "react"
import { usePathname, useRouter } from "next/navigation"
import { LoaderCircle } from "lucide-react"

import { AppSidebar } from "@/components/app-sidebar"
import { DashboardHeader } from "@/components/dashboard-header"
import { Button } from "@/components/ui/button"
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar"
import {
  CommercialLeadsProvider,
  useCommercialLeads,
} from "@/features/commercial/components/commercial-leads-provider"
import { DoflowExperienceProvider } from "@/features/identity/doflow-experience-context"
import { DoflowIdentityProvider } from "@/features/identity/doflow-identity-provider"
import { IdentitySessionGuard } from "@/features/identity/identity-session-guard"

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
  ["/notifications", "/dashboard/notifiche"],
  ["/inbox", "/dashboard/notifiche"],
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

function legacyDestination(pathname: string) {
  if (pathname.startsWith("/commercial/site-proposals")) return null
  const match = LEGACY_DOFLOW_ROUTES.find(
    ([source]) => pathname === source || pathname.startsWith(`${source}/`),
  )
  return match ? `${match[1]}${pathname.slice(match[0].length)}` : null
}

function DoflowThemeBoundary({ children }: { children: React.ReactNode }) {
  React.useLayoutEffect(() => {
    const root = document.documentElement
    const previousTheme = root.getAttribute("data-doflow-theme")
    const wasDark = root.classList.contains("dark")
    root.setAttribute("data-doflow-theme", "default")
    root.classList.remove("dark")
    return () => {
      if (previousTheme === null) root.removeAttribute("data-doflow-theme")
      else root.setAttribute("data-doflow-theme", previousTheme)
      if (wasDark) root.classList.add("dark")
    }
  }, [])
  return <>{children}</>
}

function DoflowWorkspace({ children }: { children: React.ReactNode }) {
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
  const loading = workspaceStatus === "loading"

  React.useEffect(() => {
    if (workspaceStatus === "error" && workspaceError?.status === 401) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`)
    }
  }, [pathname, router, workspaceError?.status, workspaceStatus])

  return (
    <SidebarProvider
      data-doflow-shell="daniele-design"
      data-doflow-theme="default"
      data-doflow-ui-generation="replacement"
      className="doflow-daniele-shell"
      style={{
        "--sidebar-width": "248px",
        "--sidebar-width-icon": "64px",
      } as React.CSSProperties}
    >
      <AppSidebar data-sidebar-kind="daniele-design" style={{ borderRightWidth: 0 }} />
      <SidebarInset as="div" data-doflow-inset="true">
        <DashboardHeader />
        <main
          className="relative min-w-0 flex-1 overflow-y-auto"
          data-app-shell-ready="true"
          data-workspace-ready={workspaceReady ? "true" : "false"}
          data-workspace-status={workspaceStatus}
          data-secondary-status={secondaryStatus}
          aria-busy={loading}
        >
          <div className="min-h-full" aria-hidden={workspaceReady ? undefined : true} inert={workspaceReady ? undefined : true}>
            {workspaceReady && secondaryStatus !== "ready" ? (
              <section
                className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-500/35 bg-amber-50/90 px-4 py-3 text-sm"
                role={secondaryStatus === "loading" ? "status" : "alert"}
                aria-live={secondaryStatus === "loading" ? "polite" : "assertive"}
              >
                <div className="flex items-center gap-2">
                  {secondaryStatus === "loading" ? <LoaderCircle className="size-4 animate-spin text-amber-700" aria-hidden="true" /> : null}
                  <p>{secondaryStatus === "loading" ? "Caricamento dei dati secondari…" : secondaryError?.message || "Alcuni dati secondari non sono disponibili."}</p>
                </div>
                {secondaryStatus === "error" ? <Button type="button" variant="outline" size="sm" onClick={retrySecondary}>Riprova dati secondari</Button> : null}
              </section>
            ) : null}
            {children}
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

export function DoflowDanieleShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const destination = legacyDestination(pathname)

  React.useEffect(() => {
    if (destination) router.replace(`${destination}${window.location.search}`)
  }, [destination, router])

  if (destination) {
    return <div className="grid min-h-screen place-items-center text-sm text-muted-foreground">Apertura del nuovo workspace…</div>
  }

  return (
    <DoflowThemeBoundary>
      <DoflowExperienceProvider>
        <DoflowIdentityProvider>
          <IdentitySessionGuard>
            <CommercialLeadsProvider>
              <DoflowWorkspace>{children}</DoflowWorkspace>
            </CommercialLeadsProvider>
          </IdentitySessionGuard>
        </DoflowIdentityProvider>
      </DoflowExperienceProvider>
    </DoflowThemeBoundary>
  )
}
