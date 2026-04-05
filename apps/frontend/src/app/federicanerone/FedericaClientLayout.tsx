"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { FedericaSidebar } from "@/components/federica-sidebar";
import { getDoFlowUser } from "@/lib/jwt";

export default function FedericaClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [email, setEmail] = React.useState("utente");
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // Salva token da query string se presente
    const url = new URL(window.location.href);
    const tokenFromQuery = url.searchParams.get("token");
    if (tokenFromQuery && tokenFromQuery.length > 20) {
      window.localStorage.setItem("doflow_token", tokenFromQuery);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
    }

    // Legge e verifica il token
    const payload = getDoFlowUser();
    if (!payload) {
      router.push("/login");
      return;
    }
    if (payload.email) setEmail(payload.email);

    // Verifica tenant corretto
    const tenant = (payload.tenantId ?? payload.tenantSlug ?? "").toLowerCase();
    if (tenant && tenant !== "federicanerone") {
      router.push("/dashboard");
      return;
    }

    setReady(true);
  }, [router]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
        <p className="text-sm text-muted-foreground animate-pulse">Caricamento…</p>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full bg-background text-foreground">
        <FedericaSidebar />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 items-center gap-3 border-b bg-background/95 backdrop-blur px-4 sticky top-0 z-10">
            <SidebarTrigger />
            <div className="h-5 w-px bg-border" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium leading-none text-foreground">Federica Nerone</div>
              <div className="text-xs text-muted-foreground truncate mt-0.5">{pathname}</div>
            </div>
            <div className="text-xs text-muted-foreground shrink-0">
              <span className="font-mono">{email}</span>
            </div>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
