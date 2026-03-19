// Percorso: apps/frontend/src/app/superadmin/components/super-admin-sidebar.tsx
// FIXED: usa SidebarMenu/SidebarMenuButton invece di raw <Link> con classi sa-*
// Eredita automaticamente lo stile dal sidebar.tsx refactored (token Figma)

"use client";

import * as React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2, Users, Activity, ShieldAlert, LogOut,
  BarChart3, ListTodo, Truck, CalendarDays, Wallet,
  Receipt, Moon, Sun, ChevronsUpDown, BadgeCheck,
  User, Settings, Palette, TrendingUp,
} from "lucide-react";
import { useTheme } from "next-themes";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarGroupContent,
  SidebarRail,
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

// ─── Menu definition ──────────────────────────────────────────────────────────

const MENU_GROUPS = [
  {
    label: "Sales & Pipeline",
    items: [
      { label: "Sales Dashboard",  href: "/superadmin/dashboard",      icon: BarChart3   },
      { label: "Gestione offerte", href: "/superadmin/sales/pipeline", icon: ListTodo    },
    ],
  },
  {
    label: "Analytics & Control",
    items: [
      { label: "Metriche SaaS", href: "/superadmin/metrics",       icon: TrendingUp  },
      { label: "Control Tower", href: "/superadmin/control-tower", icon: ShieldAlert },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Stato del servizio",      href: "/superadmin/delivery/status",   icon: Truck       },
      { label: "Calendario del progetto", href: "/superadmin/delivery/calendar", icon: CalendarDays },
    ],
  },
  {
    label: "Fatturazione",
    items: [
      { label: "Dashboard finanziario", href: "/superadmin/finance/dashboard", icon: Wallet  },
      { label: "Gestione fatture",      href: "/superadmin/finance/invoices",  icon: Receipt },
    ],
  },
  {
    label: "Platform Admin",
    items: [
      { label: "Gestione Tenant", href: "/superadmin/tenants", icon: Building2 },
      { label: "Gestione Utenti", href: "/superadmin/users",   icon: Users     },
      { label: "Audit Log",       href: "/superadmin/audit",   icon: Activity  },
    ],
  },
];

// ─── Color themes ─────────────────────────────────────────────────────────────

const COLOR_THEMES = [
  { id: "default", label: "Neutro (Default)",      colorClass: "bg-muted/20"   },
  { id: "ocean",   label: "Ocean (Blu/Verde)",      colorClass: "bg-blue-500"    },
  { id: "sunset",  label: "Sunset (Giallo/Arancio)", colorClass: "bg-orange-500" },
  { id: "emerald", label: "Emerald (Verde Smeraldo)", colorClass: "bg-emerald-500" },
];

function setColorTheme(themeId: string) {
  if (typeof window !== "undefined") {
    document.documentElement.setAttribute("data-color-theme", themeId);
    localStorage.setItem("doflow_color_theme", themeId);
  }
}

// ─── NavItem — usa SidebarMenuButton → eredita tutti i token Figma ────────────

