// Percorso: C:\Doflow\apps\frontend\src\app\superadmin\layout.tsx
"use client";

import * as React from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  SidebarProvider,
  SidebarInset,
  useSidebar,
} from "@/components/ui/sidebar";
import { SuperAdminSidebar } from "./components/super-admin-sidebar";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDoFlowUser, getInitials } from "@/lib/jwt";
import { Shield, LogOut, User, Bell } from "lucide-react";
import { useTheme } from "next-themes";

// ─── Mappa pathname → Titolo pagina ───────────────────────────────────────────

const PAGE_TITLE_MAP: Record<string, string> = {
  "/superadmin/dashboard":            "Sales Dashboard",
  "/superadmin/sales/pipeline":       "Gestione Offerte",
  "/superadmin/metrics":              "Metriche SaaS",
  "/superadmin/control-tower":        "Control Tower",
  "/superadmin/delivery/status":      "Stato del Servizio",
  "/superadmin/delivery/calendar":    "Calendario Progetto",
  "/superadmin/finance/dashboard":    "Dashboard Finanziario",
  "/superadmin/finance/invoices/new": "Nuova Fattura",
  "/superadmin/finance/invoices":     "Gestione Fatture",
  "/superadmin/tenants":              "Gestione Tenant",
  "/superadmin/users":                "Gestione Utenti",
  "/superadmin/audit":                "Audit Log",
  "/superadmin/settings":             "Impostazioni Globali",
};

function getPageTitle(pathname: string | null): string {
  if (!pathname) return "DoFlow";
  if (PAGE_TITLE_MAP[pathname]) return PAGE_TITLE_MAP[pathname];
  // Corrispondenza prefisso (route nested)
  const match = Object.keys(PAGE_TITLE_MAP)
    .filter((k) => pathname.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLE_MAP[match] : "DoFlow";
}

// ─── Pulsante Trigger Animato ─────────────────────────────────────────────────

function AnimatedTrigger() {
  const { state, toggleSidebar } = useSidebar();
  const isOpen = state === "expanded";
  return (
    <button
      onClick={toggleSidebar}
      className={`h-9 w-9 rounded-nav flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted transition-colors relative outline-none focus-visible:ring-2 focus-visible:ring-ring ${isOpen ? "text-foreground" : ""}`}
      aria-label="Toggle sidebar"
    >
      <svg className="icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3"  y="3"  width="7" height="7" rx="1.5"/>
        <rect x="14" y="3"  width="7" height="7" rx="1.5"/>
        <rect x="3"  y="14" width="7" height="7" rx="1.5"/>
        <rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
      <svg className="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2"/>
        <line x1="9" y1="3"  x2="9"  y2="21"/>
        <polyline points="14 8 11 12 14 16"/>
      </svg>
    </button>
  );
}

// ─── Theme Toggle Animato ─────────────────────────────────────────────────────

function AnimatedThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="h-9 w-9 rounded-nav bg-muted hover:bg-muted/80 flex items-center justify-center text-foreground transition-colors relative overflow-hidden outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label="Toggle theme"
    >
      <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1"  x2="12" y2="3"/>   <line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22"  y1="4.22"  x2="5.64"  y2="5.64"/>
        <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1"  y1="12" x2="3"  y2="12"/>   <line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22"  y1="19.78" x2="5.64"  y2="18.36"/>
        <line x1="18.36" y1="5.64"  x2="19.78" y2="4.22"/>
      </svg>
      <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </button>
  );
}

// ─── User Avatar Dropdown ─────────────────────────────────────────────────────

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
        <button
          className="h-9 w-9 rounded-nav bg-primary/10 text-primary flex items-center justify-center font-bold text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-primary/20 transition-colors"
          aria-label="User menu"
        >
          <span className="text-sm font-bold leading-none">
            {user?.initials ?? "SA"}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-card shadow-card border-border">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold truncate text-foreground">
              {user?.email ?? "Superadmin"}
            </p>
            <p className="text-xs flex items-center gap-1 text-muted-foreground">
              <Shield className="h-3 w-3 text-primary" /> Control Plane
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/superadmin/users" className="cursor-pointer">
            <User className="mr-2 h-4 w-4 text-muted-foreground" />
            Il mio Account
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

// ─── Header Unificato (usa useSidebar quindi deve stare dentro SidebarProvider)

function SuperAdminHeader() {
  const pathname = usePathname();
  const title = getPageTitle(pathname);

  return (
    <header className="flex items-center justify-between px-6 h-14 border-b border-border bg-background/80 backdrop-blur-sm sticky top-0 z-40 shrink-0">
      <div className="flex items-center gap-2">
        <AnimatedTrigger />
        <h1 className="text-lg font-bold text-foreground ml-1">{title}</h1>
      </div>
      <div className="flex items-center gap-3">
        {/* Notifiche */}
        <button className="header-btn header-btn-bell" aria-label="Notifiche">
          <Bell style={{ width: 18, height: 18 }} />
          <span className="header-bell-dot" />
        </button>

        {/* Theme Toggle animato */}
        <AnimatedThemeToggle />

        {/* User Avatar */}
        <UserNav />
      </div>
    </header>
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
          <p className="text-sm animate-pulse" style={{ color: "var(--text-secondary)" }}>
            Accesso Control Plane…
          </p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider
      style={{
        "--sidebar-width":      "220px",
        "--sidebar-width-icon": "72px",
      } as React.CSSProperties}
    >
      <SuperAdminSidebar />
      <SidebarInset>
        {/* ── HEADER UNICO PER TUTTE LE PAGINE ─────────────────── */}
        <SuperAdminHeader />

        {/* ── CONTENUTO ──────────────────────────────────────────── */}
        <main className="flex-1 overflow-y-auto p-6">
          <div className="max-w-[1600px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}