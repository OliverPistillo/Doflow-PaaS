"use client";

import * as React from "react";
// 1. Aggiungiamo usePathname
import { useRouter, usePathname } from "next/navigation"; 
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./components/super-admin-sidebar";
import { getDoFlowUser } from "@/lib/jwt";

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname(); // Freno a mano
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const user = getDoFlowUser();
    
    // Se non loggato
    if (!user) {
      if (pathname !== "/login") {
        router.replace("/login");
      }
      return;
    }

    // Normalizziamo ruolo e tenantId come fatto dall'altra parte
    const role = String(user.role || "").toLowerCase().trim();
    const tenantId = String(user.tenantId || "").toLowerCase().trim();

    // REGOLA DI ACCESSO SUPERADMIN:
    // Deve essere superadmin/owner OPPURE appartenere al tenant "public"
    const isSuperAdmin = ["superadmin", "super_admin", "owner"].includes(role) || tenantId === "public";

    if (!isSuperAdmin) {
      // Non è autorizzato qui, mandiamolo alla SUA dashboard tenant
      // Solo se non è già lì (evitiamo ping pong)
      if (!pathname.startsWith("/dashboard")) {
        router.replace("/dashboard");
      }
      return;
    }
    
    // Se arriviamo qui, è un vero superadmin
    setReady(true);
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground animate-pulse">Caricamento OPS&hellip;</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <SuperAdminSidebar />
      <SidebarInset>
        {/* HEADER */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 backdrop-blur px-4 sticky top-0 z-10">
          <SidebarTrigger className="-ml-1" />
          <div className="h-5 w-px bg-border" />
          <span className="text-sm font-semibold text-muted-foreground">DoFlow OPS</span>
          <div className="flex-1" />
        </header>

        {/* CONTENUTO */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}