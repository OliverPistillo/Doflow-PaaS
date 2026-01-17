"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { FedericaSidebar } from "@/components/federica-sidebar";

type JwtPayload = { email?: string; role?: string; tenantId?: string; tenant_id?: string };

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null;
}

function parseJwtPayload(token: string): JwtPayload | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;

    const json = atob(part.replace(/-/g, "+").replace(/_/g, "/"));
    const parsed: unknown = JSON.parse(json);
    if (!isRecord(parsed)) return null;

    return {
      email: typeof parsed.email === "string" ? parsed.email : undefined,
      role: typeof parsed.role === "string" ? parsed.role : undefined,
      tenantId: typeof parsed.tenantId === "string" ? parsed.tenantId : undefined,
      tenant_id: typeof parsed.tenant_id === "string" ? parsed.tenant_id : undefined,
    };
  } catch {
    return null;
  }
}

export default function FedericaClientLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();

  const [email, setEmail] = React.useState("utente");
  const [ready, setReady] = React.useState(false);

  React.useEffect(() => {
    // 1) Se arrivo con ?token=..., lo salvo e pulisco l'URL
    const url = new URL(window.location.href);
    const tokenFromQuery = url.searchParams.get("token");

    if (tokenFromQuery && tokenFromQuery.length > 20) {
      window.localStorage.setItem("doflow_token", tokenFromQuery);
      url.searchParams.delete("token");
      window.history.replaceState({}, "", url.toString());
    }

    // 2) Token finale
    const token = window.localStorage.getItem("doflow_token");
    if (!token) {
      router.push("/login");
      return;
    }

    // 3) Decodifica
    const payload = parseJwtPayload(token);
    if (payload?.email) setEmail(payload.email);

    // 4) Path-based tenant: se token non è federicanerone, fuori
    const tenant = (payload?.tenantId ?? payload?.tenant_id ?? "").toString().toLowerCase();
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
          {/* Header top (con trigger sidebar) */}
          <header className="flex h-14 items-center gap-3 border-b px-4">
            <SidebarTrigger />

            <div className="min-w-0">
              <div className="text-sm font-medium leading-none">Federica Nerone</div>
              <div className="text-xs text-muted-foreground truncate">
                {pathname}
              </div>
            </div>

            <div className="ml-auto text-xs text-muted-foreground">
              Logged: <span className="font-mono">{email}</span>
            </div>
          </header>

          <main className="flex-1 p-6">{children}</main>
        </div>
      </div>
    </SidebarProvider>
  );
}
