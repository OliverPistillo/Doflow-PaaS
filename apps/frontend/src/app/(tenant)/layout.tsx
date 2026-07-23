// Percorso: apps/frontend/src/app/(tenant)/layout.tsx
// Aggiunto: SearchTriggerButton Cmd+K nell'header

"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  SidebarProvider, SidebarTrigger, SidebarInset,
} from "@/components/ui/sidebar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TenantSidebar } from "@/components/layout/tenant-sidebar";
import { UserNav } from "@/components/layout/user-nav";
import { ThemeSettingsDrawer } from "@/components/layout/theme-settings-drawer";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDoFlowUser } from "@/lib/jwt";
import { PlanProvider } from "@/contexts/PlanContext";
import { AppSettingsProvider, useAppSettings } from "@/contexts/AppSettingsContext";
import { TenantAccessProvider, useTenantAccess } from "@/contexts/TenantAccessContext";
import { SearchTriggerButton } from "@/components/ui/global-search";
import { moduleKeyForTenantPath } from "@/config/tenant-navigation";

// ─── Inner layout — consuma AppSettingsContext ─────────────────────────────────

function TenantRouteGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { loading, canView } = useTenantAccess();
  const moduleKey = React.useMemo(() => moduleKeyForTenantPath(pathname), [pathname]);

  React.useEffect(() => {
    if (!loading && moduleKey && !canView(moduleKey)) router.replace("/dashboard");
  }, [loading, moduleKey, canView, router]);

  if (loading) {
    return <div className="p-6 text-sm text-muted-foreground">Caricamento permessi...</div>;
  }
  if (moduleKey && !canView(moduleKey)) {
    return <div className="p-6 text-sm text-muted-foreground">Reindirizzamento...</div>;
  }
  return <>{children}</>;
}

function TenantLayoutInner({ children }: { children: React.ReactNode }) {
  const { sidebarVariant } = useAppSettings();
  const currentUser = getDoFlowUser();
  const tenantSlug = String(currentUser?.tenantSlug || currentUser?.tenantId || "").toLowerCase();
  const isDoflowTenant = tenantSlug === "doflow";

  return (
    <SidebarProvider>
      <TenantSidebar variant={sidebarVariant} collapsible="icon" />
      <SidebarInset className={isDoflowTenant ? "doflow-app-frame" : undefined}>

        {/* ── HEADER ── */}
        <header className="doflow-app-header sticky top-0 z-20 flex h-16 shrink-0 items-center gap-2 border-b border-border/60 px-3 sm:px-5">
          <SidebarTrigger className="-ml-1 shrink-0" />
          <div className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

          <div className="ml-auto flex min-w-0 max-w-[260px] flex-1 justify-end">
            <SearchTriggerButton context="tenant" />
          </div>

          {/* Notifiche */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Link href="/notifications">
                <Button
                  variant="ghost"
                  size="icon"
                  className="relative text-muted-foreground hover:text-foreground"
                  aria-label="Notifiche"
                >
                  <Bell className="h-4 w-4" aria-hidden="true" />
                  <span className="absolute top-2 right-2 h-1.5 w-1.5 bg-rose-500 rounded-full" aria-hidden="true" />
                </Button>
              </Link>
            </TooltipTrigger>
            <TooltipContent side="bottom" align="center">
              Notifiche
            </TooltipContent>
          </Tooltip>

          {/* Theme Settings drawer */}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <ThemeSettingsDrawer />
              </div>
            </TooltipTrigger>
            <TooltipContent>
              Impostazioni aspetto
            </TooltipContent>
          </Tooltip>

          {/* User menu */}
          <UserNav />
        </header>

        {/* ── CONTENUTO ── */}
        <main className="doflow-app-main flex-1 overflow-y-auto">
          <TenantRouteGate>{children}</TenantRouteGate>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

// ─── Root layout con guard autenticazione ─────────────────────────────────────

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const user = getDoFlowUser();

    if (!user) {
      if (pathname !== "/login") router.replace("/login");
      else setReady(true);
      return;
    }

    const role     = String(user.role     ?? "").toLowerCase().trim();
    const tenantId = String(user.tenantId ?? "").toLowerCase().trim();

    // The user is a superadmin if their role is superadmin OR if their tenant is public (e.g. system owner)
    // Regular tenant owners should be able to access the tenant dashboard.
    const isSuperAdmin = ["superadmin", "super_admin"].includes(role) || tenantId === "public";

    if (isSuperAdmin) {
      if (!pathname.startsWith("/superadmin")) router.replace("/superadmin");
      else setReady(true);
      return;
    }

    setReady(true);
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground animate-pulse">
          Caricamento spazio di lavoro…
        </p>
      </div>
    );
  }

  return (
    <AppSettingsProvider>
      <PlanProvider>
        <TenantAccessProvider>
          <TenantLayoutInner>{children}</TenantLayoutInner>
        </TenantAccessProvider>
      </PlanProvider>
    </AppSettingsProvider>
  );
}
