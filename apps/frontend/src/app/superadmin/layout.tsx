// apps/frontend/src/app/superadmin/layout.tsx

"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { SidebarProvider, SidebarInset, useSidebar } from "@/components/ui/sidebar";
const SuperAdminSidebar = dynamic(
  () => import("./components/super-admin-sidebar").then((m) => m.SuperAdminSidebar),
  { ssr: false, loading: () => <div className="w-[240px] bg-[#0f1623] animate-pulse" /> }
);
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getDoFlowUser, getInitials } from "@/lib/jwt";
import { Shield, LogOut, User, Bell } from "lucide-react";
import { useTheme } from "next-themes";
const SearchTriggerButton = dynamic(
  () => import("@/components/ui/global-search").then((m) => m.SearchTriggerButton),
  { ssr: false, loading: () => <div className="w-8 h-8" /> }
);

// ─── PAGE_TITLE_MAP ───────────────────────────────────────────────────────────

const PAGE_TITLE_MAP: Record<string, string> = {
  // Command Center
  "/superadmin":                           "Control Room",

  // Sales & CRM
  "/superadmin/sales/dashboard":           "Sales Dashboard",
  "/superadmin/sales/pipeline":            "Pipeline",
  "/superadmin/sales/quote-requests":      "Richieste Preventivo",
  "/superadmin/leads":                     "Lead Management",
  "/superadmin/automations":               "Automazioni CRM",
  "/superadmin/sales-intelligence":        "Sales Intelligence AI",

  // Platform Admin
  "/superadmin/tenants":                   "Gestione Tenant",
  "/superadmin/users":                     "Gestione Utenti",
  "/superadmin/modules":                   "Moduli & Feature Flags",
  "/superadmin/subscriptions":             "Subscription & Revenue",

  // Billing
  "/superadmin/finance/dashboard":         "Dashboard Finanziario",
  "/superadmin/finance/invoices/new":      "Nuova Fattura",
  "/superadmin/finance/invoices":          "Gestione Fatture",
  "/superadmin/finance/preventivi/new":    "Nuovo Preventivo",

  // Operations
  "/superadmin/delivery/status":           "Stato Delivery",
  "/superadmin/delivery/calendar":         "Calendario Progetto",

  // Infrastruttura
  "/superadmin/system":                    "System Monitor",
  "/superadmin/storage":                   "Storage & Backup",

  // Comunicazione & Supporto
  "/superadmin/notifications":             "Centro Notifiche",
  "/superadmin/tickets":                   "Ticket Supporto",
  "/superadmin/email-templates":           "Email Templates",
  "/superadmin/changelog":                 "Changelog & Release Notes",

  // Configurazione
  "/superadmin/audit":                     "Audit Log",
  "/superadmin/settings":                  "Impostazioni Globali",
  "/superadmin/account":                   "Il mio Account",

  // Legacy
  "/superadmin/dashboard":                 "Sales Dashboard",
  "/superadmin/metrics":                   "Metriche SaaS",
  "/superadmin/control-tower":             "Control Tower",
  "/superadmin/system-health":             "System Health",
  "/superadmin/api-usage":                 "API Usage",
};

function getPageTitle(p: string | null): string {
  if (!p) return "DoFlow";
  if (PAGE_TITLE_MAP[p]) return PAGE_TITLE_MAP[p];
  const match = Object.keys(PAGE_TITLE_MAP)
    .filter((k) => p.startsWith(k))
    .sort((a, b) => b.length - a.length)[0];
  return match ? PAGE_TITLE_MAP[match] : "DoFlow";
}

// ─── AnimatedTrigger ─────────────────────────────────────────────────────────

function AnimatedTrigger() {
  const { state, toggleSidebar } = useSidebar();
  const isOpen = state === "expanded";
  return (
    <button
      onClick={toggleSidebar}
      className={`h-9 w-9 rounded-nav flex items-center justify-center relative text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring ${isOpen ? "text-foreground" : ""}`}
      aria-label={isOpen ? "Comprimi sidebar" : "Espandi sidebar"}
    >
      <svg className="icon-open" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3"  y="3"  width="7" height="7" rx="1.5"/><rect x="14" y="3"  width="7" height="7" rx="1.5"/>
        <rect x="3"  y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>
      </svg>
      <svg className="icon-close" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2"/><line x1="9" y1="3" x2="9" y2="21"/><polyline points="14 8 11 12 14 16"/>
      </svg>
    </button>
  );
}

