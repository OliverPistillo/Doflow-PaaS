// Percorso: C:\Doflow\apps\frontend\src\app\superadmin\components\super-admin-sidebar.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  Users,
  Activity,
  ShieldAlert,
  LogOut,
  BarChart3,
  ListTodo,
  Truck,
  CalendarDays,
  Wallet,
  Receipt,
  Moon,
  Sun,
  ChevronsUpDown,
  BadgeCheck,
  User,
  Settings,
  Palette,
  TrendingUp,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  useSidebar,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuPortal,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getDoFlowUser, getInitials } from "@/lib/jwt";

// ─── Menu ─────────────────────────────────────────────────────────────────────

const MENU_GROUPS = [
  {
    label: "Performance commerciali",
    items: [
      { label: "Sales Dashboard",  href: "/superadmin/dashboard",      icon: BarChart3,   badge: undefined },
      { label: "Gestione offerte", href: "/superadmin/sales/pipeline", icon: ListTodo,    badge: undefined },
    ],
  },
  {
    label: "Metriche Platform",
    items: [
      { label: "Metriche SaaS",    href: "/superadmin/metrics",        icon: TrendingUp,  badge: undefined },
      { label: "Control Tower",    href: "/superadmin/control-tower",  icon: ShieldAlert, badge: undefined },
    ],
  },
  {
    label: "Consegna del servizio",
    items: [
      { label: "Stato del servizio",      href: "/superadmin/delivery/status",   icon: Truck,        badge: undefined },
      { label: "Calendario del progetto", href: "/superadmin/delivery/calendar", icon: CalendarDays,  badge: undefined },
    ],
  },
  {
    label: "Fatturazione",
    items: [
      { label: "Dashboard finanziario", href: "/superadmin/finance/dashboard", icon: Wallet,  badge: undefined },
      { label: "Gestione fatture",      href: "/superadmin/finance/invoices",  icon: Receipt, badge: undefined },
    ],
  },
  {
    label: "Platform Admin",
    items: [
      { label: "Gestione Tenant", href: "/superadmin/tenants", icon: Building2, badge: undefined },
      { label: "Gestione Utenti", href: "/superadmin/users",   icon: Users,     badge: undefined },
      { label: "Audit Log",       href: "/superadmin/audit",   icon: Activity,  badge: undefined },
    ],
  },
];

// ─── Theming Logic ─────────────────────────────────────────────────────────────

const COLOR_THEMES = [
  { id: "default", label: "Neutro (Default)", colorClass: "bg-slate-500" },
  { id: "ocean",   label: "Ocean (Blu/Verde)", colorClass: "bg-blue-500" },
  { id: "sunset",  label: "Sunset (Giallo/Arancio)", colorClass: "bg-orange-500" },
  { id: "emerald", label: "Emerald (Verde Smeraldo)", colorClass: "bg-emerald-500" },
];

function setColorTheme(themeId: string) {
  if (typeof window !== "undefined") {
    document.documentElement.setAttribute("data-color-theme", themeId);
    localStorage.setItem("doflow_color_theme", themeId);
  }
}

// ─── Nav Item Modificato per rimuovere "pillola" e aggiungere tooltip ───────────

function NavItem({
  href,
  label,
  icon: Icon,
  badge,
  isOpen,
}: {
  href:   string;
  label:  string;
  icon:   React.ComponentType<{ className?: string }>;
  badge?: number;
  isOpen: boolean;
}) {
  const pathname = usePathname();
  const active   = pathname === href || pathname.startsWith(href + "/");

  return (
    <Link
      href={href}
      className={`group relative flex items-center gap-3 py-2 px-3 my-0.5 rounded-none transition-colors 
        ${active ? "text-primary font-bold" : "text-muted-foreground hover:text-foreground"}`}
    >
      <Icon className="h-[19px] w-[19px] shrink-0" />
      
      {/* Testo visibile solo se espansa */}
      <span className={`transition-all duration-200 whitespace-nowrap ${isOpen ? "opacity-100 w-auto" : "opacity-0 w-0 overflow-hidden"}`}>
        {label}
      </span>

      {/* Badge (se presente) */}
      {badge !== undefined && badge > 0 && isOpen && (
        <span className="ml-auto text-[10px] font-bold bg-rose-500 text-white rounded-full px-1.5 py-0.5 min-w-[18px] text-center leading-none">
          {badge > 99 ? "99+" : badge}
        </span>
      )}

      {/* Tooltip Fluttuante: visibile SOLO se la sidebar è chiusa e c'è l'hover */}
      {!isOpen && (
        <div className="absolute left-full ml-4 px-2.5 py-1.5 bg-popover text-popover-foreground text-xs font-medium rounded-md opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-200 z-[100] whitespace-nowrap shadow-lg border border-border">
          {label}
        </div>
      )}
    </Link>
  );
}

