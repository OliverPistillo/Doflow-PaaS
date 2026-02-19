"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  SidebarProvider, SidebarTrigger, SidebarInset,
} from "@/components/ui/sidebar";
import { TenantSidebar } from "@/components/layout/tenant-sidebar";
import { UserNav } from "@/components/layout/user-nav";
import { ThemeSettingsDrawer } from "@/components/layout/theme-settings-drawer";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDoFlowUser } from "@/lib/jwt";
import { PlanProvider } from "@/contexts/PlanContext";
import { AppSettingsProvider, useAppSettings } from "@/contexts/AppSettingsContext";

// ─── Inner layout — consuma AppSettingsContext ─────────────────────────────────

function TenantLayoutInner({ children }: { children: React.ReactNode }) {
  const { sidebarVariant, sidebarCollapsible } = useAppSettings();

  // collapsible="none" significa sidebar sempre aperta (layout Default)
  const collapsible = sidebarCollapsible === "none" ? "none" : sidebarCollapsible;

  return (
    <SidebarProvider>
      <TenantSidebar variant={sidebarVariant} collapsible={collapsible} />
      <SidebarInset>
        {/* ── HEADER ── */}
        <header className="flex h-14 shrink-0 items-center gap-2 border-b bg-background/95 backdrop-blur-sm px-4 sticky top-0 z-10">
          <SidebarTrigger className="-ml-1" />
          <div className="h-5 w-px bg-border" />
          <div className="flex-1" />

          {/* Notifiche */}
          <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 bg-rose-500 rounded-full" />
          </Button>

          {/* Theme Settings drawer */}
          <ThemeSettingsDrawer />

          {/* User menu */}
          <UserNav />
        </header>

        {/* ── CONTENUTO ── */}
        <main className="flex-1 overflow-y-auto">
          {children}
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

    if (["superadmin", "super_admin", "owner"].includes(role) || tenantId === "public") {
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
        <TenantLayoutInner>{children}</TenantLayoutInner>
      </PlanProvider>
    </AppSettingsProvider>
  );
}