// ─── AnimatedThemeToggle ──────────────────────────────────────────────────────

function AnimatedThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme();
  return (
    <button
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="h-9 w-9 rounded-nav flex items-center justify-center relative overflow-hidden bg-card/60 hover:bg-primary/10 text-foreground backdrop-blur-xl border border-border/50 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
      aria-label={resolvedTheme === "dark" ? "Passa a Light Mode" : "Passa a Dark Mode"}
    >
      <svg className="icon-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="5"/>
        <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
        <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
        <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
        <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
      </svg>
      <svg className="icon-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
      </svg>
    </button>
  );
}

// ─── UserNav ──────────────────────────────────────────────────────────────────

function UserNav() {
  const router = useRouter();
  const [user, setUser] = React.useState<{ email: string; initials: string } | null>(null);

  React.useEffect(() => {
    const payload = getDoFlowUser();
    if (payload) setUser({ email: payload.email ?? "superadmin", initials: getInitials(payload.email) });
  }, []);

  const logout = () => { window.localStorage.removeItem("doflow_token"); router.push("/login"); };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="h-9 w-9 rounded-nav bg-primary/10 text-primary flex items-center justify-center font-bold text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring hover:bg-primary/20 transition-colors"
          aria-label="Menu utente"
        >
          <span aria-hidden="true">{user?.initials ?? "SA"}</span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-card shadow-card border-border">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-1">
            <p className="text-sm font-semibold truncate text-foreground">{user?.email ?? "Superadmin"}</p>
            <p className="text-xs flex items-center gap-1 text-muted-foreground">
              <Shield className="h-3 w-3 text-primary" aria-hidden="true" /> Control Plane
            </p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/superadmin/account" className="cursor-pointer">
            <User className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" /> Il mio Account
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={logout} className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" aria-hidden="true" /> Disconnetti
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ─── SuperAdminHeader ─────────────────────────────────────────────────────────

function SuperAdminHeader() {
  const pathname = usePathname();
  const title    = getPageTitle(pathname);

  return (
    <header className="doflow-app-header flex items-center justify-between h-14 px-4 sm:px-6 gap-3 sticky top-0 z-40 shrink-0">
      {/* Left */}
      <div className="flex items-center gap-2 min-w-0">
        <AnimatedTrigger />
        <h1 className="text-base sm:text-lg font-bold text-foreground truncate ml-1">{title}</h1>
      </div>

      {/* Center search — hidden on mobile */}
      <div className="flex-1 flex justify-center max-w-xs lg:max-w-sm hidden sm:flex">
        <SearchTriggerButton context="superadmin" />
      </div>

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          className="relative h-9 w-9 rounded-nav bg-card/60 border border-border/50 backdrop-blur-xl flex items-center justify-center text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Notifiche"
        >
          <Bell className="h-4 w-4" aria-hidden="true" />
          <span className="absolute top-2 right-2 h-1.5 w-1.5 bg-destructive rounded-full" aria-label="Nuove notifiche" />
        </button>
        <AnimatedThemeToggle />
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
    const isSuperAdmin = ["superadmin", "super_admin", "owner"].includes(role) || tenantId === "public";
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
          <p className="text-sm animate-pulse text-muted-foreground">Accesso Control Plane…</p>
        </div>
      </div>
    );
  }

  return (
    <SidebarProvider style={{ "--sidebar-width": "220px", "--sidebar-width-icon": "72px" } as React.CSSProperties}>
      <SuperAdminSidebar />
      <SidebarInset className="doflow-app-frame">
        <SuperAdminHeader />
        <main className="doflow-app-main flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="max-w-[1600px] mx-auto animate-fade-in">
            {children}
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}