// ─── Main sidebar ──────────────────────────────────────────────────────────────

export function SuperAdminSidebar() {
  const router = useRouter();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { state } = useSidebar();

  const [mounted, setMounted]     = React.useState(false);
  const [user, setUser]           = React.useState<{ email: string; role: string; initials: string } | null>(null);
  const [isHovered, setIsHovered] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
    const savedColorTheme = localStorage.getItem("doflow_color_theme") || "default";
    setColorTheme(savedColorTheme);

    const payload = getDoFlowUser();
    if (payload) {
      setUser({
        email:    payload.email ?? "superadmin",
        role:     payload.role  ?? "superadmin",
        initials: getInitials(payload.email),
      });
    }
  }, []);

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  }, [router]);

  const isOpen   = state === "expanded" || isHovered;
  const logoSrc  = mounted && resolvedTheme === "light" ? "/logo_doflow_nero.png" : "/logo_doflow_bianco.png";

  return (
    <Sidebar
      collapsible="icon"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`z-50 border-none ${isOpen ? "sa-sidebar-open" : ""}`}
      style={{
        ["--sidebar-width" as string]: "220px",
        ["--sidebar-width-icon" as string]: "72px",
        transition: "width 0.28s cubic-bezier(0.4, 0, 0.2, 1)",
      }}
    >
      {/* ── HEADER: Logo + Brand ─────────────────────────────────── */}
      <SidebarHeader className="border-b-0 p-0 overflow-hidden shrink-0">
        <div className="sa-logo-wrapper">
          <div className={`relative h-10 shrink-0 transition-all duration-300 ease-out ${isOpen ? "w-10" : "w-10"}`}>
            {mounted && (
              <Image
                src={logoSrc}
                alt="DoFlow Logo"
                fill
                priority
                className={`object-contain object-left transition-opacity duration-300 ${isOpen ? "opacity-100" : "opacity-90"}`}
              />
            )}
          </div>
          <span className="sa-brand-name">DoFlow</span>
        </div>
      </SidebarHeader>

      {/* ── CONTENT: Nav Groups ──────────────────────────────────── */}
      <SidebarContent className={`pt-2 overflow-y-auto scrollbar-none transition-all duration-300 ${isOpen ? "px-3" : "px-[14px]"}`}>
        {MENU_GROUPS.map((group) => (
          <div key={group.label} className="sa-nav-group mb-3">
            <div className={`transition-all duration-200 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2 ${isOpen ? "opacity-100 h-auto" : "opacity-0 h-0 overflow-hidden"}`}>
              {group.label}
            </div>
            <div className="flex flex-col gap-[2px]">
              {group.items.map((item) => (
                <NavItem
                  key={item.href}
                  href={item.href}
                  label={item.label}
                  icon={item.icon}
                  badge={item.badge}
                  isOpen={isOpen}
                />
              ))}
            </div>
          </div>
        ))}
      </SidebarContent>

      {/* ── FOOTER: Avatar + Dropdown ────────────────────────────── */}
      <SidebarFooter className={`border-t border-[var(--border-divider)] transition-all duration-300 ${isOpen ? "p-3" : "p-2 flex items-center justify-center"}`}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2.5 w-full rounded-xl p-2 hover:bg-[var(--bg-hover)] transition-colors outline-none"
            >
              <Avatar className="h-9 w-9 rounded-lg border-2 border-primary/20 shrink-0 shadow-md">
                <AvatarFallback
                  className="rounded-lg font-bold text-sm"
                  style={{
                    background: "var(--icon-active-bg)",
                    color: "var(--icon-active-color)",
                  }}
                >
                  {user?.initials ?? "SA"}
                </AvatarFallback>
              </Avatar>
              <div className="sa-avatar-info">
                <span className="text-[13px] font-semibold text-[var(--text-primary)] whitespace-nowrap">
                  {user?.email ?? "Superadmin"}
                </span>
                <span className="text-[10px] font-bold text-[var(--text-secondary)] uppercase flex items-center gap-1 whitespace-nowrap">
                  <BadgeCheck className="h-3 w-3 text-primary" />
                  {user?.role}
                </span>
              </div>
              {isOpen && <ChevronsUpDown className="ml-auto h-4 w-4 text-[var(--text-secondary)] shrink-0" />}
            </button>
          </DropdownMenuTrigger>

          <DropdownMenuContent
            className="w-[240px] rounded-xl shadow-2xl border-[var(--border-card)] glass-card"
            side={state === "collapsed" && !isHovered ? "right" : "bottom"}
            align="end"
            sideOffset={10}
          >
            <DropdownMenuLabel className="p-2 font-normal">
              <div className="flex items-center gap-3 text-left text-sm">
                <Avatar className="h-10 w-10 rounded-lg shadow-md">
                  <AvatarFallback
                    className="rounded-lg font-bold"
                    style={{
                      background: "var(--icon-active-bg)",
                      color: "var(--icon-active-color)",
                    }}
                  >
                    {user?.initials ?? "SA"}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-bold text-[var(--text-primary)]">{user?.email}</span>
                  <span className="truncate text-xs text-[var(--text-secondary)]">{user?.role}</span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator className="bg-[var(--border-divider)]" />

            <DropdownMenuGroup>
              <DropdownMenuItem asChild>
                <Link href="/superadmin/users" className="cursor-pointer py-2 rounded-lg">
                  <User className="mr-2 h-4 w-4 text-[var(--text-secondary)]" />
                  Il mio Account
                </Link>
              </DropdownMenuItem>

              {/* Tema Chiaro/Scuro */}
              <DropdownMenuItem onClick={() => setTheme(theme === "dark" ? "light" : "dark")} className="cursor-pointer py-2 rounded-lg">
                {resolvedTheme === "dark" ? <Sun className="mr-2 h-4 w-4" /> : <Moon className="mr-2 h-4 w-4" />}
                Passa a {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
              </DropdownMenuItem>

              {/* Colori Primari */}
              <DropdownMenuSub>
                <DropdownMenuSubTrigger className="py-2 rounded-lg cursor-pointer">
                  <Palette className="mr-2 h-4 w-4 text-[var(--text-secondary)]" />
                  Stile e Colori
                </DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="glass-card rounded-xl border-[var(--border-card)] ml-2">
                    {COLOR_THEMES.map((ct) => (
                      <DropdownMenuItem
                        key={ct.id}
                        onClick={() => setColorTheme(ct.id)}
                        className="cursor-pointer py-2 flex items-center gap-2"
                      >
                        <div className={`h-3 w-3 rounded-full ${ct.colorClass} ring-1 ring-offset-1 ring-offset-card ring-black/10`} />
                        {ct.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>

              <DropdownMenuItem asChild>
                <Link href="/superadmin/settings" className="cursor-pointer py-2 rounded-lg">
                  <Settings className="mr-2 h-4 w-4 text-[var(--text-secondary)]" />
                  Impostazioni Globali
                </Link>
              </DropdownMenuItem>
            </DropdownMenuGroup>

            <DropdownMenuSeparator className="bg-[var(--border-divider)]" />

            <DropdownMenuItem
              onClick={logout}
              className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer py-2 mt-1 rounded-lg font-medium"
            >
              <LogOut className="mr-2 h-4 w-4" />
              Disconnetti in sicurezza
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarFooter>
      {/* Rimosso SidebarRail per eliminare la linea laterale */}
    </Sidebar>
  );
}