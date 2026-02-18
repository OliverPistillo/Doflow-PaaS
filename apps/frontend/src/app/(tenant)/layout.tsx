"use client";

import * as React from "react";
// 1. Aggiungiamo usePathname per capire su che pagina siamo attualmente
import { useRouter, usePathname } from "next/navigation"; 
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { TenantSidebar } from "@/components/layout/tenant-sidebar";
import { UserNav } from "@/components/layout/user-nav";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getDoFlowUser } from "@/lib/jwt";
import { PlanProvider } from "@/contexts/PlanContext";

export default function TenantLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname(); // 2. Recuperiamo il percorso attuale (es. "/dashboard")
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    const user = getDoFlowUser();
    
    // Se non c'è utente...
    if (!user) {
      // Vai al login SOLO se non sei già sulla pagina di login
      if (pathname !== "/login") {
        router.replace("/login");
      } else {
        setReady(true);
      }
      return;
    }
    
    const role = String(user.role || "").toLowerCase().trim();
    const tenantId = String(user.tenantId || "").toLowerCase().trim();

    // Se l'utente è un Superadmin o fa parte della directory globale...
    if (["superadmin", "super_admin", "owner"].includes(role) || tenantId === "public") {
      // 3. IL FRENO A MANO: Vai al superadmin SOLO se non sei già lì
      if (!pathname.startsWith("/superadmin")) {
        router.replace("/superadmin");
      } else {
        setReady(true);
      }
      return;
    }
    
    // Utente tenant legittimo
    setReady(true);
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground animate-pulse">Caricamento spazio di lavoro&hellip;</p>
      </div>
    );
  }

  return (
    <PlanProvider>
      <SidebarProvider>
        <TenantSidebar />
        <SidebarInset>
          {/* HEADER */}
          <header className="flex h-14 shrink-0 items-center gap-3 border-b bg-background/95 backdrop-blur px-4 sticky top-0 z-10">
            <SidebarTrigger className="-ml-1" />
            <div className="h-5 w-px bg-border" />
            <div className="flex-1" />
            <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-indigo-600">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2.5 h-2 w-2 bg-rose-500 rounded-full border-2 border-background" />
            </Button>
            <UserNav />
          </header>

          {/* CONTENUTO */}
          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            {children}
          </main>
        </SidebarInset>
      </SidebarProvider>
    </PlanProvider>
  );
}