function NavItem({
  href,
  label,
  icon: Icon,
}: {
  href:  string;
  label: string;
  icon:  React.ComponentType<{ className?: string }>;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || pathname.startsWith(href + "/");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        asChild
        isActive={isActive}
        tooltip={label}
        // Non servono classi extra: tutti gli stili vengono da sidebar.tsx refactored
      >
        <Link href={href}>
          {/* Aumentiamo la dimensione dell'icona (da 19 a 22px) per balance su collapsed width 80px */}
          <Icon className="h-[22px] w-[22px] shrink-0" aria-hidden="true" />
          {/* LA CORREZIONE: Aggiungiamo 'group-data-[collapsible=icon]:hidden' */}
          <span className="group-data-[collapsible=icon]:hidden">{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// ─── SuperAdminSidebar ────────────────────────────────────────────────────────

export function SuperAdminSidebar() {
  const router = useRouter();
  const { setTheme, theme, resolvedTheme } = useTheme();
  const { state } = useSidebar();
  const isOpen = state === "expanded";

  const [mounted, setMounted] = React.useState(false);
  const [user, setUser] = React.useState<{
    email: string;
    role: string;
    initials: string;
  } | null>(null);

  React.useEffect(() => {
    setMounted(true);

    // Ripristina tema colore salvato
    const savedColorTheme = localStorage.getItem("doflow_color_theme") || "default";
    setColorTheme(savedColorTheme);

    // Carica utente dal JWT
    const payload = getDoFlowUser();
    if (payload) {
      setUser({
        email:    payload.email ?? "superadmin",
        role:     payload.role  ?? "SUPER_ADMIN",
        initials: getInitials(payload.email),
      });
    }
  }, []);

  const logout = React.useCallback(() => {
    window.localStorage.removeItem("doflow_token");
    router.push("/login");
  }, [router]);

  const logoSrc = mounted && resolvedTheme === "light"
    ? "/logo_doflow_nero.png"
    : "/logo_doflow_bianco.png";

  return (
    <Sidebar
      collapsible="icon"
      // Larghezze ereditate dal SidebarProvider nel layout (220/72px)
    >

      {/* ── HEADER: Logo ──────────────────────────────────────────────── */}
      <SidebarHeader className="h-16 p-0 border-b border-sidebar-border flex flex-col justify-center">
        <div className={`flex w-full items-center transition-all duration-300 ${isOpen ? "px-4 justify-start" : "px-0 justify-center"}`}>
          {/* Logo mark */}
          <div className={`relative transition-all duration-300 ${isOpen ? "h-8 w-36" : "h-8 w-8 shrink-0"}`}>
            {mounted && (
              <Image
                src={logoSrc}
                alt="DoFlow"
                fill
                priority
                // object-left assicura che il logo parta da sinistra quando è aperto, allargandosi
                className={`transition-all duration-300 ${isOpen ? "object-contain object-left" : "object-contain object-center"}`}
              />
            )}
          </div>
        </div>
      </SidebarHeader>

      {/* ── CONTENT: Nav Groups ───────────────────────────────────────── */}
      <SidebarContent>
        {MENU_GROUPS.map((group) => (
          <SidebarGroup key={group.label}>
            {/* Label di gruppo — SidebarGroupLabel già gestisce collapsed */}
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <NavItem
                    key={item.href}
                    href={item.href}
                    label={item.label}
                    icon={item.icon}
                  />
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      {/* ── FOOTER: User avatar + dropdown ───────────────────────────── */}
      <SidebarFooter className="border-none pb-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                {/* Modifichiamo il button: allineiamo al centro quando collassato, puliamo padding */}
                <SidebarMenuButton
                  size="lg"
                  className={`data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground ${isOpen ? "justify-start px-3" : "w-full justify-center px-0 py-1"}`}
                  aria-label="Menu utente"
                >
                  {/* Aumentiamo l'avatar da h-8/w-8 a h-10/w-10 (40px) */}
                  <Avatar className="h-10 w-10 rounded-nav border border-border shrink-0">
                    <AvatarFallback
                      className="rounded-nav text-base font-bold"
                      style={{
                        background: "hsl(var(--primary) / 0.12)",
                        color:      "hsl(var(--primary))",
                      }}
                    >
                      {user?.initials ?? "SA"}
                    </AvatarFallback>
                  </Avatar>

                  {/* Testo — nascosto quando collassato (gestito da group-data-[collapsible=icon]:hidden) */}
                  <div className="grid flex-1 text-left text-sm leading-tight group-data-[collapsible=icon]:hidden">
                    <span className="truncate font-semibold text-foreground">
                      {user?.email ?? "Superadmin"}
                    </span >
                    <span className="truncate text-[11px] text-muted-foreground flex items-center gap-1">
                      <BadgeCheck className="h-3 w-3 text-primary" aria-hidden="true" />
                      {user?.role ?? "SUPER_ADMIN"}
                    </span>
                  </div>

                  <ChevronsUpDown className="ml-auto size-4 text-muted-foreground/50 group-data-[collapsible=icon]:hidden" aria-hidden="true" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent
                className="w-60 rounded-card shadow-card border-border"
                side={isOpen ? "bottom" : "right"}
                align="end"
                sideOffset={8}
              >
                {/* ...DropdownMenuLabel content... */}
                <DropdownMenuLabel className="p-2 font-normal">
                  <div className="flex items-center gap-2.5">
                    {/* Aumentiamo anche l'avatar nel Dropdown (da h-9/w-9 a h-10/w-10) per coerenza */}
                    <Avatar className="h-10 w-10 rounded-nav">
                      <AvatarFallback
                        className="rounded-nav font-bold"
                        style={{
                          background: "hsl(var(--primary) / 0.12)",
                          color:      "hsl(var(--primary))",
                        }}
                      >
                        {user?.initials ?? "SA"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="grid text-left text-sm leading-tight">
                      <span className="truncate font-bold text-foreground">
                        {user?.email ?? "superadmin"}
                      </span >
                      <span className="truncate text-xs text-muted-foreground">
                        {user?.role ?? "SUPER_ADMIN"}
                      </span>
                    </div>
                  </div>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem asChild>
                    <Link href="/superadmin/account" className="cursor-pointer">
                      <User className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Il mio Account
                    </Link>
                  </DropdownMenuItem>

                  {/* Light/Dark toggle */}
                  <DropdownMenuItem
                    onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                    className="cursor-pointer"
                  >
                    {resolvedTheme === "dark"
                      ? <Sun  className="mr-2 h-4 w-4" aria-hidden="true" />
                      : <Moon className="mr-2 h-4 w-4" aria-hidden="true" />
                    }
                    Passa a {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
                  </DropdownMenuItem>

                  {/* Color theme sub-menu */}
                  <DropdownMenuSub>
                    <DropdownMenuSubTrigger className="cursor-pointer">
                      <Palette className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Stile e Colori
                    </DropdownMenuSubTrigger>
                    <DropdownMenuPortal>
                      <DropdownMenuSubContent className="rounded-card border-border">
                        {COLOR_THEMES.map((ct) => (
                          <DropdownMenuItem
                            key={ct.id}
                            onClick={() => setColorTheme(ct.id)}
                            className="cursor-pointer gap-2"
                          >
                            <div className={`h-3 w-3 rounded-full ${ct.colorClass} ring-1 ring-offset-1 ring-offset-card ring-black/10`} />
                            {ct.label}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuSubContent>
                    </DropdownMenuPortal>
                  </DropdownMenuSub>

                  <DropdownMenuItem asChild>
                    <Link href="/superadmin/settings" className="cursor-pointer">
                      <Settings className="mr-2 h-4 w-4 text-muted-foreground" aria-hidden="true" />
                      Impostazioni Globali
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuGroup>

                <DropdownMenuSeparator />

                <DropdownMenuItem
                  onClick={logout}
                  className="text-destructive focus:text-destructive focus:bg-destructive/10 cursor-pointer font-medium"
                >
                  <LogOut className="mr-2 h-4 w-4" aria-hidden="true" />
                  Disconnetti in sicurezza
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}