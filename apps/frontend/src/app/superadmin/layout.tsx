"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  SidebarProvider, SidebarTrigger, SidebarInset,
} from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./components/super-admin-sidebar";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDoFlowUser, getInitials } from "@/lib/jwt";
import { ChevronRight, Shield, LogOut, User, Bell, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// ─── Breadcrumb helper ────────────────────────────────────────────────────────

const LABEL_MAP: Record<string, string> = {
  superadmin:    "OPS",
  dashboard:     "Sales Dashboard",
  finance:       "Fatturazione",
  invoices:      "Fatture",
  templates:     "Template",
  tenants:       "Tenant",
  users:         "Utenti",
  audit:         "Audit Log",
  sales:         "Vendite",
  pipeline:      "Pipeline",
  delivery:      "Servizio",
  status:        "Stato",
  calendar:      "Calendario",
  "control-tower": "Control Tower",
  metrics:       "Metriche SaaS",
};

function crumbs(pathname: string | null) {
  if (!pathname) return [];
  const parts = pathname.split("/").filter(Boolean);
  const acc: { label: string; href: string }[] = [];
  let href = "";
  for (const p of parts) {
    href += `/${p}`;
    acc.push({ label: LABEL_MAP[p] ?? (p.charAt(0).toUpperCase() + p.slice(1)), href });
  }
  return acc;
}

// ─── User Nav ─────────────────────────────────────────────────────────────────

function UserNav() {
  const router = useRouter();
  const [user, setUser] = React.useState<{ email: string; initials: string } | null>(null);

  React.useEffect(() => {
    const payload = getDoFlowUser();
    if (payload) {
      setUser({ email: payload.email ?? "superadmin", initials: getInitials(payload.email) });
    }
  }, []);

  const logout = () => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0">
          <Avatar className="h-9 w-9 border-2 border-primary/20">
            <AvatarFallback className="bg-primary/10 text-primary font-bold text-sm">
              {user?.initials ?? "SA"}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-xl">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold truncate">{user?.email ?? "Superadmin"}</p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Shield className="h-3 w-3 text-primary" /> Control Plane
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/superadmin/users" className="cursor-pointer">
            <User className="mr-2 h-4 w-4" /> Il mio Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={logout}
          className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer"
        >
          <LogOut className="mr-2 h-4 w-4" /> Disconnetti
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
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
    const isSuperAdmin =
      ["superadmin", "super_admin", "owner"].includes(role) || tenantId === "public";

    if (!isSuperAdmin) {
      if (!pathname.startsWith("/dashboard")) router.replace("/dashboard");
      return;
    }

    setReady(true);
  }, [router, pathname]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
          <p className="text-sm text-muted-foreground font-medium animate-pulse">
            Accesso Control Plane…
          </p>
        </div>
      </div>
    );
  }

  const breadcrumbs = crumbs(pathname);

  return (
    <SidebarProvider>
      <SuperAdminSidebar />

      <SidebarInset>
        {/* ── HEADER ─────────────────────────────────────────────────────── */}
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-3 border-b border-border/60 bg-background/95 backdrop-blur-sm px-4">

          <SidebarTrigger className="-ml-1 text-muted-foreground hover:text-foreground" />
          <div className="h-5 w-px bg-border/60" />

          {/* OPS Badge */}
          <Badge
            variant="outline"
            className="hidden sm:flex items-center gap-1.5 text-[10px] font-bold px-2 py-0.5 text-primary border-primary/30 bg-primary/5"
          >
            <Zap className="h-2.5 w-2.5" />
            OPS
          </Badge>

          {/* Breadcrumb */}
          <nav className="hidden md:flex items-center gap-1 text-xs text-muted-foreground min-w-0">
            {breadcrumbs.map((c, idx) => (
              <React.Fragment key={c.href}>
                {idx > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-border" />}
                <Link
                  href={c.href}
                  className={
                    idx === breadcrumbs.length - 1
                      ? "font-semibold text-foreground truncate"
                      : "hover:text-foreground transition-colors truncate"
                  }
                >
                  {c.label}
                </Link>
              </React.Fragment>
            ))}
          </nav>

          <div className="flex-1" />

          {/* Notifications placeholder */}
          <Button
            variant="ghost"
            size="icon"
            className="relative h-9 w-9 text-muted-foreground hover:text-foreground"
          >
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-1.5 w-1.5 bg-rose-500 rounded-full" />
          </Button>

          {/* Theme Toggle */}
          <ThemeToggle />

          {/* User Nav */}
          <UserNav />
        </header>

        {/* ── CONTENUTO ──────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-[1600px] mx-auto animate-in fade-in duration-500">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}